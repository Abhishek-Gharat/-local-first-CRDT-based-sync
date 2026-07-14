import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect("/documents");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">docsync</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Local-first collaborative document editor with offline sync and
        deterministic conflict resolution.
      </p>
      <div className="flex gap-2">
        <Button nativeButton={false} render={<Link href="/login">Sign in</Link>} />
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/register">Create account</Link>}
        />
      </div>
    </main>
  );
}
