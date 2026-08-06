import * as Haptics from 'expo-haptics';

// Thin, safe wrappers so a haptic never throws (e.g. web, or unsupported device).
export const tapLight = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const tapMedium = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };
export const tapHeavy = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); };
export const selection = () => { Haptics.selectionAsync().catch(() => {}); };
export const notifySuccess = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const notifyWarning = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); };
export const notifyError = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); };
