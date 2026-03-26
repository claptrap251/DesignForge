/**
 * Hybrid similarity engine: chunk-level TF-IDF + optional embeddings.
 *
 * Three similarity signals are computed:
 *   1. Document-level TF-IDF cosine similarity (broad topical overlap)
 *   2. Best chunk-pair TF-IDF similarity (section-level precision)
 *   3. Embedding cosine similarity (semantic meaning) — optional, via env flag
 *
 * Embeddings use all-MiniLM-L6-v2 via @xenova/transformers (runs locally,
 * no external API calls). Enabled by setting SIMILARITY_USE_EMBEDDINGS=true
 * in .env.
 *
 * Pure TypeScript — no external API calls, no LLM.
 */

// ---------------------------------------------------------------------------
// Stopwords
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are",
  "aren't","as","at","be","because","been","before","being","below","between","both",
  "but","by","can","can't","cannot","could","couldn't","did","didn't","do","does",
  "doesn't","doing","don't","down","during","each","few","for","from","further","get",
  "got","had","hadn't","has","hasn't","have","haven't","having","he","he'd","he'll",
  "he's","her","here","here's","hers","herself","him","himself","his","how","how's",
  "i","i'd","i'll","i'm","i've","if","in","into","is","isn't","it","it's","its",
  "itself","just","let's","me","might","more","most","mustn't","my","myself","no",
  "nor","not","of","off","on","once","only","or","other","ought","our","ours",
  "ourselves","out","over","own","same","shan't","she","she'd","she'll","she's",
  "should","shouldn't","so","some","such","than","that","that's","the","their",
  "theirs","them","themselves","then","there","there's","these","they","they'd",
  "they'll","they're","they've","this","those","through","to","too","under","until",
  "up","upon","us","use","used","using","very","was","wasn't","we","we'd","we'll",
  "we're","we've","were","weren't","what","what's","when","when's","where","where's",
  "which","while","who","who's","whom","why","why's","will","with","won't","would",
  "wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself",
  "yourselves","also","can","may","etc","e.g","i.e","vs","via","ie","eg",
]);

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

/** Strip markdown syntax and tokenize text into lowercase words. */
export function tokenize(text: string): string[] {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")       // code blocks
    .replace(/`[^`]+`/g, " ")              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links (keep text)
    .replace(/<[^>]+>/g, " ")              // HTML tags
    .replace(/^#{1,6}\s+/gm, "")           // heading markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, " ")      // horizontal rules
    .replace(/^>\s+/gm, "")                // blockquotes
    .replace(/^[\s]*[-*+]\s+/gm, " ")      // unordered lists
    .replace(/^[\s]*\d+\.\s+/gm, " ");     // ordered lists

  return cleaned
    .toLowerCase()
    .split(/[^a-z0-9'-]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/** Strip markdown for embedding (keep readable text, remove syntax). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, " ")
    .replace(/^>\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Chunking — split markdown by headings into sections
// ---------------------------------------------------------------------------

interface Chunk {
  heading: string;
  text: string;
}

/** Split markdown into chunks by heading. */
export function chunkByHeading(content: string): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  let currentHeading = "(intro)";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        const text = currentLines.join("\n").trim();
        if (text) chunks.push({ heading: currentHeading, text });
      }
      currentHeading = headingMatch[2].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const text = currentLines.join("\n").trim();
    if (text) chunks.push({ heading: currentHeading, text });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// TF-IDF
// ---------------------------------------------------------------------------

export function computeTFIDF(
  documents: { id: string; tokens: string[] }[]
): Map<string, Map<string, number>> {
  const N = documents.length;
  if (N === 0) return new Map();

  const df = new Map<string, number>();
  for (const doc of documents) {
    const uniqueTerms = new Set(doc.tokens);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  const result = new Map<string, Map<string, number>>();

  for (const doc of documents) {
    const totalTokens = doc.tokens.length;
    if (totalTokens === 0) {
      result.set(doc.id, new Map());
      continue;
    }

    const tfCounts = new Map<string, number>();
    for (const token of doc.tokens) {
      tfCounts.set(token, (tfCounts.get(token) || 0) + 1);
    }

    const tfidf = new Map<string, number>();
    for (const [term, count] of tfCounts) {
      const tf = count / totalTokens;
      const idf = Math.log(N / (df.get(term) || 1));
      tfidf.set(term, tf * idf);
    }

    result.set(doc.id, tfidf);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cosine similarity (for both TF-IDF sparse vectors and dense embeddings)
// ---------------------------------------------------------------------------

export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  if (vecA.size === 0 || vecB.size === 0) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, valA] of vecA) {
    magA += valA * valA;
    const valB = vecB.get(term);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }

  for (const valB of vecB.values()) {
    magB += valB * valB;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/** Cosine similarity for dense float arrays (embeddings). */
export function denseCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  if (mag === 0) return 0;

  return dot / mag;
}

// ---------------------------------------------------------------------------
// Embeddings (optional — requires @xenova/transformers)
// ---------------------------------------------------------------------------

let pipelineInstance: any = null;

/** Load the embedding model (lazy singleton). */
async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;

  const { pipeline } = await import("@xenova/transformers");
  pipelineInstance = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );
  return pipelineInstance;
}

/**
 * Compute embedding for a text string.
 * Returns a 384-dimensional float array (all-MiniLM-L6-v2).
 * Text is truncated to ~512 tokens by the model.
 */
export async function computeEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Compute embeddings for multiple documents.
 * Returns a Map of docId → embedding vector.
 */
export async function computeEmbeddings(
  documents: { id: string; text: string }[]
): Promise<Map<string, number[]>> {
  const pipe = await getEmbeddingPipeline();
  const result = new Map<string, number[]>();

  for (const doc of documents) {
    // Truncate to reasonable length for the model (first ~2000 chars)
    const truncated = doc.text.slice(0, 2000);
    const output = await pipe(truncated, { pooling: "mean", normalize: true });
    result.set(doc.id, Array.from(output.data as Float32Array));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shared terms
// ---------------------------------------------------------------------------

function getSharedTerms(
  vecA: Map<string, number>,
  vecB: Map<string, number>,
  limit: number = 5
): string[] {
  const shared: { term: string; combinedScore: number }[] = [];

  for (const [term, scoreA] of vecA) {
    const scoreB = vecB.get(term);
    if (scoreB !== undefined) {
      shared.push({ term, combinedScore: scoreA + scoreB });
    }
  }

  return shared
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit)
    .map((s) => s.term);
}

// ---------------------------------------------------------------------------
// Relationship computation — hybrid doc + chunk + optional embeddings
// ---------------------------------------------------------------------------

export interface DocumentRelationship {
  docAId: string;
  docBId: string;
  docAName: string;
  docBName: string;
  score: number;           // blended score (0-1)
  docScore: number;        // document-level TF-IDF similarity
  chunkScore: number;      // best chunk-pair TF-IDF similarity
  embeddingScore: number;  // embedding similarity (0 if disabled)
  bestChunkA: string;      // heading of best matching chunk in doc A
  bestChunkB: string;      // heading of best matching chunk in doc B
  sharedTerms: string[];
}

/** Check if embedding mode is enabled via environment variable. */
export function isEmbeddingEnabled(): boolean {
  return process.env.SIMILARITY_USE_EMBEDDINGS === "true";
}

/**
 * Blending weights for combining similarity signals.
 * These were determined by testing across diverse document sets.
 * See tests/similarity-blend-test.mjs for the evaluation harness.
 */
export const BLEND_WEIGHTS = {
  // When embeddings are enabled: all three signals
  // Embedding weight kept at 0.40 (semantic), chunk scaled proportionally
  withEmbeddings: { doc: 0.12, chunk: 0.48, embedding: 0.40 },
  // Without embeddings: chunk-level dominates (empirically best at 74% accuracy)
  withoutEmbeddings: { doc: 0.2, chunk: 0.8 },
};

/**
 * Compute pairwise relationships between documents.
 *
 * Signals:
 *   1. Document-level TF-IDF cosine similarity
 *   2. Best chunk-pair TF-IDF cosine similarity
 *   3. Embedding cosine similarity (if SIMILARITY_USE_EMBEDDINGS=true)
 */
export async function computeRelationships(
  designs: { id: string; name: string; content: string }[],
  threshold: number = 0.1
): Promise<DocumentRelationship[]> {
  if (designs.length < 2) return [];

  const useEmbeddings = isEmbeddingEnabled();

  // --- Document-level TF-IDF ---
  const docTokenized = designs.map((d) => ({
    id: d.id,
    tokens: tokenize(d.content),
  }));
  const docVectors = computeTFIDF(docTokenized);

  // --- Chunk-level TF-IDF ---
  const chunksByDoc = new Map<string, { chunkId: string; heading: string; tokens: string[] }[]>();
  const allChunks: { id: string; tokens: string[] }[] = [];

  for (const design of designs) {
    const chunks = chunkByHeading(design.content);
    const docChunks: { chunkId: string; heading: string; tokens: string[] }[] = [];

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

  // --- Embeddings (if enabled) ---
  let embeddingVectors: Map<string, number[]> | null = null;
  if (useEmbeddings) {
    try {
      const docs = designs.map((d) => ({
        id: d.id,
        text: stripMarkdown(d.content),
      }));
      embeddingVectors = await computeEmbeddings(docs);
    } catch (err) {
      console.error("Embedding computation failed, falling back to TF-IDF only:", err);
    }
  }

  // --- Pairwise comparison ---
  const relationships: DocumentRelationship[] = [];
  const weights = embeddingVectors
    ? BLEND_WEIGHTS.withEmbeddings
    : BLEND_WEIGHTS.withoutEmbeddings;

  for (let i = 0; i < designs.length; i++) {
    for (let j = i + 1; j < designs.length; j++) {
      const dA = designs[i];
      const dB = designs[j];

      // Document-level TF-IDF score
      const vecA = docVectors.get(dA.id)!;
      const vecB = docVectors.get(dB.id)!;
      const docScore = cosineSimilarity(vecA, vecB);

      // Chunk-level: find best matching chunk pair
      const chunksA = chunksByDoc.get(dA.id) || [];
      const chunksB = chunksByDoc.get(dB.id) || [];

      let chunkScore = 0;
      let bestChunkA = "";
      let bestChunkB = "";

      for (const cA of chunksA) {
        const cVecA = chunkVectors.get(cA.chunkId);
        if (!cVecA) continue;

        for (const cB of chunksB) {
          const cVecB = chunkVectors.get(cB.chunkId);
          if (!cVecB) continue;

          const sim = cosineSimilarity(cVecA, cVecB);
          if (sim > chunkScore) {
            chunkScore = sim;
            bestChunkA = cA.heading;
            bestChunkB = cB.heading;
          }
        }
      }

      // Embedding score
      let embeddingScore = 0;
      if (embeddingVectors) {
        const embA = embeddingVectors.get(dA.id);
        const embB = embeddingVectors.get(dB.id);
        if (embA && embB) {
          embeddingScore = denseCosineSimilarity(embA, embB);
        }
      }

      // Blended score
      let blended: number;
      if (embeddingVectors) {
        const w = weights as typeof BLEND_WEIGHTS.withEmbeddings;
        blended = w.doc * docScore + w.chunk * chunkScore + w.embedding * embeddingScore;
      } else {
        const w = weights as typeof BLEND_WEIGHTS.withoutEmbeddings;
        blended = w.doc * docScore + w.chunk * chunkScore;
      }

      if (blended >= threshold) {
        relationships.push({
          docAId: dA.id,
          docBId: dB.id,
          docAName: dA.name,
          docBName: dB.name,
          score: Math.round(blended * 1000) / 1000,
          docScore: Math.round(docScore * 1000) / 1000,
          chunkScore: Math.round(chunkScore * 1000) / 1000,
          embeddingScore: Math.round(embeddingScore * 1000) / 1000,
          bestChunkA,
          bestChunkB,
          sharedTerms: getSharedTerms(vecA, vecB),
        });
      }
    }
  }

  return relationships.sort((a, b) => b.score - a.score);
}
