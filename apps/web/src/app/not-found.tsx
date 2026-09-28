import Link from "next/link";
import { FileText, FolderGit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <Wordmark className="size-9" />
        <p className="font-mono text-xs tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page does not exist
        </h1>
        <p className="text-xs leading-relaxed text-balance text-muted-foreground">
          The link may be out of date. If you were looking for a document, it is
          waiting in your workspace.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button nativeButton={false} render={<Link href="/documents" className="gap-1.5 font-medium" />}>
            <FileText aria-hidden className="size-3.5" />
            Go to documents
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" className="gap-1.5 font-medium" />}
          >
            <FolderGit2 aria-hidden className="size-3.5" />
            Back to home
          </Button>
        </div>
      </div>
    </main>
  );
}
