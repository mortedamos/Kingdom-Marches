/**
 * CREDITS CRAWL
 * -------------
 * Turns doc/credits.txt into the HTML blocks main.js's credits overlay
 * scrolls bottom-to-top. Also reused as-is by the Tutorial window
 * (js/main.js's openTutorial) for tutorial.txt -- same tiny format, just
 * rendered into a static modal instead of a scrolling crawl. Format
 * (deliberately small -- no markdown library, matching this project's
 * no-build-step/no-dependency convention):
 *
 *   # Title line          -> big centered title (one per file, normally the
 *                            first line)
 *   ## Section heading     -> a section header, e.g. "## Music"
 *   blank line              -> paragraph break
 *   any other line          -> body text; consecutive non-blank lines join
 *                            into one paragraph, each on its own row
 *
 * Bare "http(s)://..." URLs in any line are auto-linked. **text** renders
 * bold (<strong>) -- no _italic_/other emphasis, just the one a tutorial
 * actually needs for "press T" style callouts. Everything else is escaped,
 * so credits.txt/tutorial.txt itself never needs HTML.
 *
 * [Label](kb:view:id) -> a Knowledge Base cross-link (2026-09-13, added for
 * tutorial.txt): renders as an in-page link the caller wires up itself (see
 * js/main.js's jumpToKnowledgeFromTutorial) rather than navigating anywhere
 * on its own -- this module only knows text, not the Knowledge Base's live
 * state. `view` is one of the Knowledge menu's own page names ("units",
 * "structures", "terrain", "actions", "conditions", "stats"); `id` is that
 * page's own lookup key (a unit/structure id, a terrain catalog key, a
 * condition/stat/action key). Unused by credits.txt today, but harmless
 * there too -- same reason this lives in the shared parser rather than a
 * tutorial-only fork of it.
 */
(function () {
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const URL_RE = /(https?:\/\/[^\s<]+)/g;
  function linkify(escaped) {
    return escaped.replace(URL_RE, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  }

  // [Label](kb:view:id) -- see this file's own doc comment above. Matched
  // against the already-escaped line, same as URL_RE, so `label` can't carry
  // stray HTML; `view`/`id` are restricted to a plain identifier charset
  // (kept out of quotes/angle-brackets entirely, no separate attribute-
  // escaping needed).
  const KB_LINK_RE = /\[([^\]]+)\]\(kb:([a-z]+):([\w-]+)\)/g;
  function linkifyKb(escaped) {
    return escaped.replace(KB_LINK_RE, (_m, label, view, id) =>
      `<a href="#" class="kb-link" data-kb-view="${view}" data-kb-id="${id}">${label}</a>`);
  }

  // **text** -> <strong>. Matched against the already-escaped line, same as
  // KB_LINK_RE/URL_RE -- non-greedy so "**a** and **b**" makes two <strong>
  // runs instead of one spanning "a** and **b".
  const BOLD_RE = /\*\*([^*]+)\*\*/g;
  function linkifyBold(escaped) {
    return escaped.replace(BOLD_RE, (_m, inner) => `<strong>${inner}</strong>`);
  }

  /** Every place text actually reaches the page runs through this one path,
   *  so URL auto-linking, kb: cross-links, and **bold** all apply everywhere
   *  (title/heading/paragraph) instead of only wherever someone remembered
   *  to call linkify -- kb-link substitution goes first since its own
   *  output (a literal "#" href) would otherwise never itself get mistaken
   *  for a bare URL, but doing it in this order means it never has to
   *  consider one; bold's `**`/`*` delimiters don't overlap either of the
   *  other two's syntax, so its own position in the chain doesn't matter. */
  function renderInline(raw) {
    return linkify(linkifyBold(linkifyKb(escapeHtml(raw))));
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
      if (b.type === "title") return `<h1 class="credits-title">${renderInline(b.text)}</h1>`;
      if (b.type === "heading") return `<h2 class="credits-heading">${renderInline(b.text)}</h2>`;
      return `<p class="credits-para">${b.lines.map(renderInline).join("<br>")}</p>`;
    }).join("");
  }

  window.UI = window.UI || {};
  window.UI.credits = { parse, render };
})();
