import { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { poundsFromCents } from '../../lib/format';
import { theme } from '../../lib/theme';

interface CachedTicket {
  id: string;
  reference: string;
  ticketType: string;
  visitDate: string;
  qrToken: string;
}

export default function TicketsScreen() {
  const { bundle } = useSync();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [tickets, setTickets] = useState<CachedTicket[]>([]);

  // Reload cached tickets whenever the tab regains focus (e.g. after booking).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('kynren_tickets').then((raw) => setTickets(raw ? JSON.parse(raw) : []));
    }, []),
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.h1}>{t('tickets.title')}</Text>

      {/* Account */}
      <View style={styles.account}>
        {user ? (
          <>
            <Text style={styles.accountName}>👤 {user.name || user.email}</Text>
            <Pressable onPress={logout}>
              <Text style={styles.link}>{t('common.signOut')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.muted}>{t('tickets.signInToBook')}</Text>
            <Pressable onPress={() => router.push('/auth')}>
              <Text style={styles.link}>{t('common.signIn')}</Text>
            </Pressable>
          </>
        )}
      </View>

      <Pressable style={styles.langRow} onPress={() => router.push('/language')}>
        <Text style={styles.langText}>🌐 {t('common.language')}</Text>
        <Text style={styles.chev}>›</Text>
      </Pressable>

      <Pressable
        style={styles.cta}
        onPress={() => router.push(user ? '/book' : '/auth')}
      >
        <Text style={styles.ctaText}>{t('tickets.book')}</Text>
      </Pressable>

      {tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tickets on this device yet</Text>
          <Text style={styles.muted}>
            Once you book, your tickets appear here as scannable QR codes that work even with no signal
            — so entry is never blocked by patchy Wi-Fi.
          </Text>
        </View>
      ) : (
        tickets.map((t) => (
          <View key={t.id} style={styles.ticket}>
            <View style={styles.qrBox}>
              <QRCode value={t.qrToken} size={140} />
            </View>
            <Text style={styles.ticketType}>{t.ticketType}</Text>
            <Text style={styles.muted}>{t.reference} · {t.visitDate}</Text>
            <Pressable style={styles.wallet} onPress={() => Alert.alert('Add to Wallet', 'Apple/Google Wallet passes require signing certificates and are configured server-side (coming in a later release). Your offline QR above already works for entry.')}>
              <Text style={styles.walletText}>Add to Apple / Google Wallet</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.h2}>{t('tickets.prices')}</Text>
      {(bundle?.ticketTypes ?? []).map((tt) => (
        <View key={tt.id} style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.priceName}>{tt.name}</Text>
            {tt.description && <Text style={styles.muted}>{tt.description}</Text>}
          </View>
          <Text style={styles.price}>{poundsFromCents(tt.priceCents)}</Text>
        </View>
      ))}
      <Text style={[styles.muted, { marginTop: 14, textAlign: 'center' }]}>
        Advance Saver prices. Book online to secure your day — capacity is limited.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800', color: theme.ink, marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 24, marginBottom: 10 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 4 },
  account: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border },
  accountName: { fontWeight: '700', color: theme.ink },
  link: { color: theme.brand, fontWeight: '700' },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginTop: 10 },
  langText: { color: theme.ink, fontWeight: '600', fontSize: 14 },
  chev: { color: theme.muted, fontSize: 20 },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 12, marginBottom: 6 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { backgroundColor: theme.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: theme.border, marginTop: 10 },
  emptyTitle: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  ticket: { backgroundColor: theme.card, borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: theme.border, marginTop: 14 },
  qrBox: { padding: 12, backgroundColor: '#fff', borderRadius: 10 },
  ticketType: { fontWeight: '800', color: theme.ink, fontSize: 16, marginTop: 12 },
  wallet: { marginTop: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  walletText: { color: theme.ink, fontSize: 13, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8 },
  priceName: { fontWeight: '600', color: theme.ink, fontSize: 15 },
  price: { fontWeight: '800', color: theme.brand, fontSize: 16 },
});
