import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-md border border-border bg-muted/80 px-1.5 font-mono text-[10.5px] font-medium tracking-tight text-muted-foreground shadow-2xs",
        className
      )}
      {...props}
    />
  )
}

/** Renders a shortcut like `["mod", "K"]` as `⌘ K` on Apple platforms, `Ctrl K` elsewhere. */
function ShortcutKeys({
  keys,
  className,
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  )
}

export { Kbd, ShortcutKeys }
