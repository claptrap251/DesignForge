import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateUsername(username: string): string | null {
  if (!username || username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 39) return "Username must be 39 characters or fewer";
  if (!USERNAME_REGEX.test(username)) return "Username can only contain letters, numbers, hyphens, and underscores";
  if (username.startsWith("-") || username.endsWith("-")) return "Username cannot start or end with a hyphen";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, name, email } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const normalizedUsername = username.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: email || null,
        name: name || null,
        passwordHash,
      },
    });

    return NextResponse.json(
      { id: user.id, username: user.username, name: user.name },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
