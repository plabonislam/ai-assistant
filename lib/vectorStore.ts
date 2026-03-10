import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai"
import type { Document } from "@langchain/core/documents"

/**
 * Shared embeddings instance using the OpenAI text-embedding-3-small model.
 * Exported so it can be reused by the MultiQueryRetriever without creating
 * a separate embeddings client.
 */
export const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small"
})

/**
 * Creates a vector store from an array of documents using the OpenAI text-embedding-3-small model.
 *
 * @param {Document[]} docs 
 * - Array of LangChain Document objects to create the vector store from.
 *
 * @returns {Promise<MemoryVectorStore>} 
 * A promise that resolves to a MemoryVectorStore object.
 */
export async function createVectorStore(docs: Document[]) {
  if (docs.length === 0) {
    return new MemoryVectorStore(embeddings)
  }

  const vectorStore = await MemoryVectorStore.fromDocuments(
    docs,
    embeddings
  )

  return vectorStore
}
