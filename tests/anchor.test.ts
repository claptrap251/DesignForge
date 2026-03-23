import { describe, it, expect } from "vitest";
import {
  resolveAnchor,
  computeAnchor,
  type AnchorFields,
} from "@/lib/anchor";

// Helper to build markdown content from lines
function md(...lines: string[]): string {
  return lines.join("\n");
}

describe("resolveAnchor", () => {
  describe("exact match", () => {
    it("heading + line + context all match → exact", () => {
      const content = md(
        "# Introduction",
        "This is the intro paragraph.",
        "Some more text here.",
        "## Details",
        "Detail line one.",
        "Detail line two.",
        "Detail line three."
      );

      const comment: AnchorFields = {
        anchorLine: 5,
        anchorHeading: "## Details",
        anchorContext: "Detail line one.",
        contextBefore: "## Details",
        contextAfter: "Detail line two.\nDetail line three.",
      };

      const result = resolveAnchor(comment, content);
      expect(result.confidence).toBe("exact");
      expect(result.line).toBe(5);
    });

    it("content unchanged at original line → exact", () => {
      const content = md(
        "Line one",
        "Line two",
        "Line three",
        "Line four"
      );

      const comment: AnchorFields = {
        anchorLine: 3,
        anchorHeading: null,
        anchorContext: "Line three",
        contextBefore: "Line one\nLine two",
        contextAfter: "Line four",
      };

      const result = resolveAnchor(comment, content);
      expect(result.confidence).toBe("exact");
      expect(result.line).toBe(3);
    });

    it("anchor at line 1 with no heading → exact", () => {
      const content = md(
        "First line of the document",
        "Second line",
        "Third line"
      );

      const comment: AnchorFields = {
        anchorLine: 1,
        anchorHeading: null,
        anchorContext: "First line of the document",
        contextBefore: null,
        contextAfter: "Second line\nThird line",
      };

      const result = resolveAnchor(comment, content);
      expect(result.confidence).toBe("exact");
      expect(result.line).toBe(1);
    });

    it("anchor at last line → works correctly", () => {
      const content = md(
        "# Title",
        "Middle content",
        "Last line of doc"
      );

      const comment: AnchorFields = {
        anchorLine: 3,
        anchorHeading: "# Title",
        anchorContext: "Last line of doc",
        contextBefore: "# Title\nMiddle content",
        contextAfter: null,
      };

      const result = resolveAnchor(comment, content);
      expect(result.confidence).toBe("exact");
      expect(result.line).toBe(3);
    });
  });

  describe("fuzzy match", () => {
    it("content shifted down by 2 lines, context still matches → fuzzy with new line number", () => {
      // Original content had "Target line" at line 3
      // New content has 2 extra lines inserted at top, pushing it to line 5
      const newContent = md(
        "New line A",
        "New line B",
        "# Introduction",
        "Some intro text.",
        "Target line",
        "Following line",
        "Another line"
      );

      const comment: AnchorFields = {
        anchorLine: 3,
        anchorHeading: "# Introduction",
        anchorContext: "Target line",
        contextBefore: "# Introduction\nSome intro text.",
        contextAfter: "Following line\nAnother line",
      };

      const result = resolveAnchor(comment, newContent);
      expect(result.confidence).toBe("fuzzy");
      expect(result.line).toBe(5);
    });
  });

  describe("fallback", () => {
    it("completely different content but line still in range → fallback with original line", () => {
      const content = md(
        "Completely different A",
        "Completely different B",
        "Completely different C",
        "Completely different D"
      );

      const comment: AnchorFields = {
        anchorLine: 2,
        anchorHeading: "# Old Heading",
        anchorContext: "Original content that no longer exists",
        contextBefore: "Some old before context",
        contextAfter: "Some old after context",
      };

      const result = resolveAnchor(comment, content);
      expect(result.confidence).toBe("fallback");
      expect(result.line).toBe(2);
    });
  });

  describe("orphaned", () => {
    it("document shortened below anchorLine, no context match → orphaned with line -1", () => {
      const content = md("Only one line");

      const comment: AnchorFields = {
        anchorLine: 10,
        anchorHeading: "# Some Heading",
        anchorContext: "Content that does not exist",
        contextBefore: "Also missing",
        contextAfter: "Also missing",
      };

      const result = resolveAnchor(comment, content);
      expect(result.confidence).toBe("orphaned");
      expect(result.line).toBe(-1);
    });
  });
});

describe("computeAnchor", () => {
  it("line under a heading → returns that heading", () => {
    const source = md(
      "# Main Title",
      "Some intro.",
      "## Section One",
      "First paragraph.",
      "Second paragraph.",
      "Third paragraph."
    );

    const result = computeAnchor(5, source);
    expect(result.anchorLine).toBe(5);
    expect(result.anchorHeading).toBe("## Section One");
    expect(result.anchorContext).toBe("Second paragraph.");
    expect(result.contextBefore).toBe("## Section One\nFirst paragraph.");
    expect(result.contextAfter).toBe("Third paragraph.");
  });

  it("line 1 (no heading above) → anchorHeading is null, contextBefore is null", () => {
    const source = md(
      "First line no heading",
      "Second line",
      "Third line"
    );

    const result = computeAnchor(1, source);
    expect(result.anchorLine).toBe(1);
    expect(result.anchorHeading).toBeNull();
    expect(result.anchorContext).toBe("First line no heading");
    expect(result.contextBefore).toBeNull();
    expect(result.contextAfter).toBe("Second line\nThird line");
  });

  it("last line → contextAfter is null", () => {
    const source = md(
      "# Title",
      "Middle line",
      "Last line"
    );

    const result = computeAnchor(3, source);
    expect(result.anchorLine).toBe(3);
    expect(result.anchorHeading).toBe("# Title");
    expect(result.anchorContext).toBe("Last line");
    expect(result.contextBefore).toBe("# Title\nMiddle line");
    expect(result.contextAfter).toBeNull();
  });

  it("line immediately after heading → returns that heading", () => {
    const source = md(
      "# Title",
      "Directly after heading",
      "Some more content"
    );

    const result = computeAnchor(2, source);
    expect(result.anchorLine).toBe(2);
    expect(result.anchorHeading).toBe("# Title");
    expect(result.anchorContext).toBe("Directly after heading");
    expect(result.contextBefore).toBe("# Title");
    expect(result.contextAfter).toBe("Some more content");
  });

  it("line with empty lines around it → includes empty lines in context", () => {
    const source = md(
      "# Title",
      "",
      "Content line",
      "",
      "After empty"
    );

    const result = computeAnchor(3, source);
    expect(result.anchorLine).toBe(3);
    expect(result.anchorHeading).toBe("# Title");
    expect(result.anchorContext).toBe("Content line");
    expect(result.contextBefore).toBe("# Title\n");
    expect(result.contextAfter).toBe("\nAfter empty");
  });
});
