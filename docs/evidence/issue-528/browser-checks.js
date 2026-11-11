// Run on the provenance-verified ?dev=1 page at each viewport.
// Constructed fixture, not earned-progression evidence; isolated save only.
(async () => {
  const app = window.__flowsynth;
  await app.devLaunchScenario("fresh-start");
  app.devScenarioAssert();
  const { generateOffer } = await import("/src/engine/rolls.ts");
  app.state.world.unlocked = true;
  app.state.world.starterColumnGranted = true;
  app.state.world.starterWeaponGranted = true;
  const moduleCount = app.state.modules.length;
  const results = [];
  for (const split of [0, 0, 0.5, 0.5]) {
    const draws = [...Array(9).fill(0.5), 0, split];
    const offer = generateOffer(app.state, () => draws.shift() ?? 0.5);
    app.state.bankedRolls.push(offer);
    app.openModal("forge");
    const candidate = offer.candidates.find(c => c.type === (split === 0 ? "column" : "chargeBlade"));
    const pick = document.querySelector(`[data-choice="${candidate.id}"]`);
    pick.focus();
    const focus = document.activeElement === pick;
    const label = pick.getAttribute("aria-label");
    const draftRect = document.getElementById("modal-content").getBoundingClientRect();
    pick.click();
    app.setBoardLayer("world");
    app.ui.inventory.collapsed = false;
    app.render();
    if (innerWidth < 600) app.openModal("inventory");
    const copies = split === 0 ? app.state.world.columns : app.state.world.weapons;
    const copy = copies.at(-1);
    const unplaced = copy.pos === null;
    document.querySelector(`[data-world-tray="${copy.id}"]`).click();
    const inspect = document.querySelector(".inventory-detail-face").parentElement.textContent.trim();
    document.querySelector(`[data-world-place="${copy.id}"]`).click();
    app.worldPickCell(app.state.cells[0]);
    const placed = copy.pos?.q === app.state.cells[0].q && copy.pos?.r === app.state.cells[0].r;
    app.worldRetrieve(copy.id);
    const pass = focus && unplaced && placed && app.state.modules.length === moduleCount && app.state.bankedRolls.length === 0;
    if (!pass) throw new Error(`Mixed draft browser workflow failed: ${label}`);
    results.push({label, focus, unplaced, placed, inspect, moduleCount:app.state.modules.length, draft:{x:draftRect.x,y:draftRect.y,width:draftRect.width,height:draftRect.height},pass});
  }
  return {viewport:{width:innerWidth,height:innerHeight},origin:"constructed isolated fixture",columns:app.state.world.columns.length,blades:app.state.world.weapons.length,results};
})()
