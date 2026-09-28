"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/states/error-state";

/**
 * Document error boundary.
 *
 * Distinguishes "you are offline" from a genuine crash, because the two need
 * opposite responses (wait vs. retry) and the old version showed the same two
 * lines for both.
 */
export default function DocumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Document page error:", error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-16">
      <ErrorState
        kind={offline ? "offline" : "generic"}
        onRetry={reset}
        className="w-full max-w-md"
      />
    </main>
  );
}
