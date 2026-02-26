import { NextRequest, NextResponse } from "next/server";
import { searchEntries } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const results = searchEntries(query);
  return NextResponse.json(results);
}
