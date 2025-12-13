const { PlayerVehicle, Vehicle } = require('./database');
const { sendWithImage } = require('./message-handler');
const { startDriving } = require('./driving-handler');

const missions = {
  1: { // Chapter 1
    title: "Les Racines de Little Sicily",
    quests: {
      1: {
        title: "Un nouveau départ",
        objective: "Ton voyage commence ici, à Little Sicily. Pour te faire un nom, tu as besoin de roues, mais tu n'as pas un sou. Vole une voiture pour commencer à te déplacer.",
        reward: {
          xp: 100,
        },
        completionCondition: async (player) => {
          const vehicleCount = await PlayerVehicle.count({ where: { PlayerWhatsappId: player.whatsappId } });
          return vehicleCount > 0;
        },
        narrativeOnComplete: "Félicitations, tu as tes premières roues. La ville s'ouvre à toi, mais les dangers aussi. Ce vol a attiré l'attention du caïd local, qui a entendu parler de ton arrivée et veut te rencontrer. Va voir ce qu'il te veut.",
        nextQuest: 2,
      },
      2: {
        title: "Le message du Caïd",
        objective: "Rends-toi à la planque du caïd pour recevoir tes instructions.",
        reward: {
          xp: 50,
          money: 1000,
        },
        completionCondition: (player) => player.location === 'hideout',
        narrativeOnComplete: "Le caïd te jauge du regard. 'J'aime ton ambition,' dit-il. 'J'ai un petit boulot pour toi. Fais ça bien, et il y en aura d'autres.' Il te tend une liasse de billets.",
        nextQuest: 3,
      },
      3: {
        title: "Le sale boulot",
        objective: "Le caïd veut que tu sois équipé. Va à l'Ammu-Nation à Downtown et achète un pistolet.",
        reward: {
            xp: 75,
        },
        completionCondition: (player) => {
            const inventory = player.inventory;
            return inventory.some(item => item.name === 'Pistolet');
        },
        narrativeOnComplete: "Le poids de l'arme dans ta main est une sensation nouvelle. Tu es maintenant prêt pour le vrai travail.",
        nextQuest: 4,
      },
      4: {
        title: "Intimidation",
        objective: "Retourne à Little Sicily. Le caïd veut que tu 'rappelles' à un certain commerçant qui commande ici. Fais-lui peur.",
        reward: {
            xp: 100,
            money: 500,
        },
        completionCondition: (player) => {
            // Pour l'instant, la condition est simplement de retourner à Little Sicily.
            // Une future version pourrait impliquer une action de l'IA.
            return player.location === 'Little Sicily';
        },
        narrativeOnComplete: "Le commerçant a compris le message. Tu as prouvé ta loyauté et ta capacité à faire le sale boulot. Le caïd sera satisfait.",
        nextQuest: null, // Fin du chapitre pour l'instant
      },
    },
  },
};

function getMission(chapter, questId) {
  if (missions[chapter] && missions[chapter].quests[questId]) {
    return missions[chapter].quests[questId];
  }
  return null;
}

async function checkMissionCompletion(sock, player, message) {
    if (!player || !player.chapter || !player.quest || !message) { // Ensure message is present
        return;
    }

    const currentMission = getMission(player.chapter, player.quest);
    if (!currentMission || !currentMission.completionCondition) {
        return;
    }

    const isComplete = await currentMission.completionCondition(player);

    if (isComplete) {
        console.log(`Mission ${player.quest} du chapitre ${player.chapter} terminée pour le joueur ${player.name}.`);

        // Apply rewards
        player.money += currentMission.reward.money || 0;
        player.xp += currentMission.reward.xp || 0;

        // Advance to the next quest
        if (currentMission.nextQuest) {
            player.quest = currentMission.nextQuest;
        } else {
            player.chapter += 1; // Or handle game completion
            player.quest = 1; // Start of the next chapter
        }

        await player.save();

        // Notify the player
        await sendWithImage(sock, player.whatsappId, currentMission.narrativeOnComplete);

        if (player.chapter === 1 && player.quest === 2) { // The quest has been advanced to 2
            const playerVehicle = await PlayerVehicle.findOne({
                where: { PlayerWhatsappId: player.whatsappId },
                include: [{ model: Vehicle }]
            });

            if (playerVehicle) {
                console.log(`[DEBUG] Démarrage automatique du mini-jeu de conduite pour ${player.name}.`);
                await player.update({ mode: 'driving' });
                startDriving(sock, message, player, playerVehicle);
                return;
            }
        }

        const newMission = getMission(player.chapter, player.quest);
        if (newMission) {
            const newObjectiveText = `*Nouvel objectif:*\n${newMission.objective}`;
            await sendWithImage(sock, player.whatsappId, newObjectiveText);
        }
    }
}


module.exports = { getMission, checkMissionCompletion };
