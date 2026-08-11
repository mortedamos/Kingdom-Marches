/**
 * TECH TREE VIEWER
 * ----------------
 * The full tech tree for a chosen civ, laid out by layer (rows, Level 0
 * through Level 5) and column (civic/building/military), with each node's
 * status -- completed, currently researching (with progress %), the AI's
 * intended next pick (via ai.js's previewNextResearch, a non-mutating
 * preview), locked (city-gate or prereqs unmet), or simply available.
 *
 * Read-only for every civ EXCEPT the human player's own (2026-08-01,
 * user-directed): before this the player had no way to pick research at all,
 * because chooseResearch was only ever called from ai.js, which turns.js
 * skips for the human civ -- a human game sat at "Research: None selected"
 * forever. Available nodes in your own tree are now buttons.
 *
 * Every layer row (2026-08-06, user-directed) is collapsible -- click the
 * "Level N" label to toggle, wired in main.js against the `expandedState`
 * object this module's render() is passed (see render's own doc comment).
 */

window.UI = window.UI || {};

(function () {
  // "Mystic" (2026-08-10, user-directed): a 4th column for spellcaster/
  // utility units and their own abilities -- Wizard, Druid, Metal Singer,
  // Bog Witch, Trouble Maker -- split out of Military, which was carrying
  // both straight combat techs and every caster's whole kit. Not every race
  // has mystic content (Undead has none yet); techtree.js's own layer-
  // skipping already handles a column/layer with nothing in it.
  const COLUMNS = ["civic", "building", "military", "mystic"];
  const COLUMN_LABEL = { civic: "Civic", building: "Building", military: "Military", mystic: "Mystic" };

  // Old-model races still tag their ability nodes "mechanics" -- these render
  // in the Civic column, matching how Human's tree folded Mechanics into Civic.
  function columnFor(tech) {
    if (tech.category === "mechanics") return "civic";
    return COLUMNS.includes(tech.category) ? tech.category : "civic";
  }

  /**
   * `expandedState` (2026-08-06, user-directed; auto collapse/expand added
   * 2026-08-10): the collapse/expand state for each layer row,
   * `{ [civId]: { [layer]: { expanded, avail } } }` -- OWNED by main.js as
   * part of viewState (this module stays a pure render function, same
   * split as every other UI module) and passed in by reference so a click
   * on a layer header can mutate it directly and force a rebuild.
   *
   * `avail` is whether that layer currently has any tech worth showing
   * (available to research, or actively being researched -- see
   * layerHasAvailable). Each render compares the layer's CURRENT avail
   * against the stored one: unchanged means a prior manual toggle (or the
   * initial default) still stands, changed means the tech tree just gained
   * or lost its last actionable node in that layer, so `expanded` is reset
   * to match -- "collapse a level with nothing left to build, uncollapse
   * one with something available" per the user's own wording, while still
   * letting a manual toggle stick between those transitions.
   */
  function layerHasAvailable(civ, cols) {
    for (const col of COLUMNS) {
      for (const tech of cols[col]) {
        if (civ.completedTechs.has(tech.id)) continue;
        if (civ.currentResearch === tech.id) return true; // in progress -- keep visible so its % is watchable
        if (!window.GameEngine.tech.meetsCityGate(civ, tech)) continue;
        if (tech.prereqs.some((p) => !civ.completedTechs.has(p))) continue;
        const cost = window.GameData.effectiveTechCostBreakdown(tech);
        const stock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
        if (cost.harvest > (stock.harvest || 0) || cost.coin > (stock.coin || 0) || cost.lore > (stock.lore || 0)) continue;
        return true;
      }
    }
    return false;
  }
  /**
   * Prereq/unlock relations for whichever tech is currently hovered
   * (2026-08-10, user-directed: "show what techs unlocked the current tech,
   * and what techs are unlocked by the current tech" without cluttering the
   * screen with permanent arrows). Returns null if nothing's hovered.
   *
   * DIRECT ancestors/descendants are one hop away (tech.prereqs itself, and
   * whatever else's prereqs name this tech); INDIRECT ones are everything
   * further up/down the chain. Both get their own relationKindFor() CSS
   * class on any node that's actually visible; a still-collapsed layer
   * holding either kind of relation gets a small "N related" badge on its
   * header instead (2026-08-10, user-directed: hovering used to force such
   * a layer open, but that -- plus dimming every unrelated node -- caused
   * too much visual "flicker" as the cursor moved around, so neither
   * happens anymore; a layer's expand/collapse state now comes ONLY from a
   * manual toggle).
   */
  function computeRelations(civ, hoverTechId) {
    if (!hoverTechId) return null;
    const techIds = window.GameData.techsForRace(civ.raceId);
    const techById = {};
    for (const id of techIds) techById[id] = window.GameData.getTech(id);
    const hoverTech = techById[hoverTechId];
    if (!hoverTech) return null;

    const directAncestors = new Set(hoverTech.prereqs.filter((p) => techById[p]));
    const directDescendants = new Set();
    for (const id of techIds) {
      if (techById[id].prereqs.includes(hoverTechId)) directDescendants.add(id);
    }

    const allAncestors = new Set();
    (function walkUp(id) {
      const t = techById[id];
      if (!t) return;
      for (const p of t.prereqs) {
        if (!techById[p] || allAncestors.has(p)) continue;
        allAncestors.add(p);
        walkUp(p);
      }
    })(hoverTechId);
    const indirectAncestors = new Set([...allAncestors].filter((id) => !directAncestors.has(id)));

    // Reverse-dependency map, built fresh each hover -- these tech lists are
    // small (a few dozen per race at most), so this is cheap enough to not
    // need caching across hovers.
    const dependents = {};
    for (const id of techIds) {
      for (const p of techById[id].prereqs) {
        (dependents[p] = dependents[p] || []).push(id);
      }
    }
    const allDescendants = new Set();
    (function walkDown(id) {
      for (const child of dependents[id] || []) {
        if (allDescendants.has(child)) continue;
        allDescendants.add(child);
        walkDown(child);
      }
    })(hoverTechId);
    const indirectDescendants = new Set([...allDescendants].filter((id) => !directDescendants.has(id)));

    return { directAncestors, directDescendants, indirectAncestors, indirectDescendants };
  }

  /** Which relation (if any) `techId` has to the currently-hovered tech,
   *  as a stateClass-style string renderNode can turn into a CSS class. */
  function relationKindFor(relations, techId) {
    if (!relations) return null;
    if (relations.directAncestors.has(techId)) return "ancestor-direct";
    if (relations.indirectAncestors.has(techId)) return "ancestor-indirect";
    if (relations.directDescendants.has(techId)) return "descendant-direct";
    if (relations.indirectDescendants.has(techId)) return "descendant-indirect";
    return null;
  }

  function render(civ, isPlayerCiv, expandedState, focusTechId, hoverTechId) {
    const race = window.GameData.getRace(civ.raceId);
    // The AI's "intends to research next" hint is meaningless for the human's
    // own tree -- nothing is going to pick for them, that's the whole point.
    const nextPick = isPlayerCiv ? null : window.GameEngine.ai.previewNextResearch(civ);

    const techIds = window.GameData.techsForRace(civ.raceId);
    const byLayer = {};
    let maxLayer = 0;
    for (const id of techIds) {
      const tech = window.GameData.getTech(id);
      // `?? 1`, not `|| 1` (2026-08-06) -- a real Level 0 tech's layer is
      // literally 0, which `||` would treat as missing and wrongly bucket
      // into Level 1 instead of its own Level 0 row.
      const layer = tech.layer ?? 1;
      maxLayer = Math.max(maxLayer, layer);
      byLayer[layer] = byLayer[layer] || { civic: [], building: [], military: [], mystic: [] };
      byLayer[layer][columnFor(tech)].push(tech);
    }

    const civExpanded = expandedState[civ.id] = expandedState[civ.id] || {};
    const relations = computeRelations(civ, hoverTechId);

    let rows = "";
    for (let layer = 0; layer <= maxLayer; layer++) {
      const cols = byLayer[layer];
      if (!cols) continue;
      const avail = layerHasAvailable(civ, cols);
      let entry = civExpanded[layer];
      if (!entry || entry.avail !== avail) {
        entry = { expanded: avail, avail };
        civExpanded[layer] = entry;
      }
      // A "jump to this tech" link (research-complete modal, 2026-08-10,
      // user-directed) always forces its target's layer open, even if it
      // would otherwise be collapsed -- otherwise the linked entry wouldn't
      // actually be visible/readable. This one PERSISTS (writes into `entry`).
      const layerHasFocus = focusTechId && COLUMNS.some((col) => cols[col].some((t) => t.id === focusTechId));
      if (layerHasFocus) entry.expanded = true;

      // Hover-driven relation badge (2026-08-10, user-directed: hovering
      // used to force a collapsed layer open to reveal a related tech, plus
      // dim every unrelated node -- both caused too much "flicker" as the
      // cursor moved around, so neither happens anymore. A layer's
      // expand/collapse state now comes ONLY from `entry` (manual toggle or
      // the focus-link case above) -- hovering never changes it. A still-
      // collapsed layer holding a related tech (direct or indirect, either
      // direction) just earns a small "N related" badge on its header
      // instead, so the relation is still discoverable without any layout
      // shift. See computeRelations for what counts as a relation.
      const expanded = entry.expanded;
      let relatedCount = 0;
      if (relations && !expanded) {
        for (const col of COLUMNS) {
          for (const t of cols[col]) {
            if (relations.directAncestors.has(t.id) || relations.directDescendants.has(t.id)
                || relations.indirectAncestors.has(t.id) || relations.indirectDescendants.has(t.id)) {
              relatedCount++;
            }
          }
        }
      }
      const badge = relatedCount > 0
        ? `<span class="techtree-layer-related-badge">${relatedCount} related</span>` : "";

      rows += `<div class="techtree-layer">
        <div class="techtree-layer-label techtree-layer-toggle" data-toggle-layer="${layer}">
          <span class="techtree-arrow${expanded ? " techtree-arrow-expanded" : ""}">▸</span>
          <span>Level ${layer}</span>
          ${badge}
        </div>
        ${expanded ? COLUMNS.map((col) => `<div class="techtree-column">${
          cols[col].map((tech) => renderNode(
            civ, tech, nextPick, isPlayerCiv, tech.id === focusTechId,
            tech.id === hoverTechId ? "self" : relationKindFor(relations, tech.id),
          )).join("") || ""
        }</div>`).join("") : ""}
      </div>`;
    }

    const header = `<div class="techtree-layer techtree-header">
      <div class="techtree-layer-label"></div>
      ${COLUMNS.map((col) => `<div class="techtree-column-title">${escapeHtml(COLUMN_LABEL[col])}</div>`).join("")}
    </div>`;

    return `
      <div class="panel">
        <h2>${escapeHtml(race.label)} — Tech Tree</h2>
        <div class="stat-row"><span>Cities</span><span>${civ.cities.length}</span></div>
        ${isPlayerCiv ? (() => {
          // Multi-resource stockpile readout (2026-08-05, user-directed):
          // tech cost used to be pure Lore, so this was a single number --
          // now every tech's cost draws on harvest/coin/lore (see
          // GameData.effectiveTechCostBreakdown), same H/C/L convention
          // sidebar.js's build picker already uses.
          const s = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          return `<div class="stat-row"><span>Stockpile (H / C / L)</span><span>${s.harvest.toFixed(0)} / ${s.coin.toFixed(0)} / ${s.lore.toFixed(0)}</span></div>`;
        })() : ''}
        ${isPlayerCiv && !civ.currentResearch
          ? '<div class="techtree-prompt">Nothing is being researched. Click any available tech to start.</div>'
          : ''}
        ${rows ? header + rows : '<div class="stat-row"><em>No researchable techs for this race yet.</em></div>'}
      </div>`;
  }

  /** Live stat line for a unit a tech unlocks (2026-08-10, user-directed):
   *  computed from units.js/combat.js at RENDER time -- via getUnitProperty,
   *  which already folds in any unit_stat_upgrade this CIV has researched
   *  for it -- rather than baked into the tech's static description text,
   *  which used to drift out of sync whenever a unit's numbers changed.
   *  Passes a synthetic { typeId } "unit" (getUnitProperty only ever reads
   *  that one field) since there's no real unit instance to ask about here,
   *  just what a freshly-built one would look like right now. */
  /** Compact stat summary for one unit type, as a plain array of strings
   *  ("Atk 5", "Def 3", ...) -- civ-aware (race/tech overrides via
   *  combat.getUnitProperty), so a Halfellow Armory bonus or an Orc Swift
   *  Hunters movement buff shows up here too, not just the raw units.js
   *  base stats. Returns null if unitId doesn't resolve to a real unit.
   *  Shared by the tech tree's unlocked-unit callout (unitStatsHtml below)
   *  and the city build list's per-row preview (buildlist.js) -- pulled out
   *  on its own (2026-08-11, user-directed) so both render their own HTML
   *  around the same numbers instead of one duplicating the other. */
  function unitStatParts(civ, unitId) {
    const combat = window.GameEngine.combat;
    const base = window.GameData.getUnit(unitId);
    if (!base) return null;
    const fake = { typeId: unitId };
    const get = (key, fallback) => combat.getUnitProperty(fake, civ, key, fallback);
    const parts = [
      `Atk ${get("attack", 0)}`,
      `Def ${get("defense", 0)}`,
      `Mov ${get("movement", 0)}`,
      `Vis ${get("visionRadius", 0)}`,
    ];
    const range = get("range", 1);
    if (range > 1) parts.push(`Range ${range}`);
    const siegePct = get("siegePct", 0);
    if (siegePct > 0) parts.push(`Siege ${Math.round(siegePct * 100)}%`);
    const firstStrikePct = get("firstStrikePct", 0);
    if (firstStrikePct > 0) parts.push(`First Strike ${Math.round(firstStrikePct * 100)}%`);
    const doubleStrikePct = get("doubleStrikePct", 0);
    if (doubleStrikePct > 0) parts.push(`Double Strike ${Math.round(doubleStrikePct * 100)}%`);
    if (get("flying", false)) parts.push("Flying");
    if (get("canCarryUnit", false)) parts.push("Carry");
    return parts;
  }

  function unitStatsHtml(civ, unitId) {
    const base = window.GameData.getUnit(unitId);
    const parts = unitStatParts(civ, unitId);
    if (!base || !parts) return "";
    return `<div class="techtree-node-unit-stats">${escapeHtml(base.label)}: ${escapeHtml(parts.join(" · "))}</div>`;
  }

  function renderNode(civ, tech, nextPick, isPlayerCiv, isFocused, relationKind) {
    const completed = civ.completedTechs.has(tech.id);
    const researching = civ.currentResearch === tech.id;
    const isNextPick = !completed && !researching && tech.id === nextPick;
    const cityGateOk = window.GameEngine.tech.meetsCityGate(civ, tech);
    const missingPrereqs = tech.prereqs.filter((p) => !civ.completedTechs.has(p));
    const prereqsOk = missingPrereqs.length === 0;
    const locked = !completed && !researching && (!cityGateOk || !prereqsOk);

    // Up-front affordability (2026-08-04, user-directed research redesign):
    // chooseResearch now pays this tech's full cost from the stockpile
    // the instant it's picked, same one-time-purchase model a unit/building
    // queue already uses -- so a tech whose gates are satisfied but that the
    // civ can't yet AFFORD needs its own state, not a "Click to research"
    // button that would silently fail (chooseResearch returning false with
    // nothing else telling the player why). Multi-resource (2026-08-05,
    // user-directed): cost is now split across harvest/coin/lore by
    // category (see GameData.effectiveTechCostBreakdown) -- ALL THREE must
    // be affordable.
    const cost = window.GameData.effectiveTechCostBreakdown(tech);
    const stock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    const affordable = cost.harvest <= (stock.harvest || 0) && cost.coin <= (stock.coin || 0) && cost.lore <= (stock.lore || 0);
    let stateClass = "available";
    let tag = "Available";
    if (completed) { stateClass = "completed"; tag = "Purchased"; }
    else if (researching) {
      stateClass = "researching";
      const pct = civ.researchTotalTurns
        ? Math.min(100, Math.floor(100 * (civ.researchTotalTurns - civ.researchTurnsRemaining) / civ.researchTotalTurns))
        : 0;
      tag = `Researching -- ${civ.researchTurnsRemaining} turn${civ.researchTurnsRemaining === 1 ? "" : "s"} left (${pct}%)`;
    } else if (isNextPick) { stateClass = "next-pick"; tag = "AI intends to research next"; }
    else if (locked) {
      stateClass = "locked";
      // Names the actual missing prereq(s) by label instead of a bare "Needs
      // prerequisite" (2026-08-04, user-reported: that message gave no way
      // to tell WHICH tech was missing without cross-referencing the tree by
      // eye). Both gates can be unmet at once -- rare, but shown together
      // rather than silently dropping one -- since meetsCityGate and the
      // prereq check are independent conditions, not an if/else in
      // tech.js's own chooseResearch gate.
      const reasons = [];
      if (!cityGateOk) reasons.push(`Needs ${tech.layer} ${tech.layer === 1 ? "city" : "cities"}`);
      if (!prereqsOk) {
        const names = missingPrereqs.map((p) => window.GameData.getTech(p).label).join(", ");
        reasons.push(`Needs: ${names}`);
      }
      tag = reasons.join(" · ");
    } else if (!affordable) {
      // Gates are satisfied but the up-front payment isn't affordable yet --
      // distinct from "locked" (that's about city count/prereqs, not
      // resources).
      stateClass = "locked";
      tag = "Not enough resources banked yet";
    }

    // Clickable only in the player's own tree, and only for a node
    // chooseResearch would actually accept: not done, not already underway,
    // gates satisfied, AND affordable up front. Switching targets while
    // something is already in progress now FORFEITS whatever was paid for
    // it (see tech.js's chooseResearch doc comment) -- no longer the free,
    // lossless switch the old income-accumulation model allowed.
    const selectable = isPlayerCiv && !completed && !researching && !locked && affordable;
    if (selectable) tag = "Click to research";

    // Per-resource cost tokens (2026-08-05, user-directed), same "10H 15C"
    // convention and green/red-vs-stockpile coloring as sidebar.js's build
    // picker -- zero-cost components are omitted rather than shown as a
    // bare "0X".
    const costHtml = Object.entries(cost)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => {
        const have = stock[k] || 0;
        const color = have >= v ? "#6fbf6f" : "#d9695f";
        return `<span style="color:${color}">${v}${k[0].toUpperCase()}</span>`;
      }).join(" ");

    // Turns-to-complete (2026-08-04): no longer an income-derived estimate --
    // researchTurns is now a FIXED number the instant a tech is chosen (see
    // tech.js), so this can show the real total for any node that isn't
    // already locked/completed, not just the one currently in progress.
    let turnsTag = "";
    if (!completed && !locked && !researching) {
      const turns = window.GameEngine.tech.researchTurns(civ, tech);
      turnsTag = ` (${turns} turn${turns === 1 ? "" : "s"})`;
    }

    // Live unit stat block (2026-08-10, user-directed): one per unit this
    // tech's effects actually unlock or replace-in (almost always zero or
    // one, never baked into the description text itself -- see
    // unitStatsHtml). replace_unit counts too -- Knighthood/Longbow/etc.
    // swap in a new unit just as much as a plain unlock_unit does.
    const unlockedUnitStats = (tech.effects || [])
      .filter((e) => e.type === "unlock_unit" || e.type === "replace_unit")
      .map((e) => unitStatsHtml(civ, e.unit || e.to))
      .join("");

    const body = `<div class="techtree-node-name">${escapeHtml(tech.label)}</div>
      ${tech.description ? `<div class="techtree-node-desc">${escapeHtml(tech.description)}</div>` : ''}
      ${unlockedUnitStats}
      <div class="techtree-node-tag">${escapeHtml(tag)} · ${costHtml}${escapeHtml(turnsTag)}</div>`;

    // Extra fade for tiers that are genuinely FAR off (2026-08-04, user-
    // directed): a tech only 1 city away from unlocking is worth reading now
    // to plan toward; one 3+ cities away is pure noise at the current game
    // stage and was competing visually with the near-term ones at the same
    // flat 0.5 opacity every locked node got before this. Graduated by how
    // many additional cities are needed (tech.layer - civ.cities.length),
    // not by whether the OTHER gate -- prereqs -- is unmet, since a prereq
    // gap is usually one tech away, not a stage of the game away. Always
    // reaches full clarity on hover (see the .techtree-node-far:hover CSS
    // rule) so nothing is ever permanently unreadable, just deprioritized.
    let extraFadeClass = "";
    if (!cityGateOk) {
      const citiesAway = tech.layer - civ.cities.length;
      if (citiesAway >= 2) extraFadeClass = " techtree-node-far";
    }

    // data-tech-id is on BOTH branches (2026-08-10, user-directed) so the
    // research-complete modal's "jump to this tech" links can locate and
    // scroll to any node, not just clickable ones -- and now so the hover-
    // relation feature can attach mouseenter/mouseleave to every node too.
    const focusClass = isFocused ? " techtree-node-focused" : "";
    // Hover relation highlighting (2026-08-10, user-directed): "self" is the
    // hovered node itself; ancestor/descendant are its prereq chain both
    // ways, indirect ones a notch dimmer than direct so the eye reads
    // "closer" vs "further" at a glance. Nodes with NO relation are left
    // completely alone now (2026-08-10, user-directed follow-up: dimming
    // every unrelated node on every hover move caused too much visual
    // "flicker") -- only the related path itself ever changes appearance.
    let relationClass = "";
    if (relationKind === "self") relationClass = " techtree-node-relation-self";
    else if (relationKind === "ancestor-direct") relationClass = " techtree-node-relation-ancestor";
    else if (relationKind === "ancestor-indirect") relationClass = " techtree-node-relation-ancestor techtree-node-relation-indirect";
    else if (relationKind === "descendant-direct") relationClass = " techtree-node-relation-descendant";
    else if (relationKind === "descendant-indirect") relationClass = " techtree-node-relation-descendant techtree-node-relation-indirect";
    if (selectable) {
      return `<button class="techtree-node ${stateClass} techtree-node-selectable${focusClass}${relationClass}"
        data-tech-id="${escapeHtml(tech.id)}">${body}</button>`;
    }
    return `<div class="techtree-node ${stateClass}${extraFadeClass}${focusClass}${relationClass}" data-tech-id="${escapeHtml(tech.id)}">${body}</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.UI.techtree = { render, unitStatParts };
})();
