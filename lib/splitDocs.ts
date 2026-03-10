import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import type { Document } from "@langchain/core/documents"

/**
 * Splits an array of LangChain documents into smaller chunks.
 *
 * This function uses RecursiveCharacterTextSplitter to break
 * large document texts into smaller pieces that are easier for
 * embedding models and LLMs to process.
 *
 * Each chunk will have a maximum length of 1000 characters and
 * will overlap the previous chunk by 200 characters to preserve context.
 *
 * @param {Document[]} docs - Array of LangChain Document objects to split.
 *
 * @returns {Promise<Document[]>} A promise that resolves to an array of
 * chunked Document objects. Each document contains:
 * - `pageContent`: the chunked text
 * - `metadata`: metadata inherited from the original document (e.g. source, page)
 
 *
 * @example
 * const docs = await loadDocuments()
 * const chunks = await splitDocs(docs)
 *
 * console.log(chunks)
 *  [
 *   { pageContent: "How to reset password...", metadata: { source: "faq.pdf", page: 1 } },
 *   { pageContent: "Orders can be canceled...", metadata: { source: "faq.pdf", page: 2 } }
 * ]
 */
export async function splitDocs(docs: Document[]) {

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 300,
    chunkOverlap: 150
  })

  return splitter.splitDocuments(docs)
}
