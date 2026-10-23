-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'support', 'finance', 'admin');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ESIM', 'VERIFICATION', 'RENTAL');

-- CreateEnum
CREATE TYPE "SupplierMode" AS ENUM ('LIVE', 'SANDBOX');

-- CreateEnum
CREATE TYPE "DestinationKind" AS ENUM ('COUNTRY', 'REGION', 'GLOBAL');

-- CreateEnum
CREATE TYPE "SyncKind" AS ENUM ('ESIM_DESTINATIONS', 'ESIM_PACKAGES', 'VERIFICATION_COUNTRIES', 'VERIFICATION_SERVICES', 'VERIFICATION_PRICING', 'RENTAL_COUNTRIES', 'RENTAL_PRICING');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'AWAITING_PAYMENT', 'PAID', 'FULFILLING', 'FULFILLED', 'NEEDS_REVIEW', 'FAILED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'CUSTOMER', 'STAFF', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'SANDBOX');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIALIZED', 'PENDING', 'SUCCEEDED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PENDING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('PENDING', 'SUBMITTING', 'AWAITING_SUPPLIER', 'SUCCEEDED', 'UNCERTAIN', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "EsimStatus" AS ENUM ('PREPARING', 'READY', 'ACTIVE', 'EXPIRED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('WAITING', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('PAYSTACK', 'SANDBOX_PAYMENT', 'SUPPLIER_1001SMS', 'SUPPLIER_SANDBOX');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('GATEWAY_CLEARING', 'SALES_REVENUE', 'CUSTOMER_REFUNDS', 'GATEWAY_FEES', 'SUPPLIER_COST', 'SUPPLIER_PREPAID');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'AWAITING_CUSTOMER', 'AWAITING_STAFF', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('PAYMENT', 'ESIM_INSTALLATION', 'UNSUPPORTED_DEVICE', 'MISSING_SMS', 'NUMBER_EXPIRATION', 'SUPPLIER_FAILURE', 'REFUND_REQUEST', 'ACCOUNT_SECURITY', 'ABUSE_REPORT', 'DATA_DELETION', 'OTHER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMPTZ(3),
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "countryCode" CHAR(2),
    "acceptedTermsAt" TIMESTAMPTZ(3),
    "acceptedAupAt" TIMESTAMPTZ(3),
    "deletionRequestedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "SupplierMode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priceCurrency" CHAR(3) NOT NULL,
    "lastHealthAt" TIMESTAMPTZ(3),
    "lastHealthOk" BOOLEAN,
    "lastHealthError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBalanceSnapshot" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSyncLog" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "kind" "SyncKind" NOT NULL,
    "scope" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "itemsUpserted" INTEGER NOT NULL DEFAULT 0,
    "itemsDeactivated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CatalogSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" UUID NOT NULL,
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phoneCode" TEXT,
    "continent" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "hasVerification" BOOLEAN NOT NULL DEFAULT false,
    "hasRentals" BOOLEAN NOT NULL DEFAULT false,
    "offersSyncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimDestination" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "locationCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "DestinationKind" NOT NULL,
    "countryId" UUID,
    "packageCount" INTEGER NOT NULL DEFAULT 0,
    "fromCost" DECIMAL(18,4),
    "topSpeed" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "packagesSyncedAt" TIMESTAMPTZ(3),
    "lastSyncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EsimDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "type" "ProductType" NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierProductCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "destinationId" UUID,
    "countryId" UUID,
    "serviceId" UUID,
    "dataVolumeBytes" BIGINT,
    "dataLabel" TEXT,
    "validityDays" INTEGER,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "pricingUnit" TEXT,
    "speed" TEXT,
    "fupPolicy" TEXT,
    "ipExport" TEXT,
    "includesPhoneNumber" BOOLEAN NOT NULL DEFAULT false,
    "includesSms" BOOLEAN NOT NULL DEFAULT false,
    "includesVoice" BOOLEAN NOT NULL DEFAULT false,
    "providerTier" TEXT,
    "operator" TEXT,
    "stockCount" INTEGER,
    "deliverability" INTEGER,
    "rentalTerm" TEXT,
    "rentalType" TEXT,
    "durationHours" INTEGER,
    "wholesaleCost" DECIMAL(18,4) NOT NULL,
    "wholesaleCurrency" CHAR(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "productType" "ProductType",
    "countryId" UUID,
    "destinationId" UUID,
    "serviceId" UUID,
    "productId" UUID,
    "markupPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "markupFixed" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "minProfit" DECIMAL(18,4),
    "currency" CHAR(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "quoteCurrency" CHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "percentOff" DECIMAL(7,4),
    "amountOff" DECIMAL(18,4),
    "currency" CHAR(3),
    "productType" "ProductType",
    "minOrderAmount" DECIMAL(18,4),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "statusReason" TEXT,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL,
    "supplierCostTotal" DECIMAL(18,4) NOT NULL,
    "supplierCurrency" CHAR(3) NOT NULL,
    "exchangeRateValue" DECIMAL(20,10),
    "exchangeRateId" UUID,
    "promotionId" UUID,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "fulfilledAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productType" "ProductType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "wholesaleCost" DECIMAL(18,4) NOT NULL,
    "wholesaleCurrency" CHAR(3) NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "reason" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "reference" TEXT NOT NULL,
    "gatewayTransactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIALIZED',
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "authorizationUrl" TEXT,
    "channel" TEXT,
    "gatewayFee" DECIMAL(18,4),
    "failureReason" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "initiatedByType" "ActorType" NOT NULL,
    "initiatedById" TEXT,
    "gatewayRefundId" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fulfilment" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "status" "FulfilmentStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "supplierOrderRef" TEXT,
    "supplierCost" DECIMAL(18,4),
    "lastErrorCode" TEXT,
    "lastError" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Fulfilment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsimActivation" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierOrderRef" TEXT NOT NULL,
    "supplierProfileId" TEXT NOT NULL,
    "iccid" TEXT,
    "activationCodeEnc" TEXT,
    "qrCodeUrlEnc" TEXT,
    "apn" TEXT,
    "status" "EsimStatus" NOT NULL DEFAULT 'PREPARING',
    "supplierStatus" TEXT,
    "totalVolumeBytes" BIGINT,
    "usedVolumeBytes" BIGINT,
    "activatedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "lastRefreshedAt" TIMESTAMPTZ(3),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EsimActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationActivation" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierOrderRef" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "serviceSlug" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "operator" TEXT,
    "providerTier" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'WAITING',
    "supplierStatus" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastCheckedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "supplierRefundAmount" DECIMAL(18,4),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VerificationActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumberRental" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierNumberId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "rentalType" TEXT NOT NULL,
    "serviceSlug" TEXT,
    "serviceName" TEXT,
    "term" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'ACTIVE',
    "rentedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "reminderSentAt" TIMESTAMPTZ(3),
    "lastCheckedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PhoneNumberRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingSmsMessage" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierMessageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationId" UUID,
    "rentalId" UUID,
    "sender" TEXT,
    "bodyEnc" TEXT NOT NULL,
    "codeEnc" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingSmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "source" "WebhookSource" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "runAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "journalRef" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "orderId" UUID,
    "paymentId" UUID,
    "refundId" UUID,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMPTZ(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" UUID NOT NULL,
    "userId" TEXT,
    "toAddress" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "devPreview" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" UUID,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "SupplierBalanceSnapshot_supplierId_capturedAt_idx" ON "SupplierBalanceSnapshot"("supplierId", "capturedAt");

-- CreateIndex
CREATE INDEX "CatalogSyncLog_supplierId_kind_startedAt_idx" ON "CatalogSyncLog"("supplierId", "kind", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Country_slug_key" ON "Country"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EsimDestination_slug_key" ON "EsimDestination"("slug");

-- CreateIndex
CREATE INDEX "EsimDestination_kind_isActive_isEnabled_idx" ON "EsimDestination"("kind", "isActive", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "EsimDestination_supplierId_locationCode_key" ON "EsimDestination"("supplierId", "locationCode");

-- CreateIndex
CREATE INDEX "Service_isActive_isEnabled_popular_idx" ON "Service"("isActive", "isEnabled", "popular");

-- CreateIndex
CREATE UNIQUE INDEX "Service_supplierId_slug_key" ON "Service"("supplierId", "slug");

-- CreateIndex
CREATE INDEX "Product_type_isActive_isVisible_idx" ON "Product"("type", "isActive", "isVisible");

-- CreateIndex
CREATE INDEX "Product_destinationId_isActive_idx" ON "Product"("destinationId", "isActive");

-- CreateIndex
CREATE INDEX "Product_countryId_serviceId_type_idx" ON "Product"("countryId", "serviceId", "type");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_supplierId_type_supplierProductCode_key" ON "Product"("supplierId", "type", "supplierProductCode");

-- CreateIndex
CREATE INDEX "PricingRule_isActive_productType_idx" ON "PricingRule"("isActive", "productType");

-- CreateIndex
CREATE INDEX "ExchangeRate_baseCurrency_quoteCurrency_effectiveAt_idx" ON "ExchangeRate"("baseCurrency", "quoteCurrency", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_updatedAt_idx" ON "Order"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_gatewayRefundId_key" ON "Refund"("gatewayRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfilment_orderItemId_key" ON "Fulfilment"("orderItemId");

-- CreateIndex
CREATE INDEX "Fulfilment_status_updatedAt_idx" ON "Fulfilment"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfilment_supplierId_supplierOrderRef_key" ON "Fulfilment"("supplierId", "supplierOrderRef");

-- CreateIndex
CREATE INDEX "EsimActivation_userId_createdAt_idx" ON "EsimActivation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EsimActivation_supplierOrderRef_idx" ON "EsimActivation"("supplierOrderRef");

-- CreateIndex
CREATE UNIQUE INDEX "EsimActivation_supplierId_supplierProfileId_key" ON "EsimActivation"("supplierId", "supplierProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationActivation_orderItemId_key" ON "VerificationActivation"("orderItemId");

-- CreateIndex
CREATE INDEX "VerificationActivation_userId_createdAt_idx" ON "VerificationActivation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationActivation_status_expiresAt_idx" ON "VerificationActivation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationActivation_supplierId_supplierOrderRef_key" ON "VerificationActivation"("supplierId", "supplierOrderRef");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumberRental_orderItemId_key" ON "PhoneNumberRental"("orderItemId");

-- CreateIndex
CREATE INDEX "PhoneNumberRental_userId_createdAt_idx" ON "PhoneNumberRental"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneNumberRental_status_expiresAt_idx" ON "PhoneNumberRental"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumberRental_supplierId_supplierNumberId_key" ON "PhoneNumberRental"("supplierId", "supplierNumberId");

-- CreateIndex
CREATE INDEX "IncomingSmsMessage_verificationId_receivedAt_idx" ON "IncomingSmsMessage"("verificationId", "receivedAt");

-- CreateIndex
CREATE INDEX "IncomingSmsMessage_rentalId_receivedAt_idx" ON "IncomingSmsMessage"("rentalId", "receivedAt");

-- CreateIndex
CREATE INDEX "IncomingSmsMessage_userId_receivedAt_idx" ON "IncomingSmsMessage"("userId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingSmsMessage_supplierId_supplierMessageId_key" ON "IncomingSmsMessage"("supplierId", "supplierMessageId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_externalEventId_key" ON "WebhookEvent"("source", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_dedupeKey_key" ON "Job"("dedupeKey");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "LedgerEntry_account_createdAt_idx" ON "LedgerEntry"("account", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_journalRef_account_direction_key" ON "LedgerEntry"("journalRef", "account", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_dedupeKey_key" ON "EmailDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_toAddress_createdAt_idx" ON "EmailDelivery"("toAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_updatedAt_idx" ON "SupportTicket"("status", "priority", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBalanceSnapshot" ADD CONSTRAINT "SupplierBalanceSnapshot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSyncLog" ADD CONSTRAINT "CatalogSyncLog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimDestination" ADD CONSTRAINT "EsimDestination_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimDestination" ADD CONSTRAINT "EsimDestination_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "EsimDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "EsimDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "ExchangeRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimActivation" ADD CONSTRAINT "EsimActivation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsimActivation" ADD CONSTRAINT "EsimActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationActivation" ADD CONSTRAINT "VerificationActivation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationActivation" ADD CONSTRAINT "VerificationActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumberRental" ADD CONSTRAINT "PhoneNumberRental_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumberRental" ADD CONSTRAINT "PhoneNumberRental_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingSmsMessage" ADD CONSTRAINT "IncomingSmsMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingSmsMessage" ADD CONSTRAINT "IncomingSmsMessage_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "VerificationActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingSmsMessage" ADD CONSTRAINT "IncomingSmsMessage_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "PhoneNumberRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only financial ledger: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION ledger_entry_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry rows are immutable; post a reversing journal instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_no_update"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_immutable();
