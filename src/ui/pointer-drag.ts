import type { App } from "./app";

// Both grids share pointer ownership and cleanup; their targeting stays local.
export function startPointerDrag(app: App, event: PointerEvent, handlers: {
  start: () => HTMLElement;
  move: (event: PointerEvent) => void;
  cleanup: () => void;
  drop: (event: PointerEvent) => void;
}): () => void {
  let ghost: HTMLElement | null = null;
  let finished = false;
  let forget = () => {};
  const move = (next: PointerEvent) => {
    if (next.pointerId !== event.pointerId) return;
    if (!ghost && Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) > 6) {
      ghost = handlers.start();
      document.body.append(ghost);
    }
    if (!ghost) return;
    ghost.style.left = `${next.clientX}px`;
    ghost.style.top = `${next.clientY}px`;
    handlers.move(next);
  };
  const finish = (next?: PointerEvent) => {
    if (finished) return;
    finished = true;
    forget();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
    const moved = ghost !== null;
    ghost?.remove();
    handlers.cleanup();
    if (moved && !app.released) app.suppressClick();
    if (next && moved) handlers.drop(next);
  };
  const up = (next: PointerEvent) => {
    if (next.pointerId === event.pointerId) finish(next);
  };
  const cancel = (next: PointerEvent) => {
    if (next.pointerId === event.pointerId) finish();
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", cancel);
  const stop = () => finish();
  forget = app.ownCleanup(stop);
  return stop;
}
