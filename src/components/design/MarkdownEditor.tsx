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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-0.5 mr-3">
          {formatActions.map((action) => (
            <button
              key={action.label}
              onClick={() => insertFormat(action)}
              title={action.label}
              className="flex items-center justify-center w-7 h-7 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
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
            placeholder="Change note (optional)"
            className="w-48 lg:w-64 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleCancel}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as New Version"}
          </button>
        </div>
      </div>

      {/* Split view: editor + preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            Markdown
          </div>
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 w-full resize-none border-0 bg-white dark:bg-gray-900 dark:text-gray-100 px-4 py-3 font-mono text-sm leading-relaxed focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            Preview
          </div>
          <div className="flex-1 overflow-auto px-8 py-6">
            <article className="prose prose-lg prose-gray dark:prose-invert max-w-none leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-h1:text-3xl prose-h1:mt-10 prose-h1:mb-6 prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-5 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-p:my-5 prose-p:leading-8 prose-li:my-2 prose-li:leading-7 prose-ul:my-5 prose-ol:my-5 prose-blockquote:my-6 prose-blockquote:pl-5 prose-hr:my-10 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-code:rounded prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:my-8 prose-pre:p-5 prose-table:my-8 prose-img:my-8 prose-figure:my-8 prose-strong:text-gray-900 dark:prose-strong:text-gray-100">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkSourceLines]}
                rehypePlugins={[rehypeSlug]}
                components={{
                  code({ className, children: codeChildren, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const lang = match ? match[1] : "";
                    const codeStr = String(codeChildren).replace(/\n$/, "");

                    if (lang === "mermaid") {
                      return <MermaidBlock code={codeStr} />;
                    }

                    if (lang) {
                      return (
                        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                          <code className={className} {...props}>
                            {codeChildren}
                          </code>
                        </pre>
                      );
                    }

                    return (
                      <code className={className} {...props}>
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
