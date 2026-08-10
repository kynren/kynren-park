import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Image, TextInput, Keyboard, ScrollView, Dimensions, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Circle, Ellipse, Path, G, Polygon, Polyline, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useLocation } from '../../lib/location';
import { useSync } from '../../lib/sync';
import { fmtTime } from '../../lib/format';
import { theme } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';
import { Touchable } from '../../components/Touchable';
import { selection } from '../../lib/haptics';

// Authoring coordinate system for the illustrated basemap (a viewBox). The SVG
// is stretched to exactly fill the measured screen, and pins are projected into
// screen space, so the initial view is always the whole park, edge-to-edge.
const VBW = 420;
const VBH = 680;
// Fixed geographic bounds of the park — the SAME box the admin map editor uses
// to place hotspots, so a pin placed in admin lands on the exact same map spot
// here (both map these bounds onto the base-map image rectangle).
const PARK_BOUNDS = { minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674 };
const GRASS = '#a9c97f';
const FAVS_KEY = 'kynren_favorites';

type Cat = 'favorites' | 'shows' | 'restaurants' | 'facilities';
const PILLS: { key: Cat; label: string; emoji: string }[] = [
  { key: 'favorites', label: 'Favourites', emoji: '♡' },
  { key: 'shows', label: 'Shows', emoji: '🎭' },
  { key: 'restaurants', label: 'Restaurants', emoji: '🍴' },
  { key: 'facilities', label: 'Facilities', emoji: '🚻' },
];

// Facility POI types shown under the "Facilities" filter, with default markers.
const FACILITY_TYPES: Record<string, { emoji: string; color: string }> = {
  RESTROOM: { emoji: '🚻', color: '#3a86c8' },
  FIRST_AID: { emoji: '⛑️', color: '#e5544b' },
  SHOP: { emoji: '🛍️', color: '#8b6ff0' },
  PARKING: { emoji: '🅿️', color: '#6b6460' },
  ACCESSIBILITY: { emoji: '♿', color: '#3a86c8' },
  BABY_CHANGING: { emoji: '🍼', color: '#e2a53b' },
  PICNIC: { emoji: '🧺', color: '#2e8b57' },
  ENTRANCE: { emoji: '🚪', color: '#22b365' },
  INFO: { emoji: 'ℹ️', color: '#6d5df6' },
};

interface Pin {
  id: string;
  attractionId?: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  slug?: string;
  color?: string;
  image?: string | null;
  kind: 'show' | 'evening' | 'restaurant' | 'facility';
  number?: number;
  emoji?: string;
  title: string;
  subtitle?: string;
  nextTime?: string;
  zone?: string | null;
}

// A rendered map marker: either one/many loose pins (a count bubble) or a whole
// area grouped by its mapZone (a labelled bubble that opens up on zoom).
interface Cluster { x: number; y: number; pins: Pin[]; zone?: string; r?: number }

// Great-circle distance so proximity reflects real metres, not map pixels.
function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const walkMins = (m: number) => Math.max(1, Math.round(m / 80)); // ~80 m/min stroll

type Geo = { lat: number; lng: number };
// A k-nearest-neighbour graph over the POIs, so a route hops between real park
// spots (following the walkable network) rather than cutting a straight line.
function buildPoiGraph(nodes: Geo[], k = 3): number[][] {
  const adj: number[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    const near = nodes
      .map((_, j) => j)
      .filter((j) => j !== i)
      .sort((a, b) => distMeters(nodes[i], nodes[a]) - distMeters(nodes[i], nodes[b]))
      .slice(0, k);
    for (const j of near) {
      if (!adj[i].includes(j)) adj[i].push(j);
      if (!adj[j].includes(i)) adj[j].push(i); // keep it walkable both ways
    }
  }
  return adj;
}
function nearestNode(nodes: Geo[], p: Geo): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) { const d = distMeters(nodes[i], p); if (d < bd) { bd = d; best = i; } }
  return best;
}
function dijkstra(adj: number[][], nodes: Geo[], start: number, goal: number): number[] | null {
  const n = nodes.length;
  const dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), seen = Array(n).fill(false);
  dist[start] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1, ud = Infinity;
    for (let i = 0; i < n; i++) if (!seen[i] && dist[i] < ud) { ud = dist[i]; u = i; }
    if (u === -1 || u === goal) break;
    seen[u] = true;
    for (const v of adj[u]) { const w = distMeters(nodes[u], nodes[v]); if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } }
  }
  if (dist[goal] === Infinity) return null;
  const path: number[] = [];
  for (let c = goal; c !== -1; c = prev[c]) path.unshift(c);
  return path[0] === start ? path : null;
}

const MIN_SCALE = 1;
const MAX_SCALE = 12; // absolute ceiling; the effective max comes from the admin map config
// Render the base map at this multiple of the viewport so it decodes at full
// source resolution and stays sharp when zoomed in (capped by the image itself).
const BASE_OVERSAMPLE = 3;
const HALF_MILE_M = 804.672; // only show the location beacon within this distance of the park
const AREA_OPEN_PX = 90; // an area stays grouped until its pins span more than this on screen
// Markers live inside the zoomed canvas but are counter-scaled so they keep a
// constant screen size (their anchor point still tracks the map).
const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

// Clamp one axis of the pan so the map never leaves the viewport: when the map
// is larger than the viewport on this axis you can pan to its edges (no
// overscroll); when it's smaller it stays centred. Runs on both threads.
function clampAxis(pan: number, s: number, rectStart: number, rectLen: number, vp: number): number {
  'worklet';
  const startScreen0 = vp / 2 + (rectStart - vp / 2) * s; // screen pos of the rect's start at pan=0
  const contentLen = rectLen * s;
  if (contentLen >= vp) {
    const hi = -startScreen0;                    // pan so the start edge reaches the viewport edge
    const lo = vp - contentLen - startScreen0;   // pan so the end edge reaches the other viewport edge
    return Math.max(lo, Math.min(hi, pan));
  }
  return (vp - contentLen) / 2 - startScreen0;   // smaller than viewport → keep centred
}

export default function MapScreen() {
  const { bundle, date } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useThemePref().scheme === 'dark';
  const cpal = dark
    ? { card: '#1f1f24', ink: '#ffffff', muted: '#a5a5ad' }
    : { card: '#ffffff', ink: theme.ink, muted: theme.muted };
  const params = useLocalSearchParams<{ focus?: string; spot?: string }>();
  // Multiple categories can be active at once; defaults to Shows on first load.
  const [cats, setCats] = useState<Set<Cat>>(() => new Set<Cat>(['shows']));
  const [selected, setSelected] = useState<Pin | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // the search bar shows only when the search icon is tapped
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [pendingSpot, setPendingSpot] = useState<string | null>(null);
  // "Find on Map" isolation: when set, only this pin is shown (others hidden)
  // until the guest taps "Show all pins" — like the Disney app's Find on Map.
  const [soloId, setSoloId] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const appliedFocus = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce the background-tap dismiss so a double-tap doesn't close the popup
  const [favs, setFavs] = useState<Set<string>>(new Set());
  // Location is acquired app-wide at boot (during the splash), so the beacon is
  // ready the moment the map opens — see LocationProvider.
  const { gps } = useLocation();
  // Seed from the real window size so the map fills the screen from the first
  // frame (never leaving a green margin before onLayout measures precisely).
  const [vp, setVp] = useState(() => { const d = Dimensions.get('window'); return { w: d.width, h: d.height }; });
  const pulse = useRef(new Animated.Value(0)).current;

  // Pan/zoom live on the UI thread as reanimated shared values → native-smooth.
  const scale = useSharedValue(2);
  const maxScaleSV = useSharedValue(8); // effective max zoom (from admin map config), read by the pinch worklet
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const vpw = useSharedValue(375);
  const vph = useSharedValue(680);
  // The map rectangle (cover fit) mirrored onto the UI thread for pan clamping.
  const fitX = useSharedValue(0);
  const fitY = useSharedValue(0);
  const fitW = useSharedValue(375);
  const fitH = useSharedValue(680);
  // Selected marker position (canvas coords) → used to anchor its popup so the
  // popup sticks to the marker and moves with it as the guest pans/zooms.
  const selX = useSharedValue(0);
  const selY = useSharedValue(0);

  const win = Dimensions.get('window');
  const vw = vp.w || win.width;
  const vh = vp.h || win.height;
  const markerColor = bundle?.mapConfig?.markerColor ?? '#1a73e8';
  const mapImageUrl = bundle?.defaultMap?.imageUrl || bundle?.mapConfig?.mapImageUrl || null;
  // Fill the screen edges (letterbox around a "contain" image) with the map's
  // own average colour so they blend, instead of a flat mismatched green.
  const mapBg = bundle?.defaultMap?.bgColor || GRASS;
  // Admin-tunable initial view (see App Settings → Map): opening zoom, max zoom, centre.
  const cfg = bundle?.mapConfig;
  const maxScale = Math.min(MAX_SCALE, cfg?.maxZoom ?? 8);

  // Measure the base map's aspect so we can show it whole (no cropping) and land
  // pins on the fitted image rather than the full viewport.
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!mapImageUrl) { setImgAspect(null); return; }
    let ok = true;
    Image.getSize(mapImageUrl, (w, h) => { if (ok && h) setImgAspect(w / h); }, () => { if (ok) setImgAspect(null); });
    return () => { ok = false; };
  }, [mapImageUrl]);

  // The rectangle the map occupies. COVER: the map fills the whole screen
  // (overflowing the longer side); its edges are faded out with a vignette so it
  // blends softly. Pins project into this rect; guests pinch-zoom and pan.
  const fit = useMemo(() => {
    if (!imgAspect) return { w: vw, h: vh, x: 0, y: 0 };
    if (imgAspect > vw / vh) { const w = vh * imgAspect; return { w, h: vh, x: (vw - w) / 2, y: 0 }; }
    const h = vw / imgAspect; return { w: vw, h, x: 0, y: (vh - h) / 2 };
  }, [imgAspect, vw, vh]);
  // Mirror the map rect to the UI thread for the pan-clamp worklet.
  useEffect(() => { fitX.value = fit.x; fitY.value = fit.y; fitW.value = fit.w; fitH.value = fit.h; }, [fit]);

  // Clamp the pan to the map edges (JS-thread version for buttons / deep links).
  function clampPanJS(x: number, y: number, s: number) {
    return { x: clampAxis(x, s, fit.x, fit.w, vw), y: clampAxis(y, s, fit.y, fit.h, vh) };
  }
  // Animate to a scale + pan (used by zoom/recenter/fit and deep links).
  function animateTo(s: number, x: number, y: number, ms = 220) {
    scale.value = withTiming(s, { duration: ms });
    panX.value = withTiming(x, { duration: ms });
    panY.value = withTiming(y, { duration: ms });
  }
  // Zoom to an EXACT target scale while keeping point (x, y) — in canvas
  // coordinates — at its current on-screen position. No clamp, so the point is
  // never nudged toward the centre; used for both pin-focus and pin-anchored
  // zoom-button presses so a selected pin is always the zoom's pivot.
  function zoomKeeping(x: number, y: number, target: number, ms = 220) {
    const cur = scale.value;
    const s = Math.max(MIN_SCALE, Math.min(maxScale, target));
    const px = (vw / 2 + (x - vw / 2) * cur + panX.value) - (vw / 2 + (x - vw / 2) * s);
    const py = (vh / 2 + (y - vh / 2) * cur + panY.value) - (vh / 2 + (y - vh / 2) * s);
    animateTo(s, px, py, ms);
  }
  // Zoom toward a pin WITHOUT recentring the map: keep the pin at its current
  // on-screen position while zooming to AT LEAST `target` (never zooms out), and
  // attach the popup right away (no frame lag) so the bubble stays glued to it.
  function focusPin(pin: { x: number; y: number }, target: number) {
    selX.value = pin.x; selY.value = pin.y;
    zoomKeeping(pin.x, pin.y, Math.max(scale.value, target));
  }

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    AsyncStorage.getItem(FAVS_KEY).then((raw) => raw && setFavs(new Set(JSON.parse(raw))));
  }, []);

  function toggleFav(attractionId: string) {
    setFavs((prev) => {
      const next = new Set(prev);
      next.has(attractionId) ? next.delete(attractionId) : next.add(attractionId);
      AsyncStorage.setItem(FAVS_KEY, JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  }

  // Native pinch + pan (UI thread). One finger pans; two fingers pinch-zoom
  // with the focal point anchored, which also gives natural two-finger panning.
  const gesture = useMemo(() => {
    const clamp = (x: number, y: number, s: number) => {
      'worklet';
      // No overscroll: bounded by the map edges. Works even at base zoom, so a
      // map wider than the screen can be swiped across.
      return {
        x: clampAxis(x, s, fitX.value, fitW.value, vpw.value || 375),
        y: clampAxis(y, s, fitY.value, fitH.value, vph.value || 680),
      };
    };
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => { startX.value = panX.value; startY.value = panY.value; })
      .onUpdate((e) => {
        const c = clamp(startX.value + e.translationX, startY.value + e.translationY, scale.value);
        panX.value = c.x; panY.value = c.y;
      });
    const pinch = Gesture.Pinch()
      .onStart(() => { startScale.value = scale.value; })
      .onUpdate((e) => {
        const target = Math.max(MIN_SCALE, Math.min(maxScaleSV.value, startScale.value * e.scale));
        const r = target / scale.value;
        const cx = (vpw.value || 375) / 2, cy = (vph.value || 680) / 2;
        const nx = e.focalX - cx - (e.focalX - cx - panX.value) * r;
        const ny = e.focalY - cy - (e.focalY - cy - panY.value) * r;
        scale.value = target;
        const c = clamp(nx, ny, target);
        panX.value = c.x; panY.value = c.y;
      });
    // Double-tap to zoom in, centred on the tapped point.
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(320)
      .onEnd((e) => {
        'worklet';
        const cur = scale.value;
        const target = Math.min(maxScaleSV.value, cur * 1.8);
        if (target <= cur + 0.001) return;
        const r = target / cur;
        const cx = (vpw.value || 375) / 2, cy = (vph.value || 680) / 2;
        const nx = e.x - cx - (e.x - cx - panX.value) * r;
        const ny = e.y - cy - (e.y - cy - panY.value) * r;
        const c = clamp(nx, ny, target);
        scale.value = withTiming(target, { duration: 180 });
        panX.value = withTiming(c.x, { duration: 180 });
        panY.value = withTiming(c.y, { duration: 180 });
      });
    return Gesture.Simultaneous(pan, pinch, doubleTap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));
  // Counter-scale for markers so they stay the same size regardless of zoom
  // (each marker sets its transformOrigin to its own anchor point).
  const invScale = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.value }] }));
  // The popup is rendered INSIDE the map canvas, anchored to the selected pin's
  // own coordinates and counter-scaled like a marker (see popupWrapStyle below),
  // so it's physically a sibling of the pin and can never drift away from it —
  // it inherits the canvas's pan/zoom transform the same native way pins do.
  // Combines the counter-scale with a small horizontal nudge (real screen
  // pixels, applied AFTER the scale in the transform list) so the card doesn't
  // run off a side edge near the screen border. The nudge nudges the whole
  // wrapper (pin anchor included), which is an acceptable trade-off only in
  // that rare near-edge case — the pin itself never moves, only the popup.
  const popupWrapStyle = useAnimatedStyle(() => {
    const w = vpw.value || 375;
    const s = scale.value;
    const sx = w / 2 + (selX.value - w / 2) * s + panX.value; // pin's live screen X
    const half = 128, margin = 10;
    let shift = 0;
    if (sx - half < margin) shift = margin - (sx - half);
    else if (sx + half > w - margin) shift = (w - margin) - (sx + half);
    return { transform: [{ scale: 1 / s }, { translateX: shift }] };
  });
  // Popup entrance animation (admin-tunable: none | fade | scale | slide | bounce).
  const popupAnim = cfg?.popupAnimation ?? 'scale';
  const popupIn = useSharedValue(0);
  useEffect(() => {
    if (selected) popupIn.value = popupAnim === 'bounce' ? withSpring(1, { damping: 9, stiffness: 190 }) : withTiming(1, { duration: 200 });
    else popupIn.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, popupAnim]);
  const popupAnimStyle = useAnimatedStyle(() => {
    const t = popupIn.value;
    if (popupAnim === 'none') return {};
    if (popupAnim === 'fade') return { opacity: t };
    if (popupAnim === 'slide') return { opacity: Math.min(1, t * 1.5), transform: [{ translateY: (1 - t) * 20 }] };
    return { opacity: Math.min(1, t * 1.6), transform: [{ scale: t }] }; // scale / bounce
  }, [popupAnim]);
  // When the selected pin is near the top (no room for the popup above it, e.g.
  // at the initial zoom where the map can't pan down), flip the popup below the
  // pin so its content is always visible.
  const [flipDown, setFlipDown] = useState(false);
  useAnimatedReaction(
    () => {
      const h = vph.value || 680;
      const sy = h / 2 + (selY.value - h / 2) * scale.value + panY.value; // pin's screen Y
      return sy < 210; // not enough room above → flip below
    },
    (need, prev) => { if (need !== prev) runOnJS(setFlipDown)(need); },
  );

  // Mirror the live zoom into React state (in coarse 0.25 steps) so pins can be
  // clustered as the guest zooms — recomputes only a handful of times, not every
  // frame. Pins that overlap merge into a count bubble; zooming in splits them.
  const [zoom, setZoom] = useState(1);
  useAnimatedReaction(
    () => Math.round(scale.value * 4) / 4,
    (cur, prev) => { if (cur !== prev) runOnJS(setZoom)(cur); },
  );

  const pois = bundle?.pois ?? [];

  // Project a lat/lng onto the base-map image rectangle using the fixed park
  // bounds — the exact same mapping the admin map editor uses — so every hotspot
  // sits on the same map spot where it was placed.
  const project = useMemo(() => {
    const b = PARK_BOUNDS;
    const toXY = (lat: number, lng: number) => ({
      x: fit.x + ((lng - b.minLng) / (b.maxLng - b.minLng)) * fit.w,
      y: fit.y + ((b.maxLat - lat) / (b.maxLat - b.minLat)) * fit.h,
    });
    const inBounds = (lat: number, lng: number) =>
      lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
    return { toXY, inBounds };
  }, [fit]);

  // Keep the pinch worklet's max zoom in sync with the admin config.
  useEffect(() => { maxScaleSV.value = maxScale; }, [maxScale]);
  // Apply the admin's initial zoom + centre once, after the map has measured its aspect.
  const appliedInitial = useRef(false);
  useEffect(() => {
    if (appliedInitial.current || !cfg || vw === 0 || !imgAspect) return;
    // A deep link (view on map / scanned spot) owns the opening view — mark the
    // initial view as applied but DON'T move, so it never overrides the focus
    // once the map's aspect resolves (the cause of the pin "snapping to centre").
    if (params.focus || params.spot) { appliedInitial.current = true; return; }
    appliedInitial.current = true;
    const z = Math.max(MIN_SCALE, Math.min(maxScale, cfg.initialZoom ?? 2));
    let px = 0, py = 0;
    if (cfg.centerLat != null && cfg.centerLng != null) {
      const p = project.toXY(cfg.centerLat, cfg.centerLng);
      px = (vw / 2 - p.x) * z; py = (vh / 2 - p.y) * z;
    }
    const c = clampPanJS(px, py, z);
    scale.value = z; panX.value = c.x; panY.value = c.y;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, vw, imgAspect]);

  const nextByAttraction = useMemo(() => {
    const m = new Map<string, string>();
    const isRealToday = date === new Date().toISOString().slice(0, 10);
    const ref = isRealToday ? Date.now() : new Date(`${date}T00:00:00.000Z`).getTime();
    for (const s of bundle?.sessions ?? []) {
      if (new Date(s.endTime).getTime() <= ref) continue;
      const t = s.revisedStart ?? s.startTime;
      const cur = m.get(s.attractionId);
      if (!cur || new Date(t) < new Date(cur)) m.set(s.attractionId, t);
    }
    return m;
  }, [bundle, date]);

  const poiById = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);

  const pins = useMemo<Pin[]>(() => {
    if (!project) return [];
    const out: Pin[] = [];
    if (cats.has('restaurants')) {
      for (const r of bundle?.restaurants ?? []) {
        if (!r.poiId) continue;
        const poi = poiById.get(r.poiId);
        if (!poi) continue;
        const { x, y } = project.toXY(poi.lat, poi.lng);
        out.push({ id: r.id, x, y, lat: poi.lat, lng: poi.lng, slug: r.slug, image: poi.image, kind: 'restaurant', emoji: '🍴', title: r.name, subtitle: r.cuisine ?? undefined, zone: poi.mapZone });
      }
    }
    if (cats.has('facilities')) {
      for (const poi of pois) {
        const def = FACILITY_TYPES[poi.type];
        if (!def) continue; // attractions & restaurants have their own filters
        const { x, y } = project.toXY(poi.lat, poi.lng);
        out.push({ id: poi.id, x, y, lat: poi.lat, lng: poi.lng, image: poi.image, kind: 'facility', emoji: poi.icon ?? def.emoji, color: poi.color ?? def.color, title: poi.name, subtitle: poi.type.replace('_', ' ').toLowerCase(), zone: poi.mapZone });
      }
    }
    const showAll = cats.has('shows');
    const showFavs = cats.has('favorites');
    if (showAll || showFavs) {
      const dayAttractions = (bundle?.attractions ?? []).filter((a) => a.category !== 'EVENING_SHOW');
      dayAttractions.forEach((a, i) => {
        if (!a.poiId) return;
        if (!showAll && showFavs && !favs.has(a.id)) return; // favourites-only filter
        const poi = poiById.get(a.poiId);
        if (!poi) return;
        const { x, y } = project.toXY(poi.lat, poi.lng);
        // Prefer the attraction's featured image so the admin's hero image drives the map pin.
        out.push({ id: a.id, attractionId: a.id, x, y, lat: poi.lat, lng: poi.lng, slug: a.slug, image: a.heroImage || poi.image, kind: 'show', number: i + 1, title: a.name, subtitle: a.tagline ?? undefined, nextTime: nextByAttraction.get(a.id), zone: poi.mapZone });
      });
      const evening = (bundle?.attractions ?? []).find((a) => a.category === 'EVENING_SHOW');
      if (evening?.poiId && (showAll || favs.has(evening.id))) {
        const poi = poiById.get(evening.poiId);
        if (poi) {
          const { x, y } = project.toXY(poi.lat, poi.lng);
          out.push({ id: evening.id, attractionId: evening.id, x, y, lat: poi.lat, lng: poi.lng, slug: evening.slug, image: evening.heroImage || poi.image, kind: 'evening', emoji: '🌙', title: evening.name, subtitle: evening.tagline ?? undefined, nextTime: nextByAttraction.get(evening.id), zone: poi.mapZone });
        }
      }
    }
    return out;
  }, [cats, bundle, project, poiById, nextByAttraction, favs, pois]);

  // The selected pin's *current* position (it re-projects when the map changes),
  // mirrored to the UI thread so its popup stays glued to it.
  const selPin = selected ? (pins.find((p) => p.id === selected.id) ?? selected) : null;
  useEffect(() => { if (selPin) { selX.value = selPin.x; selY.value = selPin.y; } }, [selPin?.x, selPin?.y]);

  // Disney-style grouping: hotspots are grouped into their AREA (mapZone) and
  // shown as one labelled area bubble when zoomed out; as the guest zooms into an
  // area (its pins spread past ~AREA_OPEN_PX on screen) it "opens up" into the
  // individual pins. Zone-less pins fall back to proximity count-clusters.
  const clustered = useMemo(() => {
    const base = soloId ? pins.filter((p) => p.id === soloId) : pins;
    const src = selected ? base.filter((p) => p.id !== selected.id) : base;

    // Bucket by area (mapZone); pins without a zone go loose.
    const zones = new Map<string, Pin[]>();
    const loose: Pin[] = [];
    for (const p of src) {
      if (p.zone) { const a = zones.get(p.zone); if (a) a.push(p); else zones.set(p.zone, [p]); }
      else loose.push(p);
    }

    const out: Cluster[] = [];
    for (const [zone, zp] of zones) {
      if (zp.length < 2) { loose.push(...zp); continue; }
      const cx = zp.reduce((s, p) => s + p.x, 0) / zp.length;
      const cy = zp.reduce((s, p) => s + p.y, 0) / zp.length;
      const r = Math.max(...zp.map((p) => Math.hypot(p.x - cx, p.y - cy))); // map-space radius
      if (r * zoom <= AREA_OPEN_PX) out.push({ x: cx, y: cy, pins: zp, zone, r }); // closed → area bubble
      else loose.push(...zp); // opened → individual pins below
    }

    // Proximity-cluster the loose pins so overlapping markers still merge.
    const thr = 44 / Math.max(zoom, 0.001), thr2 = thr * thr;
    for (const p of loose) {
      let placed = false;
      for (const c of out) {
        if (c.zone) continue; // never merge into a labelled area
        const dx = c.x - p.x, dy = c.y - p.y;
        if (dx * dx + dy * dy <= thr2) {
          c.pins.push(p);
          c.x += (p.x - c.x) / c.pins.length;
          c.y += (p.y - c.y) / c.pins.length;
          placed = true; break;
        }
      }
      if (!placed) out.push({ x: p.x, y: p.y, pins: [p] });
    }
    return out;
  }, [pins, zoom, selected, soloId]);

  // Tapping a cluster/area zooms in and centres on it, so its pins spread apart
  // (an area zooms enough to open into its individual pins).
  function zoomToCluster(c: Cluster) {
    selection();
    const need = c.r ? (AREA_OPEN_PX / c.r) * 1.15 : 0; // zoom needed to open an area
    const s = Math.min(maxScale, Math.max(zoom * 1.9, 2.4, need));
    const cc = clampPanJS((vw / 2 - c.x) * s, (vh / 2 - c.y) * s, s);
    animateTo(s, cc.x, cc.y);
  }

  // A single map pin (its look depends on the kind). Used for standalone pins
  // and for the currently-selected pin (kept out of clusters so it's visible).
  // A single map pin — a clean white teardrop with a dark/tinted icon (Disney
  // style). The category shows as the pin's ring + tail colour; a hero image, if
  // set, fills the pin. Show/evening pins carry a "next time" pill.
  function renderPin(pin: Pin) {
    const isSel = selected?.id === pin.id;
    const tint = pin.kind === 'evening' ? '#2c3e70'
      : pin.kind === 'restaurant' ? '#f5601e'
        : pin.kind === 'facility' ? (pin.color ?? '#6b6460')
          : theme.brand;
    const glyph = pin.kind === 'evening' ? '🌙' : pin.kind === 'restaurant' ? '🍴' : pin.kind === 'facility' ? (pin.emoji ?? '•') : null;
    const wrap = [styles.pinWrap, { left: pin.x, top: pin.y }, isSel && { zIndex: 20 }, invScale];
    return (
      <AnimatedPressable key={pin.id} style={wrap} onPress={() => { selection(); selX.value = pin.x; selY.value = pin.y; setSelected(pin); }}>
        <View style={[styles.pinHead, { borderColor: tint }, isSel && styles.pinSel]}>
          {pin.image
            ? <Image source={{ uri: pin.image }} style={styles.pinImg} />
            : glyph
              ? <Text style={styles.pinEmoji}>{glyph}</Text>
              : <Text style={[styles.pinNum, { color: tint }]}>{pin.number}</Text>}
        </View>
        <View style={[styles.pinTail, { borderTopColor: tint }]} />
        {pin.nextTime && (pin.kind === 'show' || pin.kind === 'evening') && (
          <View style={styles.pinTime}><Text style={styles.pinTimeTxt} numberOfLines={1}>{fmtTime(pin.nextTime)}</Text></View>
        )}
      </AnimatedPressable>
    );
  }

  // Searchable index of everything on the map.
  const searchIndex = useMemo(() => {
    const out: { id: string; name: string; kind: Cat; sub: string }[] = [];
    for (const a of bundle?.attractions ?? []) out.push({ id: a.id, name: a.name, kind: 'shows', sub: a.category === 'EVENING_SHOW' ? 'Evening show' : 'Show' });
    for (const r of bundle?.restaurants ?? []) out.push({ id: r.id, name: r.name, kind: 'restaurants', sub: r.cuisine ?? 'Restaurant' });
    for (const p of pois) if (FACILITY_TYPES[p.type]) out.push({ id: p.id, name: p.name, kind: 'facilities', sub: p.type.replace('_', ' ').toLowerCase() });
    return out;
  }, [bundle, pois]);
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search, searchIndex]);

  function goToResult(r: { id: string; kind: Cat }) {
    setCats((p) => new Set(p).add(r.kind));
    setPendingSelect(r.id);
    setSearch('');
    setSearchOpen(false);
    Keyboard.dismiss();
  }
  // Once the pins for the chosen layer are ready, select & centre the result.
  useEffect(() => {
    if (!pendingSelect || vw === 0) return;
    if (mapImageUrl && imgAspect == null) return; // wait until the projection is final
    const pin = pins.find((p) => p.id === pendingSelect);
    if (!pin) return;
    // Zoom INTO the pin's exact spot (the pin is the zoom pivot, so it never
    // moves and is not pushed to centre) and open its popup.
    selection();
    setSelected(pin);
    focusPin(pin, 3.4);
    setPendingSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelect, pins, vw, vh, imgAspect, mapImageUrl]);

  // Hide the "tap to explore" hint once the guest opens a place.
  useEffect(() => { if (selected) setHintDismissed(true); }, [selected]);

  // A scanned QR (kynren://spot/<type>/<id>) → switch to the right layer, then
  // open that spot's popup and centre on it (distance shows automatically).
  useEffect(() => {
    if (!params.spot || !bundle) return;
    const [type, id] = String(params.spot).split(':');
    // A shop code carries the shop id; resolve it to its map POI so we can centre.
    const targetId = type === 'shop' ? (bundle.shops?.find((s) => s.id === id)?.poiId ?? id) : id;
    setCats(new Set<Cat>([type === 'restaurant' ? 'restaurants' : (type === 'poi' || type === 'shop') ? 'facilities' : 'shows']));
    setPendingSpot(targetId);
    setBannerDismissed(false);
  }, [params.spot, bundle]);
  useEffect(() => {
    if (!pendingSpot || vw === 0) return;
    if (mapImageUrl && imgAspect == null) return; // wait until the projection is final
    const pin = pins.find((p) => p.id === pendingSpot || p.attractionId === pendingSpot);
    if (!pin) return;
    selection();
    setSelected(pin);
    focusPin(pin, 3.4);
    setPendingSpot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSpot, pins, vw, vh, imgAspect, mapImageUrl]);

  const entrance = pois.find((p) => p.type === 'ENTRANCE');
  const locationReal = !!(gps && project && project.inBounds(gps.lat, gps.lng));
  // Centre of the park, used to decide whether the guest is actually near it.
  const parkCenter = useMemo(() => {
    if (pois.length === 0) return null;
    return {
      lat: pois.reduce((s, p) => s + p.lat, 0) / pois.length,
      lng: pois.reduce((s, p) => s + p.lng, 0) / pois.length,
    };
  }, [pois]);
  const distToPark = useMemo(
    () => (gps && parkCenter ? distMeters(gps, parkCenter) : null),
    [gps, parkCenter],
  );
  // Only show the "you are here" beacon when we can't tell (no GPS yet) or the
  // guest is genuinely near the park — never plant a dot when they're miles away.
  // Only show the beacon when we have a real GPS fix within half a mile of the
  // park — never when far away or when there's no location fix at all.
  const showMe = distToPark != null && distToPark <= HALF_MILE_M;
  const youAreHere = useMemo(() => {
    if (!project) return { x: vw / 2, y: vh * 0.7 };
    if (locationReal && gps) return project.toXY(gps.lat, gps.lng);
    if (entrance) return project.toXY(entrance.lat, entrance.lng);
    return { x: vw / 2, y: vh * 0.7 };
  }, [gps, project, entrance, vw, vh, locationReal]);

  // Deep link from "Go to" / "Find on Map": focus a place, open its callout, centre on it.
  useEffect(() => {
    if (!params.focus) return;
    const isRestaurant = (bundle?.restaurants ?? []).some((r) => r.id === params.focus);
    const isFacility = pois.some((p) => p.id === params.focus && FACILITY_TYPES[p.type]);
    setCats(new Set<Cat>([isRestaurant ? 'restaurants' : isFacility ? 'facilities' : 'shows']));
    appliedFocus.current = null;
    setBannerDismissed(false);
  }, [params.focus, bundle, pois]);
  useEffect(() => {
    if (!params.focus || appliedFocus.current === params.focus || vw === 0) return;
    if (mapImageUrl && imgAspect == null) return; // wait until the projection is final
    const pin = pins.find((p) => p.id === params.focus);
    if (!pin) return;
    appliedFocus.current = params.focus;
    // Zoom into the place's exact spot (pin is the pivot, never pushed to
    // centre) and open its popup.
    selection();
    setSelected(pin);
    focusPin(pin, 3.4);
  }, [params.focus, pins, vw, vh, imgAspect, mapImageUrl]);

  // Walkable POI graph (built once from the POIs).
  const routeNodes = useMemo<Geo[]>(() => pois.map((p) => ({ lat: p.lat, lng: p.lng })), [pois]);
  const poiAdj = useMemo(() => buildPoiGraph(routeNodes, 3), [routeNodes]);

  // A path-following route from the guest to the selected place: user → nearest
  // spot → … → destination, drawn as a polyline (not a straight line).
  const route = useMemo(() => {
    if (!selected || selected.lat == null || !project || !locationReal || !gps || routeNodes.length < 2) return null;
    const target: Geo = { lat: selected.lat, lng: selected.lng! };
    const s = nearestNode(routeNodes, gps), g = nearestNode(routeNodes, target);
    if (s < 0 || g < 0) return null;
    const nodePath = s === g ? [g] : dijkstra(poiAdj, routeNodes, s, g);
    if (!nodePath) return null;
    const points = [youAreHere, ...nodePath.map((i) => project.toXY(routeNodes[i].lat, routeNodes[i].lng))];
    const last = points[points.length - 1];
    if (Math.hypot(last.x - selected.x, last.y - selected.y) > 2) points.push({ x: selected.x, y: selected.y });
    let meters = distMeters(gps, routeNodes[s]);
    for (let i = 0; i < nodePath.length - 1; i++) meters += distMeters(routeNodes[nodePath[i]], routeNodes[nodePath[i + 1]]);
    meters += distMeters(routeNodes[g], target);
    return { points, meters };
  }, [selected, gps, locationReal, project, routeNodes, poiAdj, youAreHere]);

  // Distance from the guest to the selected place — the walked path length.
  const selectedDist = route?.meters ?? null;

  function zoomTo(next: number) {
    const s = Math.max(MIN_SCALE, Math.min(maxScale, +next.toFixed(2)));
    // With a place selected, the +/- buttons zoom around ITS spot (not the
    // viewport centre) so the pin — and its glued popup — never appears to jump.
    if (selPin) { zoomKeeping(selPin.x, selPin.y, s, 160); return; }
    const c = clampPanJS(panX.value, panY.value, s);
    animateTo(s, c.x, c.y, 160);
  }
  function recenter() {
    const s = 2;
    const c = clampPanJS((vw / 2 - youAreHere.x) * s, (vh / 2 - youAreHere.y) * s, s);
    animateTo(s, c.x, c.y);
  }
  function fitAll() {
    animateTo(1, 0, 0);
  }
  function openDetail() {
    if (!selected) return;
    if (selected.kind === 'restaurant' && selected.slug) { router.push(`/restaurant/${selected.slug}`); return; }
    if ((selected.kind === 'show' || selected.kind === 'evening') && selected.slug) { router.push(`/attraction/${selected.slug}`); return; }
    if (selected.kind === 'facility') {
      // A shop placed on the map opens its shop page; other facilities open the facility page.
      const shop = bundle?.shops?.find((s) => s.poiId === selected.id);
      if (shop) { router.push(`/shop/${shop.slug}`); return; }
      router.push(`/facility/${selected.id}`);
    }
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    vpw.value = width; vph.value = height;
    setVp({ w: width, h: height });
  }

  return (
    <View style={[styles.root, { backgroundColor: mapBg }]} onLayout={onLayout}>
      <View style={[styles.viewport, { backgroundColor: mapBg }]}>
        <GestureDetector gesture={gesture}>
        <Reanimated.View style={[styles.canvas, { width: vw, height: vh }, canvasStyle]}>
          {mapImageUrl ? (
            // Render the base map oversampled (a larger layout box counter-scaled
            // back to viewport size) so React Native decodes it at full source
            // resolution instead of downsampling to the viewport — this keeps the
            // illustrated map crisp as the guest zooms in, rather than blurring.
            <Image
              source={{ uri: mapImageUrl }}
              style={{
                position: 'absolute', top: fit.y, left: fit.x,
                width: fit.w * BASE_OVERSAMPLE, height: fit.h * BASE_OVERSAMPLE,
                transform: [{ scale: 1 / BASE_OVERSAMPLE }], transformOrigin: 'top left',
              }}
              resizeMode="contain"
              fadeDuration={0}
            />
          ) : null /* no placeholder map — the solid mapBg shows until the real map is ready */}

          {/* Tapping the map background (not a pin) dismisses the popup / closes
              search — but a quick second tap (double-tap to zoom) cancels the
              dismiss so an open popup is kept. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; return; } // 2nd tap → keep popup
              dismissTimer.current = setTimeout(() => { dismissTimer.current = null; setSelected(null); setSearchOpen(false); Keyboard.dismiss(); }, 280);
            }}
          />

          {/* Walking route from the guest to the selected place — follows the path
              network through the park (map-style casing over a coloured line). */}
          {selected && route && (
            <Svg style={StyleSheet.absoluteFill} width={vw} height={vh} pointerEvents="none">
              {(() => {
                const pts = route.points.map((p) => `${p.x},${p.y}`).join(' ');
                return (
                  <>
                    <Polyline points={pts} fill="none" stroke="#ffffff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
                    <Polyline points={pts} fill="none" stroke="#2b7fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                  </>
                );
              })()}
            </Svg>
          )}

          {clustered.map((c) => {
            if (c.zone) {
              // A whole area, grouped — a labelled bubble that opens on zoom.
              return (
                <AnimatedPressable key={'z:' + c.zone} style={[styles.areaWrap, { left: c.x, top: c.y }, invScale]} onPress={() => zoomToCluster(c)}>
                  <View style={styles.areaBubble}><Text style={styles.areaCount}>{c.pins.length}</Text></View>
                  <View style={styles.areaLabel}><Text style={styles.areaLabelTxt} numberOfLines={1}>{c.zone}</Text></View>
                </AnimatedPressable>
              );
            }
            if (c.pins.length === 1) return renderPin(c.pins[0]);
            return (
              <AnimatedPressable key={'c:' + c.pins.map((p) => p.id).join(',')} style={[styles.clusterWrap, { left: c.x, top: c.y }, invScale]} onPress={() => zoomToCluster(c)}>
                <View style={styles.cluster}><Text style={styles.clusterTxt}>{c.pins.length}</Text></View>
              </AnimatedPressable>
            );
          })}
          {/* Keep the selected pin drawn on top (it's excluded from clustering).
              Uses selPin (the LIVE re-projected coordinate), not the stale
              `selected` snapshot, so the marker can never drift from the popup
              anchored to the same point below — both always read one source. */}
          {selected && renderPin(selPin ?? selected)}

          {/* Popup — a SIBLING of the pin inside the transformed canvas, anchored
              at the pin's own canvas coordinate and counter-scaled exactly like a
              marker. It inherits the canvas's pan/zoom transform natively, so it
              is physically glued to the pin and can never drift away from it. */}
          {selected && (
            <Reanimated.View
              pointerEvents="box-none"
              style={[{ position: 'absolute', left: selPin?.x ?? selected.x, top: selPin?.y ?? selected.y, width: 0, height: 0 }, styles.calloutWrap, popupWrapStyle]}
            >
              <Reanimated.View style={[flipDown ? styles.calloutFloatDown : styles.calloutFloat, popupAnimStyle]} pointerEvents="box-none">
                {flipDown && <View style={[styles.calloutArrowUp, { borderBottomColor: cpal.card }]} />}
                <Touchable style={[styles.calloutCard, { backgroundColor: cpal.card }]} onPress={openDetail}>
                  {selected.image ? (
                    <Image source={{ uri: selected.image }} style={styles.calloutThumb} />
                  ) : (
                    <View style={[styles.calloutThumb, styles.calloutThumbFallback, selected.kind === 'evening' && { backgroundColor: '#2c3e70' }]}>
                      <Text style={{ fontSize: 26 }}>{selected.emoji ?? '🎭'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.calloutTitle, { color: cpal.ink }]} numberOfLines={2}>{selected.title}</Text>
                    <Text style={[styles.calloutSub, { color: cpal.muted }]} numberOfLines={1}>{selected.subtitle ?? selected.zone ?? 'Kynren — The Storied Lands'}</Text>
                    <Text style={[styles.calloutStatus, { color: cpal.ink }]} numberOfLines={1}>
                      {selectedDist != null
                        ? `${fmtDist(selectedDist)} away · ~${walkMins(selectedDist)} min walk`
                        : selected.nextTime
                          ? `Next show ${fmtTime(selected.nextTime)}`
                          : selected.kind === 'restaurant'
                            ? 'Tap for menu & times'
                            : 'Tap for details'}
                    </Text>
                  </View>
                  <Pressable hitSlop={10} onPress={() => setSelected(null)} style={styles.calloutCloseBtn}>
                    <Text style={[styles.calloutClose, { color: cpal.muted }]}>✕</Text>
                  </Pressable>
                </Touchable>
                {!flipDown && <View style={[styles.calloutArrow, { borderTopColor: cpal.card }]} />}
              </Reanimated.View>
            </Reanimated.View>
          )}

          {/* You are here — glowing location beacon (hidden when far from the park) */}
          {showMe && (
            <Reanimated.View style={[styles.meWrap, { left: youAreHere.x, top: youAreHere.y }, invScale]} pointerEvents="none">
              <View style={[styles.meGlow, { backgroundColor: markerColor }]} />
              <Animated.View
                style={[
                  styles.mePulse,
                  {
                    backgroundColor: markerColor,
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.6] }) }],
                  },
                ]}
              />
              <View style={[styles.meDot, { backgroundColor: markerColor }]} />
            </Reanimated.View>
          )}

        </Reanimated.View>
        </GestureDetector>

        {/* Edge-fade vignette — softly fades the map's edges into the background,
            only at the default view (hidden once the guest zooms in). */}
        {mapImageUrl && vw > 0 && zoom <= (cfg?.initialZoom ?? 2) + 0.001 && (() => {
          const f = Math.round(Math.min(vw, vh) * 0.16);
          return (
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={vw} height={vh}>
              <Defs>
                <SvgGradient id="fadeT" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={mapBg} stopOpacity={1} /><Stop offset="1" stopColor={mapBg} stopOpacity={0} /></SvgGradient>
                <SvgGradient id="fadeB" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={mapBg} stopOpacity={0} /><Stop offset="1" stopColor={mapBg} stopOpacity={1} /></SvgGradient>
                <SvgGradient id="fadeL" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={mapBg} stopOpacity={1} /><Stop offset="1" stopColor={mapBg} stopOpacity={0} /></SvgGradient>
                <SvgGradient id="fadeR" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={mapBg} stopOpacity={0} /><Stop offset="1" stopColor={mapBg} stopOpacity={1} /></SvgGradient>
              </Defs>
              <Rect x={0} y={0} width={vw} height={f} fill="url(#fadeT)" />
              <Rect x={0} y={vh - f} width={vw} height={f} fill="url(#fadeB)" />
              <Rect x={0} y={0} width={f} height={vh} fill="url(#fadeL)" />
              <Rect x={vw - f} y={0} width={f} height={vh} fill="url(#fadeR)" />
            </Svg>
          );
        })()}

        {/* Location banner — the app needs GPS to show your position & distances */}
        {!locationReal && !bannerDismissed && (
          <View style={[styles.geoBanner, { top: insets.top + 62 }]}>
            <Text style={styles.geoIcon}>📱</Text>
            <Text style={styles.geoTxt}>
              {gps ? 'You seem to be outside the park' : 'Turn on location to see where you are and how far things are'}
            </Text>
            <Pressable hitSlop={8} onPress={() => setBannerDismissed(true)}>
              <Text style={styles.geoClose}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Empty favourites hint */}
        {cats.has('favorites') && pins.length === 0 && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>No favourites yet — open a show and tap ♡ to add it here.</Text>
          </View>
        )}

        {/* Search — opens from the 🔍 control below the locate button */}
        {searchOpen && (
        <View style={[styles.searchWrap, { top: insets.top + 8 }]}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              autoFocus
              style={styles.searchInput}
              placeholder="Search the map…"
              placeholderTextColor="#8a8a8a"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            <Touchable onPress={() => { setSearch(''); setSearchOpen(false); Keyboard.dismiss(); }} hitSlop={8}><Text style={styles.searchClear}>✕</Text></Touchable>
          </View>
          {search.trim().length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.length === 0 ? (
                <Text style={styles.searchEmpty}>No matches</Text>
              ) : (
                searchResults.map((r) => (
                  <Touchable key={`${r.kind}:${r.id}`} haptic="selection" style={styles.searchRow} onPress={() => goToResult(r)}>
                    <Text style={styles.searchName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.searchSub}>{r.sub}</Text>
                  </Touchable>
                ))
              )}
            </View>
          )}
        </View>
        )}

        {/* Profile */}
        <Touchable style={[styles.profileBtn, { top: insets.top + 8 }]} onPress={() => router.push('/profile')}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </Touchable>

        {/* Zoom + locate controls */}
        <View style={[styles.ctrlCol, { top: insets.top + 62 }]}>
          <Touchable style={styles.ctrlBtn} onPress={() => zoomTo(scale.value + 0.4)}>
            <Text style={styles.ctrlTxt}>＋</Text>
          </Touchable>
          <Touchable style={styles.ctrlBtn} onPress={() => zoomTo(scale.value - 0.4)}>
            <Text style={styles.ctrlTxt}>－</Text>
          </Touchable>
          <Touchable style={styles.ctrlBtn} onPress={fitAll}>
            <Text style={{ fontSize: 15 }}>🗺️</Text>
          </Touchable>
          <Touchable style={styles.ctrlBtn} onPress={recenter}>
            <Text style={{ fontSize: 17 }}>📍</Text>
          </Touchable>
          <Touchable style={styles.ctrlBtn} onPress={() => { setSelected(null); setSearchOpen(true); }}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
          </Touchable>
        </View>

        {/* Find on Map isolation: a chip to bring every pin back. */}
        {soloId && (
          <View style={[styles.showAllWrap, { top: insets.top + 58 }]} pointerEvents="box-none">
            <Touchable style={styles.showAllChip} onPress={() => { setSoloId(null); setSelected(null); }}>
              <Text style={styles.showAllTxt}>← Show all pins</Text>
            </Touchable>
          </View>
        )}

        {/* "Tap the map to explore" hint, until the guest opens something */}
        {!selected && !soloId && !hintDismissed && (
          <View style={styles.hintWrap} pointerEvents="box-none">
            <Touchable style={styles.hintChip} onPress={() => setHintDismissed(true)}>
              <Text style={styles.hintChipTxt}>TAP THE MAP TO EXPLORE</Text>
            </Touchable>
          </View>
        )}

        {/* Walk-time pill when a destination is selected */}
        {selected && selectedDist != null && (
          <View style={styles.walkPill} pointerEvents="none">
            <Text style={styles.walkPillTxt}>🚶 {walkMins(selectedDist)} min walk</Text>
          </View>
        )}

        {/* Bottom category pills (Puy du Fou style) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pills}
          contentContainerStyle={styles.pillsContent}
        >
          {PILLS.map((p) => {
            const on = cats.has(p.key);
            return (
              <Touchable key={p.key} haptic="selection" style={[styles.pill, on && styles.pillOn]} onPress={() => { setCats((prev) => { const n = new Set(prev); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; }); setSelected(null); setSoloId(null); }}>
                <Text style={[styles.pillEmoji, on && { color: '#fff' }]}>{p.emoji}</Text>
                <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>{p.label}</Text>
              </Touchable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

/** Full-bleed illustrated park basemap, stretched to fill the screen. */
function ParkBasemap({ vw, vh }: { vw: number; vh: number }) {
  return (
    <Svg width={vw} height={vh} viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={VBW} height={VBH} fill={GRASS} />
      <Ellipse cx={100} cy={140} rx={140} ry={100} fill="#9dc073" opacity={0.55} />
      <Ellipse cx={350} cy={470} rx={150} ry={130} fill="#b5d38f" opacity={0.55} />
      <Ellipse cx={70} cy={560} rx={130} ry={110} fill="#9dc073" opacity={0.5} />

      {/* Lake */}
      <Ellipse cx={296} cy={166} rx={104} ry={58} fill="#a9d3e8" />
      <Ellipse cx={296} cy={166} rx={104} ry={58} fill="none" stroke="#8ec3dd" strokeWidth={2.5} />
      <Ellipse cx={276} cy={154} rx={44} ry={20} fill="#bfe0f0" opacity={0.7} />

      {/* River */}
      <Path d="M 360 230 C 330 285, 370 330, 330 385 S 280 470, 330 550 S 372 615, 350 680" stroke="#a9d3e8" strokeWidth={22} fill="none" strokeLinecap="round" />

      {/* Paths */}
      <Path d={`M ${VBW / 2} ${VBH - 4} C ${VBW / 2 - 8} ${VBH - 130}, ${VBW / 2 + 26} ${VBH - 210}, ${VBW / 2} ${VBH - 264} S ${VBW / 2 - 36} 150, ${VBW / 2} 80`} stroke="#e9dfc7" strokeWidth={24} fill="none" strokeLinecap="round" />
      <Path d={`M ${VBW / 2} ${VBH - 264} C 164 ${VBH - 320}, 104 ${VBH - 326}, 66 ${VBH - 364}`} stroke="#e9dfc7" strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d={`M ${VBW / 2} ${VBH - 264} C 260 ${VBH - 320}, 330 ${VBH - 330}, 368 ${VBH - 368}`} stroke="#e9dfc7" strokeWidth={16} fill="none" strokeLinecap="round" />
      <Path d="M 66 330 C 130 352, 165 330, 200 166" stroke="#e9dfc7" strokeWidth={13} fill="none" strokeLinecap="round" />

      {/* Plaza */}
      <Circle cx={VBW / 2} cy={VBH - 264} r={30} fill="#efe6d2" />
      <Circle cx={VBW / 2} cy={VBH - 264} r={11} fill="#e2d6bb" />

      {/* Rocky outcrop */}
      {ROCKS.map((r, i) => (
        <Polygon key={i} points={r.pts} fill={r.fill} stroke="#9aa0a4" strokeWidth={0.8} />
      ))}

      {/* Buildings */}
      {BUILDINGS.map((b, i) => (
        <G key={i}>
          <Rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="#e7e2d8" stroke="#d3ccbe" strokeWidth={1} />
          <Polygon points={`${b.x - 2},${b.y + 3} ${b.x + b.w / 2},${b.y - b.rh} ${b.x + b.w + 2},${b.y + 3}`} fill={b.roof} />
        </G>
      ))}

      {/* Keep */}
      <G>
        <Rect x={VBW / 2 - 38} y={VBH - 320} width={76} height={48} rx={4} fill="#cfd3d6" stroke="#b7bcc0" strokeWidth={1.5} />
        <Rect x={VBW / 2 - 50} y={VBH - 312} width={18} height={40} fill="#c3c8cc" />
        <Rect x={VBW / 2 + 32} y={VBH - 312} width={18} height={40} fill="#c3c8cc" />
        <Polygon points={`${VBW / 2 - 50},${VBH - 312} ${VBW / 2 - 41},${VBH - 332} ${VBW / 2 - 32},${VBH - 312}`} fill={theme.brand} />
        <Polygon points={`${VBW / 2 + 32},${VBH - 312} ${VBW / 2 + 41},${VBH - 332} ${VBW / 2 + 50},${VBH - 312}`} fill={theme.brand} />
        <Polygon points={`${VBW / 2 - 15},${VBH - 320} ${VBW / 2},${VBH - 346} ${VBW / 2 + 15},${VBH - 320}`} fill={theme.brandDark} />
      </G>

      {/* Forest */}
      {TREES.map((t, i) => (
        <G key={i}>
          <Circle cx={t[0]} cy={t[1] + t[2] * 0.5} r={t[2]} fill="#6f9e55" opacity={0.55} />
          <Circle cx={t[0]} cy={t[1]} r={t[2]} fill="#7fae63" />
          <Circle cx={t[0] - t[2] * 0.55} cy={t[1] + 2} r={t[2] * 0.72} fill="#8cbb6f" />
          <Circle cx={t[0] + t[2] * 0.55} cy={t[1] + 2} r={t[2] * 0.72} fill="#95c377" />
        </G>
      ))}
    </Svg>
  );
}

const BUILDINGS: { x: number; y: number; w: number; h: number; rh: number; roof: string }[] = [
  { x: 44, y: 80, w: 78, h: 48, rh: 15, roof: '#a9563f' },
  { x: 134, y: 66, w: 60, h: 38, rh: 13, roof: '#8f5a2b' },
  { x: 330, y: 290, w: 66, h: 44, rh: 14, roof: '#6f9e8a' },
  { x: 48, y: 380, w: 64, h: 44, rh: 13, roof: '#b3564d' },
  { x: 134, y: 420, w: 50, h: 34, rh: 11, roof: '#a9563f' },
  { x: 288, y: 520, w: 72, h: 46, rh: 15, roof: '#8f5a2b' },
  { x: 66, y: 520, w: 48, h: 34, rh: 11, roof: '#6f9e8a' },
  { x: 330, y: 600, w: 58, h: 38, rh: 13, roof: '#b3564d' },
];

const ROCKS: { pts: string; fill: string }[] = [
  { pts: '34,470 66,442 102,464 86,508 44,514', fill: '#c9ccce' },
  { pts: '78,506 112,478 142,506 124,544 86,546', fill: '#bdc1c4' },
  { pts: '26,522 56,506 76,546 48,566 22,554', fill: '#d2d5d7' },
];

const TREES: [number, number, number][] = [
  [28, 44, 15], [70, 28, 12], [376, 44, 15], [344, 26, 11], [396, 108, 13],
  [24, 232, 14], [396, 264, 14], [32, 330, 15], [28, 616, 16], [76, 648, 14],
  [166, 660, 15], [276, 660, 15], [364, 660, 14], [220, 66, 13], [172, 32, 11],
  [120, 330, 13], [220, 276, 12], [396, 440, 14], [44, 660, 13], [396, 596, 13],
  [144, 520, 12], [376, 520, 13], [106, 166, 12], [300, 380, 12],
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GRASS },
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: GRASS },
  canvas: { position: 'absolute', left: 0, top: 0 },
  pinWrap: { position: 'absolute', alignItems: 'center', width: 60, marginLeft: -30, marginTop: -46, transformOrigin: '30px 44px' },
  pinHead: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  pinImg: { width: '100%', height: '100%' },
  pinSel: { transform: [{ scale: 1.2 }] },
  pinNum: { color: theme.ink, fontWeight: '800', fontSize: 15 },
  pinEmoji: { fontSize: 16 },
  pinTail: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: theme.brand, marginTop: -3 },
  pinTime: { marginTop: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  pinTimeTxt: { color: theme.ink, fontWeight: '800', fontSize: 11 },
  clusterWrap: { position: 'absolute', width: 40, height: 40, marginLeft: -20, marginTop: -20, alignItems: 'center', justifyContent: 'center', transformOrigin: '20px 20px' },
  cluster: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  clusterTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  areaWrap: { position: 'absolute', width: 130, marginLeft: -65, marginTop: -23, alignItems: 'center', transformOrigin: '65px 23px' },
  areaBubble: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 7 },
  areaCount: { color: '#fff', fontWeight: '800', fontSize: 17 },
  areaLabel: { marginTop: 4, maxWidth: 130, backgroundColor: 'rgba(20,20,20,0.82)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  areaLabelTxt: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },
  showAllWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 90 },
  showAllChip: { backgroundColor: 'rgba(20,20,20,0.82)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  showAllTxt: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  meWrap: { position: 'absolute', width: 60, height: 60, marginLeft: -30, marginTop: -30, alignItems: 'center', justifyContent: 'center', zIndex: 5, transformOrigin: '30px 30px' },
  meGlow: { position: 'absolute', width: 46, height: 46, borderRadius: 23, opacity: 0.18 },
  meDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#1a73e8', borderWidth: 3.5, borderColor: '#fff', shadowColor: '#1a73e8', shadowOpacity: 0.6, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 6 },
  mePulse: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#1a73e8' },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 74, alignItems: 'center' },
  hintChip: { backgroundColor: 'rgba(17,17,17,0.9)', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16 },
  hintChipTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  walkPill: { position: 'absolute', right: 14, bottom: 74, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  walkPillTxt: { color: theme.ink, fontWeight: '800', fontSize: 13 },
  // The card floats above the (zero-size) pin anchor; a little arrow points
  // down at the pin. Drawn above every other marker/beacon in the canvas.
  calloutWrap: { zIndex: 30 },
  calloutFloat: { position: 'absolute', left: -128, bottom: 50, width: 256, alignItems: 'center', transformOrigin: '50% 100%' },
  calloutFloatDown: { position: 'absolute', left: -128, top: 50, width: 256, alignItems: 'center', transformOrigin: '50% 0%' },
  calloutArrow: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  calloutArrowUp: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginBottom: -1 },
  calloutCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, paddingVertical: 12, paddingLeft: 12, paddingRight: 26, width: 256, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  calloutThumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e7e2da' },
  calloutThumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand },
  calloutTitle: { fontWeight: '800', fontSize: 17, lineHeight: 21, letterSpacing: -0.2 },
  calloutSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  calloutStatus: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  calloutCloseBtn: { position: 'absolute', top: 6, right: 8, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  calloutClose: { fontSize: 14, fontWeight: '700' },
  geoBanner: { position: 'absolute', left: 14, right: 66, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(15,15,15,0.92)', paddingVertical: 12, paddingHorizontal: 16, zIndex: 65 },
  geoIcon: { fontSize: 18 },
  geoTxt: { flex: 1, color: '#f0a8a8', fontSize: 14, fontWeight: '600' },
  geoClose: { color: '#f0a8a8', fontSize: 16, fontWeight: '700' },
  hint: { position: 'absolute', bottom: 128, left: 24, right: 24, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 12, padding: 14, zIndex: 80, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 10 },
  hintText: { textAlign: 'center', color: theme.ink, fontWeight: '600', fontSize: 13 },
  profileBtn: { position: 'absolute', right: 14, top: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  searchWrap: { position: 'absolute', top: 14, left: 14, right: 66, zIndex: 60 },
  // Frosted/translucent so it blends into the map rather than a solid block.
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  searchIcon: { fontSize: 14, opacity: 0.8 },
  searchInput: { flex: 1, fontSize: 15, color: theme.ink, padding: 0 },
  searchClear: { color: theme.muted, fontSize: 14, fontWeight: '700' },
  searchResults: { backgroundColor: '#fff', borderRadius: 12, marginTop: 6, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 6 },
  searchRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  searchName: { fontSize: 14, fontWeight: '700', color: theme.ink },
  searchSub: { fontSize: 12, color: theme.muted, marginTop: 1, textTransform: 'capitalize' },
  searchEmpty: { padding: 14, color: theme.muted, fontSize: 13 },
  ctrlCol: { position: 'absolute', right: 14, top: 70, gap: 8 },
  ctrlBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, elevation: 3 },
  ctrlTxt: { fontSize: 20, fontWeight: '700', color: theme.ink },
  pills: { position: 'absolute', left: 0, right: 0, bottom: 16 },
  pillsContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, elevation: 5 },
  pillOn: { backgroundColor: theme.brand },
  pillEmoji: { fontSize: 15, color: theme.ink },
  pillLabel: { fontWeight: '800', fontSize: 13, color: theme.ink },
  pillLabelOn: { color: '#fff' },
});
