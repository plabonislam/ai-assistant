import { Document } from "@langchain/core/documents";

type BbcArticle = {
  url: string;
  title: string;
  publishedAt: string | null;
  content: string;
};

const BBC_HOSTS = new Set(["www.bbc.com", "bbc.com", "www.bbc.co.uk", "bbc.co.uk"]);

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }

  return null;
}

function extractJsonLd(html: string) {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const block of matches) {
    const jsonMatch = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!jsonMatch?.[1]) continue;

    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      const entries = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of entries) {
        const candidates = Array.isArray(entry?.["@graph"]) ? entry["@graph"] : [entry];

        for (const candidate of candidates) {
          const type = candidate?.["@type"];
          const types = Array.isArray(type) ? type : [type];

          if (types.some((item) => typeof item === "string" && /NewsArticle|Article/i.test(item))) {
            return candidate;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractParagraphs(html: string) {
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  const source = mainMatch?.[0] ?? html;
  const paragraphs = [...source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(stripTags(match[1])))
    .filter((paragraph) => paragraph.length > 40);

  return paragraphs;
}

function parseBbcArticle(html: string, url: string): BbcArticle {
  const jsonLd = extractJsonLd(html);
  const title =
    (typeof jsonLd?.headline === "string" ? jsonLd.headline : null) ??
    extractMetaContent(html, "og:title") ??
    extractMetaContent(html, "twitter:title") ??
    normalizeWhitespace(stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")) ??
    "BBC News Article";

  const publishedAt =
    (typeof jsonLd?.datePublished === "string" ? jsonLd.datePublished : null) ??
    extractMetaContent(html, "article:published_time");

  const articleBody =
    typeof jsonLd?.articleBody === "string" ? normalizeWhitespace(jsonLd.articleBody) : null;

  const paragraphs = articleBody ? [articleBody] : extractParagraphs(html);
  const content = normalizeWhitespace(paragraphs.join("\n\n"));

  if (!content) {
    throw new Error("Could not extract article body.");
  }

  return {
    url,
    title: normalizeWhitespace(title),
    publishedAt,
    content,
  };
}

function validateBbcUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported.");
  }

  if (!BBC_HOSTS.has(parsed.hostname)) {
    throw new Error("Only BBC URLs are supported.");
  }

  if (!parsed.pathname.startsWith("/news")) {
    throw new Error("Only BBC news article URLs are supported.");
  }

  parsed.hash = "";

  return parsed.toString();
}

export async function loadNewsLinks(urls: string[]) {
  const docs: Document[] = [];
  const failed: Array<{ url: string; reason: string }> = [];

  for (const rawUrl of urls) {
    try {
      const url = validateBbcUrl(rawUrl.trim());
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; chat-bot/1.0; +https://example.com/bot)",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}.`);
      }

      const html = await response.text();
      const article = parseBbcArticle(html, url);

      docs.push(
        new Document({
          pageContent: article.content,
          metadata: {
            source: article.url,
            sourceUrl: article.url,
            title: article.title,
            publishedAt: article.publishedAt,
            domain: "bbc.com",
            publisher: "BBC",
            contentType: "news",
          },
        }),
      );
    } catch (error) {
      failed.push({
        url: rawUrl,
        reason: error instanceof Error ? error.message : "Unknown ingestion error.",
      });
    }
  }

  return { docs, failed };
}
