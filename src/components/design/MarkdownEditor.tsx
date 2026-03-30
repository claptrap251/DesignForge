"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import remarkSourceLines from "@/lib/remarkSourceLines";
import MermaidBlock from "@/components/design/MermaidBlock";

interface MarkdownEditorProps {
  content: string;
  onSave: (content: string, changeNote: string) => Promise<void>;
  onCancel: () => void;
}

type FormatAction = {
  label: string;
  icon: React.ReactNode;
  prefix: string;
  suffix: string;
  block?: boolean;
};

const formatActions: FormatAction[] = [
  {
    label: "Bold",
    icon: <span className="font-bold">B</span>,
    prefix: "**",
    suffix: "**",
  },
  {
    label: "Italic",
    icon: <span className="italic">I</span>,
    prefix: "*",
    suffix: "*",
  },
  {
    label: "H1",
    icon: <span className="font-bold text-xs">H1</span>,
    prefix: "# ",
    suffix: "",
    block: true,
  },
  {
    label: "H2",
    icon: <span className="font-bold text-xs">H2</span>,
    prefix: "## ",
    suffix: "",
    block: true,
  },
  {
    label: "H3",
    icon: <span className="font-bold text-xs">H3</span>,
    prefix: "### ",
    suffix: "",
    block: true,
  },
  {
    label: "Code",
    icon: <span className="font-mono text-xs">{"`"}</span>,
    prefix: "`",
    suffix: "`",
  },
  {
    label: "Link",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    prefix: "[",
    suffix: "](url)",
  },
  {
    label: "List",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    prefix: "- ",
    suffix: "",
    block: true,
  },
  {
    label: "HR",
    icon: <span className="text-xs">―</span>,
    prefix: "\n---\n",
    suffix: "",
    block: true,
  },
];

export default function MarkdownEditor({ content, onSave, onCancel }: MarkdownEditorProps) {
  const [editContent, setEditContent] = useState(content);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [changeNoteFocused, setChangeNoteFocused] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasChanges = editContent !== content;

  // Unsaved changes guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChanges, saving, editContent, changeNote]);

  const insertFormat = useCallback((action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editContent;
    const selected = text.substring(start, end);

    let newText: string;
    let newCursorPos: number;

    if (action.block && !selected) {
      // For block-level formatting with no selection, ensure we're on a new line
      const beforeCursor = text.substring(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith("\n");
      const prefix = (needsNewline ? "\n" : "") + action.prefix;
      newText = text.substring(0, start) + prefix + action.suffix + text.substring(end);
      newCursorPos = start + prefix.length;
    } else {
      newText = text.substring(0, start) + action.prefix + selected + action.suffix + text.substring(end);
      newCursorPos = start + action.prefix.length + selected.length + action.suffix.length;
    }

    setEditContent(newText);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
    });
  }, [editContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editContent, changeNote);
    } catch {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (!window.confirm("You have unsaved changes. Discard them?")) return;
    }
    onCancel();
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center gap-1 px-3 py-2 border-b"
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-0.5 mr-3">
          {formatActions.map((action) => (
            <button
              key={action.label}
              onClick={() => insertFormat(action)}
              title={action.label}
              className="flex items-center justify-center w-7 h-7 rounded hover-warm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              {action.icon}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            onFocus={() => setChangeNoteFocused(true)}
            onBlur={() => setChangeNoteFocused(false)}
            placeholder="Change note (optional)"
            className="w-48 lg:w-64 rounded border px-2 py-1 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-page)',
              color: 'var(--text-primary)',
              borderColor: changeNoteFocused ? 'var(--accent)' : 'var(--border-medium)',
            }}
          />
          <button
            onClick={handleCancel}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover-warm"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            onMouseEnter={() => setSaveHovered(true)}
            onMouseLeave={() => setSaveHovered(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: saveHovered ? 'var(--accent-hover)' : 'var(--accent)' }}
          >
            {saving ? "Saving..." : "Save as New Version"}
          </button>
        </div>
      </div>

      {/* Split view: editor + preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        <div className="w-1/2 flex flex-col border-r" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="px-3 py-1.5 text-xs font-medium border-b"
            style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
          >
            Markdown
          </div>
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 w-full resize-none border-0 px-4 py-3 font-mono text-sm leading-relaxed focus:outline-none"
            style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div className="w-1/2 flex flex-col">
          <div
            className="px-3 py-1.5 text-xs font-medium border-b"
            style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
          >
            Preview
          </div>
          <div className="flex-1 overflow-auto px-8 py-6">
            <article className="prose prose-lg max-w-none leading-relaxed prose-h1:text-3xl prose-h1:mt-10 prose-h1:mb-6 prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-5 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-p:my-5 prose-p:leading-8 prose-li:my-2 prose-li:leading-7 prose-ul:my-5 prose-ol:my-5 prose-blockquote:my-6 prose-blockquote:pl-5 prose-hr:my-10 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:my-8 prose-pre:p-5 prose-table:my-8 prose-img:my-8 prose-figure:my-8">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkSourceLines]}
                rehypePlugins={[rehypeSlug]}
                components={{
                  h1: ({ children, ...props }) => (
                    <h1 style={{ color: 'var(--text-primary)' }} {...props}>{children}</h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2 style={{ color: 'var(--text-primary)' }} {...props}>{children}</h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3 style={{ color: 'var(--text-primary)' }} {...props}>{children}</h3>
                  ),
                  p: ({ children, ...props }) => (
                    <p style={{ color: 'var(--text-primary)' }} {...props}>{children}</p>
                  ),
                  strong: ({ children, ...props }) => (
                    <strong style={{ color: 'var(--text-primary)' }} {...props}>{children}</strong>
                  ),
                  a: ({ children, ...props }) => (
                    <a style={{ color: 'var(--accent)' }} {...props}>{children}</a>
                  ),
                  li: ({ children, ...props }) => (
                    <li style={{ color: 'var(--text-primary)' }} {...props}>{children}</li>
                  ),
                  blockquote: ({ children, ...props }) => (
                    <blockquote style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-medium)' }} {...props}>{children}</blockquote>
                  ),
                  code({ className, children: codeChildren, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const lang = match ? match[1] : "";
                    const codeStr = String(codeChildren).replace(/\n$/, "");

                    if (lang === "mermaid") {
                      return <MermaidBlock code={codeStr} />;
                    }

                    if (lang) {
                      return (
                        <pre
                          className="overflow-x-auto rounded-lg p-4 text-sm"
                          style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}
                        >
                          <code className={className} {...props}>
                            {codeChildren}
                          </code>
                        </pre>
                      );
                    }

                    return (
                      <code
                        className={className}
                        style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}
                        {...props}
                      >
                        {codeChildren}
                      </code>
                    );
                  },
                }}
              >
                {editContent}
              </ReactMarkdown>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
