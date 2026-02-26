import { NextRequest, NextResponse } from "next/server";
import { getProject, getEntries, updateProject, listDimensions } from "@/lib/storage";

export async function GET(
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

  const entries = getEntries(slug, undefined, dimension);
  const dimensions = listDimensions(slug);

  return NextResponse.json({ ...project, entries, dimensions });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();
  const updated = updateProject(slug, body);

  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
