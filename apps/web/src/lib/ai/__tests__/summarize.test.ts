import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  buildSummaryPrompt,
  diffSnapshotText,
  fallbackSummary,
} from "../text-diff";
import { generateSummary, summarizeDiff } from "../summarize";

// Derived from the mock's own doGenerate so we don't have to depend on
// @ai-sdk/provider directly for its result type.
type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

// A stub model that records the prompt it was handed and returns a fixed
// completion — the "mocked provider response" the plan calls for. It lets the
// test assert on the diff→prompt wiring without any network or API key.
function mockModel(responseText: string) {
  const result: GenerateResult = {
    content: [{ type: "text", text: responseText }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 8, text: 8, reasoning: 0 },
    },
    warnings: [],
  };
  return new MockLanguageModelV4({ doGenerate: async () => result });
}

describe("diffSnapshotText", () => {
  it("keeps only the changed regions and counts words per side", () => {
    const diff = diffSnapshotText(
      "the quick brown fox",
      "the slow brown fox jumps",
    );
    expect(diff.unchanged).toBe(false);
    // "quick" removed, "slow" + "jumps" added
    expect(diff.removedWords).toBe(1);
    expect(diff.addedWords).toBe(2);
    const added = diff.segments.filter((s) => s.type === "added").map((s) => s.value.trim());
    const removed = diff.segments.filter((s) => s.type === "removed").map((s) => s.value.trim());
    expect(added.join(" ")).toContain("slow");
    expect(added.join(" ")).toContain("jumps");
    expect(removed.join(" ")).toContain("quick");
  });

  it("reports identical text as unchanged", () => {
    const diff = diffSnapshotText("same words here", "same words here");
    expect(diff.unchanged).toBe(true);
    expect(diff.addedWords).toBe(0);
    expect(diff.removedWords).toBe(0);
  });
});

describe("buildSummaryPrompt", () => {
  it("renders added lines with '+' and removed lines with '-' for the model", () => {
    const diff = diffSnapshotText("hello world", "hello brave world");
    const { system, prompt } = buildSummaryPrompt(diff);
    expect(system).toMatch(/summariz/i);
    expect(prompt).toContain("+ brave");
    // the prompt must not leak unchanged text as its own line
    expect(prompt).not.toMatch(/^\+ hello world$/m);
  });
});

describe("generateSummary (mocked provider)", () => {
  it("sends the built prompt to the model and returns its text as an AI summary", async () => {
    const diff = diffSnapshotText("draft one", "draft two with more detail");
    const model = mockModel("Expanded the draft with additional detail.");

    const result = await generateSummary(model, diff);

    expect(result.aiGenerated).toBe(true);
    expect(result.summary).toBe("Expanded the draft with additional detail.");

    // the model actually received the diff-derived prompt (the added words),
    // not something else. "draft" is unchanged so it's omitted from the diff.
    expect(model.doGenerateCalls).toHaveLength(1);
    const call = model.doGenerateCalls[0];
    const serialized = JSON.stringify(call.prompt);
    expect(serialized).toContain("two with more detail");
  });

  it("falls back to the deterministic summary when the model returns empty text", async () => {
    const diff = diffSnapshotText("a", "a b c");
    const model = mockModel("   ");
    const result = await generateSummary(model, diff);
    expect(result.aiGenerated).toBe(false);
    expect(result.summary).toBe(fallbackSummary(diff));
  });
});

describe("summarizeDiff without a provider", () => {
  it("returns the word-count fallback and never claims it was AI-generated", async () => {
    // No AI_PROVIDER / API key set in the test env, so this exercises the
    // graceful-degradation path end to end.
    const diff = diffSnapshotText("one two", "one two three four");
    const result = await summarizeDiff(diff);
    expect(result.aiGenerated).toBe(false);
    expect(result.summary).toMatch(/word/i);
  });

  it("short-circuits identical documents without a model call", async () => {
    const diff = diffSnapshotText("nothing changed", "nothing changed");
    const result = await summarizeDiff(diff);
    expect(result.aiGenerated).toBe(false);
    expect(result.summary).toMatch(/no textual changes/i);
  });
});
