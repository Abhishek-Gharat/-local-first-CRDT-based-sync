import { describe, expect, it } from "vitest";
import {
  DiagramModelSchema,
  createEmptyDiagram,
  SYSTEM_DESIGN_TEMPLATES,
} from "../diagram-schema.js";

describe("diagram schema and templates", () => {
  it("creates valid empty diagram", () => {
    const d = createEmptyDiagram("Test Arch");
    expect(d.title).toBe("Test Arch");
    expect(d.nodes).toEqual([]);
    expect(d.edges).toEqual([]);
    expect(d.groups).toEqual([]);
    const parsed = DiagramModelSchema.safeParse(d);
    expect(parsed.success).toBe(true);
  });

  it("validates built-in system design templates", () => {
    for (const [key, tpl] of Object.entries(SYSTEM_DESIGN_TEMPLATES)) {
      const parsed = DiagramModelSchema.safeParse(tpl.diagram);
      expect(parsed.success, `Template ${key} failed validation: ${JSON.stringify(parsed)}`).toBe(true);
      expect(tpl.diagram.nodes.length).toBeGreaterThan(0);
      expect(tpl.diagram.edges.length).toBeGreaterThan(0);
    }
  });
});
