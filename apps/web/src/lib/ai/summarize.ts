import { generateText, type LanguageModel } from "ai";
import { buildSummaryPrompt, fallbackSummary, type TextDiff } from "./text-diff";

// Which provider to use is chosen entirely by env var so the model is
// swappable without a code change. AI_PROVIDER picks the SDK; AI_MODEL
// optionally overrides the specific model id. The provider packages are
// imported lazily inside resolveModel so an app deployed with, say, only an
// Anthropic key never has to have the OpenAI SDK initialize.
type Provider = "anthropic" | "openai";

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

function configuredProvider(): Provider | null {
  const raw = process.env.AI_PROVIDER?.toLowerCase();
  if (raw === "anthropic" || raw === "openai") return raw;
  // Infer from whichever key is present so a bare ANTHROPIC_API_KEY / OPENAI_API_KEY
  // works with no extra config.
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

async function resolveModel(provider: Provider): Promise<LanguageModel> {
  const modelId = process.env.AI_MODEL ?? DEFAULT_MODELS[provider];
  if (provider === "anthropic") {
    const { anthropic } = await import("@ai-sdk/anthropic");
    return anthropic(modelId);
  }
  const { openai } = await import("@ai-sdk/openai");
  return openai(modelId);
}

export interface SummaryResult {
  summary: string;
  /** true when a real model produced the text; false for the deterministic fallback. */
  aiGenerated: boolean;
}

// Runs the actual model call for an already-non-trivial diff. Split out from
// summarizeDiff so a test can drive it with a mocked LanguageModel (the plan's
// "unit test on the diff-to-prompt logic with a mocked provider response")
// without touching env vars or the provider registry.
export async function generateSummary(model: LanguageModel, diff: TextDiff): Promise<SummaryResult> {
  const { system, prompt } = buildSummaryPrompt(diff);
  const { text } = await generateText({ model, system, prompt });
  const trimmed = text.trim();
  if (trimmed === "") {
    return { summary: fallbackSummary(diff), aiGenerated: false };
  }
  return { summary: trimmed, aiGenerated: true };
}

// Produces a human-readable summary of a document diff. When no provider is
// configured, or the model call fails, it returns the deterministic
// word-count fallback with aiGenerated:false rather than throwing — the
// feature degrades to "still useful" instead of "broken", and never presents
// a canned sentence as if a model wrote it.
export async function summarizeDiff(diff: TextDiff): Promise<SummaryResult> {
  if (diff.unchanged) {
    return { summary: fallbackSummary(diff), aiGenerated: false };
  }

  const provider = configuredProvider();
  if (!provider) {
    return { summary: fallbackSummary(diff), aiGenerated: false };
  }

  try {
    const model = await resolveModel(provider);
    return await generateSummary(model, diff);
  } catch {
    // Network error, bad key, rate limit — degrade, don't 500 the whole request.
    return { summary: fallbackSummary(diff), aiGenerated: false };
  }
}
