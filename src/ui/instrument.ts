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
// the first two, a tap or Enter on the trigger for the touch pin (`.show`
// on the tip, reported through aria-expanded). Escape or a tap anywhere
// else dismisses; the pin never survives its surface moving on.
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
const portaled = new Set<HTMLElement>();

// Reap portaled bodies whose trigger has left the document — a surface
// rebuild replaces its markup and orphans whatever was open.
function sweep(): void {
  for (const body of [...portaled]) {
    const id = body.id;
    if (id && !document.querySelector(`[aria-describedby="${CSS.escape(id)}"]`)) {
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
// show, place at the trigger, and carry the visibility class.
function sync(tip: HTMLElement): void {
  const body = bodyOf(tip);
  if (!body) return;
  const show = tip.classList.contains("over") || tip.classList.contains("focused") || tip.classList.contains("show");
  if (show && body.parentElement !== document.body) {
    document.body.appendChild(body);
    portaled.add(body);
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

// Dismiss every access state in the scope, restoring each trigger's
// expanded state — the one teardown every dismissal path shares.
export function closeTooltips(host: ParentNode): void {
  for (const tip of host.querySelectorAll<HTMLElement>(".inst-tip.over, .inst-tip.focused, .inst-tip.show")) {
    // Keep focus on its control. Clearing the access states hides the body
    // until a fresh pointer entry, focus entry, or explicit tap opens it.
    tip.classList.remove("show", "over", "focused");
    tip.querySelector(".inst-tip-trigger")?.setAttribute("aria-expanded", "false");
    sync(tip);
  }
}

// The tooltip layer's wiring for one surface. Attach once to the surface's
// stable root — a rebuild replaces the root, so the listeners go with it,
// and the attach sweep reaps what the replaced surface left behind.
export function wireTooltips(host: ParentNode): void {
  sweep();
  const tipOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof HTMLElement ? target.closest<HTMLElement>(".inst-tip") : null;
  host.addEventListener("pointerover", (event) => {
    const tip = tipOf(event.target);
    if (!tip || tip.contains((event as PointerEvent).relatedTarget as Node | null)) return;
    tip.classList.add("over");
    sync(tip);
  });
  host.addEventListener("pointerout", (event) => {
    const tip = tipOf(event.target);
    if (!tip || tip.contains((event as PointerEvent).relatedTarget as Node | null)) return;
    tip.classList.remove("over");
    sync(tip);
  });
  host.addEventListener("focusin", (event) => {
    const tip = tipOf(event.target);
    if (!tip) return;
    tip.classList.add("focused");
    sync(tip);
  });
  host.addEventListener("focusout", (event) => {
    const tip = tipOf(event.target);
    if (!tip || tip.contains((event as PointerEvent).relatedTarget as Node | null)) return;
    tip.classList.remove("focused");
    sync(tip);
  });
  host.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest(".inst-tip-trigger")) {
      const tip = event.target.closest<HTMLElement>(".inst-tip")!;
      const pin = !tip.classList.contains("show");
      // One pinned tooltip at a time: pinning elsewhere puts the last one away.
      closeTooltips(host);
      tip.classList.toggle("show", pin);
      tip.querySelector(".inst-tip-trigger")?.setAttribute("aria-expanded", String(pin));
      sync(tip);
      // The trigger's tap is the tooltip's, never the row's or the
      // surface's beneath it.
      event.stopPropagation();
      return;
    }
    // A tap anywhere else in the surface dismisses: the tooltip is
    // transient state, not furniture.
    closeTooltips(host);
  });
  // A tap that never enters the surface dismisses too — a tooltip
  // must not outlive the tap that moves the pointer elsewhere — and the
  // same pass reaps whatever orphan a rebuild left behind.
  document.addEventListener(
    "click",
    (event) => {
      if (host instanceof Node && !host.isConnected) return;
      if (event.target instanceof Node && host.contains(event.target)) return;
      closeTooltips(host);
      sweep();
    },
    true,
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
    },
    true,
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
  }, true);
}
