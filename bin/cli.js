#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");

const projectDir = path.resolve(__dirname, "..");
process.chdir(projectDir);

console.log("DesignForge - Design Review Platform");
console.log("=====================================\n");

// Run prisma db push
console.log("Setting up database...");
try {
  execSync("npx prisma db push --skip-generate", {
    cwd: projectDir,
    stdio: "inherit",
  });
} catch {
  console.log("Database already set up.");
}

// Start Next.js
console.log("\nStarting DesignForge on http://localhost:3000\n");
const child = spawn("npm", ["start"], {
  cwd: projectDir,
  stdio: "inherit",
  shell: true,
});

child.on("error", (err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
  process.exit(0);
});
