import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targets = await prisma.scrapeTarget.findMany({
    include: {
      repos: true,
      project: { select: { id: true, name: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    targets.map((t) => ({
      ...t,
      encryptedToken: undefined,
      tokenPreview: decrypt(t.encryptedToken).slice(0, 4) + "••••••••",
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, githubType, githubName, apiUrl, token, cronSchedule, projectId } = body;

  if (!githubName || !token || !projectId) {
    return NextResponse.json(
      { error: "githubName, token, and projectId are required" },
      { status: 400 }
    );
  }

  const target = await prisma.scrapeTarget.create({
    data: {
      name: name || githubName,
      githubType: githubType || "org",
      githubName,
      apiUrl: (apiUrl || "https://api.github.com").replace(/\/+$/, ""),
      encryptedToken: encrypt(token),
      cronSchedule: cronSchedule || "0 */12 * * *",
      projectId,
    },
  });

  const { registerTarget } = await import("@/lib/scraper/scheduler");
  registerTarget(target);

  return NextResponse.json(target, { status: 201 });
}
