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
 *   { kind: "techResearched", techLabel, techDescription, unlockedLabels[], onChooseResearch(), onDismiss() }
 *   { kind: "unitBuilt", cityName, unitLabel, unitProperName, onGoToCity(), onGoToUnit(), onDismiss() }
 *   { kind: "confirmAutomatedAction", unitLabel, actionLabel, onConfirm(), onDecline() }
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
        const link = Number.isFinite(item.x) && Number.isFinite(item.y)
          ? ` <button class="tile-link" data-tile-x="${item.x}" data-tile-y="${item.y}"${item.tabKind ? ` data-tile-tab="${escapeHtml(item.tabKind)}"` : ""}>Go to</button>`
          : "";
        return `<li>${label}${link}</li>`;
      }).join("");
      return `
        <h2>End Turn?</h2>
        <p>There's still work you can do this turn:</p>
        <ul class="game-dialog-list">${items}</ul>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Keep Playing</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">End Turn</button>
        </div>`;
    }
    if (dialog.kind === "confirm") {
      // Generic yes/no confirm (2026-08-04, user-directed): first consumer is
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
      // Free first-city tech pick (2026-08-05, user-directed): an N-way
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
    if (dialog.kind === "techResearched") {
      // Tech-researched announcement (2026-08-06, user-directed): fires once
      // per completed tech (see main.js's finishRoundBookkeeping). Lists
      // every OTHER tech this one was a prerequisite for -- "here's what
      // just opened up" -- alongside a direct shortcut into the tech tree so
      // picking the next one doesn't need a separate menu hunt.
      const unlocked = (dialog.unlockedLabels || []).length
        ? `<p class="game-dialog-unlocked-label">Unlocks:</p>
           <ul class="game-dialog-list">${dialog.unlockedLabels.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : "";
      return `
        <h2>Research Complete</h2>
        <p class="game-dialog-tech-name">${escapeHtml(dialog.techLabel)}</p>
        ${dialog.techDescription ? `<p>${escapeHtml(dialog.techDescription)}</p>` : ""}
        ${unlocked}
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-ok-btn">OK</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">Choose Next Research</button>
        </div>`;
    }
    if (dialog.kind === "unitBuilt") {
      // Unit-built announcement (2026-08-06, user-directed): fires once per
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
      // Automate Actions confirmation (2026-08-06, user-directed): the
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
