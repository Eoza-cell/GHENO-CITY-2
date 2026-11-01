'use strict';

// ATR rank ladder. Δ is the unawakened state, not a conventional awakened rank.
const RANKS = ['∆','F','E','D','C','B','A-','A','A+','S-','S','S+','SS','SSS','EX'];
const RANK_POWER = {
  '∆': 8, F: 18, E: 32, D: 52, C: 82, B: 125,
  'A-': 185, A: 225, 'A+': 275, 'S-': 350, S: 440,
  'S+': 560, SS: 760, SSS: 1100, EX: 1700
};
const STAT_CAPS = {
  '∆': 25, F: 50, E: 100, D: 150, C: 250, B: 400,
  'A-': 500, A: 600, 'A+': 750, 'S-': 900, S: 1100,
  'S+': 1400, SS: 1800, SSS: 2400, EX: 5000
};

function normalizeRank(rank) {
  const raw = String(rank || '∆').trim().toUpperCase();
  if (raw === 'Δ' || raw === 'NON ÉVEILLÉ' || raw === 'NON EVEILLE' || raw === 'UNAWAKENED') return '∆';
  return RANKS.includes(raw) ? raw : '∆';
}

function rankIndex(rank) { return RANKS.indexOf(normalizeRank(rank)); }

function statPower(entity = {}) {
  const str = Math.max(0, Number(entity.strength) || 0);
  const agi = Math.max(0, Number(entity.agility) || 0);
  const intel = Math.max(0, Number(entity.intelligence) || 0);
  const def = Math.max(0, Number(entity.defense) || 0);
  const luck = Math.max(0, Number(entity.luck) || 0);
  // Physical, magical, defensive and tactical stats all matter; no single dump stat wins.
  return str * 0.27 + agi * 0.25 + intel * 0.23 + def * 0.18 + luck * 0.07;
}

function evaluateCombatant(entity = {}) {
  const rank = normalizeRank(entity.rank);
  const base = RANK_POWER[rank];
  const stats = statPower(entity);
  const vitality = Math.max(0, Number(entity.health) || 0);
  const maxVitality = Math.max(1, Number(entity.maxHealth) || vitality || 1);
  const staminaRatio = Math.max(0, Math.min(1, vitality / maxVitality));
  const raw = base + stats * 0.42;
  const effective = raw * (0.72 + staminaRatio * 0.28);
  return {
    rank, rankIndex: rankIndex(rank), base: Math.round(base),
    statPower: Math.round(stats), effectivePower: Math.round(effective),
    vitalityRatio: Math.round(staminaRatio * 100)
  };
}

function assessTactics(actionText = '', entity = {}) {
  const text = String(actionText).toLowerCase();
  const hasPlan = /(feinte|leurre|diversion|pi[eè]ge|terrain|angle mort|contre.?attaque|anticip|observer|analyser|rep[eé]rer|fatiguer|immobiliser|désarmer|desarmer|environnement|strat[eé]gie|plan|coordonn|surprise|furtif|camouf|distance|port[eé]e|faiblesse)/i.test(text);
  const hasConcreteMethod = /(en utilisant|profite de|attend que|lorsqu'il|quand il|pour le forcer|afin de|de sorte [àa]|puis |ensuite |d'abord)/i.test(text);
  const tacticalStat = Math.max(0, Number(entity.intelligence) || 0) * 0.12
    + Math.max(0, Number(entity.agility) || 0) * 0.08
    + Math.max(0, Number(entity.luck) || 0) * 0.04;
  const bonus = hasPlan ? Math.min(22, 8 + tacticalStat * 0.12 + (hasConcreteMethod ? 6 : 0)) : 0;
  return { hasPlan, hasConcreteMethod, bonus: Math.round(bonus) };
}

function compareCombatants(actor = {}, opponent = {}, actionText = '') {
  const a = evaluateCombatant(actor);
  const b = evaluateCombatant(opponent);
  const tactics = assessTactics(actionText, actor);
  const effectiveActor = a.effectivePower * (1 + tactics.bonus / 100);
  const ratio = effectiveActor / Math.max(1, b.effectivePower);
  const rankGap = b.rankIndex - a.rankIndex;
  let outlook;
  if (ratio >= 1.2) outlook = 'avantage net du joueur';
  else if (ratio >= 0.92) outlook = 'combat équilibré ou avantage tactique possible';
  else if (ratio >= 0.68) outlook = 'désavantage réel, victoire possible avec plan crédible et exécution';
  else if (ratio >= 0.42) outlook = 'fort désavantage, victoire exceptionnelle exigeant une faille majeure, préparation et coût';
  else outlook = 'écart écrasant : victoire directe non crédible sans circonstance exceptionnelle majeure';
  return {
    actor: a, opponent: b, tactics, rankGap,
    ratio: Number(ratio.toFixed(2)), outlook,
    canOutplay: ratio >= 0.42 && (tactics.hasPlan || a.statPower >= b.statPower * 1.35)
  };
}

function formatCombatRules(entity, opponent, actionText = '') {
  const c = compareCombatants(entity, opponent, actionText);
  return [
    'ÉVALUATION DE PUISSANCE ATR (référence mécanique, pas résultat automatique)',
    'Joueur: rang ' + c.actor.rank + ', puissance effective ' + c.actor.effectivePower + ', stats pondérées ' + c.actor.statPower,
    'Adversaire: rang ' + c.opponent.rank + ', puissance effective ' + c.opponent.effectivePower + ', stats pondérées ' + c.opponent.statPower,
    'Écart de rang: ' + (c.rankGap > 0 ? '+' : '') + c.rankGap + ' palier(s) en faveur de l’adversaire si positif.',
    'Avantage tactique détecté: ' + c.tactics.bonus + '%. Diagnostic: ' + c.outlook + '.',
    'RÈGLES: un rang supérieur donne un avantage réel, jamais une victoire automatique. Évalue FOR/AGI/INT/DEF/LUK, PV restants, compétences, équipement, expérience, terrain, portée, surprise, fatigue, blessures et objectifs.',
    'Une ruse précise, une faiblesse exploitée, une préparation crédible ou des statistiques exceptionnelles peuvent permettre à un rang inférieur, même ∆ non-éveillé, de battre un A-/A/A+ dans des circonstances cohérentes.',
    'La ruse ne donne pas de bonus magique si le plan est vague ou impossible. Une tactique réussie doit créer un avantage concret (position, timing, neutralisation, piège, protection, fuite ou objectif alternatif).',
    'Ne transforme pas un écart immense en victoire facile: exige plusieurs conditions favorables, fais payer le risque et conserve des conséquences. Un adversaire supérieur peut aussi apprendre, s’adapter et contrer.',
    'Ne confonds jamais rang et niveau. Le rang mesure le potentiel/éveil global; les statistiques et l’état réel déterminent la performance du moment.',
    'Le rang ∆ signifie NON ÉVEILLÉ: absence d’éveil reconnu, pas absence de potentiel, de talent, de technique ou de possibilité de victoire.'
  ].join('\\n');
}

module.exports = { RANKS, RANK_POWER, STAT_CAPS, normalizeRank, rankIndex, statPower, evaluateCombatant, assessTactics, compareCombatants, formatCombatRules };
