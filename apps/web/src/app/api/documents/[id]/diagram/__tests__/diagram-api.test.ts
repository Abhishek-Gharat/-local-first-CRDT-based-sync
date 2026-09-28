import { describe, expect, it } from "vitest";
import { getDocumentDiagram, saveDocumentDiagram } from "@/lib/diagram/diagram-store";
import { DiagramModelSchema, SYSTEM_DESIGN_TEMPLATES } from "shared";

describe("Document Diagram Store & API", () => {
  it("retrieves a default diagram when none exists", () => {
    const docId = `test-doc-${Date.now()}`;
    const diagram = getDocumentDiagram(docId);
    expect(diagram).toBeDefined();
    expect(diagram.nodes.length).toBeGreaterThan(0);
    const parsed = DiagramModelSchema.safeParse(diagram);
    expect(parsed.success).toBe(true);
  });

  it("saves and retrieves an updated diagram", () => {
    const docId = `test-doc-${Date.now()}-2`;
    const updated = {
      ...SYSTEM_DESIGN_TEMPLATES.microservices.diagram,
      title: "Custom Updated Title",
    };
    saveDocumentDiagram(docId, updated);
    const retrieved = getDocumentDiagram(docId);
    expect(retrieved.title).toBe("Custom Updated Title");
    expect(retrieved.nodes.length).toBe(updated.nodes.length);
  });
});
