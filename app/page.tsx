"use client";

import { FormEvent, useMemo, useState } from "react";

type AnswerSource = {
  title: string;
  url: string;
  publishedAt: string | null;
};

type IngestResult = {
  ingested?: AnswerSource[];
  failed?: Array<{ url: string; reason: string }>;
  chunkCount?: number;
  error?: string;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AnswerSource[]>([]);
  const [newsLinks, setNewsLinks] = useState("");
  const [ingestedSources, setIngestedSources] = useState<AnswerSource[]>([]);
  const [error, setError] = useState("");
  const [ingestMessage, setIngestMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);

  const parsedLinks = useMemo(
    () =>
      newsLinks
        .split("\n")
        .map((link) => link.trim())
        .filter(Boolean),
    [newsLinks],
  );

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmedQuestion }),
      });

      if (!res.ok) {
        const errorData: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Request failed");
      }

      const data: { answer?: string; sources?: AnswerSource[] } = await res.json();
      setAnswer(data.answer ?? "I don't know.");
      setSources(data.sources ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not get an answer. Please try again.";
      setError(message);
      setAnswer("");
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function ingestNews(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsedLinks.length === 0 || isIngesting) return;

    setIsIngesting(true);
    setError("");
    setIngestMessage("");

    try {
      const res = await fetch("/api/knowledge/news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls: parsedLinks }),
      });

      const data: IngestResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not ingest news links.");
      }

      const successful = data.ingested ?? [];
      const failed = data.failed ?? [];

      setIngestedSources((current) => {
        const merged = [...current];
        const seen = new Set(current.map((item) => item.url));

        for (const source of successful) {
          if (seen.has(source.url)) continue;
          seen.add(source.url);
          merged.push(source);
        }

        return merged;
      });

      const parts = [];
      parts.push(`Ingested ${successful.length} BBC article${successful.length === 1 ? "" : "s"}.`);
      if (typeof data.chunkCount === "number") {
        parts.push(`Created ${data.chunkCount} chunks.`);
      }
      if (failed.length > 0) {
        parts.push(`${failed.length} link${failed.length === 1 ? "" : "s"} failed.`);
      }
      setIngestMessage(parts.join(" "));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not ingest BBC links.";
      setError(message);
    } finally {
      setIsIngesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#f5efe2_0%,_#e7ddc8_35%,_#d6c3a1_100%)] px-6 py-10 text-neutral-900 sm:px-10">
      <section className="mx-auto grid w-full max-w-7xl gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[2rem] border border-black/10 bg-[linear-gradient(160deg,_rgba(255,249,240,0.96),_rgba(244,231,204,0.92))] p-8 shadow-[0_28px_80px_-24px_rgba(56,32,9,0.35)]">
          <p className="mb-3 inline-flex rounded-full border border-red-900/15 bg-red-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            BBC News RAG
          </p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Build a chatbot
            <span className="block text-red-800">from BBC article links.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-700 sm:text-lg">
            Paste BBC News article URLs, ingest them into the knowledge base, then ask questions and get answers constrained to those articles.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <p className="text-sm font-semibold text-neutral-900">BBC-only ingestion</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                The server accepts BBC News URLs and extracts article text for retrieval.
              </p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white/70 p-5">
              <p className="text-sm font-semibold text-neutral-900">Memory-backed</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Ingested links stay available until the server restarts. They are not persisted yet.
              </p>
            </div>
          </div>

          <form onSubmit={ingestNews} className="mt-8 rounded-[1.75rem] border border-black/10 bg-white/65 p-6">
            <label htmlFor="news-links" className="block text-sm font-semibold uppercase tracking-[0.14em] text-neutral-700">
              BBC article URLs
            </label>
            <textarea
              id="news-links"
              value={newsLinks}
              onChange={(event) => setNewsLinks(event.target.value)}
              placeholder={"https://www.bbc.com/news/articles/...\nhttps://www.bbc.com/news/world-..."}
              className="mt-3 h-40 w-full resize-y rounded-3xl border border-black/10 bg-[#fffdf8] px-4 py-4 text-sm leading-6 text-neutral-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/20"
            />
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-neutral-500">
                One BBC URL per line. Non-BBC or non-news URLs are rejected.
              </p>
              <button
                type="submit"
                disabled={isIngesting || parsedLinks.length === 0}
                className="rounded-2xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-700/45"
              >
                {isIngesting ? "Ingesting..." : "Ingest Links"}
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-[1.75rem] border border-black/10 bg-white/65 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Knowledge Base</p>
            {ingestMessage ? <p className="mt-3 text-sm text-neutral-700">{ingestMessage}</p> : null}
            {ingestedSources.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-neutral-800">
                {ingestedSources.map((source) => (
                  <li key={source.url} className="rounded-2xl border border-black/10 bg-[#fffaf1] p-4">
                    <p className="font-semibold">{source.title}</p>
                    <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-red-800 underline decoration-red-800/40 underline-offset-2">
                      {source.url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">
                No BBC links ingested yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-black/15 bg-[#111111] p-6 text-neutral-100 shadow-[0_34px_80px_-30px_rgba(0,0,0,0.68)] sm:p-8">
          <form onSubmit={ask} className="space-y-4">
            <label htmlFor="question" className="block text-sm font-medium text-neutral-300">
              Ask a question grounded in the ingested BBC articles
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Example: What did the article say about the policy change?"
              className="h-36 w-full resize-y rounded-3xl border border-neutral-700 bg-neutral-900/80 px-4 py-4 text-sm leading-6 text-neutral-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-400">Ask only after ingesting one or more BBC links.</p>
              <button
                type="submit"
                disabled={isLoading || question.trim().length === 0}
                className="rounded-2xl bg-[#f5d44d] px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-[#f1ca22] disabled:cursor-not-allowed disabled:bg-[#f5d44d]/50"
              >
                {isLoading ? "Thinking..." : "Ask"}
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-[1.75rem] border border-neutral-800 bg-neutral-900/85 p-5">
            <p className="mb-2 break-all text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
              Response
            </p>
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : answer ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-100">
                {answer}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">
                Your grounded answer will appear here after you submit a question.
              </p>
            )}
          </div>

          <div className="mt-5 rounded-[1.75rem] border border-neutral-800 bg-neutral-900/85 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Sources</p>
            {sources.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {sources.map((source) => (
                  <li key={source.url} className="rounded-2xl border border-neutral-800 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-neutral-100">{source.title}</p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-xs text-[#f5d44d] underline decoration-[#f5d44d]/50 underline-offset-2"
                    >
                      {source.url}
                    </a>
                    {source.publishedAt ? (
                      <p className="mt-1 text-xs text-neutral-400">{new Date(source.publishedAt).toLocaleString()}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">
                Retrieved sources will be listed here.
              </p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
