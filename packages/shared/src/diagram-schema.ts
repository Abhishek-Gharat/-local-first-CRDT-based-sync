import { z } from "zod";

export const NodeTypeEnum = z.enum([
  "service",
  "database",
  "queue",
  "storage",
  "client",
  "gateway",
  "cloud",
  "container",
  "text",
  "rectangle",
  "circle",
]);
export type NodeType = z.infer<typeof NodeTypeEnum>;

export const NodeColorEnum = z.enum([
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "cyan",
  "zinc",
  "orange",
]);
export type NodeColor = z.infer<typeof NodeColorEnum>;

export const SystemNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeEnum,
  label: z.string(),
  sublabel: z.string().optional(),
  technology: z.string().optional(),
  icon: z.string().optional(),
  color: NodeColorEnum.default("blue"),
  x: z.number(),
  y: z.number(),
  width: z.number().default(180),
  height: z.number().default(90),
  parentId: z.string().optional(),
  status: z.enum(["healthy", "warning", "active", "draft"]).optional(),
});
export type SystemNode = z.infer<typeof SystemNodeSchema>;

export const EdgeStyleEnum = z.enum(["solid", "dashed", "dotted"]);
export type EdgeStyle = z.infer<typeof EdgeStyleEnum>;

export const EdgeArrowEnum = z.enum(["single", "bidirectional", "none"]);
export type EdgeArrow = z.infer<typeof EdgeArrowEnum>;

export const SystemEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  style: EdgeStyleEnum.default("solid"),
  arrow: EdgeArrowEnum.default("single"),
  color: z.string().optional(),
});
export type SystemEdge = z.infer<typeof SystemEdgeSchema>;

export const SystemGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().default(400),
  height: z.number().default(300),
  color: NodeColorEnum.default("zinc"),
});
export type SystemGroup = z.infer<typeof SystemGroupSchema>;

export const DrawingPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type DrawingPoint = z.infer<typeof DrawingPointSchema>;

export const SystemDrawingSchema = z.object({
  id: z.string(),
  points: z.array(DrawingPointSchema),
  color: z.string().default("#a855f7"),
  strokeWidth: z.number().default(3),
  tool: z.enum(["pen", "highlighter"]).default("pen"),
});
export type SystemDrawing = z.infer<typeof SystemDrawingSchema>;

export const DiagramModelSchema = z.object({
  version: z.number().default(1),
  title: z.string().optional(),
  nodes: z.array(SystemNodeSchema).default([]),
  edges: z.array(SystemEdgeSchema).default([]),
  groups: z.array(SystemGroupSchema).default([]),
  drawings: z.array(SystemDrawingSchema).default([]),
  viewport: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
      zoom: z.number().default(1),
    })
    .default({ x: 0, y: 0, zoom: 1 }),
});
export type DiagramModel = z.infer<typeof DiagramModelSchema>;

/**
 * Creates an empty diagram model.
 */
export function createEmptyDiagram(title?: string): DiagramModel {
  return {
    version: 1,
    title: title ?? "System Architecture",
    nodes: [],
    edges: [],
    groups: [],
    drawings: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

/**
 * Built-in production-grade system architecture templates.
 */
export const SYSTEM_DESIGN_TEMPLATES: Record<string, { name: string; description: string; diagram: DiagramModel }> = {
  microservices: {
    name: "Microservices Architecture",
    description: "API Gateway with auth, core services, Kafka event bus, and database replicas",
    diagram: {
      version: 1,
      title: "Microservices Architecture",
      viewport: { x: 40, y: 40, zoom: 0.85 },
      drawings: [],
      groups: [
        {
          id: "grp-edge",
          label: "Edge Network & Security",
          x: 40,
          y: 60,
          width: 260,
          height: 380,
          color: "blue",
        },
        {
          id: "grp-core",
          label: "Core Services Mesh (Kubernetes)",
          x: 350,
          y: 60,
          width: 520,
          height: 380,
          color: "violet",
        },
        {
          id: "grp-data",
          label: "Data & Persistence Layer",
          x: 920,
          y: 60,
          width: 320,
          height: 380,
          color: "emerald",
        },
      ],
      nodes: [
        {
          id: "client-web",
          type: "client",
          label: "Web & Mobile Clients",
          sublabel: "Next.js / React Native",
          technology: "HTTPS / WSS",
          color: "zinc",
          x: 70,
          y: 110,
          width: 200,
          height: 80,
          parentId: "grp-edge",
        },
        {
          id: "api-gateway",
          type: "gateway",
          label: "Cloudflare / Envoy Gateway",
          sublabel: "TLS Termination & Rate Limiting",
          technology: "Envoy Proxy",
          color: "blue",
          x: 70,
          y: 250,
          width: 200,
          height: 90,
          parentId: "grp-edge",
        },
        {
          id: "auth-svc",
          type: "service",
          label: "Auth & Identity Service",
          sublabel: "JWT / OAuth2 / Sessions",
          technology: "Go / gRPC",
          color: "violet",
          x: 380,
          y: 110,
          width: 210,
          height: 85,
          parentId: "grp-core",
        },
        {
          id: "order-svc",
          type: "service",
          label: "Order & Payment Service",
          sublabel: "Transactional processing",
          technology: "Node.js / TypeScript",
          color: "violet",
          x: 380,
          y: 240,
          width: 210,
          height: 85,
          parentId: "grp-core",
        },
        {
          id: "kafka-bus",
          type: "queue",
          label: "Kafka Event Broker",
          sublabel: "Topic: orders, payments, sync",
          technology: "Apache Kafka",
          color: "amber",
          x: 640,
          y: 170,
          width: 200,
          height: 90,
          parentId: "grp-core",
        },
        {
          id: "db-primary",
          type: "database",
          label: "PostgreSQL Primary",
          sublabel: "ACID transactions & CDC",
          technology: "PostgreSQL 16",
          color: "emerald",
          x: 950,
          y: 110,
          width: 230,
          height: 85,
          parentId: "grp-data",
        },
        {
          id: "cache-redis",
          type: "database",
          label: "Redis Cluster",
          sublabel: "Session store & LRU Cache",
          technology: "Redis 7.2",
          color: "rose",
          x: 950,
          y: 240,
          width: 230,
          height: 85,
          parentId: "grp-data",
        },
      ],
      edges: [
        { id: "e1", from: "client-web", to: "api-gateway", label: "HTTPS / WSS", style: "solid", arrow: "single" },
        { id: "e2", from: "api-gateway", to: "auth-svc", label: "Verify JWT", style: "solid", arrow: "single" },
        { id: "e3", from: "api-gateway", to: "order-svc", label: "gRPC", style: "solid", arrow: "single" },
        { id: "e4", from: "order-svc", to: "kafka-bus", label: "OrderCreated Event", style: "dashed", arrow: "single" },
        { id: "e5", from: "order-svc", to: "db-primary", label: "SQL write", style: "solid", arrow: "single" },
        { id: "e6", from: "auth-svc", to: "cache-redis", label: "Fast token lookup", style: "solid", arrow: "single" },
        { id: "e7", from: "db-primary", to: "cache-redis", label: "Cache sync", style: "dotted", arrow: "single" },
      ],
    },
  },
  localFirstCrdt: {
    name: "Local-First CRDT Architecture",
    description: "DocSync sync-engine, IndexedDB persistence, WebSocket gateway, and PostgreSQL version store",
    diagram: {
      version: 1,
      title: "DocSync Local-First CRDT Architecture",
      viewport: { x: 40, y: 40, zoom: 0.85 },
      drawings: [],
      groups: [
        {
          id: "grp-client",
          label: "Local Client Runtime (Browser)",
          x: 50,
          y: 50,
          width: 320,
          height: 380,
          color: "blue",
        },
        {
          id: "grp-sync",
          label: "Real-time Sync Cluster",
          x: 430,
          y: 50,
          width: 360,
          height: 380,
          color: "violet",
        },
        {
          id: "grp-storage",
          label: "Cloud Persistence & Snapshots",
          x: 850,
          y: 50,
          width: 330,
          height: 380,
          color: "emerald",
        },
      ],
      nodes: [
        {
          id: "tiptap-editor",
          type: "service",
          label: "Tiptap ProseMirror",
          sublabel: "Rich-text UI & UndoGranularity",
          technology: "React 19 / Tiptap",
          color: "blue",
          x: 80,
          y: 100,
          width: 250,
          height: 85,
          parentId: "grp-client",
        },
        {
          id: "crdt-doc",
          type: "database",
          label: "Local Y.Doc (CRDT)",
          sublabel: "Conflict-free state vectors",
          technology: "Yjs Core",
          color: "cyan",
          x: 80,
          y: 215,
          width: 250,
          height: 85,
          parentId: "grp-client",
        },
        {
          id: "indexeddb",
          type: "storage",
          label: "IndexedDB Storage",
          sublabel: "Local-first offline persistence",
          technology: "y-indexeddb",
          color: "emerald",
          x: 80,
          y: 330,
          width: 250,
          height: 75,
          parentId: "grp-client",
        },
        {
          id: "sync-gateway",
          type: "gateway",
          label: "Sync Server (WebSocket)",
          sublabel: "y-protocols / Awareness",
          technology: "Node.js / ws (Port 1234)",
          color: "violet",
          x: 460,
          y: 120,
          width: 280,
          height: 90,
          parentId: "grp-sync",
        },
        {
          id: "guard-svc",
          type: "service",
          label: "RBAC Message Guard",
          sublabel: "Token verification & role validation",
          technology: "HMAC-SHA256 Token",
          color: "amber",
          x: 460,
          y: 250,
          width: 280,
          height: 90,
          parentId: "grp-sync",
        },
        {
          id: "nextjs-api",
          type: "service",
          label: "Next.js App Server",
          sublabel: "Auth, documents, version history",
          technology: "Next.js 16 (App Router)",
          color: "zinc",
          x: 880,
          y: 120,
          width: 270,
          height: 90,
          parentId: "grp-storage",
        },
        {
          id: "pg-snapshots",
          type: "database",
          label: "PostgreSQL Database",
          sublabel: "Snapshots (bytea) & document metadata",
          technology: "Drizzle ORM / Postgres",
          color: "emerald",
          x: 880,
          y: 250,
          width: 270,
          height: 90,
          parentId: "grp-storage",
        },
      ],
      edges: [
        { id: "c1", from: "tiptap-editor", to: "crdt-doc", label: "Transaction / XML fragment", style: "solid", arrow: "bidirectional" },
        { id: "c2", from: "crdt-doc", to: "indexeddb", label: "Offline write / hydrate", style: "solid", arrow: "bidirectional" },
        { id: "c3", from: "crdt-doc", to: "sync-gateway", label: "SyncStep1 / Update (WS)", style: "solid", arrow: "bidirectional" },
        { id: "c4", from: "sync-gateway", to: "guard-svc", label: "Check DocumentRole", style: "solid", arrow: "single" },
        { id: "c5", from: "tiptap-editor", to: "nextjs-api", label: "Save Version (Snapshot)", style: "dashed", arrow: "single" },
        { id: "c6", from: "nextjs-api", to: "pg-snapshots", label: "Persist bytea update", style: "solid", arrow: "single" },
      ],
    },
  },
};
