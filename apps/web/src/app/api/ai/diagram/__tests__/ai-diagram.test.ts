import { describe, expect, it } from "vitest";
import { generateClientDiagramFromPrompt } from "@/components/canvas/ai-diagram-modal";
import { DiagramModelSchema } from "shared";

describe("AI diagram generation", () => {
  it("generates valid video streaming architecture from prompt", () => {
    const d = generateClientDiagramFromPrompt("Design video streaming like Netflix with transcoding and S3");
    expect(d.title).toContain("Video Streaming");
    expect(d.nodes.length).toBeGreaterThan(3);
    expect(d.edges.length).toBeGreaterThan(3);
    const parsed = DiagramModelSchema.safeParse(d);
    expect(parsed.success).toBe(true);
  });

  it("generates valid RAG AI architecture from prompt", () => {
    const d = generateClientDiagramFromPrompt("Build an enterprise RAG pipeline with Qdrant and LLM");
    expect(d.title).toContain("RAG");
    expect(d.nodes.some((n) => n.technology?.includes("Qdrant"))).toBe(true);
    const parsed = DiagramModelSchema.safeParse(d);
    expect(parsed.success).toBe(true);
  });

  it("generates default microservice architecture for generic prompts", () => {
    const d = generateClientDiagramFromPrompt("High availability backend");
    expect(d.nodes.length).toBeGreaterThan(0);
    expect(d.groups.length).toBeGreaterThan(0);
    const parsed = DiagramModelSchema.safeParse(d);
    expect(parsed.success).toBe(true);
  });
});
