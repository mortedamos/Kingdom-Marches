/**
 * BUILD INFO
 * ----------
 * Shown under the Start Game button (see main.js's renderLaunchOptions) --
 * a quick, at-a-glance "which copy of the game am I looking at" for anyone
 * juggling multiple browser tabs/deployments, or reporting a bug.
 *
 * There is no build pipeline for this project (no bundler, no CI step) --
 * it's plain script tags loaded straight from disk -- so nothing regenerates
 * this automatically. BUMP IT BY HAND whenever you want the displayed build
 * to reflect a newer state:
 *   - date/time: when this edit was made
 *   - number: one higher than the last value here (or your own scheme --
 *     nothing else in the codebase reads this number, so change what it
 *     means freely)
 */

window.GameData = window.GameData || {};

window.GameData.BUILD_INFO = {
  date: "2026-08-04",
  time: "20:39",
  number: 47,
};
