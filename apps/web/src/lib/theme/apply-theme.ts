/**
 * Theme change choreography.
 *
 * Switching a class-based theme repaints every colour on the page at once,
 * which reads as a hard flash. Two requirements have to be satisfied at the
 * same time:
 *
 * 1. The change has to *interpolate*, not snap.
 * 2. Adding a permanent `transition: colors` to the tree so that any colour
 *    change animates would make every hover, focus ring and active-state
 *    toggle feel laggy, and would cost a style recalculation on every pointer
 *    move.
 *
 * ── Why this is two-phase ───────────────────────────────────────────
 *
 * A CSS transition only fires if the property is *transitionable in the
 * computed style that existed immediately before the value changed*. Setting
 * `data-theme-animating` (which is what declares `transition-property`) and
 * toggling `.dark` inside the same task means the browser performs a single
 * style recalculation: the element goes straight from "light, no transition"
 * to "dark, transition enabled", and nothing animates. Measured, the
 * background produced exactly one distinct colour across the whole switch.
 *
 * So the two steps are separated by a forced style flush:
 *
 *   phase 1  declare the transition and force a synchronous style/layout
 *            flush, so the browser commits it against the *old* colour
 *            values;
 *   phase 2  apply the new palette. The transition now has a valid start
 *            value and interpolates.
 *
 * Both phases run in the same task. That is deliberate: an earlier version
 * deferred phase 2 to `requestAnimationFrame`, which is tidier in theory but
 * breaks in a background tab, where rAF can be suspended indefinitely — the
 * theme would then never apply at all. A forced layout flush is enough to
 * give the transition a start value, so no frame boundary is required.
 *
 * The View Transitions API is the obvious alternative and is the right tool
 * in most cases, but it is not usable for a React-driven class theme: the
 * class is applied from a layout effect, which lands after the transition has
 * already snapshotted the "after" state, so every switch aborted with
 * `InvalidStateError: Transition was aborted because of invalid state`.
 *
 * `prefers-reduced-motion` is honoured by applying the theme with no
 * transition at all.
 */

const ANIMATION_MS = 220;
const ANIMATING_ATTR = "data-theme-animating";

/**
 * Value written to the animating attribute. Doubles as a revision marker: it
 * tells us the CSS in `globals.css` and this module are the same revision. A
 * mismatch means the transition rule would silently never match, which is
 * otherwise an invisible failure.
 */
const ANIMATION_REVISION = 4;

/** Cleanup timer, so rapid toggles cannot leave a stale attribute behind. */
let cleanupTimer: number | undefined;

function cancelPending() {
  if (cleanupTimer !== undefined) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = undefined;
  }
}

/** Resolves the concrete palette name the class-based tokens need. */
export function resolveTheme(theme: string): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme === "dark" ? "dark" : "light";
}

/**
 * Applies `theme`, animating the transition smoothly via the browser's native
 * View Transitions API on the GPU compositor, without forced synchronous layout
 * flushes (`offsetHeight`) or universal `*` CSS transitions on 300+ DOM nodes.
 *
 * `commit` is next-themes' `setTheme`. The `.dark` class is written synchronously
 * inside the transition callback so the browser captures the exact before and
 * after snapshots cleanly.
 */
export function applyTheme(theme: string, commit: (theme: string) => void): void {
  if (typeof document === "undefined") {
    commit(theme);
    return;
  }

  const root = document.documentElement;
  cancelPending();

  const isDark = resolveTheme(theme) === "dark";
  const paint = () => {
    root.classList.toggle("dark", isDark);
    commit(theme);
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // View Transitions API — hardware-accelerated GPU cross-fade without main thread jank
  if (!reduced && "startViewTransition" in document) {
    try {
      (document as unknown as { startViewTransition: (fn: () => void) => void }).startViewTransition(() => {
        paint();
      });
      return;
    } catch {
      // Fallback if transition was interrupted
      paint();
      return;
    }
  }

  // Instant clean transition without layout thrashing or frame drops
  paint();
}

export { ANIMATION_MS, ANIMATING_ATTR, ANIMATION_REVISION };
