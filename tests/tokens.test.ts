import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

describe("API Token Authentication", () => {
  let userId: string;
  let tokenPlaintext: string;
  let tokenHash: string;

  beforeEach(async () => {
    await prisma.apiToken.deleteMany();
    await prisma.user.deleteMany();

    const bcrypt = await import("bcryptjs");
    const user = await prisma.user.create({
      data: {
        username: "tokenuser",
        passwordHash: await bcrypt.hash("testpass123", 10),
      },
    });
    userId = user.id;

    tokenPlaintext = randomBytes(32).toString("hex");
    tokenHash = createHash("sha256").update(tokenPlaintext).digest("hex");

    await prisma.apiToken.create({
      data: {
        userId: user.id,
        tokenHash,
        name: "Test Token",
      },
    });
  });

  it("should authenticate with valid Bearer token", async () => {
    const { authenticateRequest } = await import("@/lib/apiAuth");
    const request = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Bearer ${tokenPlaintext}` },
    });

    const result = await authenticateRequest(request as any);
    expect(result.user).not.toBeNull();
    expect(result.user!.username).toBe("tokenuser");
    expect(result.method).toBe("bearer");
  });

  it("should reject invalid Bearer token", async () => {
    const { authenticateRequest } = await import("@/lib/apiAuth");
    const request = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer invalidtoken123" },
    });

    const result = await authenticateRequest(request as any);
    expect(result.user).toBeNull();
  });

  it("should update lastUsedAt on successful auth", async () => {
    const { authenticateRequest } = await import("@/lib/apiAuth");
    const request = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Bearer ${tokenPlaintext}` },
    });

    await authenticateRequest(request as any);

    const token = await prisma.apiToken.findFirst({ where: { tokenHash } });
    expect(token!.lastUsedAt).not.toBeNull();
  });

  it("should still support Basic auth after adding Bearer", async () => {
    const { authenticateRequest } = await import("@/lib/apiAuth");
    const basic = Buffer.from("tokenuser:testpass123").toString("base64");
    const request = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Basic ${basic}` },
    });

    const result = await authenticateRequest(request as any);
    expect(result.user).not.toBeNull();
    expect(result.method).toBe("basic");
  });
});
