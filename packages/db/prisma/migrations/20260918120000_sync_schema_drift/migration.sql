-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "recurrence" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "startAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Attraction" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ItineraryItem" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PointOfInterest" ADD COLUMN     "color" TEXT,
ADD COLUMN     "heroImage" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "openingHours" TEXT;

-- AlterTable
ALTER TABLE "PushToken" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StaffUser" ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklySession" (
    "id" TEXT NOT NULL,
    "attractionId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkMap" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "bgColor" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branding" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "appName" TEXT NOT NULL DEFAULT 'Kynren',
    "tagline" TEXT NOT NULL DEFAULT 'The Storied Lands',
    "primary" TEXT NOT NULL DEFAULT '#8f1d21',
    "accent" TEXT NOT NULL DEFAULT '#22b365',
    "font" TEXT NOT NULL DEFAULT 'system',
    "logoUrl" TEXT,
    "iconUrl" TEXT,
    "faviconUrl" TEXT,
    "splashType" TEXT NOT NULL DEFAULT 'none',
    "splashMediaUrl" TEXT,
    "seasonOpens" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapConfig" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "markerColor" TEXT NOT NULL DEFAULT '#1a73e8',
    "markerStyle" TEXT NOT NULL DEFAULT 'pulse',
    "mapImageUrl" TEXT,
    "minLat" DOUBLE PRECISION,
    "maxLat" DOUBLE PRECISION,
    "minLng" DOUBLE PRECISION,
    "maxLng" DOUBLE PRECISION,
    "initialZoom" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "maxZoom" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "popupAnimation" TEXT NOT NULL DEFAULT 'scale',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleRoute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShuttleRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "poiId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "times" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ShuttleStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmeetzLinkedOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderReference" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmeetzLinkedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "heroImage" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openingHours" TEXT,
    "poiId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "variants" JSONB,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "sound" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalkthroughConfig" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalkthroughConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalkthroughStep" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "screen" TEXT NOT NULL DEFAULT 'index',
    "position" TEXT NOT NULL DEFAULT 'bottom',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalkthroughStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "detail" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ManagedImage" (
    "key" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageUrlDark" TEXT,
    "fit" TEXT NOT NULL DEFAULT 'cover',
    "position" TEXT NOT NULL DEFAULT 'center',
    "fade" TEXT NOT NULL DEFAULT 'none',
    "animation" TEXT NOT NULL DEFAULT 'fade',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedImage_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "HomeScreen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "heroType" TEXT NOT NULL DEFAULT 'none',
    "heroMediaUrl" TEXT,
    "tagline" TEXT,
    "greeting" TEXT,
    "greetingSub" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "sections" JSONB,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeScreen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE INDEX "WeeklySession_dayOfWeek_idx" ON "WeeklySession"("dayOfWeek");

-- CreateIndex
CREATE INDEX "WeeklySession_attractionId_idx" ON "WeeklySession"("attractionId");

-- CreateIndex
CREATE INDEX "ParkMap_isDefault_idx" ON "ParkMap"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Branding_singleton_key" ON "Branding"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "MapConfig_singleton_key" ON "MapConfig"("singleton");

-- CreateIndex
CREATE INDEX "ShuttleStop_routeId_idx" ON "ShuttleStop"("routeId");

-- CreateIndex
CREATE INDEX "SmeetzLinkedOrder_userId_idx" ON "SmeetzLinkedOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SmeetzLinkedOrder_userId_orderReference_key" ON "SmeetzLinkedOrder"("userId", "orderReference");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_poiId_key" ON "Shop"("poiId");

-- CreateIndex
CREATE INDEX "ShopItem_shopId_idx" ON "ShopItem"("shopId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalkthroughConfig_singleton_key" ON "WalkthroughConfig"("singleton");

-- CreateIndex
CREATE INDEX "HealthCheck_component_checkedAt_idx" ON "HealthCheck"("component", "checkedAt");

-- CreateIndex
CREATE INDEX "HealthCheck_checkedAt_idx" ON "HealthCheck"("checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_inviteToken_key" ON "StaffUser"("inviteToken");

-- AddForeignKey
ALTER TABLE "WeeklySession" ADD CONSTRAINT "WeeklySession_attractionId_fkey" FOREIGN KEY ("attractionId") REFERENCES "Attraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleStop" ADD CONSTRAINT "ShuttleStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleStop" ADD CONSTRAINT "ShuttleStop_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "PointOfInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmeetzLinkedOrder" ADD CONSTRAINT "SmeetzLinkedOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "PointOfInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopItem" ADD CONSTRAINT "ShopItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
