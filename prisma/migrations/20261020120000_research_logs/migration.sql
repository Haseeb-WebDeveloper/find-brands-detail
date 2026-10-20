-- CreateTable
CREATE TABLE "research_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "step" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_logs_brand_id_created_at_idx" ON "research_logs"("brand_id", "created_at");

-- CreateIndex
CREATE INDEX "research_logs_batch_id_created_at_idx" ON "research_logs"("batch_id", "created_at");

-- AddForeignKey
ALTER TABLE "research_logs" ADD CONSTRAINT "research_logs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lockdown for the new table (same block as the lockdown migration; AGENTS.md rule 5).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
