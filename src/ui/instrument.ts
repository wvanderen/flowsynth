// The instrument standards' shared behavior primitives (issue #267) — the
// code half of docs/instrument-standards.md. The stylesheet carries the
// geometry, type, state, and tooltip classes; this module carries the
// tooltip layer's behavior, which CSS alone cannot express on the
// surfaces that host it.
//
// Every tooltip rides the same markup, built by the surfaces themselves:
//
//   <span class="inst-tip">
//     <button class="inst-tip-trigger" aria-describedby="ID">ⓘ</button>
//     <span class="inst-tip-body" id="ID" role="tooltip">…deeper mechanics…</span>
//   </span>
//
// Access: hover, keyboard focus, and touch. The wiring mirrors each onto
// the body as one visibility class (`inst-show`): pointerover/focusin for
// the first two, a tap or Enter on the trigger for the touch pin. The one
// visibility resolves in sync(), which reports the trigger's aria-expanded
// — hover, focus, and pin all speak the same open/closed state, per the
// controls-sheet correction (#324). Escape or a tap anywhere else
// dismisses; the pin never survives its surface moving on.
//
// Placement: the body is positioned fixed and this wiring places it at its
// trigger. The reference surface shows its tooltips inside scroll
// containers and clipped plates — an in-flow body is cut away with the
// scroll, and a clipped ancestor's clip-path clips even a fixed child's
// paint — so on first show the body portals to document.body (the
// trigger's aria-describedby stays the link, and the sweep below reaps the
// ones whose surface has gone). A scroll re-places the visible bodies, so
// a pinned tooltip never detaches. The containing-block caveat: an
// ancestor with a transform/filter/container-type claims fixed
// descendants — surfaces that host tooltips keep such properties off the
// tooltip's ancestor chain.

// The live bodies this document is currently portal-parented. Keyed by the
// body element; the sweep walks it.
const portaled = new Map<HTMLElement, HTMLElement>();
const bindings = new Map<ParentNode, { signal?: AbortSignal; release: () => void }>();

// Reap portaled bodies whose trigger has left the document — a surface
// rebuild replaces its markup and orphans whatever was open.
function sweep(): void {
  for (const [host, binding] of bindings) {
    if (host instanceof Node && !host.isConnected) binding.release();
  }
  for (const [body, tip] of portaled) {
    if (!tip.isConnected) {
      body.remove();
      portaled.delete(body);
    }
  }
}

function bodyOf(tip: HTMLElement): HTMLElement | null {
  const trigger = tip.querySelector<HTMLElement>(".inst-tip-trigger");
  const id = trigger?.getAttribute("aria-describedby");
  const body = (id && document.getElementById(id)) || tip.querySelector<HTMLElement>(".inst-tip-body");
  return body ?? null;
}

function place(tip: HTMLElement, body: HTMLElement): void {
  const trigger = tip.querySelector<HTMLElement>(".inst-tip-trigger");
  if (!trigger) return;
  const at = trigger.getBoundingClientRect();
  const width = Math.min(230, window.innerWidth * 0.6);
  body.style.left = `${Math.max(8, Math.min(at.left, window.innerWidth - width - 8))}px`;
  if (body.classList.contains("inst-tip-scroll")) {
    // Dense disclosures use the larger side of the trigger and scroll
    // within that space rather than extending beyond the viewport.
    const below = Math.max(0, window.innerHeight - at.bottom - 14);
    const above = Math.max(0, at.top - 14);
    const useAbove = above > below;
    body.style.maxHeight = `${Math.max(1, useAbove ? above : below)}px`;
    const height = body.offsetHeight;
    body.style.top = `${useAbove ? Math.max(8, at.top - height - 6) : at.bottom + 6}px`;
    return;
  }
  const height = body.offsetHeight || 150;
  const below = at.bottom + 6;
  // Flip above the trigger when the body would run past the viewport's
  // bottom edge and there is room above.
  if (below + height > window.innerHeight - 8 && at.top - height - 6 >= 8) {
    body.style.top = `${Math.max(8, at.top - height - 6)}px`;
  } else {
    body.style.top = `${below}px`;
  }
}

// Resolve one tip's three access states onto its body: portal on first
// show, place at the trigger, carry the visibility class, and report the
// one open/closed state through aria-expanded — every access path's
// disclosure rides this single write, so the trigger never announces
// "collapsed" while its tip stands open.
function sync(tip: HTMLElement): void {
  const body = bodyOf(tip);
  if (!body) return;
  const show = tip.classList.contains("over") || tip.classList.contains("focused") || tip.classList.contains("show");
  tip.querySelector(".inst-tip-trigger")?.setAttribute("aria-expanded", String(show));
  if (show && body.parentElement !== document.body) {
    document.body.appendChild(body);
    portaled.set(body, tip);
  }
  body.classList.toggle("inst-show", show);
  if (show) place(tip, body);
}

// Portaled bodies still belong to the surface containing their triggers.
// Callers updating live content include these roots without reaching into
// another roster's tooltip (both channels can exist simultaneously).
export function tooltipBodies(host: ParentNode): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(".inst-tip")]
    .map(bodyOf)
    .filter((body): body is HTMLElement => body !== null && portaled.has(body));
}

// Dismiss every access state in the scope — the one teardown every
// dismissal path shares.
export function closeTooltips(host: ParentNode): void {
  for (const tip of host.querySelectorAll<HTMLElement>(".inst-tip.over, .inst-tip.focused, .inst-tip.show")) {
    // Keep focus on its control. Clearing the access states hides the body
    // until a fresh pointer entry, focus entry, or explicit tap opens it,
    // and sync reports the closure through aria-expanded.
    tip.classList.remove("show", "over", "focused");
    sync(tip);
  }
}

// The tooltip layer's wiring for one surface. Attach once to the surface's
// stable root — a rebuild replaces the root, so the listeners go with it,
// and the attach sweep reaps what the replaced surface left behind.
export function wireTooltips(host: ParentNode, signal?: AbortSignal): () => void {
  sweep();
  const existing = bindings.get(host);
  if (existing && existing.signal === signal) return existing.release;
  existing?.release();
  if (signal?.aborted) return () => {};
  const lifetime = new AbortController();
  const release = () => {
    // Remove portals before the host disappears; IDs may be reused by the
    // next instrument, so a later orphan sweep cannot identify ownership.
    for (const [body, tip] of portaled) {
      if (host.contains(tip)) {
        body.remove();
        portaled.delete(body);
      }
    }
    lifetime.abort();
    signal?.removeEventListener("abort", release);
    bindings.delete(host);
  };
  bindings.set(host, { ...(signal ? { signal } : {}), release });
  signal?.addEventListener("abort", release, { once: true });
  const tipOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(".inst-tip") : null;
  host.addEventListener("pointerover", (event) => {
    const tip = tipOf(event.target);
    if (!tip || tip.contains((event as PointerEvent).relatedTarget as Node | null)) return;
    tip.classList.add("over");
    sync(tip);
  }, { signal: lifetime.signal });
  host.addEventListener("pointerout", (event) => {
    const tip = tipOf(event.target);
    if (!tip || tip.contains((event as PointerEvent).relatedTarget as Node | null)) return;
    tip.classList.remove("over");
    sync(tip);
  }, { signal: lifetime.signal });
  host.addEventListener("focusin", (event) => {
    const tip = tipOf(event.target);
    if (!tip) return;
    tip.classList.add("focused");
    sync(tip);
  }, { signal: lifetime.signal });
  host.addEventListener("focusout", (event) => {
    const tip = tipOf(event.target);
    if (!tip || tip.contains((event as PointerEvent).relatedTarget as Node | null)) return;
    tip.classList.remove("focused");
    sync(tip);
  }, { signal: lifetime.signal });
  // Keep keyboard focus on the disclosure trigger while scrolling its
  // portaled list; Escape continues to dismiss through the shared layer.
  host.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    const tip = tipOf(event.target);
    const body = tip && bodyOf(tip);
    if (!body?.classList.contains("inst-tip-scroll") || !body.classList.contains("inst-show")) return;
    if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const distance = key.startsWith("Page") ? body.clientHeight : 32;
    if (key === "Home") body.scrollTop = 0;
    else if (key === "End") body.scrollTop = body.scrollHeight;
    else body.scrollTop += key === "ArrowUp" || key === "PageUp" ? -distance : distance;
  }, { signal: lifetime.signal });
  host.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".inst-tip-trigger")) {
      const tip = event.target.closest<HTMLElement>(".inst-tip")!;
      const pin = !tip.classList.contains("show");
      // One pinned tooltip at a time: pinning elsewhere puts the last one away.
      closeTooltips(host);
      tip.classList.toggle("show", pin);
      sync(tip);
      // The trigger's tap is the tooltip's, never the row's or the
      // surface's beneath it.
      event.stopPropagation();
      return;
    }
    // A tap anywhere else in the surface dismisses: the tooltip is
    // transient state, not furniture.
    closeTooltips(host);
  }, { signal: lifetime.signal });
  // A tap that never enters the surface dismisses too — a tooltip
  // must not outlive the tap that moves the pointer elsewhere — and the
  // same pass reaps whatever orphan a rebuild left behind.
  document.addEventListener(
    "click",
    (event) => {
      if (host instanceof Node && !host.isConnected) return;
      if (event.target instanceof Node && host.contains(event.target)) return;
      if ([...portaled].some(([body, tip]) => host.contains(tip) && body.classList.contains("inst-tip-scroll") && body.contains(event.target as Node))) return;
      closeTooltips(host);
      sweep();
    }, { capture: true, signal: lifetime.signal },
  );
  // A scroll anywhere in the surface re-places the visible bodies — a
  // pinned tooltip must never detach from its trigger.
  host.addEventListener(
    "scroll",
    () => {
      for (const tip of host.querySelectorAll<HTMLElement>(".inst-tip.over, .inst-tip.focused, .inst-tip.show")) {
        const body = bodyOf(tip);
        if (body) place(tip, body);
      }
    }, { capture: true, signal: lifetime.signal },
  );
  document.addEventListener("keydown", (event) => {
    if (host instanceof Node && !host.isConnected) return;
    if ((event as KeyboardEvent).key !== "Escape") return;
    const open = host.querySelector<HTMLElement>(".inst-tip.show, .inst-tip.focused, .inst-tip.over");
    if (!open) return;
    // Escape dismisses the tooltip first and the surface never sees it:
    // the sheet beneath stays until a second Escape.
    event.stopPropagation();
    closeTooltips(host);
  }, { capture: true, signal: lifetime.signal });
  return release;
}
