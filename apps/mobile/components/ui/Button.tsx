import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Touchable } from '../Touchable';
import { Icon, type IconName } from './Icon';
import { useUI } from '../../lib/ui';

/**
 * The app's one button: a solid blue pill for the main action, a soft tinted pill ("See menu") for the one beside it.
 */
export function Button({
  label,
  onPress,
  icon,
  size = 'md',
  variant = 'solid',
  full = false,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'soft';
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useUI();
  const small = size === 'sm';
  const solid = variant === 'solid';
  const ink = solid ? '#ffffff' : c.link;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { backgroundColor: solid ? c.primary : c.tint, alignSelf: full ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <View style={[styles.row, { paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 18 : 26 }]}>
        {loading ? (
          <ActivityIndicator color={ink} />
        ) : (
          <>
            {icon && <Icon name={icon} color={ink} size={small ? 16 : 19} />}
            <Text style={[styles.label, { color: ink, fontSize: small ? 13 : 15.5 }]}>{label}</Text>
          </>
        )}
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontWeight: '700', letterSpacing: 0.2 },
});
