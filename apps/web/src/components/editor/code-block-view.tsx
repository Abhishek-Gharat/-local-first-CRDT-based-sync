"use client";

import { useCallback, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Copy, Terminal } from "lucide-react";
import { POPULAR_LANGUAGES } from "@/lib/editor/lowlight";
import { cn } from "@/lib/utils";

export function CodeBlockComponent({
  node,
  updateAttributes,
}: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const currentLanguage = (node.attrs.language as string) || "";

  const handleCopy = useCallback(async () => {
    const text = node.textContent;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }, [node.textContent]);

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: e.target.value || null });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="code-block-wrapper group/code relative my-4 overflow-hidden rounded-xl border border-border bg-muted/40 font-mono text-xs shadow-xs">
      {/* Code block header bar */}
      <div
        contentEditable={false}
        className="flex items-center justify-between border-b border-border/80 bg-muted/70 px-3 py-1.5 text-muted-foreground select-none"
      >
        <div className="flex items-center gap-2">
          <Terminal aria-hidden className="size-3.5 text-muted-foreground" />
          <select
            aria-label="Code language"
            value={currentLanguage}
            onChange={handleLanguageChange}
            className="cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-border hover:bg-background/80 focus:border-ring focus:outline-none"
          >
            {POPULAR_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="bg-popover text-popover-foreground">
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          aria-label={copied ? "Code copied" : "Copy code"}
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            copied && "text-success",
          )}
        >
          {copied ? (
            <>
              <Check aria-hidden className="size-3 text-success" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy aria-hidden className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <NodeViewContent<"code"> as="code" className="hljs font-mono" />
      </pre>
    </NodeViewWrapper>
  );
}
