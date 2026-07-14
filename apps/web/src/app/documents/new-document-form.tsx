"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NewDocumentForm() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) return;
      const { document } = (await response.json()) as { document: { id: string } };
      router.push(`/documents/${document.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button onClick={handleCreate} disabled={creating} className="self-start">
      {creating ? "Creating…" : "New document"}
    </Button>
  );
}
