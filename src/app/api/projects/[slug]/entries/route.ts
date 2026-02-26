import { NextRequest, NextResponse } from "next/server";
import { addEntry, deleteEntry, getProject } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dimension = searchParams.get("dimension") || "main";

  const body = await request.json();
  const { message, tags, files } = body;

  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  const tagList = tags
    ? tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  const fileList = files
    ? files
        .split(",")
        .map((f: string) => f.trim())
        .filter(Boolean)
    : [];

  const entry = addEntry(slug, message, tagList, fileList, dimension);
  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const timestamp = searchParams.get("timestamp");
  const dimension = searchParams.get("dimension") || "main";

  if (!timestamp) {
    return NextResponse.json(
      { error: "Timestamp is required" },
      { status: 400 }
    );
  }

  const deleted = deleteEntry(slug, timestamp, dimension);
  if (!deleted) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
