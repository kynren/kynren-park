import 'dart:math' as math;
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'map_logic.dart';

/// Pan, pinch-zoom and two-finger rotate for a big canvas, driving [controller]. It does what [InteractiveViewer] does
/// (which cannot rotate), plus a gentle fling, a snap back to north when you let go nearly upright, and wheel zoom.
/// [constrain] keeps the resulting view on the map.
class RotatableViewer extends StatefulWidget {
  final TransformationController controller;
  final Matrix4 Function(Matrix4 view) constrain;
  final double minScale, maxScale;
  final Widget child;
  /// Called when a finger lands, so the screen can cancel any move of its own that is still running.
  final VoidCallback? onInteract;
  const RotatableViewer({super.key, required this.controller, required this.constrain, required this.minScale, required this.maxScale, required this.child, this.onInteract});

  @override
  State<RotatableViewer> createState() => _RotatableViewerState();
}

/// Turn must pass this before a pinch starts to rotate, so zooming never twists the map by accident.
const _rotateThreshold = 0.14; // about 8 degrees
const _snapWithin = 0.1; // about 6 degrees: letting go this close to upright straightens the map

class _RotatableViewerState extends State<RotatableViewer> with SingleTickerProviderStateMixin {
  late final AnimationController _anim = AnimationController(vsync: this);
  Matrix4 _start = Matrix4.identity();
  Offset _startFocal = Offset.zero;
  int _count = 0;
  bool _rotating = false;
  double _rotOffset = 0;

  TransformationController get _c => widget.controller;

  @override
  void initState() {
    super.initState();
    _anim.addListener(_tick);
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  void _rebase(Offset focal) {
    _start = _c.value.clone();
    _startFocal = focal;
    _rotating = false;
    _rotOffset = 0;
  }

  void _onStart(ScaleStartDetails d) {
    _anim.stop();
    widget.onInteract?.call();
    _count = d.pointerCount;
    _rebase(d.localFocalPoint);
  }

  void _onUpdate(ScaleUpdateDetails d) {
    // Adding or lifting a finger restarts the gesture's scale and turn from 1 and 0, so carry on from the view as it is now.
    if (d.pointerCount != _count) {
      _count = d.pointerCount;
      _rebase(d.localFocalPoint);
      return;
    }
    var turn = 0.0;
    if (d.pointerCount >= 2) {
      if (!_rotating && d.rotation.abs() > _rotateThreshold) {
        _rotating = true;
        _rotOffset = d.rotation;
      }
      if (_rotating) turn = d.rotation - _rotOffset;
    }
    final s0 = _start.getMaxScaleOnAxis();
    final k = (s0 * d.scale).clamp(widget.minScale, widget.maxScale) / s0;
    final f = d.localFocalPoint, f0 = _startFocal;
    final m = Matrix4.identity()
      ..translateByDouble(f.dx, f.dy, 0, 1)
      ..rotateZ(turn)
      ..scaleByDouble(k, k, 1, 1)
      ..translateByDouble(-f0.dx, -f0.dy, 0, 1)
      ..multiply(_start);
    _c.value = widget.constrain(m);
  }

  void _onEnd(ScaleEndDetails d) {
    _count = 0;
    final m = _c.value;
    final angle = viewAngle(m);
    if (angle != 0 && angle.abs() < _snapWithin) {
      _animateTo(m, _withAngle(m, 0), 200);
      return;
    }
    final v = d.velocity.pixelsPerSecond;
    if (d.pointerCount == 0 && v.distance > 250) {
      final to = m.clone()
        ..storage[12] += v.dx * 0.2
        ..storage[13] += v.dy * 0.2;
      _animateTo(m, widget.constrain(to), 480, curve: Curves.easeOutCubic);
    }
  }

  /// The same view turned to [angle] about the middle of the screen.
  Matrix4 _withAngle(Matrix4 m, double angle) {
    final size = context.size ?? Size.zero;
    final mid = Offset(size.width / 2, size.height / 2);
    return widget.constrain(composeView(scale: m.getMaxScaleOnAxis(), angle: angle, content: viewToContent(m, mid), screen: mid));
  }

  // One listener for every glide (fling, snap to north), reading the move that is currently set up.
  double _s0 = 1, _s1 = 1, _a0 = 0, _da = 0;
  Offset _t0 = Offset.zero, _t1 = Offset.zero;
  Curve _curve = Curves.easeInOut;

  void _tick() {
    final t = _curve.transform(_anim.value);
    final p = Offset.lerp(_t0, _t1, t)!;
    _c.value = Matrix4.identity()
      ..translateByDouble(p.dx, p.dy, 0, 1)
      ..rotateZ(_a0 + _da * t)
      ..scaleByDouble(_s0 + (_s1 - _s0) * t, _s0 + (_s1 - _s0) * t, 1, 1);
  }

  void _animateTo(Matrix4 from, Matrix4 to, int ms, {Curve curve = Curves.easeInOut}) {
    _s0 = from.getMaxScaleOnAxis();
    _s1 = to.getMaxScaleOnAxis();
    _a0 = viewAngle(from);
    _da = angleDelta(_a0, viewAngle(to));
    _t0 = Offset(from.storage[12], from.storage[13]);
    _t1 = Offset(to.storage[12], to.storage[13]);
    _curve = curve;
    _anim.duration = Duration(milliseconds: ms);
    _anim.forward(from: 0);
  }

  void _onSignal(PointerSignalEvent e) {
    if (e is! PointerScrollEvent) return;
    GestureBinding.instance.pointerSignalResolver.register(e, (event) {
      final ev = event as PointerScrollEvent;
      final m = _c.value;
      final s0 = m.getMaxScaleOnAxis();
      final s1 = (s0 * math.exp(-ev.scrollDelta.dy / 240)).clamp(widget.minScale, widget.maxScale);
      final f = ev.localPosition;
      _c.value = widget.constrain(composeView(scale: s1, angle: viewAngle(m), content: viewToContent(m, f), screen: f));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerSignal: _onSignal,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onScaleStart: _onStart,
        onScaleUpdate: _onUpdate,
        onScaleEnd: _onEnd,
        child: ClipRect(
          child: OverflowBox(
            alignment: Alignment.topLeft,
            minWidth: 0,
            maxWidth: double.infinity,
            minHeight: 0,
            maxHeight: double.infinity,
            child: AnimatedBuilder(
              animation: _c,
              child: widget.child,
              builder: (_, child) => Transform(transform: _c.value, child: child),
            ),
          ),
        ),
      ),
    );
  }
}
