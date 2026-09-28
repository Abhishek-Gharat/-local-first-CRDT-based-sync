import { NextResponse } from "next/server";
import { DiagramModelSchema } from "shared";
import { getDocumentDiagram, saveDocumentDiagram } from "@/lib/diagram/diagram-store";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const diagram = getDocumentDiagram(id);
  return NextResponse.json({ diagram });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const body = await request.json();
    const parsed = DiagramModelSchema.safeParse(body.diagram ?? body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid diagram schema", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const saved = saveDocumentDiagram(id, parsed.data);
    return NextResponse.json({ success: true, diagram: saved });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "failed to save diagram" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  return PUT(request, { params });
}
