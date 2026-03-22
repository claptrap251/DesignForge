import { describe, it, expect, beforeEach } from "vitest";
import { hash, compare } from "bcryptjs";
import { prisma, cleanDb } from "./helpers";

describe("Auth - Registration", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("should create a user with hashed password", async () => {
    const passwordHash = await hash("mypassword", 4);
    const user = await prisma.user.create({
      data: {
        email: "alice@example.com",
        name: "Alice",
        passwordHash,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe("alice@example.com");
    expect(user.name).toBe("Alice");
    expect(user.passwordHash).not.toBe("mypassword");
  });

  it("should reject duplicate emails", async () => {
    const passwordHash = await hash("pass", 4);
    await prisma.user.create({
      data: { email: "dup@test.com", name: "A", passwordHash },
    });

    await expect(
      prisma.user.create({
        data: { email: "dup@test.com", name: "B", passwordHash },
      })
    ).rejects.toThrow();
  });

  it("should verify correct password", async () => {
    const password = "secret123";
    const passwordHash = await hash(password, 4);
    await prisma.user.create({
      data: { email: "bob@test.com", name: "Bob", passwordHash },
    });

    const user = await prisma.user.findUnique({
      where: { email: "bob@test.com" },
    });
    expect(user).not.toBeNull();

    const isValid = await compare(password, user!.passwordHash);
    expect(isValid).toBe(true);

    const isWrong = await compare("wrongpass", user!.passwordHash);
    expect(isWrong).toBe(false);
  });
});
