import { ChatOpenAI } from "@langchain/openai";
import { MultiQueryRetriever } from "@langchain/classic/retrievers/multi_query";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { loadDocuments } from "./loadDocument";
import { loadNewsLinks } from "./loadNewsLinks";
import { splitDocs } from "./splitDocs";
import { createVectorStore } from "./vectorStore";

type RetrievedDoc = {
  pageContent: string;
  metadata?: Record<string, unknown>;
};

type Retriever = {
  invoke(query: string): Promise<RetrievedDoc[]>;
};

export type AnswerSource = {
  title: string;
  url: string;
  publishedAt: string | null;
};

export type AskQuestionResult = {
  answer: string;
  sources: AnswerSource[];
};

export type IngestNewsResult = {
  ingested: AnswerSource[];
  failed: Array<{ url: string; reason: string }>;
  chunkCount: number;
};

let vectorStore: MemoryVectorStore | undefined;
let retriever: Retriever | undefined;
let initPromise: Promise<void> | undefined;

function createRetriever(store: MemoryVectorStore) {
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  const baseRetriever = store.asRetriever({ k: 8 });

  return MultiQueryRetriever.fromLLM({
    llm,
    retriever: baseRetriever,
    verbose: false,
  });
}

async function ensureKnowledgeBase() {
  if (retriever && vectorStore) return;

  if (!initPromise) {
    initPromise = (async () => {
      console.log("Initializing knowledge base...");
      const docs = await loadDocuments();
      const chunks = await splitDocs(docs);
      vectorStore = await createVectorStore(chunks);
      retriever = createRetriever(vectorStore);
    })();
  }

  await initPromise;
}

function mapDocToSource(doc: RetrievedDoc): AnswerSource | null {
  const url = typeof doc.metadata?.sourceUrl === "string"
    ? doc.metadata.sourceUrl
    : typeof doc.metadata?.source === "string"
      ? doc.metadata.source
      : null;

  if (!url) return null;

  return {
    title: typeof doc.metadata?.title === "string" ? doc.metadata.title : "Source",
    url,
    publishedAt: typeof doc.metadata?.publishedAt === "string" ? doc.metadata.publishedAt : null,
  };
}

function dedupeSources(docs: RetrievedDoc[]) {
  const seen = new Set<string>();
  const sources: AnswerSource[] = [];

  for (const doc of docs) {
    const source = mapDocToSource(doc);
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    sources.push(source);
  }

  return sources;
}

export async function ingestNewsUrls(urls: string[]): Promise<IngestNewsResult> {
  console.log("starting  ingestion of news ")
  await ensureKnowledgeBase();
  console.log("starting  ingestion of news ")
  const { docs, failed } = await loadNewsLinks(urls);
  if (docs.length === 0) {
    return {
      ingested: [],
      failed,
      chunkCount: 0,
    };
  }
 console.log(`Loaded ${docs.length} documents from provided URLs. Proceeding to split and ingest into vector store.`);
  const chunks = await splitDocs(docs);
  console.log(`Split documents into ${chunks.length} chunks. Adding to vector store...`); 
  await vectorStore?.addDocuments(chunks);
  if (vectorStore) {
    retriever = createRetriever(vectorStore);
  }

  return {
    ingested: docs
      .map((doc) => mapDocToSource(doc))
      .filter((source): source is AnswerSource => source !== null),
    failed,
    chunkCount: chunks.length,
  };
}

export async function askQuestion(question: string): Promise<AskQuestionResult> {
  await ensureKnowledgeBase();

  const relevantDocs = await retriever?.invoke(question) ?? [];
  const context = relevantDocs
    .map((doc, index) => {
      const source = mapDocToSource(doc);
      const sourceLabel = source ? `${source.title} (${source.url})` : `Document ${index + 1}`;
      return `[Source ${index + 1}] ${sourceLabel}\n${doc.pageContent}`;
    })
    .join("\n\n");

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  const response = await model.invoke(`
Answer ONLY from the provided context.
If the answer is not in the context say "I don't know".
When you answer, cite the supporting source numbers inline like [Source 1].

Context:
${context || "No context available."}

Question:
${question}
`);

  return {
    answer: Array.isArray(response.content) ? response.content.map((part) => ("text" in part ? part.text : "")).join("") : response.content,
    sources: dedupeSources(relevantDocs),
  };
}
