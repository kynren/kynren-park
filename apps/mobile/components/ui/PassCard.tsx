import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { serif } from '../../lib/theme';
import { radius, shadow, useUI } from '../../lib/ui';

const NOTCH = 20;

/** A paper ticket: a parchment top with what it is and when, then the QR on white, big enough to scan from a phone held at the gate. */
export function PassCard({
  title,
  subtitle,
  code,
  footer,
  qrSize = 180,
  children,
}: {
  title: string;
  subtitle?: string;
  code: string;
  footer?: string;
  qrSize?: number;
  children?: ReactNode;
}) {
  const { c, dark } = useUI();
  return (
    <View style={[styles.pass, shadow(2, dark), { backgroundColor: c.card }]}>
      <View style={[styles.passTop, { backgroundColor: c.soft }]}>
        <Text style={[styles.passLabel, { color: c.accent }]}>ENTRANCE TICKET</Text>
        <Text style={[styles.passTitle, { color: c.text }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[styles.passSub, { color: c.sub }]} numberOfLines={2}>{subtitle}</Text> : null}
        <View style={[styles.passRule, { backgroundColor: c.accent }]} />
      </View>
      <View style={styles.tear}>
        <View style={[styles.notch, { left: -NOTCH / 2, backgroundColor: c.screen }]} />
        <View style={[styles.dash, { borderColor: c.line }]} />
        <View style={[styles.notch, { right: -NOTCH / 2, backgroundColor: c.screen }]} />
      </View>
      <View style={styles.passBody}>
        <View style={styles.qrBox}>
          <QRCode value={code} size={qrSize} />
        </View>
        {footer ? <Text style={[styles.passFoot, { color: c.sub }]}>{footer}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pass: { borderRadius: 24, overflow: 'hidden' },
  passTop: { paddingHorizontal: 22, paddingVertical: 14 },
  passLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2.5, marginBottom: 4 },
  passTitle: { fontFamily: serif, fontSize: 20, fontWeight: '700' },
  passSub: { fontSize: 13.5, marginTop: 4 },
  passRule: { height: 2, width: 44, borderRadius: 1, marginTop: 10 },
  tear: { height: NOTCH, justifyContent: 'center' },
  notch: { position: 'absolute', top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  dash: { marginHorizontal: NOTCH, borderTopWidth: 1.5, borderStyle: 'dashed' },
  passBody: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 16, paddingTop: 0 },
  qrBox: { padding: 10, backgroundColor: '#ffffff', borderRadius: radius.card },
  passFoot: { fontSize: 13.5, fontWeight: '600', marginTop: 10 },
});
