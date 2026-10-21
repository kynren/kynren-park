import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Touchable } from '../../components/Touchable';
import { Card, Chip, SearchPill, SectionHeader } from '../../components/ui/Controls';
import { ScreenHeader } from '../../components/ui/Header';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useSync } from '../../lib/sync';
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
const KIND_TITLE: Record<Kind, string> = { show: 'Shows & attractions', food: 'Food & drink', shop: 'Shops', facility: 'Facilities' };

const FACILITY_LABEL: Record<string, string> = {
  RESTROOM: 'Toilets', FIRST_AID: 'First aid', PARKING: 'Parking', ACCESSIBILITY: 'Accessibility',
  BABY_CHANGING: 'Baby changing', PICNIC: 'Picnic area', ENTRANCE: 'Entrance', INFO: 'Information',
};

const QUICK: { label: string; hint: string; icon: IconName; to: Href }[] = [
  { label: 'Buy tickets', hint: 'Book your visit', icon: 'ticket', to: '/book' },
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

  const grouped = (['show', 'food', 'shop', 'facility'] as Kind[]).map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) })).filter((g) => g.items.length);

  return (
    <View style={[styles.screen, { backgroundColor: c.screen }]}>
      <ScreenHeader title="Search">
        <SearchPill placeholder="Find everything here" value={query} onChangeText={setQuery} />
      </ScreenHeader>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>

        {browsing ? (
          <View style={{ marginTop: 8, gap: 12 }}>
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
                {g.items.map((r) => (
                  <Card key={r.key} onPress={() => router.push(r.to)} style={styles.quick}>
                    {r.image ? (
                      <Image source={{ uri: r.image }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
                    ) : (
                      <View style={[styles.thumb, { backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }]}>
                        <Icon name={KIND_ICON[r.kind]} color={c.link} size={22} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: c.text }]}>{r.title}</Text>
                      <Text numberOfLines={1} style={[styles.rowSub, { color: c.sub }]}>{r.subtitle}</Text>
                    </View>
                    <Icon name="chevron" color={c.placeholder} size={18} />
                  </Card>
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
  thumb: { width: 56, height: 56, borderRadius: 16 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 40 },
});
