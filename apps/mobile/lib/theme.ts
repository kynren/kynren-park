export const theme = {
  brand: '#8f1d21',
  brandDark: '#6f1518',
  brandLight: '#c0392f',
  ink: '#1a1614',
  muted: '#6b6460',
  bg: '#f6f3ef',
  card: '#ffffff',
  border: '#e4ddd5',
  ok: '#2e7d5b',
  warn: '#b7791f',
  danger: '#b3261e',
  full: '#6b4fa1',
  gold: '#c9a23f',
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
