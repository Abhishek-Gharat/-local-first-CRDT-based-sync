import { diffWords } from "diff";

// A single change region between two versions of the document text. `added`
// text is present in the new version only; `removed` text in the old version
// only; unchanged runs are dropped entirely so the prompt (and the fallback
// summary) only ever see what actually changed.
export interface DiffSegment {
  type: "added" | "removed";
  value: string;
}

export interface TextDiff {
  segments: DiffSegment[];
  /** Words added in the new version (whitespace-only runs don't count). */
  addedWords: number;
  /** Words removed from the old version. */
  removedWords: number;
  /** True when the two texts are identical — nothing to summarize. */
  unchanged: boolean;
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

// Diffs two plain-text snapshots into just their changed regions. This is the
// deterministic core the AI summary is built on: given the same two texts it
// always produces the same diff, so the prompt is reproducible and the
// no-provider fallback can describe the change without any model call.
export function diffSnapshotText(oldText: string, newText: string): TextDiff {
  const parts = diffWords(oldText, newText);
  const segments: DiffSegment[] = [];
  let addedWords = 0;
  let removedWords = 0;

  for (const part of parts) {
    if (part.added) {
      segments.push({ type: "added", value: part.value });
      addedWords += countWords(part.value);
    } else if (part.removed) {
      segments.push({ type: "removed", value: part.value });
      removedWords += countWords(part.value);
    }
    // unchanged parts are intentionally omitted
  }

  return {
    segments,
    addedWords,
    removedWords,
    unchanged: segments.length === 0,
  };
}

// Caps the diff text handed to the model so a huge rewrite can't blow past the
// context window or run up an unbounded bill. The head of each change region is
// the most informative part, so truncation keeps the start and marks the cut.
const MAX_DIFF_CHARS = 8_000;

function renderDiff(diff: TextDiff): string {
  const lines: string[] = [];
  let used = 0;
  for (const segment of diff.segments) {
    const marker = segment.type === "added" ? "+" : "-";
    const line = `${marker} ${segment.value.replace(/\s+/g, " ").trim()}`;
    if (used + line.length > MAX_DIFF_CHARS) {
      lines.push("… (diff truncated)");
      break;
    }
    lines.push(line);
    used += line.length;
  }
  return lines.join("\n");
}

export interface SummaryPrompt {
  system: string;
  prompt: string;
}

// Turns a diff into the exact system + user prompt sent to the provider. Kept
// separate from the model call so it can be unit-tested on its own (and so the
// mocked-provider test asserts on a stable, provider-independent string).
export function buildSummaryPrompt(diff: TextDiff): SummaryPrompt {
  const system =
    "You summarize edits to a collaborative document for a teammate who was " +
    "away. Given a word-level diff (lines starting with '+' were added, '-' " +
    "were removed), write 1–3 short sentences describing what changed in " +
    "plain language. Focus on meaning, not mechanics. Do not invent changes " +
    "that aren't in the diff. If the diff is trivial (typo, whitespace), say so.";

  const prompt =
    `Here is the word-level diff between the previous version and the ` +
    `current version:\n\n${renderDiff(diff)}\n\n` +
    `Summarize what changed.`;

  return { system, prompt };
}

// The summary used when no AI provider is configured (or a call fails). It's
// derived purely from the diff stats so the feature still returns something
// useful and honest offline — never a fake AI-sounding sentence.
export function fallbackSummary(diff: TextDiff): string {
  if (diff.unchanged) return "No textual changes between these versions.";
  const parts: string[] = [];
  if (diff.addedWords > 0) {
    parts.push(`${diff.addedWords} word${diff.addedWords === 1 ? "" : "s"} added`);
  }
  if (diff.removedWords > 0) {
    parts.push(`${diff.removedWords} word${diff.removedWords === 1 ? "" : "s"} removed`);
  }
  return `${parts.join(", ")}. (AI summary unavailable — showing a word-count diff instead.)`;
}
