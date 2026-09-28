/**
 * The product mark: two arcs chasing each other around a rounded square —
 * a CRDT sync loop. Extracted so the marketing header, the workspace rail,
 * the drawer and the landing hero all render the identical glyph.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={
        className
          ? `flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ${className}`
          : "flex size-6.5 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
        aria-hidden
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    </span>
  );
}
