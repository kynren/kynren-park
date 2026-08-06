import { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../lib/sync';
import { theme } from '../lib/theme';

const CACHE = 'kynren_splash';
const MIN_MS = 1600; // keep the splash up at least this long (avoids a flash)
const MAX_MS = 6000; // hard cap so a slow video/network never traps the user

type SplashCfg = { type: 'none' | 'photo' | 'gif' | 'video'; url?: string | null };

/**
 * Full-screen launch/loading overlay. Renders the admin-configured media
 * (photo / GIF / video) from the branding config — cached from the last sync so
 * it shows instantly on a cold start — then fades out once the app is ready.
 */
export function LoadingOverlay() {
  const { bundle, loading } = useSync();
  const [cfg, setCfg] = useState<SplashCfg | null>(null);
  const [done, setDone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(Date.now()).current;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // Instant display from the last cached splash config.
  useEffect(() => {
    AsyncStorage.getItem(CACHE).then((raw) => setCfg(raw ? JSON.parse(raw) : { type: 'none' }));
  }, []);

  // Refresh the cache from the live bundle for next launch.
  useEffect(() => {
    const b = bundle?.branding;
    if (b) AsyncStorage.setItem(CACHE, JSON.stringify({ type: b.splashType ?? 'none', url: b.splashMediaUrl ?? null })).catch(() => undefined);
  }, [bundle]);

  // Dismiss once we've shown for MIN_MS and the app is ready (or MAX_MS cap).
  useEffect(() => {
    if (!cfg) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - started;
      if (elapsed >= MAX_MS || (elapsed >= MIN_MS && !loadingRef.current)) {
        Animated.timing(fade, { toValue: 0, duration: 420, useNativeDriver: true }).start(() => !cancelled && setDone(true));
      } else {
        setTimeout(tick, 150);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [cfg, fade, started]);

  if (done || !cfg) return null;

  const url = cfg.url || undefined;
  const hasMedia = cfg.type !== 'none' && !!url;

  return (
    <Animated.View style={[styles.fill, { opacity: fade }]} pointerEvents="none">
      {hasMedia && cfg.type === 'video' ? (
        <Video
          source={{ uri: url! }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted
          isLooping
          onError={() => setDone(true)}
        />
      ) : hasMedia ? (
        <Image source={{ uri: url! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        // Default branded splash: the cross mark + a spinner.
        <View style={[styles.fill, styles.default]}>
          <Image source={require('../assets/icon.png')} style={styles.mark} resizeMode="contain" />
          <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: '#ffffff' },
  default: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  mark: { width: 132, height: 132 },
});
