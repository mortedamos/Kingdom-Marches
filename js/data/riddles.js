/**
 * RIDDLE DATA
 * -----------
 * Question/answer pairs for Halfellow's "Riddle" ability (see ai.js's
 * maybeRiddlePlay, "The Riddle Game" tech in techs.js). Purely cosmetic --
 * the actual resist/Befuddle roll is curiosity-based math, independent of
 * which riddle gets picked or whether its text is genuinely "hard." Kept
 * short, same "reads well in a bubble" guidance as js/data/quips.js.
 */

window.GameData = window.GameData || {};

window.GameData.RIDDLES = [
  { question: "What kind of room can you never enter?", answer: "A mushroom." },
  { question: "What has to be broken before you can use it?", answer: "An egg." },
  { question: "What has a neck but no head?", answer: "A bottle." },
  { question: "What gets wetter the more it dries?", answer: "A towel." },
  { question: "What has hands but cannot clap?", answer: "A clock." },
  { question: "What comes down but never goes up?", answer: "Rain." },
  { question: "What has one eye but cannot see?", answer: "A needle." },
  { question: "What has many teeth but cannot bite?", answer: "A comb." },
  { question: "What can you catch but never throw?", answer: "A cold." },
  { question: "What has a bed but never sleeps?", answer: "A river." },
];

/** No answer that "sounds smart" -- these are for the LOSING side, so they
 *  should read as genuinely stumped, not clever guesses. */
window.GameData.RIDDLE_STUMPED_RESPONSES = [
  "Uh...",
  "Uhhmm...",
  "...I don't know...",
  "Wait, what?",
  "...huh?",
  "Give me a second...",
];

window.GameData.getRandomRiddle = function () {
  const list = window.GameData.RIDDLES;
  return list[Math.floor(Math.random() * list.length)];
};

window.GameData.getRandomStumpedResponse = function () {
  const list = window.GameData.RIDDLE_STUMPED_RESPONSES;
  return list[Math.floor(Math.random() * list.length)];
};
