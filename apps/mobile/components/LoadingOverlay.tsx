import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Animated } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../lib/sync';
import { SplashSequence } from './SplashSequence';

const CACHE = 'kynren_splash';
const MIN_MS = 3400; // long enough for the crest montage + mark reveal to play out
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

  // Preload the park map — it's often a large embedded picture (up to 4096px,
  // usually a multi-MB base64 image, not a plain hosted URL) — while the splash
  // is up, so decoding is already done and cached by the time the guest opens
  // the Map tab, instead of it happening (and visibly flashing) on first visit.
  const mapUrl = bundle?.defaultMap?.imageUrl || bundle?.mapConfig?.mapImageUrl || null;
  useEffect(() => {
    if (mapUrl) Image.prefetch(mapUrl).catch(() => undefined);
  }, [mapUrl]);

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

  if (done) return null;

  const url = cfg?.url || undefined;
  const hasMedia = !!cfg && cfg.type !== 'none' && !!url;

  // Render the full-screen overlay from the very first frame (its dark
  // background covers the home screen) so nothing flashes behind the splash
  // while the cached config loads.
  return (
    <Animated.View style={[styles.fill, { opacity: fade }]} pointerEvents="none">
      {!cfg ? null : hasMedia && cfg.type === 'video' ? (
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
        // Default: the cinematic Kynren splash sequence.
        <SplashSequence />
      )}
      {/* Invisible, 1x1 — forces the SAME native image pipeline the Map screen
          uses to fully decode + cache the map picture now (Image.prefetch's
          support for embedded base64 pictures, not just hosted URLs, isn't
          guaranteed on every platform, so this is the belt-and-suspenders way). */}
      {mapUrl && <Image source={{ uri: mapUrl }} style={styles.preload} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: '#0a0616' },
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
