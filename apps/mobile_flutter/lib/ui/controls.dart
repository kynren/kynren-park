import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'tap.dart';

/// A rounded, softly shadowed surface.
class KCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  const KCard({super.key, required this.child, this.onTap, this.padding, this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final box = Container(
      padding: padding,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: color ?? c.card,
        borderRadius: BorderRadius.circular(Tokens.radiusCard),
        border: Border.all(color: c.line.withValues(alpha: context.isDark ? 0.8 : 0.6)),
        boxShadow: softShadow(context.isDark),
      ),
      child: child,
    );
    return onTap == null ? box : Tap(onTap: onTap, scaleTo: 1.02, child: box);
  }
}

/// A filter chip: solid when chosen, a pale tint of the primary when not.
class KChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback? onTap;
  const KChip(this.label, {super.key, this.active = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Tap(
      onTap: onTap,
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 18),
        decoration: BoxDecoration(color: active ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : c.link)),
      ),
    );
  }
}

/// "Theme Park Services … See All": a bold serif title with a quiet action on the right.
class SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final Widget? trailing;
  const SectionHeader(this.title, {super.key, this.action, this.onAction, this.trailing});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(title, style: TextStyle(fontFamily: Tokens.display, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: c.text)),
            ),
          ),
          ?trailing,
          if (action != null) ...[
            const SizedBox(width: 14),
            Tap(onTap: onAction, child: Text(action!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.sub))),
          ],
        ],
      ),
    );
  }
}

enum ButtonVariant { solid, soft }

/// The app's one button: a solid pill for the main action, a soft tinted pill for the one beside it.
class KButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool small, full, loading;
  final ButtonVariant variant;
  const KButton(
    this.label, {
    super.key,
    required this.onPressed,
    this.icon,
    this.small = false,
    this.full = false,
    this.loading = false,
    this.variant = ButtonVariant.solid,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final solid = variant == ButtonVariant.solid;
    final ink = solid ? Colors.white : c.link;
    final disabled = onPressed == null;
    final button = Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Container(
        padding: EdgeInsets.symmetric(vertical: small ? 9 : 14, horizontal: small ? 18 : 26),
        decoration: BoxDecoration(color: solid ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: full ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
            else ...[
              if (icon != null) ...[Icon(icon, color: ink, size: small ? 16 : 19), const SizedBox(width: 8)],
              Text(label, style: TextStyle(color: ink, fontSize: small ? 13 : 15.5, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
            ],
          ],
        ),
      ),
    );
    return Tap(onTap: loading ? null : onPressed, label: label, child: button);
  }
}

/// The floating search field. With [onTap] it is a button that opens search (Home); otherwise it is the field itself.
class SearchPill extends StatelessWidget {
  final String placeholder;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final VoidCallback? onFilter;
  final IconData filterIcon;
  final String filterLabel;
  final bool autofocus;
  const SearchPill({
    super.key,
    required this.placeholder,
    this.controller,
    this.onChanged,
    this.onTap,
    this.onFilter,
    this.filterIcon = Icons.tune_rounded,
    this.filterLabel = 'Filters',
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final pill = Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(999), boxShadow: softShadow(context.isDark)),
      child: Row(
        children: [
          Icon(Icons.search_rounded, color: c.sub, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: onTap != null
                ? Text(placeholder, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, color: c.placeholder))
                : TextField(
                    controller: controller,
                    onChanged: onChanged,
                    autofocus: autofocus,
                    textInputAction: TextInputAction.search,
                    autocorrect: false,
                    style: TextStyle(fontSize: 15, color: c.text),
                    decoration: InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      hintText: placeholder,
                      hintStyle: TextStyle(color: c.placeholder),
                    ),
                  ),
          ),
          if (onFilter != null) ...[
            const SizedBox(width: 12),
            Tap(onTap: onFilter, label: filterLabel, child: Icon(filterIcon, color: c.sub, size: 22)),
          ],
        ],
      ),
    );
    return onTap != null ? Tap(onTap: onTap, label: placeholder, child: pill) : pill;
  }
}

/// A labelled text field; [trailing] sits inside the right edge (a Show/Hide toggle).
class KTextField extends StatelessWidget {
  final String? label, hint;
  final TextEditingController? controller;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextCapitalization capitalization;
  final Widget? trailing;
  final ValueChanged<String>? onChanged;
  const KTextField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.obscure = false,
    this.keyboardType,
    this.capitalization = TextCapitalization.none,
    this.trailing,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    OutlineInputBorder border() => OutlineInputBorder(
          borderRadius: BorderRadius.circular(Tokens.radiusField),
          borderSide: BorderSide(color: c.line),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(label!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.sub))),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textCapitalization: capitalization,
          onChanged: onChanged,
          style: TextStyle(fontSize: 15.5, color: c.text),
          decoration: InputDecoration(
            filled: true,
            fillColor: c.card,
            hintText: hint,
            hintStyle: TextStyle(color: c.placeholder),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            enabledBorder: border(),
            focusedBorder: border().copyWith(borderSide: BorderSide(color: c.primary, width: 1.5)),
            suffixIcon: trailing == null ? null : Padding(padding: const EdgeInsets.only(right: 14), child: Center(widthFactor: 1, child: trailing)),
          ),
        ),
      ],
    );
  }
}
