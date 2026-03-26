/**
 * Blending weight evaluation harness for similarity engine.
 *
 * Tests different weight combinations across a set of document pairs
 * with KNOWN expected similarity rankings. The best blend is the one
 * that produces rankings closest to human expectations.
 *
 * Run: node tests/similarity-blend-test.mjs
 */

import {
  tokenize,
  chunkByHeading,
  computeTFIDF,
  cosineSimilarity,
  denseCosineSimilarity,
  computeEmbeddings,
  stripMarkdown,
} from "../src/lib/similarity.ts";

// ---------------------------------------------------------------------------
// Test Documents — designed to exercise different similarity scenarios
// ---------------------------------------------------------------------------

const docs = [
  {
    id: "auth-design",
    name: "Authentication System Design",
    content: `# Authentication System Design

## Overview
This document describes the authentication and authorization system for our web application.
We use JWT tokens for session management and bcrypt for password hashing.

## Login Flow
Users authenticate via username and password. The server validates credentials against
the database, comparing the bcrypt hash. On success, a JWT token is issued with a 24-hour
expiration. The token contains the user ID and role.

## Password Policy
Passwords must be at least 8 characters long, contain at least one uppercase letter,
one lowercase letter, and one number. Passwords are hashed using bcrypt with a cost
factor of 12.

## Authorization
Role-based access control (RBAC) is implemented. Three roles exist: admin, editor, viewer.
Admins can manage users and system settings. Editors can create and modify content.
Viewers have read-only access.

## Session Management
Sessions are managed via JWT stored in HTTP-only cookies. Token refresh happens
automatically when less than 4 hours remain. Logout invalidates the token server-side.`,
  },
  {
    id: "security-review",
    name: "Security Review Checklist",
    content: `# Security Review Checklist

## Authentication Checks
Verify that password hashing uses bcrypt with appropriate cost factor.
Ensure JWT tokens have reasonable expiration times.
Check that login attempts are rate-limited to prevent brute force attacks.
Validate that session tokens are stored in HTTP-only secure cookies.

## Input Validation
All user inputs must be sanitized before processing.
SQL injection prevention via parameterized queries.
XSS prevention through output encoding.
CSRF tokens required for all state-changing operations.

## Data Protection
Sensitive data encrypted at rest using AES-256.
TLS 1.3 required for all communications.
PII handling follows GDPR compliance requirements.

## Logging and Monitoring
Security events logged with timestamps and user context.
Failed login attempts trigger alerts after 5 consecutive failures.
Audit trail maintained for all administrative actions.`,
  },
  {
    id: "api-design",
    name: "REST API Design Guidelines",
    content: `# REST API Design Guidelines

## URL Structure
Resources should be nouns, not verbs. Use plural forms: /users, /projects, /designs.
Nesting for relationships: /projects/{id}/designs. Maximum nesting depth: 2 levels.

## HTTP Methods
GET for reading resources. POST for creating. PUT for full updates. PATCH for partial
updates. DELETE for removing resources. Use appropriate status codes.

## Authentication
All API endpoints require authentication via Bearer token in the Authorization header.
Token validation middleware runs before route handlers. Rate limiting applies per-token.

## Error Handling
Errors return consistent JSON format: { error: string, code: string, details?: any }.
Use standard HTTP status codes: 400 for client errors, 401 for auth failures,
403 for forbidden, 404 for not found, 500 for server errors.

## Versioning
API versioning via URL path prefix: /api/v1/resources.
Breaking changes require new version. Non-breaking changes can be added to existing version.

## Pagination
List endpoints support cursor-based pagination. Query params: limit, cursor.
Response includes: { data: [], nextCursor: string | null, hasMore: boolean }.`,
  },
  {
    id: "db-schema",
    name: "Database Schema Design",
    content: `# Database Schema Design

## User Table
The users table stores account information. Fields: id (UUID primary key),
username (unique, indexed), email (unique), password_hash (bcrypt), role (enum),
created_at, updated_at. Soft deletes via deleted_at timestamp.

## Project Table
Projects group related designs. Fields: id, name, description, owner_id (foreign key
to users), created_at, updated_at. Cascade delete removes all child folders and designs.

## Design Table
Designs store the actual content. Fields: id, name, type (IMAGE or MARKDOWN),
status (DRAFT, IN_REVIEW, APPROVED), content (text for markdown), file_path (for images),
current_version, folder_id (foreign key), created_at, updated_at.

## Version History
Design versions track changes. Fields: id, design_id, version (integer),
content, file_path, change_note, created_at. Each version is immutable once created.

## Indexing Strategy
Primary indexes on all id columns. Secondary indexes on: users.username, users.email,
designs.folder_id, design_versions.design_id. Full-text search index on designs.content.`,
  },
  {
    id: "cooking-recipes",
    name: "Italian Cooking Recipes",
    content: `# Italian Cooking Recipes

## Pasta Carbonara
Traditional Roman pasta dish using guanciale, eggs, pecorino romano, and black pepper.
Cook spaghetti until al dente. Fry guanciale until crispy. Mix eggs with grated cheese.
Toss hot pasta with guanciale, then quickly mix in egg mixture off heat.

## Margherita Pizza
Classic Neapolitan pizza with San Marzano tomatoes, fresh mozzarella, and basil.
Stretch dough by hand to thin round. Top with crushed tomatoes, torn mozzarella.
Bake in 900°F oven for 60-90 seconds. Finish with fresh basil leaves and olive oil.

## Tiramisu
Coffee-flavored Italian dessert. Dip ladyfinger biscuits in espresso.
Layer with mascarpone cream made from eggs, sugar, and mascarpone cheese.
Dust with cocoa powder. Refrigerate for at least 4 hours before serving.

## Risotto alla Milanese
Saffron-infused rice dish from Milan. Toast arborio rice in butter and onion.
Add warm broth one ladle at a time, stirring constantly. Finish with saffron,
parmesan, and cold butter for creamy consistency.`,
  },
  {
    id: "user-access",
    name: "User Access Control Design",
    content: `# User Access Control Design

## Permission Model
The application uses a granular permission system built on top of role-based access.
Each resource type has defined permissions: create, read, update, delete.
Users are assigned roles that grant sets of permissions.

## Role Hierarchy
Admin role inherits all permissions. Manager role can manage team members and content.
Editor role can create and modify designs. Reviewer role can comment and approve.
Viewer role has read-only access to shared content.

## Folder Ownership
Each user has a root folder in every project they belong to. Users can only create
sub-folders within their own root folder. Designs inherit the access level of their
containing folder.

## Sharing
Resources can be shared via generated links with optional password protection.
Share links have configurable expiration. Shared access is read-only by default.

## Audit Logging
All permission changes are logged with actor, target, action, and timestamp.
Login and logout events tracked. Failed access attempts generate security alerts.`,
  },
  {
    id: "frontend-components",
    name: "Frontend Component Architecture",
    content: `# Frontend Component Architecture

## Component Hierarchy
The application uses React with a component-based architecture. Top-level layout
components (Header, Sidebar, Footer) wrap page-specific content. Pages are loaded
via Next.js App Router with file-based routing.

## State Management
Local state managed via React useState and useReducer hooks. No global state library.
Data fetching uses SWR for caching and revalidation. Form state managed with
controlled components.

## Design System
Custom Tailwind-based design system. Color palette follows dark/light mode.
Typography uses Inter font family. Spacing follows 4px grid system.
Components are responsive with mobile-first approach.

## Performance
Code splitting via Next.js dynamic imports. Images optimized with next/image.
Memoization with React.memo for expensive renders. Virtual scrolling for
large lists. Bundle analysis with webpack-bundle-analyzer.`,
  },
];

// ---------------------------------------------------------------------------
// Expected similarity ranking (human judgment)
// ---------------------------------------------------------------------------

// Pairs ranked by expected similarity (highest first)
// This is our ground truth for evaluating blend quality
const expectedRanking = [
  // VERY HIGH: auth-design <-> security-review (same domain, shared concepts: bcrypt, JWT, sessions)
  { a: "auth-design", b: "security-review", tier: "high" },
  // VERY HIGH: auth-design <-> user-access (both about access control, roles, permissions)
  { a: "auth-design", b: "user-access", tier: "high" },
  // HIGH: security-review <-> user-access (security + access control overlap)
  { a: "security-review", b: "user-access", tier: "high" },
  // MEDIUM: api-design <-> auth-design (API auth section matches)
  { a: "api-design", b: "auth-design", tier: "medium" },
  // MEDIUM: db-schema <-> auth-design (user table, passwords)
  { a: "db-schema", b: "auth-design", tier: "medium" },
  // MEDIUM: api-design <-> db-schema (both about system design, complementary)
  { a: "api-design", b: "db-schema", tier: "medium" },
  // LOW: frontend-components <-> api-design (both tech, but different aspects)
  { a: "frontend-components", b: "api-design", tier: "low" },
  // NONE: cooking-recipes <-> anything-tech (completely unrelated)
  { a: "cooking-recipes", b: "auth-design", tier: "none" },
  { a: "cooking-recipes", b: "security-review", tier: "none" },
  { a: "cooking-recipes", b: "api-design", tier: "none" },
];

const tierScores = { high: 3, medium: 2, low: 1, none: 0 };

// ---------------------------------------------------------------------------
// Compute raw signals
// ---------------------------------------------------------------------------

async function computeRawSignals() {
  console.log("Computing raw signals for all document pairs...\n");

  // --- Document-level TF-IDF ---
  const docTokenized = docs.map((d) => ({
    id: d.id,
    tokens: tokenize(d.content),
  }));
  const docVectors = computeTFIDF(docTokenized);

  // --- Chunk-level TF-IDF ---
  const chunksByDoc = new Map();
  const allChunks = [];

  for (const design of docs) {
    const chunks = chunkByHeading(design.content);
    const docChunks = [];

    chunks.forEach((chunk, idx) => {
      const chunkId = `${design.id}::${idx}`;
      const tokens = tokenize(chunk.text);
      if (tokens.length > 0) {
        docChunks.push({ chunkId, heading: chunk.heading, tokens });
        allChunks.push({ id: chunkId, tokens });
      }
    });

    chunksByDoc.set(design.id, docChunks);
  }

  const chunkVectors = computeTFIDF(allChunks);

  // --- Embeddings ---
  console.log("Loading embedding model (first time may take a moment)...");
  let embeddingVectors = null;
  try {
    const embDocs = docs.map((d) => ({
      id: d.id,
      text: stripMarkdown(d.content),
    }));
    embeddingVectors = await computeEmbeddings(embDocs);
    console.log("Embedding model loaded successfully.\n");
  } catch (err) {
    console.log("Failed to load embeddings:", err.message);
    console.log("Proceeding without embeddings.\n");
  }

  // --- Compute all pairwise scores ---
  const pairScores = [];

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const dA = docs[i];
      const dB = docs[j];

      // Doc-level TF-IDF
      const docScore = cosineSimilarity(
        docVectors.get(dA.id),
        docVectors.get(dB.id)
      );

      // Chunk-level: best pair
      const chunksA = chunksByDoc.get(dA.id) || [];
      const chunksB = chunksByDoc.get(dB.id) || [];
      let chunkScore = 0;

      for (const cA of chunksA) {
        const cVecA = chunkVectors.get(cA.chunkId);
        if (!cVecA) continue;
        for (const cB of chunksB) {
          const cVecB = chunkVectors.get(cB.chunkId);
          if (!cVecB) continue;
          const sim = cosineSimilarity(cVecA, cVecB);
          if (sim > chunkScore) chunkScore = sim;
        }
      }

      // Embedding
      let embScore = 0;
      if (embeddingVectors) {
        const embA = embeddingVectors.get(dA.id);
        const embB = embeddingVectors.get(dB.id);
        if (embA && embB) {
          embScore = denseCosineSimilarity(embA, embB);
        }
      }

      pairScores.push({
        a: dA.id,
        b: dB.id,
        aName: dA.name,
        bName: dB.name,
        docScore,
        chunkScore,
        embScore,
      });
    }
  }

  return { pairScores, hasEmbeddings: !!embeddingVectors };
}

// ---------------------------------------------------------------------------
// Evaluate a blending configuration
// ---------------------------------------------------------------------------

function evaluateBlend(pairScores, weights, hasEmbeddings) {
  // Compute blended scores
  const blended = pairScores.map((p) => ({
    ...p,
    blendedScore: hasEmbeddings
      ? weights.doc * p.docScore + weights.chunk * p.chunkScore + weights.emb * p.embScore
      : weights.doc * p.docScore + weights.chunk * p.chunkScore,
  }));

  // Score against expected ranking
  let totalScore = 0;
  let maxPossible = 0;

  for (const expected of expectedRanking) {
    const pair = blended.find(
      (p) =>
        (p.a === expected.a && p.b === expected.b) ||
        (p.a === expected.b && p.b === expected.a)
    );

    if (!pair) continue;

    const tierScore = tierScores[expected.tier];
    maxPossible += 3; // max tier score

    if (expected.tier === "high") {
      // High-tier pairs should score >= 0.25
      if (pair.blendedScore >= 0.25) totalScore += 3;
      else if (pair.blendedScore >= 0.15) totalScore += 1;
    } else if (expected.tier === "medium") {
      // Medium-tier pairs should score 0.10 - 0.35
      if (pair.blendedScore >= 0.10 && pair.blendedScore <= 0.40) totalScore += 3;
      else if (pair.blendedScore >= 0.05) totalScore += 1;
    } else if (expected.tier === "low") {
      // Low-tier pairs should score 0.05 - 0.20
      if (pair.blendedScore >= 0.03 && pair.blendedScore <= 0.25) totalScore += 3;
      else if (pair.blendedScore < 0.03) totalScore += 1;
    } else {
      // None-tier pairs should score < 0.10
      if (pair.blendedScore < 0.08) totalScore += 3;
      else if (pair.blendedScore < 0.15) totalScore += 1;
    }
  }

  // Also check ranking order: high pairs should rank above medium, medium above low
  const sorted = [...blended].sort((a, b) => b.blendedScore - a.blendedScore);
  let rankBonus = 0;

  for (const exp of expectedRanking) {
    const rank = sorted.findIndex(
      (p) =>
        (p.a === exp.a && p.b === exp.b) ||
        (p.a === exp.b && p.b === exp.a)
    );
    if (rank === -1) continue;

    // Reward being in the right relative position
    const totalPairs = sorted.length;
    if (exp.tier === "high" && rank < totalPairs * 0.3) rankBonus += 2;
    if (exp.tier === "medium" && rank < totalPairs * 0.6) rankBonus += 1;
    if (exp.tier === "none" && rank >= totalPairs * 0.7) rankBonus += 2;
  }

  return { score: totalScore + rankBonus, maxPossible: maxPossible + 20, blended };
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Similarity Blending Weight Evaluation ===\n");

  const { pairScores, hasEmbeddings } = await computeRawSignals();

  // Print raw signal scores for reference
  console.log("--- Raw Signal Scores ---");
  console.log(
    "%-35s  %-35s  Doc    Chunk  Emb".replace(/%/g, "")
  );
  console.log(
    `${"Pair A".padEnd(35)}  ${"Pair B".padEnd(35)}  Doc    Chunk  Emb`
  );
  console.log("-".repeat(115));

  for (const p of pairScores) {
    const exp = expectedRanking.find(
      (e) =>
        (e.a === p.a && e.b === p.b) ||
        (e.a === p.b && e.b === p.a)
    );
    const tier = exp ? ` [${exp.tier}]` : "";
    console.log(
      `${p.aName.padEnd(35)}  ${p.bName.padEnd(35)}  ${p.docScore.toFixed(3)}  ${p.chunkScore.toFixed(3)}  ${p.embScore.toFixed(3)}${tier}`
    );
  }

  // --- Test different blending weights ---
  console.log("\n\n=== Blending Weight Comparison ===\n");

  const configs = hasEmbeddings
    ? [
        // Without embeddings baselines
        { label: "TF-IDF only: doc=0.5, chunk=0.5", doc: 0.5, chunk: 0.5, emb: 0, useEmb: false },
        { label: "TF-IDF only: doc=0.4, chunk=0.6", doc: 0.4, chunk: 0.6, emb: 0, useEmb: false },
        { label: "TF-IDF only: doc=0.3, chunk=0.7", doc: 0.3, chunk: 0.7, emb: 0, useEmb: false },
        // With embeddings
        { label: "Emb light:  doc=0.3, chunk=0.5, emb=0.2", doc: 0.3, chunk: 0.5, emb: 0.2, useEmb: true },
        { label: "Emb medium: doc=0.25, chunk=0.35, emb=0.4", doc: 0.25, chunk: 0.35, emb: 0.4, useEmb: true },
        { label: "Emb heavy:  doc=0.2, chunk=0.3, emb=0.5", doc: 0.2, chunk: 0.3, emb: 0.5, useEmb: true },
        { label: "Emb equal:  doc=0.33, chunk=0.33, emb=0.34", doc: 0.33, chunk: 0.33, emb: 0.34, useEmb: true },
        { label: "Emb dominant: doc=0.15, chunk=0.25, emb=0.6", doc: 0.15, chunk: 0.25, emb: 0.6, useEmb: true },
        { label: "Chunk+Emb: doc=0.1, chunk=0.4, emb=0.5", doc: 0.1, chunk: 0.4, emb: 0.5, useEmb: true },
        { label: "Doc+Emb:  doc=0.3, chunk=0.2, emb=0.5", doc: 0.3, chunk: 0.2, emb: 0.5, useEmb: true },
      ]
    : [
        { label: "doc=0.5, chunk=0.5", doc: 0.5, chunk: 0.5, emb: 0, useEmb: false },
        { label: "doc=0.4, chunk=0.6", doc: 0.4, chunk: 0.6, emb: 0, useEmb: false },
        { label: "doc=0.3, chunk=0.7", doc: 0.3, chunk: 0.7, emb: 0, useEmb: false },
        { label: "doc=0.6, chunk=0.4", doc: 0.6, chunk: 0.4, emb: 0, useEmb: false },
        { label: "doc=0.2, chunk=0.8", doc: 0.2, chunk: 0.8, emb: 0, useEmb: false },
      ];

  const results = [];

  for (const config of configs) {
    const { score, maxPossible, blended } = evaluateBlend(
      pairScores,
      { doc: config.doc, chunk: config.chunk, emb: config.emb },
      config.useEmb
    );

    results.push({ ...config, score, maxPossible });

    console.log(
      `${config.label.padEnd(55)}  Score: ${score}/${maxPossible} (${((score / maxPossible) * 100).toFixed(1)}%)`
    );
  }

  // Find best
  results.sort((a, b) => b.score / b.maxPossible - a.score / a.maxPossible);
  const best = results[0];

  console.log("\n\n=== BEST CONFIGURATION ===");
  console.log(`${best.label}`);
  console.log(`Score: ${best.score}/${best.maxPossible} (${((best.score / best.maxPossible) * 100).toFixed(1)}%)`);
  console.log(`Weights: doc=${best.doc}, chunk=${best.chunk}, emb=${best.emb}`);

  // Show detailed results for the best blend
  console.log("\n--- Detailed Scores with Best Blend ---");
  const { blended: bestBlended } = evaluateBlend(
    pairScores,
    { doc: best.doc, chunk: best.chunk, emb: best.emb },
    best.useEmb
  );

  const sortedBest = [...bestBlended].sort((a, b) => b.blendedScore - a.blendedScore);
  console.log(`${"Pair A".padEnd(35)}  ${"Pair B".padEnd(35)}  Blended  Expected`);
  console.log("-".repeat(115));

  for (const p of sortedBest) {
    const exp = expectedRanking.find(
      (e) =>
        (e.a === p.a && e.b === p.b) ||
        (e.a === p.b && e.b === p.a)
    );
    const tier = exp ? exp.tier : "-";
    console.log(
      `${p.aName.padEnd(35)}  ${p.bName.padEnd(35)}  ${p.blendedScore.toFixed(3)}    ${tier}`
    );
  }

  // Also find best TF-IDF-only (for when embeddings disabled)
  const tfidfResults = results.filter((r) => !r.useEmb);
  if (tfidfResults.length > 0) {
    tfidfResults.sort((a, b) => b.score / b.maxPossible - a.score / a.maxPossible);
    const bestTfidf = tfidfResults[0];
    console.log("\n--- Best TF-IDF Only (no embeddings) ---");
    console.log(`${bestTfidf.label}`);
    console.log(`Weights: doc=${bestTfidf.doc}, chunk=${bestTfidf.chunk}`);
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
