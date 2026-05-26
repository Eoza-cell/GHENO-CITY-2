const { sendWithImage } = require('./message-handler');

const missions = {
  1: { // Chapter 1: Le début de l'aventure
    title: "L'Héritage de Tortue Géniale",
    quests: {
      1: {
        title: "Le premier entraînement",
        objective: "Commence ton voyage en t'entraînant sur l'île de Tortue Géniale. Montre-lui ta détermination en faisant quelques pompes ou en méditant pour ressentir ton Ki.",
        reward: {
          xp: 100,
          zeni: 500,
        },
        completionCondition: async (player) => {
          return player.xp >= 100;
        },
        narrativeOnComplete: "Maître Roshi est impressionné par ton ardeur. 'Pas mal, petit ! Mais l'entraînement ne fait que commencer. Tu as besoin de plus d'énergie.'",
        nextQuest: 2,
      },
      2: {
        title: "La quête des Dragon Balls",
        objective: "Bulma a détecté une Dragon Ball à proximité. Elle se trouve dans le Désert de Yamcha. Va la chercher !",
        reward: {
          xp: 200,
          zeni: 1000,
        },
        completionCondition: (player) => player.location === 'Désert de Yamcha',
        narrativeOnComplete: "Tu as atteint le désert. La chaleur est étouffante, mais le signal du Dragon Radar est de plus en plus fort.",
        nextQuest: 3,
      },
      3: {
        title: "Le voleur du désert",
        objective: "Un bandit nommé Yamcha semble garder la Dragon Ball. Récupère-la, par la force ou par la ruse.",
        reward: {
            xp: 500,
        },
        completionCondition: (player) => {
            const inventory = player.inventory;
            return inventory.some(item => item.name === 'Dragon Ball');
        },
        narrativeOnComplete: "Tu as récupéré la Dragon Ball ! Son éclat orange est magnifique avec ses quatre petites étoiles rouges.",
        nextQuest: 4,
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
        const zeni = (player.zeni || 0) + (currentMission.reward.zeni || 0);
        const xp = (player.xp || 0) + (currentMission.reward.xp || 0);

        // Advance to the next quest
        let nextQuest = player.quest;
        let nextChapter = player.chapter;
        if (currentMission.nextQuest) {
            nextQuest = currentMission.nextQuest;
        } else {
            nextChapter += 1;
            nextQuest = 1;
        }

        await player.update({
            zeni: zeni,
            xp: xp,
            quest: nextQuest,
            chapter: nextChapter
        });

        // Notify the player
        await sendWithImage(sock, player.whatsappId, { narrative: currentMission.narrativeOnComplete });

        const newMission = getMission(player.chapter, player.quest);
        if (newMission) {
            const newObjectiveText = `*Nouvel objectif:*\n${newMission.objective}`;
            await sendWithImage(sock, player.whatsappId, { narrative: newObjectiveText });
        }
    }
}


module.exports = { getMission, checkMissionCompletion };
