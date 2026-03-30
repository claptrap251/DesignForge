import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name || "CLI Token";

  const plaintext = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(plaintext).digest("hex");

  await prisma.apiToken.create({
    data: {
      userId: session.user.id,
      tokenHash,
      name,
    },
  });

  // Return plaintext ONCE — it won't be retrievable after this
  return NextResponse.json({ token: plaintext, name }, { status: 201 });
}
