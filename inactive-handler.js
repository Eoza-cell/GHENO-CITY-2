const { Player } = require('./database');
const { Op } = require('sequelize');

const INACTIVITY_THRESHOLD_MINUTES = 5;
const MESSAGE_COOLDOWN_MINUTES = 10;

const inactiveEvents = [
  { text: "Un PNJ costaud passe en courant : 'Hé, toi ! T'as l'air d'un dur, on se boit un verre plus tard ?' Il te salue d'un signe de tête et disparaît dans la ruelle." },
  { text: "La circulation s'intensifie. Une voiture noire ralentit près de toi. Le passager te fixe : 'Besoin d'un lift, frangin ?' Elle accélère sans attendre." },
  { text: "Un policier patrouille. Il te salue : 'Tout va bien, citoyen ?' et continue sa ronde." },
  { text: "Un sac d'argent tombe d'un camion – le ramasser ? Réponds /grab pour le prendre !", event: 'MONEY_BAG' },
  { text: "Le soleil commence à se coucher, projetant de longues ombres sur les rues de Gheno City. Les néons des bars commencent à s'allumer." },
  { text: "Un groupe de jeunes du quartier te dévisage en passant. L'un d'eux marmonne : 'C'est ton territoire, ça ? Prouve-le.'" },
];

async function handleInactivePlayers(sock) {
  const fiveMinutesAgo = new Date(Date.now() - INACTIVITY_THRESHOLD_MINUTES * 60 * 1000);
  const tenMinutesAgo = new Date(Date.now() - MESSAGE_COOLDOWN_MINUTES * 60 * 1000);

  try {
    const inactivePlayers = await Player.findAll({
      where: {
        lastActivity: {
          [Op.lt]: fiveMinutesAgo,
        },
        [Op.or]: [
          { lastInactiveMessageSentAt: { [Op.eq]: null } },
          { lastInactiveMessageSentAt: { [Op.lt]: tenMinutesAgo } },
        ],
      },
    });

    for (const player of inactivePlayers) {
      const randomEvent = inactiveEvents[Math.floor(Math.random() * inactiveEvents.length)];

      await sock.sendMessage(player.whatsappId, { text: randomEvent.text });

      const updates = { lastInactiveMessageSentAt: new Date() };
      if (randomEvent.event === 'MONEY_BAG') {
        updates.hasMoneyBag = true;
      }
      await player.update(updates);
    }
  } catch (error) {
    console.error('Error handling inactive players:', error);
  }
}

function startInactivePlayerHandler(sock) {
  setInterval(() => {
    handleInactivePlayers(sock);
  }, 60 * 1000); // Check every minute
}

module.exports = { startInactivePlayerHandler };
