/**
 * Editor route group.
 *
 * The document editor intentionally gets *no* workspace chrome: no sidebar, no
 * marketing header, no footer. It is the one screen in the product where the
 * writing surface should own the entire viewport, and `DocumentEditor` renders
 * its own application bar in its place. Keeping this a pass-through layout
 * makes that a structural guarantee rather than a CSS convention — there is
 * simply no shared chrome for `/documents/[id]` to inherit.
 */
export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-dvh flex-col bg-background">{children}</div>;
}
