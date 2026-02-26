import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject, getEntries, listDimensions } from "@/lib/storage";

export async function GET() {
  const projects = listProjects();

  // Include latest entry for each project
  const withActivity = projects.map((p) => {
    const entries = getEntries(p.slug, 1);
    return {
      ...p,
      lastEntry: entries[0] || null,
      entryCount: getEntries(p.slug).length,
      dimensions: listDimensions(p.slug),
    };
  });

  return NextResponse.json(withActivity);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, repoPath } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const project = createProject(name, description, repoPath);
  return NextResponse.json(project, { status: 201 });
}
