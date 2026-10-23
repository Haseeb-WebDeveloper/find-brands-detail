-- CreateTable
CREATE TABLE "ai_calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand_id" UUID,
    "brand_name" TEXT,
    "batch_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "duration_ms" INTEGER NOT NULL,
    "requests_left" INTEGER,
    "requests_limit" INTEGER,
    "rate_headers" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_calls_created_at_idx" ON "ai_calls"("created_at");

-- CreateIndex
CREATE INDEX "ai_calls_brand_id_idx" ON "ai_calls"("brand_id");


-- Lockdown for the new table (same block as the lockdown migration; AGENTS.md rule 5).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
