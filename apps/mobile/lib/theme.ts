import { Platform } from 'react-native';

export const theme = {
  brand: '#2f5b43',
  brandDark: '#1f3d2d',
  brandLight: '#6d9a7e',
  accent: '#8a1f31',
  sky: '#3d6b52',
  ink: '#2b2118',
  muted: '#6d5c49',
  bg: '#f3ead9',
  card: '#fbf6ec',
  border: '#d9c9ab',
  ok: '#2e7d4f',
  warn: '#b9791a',
  danger: '#a3261e',
  full: '#6b4a8a',
  gold: '#b8893a',
};

/** The deep forest-green band behind a main screen's title (Home, Map, the menu). */
export const band = { from: '#1d3a2b', to: '#376348' };

/** Headlines are set in a serif, like the storybook the park tells. */
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }) as string;

/** A header gradient per feature: each part of the app gets its own colour. */
export const featureGradient = {
  restaurants: { from: '#6e1423', to: '#a8452d' },
  tickets: { from: '#2a2118', to: '#5a4630' },
  programme: { from: '#7a5a1e', to: '#c2923f' },
};

export const categoryColor: Record<string, string> = {
  BIRDS: '#3a7ca5',
  HORSE: '#8f5a2b',
  LAKE: '#2e7d5b',
  VIKINGS: '#b3261e',
  MAZE: '#6b4fa1',
  EVENING_SHOW: '#8f1d21',
  OTHER: '#6b6460',
};

export const statusColor: Record<string, string> = {
  SCHEDULED: theme.ok,
  DELAYED: theme.warn,
  CANCELLED: theme.danger,
  FULL: theme.full,
  FINISHED: theme.muted,
};
