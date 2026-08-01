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
