import { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ResizeMode, Video } from 'expo-av';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { Touchable } from '../../components/Touchable';
import { ManagedImage, useHasSlotImage } from '../../components/ManagedImage';
import { GradientFill } from '../../components/ui/Gradient';
import { PageBackdrop } from '../../components/ui/PageBackdrop';
import { SkeletonRows } from '../../components/Shimmer';
import { Card, SearchPill, SectionHeader } from '../../components/ui/Controls';
import { Button } from '../../components/ui/Button';
import { Cover } from '../../components/ui/Cover';
import { Reveal } from '../../components/ui/Reveal';
import { Icon, type IconName } from '../../components/ui/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useHomeViews, type HomeView } from '../../lib/preferences';
import { useFavoriteIds } from '../../lib/favorites';
import { fmtTime, ukNow, ukTodayStr } from '../../lib/format';
import { useSync, type Session } from '../../lib/sync';
import { serif, band, categoryColor, featureGradient, statusColor, theme } from '../../lib/theme';
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
  const { views, setView } = useHomeViews();

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
  const attractionImage = bundle?.attractions?.find((a) => a.category !== 'EVENING_SHOW' && a.heroImage)?.heroImage ?? null;
  const shopImage = bundle?.shops?.find((x) => x.heroImage)?.heroImage ?? null;
  const imageById = useMemo(() => new Map((bundle?.attractions ?? []).map((a) => [a.id, a.heroImage ?? null])), [bundle]);
  const promoWidth = Math.min(268, Math.round(width * 0.72));

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
            {user ? (
              <PromoCard width={promoWidth} image={showImage} icon="ticket" title="My tickets" text="Your QR codes and bookings, ready for the gate." action="Open" onPress={go('/(tabs)/tickets')} c={c} />
            ) : (
              <PromoCard width={promoWidth} image={showImage} icon="user" title="Your tickets" text="Sign in to bring your bookings into the app, with reminders before each show." action="Sign in" onPress={go('/auth')} c={c} />
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
            <View style={styles.tileGrid}>
              <ServiceTile c={c} title="Shows" text={upcoming.length ? `${upcoming.length} coming up today` : 'The full programme'} image={showImage} color={featureGradient.programme.from} icon="calendar" onPress={go('/(tabs)/shows')} />
              <ServiceTile c={c} title="Attractions" text="Find your way around" image={attractionImage} color={theme.brand} icon="pin" onPress={go('/(tabs)/map')} />
              <ServiceTile c={c} title="Restaurants" text="Menus and order ahead" image={foodImage} color={featureGradient.restaurants.from} icon="fork" onPress={go('/(tabs)/food')} />
              <ServiceTile c={c} title="Shops" text="Gifts and souvenirs" image={shopImage} color="#4b5d73" icon="shop" onPress={go({ pathname: '/(tabs)/search', params: { filter: 'shop' } })} />
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
            <SectionHeader title="Coming up" action="See All" onAction={go('/(tabs)/shows')} right={<ViewToggle view={views.comingUp} onChange={(v) => setView('comingUp', v)} c={c} />} />
            {!bundle ? (
              <View style={{ paddingHorizontal: 20 }}><SkeletonRows count={3} height={62} /></View>
            ) : upcoming.length === 0 ? (
              <Text style={{ color: c.sub, fontSize: 13, paddingHorizontal: 20 }}>No more shows today.</Text>
            ) : (
              views.comingUp === 'list' ? (
                <View style={styles.listCol}>
                  {upcoming.map((s) => <ShowRow key={s.id} session={s} image={imageById.get(s.attraction.id) ?? null} c={c} onPress={go(`/attraction/${s.attraction.slug}`)} />)}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {upcoming.map((s) => <ShowCard c={c} key={s.id} session={s} image={imageById.get(s.attraction.id) ?? null} onPress={go(`/attraction/${s.attraction.slug}`)} />)}
                </ScrollView>
              )
            )}
          </View>
        );
      case 'favourites':
        // Signed-out guests have no favourites to show, and there's nothing
        // useful to say to them here (the section isn't a sign-in prompt) —
        // hide it entirely rather than show an empty state, matching how
        // 'announcement'/'alerts' behave when they have nothing to show.
        return favouriteUpcoming.length > 0 ? (
          <View key={key} style={{ marginTop: 26, gap: 12 }}>
            <SectionHeader title="Your favourites" action="See All" onAction={go('/favorites')} right={<ViewToggle view={views.favourites} onChange={(v) => setView('favourites', v)} c={c} />} />
            {views.favourites === 'list' ? (
              <View style={styles.listCol}>
                {favouriteUpcoming.map((s) => <ShowRow key={s.id} session={s} image={imageById.get(s.attraction.id) ?? null} c={c} onPress={go(`/attraction/${s.attraction.slug}`)} />)}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                {favouriteUpcoming.map((s) => <ShowCard c={c} key={s.id} session={s} image={imageById.get(s.attraction.id) ?? null} onPress={go(`/attraction/${s.attraction.slug}`)} />)}
              </ScrollView>
            )}
          </View>
        ) : null;
      default:
        return null;
    }
  };

  const bandHeight = insets.top + 270;

  // The menu and bell stay fixed at the top; their green band fades in once the guest scrolls past the picture.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const barFill = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [40, 140], [0, 1], Extrapolation.CLAMP) }));
  const hasBarPicture = useHasSlotImage('header.home');

  return (
    <View style={{ flex: 1, backgroundColor: c.screen }}>
      <PageBackdrop page="home" />
      <Reanimated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
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

          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <View style={styles.searchWrap}>
          <SearchPill placeholder="Find everything here" onPress={go('/(tabs)/search')} />
        </View>

        {sectionOrder.map((key, i) => {
          const section = renderSection(key);
          return section ? <Reveal key={key} index={i}>{section}</Reveal> : null;
        })}
      </Reanimated.ScrollView>

      {/* The bar that stays at the top while the page scrolls */}
      <View style={[styles.stickyBar, { height: insets.top + 56, paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <Reanimated.View style={[StyleSheet.absoluteFill, styles.stickyFill, barFill]} pointerEvents="none">
          <GradientFill from={band.from} to={band.to} vertical />
          {hasBarPicture ? (
            <>
              <ManagedImage slot="header.home" style={StyleSheet.absoluteFill} fadeColor={band.to} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.32)' }]} />
            </>
          ) : null}
        </Reanimated.View>
        <View style={styles.stickyRow} pointerEvents="box-none">
          <Touchable style={styles.topSide} onPress={go('/menu')} accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={16}>
            <Icon name="menu" color="#ffffff" size={26} />
          </Touchable>
          <Touchable style={[styles.topSide, { alignItems: 'flex-end' }]} onPress={go('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={16}>
            <Icon name="bell" color="#ffffff" size={24} />
          </Touchable>
        </View>
      </View>
    </View>
  );
}

function PromoCard({ width, image, icon, title, text, action, onPress, c }: { width: number; image: string | null; icon: IconName; title: string; text: string; action: string; onPress: () => void; c: UIColors }) {
  const color = icon === 'ticket' ? featureGradient.tickets.to : icon === 'fork' ? featureGradient.restaurants.from : theme.brand;
  return (
    <Card style={{ width }}>
      <Touchable onPress={onPress} scaleTo={1.04} accessibilityRole="button" accessibilityLabel={title}>
        <Cover image={image} color={color} icon={icon} height={168} />
      </Touchable>
      <View style={styles.promoText}>
        <Text style={[styles.promoHead, { color: c.text }]}>{title}</Text>
        <Text numberOfLines={3} style={[styles.promoCopy, { color: c.sub }]}>{text}</Text>
        <Button size="sm" label={action} onPress={onPress} style={{ marginTop: 12 }} />
      </View>
    </Card>
  );
}

/** A photo tile for one of the park's services: the picture on its own, with its name and what is there underneath. */
function ServiceTile({ title, text, image, color, icon, onPress, c }: { title: string; text: string; image: string | null; color: string; icon: IconName; onPress: () => void; c: UIColors }) {
  return (
    <Touchable style={styles.tile} onPress={onPress} scaleTo={1.04} accessibilityRole="button" accessibilityLabel={title}>
      <Cover image={image} color={color} icon={icon} height={112} radius={18} />
      <Text style={[styles.tileHead, { color: c.text }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.tileCopy, { color: c.sub }]} numberOfLines={1}>{text}</Text>
    </Touchable>
  );
}

/** Cards or a list: the guest's choice for how Home shows upcoming shows. */
function ViewToggle({ view, onChange, c }: { view: HomeView; onChange: (v: HomeView) => void; c: UIColors }) {
  const option = (value: HomeView, icon: IconName, label: string) => {
    const on = view === value;
    return (
      <Touchable
        key={value}
        onPress={() => onChange(value)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        style={[styles.toggleBtn, { backgroundColor: on ? c.primary : 'transparent' }]}
      >
        <Icon name={icon} color={on ? '#ffffff' : c.link} size={17} />
      </Touchable>
    );
  };
  return <View style={[styles.toggle, { backgroundColor: c.tint }]}>{option('cards', 'grid', 'Show as cards')}{option('list', 'list', 'Show as a list')}</View>;
}

/** The list version of a coming-up show: a small picture, the name and the start time. */
function ShowRow({ session, image, c, onPress }: { session: Session; image: string | null; c: UIColors; onPress: () => void }) {
  const live = session.status !== 'SCHEDULED';
  return (
    <Card onPress={onPress} style={styles.showRow}>
      <Cover image={image} color={categoryColor[session.attraction.category] ?? theme.brand} icon="calendar" height={60} width={60} radius={14} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: c.text }]} numberOfLines={2}>{session.attraction.name}</Text>
        <View style={styles.listTime}><Text style={styles.listTimeTxt}>{fmtTime(session.revisedStart ?? session.startTime)}</Text></View>
      </View>
      {live && (
        <View style={[styles.badge, { backgroundColor: statusColor[session.status] }]}>
          <Text style={styles.badgeText}>{session.status}</Text>
        </View>
      )}
      <Icon name="chevron" color={c.placeholder} size={18} />
    </Card>
  );
}

/** A show that is coming up: its picture on its own, then the start time and the name underneath. */
function ShowCard({ session, image, onPress, c }: { session: Session; image: string | null; onPress: () => void; c: UIColors }) {
  const live = session.status !== 'SCHEDULED';
  return (
    <Touchable style={{ width: 168 }} onPress={onPress} scaleTo={1.04} accessibilityRole="button" accessibilityLabel={`${session.attraction.name}, ${fmtTime(session.revisedStart ?? session.startTime)}`}>
      <Cover image={image} color={categoryColor[session.attraction.category] ?? theme.brand} icon="calendar" height={150} radius={18} />
      <View style={styles.showMeta}>
        <View style={styles.listTime}><Text style={styles.listTimeTxt}>{fmtTime(session.revisedStart ?? session.startTime)}</Text></View>
        {live && <Text style={[styles.showStatusTxt2, { color: statusColor[session.status] }]}>{session.status}</Text>}
      </View>
      <Text style={[styles.showHead, { color: c.text }]} numberOfLines={2}>{session.attraction.name}</Text>
    </Touchable>
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
  promoBody: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  promoTitle2: { fontFamily: serif, color: '#ffffff', fontSize: 22, fontWeight: '700', lineHeight: 26, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6 },
  promoSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  promoBtn: { alignSelf: 'flex-start', backgroundColor: '#fbf6ec', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12 },
  promoBtnTxt: { color: '#2f5b43', fontWeight: '800', fontSize: 13.5 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },
  tile: { width: '47.8%', flexGrow: 1 },
  tileText: { position: 'absolute', left: 12, right: 12, bottom: 10 },
  tileTitle: { fontFamily: serif, color: '#ffffff', fontSize: 15, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  tileSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  cardRow: { gap: 12, paddingHorizontal: 20 },
  promoText: { padding: 14, paddingTop: 12 },
  promoHead: { fontFamily: serif, fontSize: 19, fontWeight: '700' },
  promoCopy: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  tileHead: { fontFamily: serif, fontSize: 15, fontWeight: '700', marginTop: 8 },
  tileCopy: { fontSize: 12, marginTop: 1 },
  showMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  showStatusTxt2: { fontSize: 11.5, fontWeight: '800' },
  showHead: { fontFamily: serif, fontSize: 15.5, fontWeight: '700', lineHeight: 20, marginTop: 5 },
  listCol: { paddingHorizontal: 20, gap: 10 },
  showRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  listTime: { alignSelf: 'flex-start', backgroundColor: '#e8861a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 5 },
  listTimeTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12.5 },
  toggle: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  toggleBtn: { width: 32, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  showTime: { position: 'absolute', top: 10, left: 10, backgroundColor: '#e8861a', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  showTimeTxt: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  showStatus: { position: 'absolute', top: 10, right: 10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  showStatusTxt: { color: '#ffffff', fontWeight: '800', fontSize: 10.5 },
  showName: { position: 'absolute', left: 12, right: 12, bottom: 12, fontFamily: serif, color: '#ffffff', fontSize: 16, fontWeight: '700', lineHeight: 19, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 5 },
  band: { overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, backgroundColor: band.to },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, elevation: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  topSide: { width: 48, height: 48, justifyContent: 'center' },
  stickyBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  stickyFill: { overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  stickyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  topTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  tagline: { fontFamily: serif, position: 'absolute', left: 22, right: 22, bottom: 46, color: '#ffffff', fontSize: 28, fontWeight: '800', lineHeight: 32, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  searchWrap: { marginTop: 18, paddingHorizontal: 20, zIndex: 3 },
  welcome: { paddingHorizontal: 22, marginTop: 24 },
  welcomeH: { fontFamily: serif, fontSize: 21, fontWeight: '800' },
  welcomeSub: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  welcomeTxt: { flex: 1, fontSize: 14.5, lineHeight: 21 },
  promoRow: { gap: 14, paddingHorizontal: 20, paddingBottom: 18 },
  promoImage: { height: 120, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  promoTitle: { fontSize: 17, fontWeight: '800', marginTop: 12, paddingHorizontal: 4 },
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
