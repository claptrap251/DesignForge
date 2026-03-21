import { describe, it, expect, beforeEach } from "vitest";
import { hash, compare } from "bcryptjs";
import { prisma, cleanDb } from "./helpers";

describe("Auth - Registration", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("should create a user with username and hashed password", async () => {
    const passwordHash = await hash("mypassword", 4);
    const user = await prisma.user.create({
      data: {
        username: "alice",
        name: "Alice",
        passwordHash,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe("alice");
    expect(user.name).toBe("Alice");
    expect(user.email).toBeNull();
    expect(user.passwordHash).not.toBe("mypassword");
  });

  it("should create a user with optional email", async () => {
    const passwordHash = await hash("mypassword", 4);
    const user = await prisma.user.create({
      data: {
        username: "bob",
        email: "bob@example.com",
        name: "Bob",
        passwordHash,
      },
    });

    expect(user.username).toBe("bob");
    expect(user.email).toBe("bob@example.com");
  });

  it("should reject duplicate usernames", async () => {
    const passwordHash = await hash("pass", 4);
    await prisma.user.create({
      data: { username: "duplicate", name: "A", passwordHash },
    });

    await expect(
      prisma.user.create({
        data: { username: "duplicate", name: "B", passwordHash },
      })
    ).rejects.toThrow();
  });

  it("should verify correct password", async () => {
    const password = "secret123";
    const passwordHash = await hash(password, 4);
    await prisma.user.create({
      data: { username: "charlie", name: "Charlie", passwordHash },
    });

    const user = await prisma.user.findUnique({
      where: { username: "charlie" },
    });
    expect(user).not.toBeNull();

    const isValid = await compare(password, user!.passwordHash);
    expect(isValid).toBe(true);

    const isWrong = await compare("wrongpass", user!.passwordHash);
    expect(isWrong).toBe(false);
  });
});
