import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { auth } from "./auth";

interface AuthenticatedUser {
  id: string;
  username: string;
  name?: string | null;
}

interface AuthResult {
  user: AuthenticatedUser | null;
  method: "session" | "basic" | "none";
}

/**
 * Unified authentication for API routes.
 * Supports both session-based auth (web UI) and HTTP Basic Auth (CLI).
 *
 * Usage:
 *   const { user } = await authenticateRequest(request);
 *   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // 1. Check for HTTP Basic Auth header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const base64 = authHeader.slice(6);
    let decoded: string;
    try {
      decoded = atob(base64);
    } catch {
      return { user: null, method: "none" };
    }

    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return { user: null, method: "none" };

    const username = decoded.substring(0, colonIdx).toLowerCase();
    const password = decoded.substring(colonIdx + 1);

    if (!username || !password) return { user: null, method: "none" };

    const dbUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!dbUser) return { user: null, method: "none" };

    const isValid = await compare(password, dbUser.passwordHash);
    if (!isValid) return { user: null, method: "none" };

    return {
      user: { id: dbUser.id, username: dbUser.username, name: dbUser.name },
      method: "basic",
    };
  }

  // 2. Fall back to session auth (next-auth)
  const session = await auth();
  if (session?.user?.id) {
    return {
      user: {
        id: session.user.id,
        username: (session.user as any).username,
        name: session.user.name,
      },
      method: "session",
    };
  }

  return { user: null, method: "none" };
}
