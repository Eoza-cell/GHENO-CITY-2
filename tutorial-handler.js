const fs = require('fs');
const path = require('path');
const { generateClassSelectionImage } = require('./class-visualizer');
const { generateLinkStartImage } = require('./start-image-generator');
const { generateProfileCard } = require('./profile-generator');
const { sendWithImage } = require('./message-handler');
const { callAI } = require('./ai-utils');

async function startTutorial(sock, jid, player) {
    await player.update({ tutorialStep: 1, mode: 'action' });

    const welcomeText = "--- ⚔️ *START: LINK START!* --- \n\n" +
                        "Un homme à la carrure imposante et aux cheveux rouges se tient devant toi, une aura de puissance écrasante se dégageant de lui. Il s'agit de ton instructeur.\n\n" +
                        "Instructeur : 'Alors comme ça, un nouveau visage apparaît dans ce monde condamné ? Voyons si tu as la flamme d'un héros ou si tu n'es qu'une erreur de la matrice.'\n\n" +
                        "Il te tend trois parchemins anciens entourés d'éclairs de mana.\n\n" +
                        "'Choisis ton destin, ton arme et ton âme. *Quelle est ta classe ?*'";

    try {
        // Send Link Start Intro first
        const introImg = await generateLinkStartImage();
        await sock.sendMessage(jid, { image: introImg, caption: "⚡ INITIALISATION DU SYSTÈME..." });

        const imageBuffer = await generateClassSelectionImage();
        await sock.sendMessage(jid, {
            image: imageBuffer,
            caption: welcomeText
        });
    } catch (error) {
        console.error("Erreur démarrage tutoriel:", error);
        await sock.sendMessage(jid, { text: welcomeText + "\n\n(Désolé, l'image n'a pas pu être générée. Choisis entre : Guerrier, Mage ou Assassin)" });
    }
}


async function handleTutorialAction(sock, message, player, actionText) {
    const jid = message.key.remoteJid;
    console.log(`[TUTORIAL] Step: ${player.tutorialStep}, Action: "${actionText}"`);

    if (player.tutorialStep === 1.5) {
        const lowerAction = actionText.toLowerCase();
        let derivative = "Équilibré";
        let bonus = { strength: 0, defense: 0, luck: 0, intelligence: 0, agility: 0 };

        if (lowerAction.includes("berserker")) {
            derivative = "Berserker";
            bonus.strength = 15;
            bonus.defense = -5;
        } else if (lowerAction.includes("tank")) {
            derivative = "Tank";
            bonus.defense = 20;
            bonus.agility = -5;
        } else if (lowerAction.includes("sniper") || lowerAction.includes("assassin")) {
            derivative = "Sniper/Assassin";
            bonus.luck = 15;
            bonus.health = -10;
        } else if (lowerAction.includes("tacticien")) {
            derivative = "Tacticien";
            bonus.intelligence = 10;
            bonus.mana = 30;
        }

        await player.update({
            derivative: derivative,
            tutorialStep: 2,
            strength: player.strength + bonus.strength,
            defense: player.defense + bonus.defense,
            intelligence: player.intelligence + bonus.intelligence,
            agility: player.agility + (bonus.agility || 0),
            luck: player.luck + (bonus.luck || 0)
        });

        const nextText = `Instructeur : 'Un style ${derivative}, parfait. Voici ton profil actuel mis à jour dans la matrice.'\n\n` +
                         `*GÉNÉRATION DU PROFIL...*\n\n` +
                         "Instructeur : 'Maintenant, passons à la destruction !'\n\n" +
                         "Il dégaine une lame massive d'un geste si rapide que l'œil humain peut à peine le suivre.\n\n" +
                         "'Montre-moi ta détermination ! Frappe avec l'intention de tuer, ou tu ne survivras pas une seconde dans les donjons de Rang S !'\n\n" +
                         "--- 💡 *CONSEIL DE COMBAT ANIME* --- \n" +
                         "Décris tes attaques avec passion pour maximiser tes dégâts.";

        try {
            const profileCard = await generateProfileCard(player);
            await sock.sendMessage(jid, { image: profileCard, caption: "📇 *TON PROFIL INITIALISÉ*" });

            let bossImage;
            try {
                bossImage = fs.readFileSync(path.join('assets', 'tutorial_boss.jpg'));
                await sock.sendMessage(jid, { image: bossImage, caption: nextText });
            } catch (e) {
                await sock.sendMessage(jid, { text: nextText });
            }
        } catch (error) {
            console.error("Error sending tutorial images:", error);
            await sock.sendMessage(jid, { text: nextText });
        }
        return;
    }

    if (player.tutorialStep === 1) {
        // Class selection logic
        const lowerAction = actionText.toLowerCase();
        const classes = {
            'guerrier': 'Guerrier',
            'mage': 'Mage',
            'assassin': 'Assassin',
            'archer': 'Archer',
            'prêtre': 'Prêtre',
            'moine': 'Moine',
            'paladin': 'Paladin',
            'invocateur': 'Invocateur',
            'nécromancien': 'Nécromancien',
            'samouraï': 'Samouraï',
            'chevalier-dragon': 'Chevalier-Dragon',
            'alchimiste': 'Alchimiste',
            'barde': 'Barde'
        };

        let chosenClass = null;
        for (const [key, value] of Object.entries(classes)) {
            if (lowerAction.includes(key)) {
                chosenClass = value;
                break;
            }
        }

        if (chosenClass) {
            // Family "Gacha" (1% - 10% - 25% - 75% interpretation)
            const roll = Math.random() * 100;
            let family = "Sans Famille";
            let familyBonus = { strength: 0, agility: 0, intelligence: 0, luck: 0, defense: 0 };

            if (roll < 1) { // 1% Royale
                family = "Famille Royale d'Elion";
                familyBonus = { strength: 25, agility: 25, intelligence: 25, luck: 25, defense: 25 };
            } else if (roll < 10) { // 9% Noble (Top 10%)
                family = "Maison de la Lame d'Argent";
                familyBonus = { strength: 15, agility: 15, intelligence: 15, luck: 15, defense: 15 };
            } else if (roll < 25) { // 15% Connue (Top 25%)
                family = "Clan des Loups d'Acier";
                familyBonus = { strength: 8, agility: 8, intelligence: 8, luck: 8, defense: 8 };
            }

            let startingItems = [];
            if (['Guerrier', 'Samouraï', 'Paladin', 'Chevalier-Dragon'].includes(chosenClass)) {
                startingItems = [{ name: 'Épée de Fer', quantity: 1 }, { name: 'Armure de Cuir', quantity: 1 }];
            } else if (['Mage', 'Invocateur', 'Nécromancien', 'Alchimiste', 'Prêtre'].includes(chosenClass)) {
                startingItems = [{ name: 'Bâton Apprenti', quantity: 1 }, { name: 'Robe en Tissu', quantity: 1 }];
            } else if (['Assassin', 'Archer'].includes(chosenClass)) {
                startingItems = [{ name: 'Dague Simple', quantity: 1 }, { name: 'Vêtements de Furtivité', quantity: 1 }];
            } else {
                startingItems = [{ name: 'Bâton de Voyage', quantity: 1 }, { name: 'Tunique Simple', quantity: 1 }];
            }

            console.log(`[TUTORIAL] Class chosen: ${chosenClass}, Family: ${family}`);
            try {
                await player.update({
                    class: chosenClass,
                    family: family,
                    tutorialStep: 1.5, // Intermediate step for Derivative
                    inventory: startingItems,
                    strength: (chosenClass === 'Guerrier' || chosenClass === 'Paladin' || chosenClass === 'Samouraï') ? 20 + familyBonus.strength : 10 + familyBonus.strength,
                    intelligence: (chosenClass === 'Mage' || chosenClass === 'Invocateur' || chosenClass === 'Nécromancien' || chosenClass === 'Alchimiste') ? 20 + familyBonus.intelligence : 10 + familyBonus.intelligence,
                    agility: (chosenClass === 'Assassin' || chosenClass === 'Archer' || chosenClass === 'Moine') ? 20 + familyBonus.agility : 10 + familyBonus.agility,
                    luck: 5 + familyBonus.luck,
                    defense: 10 + familyBonus.defense
                });
                console.log(`[TUTORIAL] Player updated successfully.`);
            } catch (err) {
                console.error(`[TUTORIAL] Failed to update player:`, err);
                throw err;
            }

            let nextText = `Instructeur : 'Un ${chosenClass}, hein ? *DODODO!* Un choix qui en dit long sur ton tempérament.\n\n`;

            nextText += `*Dés de Destin lancés... 🎲 Résultat : ${roll.toFixed(1)}%*\n\n`;

            if (family !== "Sans Famille") {
                nextText += `Tiens... ce sceau sur ton épaule... Incroyable ! Tu appartiens à la **${family}** ! Ton sang est porteur d'une puissance latente qui surpasse le commun des mortels...'\n\n`;
            } else {
                nextText += `Tu n'as peut-être pas de nom illustre (75% de chance d'être "Sans Famille"), mais ta volonté semble d'acier.'\n\n`;
            }

            nextText += "Mais ce n'est pas tout. Chaque combattant a un style qui lui est propre, une *dérivée* de sa classe de base.\n\n" +
                        "Quel est ton style de prédilection ?\n" +
                        "1. **Berserker** (Force brute, peu de défense)\n" +
                        "2. **Tank** (Défense absolue, lent)\n" +
                        "3. **Sniper/Assassin** (Frappes critiques, fragile)\n" +
                        "4. **Tacticien/Mage de Soutien** (Contrôle et mana)\n" +
                        "5. **Équilibré** (Polyvalence)\n\n" +
                        "Réponds par le nom du style choisi.";

            await sock.sendMessage(message.key.remoteJid, { text: nextText });
            return;
        } else {
            await sock.sendMessage(jid, { text: "Instructeur : 'Concentrate-toi ! Tu dois choisir une classe parmi les 13 disponibles (Guerrier, Mage, Assassin, Archer, Prêtre, Moine, Paladin, Invocateur, Nécromancien, Samouraï, Chevalier-Dragon, Alchimiste, Barde).'" });
            return;
        }
    }

    if (player.tutorialStep === 2) {
        // Combat training logic powered by AI
        const turnsSoFar = player.tutorialTurns || 0;
        const MAX_TUTORIAL_TURNS = 2; // force completion after this many combat exchanges
        const mustFinish = turnsSoFar >= MAX_TUTORIAL_TURNS;

        const systemPrompt = `
            Tu es l'Instructeur, un maître d'armes légendaire dans GHENO CITY 2. Ton but est d'évaluer le nouveau protagoniste.
            Le joueur est un ${player.class} de la famille ${player.family} (FOR: ${player.strength}, AGI: ${player.agility}, INT: ${player.intelligence}).

            STYLE: Narratif riche, immersif, style anime. Pas de texte en anglais. PAS de parenthèses pour les sons.
            LONGUEUR: 2-3 paragraphes minimum.

            RÈGLES DU TUTORIEL:
            1. PROTAGONISTE: Traite le joueur comme le centre de son histoire.
            2. RÉACTIVITÉ ABSOLUE : N'invente JAMAIS d'actions pour le joueur. S'il dit "Je frappe", décris l'impact, mais ne le fais pas bouger ou parler à sa place dans ton texte.
            3. PNJ BIEN ÉCRITS : L'Instructeur est charismatique, dur, et a une voix unique. Ses réactions doivent être marquantes.
            4. IMPACT DES STATS: Respecte l'échelle de puissance.
            5. LIBERTÉ: Décris les attaques de l'instructeur et laisse le joueur réagir. Ne force pas ses mouvements.
            6. TON MENTOR: Sévère mais juste. "DODODO!"
            5. FIN: Le tutoriel est COURT. Dès que le joueur tente une attaque ou une action de combat déterminée, mets tutorial_complete à true et félicite-le.
            ${mustFinish ? "6. IMPÉRATIF: Le joueur s'est assez entraîné. Tu DOIS conclure le tutoriel MAINTENANT : tutorial_complete = true, OBLIGATOIRE." : ""}
            7. JSON STRICT: {"narrative": "...", "tutorial_complete": boolean}
        `;

        const fullPrompt = `ACTION DU JOUEUR: ${actionText}`;

        await player.increment('tutorialTurns', { by: 1 });
        await player.reload();

        try {
            const contentRaw = await callAI(systemPrompt, fullPrompt);
            let content = contentRaw;
            let aiResponse = { narrative: "", tutorial_complete: false };

            if (typeof content === 'object') {
                aiResponse = content;
            } else {
                const firstBrace = content.indexOf('{');
                const lastBrace = content.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1) {
                    const potentialJson = content.substring(firstBrace, lastBrace + 1);
                    try {
                        aiResponse = JSON.parse(potentialJson);
                    } catch (e) {}
                }

                if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
                    let textBefore = firstBrace !== -1 ? content.substring(0, firstBrace).trim() : "";
                    let textAfter = lastBrace !== -1 ? content.substring(lastBrace + 1).trim() : "";

                    const cleanup = (t) => t.replace(/```json/gi, '').replace(/```/g, '').replace(/^(json|JSON)/g, '').trim();
                    textBefore = cleanup(textBefore);
                    textAfter = cleanup(textAfter);

                    if (textBefore.length > 5) aiResponse.narrative = textBefore;
                    else if (textAfter.length > 5) aiResponse.narrative = textAfter;
                    else aiResponse.narrative = cleanup(content);
                }
            }

            if (aiResponse.narrative) {
                aiResponse.narrative = aiResponse.narrative
                    .replace(/\{[\s\S]*\}/g, '')
                    .replace(/```[\s\S]*?```/g, '')
                    .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*:\s*/i, '')
                    .trim();
            }

            if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
                aiResponse.narrative = "Instructeur : 'Impressionnant ! Tu apprends vite.'";
            }

            if (aiResponse.tutorial_complete || mustFinish) {
                await player.update({ tutorialStep: 3, mode: 'normal' });
                aiResponse.narrative += "\n\n*FÉLICITATIONS ! Tu as terminé le tutoriel. Utilise /menu pour commencer.*";

                // Show final profile card
                try {
                    const finalProfile = await generateProfileCard(player);
                    await sock.sendMessage(jid, { image: finalProfile, caption: "🏆 *AVENTURE COMMENCÉE ! Voici ton profil final.*" });
                } catch (e) {}
            }

            await sendWithImage(sock, jid, aiResponse);
        } catch (error) {
            console.error("Erreur AI tutoriel:", error);
            // Fallback to avoid blocking the user
            await sock.sendMessage(jid, { text: "Instructeur : 'Pas mal ! C'est suffisant pour aujourd'hui. Bienvenue dans Skype.'\n\n*Utilise /menu pour commencer.*" });
            await player.update({ tutorialStep: 3, mode: 'normal' });
        }
    }
}

module.exports = { startTutorial, handleTutorialAction };
