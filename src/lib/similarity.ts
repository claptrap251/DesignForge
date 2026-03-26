/**
 * Hybrid chunk-level TF-IDF similarity engine.
 *
 * Instead of treating each document as a single bag of words, we split by
 * headings into sections (chunks). TF-IDF is computed per-chunk across
 * ALL chunks from ALL documents. Similarity between two documents is the
 * maximum cosine similarity between any pair of their chunks — so a
 * "Debugging" section in doc A can strongly match a "Debug Strategies"
 * doc B even if the rest of the documents are unrelated.
 *
 * The final score blends:
 *   - Document-level TF-IDF cosine similarity (broad topical overlap)
 *   - Best chunk-pair similarity (section-level precision)
 *
 * Pure TypeScript — no external dependencies, no LLM.
 */

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

// ---------------------------------------------------------------------------
// Chunking — split markdown by headings into sections
// ---------------------------------------------------------------------------

interface Chunk {
  heading: string; // e.g. "## Debugging" or "(intro)" for content before first heading
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
      // Flush previous chunk
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

  // Flush last chunk
  if (currentLines.length > 0) {
    const text = currentLines.join("\n").trim();
    if (text) chunks.push({ heading: currentHeading, text });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// TF-IDF
// ---------------------------------------------------------------------------

/** Compute TF-IDF vectors for a set of token bags. */
export function computeTFIDF(
  documents: { id: string; tokens: string[] }[]
): Map<string, Map<string, number>> {
  const N = documents.length;
  if (N === 0) return new Map();

  // Document frequency
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
// Cosine similarity
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
// Relationship computation — hybrid doc-level + chunk-level
// ---------------------------------------------------------------------------

export interface DocumentRelationship {
  docAId: string;
  docBId: string;
  docAName: string;
  docBName: string;
  score: number;           // blended score (0-1)
  docScore: number;        // document-level similarity
  chunkScore: number;      // best chunk-pair similarity
  bestChunkA: string;      // heading of best matching chunk in doc A
  bestChunkB: string;      // heading of best matching chunk in doc B
  sharedTerms: string[];
}

/**
 * Compute pairwise relationships between documents.
 *
 * Strategy:
 *   1. Compute document-level TF-IDF cosine similarity (whole-doc vectors)
 *   2. Chunk each doc by heading, compute TF-IDF across ALL chunks corpus,
 *      find the best chunk-pair between each doc pair
 *   3. Blend: score = 0.4 * docScore + 0.6 * chunkScore
 *      (chunk-level gets more weight since it catches section-level matches)
 */
export function computeRelationships(
  designs: { id: string; name: string; content: string }[],
  threshold: number = 0.1
): DocumentRelationship[] {
  if (designs.length < 2) return [];

  // --- Document-level TF-IDF ---
  const docTokenized = designs.map((d) => ({
    id: d.id,
    tokens: tokenize(d.content),
  }));
  const docVectors = computeTFIDF(docTokenized);

  // --- Chunk-level TF-IDF ---
  // Build chunk corpus: each chunk gets a unique id like "docId::chunkIdx"
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

  // --- Pairwise comparison ---
  const relationships: DocumentRelationship[] = [];

  for (let i = 0; i < designs.length; i++) {
    for (let j = i + 1; j < designs.length; j++) {
      const dA = designs[i];
      const dB = designs[j];

      // Document-level score
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

      // Blended score: chunk-level weighted higher for section-precision
      const blended = 0.4 * docScore + 0.6 * chunkScore;

      if (blended >= threshold) {
        relationships.push({
          docAId: dA.id,
          docBId: dB.id,
          docAName: dA.name,
          docBName: dB.name,
          score: Math.round(blended * 1000) / 1000,
          docScore: Math.round(docScore * 1000) / 1000,
          chunkScore: Math.round(chunkScore * 1000) / 1000,
          bestChunkA,
          bestChunkB,
          sharedTerms: getSharedTerms(vecA, vecB),
        });
      }
    }
  }

  return relationships.sort((a, b) => b.score - a.score);
}
