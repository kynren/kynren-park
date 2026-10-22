import { PageBackdrop } from '../../components/ui/PageBackdrop';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Touchable } from '../../components/Touchable';
import { Card, Chip, SearchPill, SectionHeader } from '../../components/ui/Controls';
import { Cover } from '../../components/ui/Cover';
import { Reveal } from '../../components/ui/Reveal';
import { ScreenHeader } from '../../components/ui/Header';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useSync } from '../../lib/sync';
import { featureGradient, serif } from '../../lib/theme';
import { useUI } from '../../lib/ui';

type Kind = 'show' | 'food' | 'shop' | 'facility';
type Result = { key: string; kind: Kind; title: string; subtitle: string; image?: string | null; to: Href; haystack: string };

const FILTERS: { id: 'all' | Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'show', label: 'Shows' },
  { id: 'food', label: 'Food' },
  { id: 'shop', label: 'Shops' },
  { id: 'facility', label: 'Facilities' },
];

const KIND_ICON: Record<Kind, IconName> = { show: 'calendar', food: 'fork', shop: 'shop', facility: 'pin' };
const TILE_TITLE: Record<Kind, string> = { show: 'Shows', food: 'Food & drink', shop: 'Shops', facility: 'Facilities' };
const KIND_TITLE: Record<Kind, string> = { show: 'Shows & attractions', food: 'Food & drink', shop: 'Shops', facility: 'Facilities' };

const KIND_COLOR: Record<Kind, string> = { show: featureGradient.programme.from, food: featureGradient.restaurants.from, shop: '#2f5b43', facility: '#4b5d73' };

const FACILITY_LABEL: Record<string, string> = {
  RESTROOM: 'Toilets', FIRST_AID: 'First aid', PARKING: 'Parking', ACCESSIBILITY: 'Accessibility',
  BABY_CHANGING: 'Baby changing', PICNIC: 'Picnic area', ENTRANCE: 'Entrance', INFO: 'Information',
};

const QUICK: { label: string; hint: string; icon: IconName; to: Href }[] = [
  { label: 'Programme', hint: 'What is on, and when', icon: 'calendar', to: '/(tabs)/shows' },
  { label: 'My tickets', hint: 'Your QR codes', icon: 'ticket', to: '/(tabs)/tickets' },
  { label: 'Shuttle', hint: 'Timetable and stops', icon: 'bus', to: '/shuttle' },
  { label: 'Accessibility', hint: 'Step-free routes and support', icon: 'access', to: '/accessibility' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { bundle } = useSync();
  const { c } = useUI();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [query, setQuery] = useState('');
  const [chosen, setFilter] = useState<'all' | Kind | null>(null);
  // A filter handed in by a link (Home's "Shops") applies until the guest picks another chip.
  const linked = FILTERS.some((f) => f.id === params.filter) ? (params.filter as 'all' | Kind) : 'all';
  const filter = chosen ?? linked;

  const all = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const a of bundle?.attractions ?? []) {
      out.push({ key: `a-${a.id}`, kind: 'show', title: a.name, subtitle: a.tagline || a.category.replace('_', ' ').toLowerCase(), image: a.heroImage, to: `/attraction/${a.slug}`, haystack: `${a.name} ${a.tagline ?? ''} ${a.category} ${a.synopsis}` });
    }
    for (const r of bundle?.restaurants ?? []) {
      out.push({ key: `r-${r.id}`, kind: 'food', title: r.name, subtitle: r.cuisine || 'Restaurant', image: r.heroImage, to: `/restaurant/${r.slug}`, haystack: `${r.name} ${r.cuisine ?? ''} ${r.description ?? ''} ${r.menuItems.map((m) => m.name).join(' ')}` });
    }
    for (const s of bundle?.shops ?? []) {
      out.push({ key: `s-${s.id}`, kind: 'shop', title: s.name, subtitle: s.category || 'Shop', image: s.heroImage, to: `/shop/${s.slug}`, haystack: `${s.name} ${s.category ?? ''} ${s.description ?? ''} ${s.items.map((i) => i.name).join(' ')}` });
    }
    for (const p of bundle?.pois ?? []) {
      if (!FACILITY_LABEL[p.type]) continue;
      out.push({ key: `p-${p.id}`, kind: 'facility', title: p.name, subtitle: FACILITY_LABEL[p.type], image: p.image ?? p.heroImage, to: `/facility/${p.id}`, haystack: `${p.name} ${FACILITY_LABEL[p.type]} ${p.description ?? ''} ${p.mapZone ?? ''}` });
    }
    return out;
  }, [bundle]);

  const q = query.trim().toLowerCase();
  // Nothing typed and no filter chosen: show the quick links. A chosen filter on its own lists everything of that kind.
  const browsing = !q && filter === 'all';
  const results = useMemo(() => {
    if (browsing) return [];
    const words = q ? q.split(/\s+/) : [];
    return all.filter((r) => (filter === 'all' || r.kind === filter) && words.every((w) => r.haystack.toLowerCase().includes(w)));
  }, [all, q, filter, browsing]);

  // A real photo for each category tile, and how much is in it.
  const tiles = (['show', 'food', 'shop', 'facility'] as Kind[]).map((kind) => {
    const items = all.filter((r) => r.kind === kind);
    return { kind, count: items.length, image: items.find((r) => r.image)?.image ?? null };
  });

  const grouped = (['show', 'food', 'shop', 'facility'] as Kind[]).map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) })).filter((g) => g.items.length);

  return (
    <View style={[styles.screen, { backgroundColor: c.screen }]}>
      <PageBackdrop page="search" />
      <ScreenHeader page="search" title="Search" subtitle="Shows, food, shops and facilities">
        <SearchPill placeholder="Find everything here" value={query} onChangeText={setQuery} />
      </ScreenHeader>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>

        {browsing ? (
          <View style={{ marginTop: 4, gap: 12 }}>
            <SectionHeader title="Browse the park" />
            <View style={styles.tileGrid}>
              {tiles.map((t) => (
                <Touchable key={t.kind} style={styles.tile} scaleTo={1.04} onPress={() => setFilter(t.kind)} accessibilityRole="button" accessibilityLabel={`${KIND_TITLE[t.kind]}, ${t.count}`}>
                  <Cover image={t.image} color={KIND_COLOR[t.kind]} icon={KIND_ICON[t.kind]} height={112} radius={18} />
                  <Text style={[styles.tileTitle, { color: c.text }]} numberOfLines={1}>{TILE_TITLE[t.kind]}</Text>
                  <Text style={[styles.tileCount, { color: c.sub }]}>{t.count} {t.count === 1 ? 'place' : 'places'}</Text>
                </Touchable>
              ))}
            </View>
            <SectionHeader title="Quick links" />
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {QUICK.map((item) => (
                <Card key={item.label} onPress={() => router.push(item.to)} style={styles.quick}>
                  <View style={[styles.quickIcon, { backgroundColor: c.tint }]}>
                    <Icon name={item.icon} color={c.link} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: c.text }]}>{item.label}</Text>
                    <Text style={[styles.rowSub, { color: c.sub }]}>{item.hint}</Text>
                  </View>
                  <Icon name="chevron" color={c.placeholder} size={18} />
                </Card>
              ))}
            </View>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="search" color={c.placeholder} size={34} />
            <Text style={[styles.rowTitle, { color: c.text, marginTop: 10 }]}>{q ? `Nothing found for “${query.trim()}”` : 'Nothing here yet'}</Text>
            <Text style={[styles.rowSub, { color: c.sub, textAlign: 'center' }]}>Try a different word, or another filter.</Text>
          </View>
        ) : (
          grouped.map((g) => (
            <View key={g.kind} style={{ marginTop: 14, gap: 10 }}>
              <SectionHeader title={KIND_TITLE[g.kind]} />
              <View style={{ paddingHorizontal: 20, gap: 12 }}>
                {g.items.map((r, i) => (
                  <Reveal key={r.key} index={i}>
                  <Card onPress={() => router.push(r.to)} style={styles.quick}>
                    <Cover image={r.image} color={KIND_COLOR[r.kind]} icon={KIND_ICON[r.kind]} height={64} width={64} radius={16} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: c.text }]}>{r.title}</Text>
                      <Text numberOfLines={1} style={[styles.rowSub, { color: c.sub }]}>{r.subtitle}</Text>
                    </View>
                    <Icon name="chevron" color={c.placeholder} size={18} />
                  </Card>
                  </Reveal>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chips: { gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  quickIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },
  tile: { width: '47.8%', flexGrow: 1 },
  tileText: { position: 'absolute', left: 12, right: 12, bottom: 10 },
  tileTitle: { fontFamily: serif, color: '#ffffff', fontSize: 16.5, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  tileCount: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 40 },
});
