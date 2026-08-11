import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import Svg, { Path, Circle } from 'react-native-svg';
import { Touchable } from '../components/Touchable';
import { ManagedImage } from '../components/ManagedImage';
import { useAuth } from '../lib/auth';
import { useBrand } from '../lib/brand';
import { useSync } from '../lib/sync';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

const PROFILE_KEY = 'kynren_profile';
const GREEN = '#1f9254';

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a', dim: '#141414' }
    : { screen: '#f6f1e6', card: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border, dim: '#f0e9db' };
}

function Row({ icon, title, sub, onPress, pal }: { icon: string; title: string; sub?: string; onPress: () => void; pal: ReturnType<typeof usePalette> }) {
  return (
    <Touchable style={[styles.row, { backgroundColor: pal.card, borderColor: pal.line }]} onPress={onPress}>
      <View style={[styles.rowIcon, { borderColor: pal.line }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={pal.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          {icon.split('|').map((d, i) => <Path key={i} d={d} />)}
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: pal.text }]}>{title}</Text>
        {sub && <Text style={[styles.rowSub, { color: pal.sub }]}>{sub}</Text>}
      </View>
      <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
    </Touchable>
  );
}

function CheckItem({ text, pal }: { text: string; pal: ReturnType<typeof usePalette> }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkDot}>
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5" /></Svg>
      </View>
      <Text style={[styles.checkTxt, { color: pal.text }]}>{text}</Text>
    </View>
  );
}

// One of the two grid tiles ("My tickets", "My planned day"). Disabled when
// there's nothing behind it yet (not logged in, or no upcoming visit) —
// muted, no chevron, with a caption explaining what unlocks it.
function GridTile({ icon, title, sub, disabled, onPress, pal }: {
  icon: string; title: string; sub?: string; disabled?: boolean; onPress?: () => void; pal: ReturnType<typeof usePalette>;
}) {
  return (
    <Touchable disabled={disabled} onPress={onPress} style={[styles.tile, { backgroundColor: pal.card, borderColor: pal.line }]}>
      <View style={styles.tileTop}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={disabled ? pal.sub : theme.brand} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          {icon.split('|').map((d, i) => <Path key={i} d={d} />)}
        </Svg>
        {!disabled && <Text style={[styles.chev, { color: pal.sub }]}>›</Text>}
      </View>
      <Text style={[styles.tileTitle, { color: disabled ? pal.sub : pal.text }]}>{title}</Text>
      {sub && <Text style={[styles.tileSub, { color: pal.sub }]}>{sub}</Text>}
    </Touchable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { bundle } = useSync();
  const brand = useBrand();
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (!raw) return;
      try { const p = JSON.parse(raw); setPhoto(p.photoUri ?? null); setName([p.firstName, p.lastName].filter(Boolean).join(' ')); } catch { /* ignore */ }
    });
  }, []);

  const displayName = name || user?.name || (user?.email ? user.email.split('@')[0] : '');

  return (
    <View style={{ flex: 1, backgroundColor: pal.screen }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Touchable style={[styles.back, { top: insets.top + 10 }]} onPress={() => router.back()}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
      </Touchable>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 66, paddingHorizontal: 16, paddingBottom: 40 }}>
        {user ? (
          <View style={styles.helloWrap}>
            <View style={[styles.avatar, { borderColor: pal.screen, backgroundColor: pal.card }]}>
              {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <ManagedImage slot="profile.avatar" style={styles.avatarImg} fallback={undefined} />}
              {!photo && <Text style={styles.avatarEmoji}>👤</Text>}
            </View>
            <Text style={[styles.hello, { color: pal.text }]}>Hello{displayName ? `, ${displayName}` : ''}</Text>
            <Text style={[styles.sub, { color: pal.sub }]}>Kynren – The Storied Lands</Text>
          </View>
        ) : (
          <View style={[styles.ctaCard, { backgroundColor: pal.card, borderColor: pal.line }]}>
            {bundle?.branding?.logoUrl ? (
              <Image source={{ uri: bundle.branding.logoUrl }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <>
                <Text style={[styles.wordmark, { color: pal.text }]}>{bundle?.branding?.appName?.toUpperCase() ?? 'KYNREN'}</Text>
                <View style={[styles.wordmarkRule, { backgroundColor: theme.brand }]} />
              </>
            )}

            <Text style={[styles.ctaTitle, { color: pal.text }]}>Your adventure starts here!</Text>
            <Text style={[styles.ctaHead, { color: pal.text }]}>Create a free account</Text>

            <View style={{ marginTop: 12, gap: 9 }}>
              <CheckItem pal={pal} text="Access to a personalised programme" />
              <CheckItem pal={pal} text="Access to your preparation checklist" />
              <CheckItem pal={pal} text="App customisation" />
            </View>

            <View style={styles.socialRow}>
              <View style={styles.avatarCluster}>
                <View style={[styles.miniAvatar, { backgroundColor: '#e2a53b', marginLeft: 0 }]}><Text style={styles.miniAvatarTxt}>🎭</Text></View>
                <View style={[styles.miniAvatar, { backgroundColor: '#3a86c8' }]}><Text style={styles.miniAvatarTxt}>🏰</Text></View>
                <View style={[styles.miniAvatar, { backgroundColor: theme.brand }]}><Text style={styles.miniAvatarTxt}>🎉</Text></View>
              </View>
              <Text style={[styles.socialTxt, { color: pal.sub }]}>Registered guests see on average one more show</Text>
            </View>

            <Touchable style={[styles.primaryBtn, { backgroundColor: brand.primary }]} onPress={() => router.push('/auth')}>
              <Text style={styles.primaryTxt}>Create an account</Text>
            </Touchable>
            <Touchable style={styles.darkBtn} onPress={() => router.push('/auth')}>
              <Text style={styles.darkTxt}>Log in</Text>
            </Touchable>
          </View>
        )}

        {/* Tickets + planned day — a 2-column grid, like a quick-glance dashboard */}
        <View style={styles.grid}>
          <GridTile
            pal={pal}
            icon="M4 7h16v12H4z|M4 11h16|M9 15h2"
            title="My tickets and passes"
            onPress={() => router.push('/orders')}
          />
          <GridTile
            pal={pal}
            icon="M12 8v4l3 2|M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"
            title="My planned day"
            sub={user ? undefined : 'Available with an upcoming visit'}
            disabled={!user}
            onPress={user ? () => router.push('/plan') : undefined}
          />
        </View>

        {/* Preparation checklist — not built yet, shown disabled like the app's
            own "unlock with an upcoming visit" pattern so nothing here over-promises. */}
        <View style={[styles.prepCard, { backgroundColor: pal.card, borderColor: pal.line }]}>
          <Svg width={46} height={46} viewBox="0 0 46 46">
            <Circle cx={23} cy={23} r={19} stroke={pal.line} strokeWidth={4} fill="none" />
          </Svg>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.prepTitle, { color: pal.sub }]}>My preparation checklist</Text>
            <Text style={[styles.prepSub, { color: pal.sub }]}>0 of 5 completed</Text>
            <Text style={[styles.prepCaption, { color: pal.sub }]}>Available with an upcoming visit</Text>
          </View>
          <Text style={[styles.chev, { color: pal.line }]}>›</Text>
        </View>

        <View style={{ gap: 10, marginTop: 18 }}>
          <Row pal={pal} icon="M12 21s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 3.5C19 16.65 12 21 12 21z" title="My favourites" sub="Your saved shows and activities" onPress={() => router.push('/favorites')} />
          <Row pal={pal} icon="M20 6L9 17l-5-5" title="I did it" sub="Everything you've marked as seen" onPress={() => router.push('/seen')} />
          {user && <Row pal={pal} icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.9M4.6 9a1.7 1.7 0 0 0-.3-1.9" title="Account settings" sub="Personal info, accessibility, theme" onPress={() => router.push('/settings')} />}
        </View>

        {user && (
          <Touchable style={[styles.logout, { borderColor: pal.line }]} onPress={async () => { await logout(); router.back(); }}>
            <Text style={[styles.logoutTxt, { color: theme.brand }]}>Log out</Text>
          </Touchable>
        )}

        {/* Build/update footer — lets us confirm which OTA a device is actually
            running (tap to check for a newer one right now). */}
        <VersionFooter pal={pal} />
      </ScrollView>
    </View>
  );
}

function VersionFooter({ pal }: { pal: ReturnType<typeof usePalette> }) {
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const appVersion = Constants.expoConfig?.version ?? '?';
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded';
  const publishedAt = Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : null;

  async function checkNow() {
    setChecking(true);
    setMsg(null);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) { setMsg('You’re on the latest version.'); return; }
      setMsg('Downloading the latest version…');
      await Updates.fetchUpdateAsync();
      setMsg('Updated — restarting…');
      await Updates.reloadAsync();
    } catch {
      setMsg('Couldn’t check for updates (offline?).');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Touchable onPress={checkNow} disabled={checking} style={{ marginTop: 18, alignItems: 'center' }}>
      <Text style={{ color: pal.sub, fontSize: 11 }}>
        v{appVersion} · build {updateId}{publishedAt ? ` · ${publishedAt}` : ''}
      </Text>
      <Text style={{ color: theme.brand, fontSize: 11, fontWeight: '700', marginTop: 3 }}>
        {checking ? 'Checking…' : msg ?? 'Check for updates'}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', left: 14, zIndex: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  helloWrap: { alignItems: 'center', marginBottom: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { position: 'absolute', fontSize: 36 },
  hello: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 2 },

  ctaCard: { borderRadius: 20, padding: 20, borderWidth: 1 },
  wordmark: { fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  wordmarkRule: { height: 3, width: 70, borderRadius: 2, marginTop: 4, marginBottom: 14 },
  logoImg: { height: 34, width: 150, marginBottom: 14 },
  ctaTitle: { fontSize: 26, fontWeight: '800', lineHeight: 31 },
  ctaHead: { fontSize: 16, fontWeight: '700', marginTop: 10 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { fontSize: 14, fontWeight: '700', flex: 1 },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  avatarCluster: { flexDirection: 'row' },
  miniAvatar: { width: 26, height: 26, borderRadius: 13, marginLeft: -8, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  miniAvatarTxt: { fontSize: 12 },
  socialTxt: { fontSize: 12, flex: 1, fontWeight: '600' },

  primaryBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  darkBtn: { backgroundColor: '#171717', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  darkTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  grid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileTitle: { fontSize: 15, fontWeight: '800', marginTop: 12 },
  tileSub: { fontSize: 11, fontWeight: '600', marginTop: 4, lineHeight: 15 },

  prepCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 10 },
  prepTitle: { fontSize: 15, fontWeight: '800' },
  prepSub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  prepCaption: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, padding: 14, borderWidth: 1 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2 },
  chev: { fontSize: 24, marginLeft: 6 },
  logout: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  logoutTxt: { fontWeight: '800', fontSize: 15 },
});
