import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/apiAuth";

/**
 * Resolve a design by walking the folder path within a project.
 * Path format: "folder/subfolder/design-name" (no .md extension)
 */
export async function resolveDesignByPath(projectId: string, filePath: string) {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const designName = parts.pop()!;

  // Walk the folder tree
  let currentParentId: string | null = null;
  for (const folderName of parts) {
    const folder = await prisma.folder.findFirst({
      where: { projectId, parentId: currentParentId, name: folderName },
    });
    if (!folder) return null;
    currentParentId = folder.id;
  }

  if (!currentParentId) return null;

  const design = await prisma.design.findFirst({
    where: {
      folderId: currentParentId,
      name: designName,
      type: "MARKDOWN",
    },
    select: { id: true, name: true, content: true, folderId: true },
  });

  return design;
}

async function buildDesignPath(design: { folderId: string; name: string }): Promise<string> {
  const parts: string[] = [];
  let currentId: string | null = design.folderId;
  while (currentId) {
    const folder = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { name: true, parentId: true },
    });
    if (!folder) break;
    parts.unshift(folder.name);
    currentId = folder.parentId;
  }
  parts.push(design.name);
  return parts.join("/");
}

async function resolveProject(nameOrId: string) {
  const byId = await prisma.project.findUnique({ where: { id: nameOrId } });
  if (byId) return byId;
  return prisma.project.findFirst({ where: { name: nameOrId } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const projectParam = searchParams.get("project");
  const filePath = searchParams.get("path");

  if (!projectParam || !filePath) {
    return NextResponse.json(
      { error: "project and path query params required" },
      { status: 400 }
    );
  }

  const project = await resolveProject(projectParam);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const design = await resolveDesignByPath(project.id, filePath);
  if (!design) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const path = await buildDesignPath(design);

  return NextResponse.json({
    path,
    name: design.name,
    content: design.content,
    designId: design.id,
    folderId: design.folderId,
  });
}

export async function POST(request: NextRequest) {
  const { user } = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, destPath, name, content, overwrite } = body;

  if (!projectId || !name || content === undefined) {
    return NextResponse.json(
      { error: "projectId, name, and content are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Ensure user has a root folder in this project
  let rootFolder = await prisma.folder.findFirst({
    where: { projectId, ownerUsername: user.username, parentId: null },
  });
  if (!rootFolder) {
    rootFolder = await prisma.folder.create({
      data: { name: user.username, projectId, ownerUsername: user.username, order: 0 },
    });
  }

  // Walk/create destination folder path under user's root
  let currentFolderId = rootFolder.id;
  if (destPath) {
    const folders = destPath.split("/").filter(Boolean);
    for (const folderName of folders) {
      const existing = await prisma.folder.findFirst({
        where: { projectId, parentId: currentFolderId, name: folderName },
      });
      if (existing) {
        currentFolderId = existing.id;
      } else {
        const maxOrder = await prisma.folder.aggregate({
          where: { projectId, parentId: currentFolderId },
          _max: { order: true },
        });
        const created = await prisma.folder.create({
          data: {
            name: folderName,
            projectId,
            parentId: currentFolderId,
            order: (maxOrder._max.order ?? -1) + 1,
          },
        });
        currentFolderId = created.id;
      }
    }
  }

  // Check if design already exists
  const designName = name.replace(/\.(md|markdown)$/i, "");
  const existing = await prisma.design.findFirst({
    where: { folderId: currentFolderId, name: designName },
  });

  if (existing) {
    if (!overwrite) {
      return NextResponse.json(
        { error: "File already exists. Use overwrite option to create a new version." },
        { status: 409 }
      );
    }

    const newVersion = existing.currentVersion + 1;
    await prisma.design.update({
      where: { id: existing.id },
      data: {
        content,
        currentVersion: newVersion,
        versions: { create: { version: newVersion, content } },
      },
    });

    const path = await buildDesignPath({ folderId: currentFolderId, name: designName });
    return NextResponse.json({ path, status: "versioned", designId: existing.id });
  }

  const maxOrder = await prisma.design.aggregate({
    where: { folderId: currentFolderId },
    _max: { order: true },
  });

  const design = await prisma.design.create({
    data: {
      name: designName,
      type: "MARKDOWN",
      status: "DRAFT",
      content,
      folderId: currentFolderId,
      currentVersion: 1,
      order: (maxOrder._max.order ?? -1) + 1,
      versions: { create: { version: 1, content } },
    },
  });

  const path = await buildDesignPath({ folderId: currentFolderId, name: designName });
  return NextResponse.json({ path, status: "created", designId: design.id }, { status: 201 });
}
