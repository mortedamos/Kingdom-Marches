/**
 * MOTION PREFERENCE
 * ------------------
 * Single source of truth for "should ambient/decorative animation play
 * right now" -- clouds drifting, villagers wandering, unit level-up
 * sparkles/glow, condition-effect pulses, chest glints, and idle sprite
 * animation frame-cycling (terrain, units) all read `isReduced()` before
 * animating.
 *
 * Three modes, matching the Interface menu control:
 *   "auto"    -- follow the OS prefers-reduced-motion media query (default)
 *   "full"    -- always animate, even if the OS prefers reduced motion
 *   "reduced" -- never animate ambient motion, even if the OS doesn't ask
 * "auto" exists because plenty of people who want reduced motion in one
 * specific app never set the OS-wide preference, so the OS query alone
 * isn't enough -- but it's still the sensible default for everyone else.
 *
 * Deliberately NOT gated by this module: combat slashes and death effects
 * (overlays.js). Those are feedback for a discrete action the player just
 * took, not ambient decoration -- removing them costs information a
 * reduced-motion player still needs. Their on-screen duration is short by
 * design already.
 *
 * Persistence mirrors music.js's loadPersistedVolumes/persistVolumes
 * pattern exactly (same try/catch-and-fall-back-silently shape, same
 * "roi_" localStorage key prefix) -- sandboxed contexts without
 * localStorage still work, just don't remember the choice.
 */
(function () {
  window.UI = window.UI || {};

  let mode = "auto"; // "auto" | "full" | "reduced"
  let mql = null; // MediaQueryList, created lazily -- see init()
  let osReduced = false;
  const listeners = [];

  function loadPersisted() {
    try {
      const stored = JSON.parse(localStorage.getItem("roi_motion_settings") || "{}");
      if (stored.mode === "auto" || stored.mode === "full" || stored.mode === "reduced") {
        mode = stored.mode;
      }
    } catch (e) {
      console.log("[motion] persistence unavailable, using in-memory default");
    }
  }

  function persist() {
    try {
      localStorage.setItem("roi_motion_settings", JSON.stringify({ mode }));
    } catch (e) {
      // Non-fatal -- see loadPersisted note above.
    }
  }

  function isReduced() {
    if (mode === "full") return false;
    if (mode === "reduced") return true;
    return osReduced;
  }

  /** Mirrors isReduced() onto <html data-motion-reduced> so plain CSS
   *  (@keyframes-driven spinners etc., which JS never touches per-frame)
   *  can respect the SAME tri-state resolution canvas code reads via
   *  isReduced() -- not a raw `@media (prefers-reduced-motion: reduce)`
   *  query, which would only ever see the OS setting and ignore an
   *  explicit "full"/"reduced" override from the in-game control. This is
   *  the one place that queries document.documentElement -- everything
   *  else in this module is DOM-free. */
  function syncDomAttribute() {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.dataset.motionReduced = isReduced() ? "true" : "false";
  }

  function setMode(newMode) {
    if (newMode !== "auto" && newMode !== "full" && newMode !== "reduced") return;
    mode = newMode;
    persist();
    syncDomAttribute();
    for (const fn of listeners) fn(isReduced());
  }

  function getMode() {
    return mode;
  }

  /** Called once from bootstrap. Safe to call more than once (matchMedia
   *  listener is only ever attached the first time). */
  function init() {
    loadPersisted();
    if (mql) {
      syncDomAttribute();
      return;
    }
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      osReduced = mql.matches;
      const onChange = (e) => {
        osReduced = e.matches;
        syncDomAttribute();
        if (mode === "auto") for (const fn of listeners) fn(isReduced());
      };
      // addEventListener is the modern API; addListener is the Safari <14
      // fallback (same dual-path shape browsers commonly need for MediaQueryList).
      if (mql.addEventListener) mql.addEventListener("change", onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }
    syncDomAttribute();
  }

  /** Subscribe to reduced-motion state changes (OS toggle or explicit mode
   *  change). Returns nothing to unsubscribe with -- every current
   *  subscriber (clouds/villagers layers) lives for the whole session. */
  function onChangeSubscribe(fn) {
    listeners.push(fn);
  }

  window.UI.motion = { init, isReduced, getMode, setMode, onChange: onChangeSubscribe };
})();
