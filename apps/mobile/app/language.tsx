import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { Touchable } from '../components/Touchable';
import { useI18n, LOCALES } from '../lib/i18n';
import { theme } from '../lib/theme';

export default function LanguageScreen() {
  const { locale, setLocale, t } = useI18n();
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>{t('common.language')}</Text>
      <Text style={styles.muted}>Every translation is built into the app and works offline.</Text>
      <View style={{ marginTop: 16, gap: 10 }}>
        {LOCALES.map((l) => {
          const active = locale === l.code;
          return (
            <Touchable key={l.code} style={[styles.row, active && styles.rowOn]} onPress={() => setLocale(l.code)}>
              <Text style={styles.flag}>{l.flag}</Text>
              <Text style={[styles.label, active && { fontWeight: '800', color: theme.brand }]}>{l.label}</Text>
              {active && <Text style={styles.check}>✓</Text>}
            </Touchable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  muted: { color: theme.muted, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 16 },
  rowOn: { borderColor: theme.brand, backgroundColor: '#fbf1f0' },
  flag: { fontSize: 24 },
  label: { flex: 1, fontSize: 16, color: theme.ink },
  check: { color: theme.brand, fontWeight: '800', fontSize: 18 },
});
