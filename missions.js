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
        title: "Livraison Spéciale",
        objective: "Apporte le pistolet que tu as acheté à la planque du caïd. C'est un test de confiance.",
        reward: {
            xp: 150,
        },
        completionCondition: (player) => {
            const hasPistol = player.inventory.some(item => item.name === 'Pistolet');
            const atHideout = player.location === 'hideout';
            return hasPistol && atHideout;
        },
        narrativeOnComplete: "Le caïd prend le pistolet et l'inspecte. 'Bien,' dit-il simplement. 'Tu es fiable. Maintenant, montre-moi que tu sais faire de l'argent.'",
        nextQuest: 5,
      },
      5: {
        title: "Le Droit d'Entrée",
        objective: "Le respect se gagne, mais il s'achète aussi. Prouve ta valeur en accumulant 2000$.",
        reward: {
            xp: 200,
        },
        completionCondition: (player) => {
            return player.money >= 2000;
        },
        narrativeOnComplete: "Tu as l'argent. Tu as prouvé que tu savais te débrouiller en ville. Tu as officiellement ta place dans l'organisation.",
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

        // Special case for the delivery quest: remove the pistol from inventory
        if (player.chapter === 1 && player.quest === 4) {
            player.inventory = player.inventory.filter(item => item.name !== 'Pistolet');
        }


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

        if (player.chapter === 1 && player.quest === 2) {
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
