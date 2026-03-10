import { NextResponse } from "next/server";
import { ingestNewsUrls } from "@/lib/ragChat";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls = Array.isArray(body?.urls)
      ? body.urls.filter((value): value is string => typeof value === "string")
      : [];

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one BBC news URL." },
        { status: 400 },
      );
    }
    console.log(("Received URLs for ingestion:", urls));
    const result = await ingestNewsUrls(urls);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
