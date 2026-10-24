-- CreateTable
CREATE TABLE "SandboxGatewayCharge" (
    "reference" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "gatewayTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SandboxGatewayCharge_pkey" PRIMARY KEY ("reference")
);

-- CreateTable
CREATE TABLE "SandboxGatewayRefund" (
    "id" TEXT NOT NULL,
    "chargeReference" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SandboxGatewayRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SandboxGatewayCharge_gatewayTransactionId_key" ON "SandboxGatewayCharge"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "SandboxGatewayRefund_chargeReference_idx" ON "SandboxGatewayRefund"("chargeReference");
