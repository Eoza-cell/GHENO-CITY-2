const fs = require('fs');
const path = require('path');
const { generateClassSelectionImage } = require('./class-visualizer');
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

            await player.update({
                class: chosenClass,
                family: family,
                tutorialStep: 2,
                strength: (chosenClass === 'Guerrier' || chosenClass === 'Paladin' || chosenClass === 'Samouraï') ? 20 + familyBonus.strength : 10 + familyBonus.strength,
                intelligence: (chosenClass === 'Mage' || chosenClass === 'Invocateur' || chosenClass === 'Nécromancien' || chosenClass === 'Alchimiste') ? 20 + familyBonus.intelligence : 10 + familyBonus.intelligence,
                agility: (chosenClass === 'Assassin' || chosenClass === 'Archer' || chosenClass === 'Moine') ? 20 + familyBonus.agility : 10 + familyBonus.agility,
                luck: 5 + familyBonus.luck,
                defense: 10 + familyBonus.defense
            });

            let nextText = `Instructeur : 'Un ${chosenClass}, hein ? *DODODO!* Un choix qui en dit long sur ton tempérament.\n\n`;

            if (family !== "Sans Famille") {
                nextText += `Tiens... ce sceau sur ton épaule... Tu appartiens à la **${family}** ! Ton sang est porteur d'une puissance latente incroyable...'\n\n`;
            } else {
                nextText += `Tu n'as peut-être pas de nom illustre, mais ta volonté semble d'acier.'\n\n`;
            }

            nextText += "Passons maintenant à la destruction !\n\n" +
                             "Il dégaine une lame massive d'un geste si rapide que l'œil humain peut à peine le suivre.\n\n" +
                             "'Montre-moi ta détermination ! Frappe avec l'intention de tuer, ou tu ne survivras pas une seconde dans les donjons de Rang S !'\n\n" +
                             "--- 💡 *CONSEIL DE COMBAT ANIME* --- \n" +
                             "Décris tes attaques avec passion (ex: 'Je concentre mon mana dans ma lame et je lance une entaille fulgurante !') pour maximiser tes dégâts.";

            try {
                const bossImage = fs.readFileSync(path.join('assets', 'tutorial_boss.jpg'));
                await sock.sendMessage(jid, {
                    image: bossImage,
                    caption: nextText
                });
            } catch (error) {
                await sock.sendMessage(jid, { text: nextText });
            }
            return;
        } else {
            await sock.sendMessage(jid, { text: "Instructeur : 'Concentrate-toi ! Tu dois choisir une classe parmi les 13 disponibles (Guerrier, Mage, Assassin, Archer, Prêtre, Moine, Paladin, Invocateur, Nécromancien, Samouraï, Chevalier-Dragon, Alchimiste, Barde).'" });
            return;
        }
    }

    if (player.tutorialStep === 2) {
        // Combat training logic powered by AI
        const systemPrompt = `
            Tu es l'Instructeur, un maître d'armes légendaire dans GHENO CITY 2. Ton but est d'évaluer et de former le nouveau joueur dans un duel d'entraînement épique de style ANIME (Ufotable/MAPPA style).
            Le joueur est un ${player.class} (FOR: ${player.strength}, AGI: ${player.agility}, INT: ${player.intelligence}).

            RÈGLES DU TUTORIEL (STYLE ANIME):
            1.  **Narration Épique**: Décris les impacts avec des onomatopées (*BOOM*, *ZING*), des effets de lumière et des ralentis dramatiques.
            2.  **Réaction Dynamique**: Décris précisément l'impact de l'attaque du joueur en fonction de ses stats. Si le joueur a beaucoup de force, le sol doit se fissurer.
            3.  **Instruction Rapide**: Le tutoriel doit être court (1-2 échanges).
            4.  **Ton Mentor Anime**: Tu es un mentor sévère mais respectueux. Utilise des répliques comme "Pas mal, mais trop lent !" ou "Ressens le flux du mana !".
            5.  **Fin du Tutoriel**: Dès que tu juges que le joueur a compris, passe "tutorial_complete" à true.
            6.  **Format JSON**: Retourne UNIQUEMENT un objet JSON avec les clés "narrative" (string) et "tutorial_complete" (boolean).
        `;

        const fullPrompt = `ACTION DU JOUEUR: ${actionText}`;

        try {
            const contentRaw = await callAI(systemPrompt, fullPrompt);
            let content = contentRaw;
            let aiResponse = { narrative: "", tutorial_complete: false };

            if (typeof content === 'object') {
                aiResponse = content;
            } else {
                let cleanContent = content
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .replace(/^json/gi, '')
                    .trim();

                const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        aiResponse = JSON.parse(jsonMatch[0]);
                        if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
                            const parts = cleanContent.split(jsonMatch[0]);
                            const potentialNarrative = parts[0].trim() || parts[1]?.trim();
                            if (potentialNarrative && potentialNarrative.length > 5) {
                                aiResponse.narrative = potentialNarrative;
                            }
                        }
                    } catch (e) {
                        aiResponse.narrative = cleanContent;
                    }
                } else {
                    aiResponse.narrative = cleanContent;
                }
            }

            if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
                aiResponse.narrative = "Instructeur : 'Impressionnant ! Tu apprends vite.'";
            }

            if (aiResponse.tutorial_complete) {
                await player.update({ tutorialStep: 3, mode: 'normal' });
                aiResponse.narrative += "\n\n*FÉLICITATIONS ! Tu as terminé le tutoriel. Utilise /menu pour commencer.*";
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
