import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from '../components/Touchable';
import { ManagedImage } from '../components/ManagedImage';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

const PROFILE_KEY = 'kynren_profile';

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a' }
    : { screen: theme.bg, card: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border };
}

function Row({ icon, title, sub, onPress, pal }: { icon: string; title: string; sub?: string; onPress: () => void; pal: ReturnType<typeof usePalette> }) {
  return (
    <Touchable style={[styles.row, { backgroundColor: pal.card, borderColor: pal.line }]} onPress={onPress}>
      <View style={[styles.rowIcon, { borderColor: pal.line }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={pal.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d={icon} /></Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: pal.text }]}>{title}</Text>
        {sub && <Text style={[styles.rowSub, { color: pal.sub }]}>{sub}</Text>}
      </View>
      <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
    </Touchable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header banner (admin-managed) with the avatar overlapping */}
        <View style={{ height: 190 }}>
          <ManagedImage slot="profile.header" style={StyleSheet.absoluteFill} fadeColor={pal.screen} />
          <Touchable style={[styles.back, { top: insets.top + 8 }]} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
          </Touchable>
        </View>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { borderColor: pal.screen, backgroundColor: pal.card }]}>
            {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <ManagedImage slot="profile.avatar" style={styles.avatarImg} fallback={undefined} />}
            {!photo && <Text style={styles.avatarEmoji}>👤</Text>}
          </View>
        </View>

        <View style={styles.pad}>
          {user ? (
            <>
              <Text style={[styles.hello, { color: pal.text }]}>Hello{displayName ? `, ${displayName}` : ''}</Text>
              <Text style={[styles.sub, { color: pal.sub }]}>Kynren – The Storied Lands</Text>
            </>
          ) : (
            <View style={[styles.ctaCard, { backgroundColor: pal.card, borderColor: pal.line }]}>
              <Text style={[styles.ctaTitle, { color: pal.text }]}>Your adventure starts here!</Text>
              <Text style={[styles.sub, { color: pal.sub, marginBottom: 14 }]}>Create a free account for a personalised programme and preparation checklist.</Text>
              <Touchable style={styles.primaryBtn} onPress={() => router.push('/auth')}><Text style={styles.primaryTxt}>Create an account</Text></Touchable>
              <Touchable style={[styles.darkBtn]} onPress={() => router.push('/auth')}><Text style={styles.darkTxt}>Log in</Text></Touchable>
            </View>
          )}

          <View style={{ gap: 10, marginTop: 18 }}>
            <Row pal={pal} icon="M4 7h16v12H4z|M4 11h16|M9 15h2" title="My tickets & passes" sub="Your booked tickets and QR codes" onPress={() => router.push('/orders')} />
            <Row pal={pal} icon="M12 21s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 3.5C19 16.65 12 21 12 21z" title="My favourites" sub="Your saved shows and activities" onPress={() => router.push('/(tabs)/map')} />
            <Row pal={pal} icon="M20 6L9 17l-5-5" title="I did it" sub="Everything you've marked as seen" onPress={() => router.push('/(tabs)/map')} />
            <Row pal={pal} icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.9M4.6 9a1.7 1.7 0 0 0-.3-1.9" title="Account settings" sub="Personal info, accessibility, theme" onPress={() => router.push('/settings')} />
          </View>

          {user && (
            <Touchable style={[styles.logout, { borderColor: pal.line }]} onPress={async () => { await logout(); router.back(); }}>
              <Text style={[styles.logoutTxt, { color: theme.brand }]}>Log out</Text>
            </Touchable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  avatarWrap: { alignItems: 'center', marginTop: -48 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { position: 'absolute', fontSize: 40 },
  pad: { paddingHorizontal: 18, marginTop: 12 },
  hello: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 2 },
  ctaCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginTop: 6 },
  ctaTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  primaryBtn: { backgroundColor: theme.brand, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  darkBtn: { backgroundColor: '#2a2320', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  darkTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, padding: 14, borderWidth: 1 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2 },
  chev: { fontSize: 24, marginLeft: 6 },
  logout: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  logoutTxt: { fontWeight: '800', fontSize: 15 },
});
