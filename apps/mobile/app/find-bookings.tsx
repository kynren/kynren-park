import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Touchable } from '../components/Touchable';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Controls';
import { Screen } from '../components/ui/Screen';
import { useAuth } from '../lib/auth';
import { api, type ApiError } from '../lib/api';
import { serif, featureGradient } from '../lib/theme';
import { useUI } from '../lib/ui';

type Step = 'email' | 'code' | 'done';
const RESEND_SECONDS = 60;

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
  const { c } = useUI();
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
    <Screen page="bookings" title="Find my bookings" subtitle="Bring your tickets into the app" colors={featureGradient.tickets} keyboard onBack={leave}>
      {step === 'email' && (
        <>
          <Text style={[styles.body, { color: c.sub }]}>
            Booked your tickets online? Enter the email address you booked with. If there are bookings under it, we’ll email you a 6-digit code to add them to your account.
          </Text>
          <TextField value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Button full label="Send code" onPress={sendCode} loading={busy} />
        </>
      )}

      {step === 'code' && (
        <>
          <Text style={[styles.body, { color: c.sub }]}>
            If there are bookings under {email.trim()}, we’ve emailed it a code. It works for 10 minutes. Nothing arrived? Check your spam folder — or there may be no bookings under that address.
          </Text>
          <TextField
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <Button full label="Add my bookings" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Touchable onPress={sendCode} disabled={busy || wait > 0}>
            <Text style={[styles.link, { color: c.link }, wait > 0 && { opacity: 0.5 }]}>{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</Text>
          </Touchable>
          <Touchable onPress={() => { setStep('email'); setCode(''); setError(''); }}>
            <Text style={[styles.link, { color: c.link }]}>Use a different email</Text>
          </Touchable>
        </>
      )}

      {step === 'done' && (
        <>
          <Text style={[styles.body, { color: c.text }]}>
            {linked === 1 ? 'Added 1 booking' : `Added ${linked} bookings`} to your account. They’re on your Tickets tab.
          </Text>
          <Button full label={setup ? 'Continue' : 'See my tickets'} onPress={() => (setup ? router.replace('/(tabs)') : router.replace('/(tabs)/tickets'))} />
        </>
      )}

      {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

      {step !== 'done' && (
        <Touchable onPress={leave}>
          <Text style={[styles.link, { color: c.sub }]}>{setup ? 'Skip for now' : 'Cancel'}</Text>
        </Touchable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  codeInput: { fontFamily: serif, fontSize: 23, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  link: { fontWeight: '700', fontSize: 15, textAlign: 'center', paddingVertical: 6 },
  error: { fontSize: 14, fontWeight: '600' },
});
