import { ScrollView, View, Text, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useSync, type Session } from '../../lib/sync';
import { SyncChip } from '../../components/SyncChip';
import { fmtTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { theme, categoryColor, statusColor } from '../../lib/theme';

export default function TodayScreen() {
  const { bundle, refresh } = useSync();
  const { t } = useI18n();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      (bundle?.sessions ?? [])
        .filter((s) => new Date(s.revisedStart ?? s.startTime).getTime() > now - 30 * 60000)
        .slice(0, 8),
    [bundle, now],
  );
  const alerts = (bundle?.sessions ?? []).filter((s) => s.status === 'DELAYED' || s.status === 'CANCELLED');

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>{t('today.welcome')}</Text>
      <SyncChip />

      {bundle?.announcements?.[0] && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>📣 {bundle.announcements[0].title}</Text>
          <Text style={styles.noticeBody}>{bundle.announcements[0].body}</Text>
        </View>
      )}

      {alerts.length > 0 && (
        <View>
          <Text style={styles.h2}>{t('today.changes')}</Text>
          {alerts.map((s) => (
            <View key={s.id} style={[styles.alert, { borderLeftColor: statusColor[s.status] }]}>
              <Text style={styles.alertName}>{s.attraction.name}</Text>
              <Text style={styles.alertMeta}>
                {s.status === 'CANCELLED' ? 'Cancelled' : `Delayed to ${fmtTime(s.revisedStart ?? s.startTime)}`}
                {s.note ? ` · ${s.note}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.h2}>{t('today.comingUp')}</Text>
      {upcoming.length === 0 && <Text style={styles.muted}>{t('today.noMoreShows')}</Text>}
      {upcoming.map((s) => (
        <SessionRow key={s.id} session={s} onPress={() => router.push(`/attraction/${s.attraction.slug}`)} />
      ))}

      <Pressable style={styles.cta} onPress={() => router.push('/plan')}>
        <Text style={styles.ctaText}>{t('today.planCta')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function SessionRow({ session, onPress }: { session: Session; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.cat, { backgroundColor: categoryColor[session.attraction.category] ?? theme.muted }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{session.attraction.name}</Text>
        <Text style={styles.muted}>{fmtTime(session.revisedStart ?? session.startTime)}</Text>
      </View>
      {session.status !== 'SCHEDULED' && (
        <View style={[styles.badge, { backgroundColor: statusColor[session.status] }]}>
          <Text style={styles.badgeText}>{session.status}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 6, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '800', color: theme.ink, marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 18, marginBottom: 6 },
  muted: { color: theme.muted, fontSize: 13 },
  notice: { backgroundColor: '#fff7e6', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#f0e2bf' },
  noticeTitle: { fontWeight: '700', color: theme.ink },
  noticeBody: { color: theme.ink, marginTop: 4 },
  alert: { backgroundColor: theme.card, borderRadius: 10, padding: 12, borderLeftWidth: 5, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  alertName: { fontWeight: '700', color: theme.ink },
  alertMeta: { color: theme.muted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border, gap: 12 },
  cat: { width: 6, height: 38, borderRadius: 3 },
  rowName: { fontWeight: '600', color: theme.ink, fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 22 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

