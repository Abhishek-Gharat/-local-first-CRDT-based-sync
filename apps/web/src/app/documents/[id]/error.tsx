"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="text-sm font-medium">Could not load document</p>
      <p className="text-xs text-muted-foreground">
        {typeof navigator !== "undefined" && !navigator.onLine
          ? "You appear to be offline. If you have visited this document before, try reloading."
          : "Something went wrong."}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
