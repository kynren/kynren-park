import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../components/Touchable';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import { useAuth } from '../lib/auth';
import { api, type ApiError } from '../lib/api';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

type Step = 'email' | 'code' | 'done';
const RESEND_SECONDS = 60;

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', input: '#161616', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a', placeholder: '#6a6a6a' }
    : { screen: theme.bg, card: '#ffffff', input: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border, placeholder: '#9a938c' };
}

function describe(error: unknown): string {
  const e = error as Partial<ApiError>;
  if (e.status === 429) return e.serverMessage || 'Too many tries. Please wait a little and try again.';
  if (e.status === 400) return e.serverMessage || 'That did not work. Check and try again.';
  if (e.status === 503) return 'Booking lookup is unavailable right now. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

/**
 * Pulls a guest's Smeetz bookings into their account: they give the address they booked with, we email a code to it, and
 * entering the code proves it is theirs. Reached straight after sign-up (`setup`) and from the Tickets tab.
 */
export default function SmeetzLinkScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ email?: string; setup?: string }>();
  const setup = params.setup === '1';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(String(params.email ?? user?.email ?? ''));
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [linked, setLinked] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function leave() {
    if (setup) router.replace('/(tabs)');
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/tickets');
  }

  async function sendCode() {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter the email address you booked with.');
      return;
    }
    setBusy(true);
    try {
      await api('/smeetz/email/request', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setStep('code');
      setWait(RESEND_SECONDS);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError('');
    setBusy(true);
    try {
      const res = await api<{ linked: number }>('/smeetz/email/verify', { method: 'POST', body: JSON.stringify({ email: email.trim(), code }) });
      setLinked(res.linked);
      setStep('done');
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.screen }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoid>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, paddingBottom: 40, gap: 14 }}>
        <Text style={[styles.h1, { color: pal.text }]}>Find your bookings</Text>

        {step === 'email' && (
          <>
            <Text style={[styles.body, { color: pal.sub }]}>
              Booked through our ticket partner Smeetz? Enter the email address you booked with. If there are bookings under it, we’ll email you a 6-digit code to add them to your account.
            </Text>
            <TextInput
              style={[styles.input, { color: pal.text, borderColor: pal.line, backgroundColor: pal.input }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={pal.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Touchable style={styles.primary} onPress={sendCode} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Send code</Text>}
            </Touchable>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={[styles.body, { color: pal.sub }]}>
              If there are bookings under {email.trim()}, we’ve emailed it a code. It works for 10 minutes. Nothing arrived? Check your spam folder — or there may be no bookings under that address.
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput, { color: pal.text, borderColor: pal.line, backgroundColor: pal.input }]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={pal.placeholder}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Touchable style={[styles.primary, code.length !== 6 && { opacity: 0.5 }]} onPress={verify} disabled={busy || code.length !== 6}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Add my bookings</Text>}
            </Touchable>
            <Touchable onPress={sendCode} disabled={busy || wait > 0}>
              <Text style={[styles.link, wait > 0 && { opacity: 0.5 }]}>{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</Text>
            </Touchable>
            <Touchable onPress={() => { setStep('email'); setCode(''); setError(''); }}>
              <Text style={styles.link}>Use a different email</Text>
            </Touchable>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={[styles.body, { color: pal.text }]}>
              {linked === 1 ? 'Added 1 booking' : `Added ${linked} bookings`} to your account. They’re on your Tickets tab.
            </Text>
            <Touchable style={styles.primary} onPress={() => (setup ? router.replace('/(tabs)') : router.replace('/(tabs)/tickets'))}>
              <Text style={styles.primaryTxt}>{setup ? 'Continue' : 'See my tickets'}</Text>
            </Touchable>
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {step !== 'done' && (
          <Touchable onPress={leave}>
            <Text style={[styles.link, { color: pal.sub }]}>{setup ? 'Skip for now' : 'Cancel'}</Text>
          </Touchable>
        )}
      </ScrollView>
      </KeyboardAvoid>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  codeInput: { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  primary: { backgroundColor: theme.brand, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { color: theme.brand, fontWeight: '700', fontSize: 15, textAlign: 'center', paddingVertical: 6 },
  error: { color: '#c0392b', fontSize: 14, fontWeight: '600' },
});
