import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";
import { GitHubClient } from "@/lib/backup/github";
import { parseProjectsFromTree } from "@/lib/backup/deserialize";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getBackupConfig();
  if (!config) {
    return NextResponse.json({ error: "Backup not configured" }, { status: 400 });
  }

  try {
    const client = new GitHubClient();
    const commitSha = await client.getLatestCommitSha();
    if (!commitSha) {
      return NextResponse.json({ projects: [], commitSha: null });
    }
    const treeSha = await client.getCommitTreeSha(commitSha);
    const tree = await client.getTree(treeSha);
    const projects = parseProjectsFromTree(tree);

    return NextResponse.json({ projects, commitSha });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
