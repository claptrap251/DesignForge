import { execSync } from "child_process";
import { rmSync, mkdirSync } from "fs";
import path from "path";

const TEST_DB = path.join(__dirname, "test.db");
const TEST_UPLOADS = path.join(__dirname, "test-uploads");

// Point Prisma at the test database
process.env.DATABASE_URL = `file:${TEST_DB}`;
// Prevent auth from requiring NEXTAUTH_SECRET in tests
process.env.NEXTAUTH_SECRET = "test-secret-for-vitest";

// Before all tests: push schema to test DB
beforeAll(() => {
  // Clean up any previous test DB
  try {
    rmSync(TEST_DB, { force: true });
    rmSync(`${TEST_DB}-journal`, { force: true });
  } catch {
    // ignore
  }

  mkdirSync(TEST_UPLOADS, { recursive: true });

  // Push schema
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    cwd: path.join(__dirname, ".."),
    stdio: "pipe",
  });
});

// After all tests: clean up
afterAll(() => {
  try {
    rmSync(TEST_DB, { force: true });
    rmSync(`${TEST_DB}-journal`, { force: true });
    rmSync(TEST_UPLOADS, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
