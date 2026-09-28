import {
  type DiagramModel,
  SYSTEM_DESIGN_TEMPLATES,
  createEmptyDiagram,
} from "shared";

// In-memory server-side diagram cache keyed by documentId
// In production or when versions are saved, this is encoded into Y.Doc bytea snapshots.
const diagramCache = new Map<string, DiagramModel>();

export function getDocumentDiagram(documentId: string): DiagramModel {
  const cached = diagramCache.get(documentId);
  if (cached) return cached;

  // Default to Local-First CRDT template so new diagrams look rich immediately
  const initial = SYSTEM_DESIGN_TEMPLATES.localFirstCrdt.diagram;
  diagramCache.set(documentId, initial);
  return initial;
}

export function saveDocumentDiagram(
  documentId: string,
  diagram: DiagramModel,
): DiagramModel {
  diagramCache.set(documentId, diagram);
  return diagram;
}
