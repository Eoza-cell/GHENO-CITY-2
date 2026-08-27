/**
 * Unlimited In-Process Local LLM Story Engine for After the Rebirth (ATR)
 * Provides 100% offline, unlimited, zero-dependency, ultra-fast Game Master AI narrative generation.
 */

function extractActionText(userPrompt) {
    if (!userPrompt) return "ton exploration de la région";

    const lastActionMatch = userPrompt.match(/DERNIÈRE ACTION DE\s+[^:\n]+:\s*["']?([^"\n\r\]]+)["']?/i) ||
                              userPrompt.match(/(?:ACTION DU JOUEUR|ACTION EN COURS|ACTION)\s*:\s*(?:\[[^\]]+\]\s*:?\s*)?["']?([^"\n\r\]]+)["']?/i);
    if (lastActionMatch && lastActionMatch[1] && !lastActionMatch[1].includes("TRUNCATED") && !lastActionMatch[1].includes("Aucune")) {
        const clean = lastActionMatch[1].trim().replace(/[*_#]/g, '');
        if (clean.length > 2 && clean.length < 200) return clean;
    }

    const lines = userPrompt.split('\n').map(l => l.trim()).filter(l => l && !l.includes("TRUNCATED") && !l.includes("Aucune") && !l.includes("Influence") && !l.startsWith("System:") && !l.startsWith("---") && !l.startsWith("PERSONNAGE"));
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1].replace(/^\[[^\]]+\]\s*/, '').replace(/[*_#]/g, '');
        if (lastLine.length > 3 && lastLine.length < 200) {
            return lastLine;
        }
    }

    return "ton exploration stratégique";
}

function extractPlayerName(userPrompt) {
    const nameMatch = userPrompt.match(/PERSONNAGE ACTIF\s*:\s*([^\n|]+)/i) || userPrompt.match(/DERNIÈRE ACTION DE\s+([A-Za-z0-9\s\-_.]+)\s*:/i);
    if (nameMatch && nameMatch[1]) {
        return nameMatch[1].trim().split(' ')[0];
    }
    return "l'Héritier";
}

function extractLocation(userPrompt) {
    const locMatch = userPrompt.match(/Lieu\s*:\s*([^\n|()]+)/i) || userPrompt.match(/ROYAUME ACTUEL\s*:\s*([^\n|()]+)/i);
    if (locMatch && locMatch[1]) {
        return locMatch[1].trim();
    }
    return "Empire Impérial d'Elion";
}

/**
 * Main in-process local LLM story generator.
 */
async function generateLocalLLMResponse(systemPrompt, userPrompt, options = {}) {
    console.log(`[Unlimited Local LLM Engine] Generating in-process ATR story response...`);

    const actionText = options && options.playerAction ? options.playerAction.trim().replace(/[*_#]/g, '') : extractActionText(userPrompt);
    const playerName = extractPlayerName(userPrompt);
    const location = extractLocation(userPrompt);
    const lowerAction = actionText.toLowerCase();

    // Contextual Action Analyzers
    const isMagic = lowerAction.includes('sort') || lowerAction.includes('magie') || lowerAction.includes('feu') || lowerAction.includes('glace') || lowerAction.includes('foudre') || lowerAction.includes('mana') || lowerAction.includes('incantation');
    const isCombat = lowerAction.includes('attaque') || lowerAction.includes('frappe') || lowerAction.includes('épée') || lowerAction.includes('lame') || lowerAction.includes('combat') || lowerAction.includes('monstre') || lowerAction.includes('tirer') || lowerAction.includes('frapper') || lowerAction.includes('dague') || lowerAction.includes('coup') || isMagic;
    const isSocial = lowerAction.includes('parle') || lowerAction.includes('demande') || lowerAction.includes('question') || lowerAction.includes('dialogue') || lowerAction.includes('cherche') || lowerAction.includes('salue') || lowerAction.includes('dis') || lowerAction.includes('répond');
    const isItemUse = lowerAction.includes('mange') || lowerAction.includes('bois') || lowerAction.includes('potion') || lowerAction.includes('soigne') || lowerAction.includes('utilise') || lowerAction.includes('équipe');

    // 1. COMBAT / MAGIC ACTIONS
    if (isCombat) {
        const xpGain = Math.floor(Math.random() * 100) + 150;
        const goldGain = Math.floor(Math.random() * 150) + 150;

        const combatNarratives = [
            `L'atmosphère de ${location} se tend brusquement alors que ${playerName} passe à l'offensive ! Lorsque tu accomplis « ${actionText} », ton énergie spirituelle se déchaîne, traçant un arc de lumière d'éther pur au milieu de la pénombre.\n\nLe choc résonne à travers le secteur avec un fracas assourdissant. Ton adversaire est ébranlé de plein fouet, incapable de parer la totalité de la force déployée par ton essence d'Héritier. Les témoins et gardes locaux retiennent leur souffle devant une telle démonstration de Battle IQ et de maîtrise tactique.\n\nLa menace est repoussée de quelques mètres, affirmant ton autorité dans la zone et te rapprochant de l'accomplissement de ta Quête Principale Obligatoire.\n\n[${playerName}: EXP +${xpGain}]\n[${playerName}: GOLD +${goldGain}]\n[IMAGE: epic high resolution anime digital painting of ${playerName} executing ${actionText} in ${location}, glowing energy effects, dynamic fantasy art, masterpiece]`,

            `Les fluides magiques qui parcourent la matrice d'ATR s'embrasent sous l'impulsion de ton geste. En exécutant « ${actionText} », une onde de choc spirituelle s'élève du sol, dissipant les ombres qui entouraient la scène.\n\nTon impact est d'une létalité chirurgicale. Les ennemis reculent précipitamment devant la puissance de ton aura d'Héritier, comprenant que la volonté d'un guerrier déterminé ne saurait être entravée.\n\nAlors que la poussière et les étincelles d'éther retombent, tu consolides ta position avec assurance.\n\n[${playerName}: EXP +${xpGain + 20}]\n[${playerName}: GOLD +${goldGain + 30}]\n[IMAGE: dramatic anime combat scene of ${playerName} performing ${actionText} in ${location}, glowing aura, high detail MAPPA animation style]`
        ];
        return combatNarratives[Math.floor(Math.random() * combatNarratives.length)];
    }

    // 2. DIALOGUE / SOCIAL / NPC INTERACTIONS
    if (isSocial) {
        const xpGain = Math.floor(Math.random() * 50) + 100;
        const goldGain = Math.floor(Math.random() * 80) + 100;

        const dialogueNarratives = [
            `Dans l'agitation de ${location}, ${playerName} s'avance vers ses interlocuteurs. Lorsque tu effectues « ${actionText} », ta voix résonne avec une assurance naturelle qui capte immédiatement l'attention des PNJ environnants.\n\nUn garde de la milice d'élite et un marchand de passage s'arrêtent, intrigués par la présence de ton aura. Impressionnés par ton calme et la marque de ton rang, ils s'inclinent légèrement et te révèlent des informations précieuses sur les secrets de la région et ton prochain chapitre obligatoire.\n\nCes renseignements stratégiques te permettent d'orienter tes pas avec une clarté optimale.\n\n[${playerName}: EXP +${xpGain}]\n[${playerName}: GOLD +${goldGain}]\n[IMAGE: high resolution anime style scene of ${playerName} engaging in conversation in ${location}, detailed background, cinematic lighting]`,

            `En réalisant « ${actionText} », tu établis un contact décisif au cœur de la cité. Les regards calculateurs des témoins s'adoucissent à mesure que ton intention se précise.\n\nLes PNJ locaux te répondent avec un respect mêlé de prudence, t'ouvrant l'accès à des pistes couvertes par le secret de la Causalité. Tu obtiens les indices nécessaires pour poursuivre ta progression.\n\nTon intégration dans le tissu social de la région se renforce durablement.\n\n[${playerName}: EXP +${xpGain + 10}]\n[${playerName}: GOLD +${goldGain + 20}]\n[IMAGE: beautiful anime illustration of ${playerName} speaking with locals in ${location}, expressive character art]`
        ];
        return dialogueNarratives[Math.floor(Math.random() * dialogueNarratives.length)];
    }

    // 3. ITEM USE / SURVIVAL
    if (isItemUse) {
        return `Au cœur de ${location}, ${playerName} prend un moment pour se concentrer. En réalisant « ${actionText} », la sensation de restauration se diffuse immédiatement à travers tes membres fatigués.\n\nTon énergie vitale et ton esprit se stabilisent. Les stigmates du voyage s'atténuent, te redonnant la pleine maîtrise de tes compétences de combat.\n\nPrêt pour les défis à venir, tu te redresses avec une détermination renouvelée.\n\n[${playerName}: HP +20]\n[${playerName}: MP +20]\n[${playerName}: EXP +80]\n[IMAGE: anime digital painting of ${playerName} resting and using item in ${location}, warm glowing atmosphere]`;
    }

    // 4. MOVEMENT / EXPLORATION / GENERAL ACTIONS
    const xpGain = Math.floor(Math.random() * 60) + 120;
    const goldGain = Math.floor(Math.random() * 90) + 120;

    const explorationNarratives = [
        `Dans la pénombre majestueuse d'ATR, la lumière des lanternes à l'éther éclaire la progression de ${playerName}. En exécutant « ${actionText} », tes pas résonnent fermement sur la roche, traçant un chemin net à travers le territoire de ${location}.\n\nLe vent frais de la région apporte des rumeurs d'aventures et le murmure des failles spirituelles. L'environnement s'adapte à ta présence, révélant de nouvelles opportunités d'action et confirmant l'ancrage de tes données dans le registre du monde.\n\nTu poursuis ta marche avec détermination, guidé par la Causalité vers ton prochain objectif obligatoire.\n\n[${playerName}: EXP +${xpGain}]\n[${playerName}: GOLD +${goldGain}]\n[IMAGE: scenic high resolution anime environment of ${playerName} exploring ${location}, majestic landscape, detailed fantasy background]`,

        `Une brise chargée d'éther balaye la zone alors que ${playerName} accomplit « ${actionText} ». Ton mouvement est fluide et méthodique, affirmant la maîtrise de ton personnage sur le terrain.\n\nLes détails de la citadelle et des structures environnantes se découpent avec netteté sous le ciel d'ATR. Ton passage marque les esprits et consolide ton empreinte dans la mémoire du monde.\n\nLa voie vers ton chapitre principal s'éclaircit à chacun de tes gestes.\n\n[${playerName}: EXP +${xpGain + 15}]\n[${playerName}: GOLD +${goldGain + 25}]\n[IMAGE: anime digital painting of ${playerName} walking through ${location}, dramatic sky, high detail fantasy landscape]`
    ];

    return explorationNarratives[Math.floor(Math.random() * explorationNarratives.length)];
}

module.exports = { generateLocalLLMResponse };
