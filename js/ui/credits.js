/**
 * CREDITS CRAWL (2026-08-07, user-directed)
 * ------------------------------------------
 * Turns doc/credits.txt into the HTML blocks main.js's credits overlay
 * scrolls bottom-to-top. Format (deliberately small -- no markdown library,
 * matching this project's no-build-step/no-dependency convention):
 *
 *   # Title line          -> big centered title (one per file, normally the
 *                            first line)
 *   ## Section heading     -> a section header, e.g. "## Music"
 *   blank line              -> paragraph break
 *   any other line          -> body text; consecutive non-blank lines join
 *                            into one paragraph, each on its own row
 *
 * Bare "http(s)://..." URLs in any line are auto-linked. Everything else is
 * escaped, so credits.txt itself never needs HTML.
 */
(function () {
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const URL_RE = /(https?:\/\/[^\s<]+)/g;
  function linkify(escaped) {
    return escaped.replace(URL_RE, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  }

  function parse(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let para = [];
    const flushPara = () => {
      if (para.length) { blocks.push({ type: "para", lines: para }); para = []; }
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("## ")) { flushPara(); blocks.push({ type: "heading", text: line.slice(3).trim() }); }
      else if (line.startsWith("# ")) { flushPara(); blocks.push({ type: "title", text: line.slice(2).trim() }); }
      else if (line === "") { flushPara(); }
      else { para.push(line); }
    }
    flushPara();
    return blocks;
  }

  function render(text) {
    return parse(text).map((b) => {
      if (b.type === "title") return `<h1 class="credits-title">${linkify(escapeHtml(b.text))}</h1>`;
      if (b.type === "heading") return `<h2 class="credits-heading">${linkify(escapeHtml(b.text))}</h2>`;
      return `<p class="credits-para">${b.lines.map((l) => linkify(escapeHtml(l))).join("<br>")}</p>`;
    }).join("");
  }

  window.UI = window.UI || {};
  window.UI.credits = { parse, render };
})();
