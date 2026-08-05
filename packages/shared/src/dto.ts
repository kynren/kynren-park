import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums (mirror the Prisma enums; kept here so apps don't need the DB).
// ---------------------------------------------------------------------------

export const attractionCategory = z.enum([
  'BIRDS',
  'HORSE',
  'LAKE',
  'VIKINGS',
  'MAZE',
  'EVENING_SHOW',
  'OTHER',
]);
export type AttractionCategoryValue = z.infer<typeof attractionCategory>;

export const sessionStatus = z.enum(['SCHEDULED', 'DELAYED', 'CANCELLED', 'FULL', 'FINISHED']);
export type SessionStatusValue = z.infer<typeof sessionStatus>;

export const poiType = z.enum([
  'ATTRACTION',
  'RESTAURANT',
  'RESTROOM',
  'SHOP',
  'FIRST_AID',
  'ENTRANCE',
  'PARKING',
  'ACCESSIBILITY',
  'BABY_CHANGING',
  'PICNIC',
  'INFO',
]);
export type PoiTypeValue = z.infer<typeof poiType>;

export const orderStatus = z.enum(['PENDING', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED']);
export type OrderStatusValue = z.infer<typeof orderStatus>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email().nullable(),
    name: z.string().nullable(),
  }),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export const updateSessionStatusSchema = z.object({
  status: sessionStatus,
  revisedStart: z.string().datetime().optional(),
  note: z.string().max(280).optional(),
});
export type UpdateSessionStatusInput = z.infer<typeof updateSessionStatusSchema>;

// ---------------------------------------------------------------------------
// Itinerary planner
// ---------------------------------------------------------------------------

export const optimizeItinerarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  // Attraction slugs or ids the guest wants to see. Empty = "everything".
  attractionIds: z.array(z.string()).default([]),
  // Earliest the guest can start and latest they must finish (HH:mm, park local).
  arrival: z.string().regex(/^\d{2}:\d{2}$/).default('10:30'),
  departure: z.string().regex(/^\d{2}:\d{2}$/).default('18:00'),
  includeEveningShow: z.boolean().default(false),
});
export type OptimizeItineraryInput = z.infer<typeof optimizeItinerarySchema>;

export const plannedStopSchema = z.object({
  showSessionId: z.string(),
  attractionId: z.string(),
  attractionName: z.string(),
  category: attractionCategory,
  startTime: z.string(),
  endTime: z.string(),
  walkSecondsFromPrev: z.number().int().nonnegative(),
  reminderMins: z.number().int().nonnegative(),
});
export type PlannedStop = z.infer<typeof plannedStopSchema>;

export const optimizedItinerarySchema = z.object({
  date: z.string(),
  stops: z.array(plannedStopSchema),
  unschedulable: z.array(z.string()), // attraction names that couldn't be fit
});
export type OptimizedItinerary = z.infer<typeof optimizedItinerarySchema>;

// ---------------------------------------------------------------------------
// Click & Collect
// ---------------------------------------------------------------------------

export const createOrderSchema = z.object({
  restaurantId: z.string(),
  pickupSlot: z.string().datetime(),
  items: z
    .array(z.object({ menuItemId: z.string(), quantity: z.number().int().min(1).max(20) }))
    .min(1),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export const createBookingSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(z.object({ ticketTypeId: z.string(), quantity: z.number().int().min(1).max(20) }))
    .min(1),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const validateTicketSchema = z.object({ qrToken: z.string().min(10) });

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  audience: z.enum(['ALL', 'DATE', 'TICKET_HOLDERS']).default('ALL'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deepLink: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

// ---------------------------------------------------------------------------
// Realtime events (WebSocket payloads)
// ---------------------------------------------------------------------------

export const REALTIME_EVENTS = {
  sessionUpdated: 'session.updated',
  announcement: 'announcement.created',
  orderUpdated: 'order.updated',
} as const;

export const sessionUpdatedEventSchema = z.object({
  id: z.string(),
  attractionId: z.string(),
  status: sessionStatus,
  revisedStart: z.string().nullable(),
  note: z.string().nullable(),
  updatedAt: z.string(),
});
export type SessionUpdatedEvent = z.infer<typeof sessionUpdatedEventSchema>;
