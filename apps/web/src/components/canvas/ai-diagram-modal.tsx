"use client";

import { useState } from "react";
import { Sparkles, Loader2, ArrowRight, Layers, Database, Cpu, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DiagramModel,
  type SystemNode,
  type SystemEdge,
  type SystemGroup,
} from "shared";

interface AiDiagramModalProps {
  open: boolean;
  onClose: () => void;
  onApplyDiagram: (diagram: DiagramModel) => void;
}

const PRESET_PROMPTS = [
  {
    title: "E-Commerce Microservices",
    desc: "API Gateway, Auth, Product Catalog, Order Service, Stripe, Kafka, and PostgreSQL",
    prompt: "Design an e-commerce platform with API Gateway, Auth Service, Order Service, Stripe Payments, Kafka, and PostgreSQL replicas",
  },
  {
    title: "Real-time Collaboration & CRDT",
    desc: "Browser client, WebSocket Gateway, Yjs CRDT room, Redis Pub/Sub, and Snapshot DB",
    prompt: "Design a real-time collaborative document platform using WebSockets, Yjs CRDTs, Redis Pub/Sub, and PostgreSQL snapshots",
  },
  {
    title: "AI Agent & RAG Pipeline",
    desc: "User Client, Fastify API, Vector DB (Qdrant), Embedding worker, LLM Gateway, and Cache",
    prompt: "Design an enterprise RAG AI system with API Gateway, Vector Database, Embedding Service, LLM Provider, and Redis semantic cache",
  },
  {
    title: "Video Streaming Architecture",
    desc: "Client, Cloudflare CDN, Transcoder cluster, S3 Storage, Redis metadata, and Queue",
    prompt: "Design a scalable video streaming service like Netflix with CDN, Transcoding workers, S3 blob storage, and Redis",
  },
];

export function AiDiagramModal({
  open,
  onClose,
  onApplyDiagram,
}: AiDiagramModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleGenerate(customPrompt?: string) {
    const text = (customPrompt ?? prompt).trim();
    if (!text) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (res.ok) {
        const data = (await res.json()) as { diagram: DiagramModel };
        if (data.diagram) {
          onApplyDiagram(data.diagram);
          onClose();
          return;
        }
      }
    } catch {
      /* fallback to client generator below */
    } finally {
      setLoading(false);
    }

    // Client-side fallback smart generator if offline or API unavailable
    const fallbackDiagram = generateClientDiagramFromPrompt(text);
    onApplyDiagram(fallbackDiagram);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border/90 bg-card p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 id="ai-dialog-title" className="text-lg font-bold tracking-tight text-foreground">
                Eraser AI Architecture Generator
              </h2>
              <p className="text-xs text-muted-foreground">
                Describe any system design, microservice cluster, or cloud topology
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="my-5 flex flex-col gap-3">
          <label htmlFor="arch-prompt" className="text-xs font-semibold text-foreground">
            Architecture Prompt:
          </label>
          <div className="flex gap-2">
            <Input
              id="arch-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Design a ride-sharing dispatch service with Kafka, Redis, WebSockets, and Postgres..."
              className="h-11 text-sm font-medium"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleGenerate();
              }}
            />
            <Button
              onClick={() => handleGenerate()}
              disabled={loading || !prompt.trim()}
              className="h-11 gap-2 px-5 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Or pick a production template:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRESET_PROMPTS.map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() => {
                  setPrompt(p.prompt);
                  handleGenerate(p.prompt);
                }}
                className="group flex flex-col rounded-xl border border-border/80 bg-background/60 p-3.5 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-foreground group-hover:text-primary">
                  <span>{p.title}</span>
                  <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {p.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Intelligent client-side rule-based fallback generator for offline or instantaneous diagram synthesis.
 */
export function generateClientDiagramFromPrompt(promptText: string): DiagramModel {
  const p = promptText.toLowerCase();

  const isVideo = p.includes("video") || p.includes("stream") || p.includes("netflix");
  const isEcommerce = p.includes("commerce") || p.includes("order") || p.includes("payment") || p.includes("store");
  const isAi = p.includes("ai") || p.includes("rag") || p.includes("vector") || p.includes("llm");
  const isRide = p.includes("ride") || p.includes("uber") || p.includes("dispatch") || p.includes("geo");

  if (isVideo) {
    return {
      version: 1,
      title: "Video Streaming & Transcoding Pipeline",
      viewport: { x: 30, y: 30, zoom: 0.8 },
      groups: [
        { id: "grp-edge", label: "Edge & CDN Distribution", x: 40, y: 60, width: 280, height: 380, color: "cyan" },
        { id: "grp-core", label: "Transcoding & Stream Processing", x: 370, y: 60, width: 500, height: 380, color: "violet" },
        { id: "grp-storage", label: "Asset Storage & State", x: 920, y: 60, width: 330, height: 380, color: "emerald" },
      ],
      nodes: [
        { id: "client", type: "client", label: "Player / App", sublabel: "HLS / DASH Player", technology: "ExoPlayer / Web", color: "zinc", x: 70, y: 110, width: 220, height: 85, parentId: "grp-edge" },
        { id: "cdn", type: "cloud", label: "Cloudflare Edge CDN", sublabel: "Edge caching & geo-routing", technology: "CDN Cache", color: "cyan", x: 70, y: 250, width: 220, height: 85, parentId: "grp-edge" },
        { id: "api-gw", type: "gateway", label: "Streaming API Gateway", sublabel: "Session token validation", technology: "Kong Gateway", color: "blue", x: 400, y: 110, width: 210, height: 85, parentId: "grp-core" },
        { id: "workers", type: "service", label: "FFmpeg Transcoder Fleet", sublabel: "1080p / 4K multi-bitrate encoding", technology: "Rust / FFmpeg / K8s", color: "violet", x: 400, y: 250, width: 210, height: 85, parentId: "grp-core" },
        { id: "transcode-queue", type: "queue", label: "Encoding Job Queue", sublabel: "Priority video chunks", technology: "RabbitMQ / SQS", color: "amber", x: 650, y: 180, width: 190, height: 85, parentId: "grp-core" },
        { id: "s3-storage", type: "storage", label: "S3 Object Store", sublabel: "Source MP4 & HLS chunks", technology: "AWS S3 Bucket", color: "emerald", x: 950, y: 110, width: 250, height: 85, parentId: "grp-storage" },
        { id: "metadata-db", type: "database", label: "Metadata & Catalog DB", sublabel: "Titles, manifests, user watch state", technology: "PostgreSQL 16", color: "emerald", x: 950, y: 250, width: 250, height: 85, parentId: "grp-storage" },
      ],
      edges: [
        { id: "e1", from: "client", to: "cdn", label: "Request Stream", style: "solid", arrow: "single" },
        { id: "e2", from: "cdn", to: "api-gw", label: "Cache Miss", style: "solid", arrow: "single" },
        { id: "e3", from: "api-gw", to: "transcode-queue", label: "Enqueue upload", style: "dashed", arrow: "single" },
        { id: "e4", from: "transcode-queue", to: "workers", label: "Pull job", style: "solid", arrow: "single" },
        { id: "e5", from: "workers", to: "s3-storage", label: "Save HLS segments (.ts / .m3u8)", style: "solid", arrow: "single" },
        { id: "e6", from: "api-gw", to: "metadata-db", label: "Catalog query", style: "solid", arrow: "single" },
        { id: "e7", from: "cdn", to: "s3-storage", label: "Origin pull", style: "dotted", arrow: "single" },
      ],
    };
  }

  if (isAi) {
    return {
      version: 1,
      title: "Enterprise RAG AI Architecture",
      viewport: { x: 30, y: 30, zoom: 0.8 },
      groups: [
        { id: "grp-ingest", label: "Query & Ingestion Layer", x: 40, y: 60, width: 300, height: 380, color: "blue" },
        { id: "grp-rag", label: "Retrieval Augmented Generation (RAG)", x: 390, y: 60, width: 500, height: 380, color: "violet" },
        { id: "grp-models", label: "Vector Index & LLM Provider", x: 940, y: 60, width: 320, height: 380, color: "emerald" },
      ],
      nodes: [
        { id: "user", type: "client", label: "User Client / Copilot", sublabel: "Chat & Search UI", technology: "Next.js / WebSocket", color: "zinc", x: 70, y: 110, width: 230, height: 85, parentId: "grp-ingest" },
        { id: "rag-gw", type: "gateway", label: "Semantic Gateway", sublabel: "Guardrails & Token Rate Limiting", technology: "FastAPI / Python", color: "blue", x: 70, y: 250, width: 230, height: 85, parentId: "grp-ingest" },
        { id: "embed-svc", type: "service", label: "Embedding Generator", sublabel: "text-embedding-3-small (1536 dim)", technology: "ONNX / GPU Worker", color: "violet", x: 420, y: 110, width: 210, height: 85, parentId: "grp-rag" },
        { id: "context-builder", type: "service", label: "Reranker & Context Assembler", sublabel: "Cohere rerank & top-k pruning", technology: "Python / Celery", color: "violet", x: 420, y: 250, width: 210, height: 85, parentId: "grp-rag" },
        { id: "qdrant", type: "database", label: "Vector Database (Qdrant)", sublabel: "HNSW index & metadata filtering", technology: "Qdrant / Milvus", color: "cyan", x: 670, y: 180, width: 190, height: 85, parentId: "grp-rag" },
        { id: "llm-provider", type: "cloud", label: "Anthropic / Gemini / OpenAI", sublabel: "Claude 3.7 / Gemini 2.5 Flash", technology: "External LLM API", color: "emerald", x: 970, y: 110, width: 240, height: 85, parentId: "grp-models" },
        { id: "cache-semantic", type: "database", label: "Semantic Response Cache", sublabel: "Cosine similarity threshold: 0.95", technology: "Redis Vector Store", color: "rose", x: 970, y: 250, width: 240, height: 85, parentId: "grp-models" },
      ],
      edges: [
        { id: "e1", from: "user", to: "rag-gw", label: "Prompt / Query", style: "solid", arrow: "single" },
        { id: "e2", from: "rag-gw", to: "embed-svc", label: "Generate vectors", style: "solid", arrow: "single" },
        { id: "e3", from: "embed-svc", to: "qdrant", label: "kNN Search (top 50)", style: "solid", arrow: "single" },
        { id: "e4", from: "qdrant", to: "context-builder", label: "Raw chunks", style: "solid", arrow: "single" },
        { id: "e5", from: "context-builder", to: "llm-provider", label: "Reranked prompt + context", style: "solid", arrow: "single" },
        { id: "e6", from: "llm-provider", to: "cache-semantic", label: "Store generated answer", style: "dashed", arrow: "single" },
        { id: "e7", from: "rag-gw", to: "cache-semantic", label: "Check cache first", style: "dotted", arrow: "single" },
      ],
    };
  }

  // Default clean microservice system design
  return {
    version: 1,
    title: promptText || "Custom System Design Architecture",
    viewport: { x: 30, y: 30, zoom: 0.8 },
    groups: [
      { id: "grp-clients", label: "Client Ingress Tier", x: 40, y: 60, width: 280, height: 380, color: "blue" },
      { id: "grp-services", label: "Business Services Mesh", x: 370, y: 60, width: 500, height: 380, color: "violet" },
      { id: "grp-data", label: "Distributed Storage Tier", x: 920, y: 60, width: 330, height: 380, color: "emerald" },
    ],
    nodes: [
      { id: "n-client", type: "client", label: "Client Applications", sublabel: "Single Page App & Mobile", technology: "React / iOS / Android", color: "zinc", x: 70, y: 110, width: 220, height: 85, parentId: "grp-clients" },
      { id: "n-gateway", type: "gateway", label: "API Gateway & Router", sublabel: "JWT verification & rate limiting", technology: "Nginx / Envoy", color: "blue", x: 70, y: 250, width: 220, height: 85, parentId: "grp-clients" },
      { id: "n-service-1", type: "service", label: "Core Processing Service", sublabel: "Business logic engine", technology: "Go / Node.js", color: "violet", x: 400, y: 110, width: 210, height: 85, parentId: "grp-services" },
      { id: "n-service-2", type: "service", label: "Async Worker Service", sublabel: "Background tasks & jobs", technology: "Python / Celery", color: "violet", x: 400, y: 250, width: 210, height: 85, parentId: "grp-services" },
      { id: "n-queue", type: "queue", label: "Message Broker", sublabel: "Asynchronous task queue", technology: "Kafka / Redis", color: "amber", x: 650, y: 180, width: 190, height: 85, parentId: "grp-services" },
      { id: "n-db", type: "database", label: "Primary SQL Database", sublabel: "ACID state store", technology: "PostgreSQL 16", color: "emerald", x: 950, y: 110, width: 250, height: 85, parentId: "grp-data" },
      { id: "n-cache", type: "database", label: "In-Memory Cache", sublabel: "Sub-millisecond query cache", technology: "Redis 7.2", color: "rose", x: 950, y: 250, width: 250, height: 85, parentId: "grp-data" },
    ],
    edges: [
      { id: "e1", from: "n-client", to: "n-gateway", label: "HTTPS / REST", style: "solid", arrow: "single" },
      { id: "e2", from: "n-gateway", to: "n-service-1", label: "gRPC", style: "solid", arrow: "single" },
      { id: "e3", from: "n-service-1", to: "n-queue", label: "Publish task", style: "dashed", arrow: "single" },
      { id: "e4", from: "n-queue", to: "n-service-2", label: "Consume", style: "solid", arrow: "single" },
      { id: "e5", from: "n-service-1", to: "n-db", label: "SQL Queries", style: "solid", arrow: "single" },
      { id: "e6", from: "n-service-1", to: "n-cache", label: "Cache read/write", style: "solid", arrow: "single" },
      { id: "e7", from: "n-service-2", to: "n-db", label: "Update state", style: "solid", arrow: "single" },
    ],
  };
}
