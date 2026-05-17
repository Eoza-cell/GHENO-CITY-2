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
        let chosenClass = null;

        if (lowerAction.includes('guerrier')) chosenClass = 'Guerrier';
        else if (lowerAction.includes('mage')) chosenClass = 'Mage';
        else if (lowerAction.includes('assassin')) chosenClass = 'Assassin';

        if (chosenClass) {
            await player.update({
                class: chosenClass,
                tutorialStep: 2,
                strength: chosenClass === 'Guerrier' ? 20 : 10,
                intelligence: chosenClass === 'Mage' ? 20 : 10,
                agility: chosenClass === 'Assassin' ? 20 : 10
            });

            const nextText = `Instructeur : 'Un ${chosenClass}, hein ? *DODODO!* Un choix qui en dit long sur ton tempérament. Passons maintenant à la destruction !'\n\n` +
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
            await sock.sendMessage(jid, { text: "Instructeur : 'Concentrate-toi ! Tu dois choisir une classe : Guerrier, Mage ou Assassin.'" });
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

            let content = contentRaw.trim();
            // Try to fix common AI formatting issues
            if (content.includes('```json')) {
                content = content.split('```json')[1].split('```')[0].trim();
            } else if (content.includes('```')) {
                content = content.split('```')[1].split('```')[0].trim();
            }

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                 console.error("Échec extraction JSON tutoriel. Contenu brut:", content);
                 await sock.sendMessage(jid, { text: "Instructeur : 'Impressionnant ! Tu apprends vite. Le tutoriel est terminé.'\n\n*Utilise /menu pour commencer.*" });
                 await player.update({ tutorialStep: 3, mode: 'normal' });
                 return;
            }

            const aiResponse = JSON.parse(jsonMatch[0]);

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
