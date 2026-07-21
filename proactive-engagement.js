/**
 * Proactive Inactive Player Engagement System
 *
 * Periodically scans the database for registered players who have been inactive
 * (no recent actions or commands) and dispatches a highly contextual, personalized
 * narrative event hook to re-engage them.
 */

const { Op } = require('sequelize');
const { Player, WorldJournal, RPMessage } = require('./database');
const { callAI } = require('./ai-utils');
const { getRPTime, getWorldHeader } = require('./world-clock');

// 12 hours of real-world inactivity to trigger a proactive hook
const INACTIVITY_TRIGGER_MS = 12 * 60 * 60 * 1000;

// Cool-down to prevent spamming proactive events (at least 24 hours between hooks)
const MIN_INTERVAL_BETWEEN_HOOKS_MS = 24 * 60 * 60 * 1000;

/**
 * Periodically scans players and proactively sends immersive plot hooks to inactive players.
 * @param {any} sock Baileys WhatsApp socket
 */
function startProactiveAIEngagement(sock) {
  console.log('[PROACTIVE AI] Starting proactive background check loop (every 30 minutes)...');

  // Run the check every 30 minutes
  setInterval(async () => {
    try {
      await checkAndTriggerProactiveHooks(sock);
    } catch (err) {
      console.error('[PROACTIVE AI] Error in background check loop:', err);
    }
  }, 30 * 60 * 1000);
}

/**
 * Evaluates inactive players and dispatches a localized narrative hook
 */
async function checkAndTriggerProactiveHooks(sock) {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - INACTIVITY_TRIGGER_MS);
  const cooldownCutoff = new Date(now.getTime() - MIN_INTERVAL_BETWEEN_HOOKS_MS);

  console.log(`[PROACTIVE AI] Checking for players inactive since ${cutoffTime.toISOString()}...`);

  const inactivePlayers = await Player.findAll({
    where: {
      // Must be fully registered
      registrationStep: null,
      awaitingProfilePic: false,
      // Inactive for at least 12 hours
      lastActivity: { [Op.lt]: cutoffTime },
      // Prevent double notifications or fast repeats
      [Op.or]: [
        { lastInactiveMessageSentAt: null },
        { lastInactiveMessageSentAt: { [Op.lt]: cooldownCutoff } }
      ]
    }
  });

  if (inactivePlayers.length === 0) {
    console.log('[PROACTIVE AI] No inactive players meet the trigger criteria.');
    return;
  }

  console.log(`[PROACTIVE AI] Found ${inactivePlayers.length} inactive players to engage.`);

  for (const player of inactivePlayers) {
    try {
      console.log(`[PROACTIVE AI] Generating personalized proactive narrative hook for ${player.name}...`);

      // Fetch latest 3 events from World Journal touching this player or their location
      const localEvents = await WorldJournal.findAll({
        where: {
          [Op.or]: [
            { entry: { [Op.like]: `%${player.name}%` } },
            { entry: { [Op.like]: `%${player.location}%` } }
          ]
        },
        limit: 3,
        order: [['id', 'DESC']]
      });

      const eventContext = localEvents.length > 0
        ? localEvents.map(e => `- ${e.entry}`).join('\n')
        : "- Le calme règne en apparence, mais une tension souterraine grandit.";

      const timeHeader = getWorldHeader();

      const systemPrompt = `MJ D'AETHERYS (INTERACTION PROACTIVE)
Tu es le Maître du Jeu d'un RPG littéraire Seinen sombre et viscéral.
Ton but est de réveiller un joueur inactif avec un événement surprise d'un seul paragraphe puissant, mystérieux et intrigant.
Cet événement doit se passer exactement là où il dort, se repose ou se trouve (${player.location} - ${player.subLocation}).

NARRATION DIRECTE :
- Écris UNIQUEMENT le paragraphe de narration. Pas d'introduction, pas de questions hors RP.
- Ton style doit être sombre, sensoriel (les bruits de pas, les courants d'air froid, une dague qui glisse, un corbeau qui s'écrase).
- L'événement doit inciter le joueur à réagir (quelqu'un frappe à sa porte de manière frénétique, un messager blessé s'effondre devant lui, un murmure magique résonne à son oreille, etc.).
- NE RETOURNE JAMAIS DE JSON.`;

      const prompt = `Génère un événement surprise et immersif pour réengager ce joueur :
Nom : ${player.name}
Lieu : ${player.location} (${player.subLocation})
Classe : ${player.class} (Rang ${player.rank})
Stats actuelles : HP ${player.health}/${player.maxHealth} | MP ${player.mana}/${player.maxMana}

Événements récents ou rumeurs proches :
${eventContext}

Rédige un seul paragraphe immersif et sensoriel d'action ou d'ambiance se terminant par une invitation implicite à agir.`;

      let narrative = await callAI(systemPrompt, prompt, { jsonMode: false });
      if (!narrative) continue;

      // Ensure the narration starts with a beautiful title block
      const fullMessage = `🔔 *ÉVÉNEMENT SURPRISE* 🔔\n${timeHeader}\n\n${narrative.trim()}`;

      // Dispatch directly via WhatsApp
      console.log(`[PROACTIVE AI] Dispatching re-engagement hook to ${player.name} (${player.whatsappId})`);
      await sock.sendMessage(player.whatsappId, { text: fullMessage });

      // Update timestamps
      await player.update({
        lastInactiveMessageSentAt: now
      });

      // Log the proactive message in the RP logs
      await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Arise MJ',
        content: `[PROACTIVE HOOK] ${narrative.trim()}`,
        location: player.location,
        subLocation: player.subLocation
      });

      console.log(`[PROACTIVE AI] Successfully engaged ${player.name}!`);
    } catch (pErr) {
      console.error(`[PROACTIVE AI] Error engaging player ${player.name}:`, pErr);
    }
  }
}

module.exports = { startProactiveAIEngagement, checkAndTriggerProactiveHooks };
