import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Switch, Image, Alert, Share } from 'react-native';
import { Touchable } from '../components/Touchable';
import { Button } from '../components/ui/Button';
import { Card, TextField } from '../components/ui/Controls';
import { Icon } from '../components/ui/Icon';
import { Screen } from '../components/ui/Screen';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useThemePref, type ThemePref } from '../lib/theme-context';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useUI } from '../lib/ui';
import { serif } from '../lib/theme';

const PROFILE_KEY = 'kynren_profile';

interface Profile {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  photoUri: string | null;
  wheelchair: boolean;
  audioDesc: boolean;
  captioning: boolean;
  bsl: boolean;
  notes: string;
}
const EMPTY: Profile = { firstName: '', lastName: '', phone: '', address: '', photoUri: null, wheelchair: false, audioDesc: false, captioning: false, bsl: false, notes: '' };

export default function SettingsScreen() {
  const router = useRouter();
  const { c } = useUI();
  const { pref, setPref } = useThemePref();
  const { user, logout } = useAuth();
  const [p, setP] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => raw && setP({ ...EMPTY, ...JSON.parse(raw) }));
  }, []);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);
  useEffect(() => {
    if (!user) return;
    api<{ marketingConsent?: boolean }>('/me').then((me) => setMarketingConsent(!!me.marketingConsent)).catch(() => undefined);
  }, [user]);

  async function toggleConsent(next: boolean) {
    setMarketingConsent(next);
    try {
      await api('/me/consent', { method: 'PATCH', body: JSON.stringify({ marketingConsent: next }) });
    } catch {
      setMarketingConsent(!next);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const data = await api('/me/export');
      await Share.share({ message: JSON.stringify(data, null, 2), title: 'My Kynren data' });
    } catch {
      Alert.alert('Couldn’t export your data', 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function deleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This removes your personal details from Kynren. Your booking history is kept for accounting records but is no longer linked to you. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account', style: 'destructive', onPress: async () => {
            setDeleting(true);
            try {
              await api('/me', { method: 'DELETE' });
              await logout();
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Couldn’t delete your account', 'Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  async function save() {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1800);
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) set('photoUri', res.assets[0].uri);
  }

  const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <Screen title="Account" keyboard contentStyle={{ gap: 24 }}>
      {/* Photo */}
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Touchable onPress={pickPhoto} style={styles.photoWrap} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {p.photoUri ? (
            <Image source={{ uri: p.photoUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
              {initials ? <Text style={styles.photoInitials}>{initials}</Text> : <Icon name="user" color="#ffffff" size={40} />}
            </View>
          )}
          <View style={[styles.photoEdit, { backgroundColor: c.accent, borderColor: c.screen }]}>
            <Text style={{ color: '#ffffff', fontSize: 13 }}>✎</Text>
          </View>
        </Touchable>
        <Touchable onPress={pickPhoto}><Text style={[styles.changePhoto, { color: c.link }]}>Change photo</Text></Touchable>
      </View>

      <Section title="Your details">
        <TextField label="First name" value={p.firstName} onChangeText={(v) => set('firstName', v)} placeholder="First name" />
        <TextField label="Last name" value={p.lastName} onChangeText={(v) => set('lastName', v)} placeholder="Last name" />
        <TextField label="Phone" value={p.phone} onChangeText={(v) => set('phone', v)} placeholder="Phone" keyboardType="phone-pad" />
        <TextField label="Address" value={p.address} onChangeText={(v) => set('address', v)} placeholder="Address" multiline style={styles.multiline} />
      </Section>

      <Section title="Accessibility">
        <Toggle label="Step-free access needs" value={p.wheelchair} onChange={(v) => set('wheelchair', v)} />
        <Toggle label="Audio description" value={p.audioDesc} onChange={(v) => set('audioDesc', v)} />
        <Toggle label="Captioning" value={p.captioning} onChange={(v) => set('captioning', v)} />
        <Toggle label="BSL interpretation" value={p.bsl} onChange={(v) => set('bsl', v)} />
        <TextField label="Other needs (optional)" value={p.notes} onChangeText={(v) => set('notes', v)} placeholder="Other needs" multiline style={styles.multiline} />
      </Section>

      <Section title="Appearance">
        <View style={styles.segment}>
          {(['light', 'dark', 'system'] as ThemePref[]).map((opt) => {
            const on = pref === opt;
            return (
              <Touchable
                key={opt}
                style={[styles.segItem, { backgroundColor: on ? c.primary : c.tint }]}
                onPress={() => setPref(opt)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.segTxt, { color: on ? '#ffffff' : c.link }]}>{opt[0].toUpperCase() + opt.slice(1)}</Text>
              </Touchable>
            );
          })}
        </View>
      </Section>

      <Button full label={saved ? '✓ Saved' : 'Save changes'} onPress={save} />

      {user && (
        <Section title="Privacy & data">
          <Toggle label="Marketing announcements" value={marketingConsent} onChange={toggleConsent} />
          <Touchable onPress={exportData} disabled={exporting}>
            <Text style={[styles.linkAction, { color: c.link }]}>{exporting ? 'Preparing export…' : 'Export my data'}</Text>
          </Touchable>
          <Touchable onPress={deleteAccount} disabled={deleting}>
            <Text style={[styles.linkAction, { color: c.danger }]}>{deleting ? 'Deleting…' : 'Delete my account'}</Text>
          </Touchable>
        </Section>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useUI();
  return (
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={[styles.sectionH, { color: c.text }]}>{title}</Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useUI();
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: c.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.line }} thumbColor="#ffffff" accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  photoWrap: { width: 104, height: 104 },
  photo: { width: 104, height: 104, borderRadius: 52 },
  photoInitials: { fontFamily: serif, color: '#ffffff', fontSize: 34, fontWeight: '800' },
  photoEdit: { position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  changePhoto: { fontWeight: '700', fontSize: 14 },
  sectionH: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  card: { padding: 16, gap: 14 },
  multiline: { height: 80, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  segment: { flexDirection: 'row', gap: 8 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 999 },
  segTxt: { fontWeight: '700', fontSize: 14 },
  linkAction: { fontSize: 15, fontWeight: '700', paddingVertical: 4 },
});
