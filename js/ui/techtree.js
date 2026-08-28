/**
 * TECH TREE VIEWER
 * ----------------
 * The full tech tree for a chosen civ, laid out by layer (rows, Level 0
 * through Level 5) and column (civic/building/military), with each node's
 * status -- completed, currently researching (with progress %), the AI's
 * intended next pick (via ai.js's previewNextResearch, a non-mutating
 * preview), locked (city-gate or prereqs unmet), or simply available.
 *
 * Read-only for every civ EXCEPT the human player's own: chooseResearch is
 * only ever called from ai.js, which turns.js
 * skips for the human civ, so available nodes in the player's own tree are
 * buttons instead.
 *
 * Every layer row always renders fully expanded -- the
 * caller instead vertically centers the view on the highest currently-
 * available layer the moment the screen opens (see main.js's redraw(),
 * which does this via `data-avail` below rather than anything in this pure-
 * render module).
 */

window.UI = window.UI || {};

(function () {
  // "Mystic": a 4th column for spellcaster/
  // utility units and their own abilities -- Wizard, Druid, Metal Singer,
  // Bog Witch, Trouble Maker -- split out of Military, which was carrying
  // both straight combat techs and every caster's whole kit. Not every race
  // has mystic content (Undead has none yet); techtree.js's own layer-
  // skipping already handles a column/layer with nothing in it.
  const COLUMNS = ["civic", "building", "military", "mystic"];
  const COLUMN_LABEL = { civic: "Civic", building: "Building", military: "Military", mystic: "Mystic" };

  // Tech-effect -> Knowledge Base condition cross-links (2026-08-26,
  // user-directed). There is no structured "grants a condition" effect type
  // to scan for -- every one of these rides on a plain unlock_mechanic plus
  // a per-unit *ChancePct stat the civ's combat-mechanics code reads
  // directly (see ai.js's applyElfCombatMechanics/applyOrcCombatMechanics
  // and the wizard's Freezing Touch/Burn It All Down blocks) -- so this is a
  // small hand-maintained table, same convention as knowledgebase.js's own
  // UNIT_CONDITION_LINKS. A mechanic absent here just renders with no
  // condition link, same as any tech with no such effect at all; a newly
  // added condition-granting tech needs one more entry.
  const MECHANIC_CONDITIONS = {
    poisonous_extracts: ["poisoned"],
    first_frost_of_autumn: ["frozen"],
    freezing_touch: ["frozen"],
    burn_it_all_down: ["burning"],
    malefic_malediction: ["curse"],
    pyromania: ["poisoned"],
    afflictions_of_anguish: ["poisoned", "befuddled", "curse", "frozen"],
  };

  /** Every distinct condition key `tech` can inflict on attack, via
   *  MECHANIC_CONDITIONS -- deduplicated (afflictions_of_anguish alone lists
   *  four), in table declaration order. */
  function conditionKeysForTech(tech) {
    const keys = [];
    for (const e of tech.effects || []) {
      if (e.type !== "unlock_mechanic") continue;
      for (const k of MECHANIC_CONDITIONS[e.mechanic] || []) {
        if (!keys.includes(k)) keys.push(k);
      }
    }
    return keys;
  }

  /** One ".tile-link"-styled cross-link per condition `tech` can inflict,
   *  jumping straight to that condition's own Knowledge Base page -- wired
   *  in main.js (see wireTechTreeKbLinks), reusing whatever
   *  conditionDisplayName knowledgebase.js already uses for that page's own
   *  list so the label can never drift between the two. Empty string (not
   *  null) when there's nothing to show, so the caller can drop it straight
   *  into a template literal. */
  function conditionLinksHtml(tech) {
    const keys = conditionKeysForTech(tech);
    if (!keys.length) return "";
    const displayName = (window.UI.knowledgebase && window.UI.knowledgebase.conditionDisplayName) || ((k) => k);
    const links = keys.map((key) =>
      `<span class="tile-link techtree-kb-link" data-kb-condition="${escapeHtml(key)}">View: ${escapeHtml(displayName(key))} &rarr;</span>`
    ).join(" ");
    return `<div class="techtree-node-conditions">${links}</div>`;
  }

  // Old-model races still tag their ability nodes "mechanics" -- these render
  // in the Civic column, matching how Human's tree folded Mechanics into Civic.
  function columnFor(tech) {
    if (tech.category === "mechanics") return "civic";
    return COLUMNS.includes(tech.category) ? tech.category : "civic";
  }

  /** Whether `layer` currently has any tech worth calling out as its own
   *  "highest available" -- available to research, or actively being
   *  researched. Stamped onto each row as `data-avail` so main.js can find
   *  the highest such layer (last matching row, DOM order is ascending) and
   *  center on it the moment the tech tree opens, without this module
   *  needing to know anything about scrolling. */
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
   * Prereq/unlock relations for whichever tech is currently hovered --
   * shows what techs unlocked the current tech, and what techs are
   * unlocked by the current tech, without cluttering the screen with
   * permanent arrows. Returns null if nothing's hovered.
   *
   * DIRECT ancestors/descendants are one hop away (tech.prereqs itself, and
   * whatever else's prereqs name this tech); INDIRECT ones are everything
   * further up/down the chain. Both get their own relationKindFor() CSS
   * class on any node -- every node is always visible (see
   * this file's own top-of-file doc comment), so relations just recolor the
   * nodes themselves, nothing more.
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

  /** `isReference` (2026-08-26, user-directed): true for the Knowledge
   *  Base's own "Tech Trees" tab, which renders against buildReferenceCiv's
   *  synthetic civ (main.js) -- zero cities, zero completed techs beyond
   *  Level 0, by construction, forever. Every non-trivial tech in that view
   *  is permanently "locked" and, before this flag existed, also picked up
   *  the extra techtree-node-far fade meant for a genuinely far-off tech IN
   *  A REAL GAME (2026-08-04, user-directed, and still exactly right there
   *  -- see renderNode's own comment on it) -- except every tech in a
   *  reference view is "far off" by that same measure, since there's no
   *  real city count to compare against. The result was most of the tree
   *  rendering barely legible on a page whose whole purpose is to be read.
   *  This flag turns that fade off for renderNode (never applies it) and
   *  stamps a class the live game's own tree never gets, so style.css can
   *  neutralize .locked's ordinary dimming there too without touching what
   *  "locked" looks like in an actual game. */
  function render(civ, isPlayerCiv, focusTechId, hoverTechId, isReference, collapsedLayers) {
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

    const relations = computeRelations(civ, hoverTechId);

    let rows = "";
    for (let layer = 0; layer <= maxLayer; layer++) {
      const cols = byLayer[layer];
      if (!cols) continue;
      const avail = layerHasAvailable(civ, cols);
      // Collapsed layers (2026-08-27, user-directed): Level 0 starts
      // collapsed -- see main.js's lazy default -- since it's auto-granted
      // for free at civ creation (createNewGame) and never has anything to
      // research, so it's pure clutter at the top of every tree. Toggled by
      // clicking the label; only the 4 columns hide, the label itself
      // (and its data-avail) stays in the DOM so the "scroll to highest
      // available layer" logic below still finds it.
      const collapsed = collapsedLayers instanceof Set && collapsedLayers.has(layer);

      rows += `<div class="techtree-layer${collapsed ? " techtree-layer-collapsed" : ""}" data-layer="${layer}" data-avail="${avail}">
        <button class="techtree-layer-label" data-layer-toggle="${layer}" aria-expanded="${collapsed ? "false" : "true"}">
          <span class="techtree-layer-caret" aria-hidden="true">${collapsed ? "▸" : "▾"}</span>Level ${layer}
        </button>
        ${COLUMNS.map((col) => `<div class="techtree-column" data-column-label="${escapeHtml(COLUMN_LABEL[col])}">${
          cols[col].map((tech) => renderNode(
            civ, tech, nextPick, isPlayerCiv, tech.id === focusTechId,
            tech.id === hoverTechId ? "self" : relationKindFor(relations, tech.id),
            isReference,
          )).join("") || ""
        }</div>`).join("")}
      </div>`;
    }

    const header = `<div class="techtree-layer techtree-header">
      <div class="techtree-layer-label"></div>
      ${COLUMNS.map((col) => `<div class="techtree-column-title">${escapeHtml(COLUMN_LABEL[col])}</div>`).join("")}
    </div>`;

    return `
      <div class="panel${isReference ? " techtree-reference" : ""}">
        <h2>${escapeHtml(race.label)} — Tech Tree</h2>
        <div class="stat-row"><span>Cities</span><span>${civ.cities.length}</span></div>
        ${isPlayerCiv ? (() => {
          // Multi-resource stockpile readout:
          // tech cost used to be pure Lore, so this was a single number --
          // now every tech's cost draws on harvest/coin/lore (see
          // GameData.effectiveTechCostBreakdown), same icon convention
          // sidebar.js's economy table already uses.
          const s = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          const stockHtml = ["harvest", "coin", "lore"]
            .map((k) => `${resourceIconHtml(k)}${s[k].toFixed(0)}`).join(" ");
          return `<div class="stat-row"><span>Stockpile</span><span>${stockHtml}</span></div>`;
        })() : ''}
        ${isPlayerCiv && !civ.currentResearch
          ? '<div class="techtree-prompt">Nothing is being researched. Click any available tech to start.</div>'
          : ''}
        ${rows ? header + rows : '<div class="stat-row"><em>No researchable techs for this race yet.</em></div>'}
      </div>`;
  }

  /** Live stat line for a unit a tech unlocks:
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
   *  on its own so both render their own HTML
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
    // Cross-links to that unit's own Knowledge Base profile (2026-08-26,
    // user-directed) -- see conditionLinksHtml just above for the sibling
    // condition-link feature and main.js's wireTechTreeKbLinks for how both
    // get wired.
    return `<div class="techtree-node-unit-stats">${escapeHtml(base.label)}: ${escapeHtml(parts.join(" · "))}
      <span class="tile-link techtree-kb-link" data-kb-unit="${escapeHtml(unitId)}">View unit &rarr;</span></div>`;
  }

  function renderNode(civ, tech, nextPick, isPlayerCiv, isFocused, relationKind, isReference) {
    const completed = civ.completedTechs.has(tech.id);
    const researching = civ.currentResearch === tech.id;
    const isNextPick = !completed && !researching && tech.id === nextPick;
    const cityGateOk = window.GameEngine.tech.meetsCityGate(civ, tech);
    const missingPrereqs = tech.prereqs.filter((p) => !civ.completedTechs.has(p));
    const prereqsOk = missingPrereqs.length === 0;
    const locked = !completed && !researching && (!cityGateOk || !prereqsOk);

    // Up-front affordability: chooseResearch pays this tech's full cost
    // from the stockpile the instant it's picked, same one-time-purchase
    // model a unit/building queue uses -- so a tech whose gates are
    // satisfied but that the civ can't yet AFFORD needs its own state, not
    // a "Click to research" button that would silently fail (chooseResearch
    // returning false with nothing else telling the player why). Cost is
    // split across harvest/coin/lore by
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
      // prerequisite", which gives no way
      // to tell WHICH tech was missing without cross-referencing the tree by
      // eye. Both gates can be unmet at once -- rare, but shown together
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

    // Per-resource cost tokens, same icon-per-resource convention and
    // green/red-vs-stockpile coloring as sidebar.js's build picker --
    // zero-cost components are omitted rather than shown as a bare "0X".
    // currentColor picks up the inline color below, so the icon itself
    // tints green/red right along with its number.
    const costHtml = Object.entries(cost)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => {
        const have = stock[k] || 0;
        const color = have >= v ? "#6fbf6f" : "#d9695f";
        return `<span style="color:${color}">${resourceIconHtml(k)}${v}</span>`;
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

    // Live unit stat block: one per unit this
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
      ${conditionLinksHtml(tech)}
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
    //
    // NEVER applied when isReference (2026-08-26, user-directed): see
    // render()'s own doc comment on why "far off" is meaningless against a
    // synthetic civ with 0 cities forever -- everything past Level 1 would
    // measure as far, which is the opposite of this feature's own intent.
    let extraFadeClass = "";
    if (!isReference && !cityGateOk) {
      const citiesAway = tech.layer - civ.cities.length;
      if (citiesAway >= 2) extraFadeClass = " techtree-node-far";
    }

    // data-tech-id is on BOTH branches so the
    // research-complete modal's "jump to this tech" links can locate and
    // scroll to any node, not just clickable ones -- and now so the hover-
    // relation feature can attach mouseenter/mouseleave to every node too.
    const focusClass = isFocused ? " techtree-node-focused" : "";
    // Hover relation highlighting: "self" is the
    // hovered node itself; ancestor/descendant are its prereq chain both
    // ways, indirect ones a notch dimmer than direct so the eye reads
    // "closer" vs "further" at a glance. Nodes with NO relation are left
    // completely alone -- only the related path itself ever changes appearance.
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

  // The same crafted glyph sidebar.js's economy table uses (index.html's
  // #icon-harvest/#icon-coin/#icon-lore <symbol> defs), swapped in for the
  // old bare "H"/"C"/"L" letter suffix (2026-08-27, user-directed) --
  // resource key doubles as the symbol id since they're already named
  // "icon-harvest" etc.
  function resourceIconHtml(key) {
    return `<svg class="resource-icon"><use href="#icon-${key}"></use></svg>`;
  }

  window.UI.techtree = { render, unitStatParts };
})();
