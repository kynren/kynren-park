import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput, Keyboard, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Map as MapLibreMap, Camera, ImageSource, Layer, Marker, UserLocation,
  type MapRef, type CameraRef, type LngLat,
} from '@maplibre/maplibre-react-native';
import { useLocation } from '../../lib/location';
import { useSync } from '../../lib/sync';
import { fmtTime } from '../../lib/format';
import { theme } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';
import { Touchable } from '../../components/Touchable';
import { selection } from '../../lib/haptics';

// Fixed geographic bounds of the park — the SAME box the admin map editor
// uses to place hotspots, so a pin placed in admin lands on the exact same
// spot here. MapLibre now owns pan/zoom/rotate/projection entirely (a real
// GPU-accelerated map engine, like Disneyland's/Puy du Fou's apps), so all the
// hand-rolled transform math the old screen needed is gone.
const PARK_BOUNDS = { minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674 };
const IMAGE_COORDS: [LngLat, LngLat, LngLat, LngLat] = [
  [PARK_BOUNDS.minLng, PARK_BOUNDS.maxLat], // top-left
  [PARK_BOUNDS.maxLng, PARK_BOUNDS.maxLat], // top-right
  [PARK_BOUNDS.maxLng, PARK_BOUNDS.minLat], // bottom-right
  [PARK_BOUNDS.minLng, PARK_BOUNDS.minLat], // bottom-left
];
const PARK_CENTER: LngLat = [(PARK_BOUNDS.minLng + PARK_BOUNDS.maxLng) / 2, (PARK_BOUNDS.minLat + PARK_BOUNDS.maxLat) / 2];
// [west, south, east, north] — the shape MapLibre's LngLatBounds expects.
const MAP_BOUNDS: [number, number, number, number] = [PARK_BOUNDS.minLng, PARK_BOUNDS.minLat, PARK_BOUNDS.maxLng, PARK_BOUNDS.maxLat];
const GRASS = '#a9c97f';
const FAVS_KEY = 'kynren_favorites';
const HALF_MILE_M = 804.672;

type Cat = 'favorites' | 'shows' | 'restaurants' | 'facilities';
const PILLS: { key: Cat; label: string; emoji: string }[] = [
  { key: 'favorites', label: 'Favourites', emoji: '♡' },
  { key: 'shows', label: 'Shows', emoji: '🎭' },
  { key: 'restaurants', label: 'Restaurants', emoji: '🍴' },
  { key: 'facilities', label: 'Facilities', emoji: '🚻' },
];

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
  lat: number;
  lng: number;
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

function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const walkMins = (m: number) => Math.max(1, Math.round(m / 80));

export default function MapScreen() {
  const { bundle, date } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useThemePref().scheme === 'dark';
  const cpal = dark
    ? { card: '#1f1f24', ink: '#ffffff', muted: '#a5a5ad' }
    : { card: '#ffffff', ink: theme.ink, muted: theme.muted };
  const params = useLocalSearchParams<{ focus?: string; spot?: string }>();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  // Set right before a Marker's own onPress fires, so the map's background
  // onPress (which clears the selection) can tell a marker tap from a real
  // background tap and ignore it — without this, taps on a pin sometimes
  // selected it and deselected it again in the same gesture, so the popup
  // never appeared.
  const lastMarkerPressAt = useRef(0);

  const [cats, setCats] = useState<Set<Cat>>(() => new Set<Cat>(['shows']));
  const [selected, setSelected] = useState<Pin | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const { gps } = useLocation();
  const appliedFocus = useRef<string | null>(null);

  const markerColor = bundle?.mapConfig?.markerColor ?? '#1a73e8';
  const mapImageUrl = bundle?.defaultMap?.imageUrl || bundle?.mapConfig?.mapImageUrl || null;
  const mapBg = bundle?.defaultMap?.bgColor || GRASS;
  const cfg = bundle?.mapConfig;
  const initialZoom = cfg?.initialZoom ?? 15;
  const maxZoom = Math.min(19, cfg?.maxZoom ? cfg.maxZoom + 12 : 20); // admin's old 1–12 scale, rebased to MapLibre's zoom levels
  const initialCenter: LngLat = cfg?.centerLat != null && cfg?.centerLng != null ? [cfg.centerLng, cfg.centerLat] : PARK_CENTER;
  // No basemap/tiles of our own — just our illustrated park image as a
  // source, draped over a solid background so any letterboxing around the
  // image (e.g. odd aspect ratios) shows the park's own colour, not black.
  const mapStyle = useMemo(
    () => ({ version: 8 as const, sources: {}, layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': mapBg } }] }),
    [mapBg],
  );

  useEffect(() => {
    AsyncStorage.getItem(FAVS_KEY).then((raw) => raw && setFavs(new Set(JSON.parse(raw))));
  }, []);
  useEffect(() => { if (selected) setHintDismissed(true); }, [selected]);

  const pois = bundle?.pois ?? [];
  const poiById = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);

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

  const pins = useMemo<Pin[]>(() => {
    const out: Pin[] = [];
    if (cats.has('restaurants')) {
      for (const r of bundle?.restaurants ?? []) {
        if (!r.poiId) continue;
        const poi = poiById.get(r.poiId);
        if (!poi) continue;
        out.push({ id: r.id, lat: poi.lat, lng: poi.lng, slug: r.slug, image: poi.image, kind: 'restaurant', emoji: '🍴', title: r.name, subtitle: r.cuisine ?? undefined, zone: poi.mapZone });
      }
    }
    if (cats.has('facilities')) {
      for (const poi of pois) {
        const def = FACILITY_TYPES[poi.type];
        if (!def) continue;
        out.push({ id: poi.id, lat: poi.lat, lng: poi.lng, image: poi.image, kind: 'facility', emoji: poi.icon ?? def.emoji, color: poi.color ?? def.color, title: poi.name, subtitle: poi.type.replace('_', ' ').toLowerCase(), zone: poi.mapZone });
      }
    }
    const showAll = cats.has('shows');
    const showFavs = cats.has('favorites');
    if (showAll || showFavs) {
      const dayAttractions = (bundle?.attractions ?? []).filter((a) => a.category !== 'EVENING_SHOW');
      dayAttractions.forEach((a, i) => {
        if (!a.poiId) return;
        if (!showAll && showFavs && !favs.has(a.id)) return;
        const poi = poiById.get(a.poiId);
        if (!poi) return;
        out.push({ id: a.id, attractionId: a.id, lat: poi.lat, lng: poi.lng, slug: a.slug, image: a.heroImage || poi.image, kind: 'show', number: i + 1, title: a.name, subtitle: a.tagline ?? undefined, nextTime: nextByAttraction.get(a.id), zone: poi.mapZone });
      });
      const evening = (bundle?.attractions ?? []).find((a) => a.category === 'EVENING_SHOW');
      if (evening?.poiId && (showAll || favs.has(evening.id))) {
        const poi = poiById.get(evening.poiId);
        if (poi) {
          out.push({ id: evening.id, attractionId: evening.id, lat: poi.lat, lng: poi.lng, slug: evening.slug, image: evening.heroImage || poi.image, kind: 'evening', emoji: '🌙', title: evening.name, subtitle: evening.tagline ?? undefined, nextTime: nextByAttraction.get(evening.id), zone: poi.mapZone });
        }
      }
    }
    return out;
  }, [cats, bundle, poiById, nextByAttraction, favs, pois]);

  const selPin = selected ? (pins.find((p) => p.id === selected.id) ?? selected) : null;

  const entrance = pois.find((p) => p.type === 'ENTRANCE');
  const locationReal = !!(gps && gps.lat >= PARK_BOUNDS.minLat && gps.lat <= PARK_BOUNDS.maxLat && gps.lng >= PARK_BOUNDS.minLng && gps.lng <= PARK_BOUNDS.maxLng);
  const parkCenterGeo = useMemo(() => {
    if (pois.length === 0) return null;
    return { lat: pois.reduce((s, p) => s + p.lat, 0) / pois.length, lng: pois.reduce((s, p) => s + p.lng, 0) / pois.length };
  }, [pois]);
  const distToPark = useMemo(() => (gps && parkCenterGeo ? distMeters(gps, parkCenterGeo) : null), [gps, parkCenterGeo]);
  const showMe = distToPark != null && distToPark <= HALF_MILE_M;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Focus a pin: fly the camera to it and open its popup. Used by search, a
  // scanned QR code, and "Find on Map"/"Go to" from detail screens.
  function focusPin(pin: Pin, zoom = 18) {
    selection();
    setSelected(pin);
    cameraRef.current?.easeTo({ center: [pin.lng, pin.lat], zoom, bearing: 0, pitch: 0, duration: 500 });
  }

  function goToResult(r: { id: string; kind: Cat }) {
    setCats((p) => new Set(p).add(r.kind));
    setSearch('');
    setSearchOpen(false);
    Keyboard.dismiss();
    // Wait a tick for the category (and thus the pin) to exist.
    setTimeout(() => {
      const pin = pins.find((p) => p.id === r.id);
      if (pin) focusPin(pin);
    }, 60);
  }

  // Deep link from "Go to" / "Find on Map" (attraction/restaurant/facility detail pages).
  useEffect(() => {
    if (!params.focus || appliedFocus.current === params.focus) return;
    const isRestaurant = (bundle?.restaurants ?? []).some((r) => r.id === params.focus);
    const isFacility = pois.some((p) => p.id === params.focus && FACILITY_TYPES[p.type]);
    const cat: Cat = isRestaurant ? 'restaurants' : isFacility ? 'facilities' : 'shows';
    setCats((prev) => new Set(prev).add(cat));
    setBannerDismissed(false);
    const pin = pins.find((p) => p.id === params.focus);
    if (!pin) return;
    appliedFocus.current = params.focus;
    focusPin(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focus, pins, bundle, pois]);

  // A scanned QR (kynren://spot/<type>/<id>).
  useEffect(() => {
    if (!params.spot || !bundle) return;
    const [type, id] = String(params.spot).split(':');
    let targetId = id;
    let cat: Cat = 'shows';
    if (type === 'restaurant') cat = 'restaurants';
    else if (type === 'shop') { targetId = bundle.shops?.find((s) => s.id === id)?.poiId ?? id; cat = 'facilities'; }
    else if (type === 'attraction') cat = 'shows';
    else {
      const poi = pois.find((p) => p.id === id);
      if (poi?.type === 'RESTAURANT') { targetId = bundle.restaurants?.find((r) => r.poiId === id)?.id ?? id; cat = 'restaurants'; }
      else if (poi?.type === 'ATTRACTION') { targetId = bundle.attractions?.find((a) => a.poiId === id)?.id ?? id; cat = 'shows'; }
      else cat = 'facilities';
    }
    setCats((prev) => new Set(prev).add(cat));
    setBannerDismissed(false);
    setTimeout(() => {
      const pin = pins.find((p) => p.id === targetId || p.attractionId === targetId);
      if (pin) focusPin(pin);
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.spot, bundle, pois]);

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

  const route = useMemo(() => {
    if (!selPin || !locationReal || !gps) return null;
    return { meters: distMeters(gps, selPin) };
  }, [selPin, locationReal, gps]);
  const selectedDist = route?.meters ?? null;

  function openDetail() {
    if (!selected) return;
    if (selected.kind === 'restaurant' && selected.slug) { router.push(`/restaurant/${selected.slug}`); return; }
    if ((selected.kind === 'show' || selected.kind === 'evening') && selected.slug) { router.push(`/attraction/${selected.slug}`); return; }
    if (selected.kind === 'facility') {
      const shop = bundle?.shops?.find((s) => s.poiId === selected.id);
      if (shop) { router.push(`/shop/${shop.slug}`); return; }
      router.push(`/facility/${selected.id}`);
    }
  }

  function recenter() {
    if (!showMe || !gps) return;
    cameraRef.current?.easeTo({ center: [gps.lng, gps.lat], zoom: 17, bearing: 0, pitch: 0, duration: 400 });
  }
  function fitAll() {
    cameraRef.current?.fitBounds(MAP_BOUNDS, { padding: { top: 40, right: 40, bottom: 40, left: 40 }, bearing: 0, pitch: 0, duration: 400 });
  }
  function zoomBy(delta: number) {
    mapRef.current?.getZoom().then((z) => {
      cameraRef.current?.zoomTo(Math.max(initialZoom - 4, Math.min(maxZoom, z + delta)), { bearing: 0, pitch: 0, duration: 160 });
    });
  }

  // A single map pin — a white teardrop with a dark/tinted icon, sized in
  // fixed screen pixels (MapLibre keeps it that size at any zoom natively).
  function renderPinContent(pin: Pin) {
    const isSel = selected?.id === pin.id;
    const tint = pin.kind === 'evening' ? '#2c3e70' : pin.kind === 'restaurant' ? '#f5601e' : pin.kind === 'facility' ? (pin.color ?? '#6b6460') : theme.brand;
    const glyph = pin.kind === 'evening' ? '🌙' : pin.kind === 'restaurant' ? '🍴' : pin.kind === 'facility' ? (pin.emoji ?? '•') : null;
    return (
      <View style={styles.pinWrap}>
        <View style={[styles.pinHead, { borderColor: tint }, isSel && styles.pinSel]}>
          {pin.image ? <Image source={{ uri: pin.image }} style={styles.pinImg} /> : glyph ? <Text style={styles.pinEmoji}>{glyph}</Text> : <Text style={[styles.pinNum, { color: tint }]}>{pin.number}</Text>}
        </View>
        <View style={[styles.pinTail, { borderTopColor: tint }]} />
        {pin.nextTime && (pin.kind === 'show' || pin.kind === 'evening') && (
          <View style={styles.pinTime}><Text style={styles.pinTimeTxt} numberOfLines={1}>{fmtTime(pin.nextTime)}</Text></View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: mapBg }]}>
      <MapLibreMap
        ref={mapRef}
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        onPress={() => { if (Date.now() - lastMarkerPressAt.current < 300) return; setSelected(null); }}
        touchRotate={false}
        touchPitch={false}
        compassHiddenFacingNorth
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: initialCenter, zoom: initialZoom, bearing: 0, pitch: 0 }}
          minZoom={initialZoom - 4}
          maxZoom={maxZoom}
          maxBounds={MAP_BOUNDS}
        />

        {mapImageUrl && (
          <ImageSource id="park-image" url={mapImageUrl} coordinates={IMAGE_COORDS}>
            <Layer id="park-layer" type="raster" source="park-image" paint={{ 'raster-fade-duration': 0 }} />
          </ImageSource>
        )}

        {showMe && gps && <UserLocation animated heading accuracy />}

        {pins.map((pin) => (
          <Marker key={pin.id} id={pin.id} lngLat={[pin.lng, pin.lat]} anchor="bottom" onPress={() => { lastMarkerPressAt.current = Date.now(); selection(); setSelected(pin); }}>
            {renderPinContent(pin)}
          </Marker>
        ))}

        {selPin && (
          <Marker id={`${selPin.id}:popup`} lngLat={[selPin.lng, selPin.lat]} anchor="bottom" offset={[0, -58]}>
            <Touchable style={[styles.calloutCard, { backgroundColor: cpal.card }]} onPress={openDetail}>
              {selPin.image ? (
                <Image source={{ uri: selPin.image }} style={styles.calloutThumb} />
              ) : (
                <View style={[styles.calloutThumb, styles.calloutThumbFallback, selPin.kind === 'evening' && { backgroundColor: '#2c3e70' }]}>
                  <Text style={{ fontSize: 26 }}>{selPin.emoji ?? '🎭'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.calloutTitle, { color: cpal.ink }]} numberOfLines={2}>{selPin.title}</Text>
                <Text style={[styles.calloutSub, { color: cpal.muted }]} numberOfLines={1}>{selPin.subtitle ?? selPin.zone ?? 'Kynren — The Storied Lands'}</Text>
                <Text style={[styles.calloutStatus, { color: cpal.ink }]} numberOfLines={1}>
                  {selectedDist != null
                    ? `${fmtDist(selectedDist)} away · ~${walkMins(selectedDist)} min walk`
                    : selPin.nextTime
                      ? `Next show ${fmtTime(selPin.nextTime)}`
                      : selPin.kind === 'restaurant' ? 'Tap for menu & times' : 'Tap for details'}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setSelected(null)} style={styles.calloutCloseBtn}>
                <Text style={[styles.calloutClose, { color: cpal.muted }]}>✕</Text>
              </Pressable>
            </Touchable>
          </Marker>
        )}
      </MapLibreMap>

      {/* Location banner — the app needs GPS to show your position & distances */}
      {!locationReal && !bannerDismissed && (
        <View style={[styles.geoBanner, { top: insets.top + 62 }]}>
          <Text style={styles.geoIcon}>📱</Text>
          <Text style={styles.geoTxt}>{gps ? 'You seem to be outside the park' : 'Turn on location to see where you are and how far things are'}</Text>
          <Pressable hitSlop={8} onPress={() => setBannerDismissed(true)}><Text style={styles.geoClose}>✕</Text></Pressable>
        </View>
      )}

      {/* Empty favourites hint */}
      {cats.has('favorites') && pins.length === 0 && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>No favourites yet — open a show and tap ♡ to add it here.</Text>
        </View>
      )}

      {/* Search */}
      {searchOpen && (
        <View style={[styles.searchWrap, { top: insets.top + 8 }]}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput autoFocus style={styles.searchInput} placeholder="Search the map…" placeholderTextColor="#8a8a8a" value={search} onChangeText={setSearch} returnKeyType="search" />
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
        <Touchable style={styles.ctrlBtn} onPress={() => zoomBy(1)}><Text style={styles.ctrlTxt}>＋</Text></Touchable>
        <Touchable style={styles.ctrlBtn} onPress={() => zoomBy(-1)}><Text style={styles.ctrlTxt}>－</Text></Touchable>
        <Touchable style={styles.ctrlBtn} onPress={fitAll}><Text style={{ fontSize: 15 }}>🗺️</Text></Touchable>
        <Touchable style={styles.ctrlBtn} onPress={recenter}><Text style={{ fontSize: 17 }}>📍</Text></Touchable>
        <Touchable style={styles.ctrlBtn} onPress={() => { setSelected(null); setSearchOpen(true); }}><Text style={{ fontSize: 16 }}>🔍</Text></Touchable>
      </View>

      {/* "Tap the map to explore" hint */}
      {!selected && !hintDismissed && (
        <View style={styles.hintWrap} pointerEvents="box-none">
          <Touchable style={styles.hintChip} onPress={() => setHintDismissed(true)}><Text style={styles.hintChipTxt}>TAP THE MAP TO EXPLORE</Text></Touchable>
        </View>
      )}

      {/* Walk-time pill when a destination is selected */}
      {selected && selectedDist != null && (
        <View style={styles.walkPill} pointerEvents="none"><Text style={styles.walkPillTxt}>🚶 {walkMins(selectedDist)} min walk</Text></View>
      )}

      {/* Bottom category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills} contentContainerStyle={styles.pillsContent}>
        {PILLS.map((p) => {
          const on = cats.has(p.key);
          return (
            <Touchable key={p.key} haptic="selection" style={[styles.pill, on && styles.pillOn]} onPress={() => { setCats((prev) => { const n = new Set(prev); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; }); setSelected(null); }}>
              <Text style={[styles.pillEmoji, on && { color: '#fff' }]}>{p.emoji}</Text>
              <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>{p.label}</Text>
            </Touchable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GRASS },
  pinWrap: { alignItems: 'center', width: 60 },
  pinHead: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  pinImg: { width: '100%', height: '100%' },
  pinSel: { transform: [{ scale: 1.2 }] },
  pinNum: { color: theme.ink, fontWeight: '800', fontSize: 15 },
  pinEmoji: { fontSize: 16 },
  pinTail: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: theme.brand, marginTop: -3 },
  pinTime: { marginTop: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  pinTimeTxt: { color: theme.ink, fontWeight: '800', fontSize: 11 },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 74, alignItems: 'center' },
  hintChip: { backgroundColor: 'rgba(17,17,17,0.9)', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16 },
  hintChipTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  walkPill: { position: 'absolute', right: 14, bottom: 74, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  walkPillTxt: { color: theme.ink, fontWeight: '800', fontSize: 13 },
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
