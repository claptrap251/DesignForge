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

  const win = dom.window as any;

  // Stub matchMedia — mermaid uses it for theme/media queries
  if (!win.matchMedia) {
    win.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  // Stub ResizeObserver — mermaid uses it for layout calculations
  if (!win.ResizeObserver) {
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Stub IntersectionObserver
  if (!win.IntersectionObserver) {
    win.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Stub SVGPathElement, SVGTextElement and other SVG classes jsdom lacks
  const svgClassStubs = [
    "SVGPathElement", "SVGTextElement", "SVGTSpanElement",
    "SVGCircleElement", "SVGEllipseElement", "SVGRectElement",
    "SVGLineElement", "SVGPolylineElement", "SVGPolygonElement",
    "SVGGElement", "SVGDefsElement", "SVGUseElement",
    "SVGMarkerElement", "SVGClipPathElement", "SVGForeignObjectElement",
  ];
  for (const cls of svgClassStubs) {
    if (!win[cls]) {
      win[cls] = win.SVGElement ?? class extends win.Element {};
    }
  }

  // Patch SVG methods that jsdom doesn't implement on created elements
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
          toJSON: () => ({}),
        });
      // Stub createSVGRect for SVGSVGElement
      if (tag === "svg" && !svgEl.createSVGRect) {
        svgEl.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
      }
      if (tag === "svg" && !svgEl.createSVGPoint) {
        svgEl.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) });
      }
    }
    return el;
  } as typeof dom.window.document.createElementNS;

  mermaidDom = dom;
  return dom;
}

let domGlobalsSet = false;

function ensureDomGlobals(dom: JSDOM): void {
  if (domGlobalsSet) return;

  const win = dom.window as any;
  const globalValues: Record<string, unknown> = {
    window: win,
    document: win.document,
    navigator: win.navigator,
    DOMParser: win.DOMParser,
    XMLSerializer: win.XMLSerializer,
    self: win,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    SVGElement: win.SVGElement,
    SVGGraphicsElement: win.SVGGraphicsElement,
    SVGPathElement: win.SVGPathElement,
    SVGTextElement: win.SVGTextElement,
    SVGTSpanElement: win.SVGTSpanElement,
    matchMedia: win.matchMedia,
    ResizeObserver: win.ResizeObserver,
    IntersectionObserver: win.IntersectionObserver,
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
    getComputedStyle: win.getComputedStyle,
    MutationObserver: win.MutationObserver,
    CustomEvent: win.CustomEvent,
    CSSStyleDeclaration: win.CSSStyleDeclaration,
  };

  for (const [key, value] of Object.entries(globalValues)) {
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }

  domGlobalsSet = true;
}

/** Render mermaid code to SVG server-side using jsdom */
export async function renderMermaidToSvg(code: string, id: string): Promise<string> {
  const dom = ensureMermaidDom();

  // Mermaid is a singleton that caches DOM globals (window, document, etc.)
  // at import time.  Restoring globals between renders breaks subsequent
  // calls, so we set them once and leave them in place.
  ensureDomGlobals(dom);

  if (!mermaidInstance) {
    mermaidInstance = (await import("mermaid")).default;
  }
  mermaidInstance.initialize({ startOnLoad: false, theme: "default" });

  // Use unique IDs to avoid conflicts between renders.
  // Let mermaid manage its own DOM lifecycle — it calls
  // removeExistingElements() internally to clean up previous renders.
  const uniqueId = `${id}-${renderCounter++}`;
  const { svg } = await mermaidInstance.render(uniqueId, code);

  return svg;
}

/** Render mermaid code to PNG buffer for embedding in docx */
export async function renderMermaidToPng(code: string, id: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = await renderMermaidToSvg(code, id);

  // Mermaid outputs width="100%" with a style containing max-width in px,
  // plus a viewBox.  Sharp needs explicit pixel width/height to rasterize.
  // Extract dimensions from the viewBox and scale to a reasonable output size.
  let width = 800;
  let height = 600;
  const viewBoxMatch = svg.match(/viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/);
  if (viewBoxMatch) {
    const vbWidth = parseFloat(viewBoxMatch[1]);
    const vbHeight = parseFloat(viewBoxMatch[2]);
    if (vbWidth > 0 && vbHeight > 0) {
      const scale = width / vbWidth;
      height = Math.round(vbHeight * scale);
    }
  }

  // Replace width="100%" with pixel width, and inject height attribute
  const svgFixed = svg.replace(
    /width="100%"/,
    `width="${width}" height="${height}"`
  );

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
    const svg = await renderMermaidToSvg(mermaidCode, `diagram-${diagramIndex++}`);
    result += `<div class="mermaid">${svg}</div>`;

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
