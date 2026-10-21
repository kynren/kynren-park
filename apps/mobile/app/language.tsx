import { Text, StyleSheet } from 'react-native';
import { Touchable } from '../components/Touchable';
import { Card } from '../components/ui/Controls';
import { Icon } from '../components/ui/Icon';
import { Screen } from '../components/ui/Screen';
import { useI18n, LOCALES } from '../lib/i18n';
import { useUI } from '../lib/ui';
import { serif } from '../lib/theme';

export default function LanguageScreen() {
  const { locale, setLocale, t } = useI18n();
  const { c } = useUI();
  return (
    <Screen title={t('common.language')}>
      <Text style={[styles.muted, { color: c.sub }]}>Every translation is built into the app and works offline.</Text>
      {LOCALES.map((l) => {
        const active = locale === l.code;
        return (
          <Card key={l.code} onPress={() => setLocale(l.code)} style={[styles.row, active && { borderColor: c.primary, backgroundColor: c.tint }]}>
            <Text style={styles.flag}>{l.flag}</Text>
            <Text style={[styles.label, { color: active ? c.link : c.text, fontWeight: active ? '800' : '600' }]}>{l.label}</Text>
            {active && <Icon name="check" color={c.link} size={20} />}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  flag: { fontFamily: serif, fontSize: 24 },
  label: { flex: 1, fontSize: 16 },
});
