import { suppressNextClick } from "./click";

// While a drag is live over an open sheet (the phone tray sheet), the
// backdrop's scrim would eat every board hit — drops resolve through
// elementFromPoint, which sees only the topmost element. A live drag
// marks the visible backdrop drag-through: the scrim stops intercepting,
// the sheet itself keeps its events, so a drop on the board lands and a
// drop back onto the sheet retrieves. Same shape as the scrimless peek
// (#193); removed the moment the drag ends.
function setDragThrough(on: boolean): void {
  const backdrop = document.getElementById("modal");
  if (backdrop && !backdrop.hidden) backdrop.classList.toggle("drag-through", on);
}

// Both grids share pointer ownership and cleanup; their targeting stays local.
export function startPointerDrag(event: PointerEvent, handlers: {
  start: () => HTMLElement;
  move: (event: PointerEvent) => void;
  cleanup: () => void;
  drop: (event: PointerEvent) => void;
}): () => void {
  let ghost: HTMLElement | null = null;
  let finished = false;
  const move = (next: PointerEvent) => {
    if (next.pointerId !== event.pointerId) return;
    if (!ghost && Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) > 6) {
      ghost = handlers.start();
      document.body.append(ghost);
      setDragThrough(true);
    }
    if (!ghost) return;
    ghost.style.left = `${next.clientX}px`;
    ghost.style.top = `${next.clientY}px`;
    handlers.move(next);
  };
  const finish = (next?: PointerEvent) => {
    if (finished) return;
    finished = true;
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", cancel);
    const moved = ghost !== null;
    ghost?.remove();
    setDragThrough(false);
    handlers.cleanup();
    if (moved) suppressNextClick();
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
  return () => finish();
}
