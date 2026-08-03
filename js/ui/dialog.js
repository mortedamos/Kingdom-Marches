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
 *   { kind: "message", title, text, onDismiss() }
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
      const items = (dialog.items || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
      return `
        <h2>End Turn?</h2>
        <p>There's still work you can do this turn:</p>
        <ul class="game-dialog-list">${items}</ul>
        <div class="game-dialog-actions">
          <button class="menu-dropdown-btn" id="game-dialog-cancel-btn">Keep Playing</button>
          <button class="menu-dropdown-btn game-dialog-primary" id="game-dialog-confirm-btn">End Turn</button>
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
