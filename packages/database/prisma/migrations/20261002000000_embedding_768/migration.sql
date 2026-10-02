-- Embeddings are now 768-dimensional: the default local model (Ollama
-- nomic-embed-text) produces 768 dims, and OpenAI text-embedding-3-* models are
-- requested at 768 dims to match. The previous vector(1536) column rejected
-- every local-model insert.
--
-- Existing 1536-dim vectors cannot be converted. Their source text is not
-- stored, so the affected knowledge bases are marked FAILED to signal that
-- they must be re-added.
UPDATE "knowledge_bases"
SET "status" = 'FAILED'
WHERE "id" IN (SELECT DISTINCT "knowledge_base_id" FROM "document_chunks");

DELETE FROM "document_chunks";

ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(768);
