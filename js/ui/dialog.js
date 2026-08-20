/**
 * IN-GAME DIALOG (replaces browser confirm()/prompt()/alert())
 * --------------------------------------------------------------
 * Renders one of two dialog "kinds" into #game-dialog-modal, mirroring the
 * tech tree/reports overlay chrome (index.html's #game-dialog-overlay reuses
 * .techtree-overlay). main.js owns viewState.dialog (the only state) and
 * wires the buttons this markup exposes -- this module is pure rendering,
 * same split as reports.js/techtree.js.
 *
 *   { kind: "foundCity", x, y, suggested, onAnswer(nameOrNull) }
 *   { kind: "confirmEndTurn", items[], onAnswer(bool) }
 *   { kind: "confirm", title, text, confirmLabel, danger, onAnswer(bool) }
 *   { kind: "message", title, text, onDismiss() }
 *   { kind: "chooseTech", title, text, options: [{id,label,description}], onAnswer(techId) }
 *   { kind: "chooseStarvationDisband", civLabel, candidates: [{label,description}], onAnswer(index) }
 *   { kind: "chooseWispDisband", civLabel, candidates: [{label,description}], onAnswer(index) }
 *   { kind: "techResearched", techLabel, techDescription, unlockedTechs[{id,label}], onChooseResearch(), onViewTech(techId), onDismiss() }
 *   { kind: "unitBuilt", cityName, unitLabel, unitProperName, onGoToCity(), onGoToUnit(), onDismiss() }
 *   { kind: "confirmAutomatedAction", unitLabel, actionLabel, onConfirm(), onDecline() }
 *   { kind: "attackNotice", unitLabel, onGoTo(), onSkip() }
 *   { kind: "gameOver", turnsSurvived, citiesFounded, citiesLost, techsResearched, onReturnToTitle() }
 *   { kind: "victoryStats", timeTaken, totalTurns, militaryPower, influenceLevel, unitKills, unitsLost, onReturnToTitle() }
 *
 * Every kind rendered here needs a matching branch in main.js's
 * wireDialogButtons -- the markup below only names the buttons, it doesn't
 * attach anything to them.
 */

window.UI = window.UI || {};

(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render(dialog) {
    if (dialog.kind === "foundCity") {
      return `
        <h2>Found a City?</h2>
        <p>Found a city here at (${dialog.x}, ${dialog.y})?</p>
        <input type="text" id="game-dialog-name-input" class="game-dialog-input" value="${escapeHtml(dialog.suggested)}">
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-skip-btn">Not Now</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">Found City</button>
        </div>`;
    }
    if (dialog.kind === "confirmEndTurn") {
      // The turn-end guard (see main.js's collectUnresolvedTurnWork). This
      // branch used to be missing entirely, so a confirmEndTurn dialog fell
      // through to the "message" render below and drew the literal string
      // "undefined" (dialog.text doesn't exist on this kind) above an OK
      // button that wireDialogButtons never wired -- clicking it did nothing
      // and the modal could not be dismissed at all.
      //
      // Each item optionally carries a tile to jump to (2026-08-04, user-
      // directed) -- same .tile-link markup/convention as sidebar.js's own
      // tileLink, wired by wireDialogButtons rather than the sidebar's usual
      // global querySelectorAll pass, since that pass already ran earlier in
      // THIS SAME redraw() call, before the dialog's innerHTML (and these
      // buttons) existed.
      const items = (dialog.items || []).map((item) => {
        const label = escapeHtml(item.text);
        // "No research selected" isn't tied to
        // a tile, so it gets its own jump-straight-to-the-tech-tree button
        // instead of a tile-link "Go to" -- see wireDialogButtons.
        const link = item.chooseResearch
          ? ` <button class="dialog-action-link" data-choose-research="1">Choose Research</button>`
          : Number.isFinite(item.x) && Number.isFinite(item.y)
          ? ` <button class="tile-link" data-tile-x="${item.x}" data-tile-y="${item.y}"${item.tabKind ? ` data-tile-tab="${escapeHtml(item.tabKind)}"` : ""}>Go to</button>`
          : "";
        return `<li>${label}${link}</li>`;
      }).join("");
      // Idle-city note: only shown when the list
      // actually contains an idle-city item (tabKind "city", no
      // chooseResearch flag) -- see main.js's defaultIdleCitiesToGatherResources,
      // which is what actually applies this default the moment End Turn is
      // confirmed here.
      const hasIdleCity = (dialog.items || []).some((item) => item.tabKind === "city");
      const idleCityNote = hasIdleCity
        ? `<p class="game-dialog-hint">Cities left without an action will default to Gather Resources.</p>`
        : "";
      return `
        <h2>End Turn?</h2>
        <p>There's still work you can do this turn:</p>
        <ul class="game-dialog-list">${items}</ul>
        ${idleCityNote}
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Keep Playing</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">End Turn</button>
        </div>`;
    }
    if (dialog.kind === "confirm") {
      // Generic yes/no confirm: first consumer is
      // Disband Unit -- an irreversible action that, unlike Found City, had
      // no confirmation at all and sat in the sidebar one text-color away
      // from Rest/Defend. Reuses foundCity's own button ids/wiring shape
      // (see wireDialogButtons) rather than introducing a third pattern.
      // `danger` swaps the primary button to the same red action-btn-danger
      // treatment the sidebar itself uses for destructive actions, so the
      // dialog's own visual weight matches what's being confirmed.
      return `
        <h2>${escapeHtml(dialog.title)}</h2>
        <p>${escapeHtml(dialog.text)}</p>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Cancel</button>
          <button class="menu-dropdown-btn ${dialog.danger ? "game-dialog-danger" : "game-dialog-primary"}" id="game-dialog-confirm-btn">${escapeHtml(dialog.confirmLabel || "Confirm")}</button>
        </div>`;
    }
    if (dialog.kind === "chooseTech") {
      // Free first-city tech pick: an N-way
      // choice, unlike every other dialog kind here which tops out at 2
      // buttons -- each option is its own full-width button (reuses
      // .menu-dropdown-btn, already left-aligned) rather than trying to
      // force a variable-length list into .game-dialog-actions' row layout.
      const options = (dialog.options || []).map((o) => `
        <button class="menu-dropdown-btn game-dialog-choice" data-tech-id="${escapeHtml(o.id)}">
          <div class="game-dialog-choice-label">${escapeHtml(o.label)}</div>
          ${o.description ? `<div class="game-dialog-choice-desc">${escapeHtml(o.description)}</div>` : ""}
        </button>`).join("");
      return `
        <h2>${escapeHtml(dialog.title)}</h2>
        <p>${escapeHtml(dialog.text)}</p>
        <div class="game-dialog-choices">${options}</div>`;
    }
    if (dialog.kind === "chooseStarvationDisband") {
      // Starvation unit loss: upkeep ran the
      // stockpile negative, so a unit has to go -- the player picks which
      // one instead of a random pick vanishing with no warning. Same N-way
      // .game-dialog-choice shape as chooseTech above, just data-disband-
      // index (an array index into this round's candidate list, not a
      // stable id -- units don't have one) instead of data-tech-id.
      const options = (dialog.candidates || []).map((c, i) => `
        <button class="menu-dropdown-btn game-dialog-choice game-dialog-danger" data-disband-index="${i}">
          <div class="game-dialog-choice-label">${escapeHtml(c.label)}</div>
          <div class="game-dialog-choice-desc">${escapeHtml(c.description)}</div>
        </button>`).join("");
      return `
        <h2>Starvation!</h2>
        <p>Upkeep has outrun ${escapeHtml(dialog.civLabel)}'s stockpile. Choose a unit to disband:</p>
        <div class="game-dialog-choices">${options}</div>`;
    }
    if (dialog.kind === "chooseWispDisband") {
      // Orc "Bog Spirit" Wisp cap: a Bog Witch
      // died and left more Wisps than living Bog Witches to sustain them --
      // same N-way .game-dialog-choice/data-disband-index shape as
      // chooseStarvationDisband above, just a different trigger and wording.
      const options = (dialog.candidates || []).map((c, i) => `
        <button class="menu-dropdown-btn game-dialog-choice game-dialog-danger" data-disband-index="${i}">
          <div class="game-dialog-choice-label">${escapeHtml(c.label)}</div>
          <div class="game-dialog-choice-desc">${escapeHtml(c.description)}</div>
        </button>`).join("");
      return `
        <h2>A Bog Witch Has Died</h2>
        <p>${escapeHtml(dialog.civLabel)} now has more Wisps than living Bog Witches to sustain them. Choose a Wisp to disband:</p>
        <div class="game-dialog-choices">${options}</div>`;
    }
    if (dialog.kind === "techResearched") {
      // Tech-researched announcement: fires once
      // per completed tech (see main.js's finishRoundBookkeeping). Lists
      // every OTHER tech this one was a prerequisite for -- "here's what
      // just opened up" -- alongside a direct shortcut into the tech tree so
      // picking the next one doesn't need a separate menu hunt.
      // Each entry links back into the tech tree at that exact node
      // via a data-goto-tech-id button, wired by
      // main.js's wireDialogButtons -- same tile-link visual treatment as
      // the confirmEndTurn dialog's own "Go to" jump buttons.
      const unlocked = (dialog.unlockedTechs || []).length
        ? `<p class="game-dialog-unlocked-label">Unlocks:</p>
           <ul class="game-dialog-list">${dialog.unlockedTechs.map((t) =>
             `<li>${escapeHtml(t.label)} <button class="dialog-action-link" data-goto-tech-id="${escapeHtml(t.id)}">View</button></li>`
           ).join("")}</ul>`
        : "";
      // "Choose Next Research" is hidden when a tech is already being
      // researched -- see main.js's
      // openTechResearchedDialog for how alreadyResearching gets set.
      return `
        <h2>Research Complete</h2>
        <p class="game-dialog-tech-name">${escapeHtml(dialog.techLabel)}</p>
        ${dialog.techDescription ? `<p>${escapeHtml(dialog.techDescription)}</p>` : ""}
        ${unlocked}
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-ok-btn">OK</button>
          ${dialog.alreadyResearching ? "" : `<button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">Choose Next Research</button>`}
        </div>`;
    }
    if (dialog.kind === "unitBuilt") {
      // Unit-built announcement: fires once per
      // completed unit (see main.js's finishRoundBookkeeping, which queues
      // one of these per unit if more than one city finishes the same
      // round -- see offerNextUnitBuiltNotice). Two shortcuts: back to the
      // city to queue something new, or straight to the new unit to give it
      // orders.
      return `
        <h2>Unit Built</h2>
        <p>${escapeHtml(dialog.cityName)} has built ${escapeHtml(dialog.unitProperName)}, a ${escapeHtml(dialog.unitLabel)}.</p>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Go to City</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">Go to Unit</button>
        </div>`;
    }
    if (dialog.kind === "confirmAutomatedAction") {
      // Automate Actions confirmation: the
      // blocking, one-at-a-time gate an automated unit's staged
      // pendingIntent waits behind before it's actually allowed to found a
      // city, spend resources, or start a fight -- see main.js's
      // offerNextPendingIntent and the unit.automated && !opts.forcedX gates
      // in ai.js. Reuses the generic "confirm" kind's button ids/wiring.
      return `
        <h2>${escapeHtml(dialog.unitLabel)} — Automated Action</h2>
        <p>${escapeHtml(dialog.actionLabel)}</p>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Not Now</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">Confirm</button>
        </div>`;
    }
    if (dialog.kind === "attackNotice") {
      // Off-screen attack notice: fires the
      // instant a human-owned unit or city takes damage (or is destroyed)
      // while its tile isn't currently on screen -- see main.js's
      // detectHumanAttack/advanceTurn, which pauses turn processing right
      // here until answered. Reuses the generic "confirm" kind's button
      // ids/wiring, danger-styled since this is inherently bad news.
      return `
        <h2>Under Attack!</h2>
        <p>${escapeHtml(dialog.unitLabel)} is being attacked.</p>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Skip</button>
          <button class="menu-dropdown-btn game-dialog-danger" id="game-dialog-confirm-btn">Go to Attack</button>
        </div>`;
    }
    if (dialog.kind === "victoryStats") {
      // Shown right after the "Victory!" message is dismissed (see main.js's
      // showVictorySequence) -- same single-exit shape as gameOver below,
      // just for the winning side's stats instead of the losing side's.
      return `
        <h2>Victory!</h2>
        <div class="stat-row"><span>Total Time Taken</span><span>${escapeHtml(dialog.timeTaken)}</span></div>
        <div class="stat-row"><span>Total Turns</span><span>${dialog.totalTurns}</span></div>
        <div class="stat-row"><span>Military Power</span><span>${dialog.militaryPower}</span></div>
        <div class="stat-row"><span>Influence Level</span><span>${dialog.influenceLevel}</span></div>
        <div class="stat-row"><span>Unit Kills</span><span>${dialog.unitKills}</span></div>
        <div class="stat-row"><span>Units Lost in Battle</span><span>${dialog.unitsLost}</span></div>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-ok-btn">Return to Title Screen</button>
        </div>`;
    }
    if (dialog.kind === "gameOver") {
      // Human defeat: fires the instant this
      // civ is eliminated, or another civ wins first -- see main.js's
      // finishRoundBookkeeping/openGameOverDialog. Stats-only, single exit
      // (no "keep playing" option -- the game has genuinely ended for this
      // player either way).
      return `
        <h2>You Have Lost</h2>
        <div class="stat-row"><span>Turns Survived</span><span>${dialog.turnsSurvived}</span></div>
        <div class="stat-row"><span>Cities Founded</span><span>${dialog.citiesFounded}</span></div>
        <div class="stat-row"><span>Cities Lost</span><span>${dialog.citiesLost}</span></div>
        <div class="stat-row"><span>Technologies Researched</span><span>${dialog.techsResearched}</span></div>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-ok-btn">Return to Title Screen</button>
        </div>`;
    }
    // "message" -- single-button dismiss, e.g. a victory announcement.
    return `
      <h2>${escapeHtml(dialog.title || "")}</h2>
      <p>${escapeHtml(dialog.text)}</p>
      <div class="game-dialog-actions">
        <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-ok-btn">OK</button>
      </div>`;
  }

  window.UI.dialog = { render };
})();
