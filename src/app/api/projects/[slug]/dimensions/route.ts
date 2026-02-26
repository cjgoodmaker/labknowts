import { NextRequest, NextResponse } from "next/server";
import { listDimensions, createDimension, deleteDimension, getProject } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const dimensions = listDimensions(slug);
  return NextResponse.json(dimensions);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, fromDimension, fromTimestamp } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const dimension = createDimension(slug, name, fromDimension || "main", fromTimestamp);
    return NextResponse.json(dimension, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const dimension = searchParams.get("dimension");

  if (!dimension) {
    return NextResponse.json({ error: "Dimension query param is required" }, { status: 400 });
  }

  try {
    const deleted = deleteDimension(slug, dimension);
    if (!deleted) {
      return NextResponse.json({ error: "Dimension not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
