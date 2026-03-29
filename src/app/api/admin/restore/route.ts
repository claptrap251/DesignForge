import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";
import { GitHubClient } from "@/lib/backup/github";
import { deserializeBackup } from "@/lib/backup/deserialize";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getBackupConfig();
  if (!config) {
    return NextResponse.json({ error: "Backup not configured" }, { status: 400 });
  }

  const body = await request.json();
  const { mode, projects: selectedProjects } = body;

  if (mode !== "full" && mode !== "selective") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  try {
    const client = new GitHubClient(config);
    const commitSha = await client.getLatestCommitSha();
    if (!commitSha) {
      return NextResponse.json({ error: "No backup found on this branch" }, { status: 404 });
    }
    const treeSha = await client.getCommitTreeSha(commitSha);
    const tree = await client.getTree(treeSha);

    const files: Array<{ path: string; content: string | Buffer }> = [];
    const blobs = tree.filter((item: any) => item.type === "blob");

    for (const blob of blobs) {
      const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(blob.path);
      const isVersionImage = blob.path.includes("/_versions/") && isImage;

      if (isImage || isVersionImage) {
        const buffer = await client.getBlobRaw(blob.sha);
        files.push({ path: blob.path, content: buffer });
      } else {
        const content = await client.getBlobContent(blob.sha);
        files.push({ path: blob.path, content });
      }
    }

    const result = await deserializeBackup(files, {
      mode,
      selectedProjects,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
