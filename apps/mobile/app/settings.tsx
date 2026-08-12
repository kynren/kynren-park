import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TextInput, Switch, Image, Alert } from 'react-native';
import { Touchable } from '../components/Touchable';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../lib/theme';
import { useThemePref, type ThemePref } from '../lib/theme-context';

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

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', input: '#161616', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a', placeholder: '#6a6a6a' }
    : { screen: theme.bg, card: '#ffffff', input: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border, placeholder: '#9a938c' };
}

export default function SettingsScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { pref, setPref } = useThemePref();
  const [p, setP] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => raw && setP({ ...EMPTY, ...JSON.parse(raw) }));
  }, []);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

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

  const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '👤';

  return (
    <View style={[styles.screen, { backgroundColor: pal.screen }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Touchable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
        </Touchable>
        <Text style={[styles.topTitle, { color: pal.text }]}>Account</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 22 }}>
        {/* Photo */}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Touchable onPress={pickPhoto} style={styles.photoWrap}>
            {p.photoUri ? (
              <Image source={{ uri: p.photoUri }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.photoEdit}>
              <Text style={{ color: '#fff', fontSize: 13 }}>✎</Text>
            </View>
          </Touchable>
          <Touchable onPress={pickPhoto}><Text style={styles.changePhoto}>Change photo</Text></Touchable>
        </View>

        {/* Profile */}
        <Section title="Your details" pal={pal}>
          <Field label="First name" value={p.firstName} onChange={(v) => set('firstName', v)} pal={pal} />
          <Field label="Last name" value={p.lastName} onChange={(v) => set('lastName', v)} pal={pal} />
          <Field label="Phone" value={p.phone} onChange={(v) => set('phone', v)} pal={pal} keyboardType="phone-pad" />
          <Field label="Address" value={p.address} onChange={(v) => set('address', v)} pal={pal} multiline />
        </Section>

        {/* Accessibility */}
        <Section title="Accessibility" pal={pal}>
          <Toggle label="Step-free access needs" value={p.wheelchair} onChange={(v) => set('wheelchair', v)} pal={pal} />
          <Toggle label="Audio description" value={p.audioDesc} onChange={(v) => set('audioDesc', v)} pal={pal} />
          <Toggle label="Captioning" value={p.captioning} onChange={(v) => set('captioning', v)} pal={pal} />
          <Toggle label="BSL interpretation" value={p.bsl} onChange={(v) => set('bsl', v)} pal={pal} />
          <Field label="Other needs (optional)" value={p.notes} onChange={(v) => set('notes', v)} pal={pal} multiline />
        </Section>

        {/* Appearance */}
        <Section title="Appearance" pal={pal}>
          <View style={styles.segment}>
            {(['light', 'dark', 'system'] as ThemePref[]).map((opt) => {
              const on = pref === opt;
              return (
                <Touchable key={opt} style={[styles.segItem, on && { backgroundColor: theme.brand }]} onPress={() => setPref(opt)}>
                  <Text style={[styles.segTxt, { color: on ? '#fff' : pal.text }]}>{opt[0].toUpperCase() + opt.slice(1)}</Text>
                </Touchable>
              );
            })}
          </View>
        </Section>

        <Touchable style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveTxt}>{saved ? '✓ Saved' : 'Save changes'}</Text>
        </Touchable>
      </ScrollView>
    </View>
  );
}

function Section({ title, pal, children }: { title: string; pal: ReturnType<typeof usePalette>; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionH, { color: pal.text }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: pal.card, borderColor: pal.line }]}>{children}</View>
    </View>
  );
}

function Field({ label, value, onChange, pal, multiline, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; pal: ReturnType<typeof usePalette>; multiline?: boolean; keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={[styles.label, { color: pal.sub }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={pal.placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, { color: pal.text, borderColor: pal.line, backgroundColor: pal.input }, multiline && { height: 74, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

function Toggle({ label, value, onChange, pal }: { label: string; value: boolean; onChange: (v: boolean) => void; pal: ReturnType<typeof usePalette> }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: pal.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.brand, false: '#c8c0b6' }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 20, fontWeight: '800' },
  photoWrap: { width: 104, height: 104 },
  photo: { width: 104, height: 104, borderRadius: 52 },
  photoPlaceholder: { backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' },
  photoInitials: { color: '#fff', fontSize: 34, fontWeight: '800' },
  photoEdit: { position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.brand, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  changePhoto: { color: theme.brand, fontWeight: '700', fontSize: 14 },
  sectionH: { fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 14 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  segment: { flexDirection: 'row', gap: 8 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(143,29,33,0.08)' },
  segTxt: { fontWeight: '700', fontSize: 14 },
  saveBtn: { backgroundColor: theme.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
