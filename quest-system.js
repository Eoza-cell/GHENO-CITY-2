const { Quest, PlayerQuest, Player, NPCRelationship, sequelize } = require('./database');
const { Op } = require('sequelize');

// Mandatory 10-Chapter Main Storyline
const MANDATORY_MAIN_QUESTS = [
    {
        title: "Ch.1 : L'Éveil à Eldoria",
        description: "Tu t'éveilles dans la cité d'Eldoria. Ton essence spirituelle s'est stabilisée, mais l'Ordre exige que tu te présentes au Capitaine de la Milice.",
        objective: "Présente-toi au Capitaine de la Milice à Eldoria et prouve la maîtrise de ta classe.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 1,
        nextQuestTitle: "Ch.2 : La Menace des Béhérits",
        rank_required: "F",
        reward_col: 500,
        reward_xp: 300,
        unlockedRegion: "Empire Impérial d'Elion"
    },
    {
        title: "Ch.2 : La Menace des Béhérits",
        description: "Des créatures corrompues menacent les routes commerciales. Un fragment de Béhérit rouge a été repéré.",
        objective: "Élimine le chef des pillards et récupère le fragment de Béhérit rouge.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 2,
        nextQuestTitle: "Ch.3 : L'Ombre de Gheno",
        rank_required: "F",
        reward_col: 1000,
        reward_xp: 600,
        unlockedRegion: "Royaume de Valkyrr"
    },
    {
        title: "Ch.3 : L'Ombre de Gheno",
        description: "Les pistes mènent aux bas-fonds criminels de Gheno. Le Syndicat de l'Ombre dissimule une relique ancienne.",
        objective: "Infiltre le Marché Noir de Gheno et obtiens la clé du Compas d'Or.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 3,
        nextQuestTitle: "Ch.4 : L'Épreuve de l'Académie",
        rank_required: "E",
        reward_col: 2000,
        reward_xp: 1200,
        unlockedRegion: "Gheno souterrain"
    },
    {
        title: "Ch.4 : L'Épreuve de l'Académie",
        description: "Pour prétendre affronter les Apôtres, tu dois passer l'Épreuve du Mana à l'Académie Impériale.",
        objective: "Rejoins l'Académie Impériale et réussis l'examen d'Escrime de Mana devant le Directeur Magnus.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 4,
        nextQuestTitle: "Ch.5 : Le Sceau de l'Interstice",
        rank_required: "D",
        reward_col: 4000,
        reward_xp: 2500,
        unlockedRegion: "Forêt de l'Éveil"
    },
    {
        title: "Ch.5 : Le Sceau de l'Interstice",
        description: "Une faille dimensionnelle s'ouvre. Les morts marchent à la frontière de l'Interstice.",
        objective: "Escorte le Directeur Magnus et scelle la faille dimensionnelle de l'Interstice.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 5,
        nextQuestTitle: "Ch.6 : La Confrontation avec Griffith",
        rank_required: "C",
        reward_col: 8000,
        reward_xp: 5000,
        unlockedRegion: "Interstice"
    },
    {
        title: "Ch.6 : La Confrontation avec Griffith",
        description: "Griffith, le Chef des Apôtres, rassemble les armées démoniaques au sommet de la Tour de la Main.",
        objective: "Ascends la Tour de la Main et affronte l'Apôtre Griffith.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 6,
        nextQuestTitle: "Ch.7 : Le Jugement des Âmes",
        rank_required: "B",
        reward_col: 15000,
        reward_xp: 10000,
        unlockedRegion: "Nécropolis"
    },
    {
        title: "Ch.7 : Le Jugement des Âmes",
        description: "Ton âme doit être purifiée et pesée devant le Juge Orpheon à Nécropolis.",
        objective: "Présente-toi au Trône du Jugement à Nécropolis et soumets ton essence au Juge Orpheon.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 7,
        nextQuestTitle: "Ch.8 : Le Secret de l'Idée du Mal",
        rank_required: "A",
        reward_col: 30000,
        reward_xp: 20000,
        unlockedRegion: "Abysse Inférieur"
    },
    {
        title: "Ch.8 : Le Secret de l'Idée du Mal",
        description: "Découvre la source du désespoir des mortels scellée dans le Miroir Déformé.",
        objective: "Pénètre dans le Miroir Déformé et confronte le Héraut Void.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 8,
        nextQuestTitle: "Ch.9 : La Révolution de la Renaissance",
        rank_required: "A",
        reward_col: 60000,
        reward_xp: 40000,
        unlockedRegion: "Royaume Céleste"
    },
    {
        title: "Ch.9 : La Révolution de la Renaissance",
        description: "Rassemble les dirigeants des 17 Royaumes d'ATR pour l'ultime bataille contre l'Éclipse.",
        objective: "Obtiens le ralliement de l'Empereur Valerius II et déclenche la mobilisation générale.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 9,
        nextQuestTitle: "Ch.10 : L'Apothéose de Caelum",
        rank_required: "S",
        reward_col: 100000,
        reward_xp: 80000,
        unlockedRegion: "Origine de l'Existence"
    },
    {
        title: "Ch.10 : L'Apothéose de Caelum",
        description: "L'ultime chapitre de la Causalité. Brise le cycle de la Renaissance et affronte l'Entité Primordiale.",
        objective: "Défie l'Entité Primordiale au Zénith Absolu et accomplis ton destin ultime.",
        type: "main_mandatory",
        chain: "La Renaissance de la Causalité",
        step: 10,
        nextQuestTitle: null,
        rank_required: "S",
        reward_col: 250000,
        reward_xp: 200000,
        unlockedRegion: "Caelum Universel"
    }
];

/**
 * Initializes and assigns the active mandatory main quest to a player if missing.
 * @param {Object} player Sequelize Player instance
 * @returns {Promise<Object>} Active main quest object
 */
async function getOrAssignMandatoryMainQuest(player) {
    // Seed main quests in database if needed
    for (const qData of MANDATORY_MAIN_QUESTS) {
        const { unlockedRegion, ...dbFields } = qData;
        await Quest.findOrCreate({
            where: { title: qData.title },
            defaults: dbFields
        });
    }

    // Check existing in-progress mandatory main quest
    const playerQuests = await PlayerQuest.findAll({
        where: { PlayerWhatsappId: player.whatsappId }
    });

    const activeMainPq = playerQuests.find(pq => pq.status === 'in_progress' || pq.status === 'active');
    if (activeMainPq) {
        const quest = await Quest.findByPk(activeMainPq.QuestId);
        if (quest && quest.type === 'main_mandatory') {
            return { quest, playerQuest: activeMainPq };
        }
    }

    // Find the next uncompleted mandatory chapter for the player
    const completedQuestIds = playerQuests.filter(pq => pq.status === 'completed').map(pq => pq.QuestId);

    let targetMainQuest = null;
    for (const qData of MANDATORY_MAIN_QUESTS) {
        const qRecord = await Quest.findOne({ where: { title: qData.title } });
        if (qRecord && !completedQuestIds.includes(qRecord.id)) {
            targetMainQuest = qRecord;
            break;
        }
    }

    if (!targetMainQuest) {
        // Fallback to Chapter 1
        targetMainQuest = await Quest.findOne({ where: { title: MANDATORY_MAIN_QUESTS[0].title } });
    }

    // Assign the mandatory quest using direct PlayerQuest creation
    let pq = await PlayerQuest.findOne({
        where: { PlayerWhatsappId: player.whatsappId, QuestId: targetMainQuest.id }
    });
    if (!pq) {
        try {
            pq = await PlayerQuest.create({
                PlayerWhatsappId: player.whatsappId,
                QuestId: targetMainQuest.id,
                status: 'in_progress',
                progress: 0
            });
        } catch (e) {
            pq = await PlayerQuest.findOne({
                where: { PlayerWhatsappId: player.whatsappId }
            });
        }
    } else if (pq && pq.status !== 'in_progress') {
        await pq.update({ status: 'in_progress' });
    }

    return { quest: targetMainQuest, playerQuest: pq };
}

/**
 * Checks if a player is authorized to travel to a target region based on mandatory quest progression.
 * @param {Object} player Sequelize Player
 * @param {string} targetLocation Target region name
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
async function verifyRegionAccess(player, targetLocation) {
    // Mandate removed: Players are completely free to travel to any region without mandatory quest restrictions.
    return { allowed: true, reason: "" };
}

async function getNPCRelationship(playerWhatsappId, npcId, npcName = '') {
    const numericNpcId = typeof npcId === 'number' ? npcId : (parseInt(npcId, 10) || 1);
    let rel = await NPCRelationship.findOne({
        where: { PlayerWhatsappId: playerWhatsappId, NPCId: numericNpcId }
    });
    if (!rel) {
        rel = await NPCRelationship.create({
            PlayerWhatsappId: playerWhatsappId,
            NPCId: numericNpcId,
            trust: 50,
            respect: 50,
            fear: 0,
            reputation: 50
        });
    }
    return rel;
}

async function updateNPCRelationship(playerWhatsappId, npcId, npcName, changes = {}) {
    const rel = await getNPCRelationship(playerWhatsappId, npcId, npcName);
    const newTrust = Math.min(100, Math.max(0, rel.trust + (changes.trust || 0)));
    const newRespect = Math.min(100, Math.max(0, rel.respect + (changes.respect || 0)));
    const newFear = Math.min(100, Math.max(0, rel.fear + (changes.fear || 0)));
    const newReputation = Math.min(100, Math.max(0, rel.reputation + (changes.reputation || 0)));

    await rel.update({
        trust: newTrust,
        respect: newRespect,
        fear: newFear,
        reputation: newReputation
    });
    return rel;
}

module.exports = {
    MANDATORY_MAIN_QUESTS,
    getOrAssignMandatoryMainQuest,
    verifyRegionAccess,
    getNPCRelationship,
    updateNPCRelationship
};
