import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GitHubScraper } from "@/lib/scraper/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repo: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { repo: repoEncoded } = await params;
  const repoFullName = decodeURIComponent(repoEncoded);
  const [owner, repoName] = repoFullName.split("/");

  const targetId = request.nextUrl.searchParams.get("targetId");
  if (!targetId) {
    return NextResponse.json({ error: "targetId query param required" }, { status: 400 });
  }

  const target = await prisma.scrapeTarget.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const token = decrypt(target.encryptedToken);
  const scraper = new GitHubScraper(target.apiUrl, token);
  const branches = await scraper.listBranches(owner, repoName);

  return NextResponse.json(branches);
}
