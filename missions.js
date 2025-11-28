const missions = {
  1: { // Chapter 1
    title: "Les Racines de Little Sicily",
    quests: {
      1: {
        title: "Faire ses preuves",
        objective: "Tu viens de débarquer en ville et tu n'as pas un sou. Pour te faire un nom, tu dois montrer que tu n'as pas froid aux yeux. Trouve un moyen de voler une voiture dans le quartier.",
        reward: {
          money: 500,
          xp: 100,
        },
        nextQuest: 2,
      },
      2: {
        title: "Le message du Caïd",
        objective: "Le bruit de tes exploits est parvenu aux oreilles du caïd local. Il veut te voir. Rends-toi à sa planque pour recevoir tes instructions.",
        reward: {
          xp: 50,
        },
        nextQuest: null, // End of chapter for now
      },
    },
  },
  // D'autres chapitres peuvent être ajoutés ici
};

function getMission(chapter, questId) {
  if (missions[chapter] && missions[chapter].quests[questId]) {
    return missions[chapter].quests[questId];
  }
  return null;
}

module.exports = { getMission };
