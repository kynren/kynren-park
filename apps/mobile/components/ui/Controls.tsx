import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Touchable } from '../Touchable';
import { Icon, type IconName } from './Icon';
import { radius, shadow, useUI } from '../../lib/ui';
import { serif } from '../../lib/theme';

/**
 * The floating search field. With `onPress` it is a button that opens search (Home); with `onChangeText` it is the field itself.
 */
export function SearchPill({
  placeholder,
  value,
  onChangeText,
  onPress,
  onFilter,
  filterIcon = 'filter',
  filterLabel = 'Filters',
  autoFocus,
  style,
}: {
  placeholder: string;
  value?: string;
  onChangeText?: (t: string) => void;
  onPress?: () => void;
  onFilter?: () => void;
  /** The icon and spoken label of the button at the right end of the pill. */
  filterIcon?: IconName;
  filterLabel?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, dark } = useUI();
  const inner = (
    <>
      <Icon name="search" color={c.sub} size={20} />
      {onPress ? (
        <Text numberOfLines={1} style={[styles.input, { color: c.placeholder }]}>{placeholder}</Text>
      ) : (
        <TextInput
          style={[styles.input, { color: c.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.placeholder}
          autoFocus={autoFocus}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={placeholder}
        />
      )}
      {onFilter && (
        <Touchable onPress={onFilter} hitSlop={10} accessibilityRole="button" accessibilityLabel={filterLabel}>
          <Icon name={filterIcon} color={c.sub} size={22} />
        </Touchable>
      )}
    </>
  );
  const box = [styles.pill, shadow(1, dark), { backgroundColor: c.card }, style];
  return onPress ? (
    <Touchable onPress={onPress} accessibilityRole="search" accessibilityLabel={placeholder} style={box}>{inner}</Touchable>
  ) : (
    <View style={box}>{inner}</View>
  );
}

/** A filter chip: solid when chosen, a pale tint of the primary when not. */
export function Chip({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { c } = useUI();
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, { backgroundColor: active ? c.primary : c.tint }]}>
      <Text style={[styles.chipText, { color: active ? '#ffffff' : c.link }]}>{label}</Text>
    </Touchable>
  );
}

/** "Theme Park Services … See All": a bold title with a quiet action on the right. */
export function SectionHeader({ title, action, onAction, right }: { title: string; action?: string; onAction?: () => void; right?: ReactNode }) {
  const { c } = useUI();
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      <View style={styles.sectionEnd}>
        {right}
        {action && (
          <Touchable onPress={onAction} hitSlop={10}>
            <Text style={[styles.sectionAction, { color: c.sub }]}>{action}</Text>
          </Touchable>
        )}
      </View>
    </View>
  );
}

/** A labelled text field; `trailing` sits inside the right edge (a Show/Hide toggle). */
export function TextField({ label, trailing, style, ...input }: { label?: string; trailing?: ReactNode } & TextInputProps) {
  const { c } = useUI();
  return (
    <View>
      {label ? <Text style={[styles.fieldLabel, { color: c.sub }]}>{label}</Text> : null}
      <View style={styles.fieldWrap}>
        <TextInput
          placeholderTextColor={c.placeholder}
          accessibilityLabel={label ?? input.placeholder}
          {...input}
          style={[styles.field, { backgroundColor: c.card, borderColor: c.line, color: c.text }, trailing ? { paddingRight: 70 } : null, style]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

/** A rounded, softly shadowed surface. */
export function Card({ children, style, onPress }: { children?: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, dark } = useUI();
  const box = [styles.card, shadow(1, dark), { backgroundColor: c.card }, style];
  return onPress ? <Touchable onPress={onPress} scaleTo={1.02} style={box}>{children}</Touchable> : <View style={box}>{children}</View>;
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderRadius: radius.pill, paddingHorizontal: 20 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  chip: { borderRadius: radius.chip, paddingVertical: 9, paddingHorizontal: 18, alignSelf: 'flex-start' },
  chipText: { fontSize: 13, fontWeight: '700' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  sectionEnd: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sectionTitle: { fontFamily: serif, fontSize: 16.5, fontWeight: '800' },
  sectionAction: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: radius.card, overflow: 'hidden' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  fieldWrap: { justifyContent: 'center' },
  field: { borderWidth: 1, borderRadius: radius.field, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15.5 },
  trailing: { position: 'absolute', right: 14 },
});
