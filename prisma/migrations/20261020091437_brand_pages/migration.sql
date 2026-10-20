-- CreateTable
CREATE TABLE "brand_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "archived_at" TEXT,
    "verdict_kind" TEXT NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '{}',
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_pages_brand_id_idx" ON "brand_pages"("brand_id");

-- AddForeignKey
ALTER TABLE "brand_pages" ADD CONSTRAINT "brand_pages_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lockdown for the new table (same block as the lockdown migration; AGENTS.md rule 5).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
