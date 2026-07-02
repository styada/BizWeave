-- Bizweave — pgvector + embedding indexes + RLS baseline.
-- Run AFTER `prisma db push` (Prisma manages the tables/columns; this adds the
-- vector extension, HNSW indexes, and Row-Level Security). Appendix D.6.

-- 1) pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Ensure embedding columns exist (Prisma emits them as Unsupported("vector"))
ALTER TABLE "MemoryEntry" ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE "Competitor"  ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE "Skill"       ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3) ANN indexes (cosine)
CREATE INDEX IF NOT EXISTS memory_embedding_idx
  ON "MemoryEntry" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS competitor_embedding_idx
  ON "Competitor" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS skill_embedding_idx
  ON "Skill" USING hnsw (embedding vector_cosine_ops);

-- 4) Row-Level Security (Phase 16). Enable per tenant table and add a policy
--    keyed on a request-scoped GUC (`app.user_id` / `app.business_id`) set by
--    the app at the start of each request/transaction.
--    Example for the top-level owner-scoped table:
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Business";
CREATE POLICY tenant_isolation ON "Business"
  USING ("userId" = current_setting('app.user_id', true));

-- Repeat the pattern for each business-scoped table (keyed by businessId that
-- must belong to the current user). See scripts/apply-rls.sql for the full set.
