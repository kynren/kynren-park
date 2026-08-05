import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { theme } from '../lib/theme';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch {
      setError(mode === 'login' ? 'Invalid email or password.' : 'Could not create your account (email may already exist).');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
      <Text style={styles.muted}>
        {mode === 'login'
          ? 'Sign in to book tickets and save your day.'
          : 'So we can hold your tickets and remind you before each show.'}
      </Text>

      {mode === 'register' && (
        <>
          <Text style={styles.label}>Name (optional)</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
        </>
      )}
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ marginTop: 16 }}>
        <Text style={styles.switch}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 4 },
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  muted: { color: theme.muted, fontSize: 14, marginBottom: 8 },
  label: { fontSize: 13, color: theme.muted, marginTop: 14, marginBottom: 4 },
  input: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 15 },
  error: { color: theme.danger, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 22 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  switch: { color: theme.brand, textAlign: 'center', fontWeight: '600' },
});
