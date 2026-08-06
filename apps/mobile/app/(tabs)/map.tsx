import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Image, TextInput, Keyboard, ScrollView, Dimensions, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Circle, Ellipse, Path, G, Polygon, Line } from 'react-native-svg';
import * as Location from 'expo-location';
import { api, getToken } from '../../lib/api';
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
const PADX = 0.14; // fraction of width kept as margin around the pin cluster
const PADY = 0.12;
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

const MIN_SCALE = 1;
const MAX_SCALE = 4.5;

export default function MapScreen() {
  const { bundle, date } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useThemePref().scheme === 'dark';
  const cpal = dark
    ? { card: '#1f1f24', ink: '#ffffff', muted: '#a5a5ad' }
    : { card: '#ffffff', ink: theme.ink, muted: theme.muted };
  const params = useLocalSearchParams<{ focus?: string }>();
  const [cat, setCat] = useState<Cat>('shows');
  const [selected, setSelected] = useState<Pin | null>(null);
  const [search, setSearch] = useState('');
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const appliedFocus = useRef<string | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  // Seed from the real window size so the map fills the screen from the first
  // frame (never leaving a green margin before onLayout measures precisely).
  const [vp, setVp] = useState(() => { const d = Dimensions.get('window'); return { w: d.width, h: d.height }; });
  const pulse = useRef(new Animated.Value(0)).current;

  // Pan/zoom live on the UI thread as reanimated shared values → native-smooth.
  const scale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const vpw = useSharedValue(375);
  const vph = useSharedValue(680);

  const win = Dimensions.get('window');
  const vw = vp.w || win.width;
  const vh = vp.h || win.height;
  const markerColor = bundle?.mapConfig?.markerColor ?? '#1a73e8';
  const mapImageUrl = bundle?.defaultMap?.imageUrl || bundle?.mapConfig?.mapImageUrl || null;

  // Free panning with a gentle boundary (map can't be fully lost) at any zoom.
  // JS-thread version for programmatic moves (buttons, deep links).
  function clampPanJS(x: number, y: number, s: number) {
    const w = vw, h = vh;
    const maxX = ((s - 1) * w) / 2 + w * 0.45;
    const maxY = ((s - 1) * h) / 2 + h * 0.45;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }
  // Animate to a scale + pan (used by zoom/recenter/fit and deep links).
  function animateTo(s: number, x: number, y: number, ms = 220) {
    scale.value = withTiming(s, { duration: ms });
    panX.value = withTiming(x, { duration: ms });
    panY.value = withTiming(y, { duration: ms });
  }

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    AsyncStorage.getItem(FAVS_KEY).then((raw) => raw && setFavs(new Set(JSON.parse(raw))));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(here);
        // Report presence so staff can see who's in the park (signed-in guests only).
        const token = await getToken();
        if (token) api('/me/presence', { method: 'POST', body: JSON.stringify(here) }).catch(() => undefined);
      } catch {
        /* no location */
      }
    })();
    return () => {
      cancelled = true;
    };
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
      const w = vpw.value || 375, h = vph.value || 680;
      const maxX = ((s - 1) * w) / 2 + w * 0.45;
      const maxY = ((s - 1) * h) / 2 + h * 0.45;
      return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
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
        const target = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale.value * e.scale));
        const r = target / scale.value;
        const cx = (vpw.value || 375) / 2, cy = (vph.value || 680) / 2;
        const nx = e.focalX - cx - (e.focalX - cx - panX.value) * r;
        const ny = e.focalY - cy - (e.focalY - cy - panY.value) * r;
        scale.value = target;
        const c = clamp(nx, ny, target);
        panX.value = c.x; panY.value = c.y;
      });
    return Gesture.Simultaneous(pan, pinch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));

  const pois = bundle?.pois ?? [];

  // Project a lat/lng to screen pixels, spreading the park across the viewport
  // with a little margin so pins never touch the edges.
  const project = useMemo(() => {
    if (pois.length === 0) return null;
    const lats = pois.map((p) => p.lat);
    const lngs = pois.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    const toXY = (lat: number, lng: number) => ({
      x: (PADX + ((lng - minLng) / spanLng) * (1 - 2 * PADX)) * vw,
      y: (PADY + ((maxLat - lat) / spanLat) * (1 - 2 * PADY)) * vh,
    });
    const inBounds = (lat: number, lng: number) =>
      lat >= minLat - spanLat * 0.6 && lat <= maxLat + spanLat * 0.6 && lng >= minLng - spanLng * 0.6 && lng <= maxLng + spanLng * 0.6;
    return { toXY, inBounds };
  }, [pois, vw, vh]);

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
    if (cat === 'restaurants') {
      for (const r of bundle?.restaurants ?? []) {
        if (!r.poiId) continue;
        const poi = poiById.get(r.poiId);
        if (!poi) continue;
        const { x, y } = project.toXY(poi.lat, poi.lng);
        out.push({ id: r.id, x, y, lat: poi.lat, lng: poi.lng, slug: r.slug, image: poi.image, kind: 'restaurant', emoji: '🍴', title: r.name, subtitle: r.cuisine ?? undefined, zone: poi.mapZone });
      }
      return out;
    }
    if (cat === 'facilities') {
      for (const poi of pois) {
        const def = FACILITY_TYPES[poi.type];
        if (!def) continue; // attractions & restaurants have their own filters
        const { x, y } = project.toXY(poi.lat, poi.lng);
        out.push({ id: poi.id, x, y, lat: poi.lat, lng: poi.lng, image: poi.image, kind: 'facility', emoji: poi.icon ?? def.emoji, color: poi.color ?? def.color, title: poi.name, subtitle: poi.type.replace('_', ' ').toLowerCase(), zone: poi.mapZone });
      }
      return out;
    }
    const dayAttractions = (bundle?.attractions ?? []).filter((a) => a.category !== 'EVENING_SHOW');
    dayAttractions.forEach((a, i) => {
      if (!a.poiId) return;
      if (cat === 'favorites' && !favs.has(a.id)) return;
      const poi = poiById.get(a.poiId);
      if (!poi) return;
      const { x, y } = project.toXY(poi.lat, poi.lng);
      out.push({ id: a.id, attractionId: a.id, x, y, lat: poi.lat, lng: poi.lng, slug: a.slug, image: poi.image, kind: 'show', number: i + 1, title: a.name, subtitle: a.tagline ?? undefined, nextTime: nextByAttraction.get(a.id), zone: poi.mapZone });
    });
    if (cat === 'shows') {
      const evening = (bundle?.attractions ?? []).find((a) => a.category === 'EVENING_SHOW');
      if (evening?.poiId) {
        const poi = poiById.get(evening.poiId);
        if (poi) {
          const { x, y } = project.toXY(poi.lat, poi.lng);
          out.push({ id: evening.id, attractionId: evening.id, x, y, lat: poi.lat, lng: poi.lng, slug: evening.slug, image: poi.image, kind: 'evening', emoji: '🌙', title: evening.name, subtitle: evening.tagline ?? undefined, nextTime: nextByAttraction.get(evening.id), zone: poi.mapZone });
        }
      }
    }
    return out;
  }, [cat, bundle, project, poiById, nextByAttraction, favs]);

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
    setCat(r.kind);
    setPendingSelect(r.id);
    setSearch('');
    Keyboard.dismiss();
  }
  // Once the pins for the chosen layer are ready, select & centre the result.
  useEffect(() => {
    if (!pendingSelect || vw === 0) return;
    const pin = pins.find((p) => p.id === pendingSelect);
    if (!pin) return;
    // Centre on the result, but don't open the popup — it appears only on a tap.
    const s = 2.4;
    const c = clampPanJS((vw / 2 - pin.x) * s, (vh / 2 - pin.y) * s, s);
    animateTo(s, c.x, c.y);
    setPendingSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelect, pins, vw, vh]);

  // Hide the "tap to explore" hint once the guest opens a place.
  useEffect(() => { if (selected) setHintDismissed(true); }, [selected]);

  const entrance = pois.find((p) => p.type === 'ENTRANCE');
  const locationReal = !!(gps && project && project.inBounds(gps.lat, gps.lng));
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
    setCat(isRestaurant ? 'restaurants' : 'shows');
    appliedFocus.current = null;
    setBannerDismissed(false);
  }, [params.focus, bundle]);
  useEffect(() => {
    if (!params.focus || appliedFocus.current === params.focus || vw === 0) return;
    const pin = pins.find((p) => p.id === params.focus);
    if (!pin) return;
    appliedFocus.current = params.focus;
    const s = 2.2;
    const c = clampPanJS((vw / 2 - pin.x) * s, (vh / 2 - pin.y) * s, s);
    animateTo(s, c.x, c.y);
  }, [params.focus, pins, vw, vh]);

  // Distance from the guest to the currently selected place.
  const selectedDist = useMemo(() => {
    if (!selected || selected.lat == null || !locationReal || !gps) return null;
    return distMeters(gps, { lat: selected.lat, lng: selected.lng! });
  }, [selected, gps, locationReal]);

  function zoomTo(next: number) {
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +next.toFixed(2)));
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
    if (!selected?.slug) return;
    router.push(selected.kind === 'restaurant' ? `/restaurant/${selected.slug}` : `/attraction/${selected.slug}`);
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    vpw.value = width; vph.value = height;
    setVp({ w: width, h: height });
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.viewport}>
        <GestureDetector gesture={gesture}>
        <Reanimated.View style={[styles.canvas, { width: vw, height: vh }, canvasStyle]}>
          {mapImageUrl ? (
            <Image source={{ uri: mapImageUrl }} style={{ position: 'absolute', width: vw, height: vh }} resizeMode="cover" />
          ) : (
            <ParkBasemap vw={vw} vh={vh} />
          )}

          {/* Walking route from the guest to the selected place (map-style casing). */}
          {selected && selectedDist != null && (
            <Svg style={StyleSheet.absoluteFill} width={vw} height={vh} pointerEvents="none">
              <Line x1={youAreHere.x} y1={youAreHere.y} x2={selected.x} y2={selected.y} stroke="#ffffff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
              <Line x1={youAreHere.x} y1={youAreHere.y} x2={selected.x} y2={selected.y} stroke="#2b7fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}

          {pins.map((pin) => {
            const isSel = selected?.id === pin.id;
            if (pin.kind === 'evening') {
              return (
                <Pressable key={pin.id} style={[styles.pinWrap, { left: pin.x, top: pin.y }, isSel && { zIndex: 20 }]} onPress={() => { selection(); setSelected(pin); }}>
                  <View style={[styles.pinHead, styles.pinEvening, isSel && styles.pinSel]}>
                    {pin.image ? <Image source={{ uri: pin.image }} style={styles.pinImg} /> : <Text style={styles.pinEmoji}>🌙</Text>}
                  </View>
                  <View style={[styles.pinTail, { borderTopColor: '#2c3e70' }]} />
                  {pin.nextTime && (
                    <View style={styles.pinTime}><Text style={styles.pinTimeTxt} numberOfLines={1}>{fmtTime(pin.nextTime)}</Text></View>
                  )}
                </Pressable>
              );
            }
            if (pin.kind === 'restaurant') {
              return (
                <Pressable key={pin.id} style={[styles.pinWrap, { left: pin.x, top: pin.y }, isSel && { zIndex: 20 }]} onPress={() => { selection(); setSelected(pin); }}>
                  <View style={[styles.pinHead, isSel && styles.pinSel]}>
                    {pin.image ? <Image source={{ uri: pin.image }} style={styles.pinImg} /> : <Text style={styles.pinEmoji}>🍴</Text>}
                  </View>
                  <View style={styles.pinTail} />
                </Pressable>
              );
            }
            if (pin.kind === 'facility') {
              return (
                <Pressable key={pin.id} style={[styles.pinWrap, { left: pin.x, top: pin.y }, isSel && { zIndex: 20 }]} onPress={() => { selection(); setSelected(pin); }}>
                  <View style={[styles.pinHead, { backgroundColor: pin.color ?? '#6b6460' }, isSel && styles.pinSel]}>
                    {pin.image ? <Image source={{ uri: pin.image }} style={styles.pinImg} /> : <Text style={styles.pinEmoji}>{pin.emoji}</Text>}
                  </View>
                  <View style={[styles.pinTail, { borderTopColor: pin.color ?? '#6b6460' }]} />
                </Pressable>
              );
            }
            return (
              <Pressable key={pin.id} style={[styles.pinWrap, { left: pin.x, top: pin.y }, isSel && { zIndex: 20 }]} onPress={() => { selection(); setSelected(pin); }}>
                <View style={[styles.pinHead, isSel && styles.pinSel]}>
                  {pin.image ? <Image source={{ uri: pin.image }} style={styles.pinImg} /> : <Text style={styles.pinNum}>{pin.number}</Text>}
                </View>
                <View style={styles.pinTail} />
                {pin.nextTime && (
                  <View style={styles.pinTime}><Text style={styles.pinTimeTxt} numberOfLines={1}>{fmtTime(pin.nextTime)}</Text></View>
                )}
              </Pressable>
            );
          })}

          {/* You are here — glowing location beacon */}
          <View style={[styles.meWrap, { left: youAreHere.x, top: youAreHere.y }]} pointerEvents="none">
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
          </View>

        </Reanimated.View>
        </GestureDetector>

        {/* Popup — centred on the map with a margin, themed to match light/dark. */}
        {selected && (
          <View style={styles.calloutWrap} pointerEvents="box-none">
            <Touchable style={[styles.calloutCard, { backgroundColor: cpal.card }]} onPress={openDetail}>
              <View style={[styles.calloutIcon, selected.kind === 'evening' && { backgroundColor: '#2c3e70' }]}>
                <Text style={{ fontSize: 18 }}>{selected.emoji ?? '🎭'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.calloutTitle, { color: cpal.ink }]} numberOfLines={1}>{selected.title}</Text>
                {selected.subtitle && <Text style={styles.calloutSub} numberOfLines={1}>{selected.subtitle}</Text>}
                <Text style={[styles.calloutMeta, { color: cpal.muted }]}>
                  {selectedDist != null
                    ? `📍 ${fmtDist(selectedDist)} away · ~${walkMins(selectedDist)} min walk`
                    : selected.kind === 'restaurant'
                      ? selected.zone ?? 'The Storied Lands'
                      : selected.nextTime
                        ? `Next show ${fmtTime(selected.nextTime)}`
                        : 'No more shows today'}
                </Text>
                <Text style={styles.calloutHint}>Tap for details ›</Text>
              </View>
              {selected.attractionId && (
                <Pressable hitSlop={8} onPress={() => toggleFav(selected.attractionId!)}>
                  <Text style={[styles.calloutHeart, { color: cpal.muted }, favs.has(selected.attractionId) && { color: theme.brand }]}>
                    {favs.has(selected.attractionId) ? '♥' : '♡'}
                  </Text>
                </Pressable>
              )}
              <Pressable hitSlop={8} onPress={() => setSelected(null)}>
                <Text style={[styles.calloutClose, { color: cpal.muted }]}>✕</Text>
              </Pressable>
            </Touchable>
          </View>
        )}

        {/* Location banner — the app needs GPS to show your position & distances */}
        {!locationReal && !bannerDismissed && (
          <View style={[styles.geoBanner, { paddingTop: insets.top + 12 }]}>
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
        {cat === 'favorites' && pins.length === 0 && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>No favourites yet — open a show and tap ♡ to add it here.</Text>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchWrap, { top: insets.top + 8 }]}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search the map…"
              placeholderTextColor="#8a8a8a"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Touchable onPress={() => setSearch('')} hitSlop={8}><Text style={styles.searchClear}>✕</Text></Touchable>
            )}
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

        {/* Profile */}
        <Touchable style={[styles.profileBtn, { top: insets.top + 8 }]} onPress={() => router.push('/settings')}>
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
        </View>

        {/* "Tap the map to explore" hint, until the guest opens something */}
        {!selected && !hintDismissed && (
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
            const on = cat === p.key;
            return (
              <Touchable key={p.key} haptic="selection" style={[styles.pill, on && styles.pillOn]} onPress={() => { setCat(p.key); setSelected(null); }}>
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
  pinWrap: { position: 'absolute', alignItems: 'center', width: 60, marginLeft: -30, marginTop: -46 },
  pinHead: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  pinImg: { width: '100%', height: '100%' },
  pinEvening: { backgroundColor: '#2c3e70' },
  pinSel: { transform: [{ scale: 1.2 }] },
  pinNum: { color: '#fff', fontWeight: '800', fontSize: 16 },
  pinEmoji: { fontSize: 16 },
  pinTail: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: theme.brand, marginTop: -3 },
  pinTime: { marginTop: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  pinTimeTxt: { color: theme.ink, fontWeight: '800', fontSize: 11 },
  meWrap: { position: 'absolute', width: 60, height: 60, marginLeft: -30, marginTop: -30, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  meGlow: { position: 'absolute', width: 46, height: 46, borderRadius: 23, opacity: 0.18 },
  meDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#1a73e8', borderWidth: 3.5, borderColor: '#fff', shadowColor: '#1a73e8', shadowOpacity: 0.6, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 6 },
  mePulse: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#1a73e8' },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 74, alignItems: 'center' },
  hintChip: { backgroundColor: 'rgba(17,17,17,0.9)', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16 },
  hintChipTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  walkPill: { position: 'absolute', right: 14, bottom: 74, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  walkPillTxt: { color: theme.ink, fontWeight: '800', fontSize: 13 },
  calloutWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, zIndex: 30 },
  calloutCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  calloutIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand },
  calloutTitle: { fontWeight: '800', fontSize: 15, color: theme.ink },
  calloutSub: { color: theme.brand, fontWeight: '600', fontSize: 11, marginTop: 1 },
  calloutMeta: { color: theme.muted, fontSize: 11, marginTop: 2 },
  calloutHint: { color: theme.brand, fontSize: 11, fontWeight: '700', marginTop: 3 },
  calloutHeart: { fontSize: 20, color: theme.muted, paddingHorizontal: 2 },
  calloutClose: { color: theme.muted, fontSize: 15, fontWeight: '700', paddingHorizontal: 2 },
  geoBanner: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(15,15,15,0.9)', paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16, zIndex: 50 },
  geoIcon: { fontSize: 18 },
  geoTxt: { flex: 1, color: '#f0a8a8', fontSize: 14, fontWeight: '600' },
  geoClose: { color: '#f0a8a8', fontSize: 16, fontWeight: '700' },
  hint: { position: 'absolute', top: 20, left: 24, right: 24, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 14 },
  hintText: { textAlign: 'center', color: theme.ink, fontWeight: '600', fontSize: 13 },
  profileBtn: { position: 'absolute', right: 14, top: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  searchWrap: { position: 'absolute', top: 14, left: 14, right: 66, zIndex: 60 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  searchIcon: { fontSize: 14 },
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
