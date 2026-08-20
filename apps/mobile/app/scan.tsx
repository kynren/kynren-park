import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

// Accepts kynren://spot/<type>/<id> (and an https .../s/<type>/<id> fallback).
function parseSpot(data: string): { type: string; id: string } | null {
  const m = data.match(/(?:spot|s)\/(attraction|restaurant|shop|poi)\/([\w-]+)/i);
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}

// A menu item / shop product isn't its own map spot — it's something sold at
// one — so its code carries the parent's slug and goes straight to that
// restaurant/shop screen instead of through the map.
function parseItem(data: string): { kind: 'menu' | 'shop'; slug: string } | null {
  const m = data.match(/item\/(menu|shop)\/([\w-]+)\/([\w-]+)/i);
  return m ? { kind: m[1].toLowerCase() as 'menu' | 'shop', slug: m[2] } : null;
}

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);

  function onScanned({ data }: { data: string }) {
    if (handled.current) return;
    const item = parseItem(data);
    if (item) {
      handled.current = true;
      router.replace(`/${item.kind === 'menu' ? 'restaurant' : 'shop'}/${item.slug}`);
      return;
    }
    const spot = parseSpot(data);
    if (!spot) { setError('That’s not a Kynren code. Try another.'); return; }
    handled.current = true;
    router.replace({ pathname: '/map', params: { spot: `${spot.type}:${spot.id}` } });
  }

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      ) : (
        <View style={[styles.fill, styles.center, { padding: 28 }]}>
          <Text style={styles.permH}>Scan Kynren codes</Text>
          <Text style={styles.permTxt}>Allow camera access to scan a code — a spot on the map, or a menu item or product.</Text>
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnTxt}>Allow camera</Text>
          </Pressable>
        </View>
      )}

      {/* Reticle + hint */}
      {permission?.granted && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.hint}>Point at a Kynren QR code</Text>
        </View>
      )}
      {error ? <Text style={[styles.err, { bottom: insets.bottom + 96 }]}>{error}</Text> : null}

      {/* Close */}
      <Pressable style={[styles.close, { top: insets.top + 10 }]} onPress={() => router.back()}>
        <Text style={styles.closeTxt}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { color: '#fff', marginTop: 22, fontSize: 15, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  err: { position: 'absolute', alignSelf: 'center', color: '#fff', backgroundColor: 'rgba(180,30,36,0.92)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, fontWeight: '700' },
  close: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#fff', fontSize: 20, fontWeight: '700' },
  permH: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  permTxt: { color: '#cfcfcf', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  permBtn: { backgroundColor: theme.brand, borderRadius: 999, paddingVertical: 15, paddingHorizontal: 34, marginTop: 26 },
  permBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
