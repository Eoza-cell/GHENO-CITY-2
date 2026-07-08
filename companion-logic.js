/**
 * companion-logic.js
 * Adapted from My Girl - Chloe (nation.js)
 * Implements the Seven Nations logic for the companion AI.
 */

const NATIONS = [
  { id: 'heart',      purpose: 'Make sure she sounds like she cares.',            lean: { warm: 1.0, clear: 0.3 } },
  { id: 'reason',     purpose: 'Keep it clear, honest, and easy to follow.',      lean: { clear: 1.0, calm: 0.4 } },
  { id: 'memory',     purpose: 'Keep her consistent with what she knows of you.', lean: { warm: 0.5, clear: 0.5 } },
  { id: 'instinct',   purpose: 'Flag anything that feels off, unsafe, or false.', lean: { calm: 1.0, clear: 0.3 } },
  { id: 'voice',      purpose: 'Keep her voice distinct and natural.',            lean: { play: 1.0, warm: 0.3 } },
  { id: 'conscience', purpose: 'Protect your wellbeing, above all.',              lean: { warm: 0.7, calm: 0.6 } },
  { id: 'play',       purpose: 'Keep it alive, curious, and human.',              lean: { open: 1.0, play: 0.5 } }
];

const CUES = {
  warmth:   /\b(care|love|here|with you|thank|thanks|glad|sorry|okay|proud|hug|miss you|appreciate|merci|t'aime|adore|contant|désolé|ça va|fier|câlin|manque|apprécie)\b/gi,
  distress: /\b(sad|hurt|alone|lonely|scared|afraid|anxious|tired|exhausted|can'?t|hate|awful|cry|crying|lost|empty|worthless|hopeless|triste|mal|seul|peur|effrayé|anxieux|fatigué|épuisé|peux pas|déteste|horrible|pleure|perdu|vide)\b/gi,
  humor:    /\b(lol|lmao|haha+|hah|funny|joke|kidding|teasing|silly|drôle|blague|plaisante|idiot|amusant)\b|:\)|:d|\bxd\b/gi,
  anger:    /\b(angry|mad|furious|stupid|shut up|annoying|annoyed|hell|damn|ugh|colère|fâché|furieux|stupide|tais-toi|chiant|éervé|merde|punaise)\b/gi
};

const TEMPER = {
  heart:      { warmth: 1.0, distress: -0.6, anger: -0.4, humor: 0.2 },
  reason:     { question: 0.8, anger: -0.3, distress: -0.1 },
  memory:     { warmth: 0.4, distress: 0.3 },
  instinct:   { anger: -1.0, distress: -0.7 },
  voice:      { humor: 0.6, warmth: 0.3 },
  conscience: { distress: -1.0, anger: -0.5, warmth: 0.4 },
  play:       { humor: 1.0, anger: -0.4, distress: -0.3 }
};

const INTENT = { heart: 'comfort', reason: 'ground', memory: 'recall', instinct: 'caution', voice: 'express', conscience: 'protect', play: 'play' };

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clamp11(x) { return x < -1 ? -1 : x > 1 ? 1 : x; }

function readCues(text) {
  const t = String(text || '');
  function count(re) { const m = t.match(re); return m ? m.length : 0; }
  return {
    warmth: count(CUES.warmth),
    distress: count(CUES.distress),
    humor: count(CUES.humor) + (/!/.test(t) ? 0.4 : 0),
    anger: count(CUES.anger),
    question: /\?/.test(t) ? 1 : 0,
    len: t.trim().length
  };
}

/**
 * Updates the companion's mood and sentiment based on the user's message.
 */
function updateState(currentState, userMessage) {
  const cues = readCues(userMessage);

  // Calculate valence of the message
  const v = (cues.warmth + cues.humor - cues.distress - cues.anger) * 0.15;

  // Update sentiment (overall bond)
  const newSentiment = clamp11(currentState.sentiment * 0.7 + v);

  // Update mood
  // Each nation has its own mood in the original, here we'll simplify to a global companion mood
  // influenced by the "average" temperament.
  let totalTemper = 0;
  for (const tid in TEMPER) {
    const t = TEMPER[tid];
    for (const k in t) {
      totalTemper += t[k] * (cues[k] || 0);
    }
  }
  const avgTemper = totalTemper / NATIONS.length;
  const newMood = clamp01(currentState.mood * 0.8 + (0.5 + avgTemper * 0.1) * 0.2);

  return {
    sentiment: newSentiment,
    mood: newMood
  };
}

/**
 * Deliberates the best intent for the companion.
 * In our case, we'll use it to provide "hints" to the AI.
 */
function deliberateIntent(state) {
  const scores = NATIONS.map(n => {
    const temper = TEMPER[n.id] || {};
    // Strength is influenced by mood and how much the nation "cares" about the current state
    // For now, we'll use a simpler version
    const strength = clamp01(0.3 + state.mood * 0.3 + Math.abs(state.sentiment) * 0.2);
    return { id: n.id, kind: INTENT[n.id], strength };
  });

  // Sort by strength and pick the top one
  scores.sort((a, b) => b.strength - a.strength);
  return scores[0];
}

module.exports = {
  updateState,
  deliberateIntent,
  readCues,
  NATIONS
};
