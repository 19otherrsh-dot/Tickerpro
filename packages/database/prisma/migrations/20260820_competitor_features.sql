-- TickerPro — Migration: competitor-features
-- Adds 6 new columns across 3 models for Wati/DoubleTick feature parity.
-- Apply with: psql $DATABASE_URL -f migration.sql
-- Or: npx prisma migrate deploy (once DATABASE_URL is configured)

-- Feature 1: Configurable SLA threshold per workspace (replaces hardcoded 15min)
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "sla_response_minutes" INTEGER;

-- Feature 3: Phone number masking flag for agent privacy
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "mask_phone_numbers" BOOLEAN NOT NULL DEFAULT false;

-- Feature 2: Birthday & anniversary fields on contacts for drip campaign triggers
ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "birthday" TEXT,
  ADD COLUMN IF NOT EXISTS "anniversary" TEXT;

-- Feature 4: AI CX quality score fields on conversations (0-10 scale)
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "cx_score" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "cx_score_reason" TEXT;
