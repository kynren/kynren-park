import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Touchable } from '../../components/Touchable';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Controls';
import { PassCard } from '../../components/ui/PassCard';
import { Screen } from '../../components/ui/Screen';
import { ticketDay, useTickets } from '../../lib/tickets';
import { featureGradient } from '../../lib/theme';
import { useUI } from '../../lib/ui';

/** One ticket on its own: the big QR to hold up at the gate, and everything about it underneath. */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useUI();
  const { tickets, loading } = useTickets();
  const ticket = tickets.find((x) => x.id === id);

  const rows: [string, string | null | undefined][] = ticket
    ? [
        ['Ticket', ticket.title],
        ['Type', ticket.priceName],
        ['Date', ticketDay(ticket.date)],
        ['Name', ticket.holder],
        ['Booking', ticket.reference],
        ['Status', ticket.status ? ticket.status[0]!.toUpperCase() + ticket.status.slice(1) : 'Valid'],
        ['Booked on', ticketDay(ticket.bookedOn)],
      ]
    : [];

  return (
    <Screen page="tickets" title="Your ticket" subtitle={ticket?.title} colors={featureGradient.tickets}>
      {ticket ? (
        <>
          <PassCard title={ticket.title} subtitle={[ticketDay(ticket.date), ticket.priceName].filter(Boolean).join(' · ')} code={ticket.code} footer={ticket.holder ?? undefined} qrSize={200}>
            {ticket.kind === 'park' && (
              <Touchable
                style={styles.wallet}
                onPress={() => Alert.alert('Add to Wallet', 'Apple/Google Wallet passes require signing certificates and are configured server-side (coming in a later release). Your offline QR above already works for entry.')}
              >
                <Text style={[styles.walletText, { color: c.link }]}>Add to Apple / Google Wallet</Text>
              </Touchable>
            )}
          </PassCard>
          <Text style={[styles.hint, { color: c.sub }]}>Hold this up at the gate. It works with no signal.</Text>

          <Card style={styles.details}>
            {rows.filter(([, v]) => !!v).map(([label, value], i, all) => (
              <View key={label} style={[styles.detailRow, i < all.length - 1 && { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.detailLabel, { color: c.sub }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: c.text }]}>{value}</Text>
              </View>
            ))}
          </Card>

          {ticket.extras.length > 0 && (
            <Card style={styles.details}>
              <Text style={[styles.extrasHead, { color: c.text }]}>Also in this booking</Text>
              {ticket.extras.map((e) => (
                <Text key={e} style={[styles.extra, { color: c.sub }]}>{e}</Text>
              ))}
            </Card>
          )}
        </>
      ) : loading ? (
        <Text style={{ color: c.sub }}>Loading your ticket…</Text>
      ) : (
        <Card style={styles.missing}>
          <Text style={[styles.extrasHead, { color: c.text }]}>We can’t find that ticket</Text>
          <Text style={[styles.extra, { color: c.sub }]}>It may have been cancelled, or belong to a different account.</Text>
          <Button label="Back to my tickets" onPress={() => router.replace('/(tabs)/tickets')} style={{ marginTop: 14 }} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wallet: { marginTop: 10, paddingVertical: 6 },
  walletText: { fontSize: 13.5, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 13 },
  details: { paddingHorizontal: 16, paddingVertical: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  detailLabel: { fontSize: 13.5, width: 92 },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14.5, fontWeight: '600' },
  extrasHead: { fontSize: 15.5, fontWeight: '800', marginTop: 10 },
  extra: { fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 2 },
  missing: { padding: 18 },
});
