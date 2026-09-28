"use client";

import { useCallback, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, ChevronDown, Copy, Terminal } from "lucide-react";
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
      window.setTimeout(() => setCopied(false), 2000);
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
    <NodeViewWrapper className="code-block-wrapper group/code relative my-6 overflow-hidden rounded-xl border border-zinc-800/90 bg-[#0d1117] font-mono text-xs shadow-md">
      {/* Sleek macOS-inspired Terminal Header */}
      <div
        contentEditable={false}
        className="flex items-center justify-between border-b border-zinc-800/80 bg-[#161b22] px-3.5 py-2 select-none"
      >
        <div className="flex items-center gap-3">
          {/* macOS 3-dot window buttons */}
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f56] opacity-80 transition-opacity hover:opacity-100" />
            <span className="size-2.5 rounded-full bg-[#ffbd2e] opacity-80 transition-opacity hover:opacity-100" />
            <span className="size-2.5 rounded-full bg-[#27c93f] opacity-80 transition-opacity hover:opacity-100" />
          </div>

          <div className="h-3 w-px bg-zinc-800" aria-hidden />

          {/* Styled Language Selector Pill */}
          <div className="relative flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800">
            <Terminal aria-hidden className="size-3 text-zinc-400" />
            <select
              aria-label="Code language"
              value={currentLanguage}
              onChange={handleLanguageChange}
              className="cursor-pointer appearance-none bg-transparent pr-4 font-mono text-[11px] font-medium text-zinc-200 outline-none hover:text-white"
            >
              {POPULAR_LANGUAGES.map((lang) => (
                <option
                  key={lang.value}
                  value={lang.value}
                  className="bg-zinc-900 text-zinc-200"
                >
                  {lang.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-1.5 size-2.5 text-zinc-400"
            />
          </div>
        </div>

        {/* Copy button with smooth feedback */}
        <button
          type="button"
          aria-label={copied ? "Code copied" : "Copy code"}
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-all hover:border-zinc-700/60 hover:bg-zinc-800/80 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            copied && "border-emerald-500/30 bg-emerald-950/40 text-emerald-400 hover:text-emerald-300",
          )}
        >
          {copied ? (
            <>
              <Check aria-hidden className="size-3 text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy aria-hidden className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content surface */}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-100 selection:bg-zinc-700/80">
        <NodeViewContent<"code"> as="code" className="hljs font-mono" />
      </pre>
    </NodeViewWrapper>
  );
}
