/**
 * Parses markdown content and extracts mermaid code blocks,
 * returning HTML with mermaid diagram placeholders or pre-rendered SVGs.
 */

import { JSDOM } from "jsdom";

// Persistent jsdom instance for mermaid rendering — mermaid is a singleton
// that caches DOM references internally, so we must keep the same DOM alive.
let mermaidDom: JSDOM | null = null;
let mermaidInstance: any = null;
let renderCounter = 0;

function ensureMermaidDom(): JSDOM {
  if (mermaidDom) return mermaidDom;

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost",
  });

  // Patch SVG methods that jsdom doesn't implement
  const origCreateElementNS = dom.window.document.createElementNS.bind(dom.window.document);
  dom.window.document.createElementNS = function (ns: string, tag: string) {
    const el = origCreateElementNS(ns, tag);
    if (ns === "http://www.w3.org/2000/svg") {
      const svgEl = el as unknown as Record<string, unknown>;
      const bbox = { x: 0, y: 0, width: 100, height: 100 };
      if (!svgEl.getBBox) svgEl.getBBox = () => bbox;
      if (!svgEl.getTotalLength) svgEl.getTotalLength = () => 100;
      if (!svgEl.getPointAtLength) svgEl.getPointAtLength = () => ({ x: 0, y: 0 });
      if (!svgEl.getComputedTextLength) svgEl.getComputedTextLength = () => 50;
      if (!svgEl.getSubStringLength) svgEl.getSubStringLength = () => 50;
      if (!svgEl.getBoundingClientRect)
        svgEl.getBoundingClientRect = () => ({
          x: 0, y: 0, width: 100, height: 100,
          top: 0, left: 0, bottom: 100, right: 100,
        });
    }
    return el;
  } as typeof dom.window.document.createElementNS;

  mermaidDom = dom;
  return dom;
}

function setDomGlobals(dom: JSDOM): Record<string, PropertyDescriptor | undefined> {
  const globalKeys = [
    "window", "document", "navigator", "DOMParser",
    "XMLSerializer", "self", "Element", "HTMLElement",
  ];

  const globalValues: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    DOMParser: dom.window.DOMParser,
    XMLSerializer: dom.window.XMLSerializer,
    self: dom.window,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
  };

  const prevDescriptors: Record<string, PropertyDescriptor | undefined> = {};
  for (const key of globalKeys) {
    prevDescriptors[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      value: globalValues[key],
      writable: true,
      configurable: true,
    });
  }
  return prevDescriptors;
}

function restoreDomGlobals(prevDescriptors: Record<string, PropertyDescriptor | undefined>) {
  for (const [key, prev] of Object.entries(prevDescriptors)) {
    if (prev) {
      Object.defineProperty(globalThis, key, prev);
    } else {
      delete (globalThis as any)[key];
    }
  }
}

/** Render mermaid code to SVG server-side using jsdom */
export async function renderMermaidToSvg(code: string, id: string): Promise<string> {
  const dom = ensureMermaidDom();

  // Clean up any leftover elements from previous renders
  dom.window.document.body.innerHTML = "";

  const prevDescriptors = setDomGlobals(dom);

  try {
    if (!mermaidInstance) {
      mermaidInstance = (await import("mermaid")).default;
    }
    mermaidInstance.initialize({ startOnLoad: false, theme: "default" });

    // Use unique IDs to avoid conflicts between renders
    const uniqueId = `${id}-${renderCounter++}`;
    const { svg } = await mermaidInstance.render(uniqueId, code);
    return svg;
  } finally {
    restoreDomGlobals(prevDescriptors);
  }
}

/** Render mermaid code to PNG buffer for embedding in docx */
export async function renderMermaidToPng(code: string, id: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = await renderMermaidToSvg(code, id);
  // Replace width="100%" with a fixed pixel width for rasterization
  const svgFixed = svg.replace(/width="100%"/, 'width="800"');
  const pngBuffer = await sharp(Buffer.from(svgFixed)).png().toBuffer();
  return Buffer.from(pngBuffer);
}

/** Convert markdown with mermaid blocks to HTML with pre-rendered SVGs */
export async function markdownToHtmlWithMermaidSvg(content: string): Promise<string> {
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let result = "";
  let lastIndex = 0;
  let diagramIndex = 0;

  let match;
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      result += `<div class="markdown-text"><pre>${esc(before)}</pre></div>`;
    }

    const mermaidCode = match[1].trim();
    try {
      const svg = await renderMermaidToSvg(mermaidCode, `diagram-${diagramIndex++}`);
      result += `<div class="mermaid">${svg}</div>`;
    } catch (err) {
      // Fallback: show source code if rendering fails
      console.error("Mermaid render failed:", err);
      result += `<div class="mermaid"><pre>${esc(mermaidCode)}</pre></div>`;
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    result += `<div class="markdown-text"><pre>${esc(remaining)}</pre></div>`;
  }

  return result;
}

/** Extract mermaid blocks from markdown, return HTML with raw mermaid divs (client-side rendering) */
export function markdownToHtmlWithMermaid(content: string): string {
  // Split content into segments: regular markdown and mermaid blocks
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let result = "";
  let lastIndex = 0;

  let match;
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    // Add the markdown before this mermaid block as escaped text
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      result += `<div class="markdown-text"><pre>${esc(before)}</pre></div>`;
    }

    // Add the mermaid block as a renderable diagram (NOT escaped - mermaid parses raw text)
    const mermaidCode = match[1].trim();
    result += `<div class="mermaid">${mermaidCode}</div>`;

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining content after the last mermaid block
  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    result += `<div class="markdown-text"><pre>${esc(remaining)}</pre></div>`;
  }

  return result;
}

/** Check if markdown content contains mermaid code blocks */
export function containsMermaid(content: string): boolean {
  return /```mermaid\s*\n/.test(content);
}

/** Extract just the mermaid code blocks from markdown */
export function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
