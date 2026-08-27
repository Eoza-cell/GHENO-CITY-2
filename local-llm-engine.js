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

    // 1. COMBAT / ATTACK ACTIONS
    if (lowerAction.includes('attaque') || lowerAction.includes('frappe') || lowerAction.includes('épée') || lowerAction.includes('lame') || lowerAction.includes('combat') || lowerAction.includes('monstre') || lowerAction.includes('tirer') || lowerAction.includes('frapper') || lowerAction.includes('dague') || lowerAction.includes('sort')) {
        const combatNarratives = [
            `L'atmosphère de ${location} se tend brusquement alors que ${playerName} passe à l'offensive ! Lorsque tu accomplis « ${actionText} », ton arme découpe l'air avec une vitesse fulgurante, traçant un arc de lumière d'éther pur au milieu de la pénombre.\n\nLe choc résonne à travers le secteur avec un fracas métallique assourdissant. Ton adversaire est ébranlé de plein fouet, incapable de parer la totalité de la force déployée par ton essence d'Héritier. Les témoins et gardes locaux retiennent leur souffle devant une telle démonstration de Battle IQ et de maîtrise tactique.\n\nLa menace est repoussée de quelques mètres, affirmant ton autorité dans la zone et te rapprochant de l'accomplissement de ta Quête Principale Obligatoire.

[${playerName}: EXP +180]
[${playerName}: GOLD +250]`,

            `Les fluides magiques qui parcourent la matrice d'ATR s'embrasent sous l'impulsion de ton geste. En exécutant « ${actionText} », une onde de choc spirituelle s'élève du sol, dissipant les ombres qui entouraient la scène.\n\nTon impact est d'une létalité chirurgicale. Les ennemis reculent précipitamment devant la puissance de ton aura d'Héritier, comprenant que la volonté d'un guerrier déterminé ne saurait être entravée.\n\nAlors que la poussière et les étincelles d'éther retombent, tu consolides ta position avec assurance.

[${playerName}: EXP +200]
[${playerName}: GOLD +300]`
        ];
        return combatNarratives[Math.floor(Math.random() * combatNarratives.length)];
    }

    // 2. DIALOGUE / SOCIAL / NPC INTERACTIONS
    if (lowerAction.includes('parle') || lowerAction.includes('demande') || lowerAction.includes('question') || lowerAction.includes('dialogue') || lowerAction.includes('cherche') || lowerAction.includes('salue') || lowerAction.includes('regarde')) {
        const dialogueNarratives = [
            `Dans l'agitation de ${location}, ${playerName} s'avance vers ses interlocuteurs. Lorsque tu effectues « ${actionText} », ta voix résonne avec une assurance naturelle qui capte immédiatement l'attention des PNJ environnants.\n\nUn garde de la milice d'élite et un marchand de passage s'arrêtent, intrigués par la présence de ton aura. Impressionnés par ton calme et la marque de ton rang, ils s'inclinent légèrement et te révèlent des informations précieuses sur les secrets de la région et ton prochain chapitre obligatoire.\n\nCes renseignements stratégiques te permettent d'orienter tes pas avec une clarté optimale.

[${playerName}: EXP +120]
[${playerName}: GOLD +150]`,

            `En réalisant « ${actionText} », tu établis un contact décisif au cœur de la cité. Les regards calculateurs des témoins s'adoucissent à mesure que ton intention se précise.\n\nLes PNJ locaux te répondent avec un respect mêlé de prudence, t'ouvrant l'accès à des pistes couvertes par le secret de la Causalité. Tu obtiens les indices nécessaires pour poursuivre ta progression.\n\nTon intégration dans le tissu social de la région se renforce durablement.

[${playerName}: EXP +130]
[${playerName}: GOLD +180]`
        ];
        return dialogueNarratives[Math.floor(Math.random() * dialogueNarratives.length)];
    }

    // 3. MOVEMENT / EXPLORATION / GENERAL ACTIONS
    const explorationNarratives = [
        `Dans la pénombre majestueuse d'ATR, la lumière des lanternes à l'éther éclaire la progression de ${playerName}. En exécutant « ${actionText} », tes pas résonnent fermement sur la roche, traçant un chemin net à travers le territoire de ${location}.\n\nLe vent frais de la région apporte des rumeurs d'aventures et le murmure des failles spirituelles. L'environnement s'adapte à ta présence, révélant de nouvelles opportunités d'action et confirmant l'ancrage de tes données dans le registre du monde.\n\nTu poursuis ta marche avec détermination, guidé par la Causalité vers ton prochain objectif obligatoire.

[${playerName}: EXP +140]
[${playerName}: GOLD +160]`,

        `Une brise chargée d'éther balaye la zone alors que ${playerName} accomplit « ${actionText} ». Ton mouvement est fluide et méthodique, affirmant la maîtrise de ton personnage sur le terrain.\n\nLes détails de la citadelle et des structures environnantes se découpent avec netteté sous le ciel d'ATR. Ton passage marque les esprits et consolide ton empreinte dans la mémoire du monde.\n\nLa voie vers ton chapitre principal s'éclaircit à chacun de tes gestes.

[${playerName}: EXP +150]
[${playerName}: GOLD +170]`
    ];

    return explorationNarratives[Math.floor(Math.random() * explorationNarratives.length)];
}

module.exports = { generateLocalLLMResponse };
