const { PlayerVehicle } = require('./database');
const { sendWithImage } = require('./message-handler');

const missions = {
  1: { // Chapter 1
    title: "Les Racines de Little Sicily",
    quests: {
      1: {
        title: "Un nouveau départ",
        objective: "Ton voyage commence ici, à Little Sicily. Pour te déplacer en ville et commencer à te faire un nom, tu as besoin de roues. Rends-toi chez le concessionnaire et trouve un moyen d'acquérir ton premier véhicule.",
        reward: {
          xp: 100,
        },
        // Condition: Le joueur doit posséder au moins un véhicule.
        completionCondition: async (player) => {
          const vehicleCount = await PlayerVehicle.count({ where: { PlayerWhatsappId: player.whatsappId } });
          return vehicleCount > 0;
        },
        narrativeOnComplete: "Félicitations, tu as tes premières roues. La ville s'ouvre à toi, mais les dangers aussi. Ton nom commence à circuler dans le quartier. Le caïd local a entendu parler de ton arrivée et veut te rencontrer. Va voir ce qu'il te veut.",
        nextQuest: 2,
      },
      2: {
        title: "Le message du Caïd",
        objective: "Rends-toi à la planque du caïd pour recevoir tes instructions.",
        reward: {
          xp: 50,
          money: 1000,
        },
        // Condition: Le joueur doit être à l'emplacement 'hideout'.
        completionCondition: (player) => {
            return player.location === 'hideout';
        },
        narrativeOnComplete: "Le caïd te jauge du regard. 'J'aime ton ambition,' dit-il. 'J'ai un petit boulot pour toi. Fais ça bien, et il y en aura d'autres.' Il te tend une liasse de billets.",
        nextQuest: null, // End of chapter for now
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

async function checkMissionCompletion(sock, player) {
    if (!player || !player.chapter || !player.quest) {
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

        // Display the new objective
        const newMission = getMission(player.chapter, player.quest);
        if (newMission) {
            const newObjectiveText = `*Nouvel objectif:*\n${newMission.objective}`;
            await sendWithImage(sock, player.whatsappId, newObjectiveText);
        }
    }
}


module.exports = { getMission, checkMissionCompletion };
