export interface CollaboratorUser {
  id?: string;
  name: string;
  color: string;
}

export interface ActiveCollaborator {
  clientId: number;
  user: CollaboratorUser;
  isSelf: boolean;
}

export const COLLABORATOR_PALETTE = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#d97706", // amber
  "#16a34a", // green
  "#0891b2", // cyan
  "#9333ea", // purple
  "#ea580c", // orange
  "#e11d48", // rose
  "#0d9488", // teal
];

/**
 * Deterministically maps any user ID or name to a vibrant, consistent hex color
 * from the palette.
 */
export function getCollaboratorColor(seed: string): string {
  if (!seed) return COLLABORATOR_PALETTE[0]!;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLABORATOR_PALETTE.length;
  return COLLABORATOR_PALETTE[index]!;
}

/**
 * Extracts a concise 1-2 character uppercase initials string for avatar display.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
