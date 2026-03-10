import { NextResponse } from "next/server"
import { askQuestion } from "@/lib/ragChat"

export async function POST(req: Request) {
  try {
    const { question } = await req.json()
    const result = await askQuestion(question)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
