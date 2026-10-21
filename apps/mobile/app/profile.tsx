import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Touchable } from '../components/Touchable';
import { ManagedImage } from '../components/ManagedImage';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Controls';
import { Icon, type IconName } from '../components/ui/Icon';
import { Screen } from '../components/ui/Screen';
import { useAuth } from '../lib/auth';
import { useSync } from '../lib/sync';
import { useUI } from '../lib/ui';
import { serif } from '../lib/theme';

const PROFILE_KEY = 'kynren_profile';

function Row({ icon, title, sub, onPress }: { icon: IconName; title: string; sub?: string; onPress: () => void }) {
  const { c } = useUI();
  return (
    <Card style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: c.tint }]}>
        <Icon name={icon} color={c.link} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{title}</Text>
        {sub && <Text style={[styles.rowSub, { color: c.sub }]}>{sub}</Text>}
      </View>
      <Icon name="chevron" color={c.placeholder} size={18} />
    </Card>
  );
}

function CheckItem({ text }: { text: string }) {
  const { c } = useUI();
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkDot, { backgroundColor: c.ok }]}>
        <Icon name="check" color="#ffffff" size={12} strokeWidth={3.4} />
      </View>
      <Text style={[styles.checkTxt, { color: c.text }]}>{text}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { c } = useUI();
  const { user, logout } = useAuth();
  const { bundle } = useSync();
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
    <Screen title="Profile">
      {user ? (
        <View style={styles.helloWrap}>
          <View style={[styles.avatar, { borderColor: c.card, backgroundColor: c.tint }]}>
            {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <ManagedImage slot="profile.avatar" style={styles.avatarImg} fallback={undefined} />}
            {!photo && <Icon name="user" color={c.link} size={38} />}
          </View>
          <Text style={[styles.hello, { color: c.text }]}>Hello{displayName ? `, ${displayName}` : ''}</Text>
          <Text style={[styles.sub, { color: c.sub }]}>{bundle?.branding?.appName ?? 'Kynren – The Storied Lands'}</Text>
        </View>
      ) : (
        <Card style={styles.ctaCard}>
          {bundle?.branding?.logoUrl ? (
            <Image source={{ uri: bundle.branding.logoUrl }} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <Text style={[styles.wordmark, { color: c.link }]}>{(bundle?.branding?.appName ?? 'Kynren').toUpperCase()}</Text>
          )}
          <Text style={[styles.ctaTitle, { color: c.text }]}>Your adventure starts here</Text>
          <Text style={[styles.ctaHead, { color: c.sub }]}>Create a free account to:</Text>
          <View style={{ gap: 10, marginTop: 4 }}>
            <CheckItem text="Hold your tickets in the app" />
            <CheckItem text="Add Smeetz bookings by email" />
            <CheckItem text="Order ahead and track your order" />
            <CheckItem text="Get reminders before each show" />
          </View>
          <Button full label="Create an account" onPress={() => router.push('/auth')} style={{ marginTop: 20 }} />
          <Button full variant="soft" label="Log in" onPress={() => router.push('/auth')} style={{ marginTop: 10 }} />
        </Card>
      )}

      {/* Tickets + planned day */}
      <View style={styles.grid}>
        <Card style={styles.tile} onPress={() => router.push('/(tabs)/tickets')}>
          <Icon name="ticket" color={c.link} size={24} />
          <Text style={[styles.tileTitle, { color: c.text }]}>My tickets</Text>
        </Card>
        <Card style={[styles.tile, !user && { opacity: 0.55 }]} onPress={user ? () => router.push('/(tabs)/plan') : undefined}>
          <Icon name="calendar" color={user ? c.link : c.sub} size={24} />
          <Text style={[styles.tileTitle, { color: user ? c.text : c.sub }]}>My planned day</Text>
          {!user && <Text style={[styles.tileSub, { color: c.sub }]}>Sign in to plan your day</Text>}
        </Card>
      </View>

      <Row icon="heart" title="My favourites" sub="Your saved shows and activities" onPress={() => router.push('/favorites')} />
      <Row icon="check" title="I did it" sub="Everything you've marked as seen" onPress={() => router.push('/seen')} />
      <Row icon="fork" title="My orders" sub="Track food you've ordered ahead" onPress={() => router.push('/orders')} />
      {user && <Row icon="sliders" title="Account settings" sub="Personal info, accessibility, theme" onPress={() => router.push('/settings')} />}

      {user && <Button full variant="soft" label="Log out" onPress={async () => { await logout(); router.back(); }} style={{ marginTop: 8 }} />}

      {/* Build/update footer — lets us confirm which OTA a device is actually
          running (tap to check for a newer one right now). */}
      <VersionFooter />
    </Screen>
  );
}

function VersionFooter() {
  const { c } = useUI();
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
    <Touchable onPress={checkNow} disabled={checking} style={{ marginTop: 10, alignItems: 'center' }}>
      <Text style={{ color: c.sub, fontSize: 11 }}>
        v{appVersion} · build {updateId}{publishedAt ? ` · ${publishedAt}` : ''}
      </Text>
      <Text style={{ color: c.link, fontSize: 11.5, fontWeight: '700', marginTop: 3 }}>
        {checking ? 'Checking…' : msg ?? 'Check for updates'}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  helloWrap: { alignItems: 'center', marginTop: 4 },
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  hello: { fontFamily: serif, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 2 },

  ctaCard: { padding: 22 },
  wordmark: { fontSize: 18, fontWeight: '800', letterSpacing: 3, marginBottom: 14 },
  logoImg: { height: 34, width: 150, marginBottom: 14 },
  ctaTitle: { fontFamily: serif, fontSize: 26, fontWeight: '800', lineHeight: 31 },
  ctaHead: { fontSize: 14.5, fontWeight: '600', marginTop: 8, marginBottom: 6 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { fontSize: 14.5, fontWeight: '600', flex: 1 },

  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, padding: 16, gap: 10, minHeight: 96 },
  tileTitle: { fontSize: 15.5, fontWeight: '800' },
  tileSub: { fontSize: 11.5, fontWeight: '600', lineHeight: 15 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
});
