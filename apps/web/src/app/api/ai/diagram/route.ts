import { NextResponse } from "next/server";
import { generateClientDiagramFromPrompt } from "@/components/canvas/ai-diagram-modal";
import { DiagramModelSchema } from "shared";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    // Try server LLM if configured
    const apiKey =
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GROQ_API_KEY;

    if (apiKey) {
      try {
        const { generateText } = await import("ai");
        let model;

        if (process.env.ANTHROPIC_API_KEY) {
          const { anthropic } = await import("@ai-sdk/anthropic");
          model = anthropic("claude-haiku-4-5-20251001");
        } else if (process.env.GROQ_API_KEY) {
          const { groq } = await import("@ai-sdk/groq");
          model = groq("llama-3.3-70b-versatile");
        } else {
          const { openai } = await import("@ai-sdk/openai");
          model = openai("gpt-4o-mini");
        }

        const system = `You are a Principal Cloud & System Design Architect.
Output ONLY raw JSON conforming to this schema without markdown or codeblocks:
{
  "version": 1,
  "title": string,
  "viewport": { "x": 40, "y": 40, "zoom": 0.85 },
  "groups": [
    { "id": string, "label": string, "x": number, "y": number, "width": number, "height": number, "color": "blue"|"emerald"|"violet"|"amber"|"rose"|"cyan"|"zinc" }
  ],
  "nodes": [
    { "id": string, "type": "service"|"database"|"queue"|"storage"|"client"|"gateway"|"cloud"|"container", "label": string, "sublabel": string, "technology": string, "color": "blue"|"emerald"|"violet"|"amber"|"rose"|"cyan"|"zinc", "x": number, "y": number, "width": number, "height": number, "parentId": string }
  ],
  "edges": [
    { "id": string, "from": string, "to": string, "label": string, "style": "solid"|"dashed"|"dotted", "arrow": "single"|"bidirectional" }
  ]
}
Make the architecture realistic, production-ready, clean, well spaced with coordinates (x in [50, 1400], y in [80, 500]), and connected with protocols (HTTPS, gRPC, Pub/Sub, SQL).`;

        const result = await generateText({
          model,
          system,
          prompt: `Generate a full production system design diagram for: ${prompt}`,
        });

        const cleaned = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const validated = DiagramModelSchema.safeParse(parsed);
        if (validated.success) {
          return NextResponse.json({ diagram: validated.data });
        }
      } catch {
        /* fallback below */
      }
    }

    // High quality deterministic rule-based generator
    const diagram = generateClientDiagramFromPrompt(prompt);
    return NextResponse.json({ diagram });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "failed to generate diagram" },
      { status: 500 },
    );
  }
}
