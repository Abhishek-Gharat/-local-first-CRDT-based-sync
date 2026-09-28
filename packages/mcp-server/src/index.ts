#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  type DiagramModel,
  type SystemNode,
  type SystemEdge,
  type SystemGroup,
  SYSTEM_DESIGN_TEMPLATES,
  DiagramModelSchema,
} from "shared";

const DOCSYNC_API_URL =
  process.env.DOCSYNC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

const server = new McpServer({
  name: "docsync-system-design-mcp",
  version: "1.0.0",
});

/**
 * Helper: fetch document diagram from DocSync API
 */
async function fetchDiagram(documentId: string): Promise<DiagramModel> {
  const res = await fetch(`${DOCSYNC_API_URL}/api/documents/${documentId}/diagram`);
  if (!res.ok) {
    throw new Error(`Failed to fetch diagram for ${documentId}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { diagram: DiagramModel };
  return data.diagram;
}

/**
 * Helper: save document diagram to DocSync API
 */
async function saveDiagram(
  documentId: string,
  diagram: DiagramModel,
): Promise<DiagramModel> {
  const res = await fetch(`${DOCSYNC_API_URL}/api/documents/${documentId}/diagram`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diagram }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save diagram for ${documentId}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { diagram: DiagramModel };
  return data.diagram;
}

// ── Tool 1: list_templates ──────────────────────────────────────────
server.tool(
  "list_architecture_templates",
  "List built-in system design architecture templates (Microservices, Local-First CRDT, etc.)",
  {},
  async () => {
    const list = Object.entries(SYSTEM_DESIGN_TEMPLATES).map(([key, tpl]) => ({
      key,
      name: tpl.name,
      description: tpl.description,
      nodeCount: tpl.diagram.nodes.length,
      edgeCount: tpl.diagram.edges.length,
    }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(list, null, 2),
        },
      ],
    };
  },
);

// ── Tool 2: get_document_diagram ────────────────────────────────────
server.tool(
  "get_document_diagram",
  "Get the system design diagram (nodes, edges, containers) for a DocSync document",
  {
    documentId: z.string().describe("The ID of the document to retrieve"),
  },
  async ({ documentId }) => {
    try {
      const diagram = await fetchDiagram(documentId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(diagram, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: (err as Error).message }],
      };
    }
  },
);

// ── Tool 3: set_document_diagram ────────────────────────────────────
server.tool(
  "set_document_diagram",
  "Create or replace the full system design diagram on a document canvas",
  {
    documentId: z.string().describe("The ID of the document"),
    diagram: DiagramModelSchema.describe("Full diagram object conforming to DiagramModel"),
  },
  async ({ documentId, diagram }) => {
    try {
      const saved = await saveDiagram(documentId, diagram);
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated diagram with ${saved.nodes.length} nodes and ${saved.edges.length} edges.`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: (err as Error).message }],
      };
    }
  },
);

// ── Tool 4: add_system_component ────────────────────────────────────
server.tool(
  "add_system_component",
  "Add a single system component (service, database, queue, storage, gateway) to a document canvas",
  {
    documentId: z.string().describe("The ID of the document"),
    id: z.string().describe("Unique identifier for component, e.g. 'auth-service'"),
    type: z.enum([
      "service",
      "database",
      "queue",
      "storage",
      "client",
      "gateway",
      "cloud",
      "container",
    ]).describe("Type of component"),
    label: z.string().describe("Main title of the component, e.g. 'Auth Service'"),
    sublabel: z.string().optional().describe("Subtitle or description, e.g. 'JWT & Sessions'"),
    technology: z.string().optional().describe("Technology stack, e.g. 'Go / gRPC' or 'PostgreSQL 16'"),
    color: z.enum(["blue", "emerald", "violet", "amber", "rose", "cyan", "zinc"]).default("blue"),
    x: z.number().default(200).describe("X coordinate on canvas"),
    y: z.number().default(200).describe("Y coordinate on canvas"),
  },
  async ({ documentId, id, type, label, sublabel, technology, color, x, y }) => {
    try {
      const current = await fetchDiagram(documentId);
      const newNode: SystemNode = {
        id,
        type,
        label,
        sublabel,
        technology,
        color,
        x,
        y,
        width: 220,
        height: 85,
      };
      const updated: DiagramModel = {
        ...current,
        nodes: [...current.nodes.filter((n) => n.id !== id), newNode],
      };
      await saveDiagram(documentId, updated);
      return {
        content: [
          {
            type: "text",
            text: `Added component '${label}' (${type}) to document ${documentId}.`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: (err as Error).message }],
      };
    }
  },
);

// ── Tool 5: connect_components ──────────────────────────────────────
server.tool(
  "connect_components",
  "Draw a directional connection arrow between two system components with protocol label",
  {
    documentId: z.string().describe("The ID of the document"),
    from: z.string().describe("ID of the source component"),
    to: z.string().describe("ID of the target component"),
    label: z.string().default("HTTPS / REST").describe("Protocol or message name, e.g. 'gRPC', 'OrderPlaced Event'"),
    style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  },
  async ({ documentId, from, to, label, style }) => {
    try {
      const current = await fetchDiagram(documentId);
      const edgeId = `edge-${from}-${to}-${Date.now()}`;
      const newEdge: SystemEdge = {
        id: edgeId,
        from,
        to,
        label,
        style,
        arrow: "single",
      };
      const updated: DiagramModel = {
        ...current,
        edges: [...current.edges.filter((e) => !(e.from === from && e.to === to)), newEdge],
      };
      await saveDiagram(documentId, updated);
      return {
        content: [
          {
            type: "text",
            text: `Connected ${from} -> ${to} with '${label}' on document ${documentId}.`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: (err as Error).message }],
      };
    }
  },
);

// ── Tool 6: generate_system_design ──────────────────────────────────
server.tool(
  "generate_system_design",
  "Generate a complete, high-level production system design diagram from a natural language prompt and draw it on the document canvas",
  {
    documentId: z.string().describe("The ID of the document to draw into"),
    prompt: z.string().describe("Architecture description, e.g. 'Real-time collaborative whiteboard with WebSockets, Redis pubsub, and S3'"),
  },
  async ({ documentId, prompt }) => {
    try {
      const res = await fetch(`${DOCSYNC_API_URL}/api/ai/diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        throw new Error(`AI generation endpoint returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as { diagram: DiagramModel };
      const saved = await saveDiagram(documentId, data.diagram);

      return {
        content: [
          {
            type: "text",
            text: `Generated and applied system design '${saved.title}' with ${saved.nodes.length} components and ${saved.edges.length} connections to document ${documentId}.`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: (err as Error).message }],
      };
    }
  },
);

// ── Tool 7: export_diagram_svg ──────────────────────────────────────
server.tool(
  "export_diagram_svg",
  "Export a document's system design diagram as clean standalone SVG code",
  {
    documentId: z.string().describe("The ID of the document"),
  },
  async ({ documentId }) => {
    try {
      const diagram = await fetchDiagram(documentId);
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" style="background:#0d0f12;font-family:sans-serif;">\n`;
      svg += `  <style>\n    .node { fill: #18181b; stroke-width: 1.5; rx: 12px; }\n    .label { fill: #ffffff; font-weight: 700; font-size: 13px; }\n    .sublabel { fill: #94a3b8; font-size: 10px; }\n    .edge { stroke: #64748b; stroke-width: 1.8; fill: none; }\n    .group { fill: rgba(24,24,27,0.3); stroke-dasharray: 6 6; stroke-width: 2; rx: 16px; }\n  </style>\n`;

      // Groups
      diagram.groups.forEach((g) => {
        svg += `  <rect class="group" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" stroke="#3f3f46" />\n`;
        svg += `  <text x="${g.x + 14}" y="${g.y + 24}" fill="#e4e4e7" font-weight="700" font-size="12px">${g.label}</text>\n`;
      });

      // Edges
      diagram.edges.forEach((e) => {
        const from = diagram.nodes.find((n) => n.id === e.from);
        const to = diagram.nodes.find((n) => n.id === e.to);
        if (from && to) {
          const x1 = from.x + from.width / 2;
          const y1 = from.y + from.height / 2;
          const x2 = to.x + to.width / 2;
          const y2 = to.y + to.height / 2;
          svg += `  <line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />\n`;
          if (e.label) {
            svg += `  <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" fill="#cbd5e1" font-size="11px" font-weight="600" text-anchor="middle">${e.label}</text>\n`;
          }
        }
      });

      // Nodes
      diagram.nodes.forEach((n) => {
        svg += `  <rect class="node" x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" stroke="#38bdf8" />\n`;
        svg += `  <text class="label" x="${n.x + 14}" y="${n.y + 30}">${n.label}</text>\n`;
        if (n.sublabel) {
          svg += `  <text class="sublabel" x="${n.x + 14}" y="${n.y + 48}">${n.sublabel}</text>\n`;
        }
        if (n.technology) {
          svg += `  <text fill="#64748b" font-family="monospace" font-size="9px" x="${n.x + 14}" y="${n.y + 68}">${n.technology}</text>\n`;
        }
      });

      svg += `</svg>`;
      return {
        content: [{ type: "text", text: svg }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: (err as Error).message }],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DocSync System Design MCP Server running on stdio transport.");
}

main().catch((err) => {
  console.error("MCP Server fatal error:", err);
  process.exit(1);
});
