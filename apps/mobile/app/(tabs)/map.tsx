import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, PanResponder } from 'react-native';
import Svg, { Circle, Rect, Ellipse, Line, Text as SvgText, G } from 'react-native-svg';
import { useSync, type Poi } from '../../lib/sync';
import { theme } from '../../lib/theme';

const TYPE_META: Record<string, { color: string; emoji: string; label: string }> = {
  ATTRACTION: { color: theme.brand, emoji: '🎭', label: 'Shows' },
  RESTAURANT: { color: '#b7791f', emoji: '🍽️', label: 'Food' },
  RESTROOM: { color: '#3a7ca5', emoji: '🚻', label: 'Toilets' },
  SHOP: { color: '#6b4fa1', emoji: '🛍️', label: 'Shops' },
  FIRST_AID: { color: '#b3261e', emoji: '➕', label: 'First aid' },
  ENTRANCE: { color: '#2e7d5b', emoji: '🚪', label: 'Entrance' },
  PARKING: { color: '#6b6460', emoji: '🅿️', label: 'Parking' },
  ACCESSIBILITY: { color: '#3a7ca5', emoji: '♿', label: 'Access' },
  BABY_CHANGING: { color: '#c0392f', emoji: '🍼', label: 'Baby' },
  PICNIC: { color: '#2e7d5b', emoji: '🧺', label: 'Picnic' },
  INFO: { color: '#8f1d21', emoji: 'ℹ️', label: 'Info' },
};

const W = 340;
const H = 440;
const PAD = 40;
const ZONE_TINT = ['#e8efe6', '#efe9dd', '#e6edf2', '#efe6ee', '#eef1e6'];

export default function MapScreen() {
  const { bundle } = useSync();
  const pois = bundle?.pois ?? [];
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Poi | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Drag-to-pan; only claims the gesture once the finger actually moves, so
  // single taps still reach the POI markers.
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        panStart.current = pan;
      },
      onPanResponderMove: (_e, g) => setPan({ x: panStart.current.x + g.dx, y: panStart.current.y + g.dy }),
    }),
  ).current;

  const projected = useMemo(() => {
    if (pois.length === 0) return [];
    const lats = pois.map((p) => p.lat);
    const lngs = pois.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    return pois.map((p) => ({
      poi: p,
      x: PAD + ((p.lng - minLng) / spanLng) * (W - 2 * PAD),
      y: PAD + ((maxLat - p.lat) / spanLat) * (H - 2 * PAD),
    }));
  }, [pois]);

  // Group projected points into zones (centroid + radius) for the coloured regions.
  const zones = useMemo(() => {
    const byZone = new Map<string, { x: number; y: number }[]>();
    for (const p of projected) {
      const z = p.poi.mapZone || 'Park';
      if (!byZone.has(z)) byZone.set(z, []);
      byZone.get(z)!.push({ x: p.x, y: p.y });
    }
    return [...byZone.entries()].map(([name, pts], i) => {
      const cx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
      const cy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
      const r = Math.max(38, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 26;
      return { name, cx, cy, rx: r, ry: r * 0.8, tint: ZONE_TINT[i % ZONE_TINT.length]! };
    });
  }, [projected]);

  const entrance = projected.find((p) => p.poi.type === 'ENTRANCE');
  const attractions = projected.filter((p) => p.poi.type === 'ATTRACTION');
  const visible = filter ? projected.filter((p) => p.poi.type === filter) : projected;
  const types = Array.from(new Set(pois.map((p) => p.type)));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        <Chip active={filter === null} label="All" onPress={() => setFilter(null)} />
        {types.map((t) => (
          <Chip key={t} active={filter === t} label={`${TYPE_META[t]?.emoji ?? '📍'} ${TYPE_META[t]?.label ?? t}`} onPress={() => setFilter(t)} />
        ))}
      </ScrollView>

      <View style={styles.mapWrap} {...responder.panHandlers}>
        <Svg width={W} height={H}>
          <Rect x={0} y={0} width={W} height={H} rx={16} fill="#eef2ec" />
          <G transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
            {/* Zones */}
            {zones.map((z) => (
              <G key={z.name}>
                <Ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry} fill={z.tint} stroke="#d8ddd2" strokeWidth={1} />
                <SvgText x={z.cx} y={z.cy - z.ry + 14} fontSize={9} fill={theme.muted} textAnchor="middle" fontWeight="700">
                  {z.name.toUpperCase()}
                </SvgText>
              </G>
            ))}
            {/* Paths from the entrance to each attraction */}
            {entrance &&
              attractions.map((a) => (
                <Line key={`path-${a.poi.id}`} x1={entrance.x} y1={entrance.y} x2={a.x} y2={a.y} stroke="#c9cfc2" strokeWidth={1.5} strokeDasharray="4 4" />
              ))}
            {/* POIs */}
            {visible.map(({ poi, x, y }) => {
              const meta = TYPE_META[poi.type] ?? { color: theme.muted, emoji: '📍' };
              const isSel = selected?.id === poi.id;
              return (
                <G key={poi.id} onPress={() => setSelected(poi)}>
                  <Circle cx={x} cy={y} r={isSel ? 11 : 7} fill={meta.color} stroke="#fff" strokeWidth={2} />
                  {poi.type === 'ATTRACTION' && (
                    <SvgText x={x} y={y - 13} fontSize={8.5} fill={theme.ink} textAnchor="middle">
                      {poi.name.length > 16 ? poi.name.slice(0, 15) + '…' : poi.name}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </G>
        </Svg>

        {/* Zoom controls */}
        <View style={styles.zoomCol}>
          <Pressable style={styles.zoomBtn} onPress={() => setScale((s) => Math.min(2.6, +(s + 0.3).toFixed(2)))}>
            <Text style={styles.zoomTxt}>＋</Text>
          </Pressable>
          <Pressable style={styles.zoomBtn} onPress={() => setScale((s) => Math.max(0.6, +(s - 0.3).toFixed(2)))}>
            <Text style={styles.zoomTxt}>－</Text>
          </Pressable>
          <Pressable style={styles.zoomBtn} onPress={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>
            <Text style={styles.resetTxt}>⟲</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.detail}>
        {selected ? (
          <>
            <Text style={styles.detailName}>
              {TYPE_META[selected.type]?.emoji} {selected.name}
            </Text>
            {selected.mapZone && <Text style={styles.muted}>Zone: {selected.mapZone}</Text>}
            {selected.description && <Text style={styles.muted}>{selected.description}</Text>}
          </>
        ) : (
          <Text style={styles.muted}>Tap a point for details · drag to pan · ＋/－ to zoom. Works fully offline.</Text>
        )}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: theme.brand, borderColor: theme.brand }]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { maxHeight: 52, paddingVertical: 10, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff' },
  chipText: { fontSize: 13, color: theme.ink },
  mapWrap: { alignItems: 'center', padding: 12 },
  zoomCol: { position: 'absolute', right: 20, top: 24, gap: 8 },
  zoomBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  zoomTxt: { fontSize: 20, fontWeight: '700', color: theme.ink },
  resetTxt: { fontSize: 16, color: theme.muted },
  detail: { margin: 12, padding: 14, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, minHeight: 80 },
  detailName: { fontWeight: '700', fontSize: 16, color: theme.ink },
  muted: { color: theme.muted, marginTop: 4, fontSize: 13 },
});
