import { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { Touchable } from '../../components/Touchable';
import { SkeletonRows } from '../../components/Shimmer';
import { Card, SearchPill, SectionHeader } from '../../components/ui/Controls';
import { Button } from '../../components/ui/Button';
import { GradientFill } from '../../components/ui/Gradient';
import { Icon, type IconName } from '../../components/ui/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFavoriteIds } from '../../lib/favorites';
import { fmtTime, ukNow, ukTodayStr } from '../../lib/format';
import { useSync, type Session } from '../../lib/sync';
import { serif, band, categoryColor, statusColor, theme } from '../../lib/theme';
import { useUI, type UIColors } from '../../lib/ui';

// Open-Meteo WMO weather codes, grouped to a small icon set.
const WEATHER_ICON: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

interface WeatherResponse {
  current?: { temperature_2m?: number; weather_code?: number };
}

// What the Home screen shows when no layout has been saved in admin. A saved layout is honoured as it is; the sections
// it does not mention ('info', 'services') are added at the end, since an older layout predates them.
const DEFAULT_SECTIONS = ['welcome', 'actions', 'info', 'services', 'announcement', 'alerts', 'visit', 'comingUp', 'favourites'];
const NEW_SECTIONS = ['info', 'services'];

export default function HomeScreen() {
  const { bundle, date, refresh } = useSync();
  const router = useRouter();
  const { c } = useUI();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);

  // Re-check which sessions have finished once a minute, so a show drops off
  // "Coming up" on its own while the guest is sitting on this screen — the
  // bundle itself only refetches on a real sync/socket patch, not just
  // because time passed, so without this a finished show could sit here
  // until the next unrelated refresh.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  useEffect(() => {
    api<WeatherResponse>('/weather').then(setWeather).catch(() => undefined);
  }, []);

  const upcoming = useMemo(() => {
    const sessions = bundle?.sessions ?? [];
    const isRealToday = date === ukTodayStr();
    const reference = isRealToday ? ukNow().getTime() : new Date(`${date}T00:00:00.000Z`).getTime();
    return sessions
      .filter((s) => new Date(s.endTime).getTime() > reference)
      .sort((a, b) => new Date(a.revisedStart ?? a.startTime).getTime() - new Date(b.revisedStart ?? b.startTime).getTime())
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, date, tick]);
  const alerts = (bundle?.sessions ?? []).filter((s) => s.status === 'DELAYED' || s.status === 'CANCELLED');

  // "Your favourites" — the soonest still-to-come session for each show the
  // guest has starred, one row per attraction (not per session). Reuses the
  // same server-backed favourites source as the map's Favourites filter and
  // Profile → My favourites.
  const { ids: favIds } = useFavoriteIds();
  const favouriteUpcoming = useMemo(() => {
    if (favIds.size === 0) return [];
    const isRealToday = date === ukTodayStr();
    const reference = isRealToday ? ukNow().getTime() : new Date(`${date}T00:00:00.000Z`).getTime();
    const soonestByAttraction = new Map<string, Session>();
    for (const s of bundle?.sessions ?? []) {
      if (!favIds.has(s.attraction.id)) continue;
      if (new Date(s.endTime).getTime() <= reference) continue;
      const cur = soonestByAttraction.get(s.attraction.id);
      const t = (x: Session) => new Date(x.revisedStart ?? x.startTime).getTime();
      if (!cur || t(s) < t(cur)) soonestByAttraction.set(s.attraction.id, s);
    }
    return [...soonestByAttraction.values()].sort(
      (a, b) => new Date(a.revisedStart ?? a.startTime).getTime() - new Date(b.revisedStart ?? b.startTime).getTime(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, date, tick, favIds]);

  const hours = useMemo(() => {
    const ss = bundle?.sessions ?? [];
    if (!ss.length) return null;
    let loI = ss[0]!.startTime, hiI = ss[0]!.endTime;
    for (const s of ss) {
      if (new Date(s.startTime) < new Date(loI)) loI = s.startTime;
      if (new Date(s.endTime) > new Date(hiI)) hiI = s.endTime;
    }
    return { open: fmtTime(loI), close: fmtTime(hiI) };
  }, [bundle]);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // Admin-designed home screen (published default), if any.
  const home = bundle?.home ?? null;
  const tagline = home?.tagline || 'An epic tale\nof England';
  const greeting = home?.greeting || 'Welcome';
  const saved = home?.sections?.length ? home.sections : null;
  const sectionOrder = saved
    ? [...saved.filter((s) => s.visible).map((s) => s.key), ...NEW_SECTIONS.filter((k) => !saved.some((s) => s.key === k))]
    : DEFAULT_SECTIONS;

  // Pictures for the promo cards come from the park's own content, so they stay current.
  const showImage = bundle?.attractions?.find((a) => a.category === 'EVENING_SHOW' && a.heroImage)?.heroImage ?? null;
  const foodImage = bundle?.restaurants?.find((r) => r.heroImage)?.heroImage ?? null;
  const promoWidth = Math.min(236, Math.round(width * 0.64));

  const go = (to: Href) => () => router.push(to);

  const renderSection = (key: string) => {
    switch (key) {
      case 'welcome':
        return (
          <View style={styles.welcome} key={key}>
            <Text style={[styles.welcomeH, { color: c.text }]}>{greeting}</Text>
            <View style={styles.welcomeSub}>
              <View style={[styles.dot, { backgroundColor: home?.accentColor || c.ok }]} />
              <Text style={[styles.welcomeTxt, { color: c.sub }]}>
                {home?.greetingSub
                  ? home.greetingSub
                  : hours ? `Today, the park will be open from ${hours.open} to ${hours.close}` : 'Plan your day at Kynren – The Storied Lands'}
              </Text>
            </View>
          </View>
        );
      case 'actions':
        return (
          <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoRow} style={{ marginTop: 22 }}>
            <PromoCard width={promoWidth} image={showImage} icon="ticket" title="Buy tickets" text="Book your visit to the park and pick your night." action="Buy now" onPress={go('/book')} c={c} />
            {user ? (
              <PromoCard width={promoWidth} image={null} icon="ticket" title="My tickets" text="Your QR codes and bookings, ready for the gate." action="Open" onPress={go('/(tabs)/tickets')} c={c} />
            ) : (
              <PromoCard width={promoWidth} image={null} icon="user" title="Your account" text="Hold your tickets and get reminders before each show." action="Create account" onPress={go('/auth')} c={c} />
            )}
            <PromoCard width={promoWidth} image={foodImage} icon="fork" title="Order food" text="Order ahead and collect without the queue." action="Order now" onPress={go('/(tabs)/food')} c={c} />
          </ScrollView>
        );
      case 'info':
        return (
          <View style={styles.infoRow} key={key}>
            <InfoTile c={c} label={weather?.current?.temperature_2m != null ? `${Math.round(weather.current.temperature_2m)}°C` : 'Weather'} emoji={WEATHER_ICON[weather?.current?.weather_code ?? 0] ?? '🌤️'} />
            <InfoTile c={c} label="Shuttle" icon="bus" onPress={go('/shuttle')} />
            <InfoTile c={c} label="Access" icon="access" onPress={go('/accessibility')} />
          </View>
        );
      case 'services':
        return (
          <View key={key} style={{ marginTop: 26, gap: 12 }}>
            <SectionHeader title="Theme park services" />
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <ServiceRow c={c} title="Shows" text={upcoming.length ? `${upcoming.length} coming up today` : 'The full programme'} onPress={go('/(tabs)/shows')} />
              <ServiceRow c={c} title="Attractions" text="Find your way around the park" onPress={go('/(tabs)/map')} />
              <ServiceRow c={c} title="Restaurants" text="Menus, and order ahead" onPress={go('/(tabs)/food')} />
              <ServiceRow c={c} title="Shops" text="Gifts and souvenirs" onPress={go({ pathname: '/(tabs)/search', params: { filter: 'shop' } })} />
            </View>
          </View>
        );
      case 'visit':
        return (
          <Card key={key} onPress={go('/(tabs)/plan')} style={[styles.wide, { marginTop: 22 }]}>
            <View style={[styles.round, { backgroundColor: c.tint }]}>
              <Icon name="calendar" color={c.link} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, { color: c.text }]}>Plan your perfect visit</Text>
              <Text style={[styles.rowSub, { color: c.sub }]}>Pick the shows you don’t want to miss</Text>
            </View>
            <Icon name="chevron" color={c.placeholder} size={20} />
          </Card>
        );
      case 'announcement':
        return bundle?.announcements?.[0] ? (
          <Card key={key} style={[styles.wide, { marginTop: 22, alignItems: 'flex-start' }]}>
            <View style={[styles.round, { backgroundColor: c.tint }]}>
              <Icon name="bell" color={c.link} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, { color: c.text }]}>{bundle.announcements[0].title}</Text>
              <Text style={[styles.rowSub, { color: c.sub }]}>{bundle.announcements[0].body}</Text>
            </View>
          </Card>
        ) : null;
      case 'alerts':
        return alerts.length > 0 ? (
          <View key={key} style={{ marginTop: 26, gap: 12 }}>
            <SectionHeader title="Today’s changes" />
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {alerts.map((s) => (
                <Card key={s.id} style={[styles.alert, { borderLeftColor: statusColor[s.status] }]}>
                  <Text style={[styles.rowName, { color: c.text }]}>{s.attraction.name}</Text>
                  <Text style={[styles.rowSub, { color: c.sub }]}>
                    {s.status === 'CANCELLED' ? 'Cancelled' : `Delayed to ${fmtTime(s.revisedStart ?? s.startTime)}`}
                    {s.note ? ` · ${s.note}` : ''}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        ) : null;
      case 'comingUp':
        return (
          <View key={key} style={{ marginTop: 26, gap: 12 }}>
            <SectionHeader title="Coming up" action="See All" onAction={go('/(tabs)/shows')} />
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {!bundle ? (
                <SkeletonRows count={5} height={62} />
              ) : upcoming.length === 0 ? (
                <Text style={{ color: c.sub, fontSize: 13 }}>No more shows today.</Text>
              ) : (
                upcoming.map((s) => <SessionRow key={s.id} session={s} c={c} onPress={go(`/attraction/${s.attraction.slug}`)} />)
              )}
            </View>
          </View>
        );
      case 'favourites':
        // Signed-out guests have no favourites to show, and there's nothing
        // useful to say to them here (the section isn't a sign-in prompt) —
        // hide it entirely rather than show an empty state, matching how
        // 'announcement'/'alerts' behave when they have nothing to show.
        return favouriteUpcoming.length > 0 ? (
          <View key={key} style={{ marginTop: 26, gap: 12 }}>
            <SectionHeader title="Your favourites" action="See All" onAction={go('/favorites')} />
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {favouriteUpcoming.map((s) => <SessionRow key={s.id} session={s} c={c} onPress={go(`/attraction/${s.attraction.slug}`)} />)}
            </View>
          </View>
        ) : null;
      default:
        return null;
    }
  };

  const bandHeight = insets.top + 270;

  return (
    <View style={{ flex: 1, backgroundColor: c.screen }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.sub} />}
      >
        {/* The sky band: admin media (image / GIF / video) or the built-in illustration, under the menu bar */}
        <View style={{ height: bandHeight }}>
          <View style={[StyleSheet.absoluteFill, styles.band]}>
            {home && home.heroType !== 'none' && home.heroMediaUrl ? (
              home.heroType === 'video' ? (
                <Video source={{ uri: home.heroMediaUrl }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isMuted isLooping />
              ) : (
                <Image source={{ uri: home.heroMediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              )
            ) : (
              <HeroArt />
            )}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
              <Defs>
                <LinearGradient id="bandTop" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={band.from} stopOpacity="0.9" />
                  <Stop offset="0.5" stopColor={band.from} stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id="bandBottom" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.5" stopColor="#1a120a" stopOpacity="0" />
                  <Stop offset="1" stopColor="#1a120a" stopOpacity="0.6" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#bandTop)" />
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#bandBottom)" />
            </Svg>
          </View>

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Touchable style={styles.topSide} onPress={go('/menu')} accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={10}>
              <Icon name="menu" color="#ffffff" size={26} />
            </Touchable>
            <Text accessibilityRole="header" style={styles.topTitle}>HOME</Text>
            <Touchable style={[styles.topSide, { alignItems: 'flex-end' }]} onPress={go('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={10}>
              <Icon name="bell" color="#ffffff" size={24} />
            </Touchable>
          </View>

          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <View style={styles.searchWrap}>
          <SearchPill placeholder="Find everything here" onPress={go('/(tabs)/search')} />
        </View>

        {sectionOrder.map((key) => renderSection(key))}
      </ScrollView>
    </View>
  );
}

function PromoCard({ width, image, icon, title, text, action, onPress, c }: { width: number; image: string | null; icon: IconName; title: string; text: string; action: string; onPress: () => void; c: UIColors }) {
  return (
    <Card style={{ width, padding: 10 }}>
      <View style={[styles.promoImage, { backgroundColor: c.tint }]}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <>
            <GradientFill from={band.from} to={band.to} vertical />
            <Icon name={icon} color="#ffffff" size={46} strokeWidth={1.5} />
          </>
        )}
      </View>
      <Text style={[styles.promoTitle, { color: c.link }]}>{title}</Text>
      <Text numberOfLines={3} style={[styles.promoText, { color: c.sub }]}>{text}</Text>
      <Button size="sm" label={action} onPress={onPress} style={{ marginTop: 12 }} />
    </Card>
  );
}

function InfoTile({ c, label, icon, emoji, onPress }: { c: UIColors; label: string; icon?: IconName; emoji?: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={styles.info}>
      <View style={styles.infoIcon}>{emoji ? <Text style={{ fontSize: 22 }}>{emoji}</Text> : icon ? <Icon name={icon} color={c.link} size={22} /> : null}</View>
      <Text style={[styles.infoText, { color: c.text }]}>{label}</Text>
    </Card>
  );
}

function ServiceRow({ c, title, text, onPress }: { c: UIColors; title: string; text: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.service}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: c.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: c.sub }]}>{text}</Text>
      </View>
      <View style={[styles.more, { backgroundColor: c.tint }]}>
        <Text style={[styles.moreText, { color: c.link }]}>See More</Text>
      </View>
    </Card>
  );
}

function SessionRow({ session, c, onPress }: { session: Session; c: UIColors; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.session}>
      <View style={[styles.cat, { backgroundColor: categoryColor[session.attraction.category] ?? theme.muted }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: c.text }]}>{session.attraction.name}</Text>
        <Text style={[styles.rowSub, { color: c.sub }]}>{fmtTime(session.revisedStart ?? session.startTime)}</Text>
      </View>
      {session.status !== 'SCHEDULED' && (
        <View style={[styles.badge, { backgroundColor: statusColor[session.status] }]}>
          <Text style={styles.badgeText}>{session.status}</Text>
        </View>
      )}
    </Card>
  );
}

/** Stylised golden-hour hero: sky, sun, hills and the Kynren keep. */
function HeroArt() {
  const W = 375, H = 300;
  const KX = W * 0.72;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2c4a5e" />
          <Stop offset="0.55" stopColor="#d9915a" />
          <Stop offset="1" stopColor="#f3d9a4" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={W} height={H} fill="url(#sky)" />

      <Circle cx="300" cy="86" r="44" fill="#fff1c7" opacity={0.3} />
      <Circle cx="300" cy="86" r="28" fill="#fff1c7" opacity={0.95} />

      <Path d={`M30 70 q10 -14 26 -8 q8 -12 24 -4 q16 0 16 12 z`} fill="#f7e3c2" opacity={0.75} />
      <Path d={`M150 40 q10 -12 24 -6 q8 -10 22 -2 q14 0 14 10 z`} fill="#f7e3c2" opacity={0.6} />

      <Path d={`M0 ${H * 0.66} C 90 ${H * 0.58}, 150 ${H * 0.7}, 230 ${H * 0.64} S 340 ${H * 0.6}, ${W} ${H * 0.66} L ${W} ${H} L 0 ${H} Z`} fill="#4a7a52" />
      <Path d={`M0 ${H * 0.76} C 110 ${H * 0.68}, 200 ${H * 0.8}, 300 ${H * 0.73} S ${W} ${H * 0.75}, ${W} ${H * 0.77} L ${W} ${H} L 0 ${H} Z`} fill="#2f5a3a" />

      <G fill="#2a2118">
        <Rect x={KX - 40} y={H * 0.5} width={80} height={H * 0.5} />
        <Rect x={KX - 62} y={H * 0.58} width={24} height={H * 0.42} />
        <Rect x={KX + 38} y={H * 0.58} width={24} height={H * 0.42} />
        {[-62, -52, -42, -12, -2, 8, 38, 48, 58].map((dx, i) => (
          <Rect key={i} x={KX + dx} y={H * 0.5 - 7} width={7} height={9} />
        ))}
        <Polygon points={`${KX},${H * 0.4} ${KX - 14},${H * 0.5} ${KX + 14},${H * 0.5}`} />
      </G>
      <Polygon points={`${KX},${H * 0.4} ${KX},${H * 0.33} ${KX + 15},${H * 0.355}`} fill="#8a1f31" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  band: { overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, backgroundColor: band.to },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  topSide: { width: 44, height: 44, justifyContent: 'center' },
  topTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  tagline: { fontFamily: serif, position: 'absolute', left: 22, right: 22, bottom: 46, color: '#ffffff', fontSize: 32, fontWeight: '800', lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  searchWrap: { marginTop: -27, paddingHorizontal: 20, zIndex: 3 },
  welcome: { paddingHorizontal: 22, marginTop: 24 },
  welcomeH: { fontFamily: serif, fontSize: 24, fontWeight: '800' },
  welcomeSub: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  welcomeTxt: { flex: 1, fontSize: 14.5, lineHeight: 21 },
  promoRow: { gap: 14, paddingHorizontal: 20, paddingBottom: 18 },
  promoImage: { height: 120, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  promoTitle: { fontSize: 17, fontWeight: '800', marginTop: 12, paddingHorizontal: 4 },
  promoText: { fontSize: 12, lineHeight: 17, marginTop: 4, paddingHorizontal: 4, minHeight: 51 },
  infoRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 4 },
  infoIcon: { height: 28, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16 },
  infoText: { fontSize: 12.5, fontWeight: '700' },
  service: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18 },
  more: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  moreText: { fontSize: 12.5, fontWeight: '700' },
  wide: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, padding: 16 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15.5, fontWeight: '800' },
  rowSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  alert: { borderLeftWidth: 5, padding: 14 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  cat: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
