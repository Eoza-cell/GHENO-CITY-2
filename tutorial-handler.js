const fs = require('fs');
const path = require('path');
const { generateClassSelectionImage } = require('./class-visualizer');
const { sendWithImage } = require('./message-handler');
const { callAI } = require('./ai-utils');

async function startTutorial(sock, jid, player) {
    await player.update({ tutorialStep: 1, mode: 'action' });

    const welcomeText = "--- 🔫 *INITIATION À GHENO CITY* --- \n\n" +
                        "Un homme d'un certain âge, vêtu d'un costume italien impeccable, te dévisage dans la pénombre d'une ruelle de Little Sicily. C'est Don Salvatore.\n\n" +
                        "Don Salvatore : 'Alors comme ça, on veut se faire une place au soleil à Gheno City ? On va voir si tu as les tripes pour ça ou si tu finiras dans le port avec des chaussures en béton.'\n\n" +
                        "Il pose trois dossiers sur le capot d'une voiture de luxe.\n\n" +
                        "'Choisis ton rôle, petit. C'est ça qui décidera si tu finis riche ou à la morgue. *Quel est ton rôle ?*'";

    try {
        const imageBuffer = await generateClassSelectionImage();
        await sock.sendMessage(jid, {
            image: imageBuffer,
            caption: welcomeText
        });
    } catch (error) {
        console.error("Erreur démarrage tutoriel:", error);
        await sock.sendMessage(jid, { text: welcomeText + "\n\n(Désolé, l'image n'a pas pu être générée. Choisis entre : Braqueur, Pilote ou Hacker)" });
    }
}


async function handleTutorialAction(sock, message, player, actionText) {
    const jid = message.key.remoteJid;

    if (player.tutorialStep === 1) {
        // Class selection logic
        const lowerAction = actionText.toLowerCase();
        let chosenClass = null;

        if (lowerAction.includes('braqueur')) chosenClass = 'Braqueur';
        else if (lowerAction.includes('hacker')) chosenClass = 'Hacker';
        else if (lowerAction.includes('pilote')) chosenClass = 'Pilote';

        if (chosenClass) {
            await player.update({
                class: chosenClass,
                tutorialStep: 2,
                strength: chosenClass === 'Braqueur' ? 20 : 10,
                intelligence: chosenClass === 'Hacker' ? 20 : 10,
                agility: chosenClass === 'Pilote' ? 20 : 10
            });

            const nextText = `Don Salvatore : 'Un ${chosenClass}, hein ? Pas mal. On a toujours besoin de gens comme toi. Mais voyons si tu sais te servir de tes mains !'\n\n` +
                             "Il fait un signe de tête et un de ses gorilles s'avance, les poings serrés.\n\n" +
                             "'Montre-moi ce que tu vaux ! Frappe fort, ou dégage de ma ville !'\n\n" +
                             "--- 💡 *CONSEIL DE RUE* --- \n" +
                             "Décris tes actions avec précision (ex: 'Je lui envoie un uppercut dévastateur au menton avant de m'écarter !') pour maximiser l'impact.";

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
            Tu es Don Salvatore, le parrain de la ville. Ton but est d'évaluer le nouveau joueur dans une petite altercation de rue pour voir ce qu'il a dans le ventre.
            Le joueur est un ${player.class} (FOR: ${player.strength}, AGI: ${player.agility}, INT: ${player.intelligence}).

            RÈGLES DU TUTORIEL (STYLE GTA / URBAIN):
            1.  **Narration Urbaine**: Décris les coups, les bruits de la rue, l'odeur de l'essence et de la poussière.
            2.  **Réaction Dynamique**: Décris précisément l'impact de l'action du joueur en fonction de ses stats. Si le joueur est un braqueur puissant, il doit bousculer violemment son adversaire.
            3.  **Instruction Rapide**: Le tutoriel doit être court (1-2 échanges).
            4.  **Ton Mentor Gritty**: Tu es un parrain respecté et dur. Utilise des répliques comme "C'est tout ce que tu as ?" ou "Apprends à viser, gamin.".
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
                 await sock.sendMessage(jid, { text: "Don Salvatore : 'Impressionnant ! Tu apprends vite. Bienvenue dans la famille.'\n\n*Utilise /menu pour commencer ton ascension.*" });
                 await player.update({ tutorialStep: 3, mode: 'normal' });
                 return;
            }

            const aiResponse = JSON.parse(jsonMatch[0]);

            if (aiResponse.tutorial_complete) {
                await player.update({ tutorialStep: 3, mode: 'normal' });
                aiResponse.narrative += "\n\n*BIENVENUE DANS LA RUE ! Tu as terminé l'initiation. Utilise /menu pour commencer ton ascension.*";
            }

            await sendWithImage(sock, jid, aiResponse);
        } catch (error) {
            console.error("Erreur AI tutoriel:", error);
            // Fallback to avoid blocking the user
            await sock.sendMessage(jid, { text: "Don Salvatore : 'Pas mal ! C'est suffisant pour aujourd'hui. Bienvenue à Gheno City.'\n\n*Utilise /menu pour commencer.*" });
            await player.update({ tutorialStep: 3, mode: 'normal' });
        }
    }
}

module.exports = { startTutorial, handleTutorialAction };
