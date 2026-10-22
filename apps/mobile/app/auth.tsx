import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Touchable } from '../components/Touchable';
import { ManagedImage } from '../components/ManagedImage';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { TextField } from '../components/ui/Controls';
import { useAuth } from '../lib/auth';
import { useUI } from '../lib/ui';
import { serif } from '../lib/theme';

export default function AuthScreen() {
  const router = useRouter();
  const { c } = useUI();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!email || password.length < 8) {
      setError('Enter an email and a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, name.trim() || undefined);
      if (mode === 'register') {
        // New accounts are offered their Smeetz bookings straight away.
        router.replace({ pathname: '/find-bookings', params: { email: email.trim(), setup: '1' } });
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch {
      setError(mode === 'login' ? 'Invalid email or password.' : 'Could not create your account (email may already exist).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen page="auth" title={mode === 'login' ? 'Sign in' : 'Create account'} subtitle={mode === 'login' ? 'Welcome back to the park' : 'Keep your tickets and plans in one place'} keyboard>
      <ManagedImage slot="auth.header" style={{ height: 150, borderRadius: 20 }} fadeColor={c.screen} />
      <Text style={[styles.muted, { color: c.sub }]}>
        {mode === 'login' ? 'Sign in to see your tickets and save your day.' : 'So we can hold your tickets and remind you before each show.'}
      </Text>

      {mode === 'register' && <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />}
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={
          <Touchable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
            <Text style={[styles.toggle, { color: c.link }]}>{showPw ? 'Hide' : 'Show'}</Text>
          </Touchable>
        }
      />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <Button full label={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={loading} style={{ marginTop: 6 }} />

      <Touchable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ marginTop: 4 }}>
        <Text style={[styles.switch, { color: c.link }]}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text>
      </Touchable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 21, fontWeight: '800' },
  muted: { fontSize: 14.5, lineHeight: 21 },
  toggle: { fontWeight: '700', fontSize: 13 },
  error: { fontSize: 13.5, fontWeight: '600' },
  switch: { textAlign: 'center', fontWeight: '700', paddingVertical: 8 },
});
