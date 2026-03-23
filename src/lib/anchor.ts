export type AnchorResult = {
  line: number;
  confidence: "exact" | "fuzzy" | "fallback" | "orphaned";
};

export type AnchorFields = {
  anchorLine: number | null;
  anchorHeading: string | null;
  anchorContext: string | null;
  contextBefore: string | null;
  contextAfter: string | null;
};

export type ComputedAnchor = {
  anchorLine: number;
  anchorHeading: string | null;
  anchorContext: string;
  contextBefore: string | null;
  contextAfter: string | null;
};

/**
 * Resolves a comment's anchor against current markdown content using 4-tier resolution:
 * 1. Exact match (heading-based offset or original line)
 * 2. Fuzzy match (context search with neighbor verification)
 * 3. Fallback (original line if in range)
 * 4. Orphaned (no match found)
 */
export function resolveAnchor(
  comment: AnchorFields,
  currentContent: string
): AnchorResult {
  const lines = currentContent.split("\n");
  const totalLines = lines.length;

  const {
    anchorLine,
    anchorHeading,
    anchorContext,
    contextBefore,
    contextAfter,
  } = comment;

  // Tier 1: Exact match
  if (anchorContext != null) {
    // 1a. Heading-based offset resolution
    if (anchorHeading != null && anchorLine != null) {
      const headingIndex = lines.findIndex(
        (l) => l.trim() === anchorHeading.trim()
      );

      if (headingIndex !== -1) {
        // Compute relative offset: anchorLine (1-based) minus heading line (1-based) in current
        const headingLine = headingIndex + 1;
        const offset = anchorLine - headingLine;
        const candidateIndex = headingIndex + offset;

        if (
          candidateIndex >= 0 &&
          candidateIndex < totalLines &&
          lines[candidateIndex].trim() === anchorContext.trim()
        ) {
          return { line: candidateIndex + 1, confidence: "exact" };
        }
      }
    }

    // 1b. Direct line check: if original anchorLine still has matching content
    if (
      anchorLine != null &&
      anchorLine >= 1 &&
      anchorLine <= totalLines &&
      lines[anchorLine - 1].trim() === anchorContext.trim()
    ) {
      return { line: anchorLine, confidence: "exact" };
    }

    // Tier 2: Fuzzy match — search all lines for matching anchorContext
    const matchingIndices: number[] = [];
    for (let i = 0; i < totalLines; i++) {
      if (lines[i].trim() === anchorContext.trim()) {
        matchingIndices.push(i);
      }
    }

    if (matchingIndices.length === 1) {
      const matchIndex = matchingIndices[0];
      if (verifyContext(lines, matchIndex, contextBefore, contextAfter)) {
        return { line: matchIndex + 1, confidence: "fuzzy" };
      }
    } else if (matchingIndices.length > 1) {
      // Multiple matches: disambiguate with context
      for (const matchIndex of matchingIndices) {
        if (verifyContext(lines, matchIndex, contextBefore, contextAfter)) {
          return { line: matchIndex + 1, confidence: "fuzzy" };
        }
      }
    }

    // Single match without context verification still counts as fuzzy
    if (matchingIndices.length === 1) {
      return { line: matchingIndices[0] + 1, confidence: "fuzzy" };
    }
  }

  // Tier 3: Fallback — original line is in document range
  if (anchorLine != null && anchorLine >= 1 && anchorLine <= totalLines) {
    return { line: anchorLine, confidence: "fallback" };
  }

  // Tier 4: Orphaned
  return { line: -1, confidence: "orphaned" };
}

/**
 * Verify context neighbors within 3 lines of the matched line.
 * Returns true if at least 1 stored context-before line matches an actual
 * before line (within 3 lines), OR at least 1 stored context-after line
 * matches an actual after line (within 3 lines).
 */
function verifyContext(
  lines: string[],
  matchIndex: number,
  contextBefore: string | null,
  contextAfter: string | null
): boolean {
  let beforeMatch = false;
  let afterMatch = false;

  if (contextBefore != null) {
    const beforeLines = contextBefore.split("\n");
    for (const bl of beforeLines) {
      for (let offset = 1; offset <= 3; offset++) {
        const idx = matchIndex - offset;
        if (idx >= 0 && lines[idx].trim() === bl.trim()) {
          beforeMatch = true;
          break;
        }
      }
      if (beforeMatch) break;
    }
  }

  if (contextAfter != null) {
    const afterLines = contextAfter.split("\n");
    for (const al of afterLines) {
      for (let offset = 1; offset <= 3; offset++) {
        const idx = matchIndex + offset;
        if (idx < lines.length && lines[idx].trim() === al.trim()) {
          afterMatch = true;
          break;
        }
      }
      if (afterMatch) break;
    }
  }

  // If neither context is provided, can't verify — accept anyway
  if (contextBefore == null && contextAfter == null) return true;
  return beforeMatch || afterMatch;
}

/**
 * Computes anchor fields for a given line number in markdown source.
 * - Splits markdown by \n, looks up the line at index lineNumber - 1
 * - Walks backwards to find the nearest heading (line matching /^#{1,6}\s/)
 * - Collects up to 2 lines before and 2 lines after the anchor line
 * - Returns all anchor fields
 */
export function computeAnchor(
  lineNumber: number,
  markdownSource: string
): ComputedAnchor {
  const lines = markdownSource.split("\n");
  const index = lineNumber - 1;

  if (index < 0 || index >= lines.length) {
    throw new Error(
      `Line number ${lineNumber} is out of range (1-${lines.length})`
    );
  }

  const anchorContext = lines[index];

  // Walk backwards to find nearest heading
  let anchorHeading: string | null = null;
  for (let i = index - 1; i >= 0; i--) {
    if (/^#{1,6}\s/.test(lines[i])) {
      anchorHeading = lines[i];
      break;
    }
  }

  // Collect up to 2 lines before
  const beforeLines: string[] = [];
  for (let i = Math.max(0, index - 2); i < index; i++) {
    beforeLines.push(lines[i]);
  }
  const contextBefore = beforeLines.length > 0 ? beforeLines.join("\n") : null;

  // Collect up to 2 lines after
  const afterLines: string[] = [];
  for (let i = index + 1; i <= Math.min(lines.length - 1, index + 2); i++) {
    afterLines.push(lines[i]);
  }
  const contextAfter = afterLines.length > 0 ? afterLines.join("\n") : null;

  return {
    anchorLine: lineNumber,
    anchorHeading,
    anchorContext,
    contextBefore,
    contextAfter,
  };
}
