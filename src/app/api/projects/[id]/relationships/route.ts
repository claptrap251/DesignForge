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

  // Enrich with folder/owner info
  const folderMap = new Map(
    designs.map((d) => [d.id, { folder: d.folder.name, owner: d.folder.ownerUsername }])
  );

  const enriched = relationships.map((r) => ({
    ...r,
    docAFolder: folderMap.get(r.docAId)?.folder,
    docAOwner: folderMap.get(r.docAId)?.owner,
    docBFolder: folderMap.get(r.docBId)?.folder,
    docBOwner: folderMap.get(r.docBId)?.owner,
  }));

  return NextResponse.json({ relationships: enriched });
}
