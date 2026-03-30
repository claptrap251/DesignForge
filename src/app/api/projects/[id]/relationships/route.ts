import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeRelationships } from "@/lib/similarity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("designId");
  const thresholdParam = searchParams.get("threshold");
  let threshold = 0.1;
  if (thresholdParam) {
    const parsed = parseFloat(thresholdParam);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      threshold = parsed;
    }
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch all markdown designs in the project
  const designs = await prisma.design.findMany({
    where: {
      folder: { projectId: id },
      type: "MARKDOWN",
      content: { not: null },
    },
    select: {
      id: true,
      name: true,
      content: true,
      folderId: true,
      folder: {
        select: { name: true, ownerUsername: true },
      },
    },
  });

  const designsForScoring = designs
    .filter((d) => d.content && d.content.trim().length > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      content: d.content!,
    }));

  let relationships = await computeRelationships(designsForScoring, threshold);

  // Filter to a specific design if requested
  if (designId) {
    relationships = relationships.filter(
      (r) => r.docAId === designId || r.docBId === designId
    );
  }

  // Build folder path for each design by walking up the folder tree
  const folderPathCache = new Map<string, { id: string; name: string }[]>();
  async function getFolderPath(folderId: string): Promise<{ id: string; name: string }[]> {
    if (folderPathCache.has(folderId)) return folderPathCache.get(folderId)!;
    const path: { id: string; name: string }[] = [];
    let currentId: string | null = folderId;
    while (currentId) {
      const folder = await prisma.folder.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
      if (!folder) break;
      path.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }
    folderPathCache.set(folderId, path);
    return path;
  }

  // Collect folder IDs referenced in the filtered relationships
  const relatedIds = new Set<string>();
  for (const r of relationships) {
    relatedIds.add(r.docAId);
    relatedIds.add(r.docBId);
  }

  const folderInfoMap = new Map<string, { owner: string | null; folderPath: { id: string; name: string }[] }>();
  for (const d of designs) {
    if (!relatedIds.has(d.id)) continue;
    const folderPath = await getFolderPath(d.folderId);
    folderInfoMap.set(d.id, { owner: d.folder.ownerUsername, folderPath });
  }

  const enriched = relationships.map((r) => ({
    ...r,
    docAFolder: folderInfoMap.get(r.docAId)?.folderPath.map((f) => f.name).join(" / "),
    docAOwner: folderInfoMap.get(r.docAId)?.owner,
    docAFolderPath: folderInfoMap.get(r.docAId)?.folderPath,
    docBFolder: folderInfoMap.get(r.docBId)?.folderPath.map((f) => f.name).join(" / "),
    docBOwner: folderInfoMap.get(r.docBId)?.owner,
    docBFolderPath: folderInfoMap.get(r.docBId)?.folderPath,
  }));

  return NextResponse.json({ relationships: enriched });
}
