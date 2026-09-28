import { ErrorState } from "@/components/states/error-state";

export default function DocumentNotFound() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-16">
      <ErrorState kind="not-found" className="w-full max-w-md" />
    </main>
  );
}
