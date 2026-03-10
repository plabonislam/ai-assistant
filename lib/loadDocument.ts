import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Document } from "@langchain/core/documents";
import { access } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Loads all PDF documents from the "documents" directory
 * and returns a list of Langchain Document objects.
 *
 * @example
 * [
 *   {
 *     pageContent: "How to reset password...",
 *     metadata: { source: "faq.pdf", page: 1 }
 *   }
 * ]
 * @returns {Promise<Document[]>}
 *  A promise that resolves to an array of Document objects
 */
export async function loadDocuments(): Promise<Document[]> {
  const docsDir = path.join(process.cwd(), "documents");
  try {
    await access(docsDir);
  } catch {
    return [];
  }

  const entries = await readdir(docsDir, { withFileTypes: true });
  const pdfFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".pdf"),
  );

  const docs: Document[] = [];

  for (const file of pdfFiles) {
    const filePath = path.join(docsDir, file.name);
    const loader = new PDFLoader(filePath);
    const loaded = await loader.load();
    docs.push(...loaded);
  }

  return docs;
}
