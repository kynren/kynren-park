/**
 * Vendored slice of @kynren/shared used by the mobile app.
 *
 * The mobile app is intentionally NOT an npm workspace (see the root
 * package.json note): being a workspace made npm hoist its React Native
 * dependencies inconsistently, which broke Metro bundling and EAS Gradle
 * builds. Keeping the app standalone gives it a clean Expo node_modules.
 * These few constants/types are copied from packages/shared so the app has
 * no cross-workspace dependency. Keep in sync if the API contract changes.
 */

// Mirrors packages/shared REALTIME_EVENTS.
export const REALTIME_EVENTS = {
  sessionUpdated: 'session.updated',
  announcement: 'announcement.created',
  orderUpdated: 'order.updated',
} as const;

export interface SessionUpdatedEvent {
  id: string;
  attractionId: string;
  status: string;
  revisedStart: string | null;
  note: string | null;
  updatedAt: string;
}

export interface PlannedStop {
  showSessionId: string;
  attractionId: string;
  attractionName: string;
  category: string;
  startTime: string;
  endTime: string;
  walkSecondsFromPrev: number;
  reminderMins: number;
}

export interface OptimizedItinerary {
  date: string;
  stops: PlannedStop[];
  unschedulable: string[];
}
