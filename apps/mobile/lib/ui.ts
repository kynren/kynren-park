import type { ViewStyle } from 'react-native';
import { useThemePref } from './theme-context';
import { useBrand } from './brand';
import { theme } from './theme';

/** Colours for one screen theme. Screens read these instead of keeping a palette of their own. */
export type UIColors = {
  screen: string;
  card: string;
  /** A recessed field or chip background. */
  soft: string;
  text: string;
  sub: string;
  line: string;
  placeholder: string;
  primary: string;
  /** The primary as text or an icon on a tinted or dark surface: lighter in dark mode so it stays readable. */
  link: string;
  accent: string;
  sky: string;
  /** Pale tint of the primary: inactive chips, quiet badges. */
  tint: string;
  tabBar: string;
  danger: string;
  ok: string;
  warn: string;
};

const light = {
  screen: '#f3ead9',
  card: '#fbf6ec',
  soft: '#ebdfc6',
  text: '#2b2118',
  sub: '#6d5c49',
  line: '#dccdae',
  placeholder: '#a2917a',
  tint: '#e6e1c8',
  tabBar: '#fbf6ec',
};

const dark = {
  screen: '#15120e',
  card: '#201b15',
  soft: '#2b241c',
  text: '#f2e8d3',
  sub: '#b9aa90',
  line: '#3a3126',
  placeholder: '#7d705c',
  tint: '#2a3a2e',
  tabBar: '#1b1712',
};

export const radius = { card: 16, field: 12, pill: 999, chip: 999 } as const;

/** Soft, wide shadows: the cards in the design float rather than outline. */
export function shadow(level: 1 | 2 = 1, isDark = false, direction: 'down' | 'up' = 'down'): ViewStyle {
  const lift = level === 2 ? 10 : 6;
  return {
    shadowColor: isDark ? '#000000' : '#3b2a14',
    shadowOpacity: isDark ? 0.4 : level === 2 ? 0.14 : 0.08,
    shadowRadius: level === 2 ? 22 : 14,
    shadowOffset: { width: 0, height: direction === 'up' ? -lift : lift },
    elevation: level === 2 ? 8 : 4,
  };
}

/** Blend a #rrggbb colour towards white; anything else comes back unchanged. */
function lighten(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const out = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${out.toString(16).padStart(6, '0')}`;
}

export function useUI(): { c: UIColors; dark: boolean } {
  const isDark = useThemePref().scheme === 'dark';
  const { primary, accent } = useBrand();
  const base = isDark ? dark : light;
  return {
    dark: isDark,
    c: { ...base, primary, link: isDark ? lighten(primary, 0.5) : primary, accent, sky: theme.sky, danger: theme.danger, ok: theme.ok, warn: theme.warn },
  };
}
