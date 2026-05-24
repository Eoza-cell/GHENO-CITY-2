const fs = require('fs');
const path = require('path');
const { generateRaceSelectionImage } = require('./race-visualizer');
const { sendWithImage } = require('./message-handler');
const { callAI } = require('./ai-utils');

async function startTutorial(sock, jid, player) {
    await player.update({ tutorialStep: 1, mode: 'action' });

    const welcomeText = "--- 🐉 *ENTRAÎNEMENT: LE DÉBUT DU PÉRIPLE* --- \n\n" +
                        "Un vieil homme de petite taille, portant une carapace de tortue sur le dos et des lunettes de soleil, te regarde d'un air malicieux. C'est Tortue Géniale.\n\n" +
                        "Maître Roshi : 'Oh-ho ! Un nouveau disciple ? On verra bien si tu as ce qu'il faut pour porter la marque de l'école des tortues !'\n\n" +
                        "'Avant de commencer, dis-moi... à quelle race appartiens-tu ? (Humain, Saiyan, Namek, Démon du Froid, Majin)'";

    try {
        const imageBuffer = await generateRaceSelectionImage();
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
        // Race selection logic
        const lowerAction = actionText.toLowerCase();
        let chosenRace = null;

        if (lowerAction.includes('humain')) chosenRace = 'Humain';
        else if (lowerAction.includes('saiyan')) chosenRace = 'Saiyan';
        else if (lowerAction.includes('namek')) chosenRace = 'Namek';
        else if (lowerAction.includes('froid') || lowerAction.includes('freezer')) chosenRace = 'Démon du Froid';
        else if (lowerAction.includes('majin')) chosenRace = 'Majin';

        if (chosenRace) {
            await player.update({
                race: chosenRace,
                tutorialStep: 2,
                strength: chosenRace === 'Saiyan' ? 25 : 15,
                ki: 100,
                agility: chosenRace === 'Démon du Froid' ? 25 : 15
            });

            const nextText = `Maître Roshi : 'Un ${chosenRace}, hein ? Intéressant ! On va voir si tu sais te servir de tes poings !'\n\n` +
                             "Il se met en garde, ses muscles semblant soudainement doubler de volume.\n\n" +
                             "'Attaque-moi avec tout ce que tu as ! Concentre ton Ki et montre-moi ta force !'\n\n" +
                             "--- 💡 *CONSEIL DE COMBAT* --- \n" +
                             "Décris tes coups avec précision (ex: 'Je lance un coup de poing droit vers ton plexus après un bond de 3 mètres !').";

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
            Tu es Maître Roshi (Tortue Géniale). Ton but est d'évaluer le nouveau disciple dans un duel d'entraînement.
            Le joueur est un ${player.race} (FOR: ${player.strength}, AGI: ${player.agility}).

            RÈGLES DU TUTORIEL (STYLE DRAGON BALL):
            1.  **Combat Détaillé**: Mentionne les distances en mètres, les membres utilisés (bras droit/gauche) et les zones visées.
            2.  **Narration DBZ**: Utilise des onomatopées comme *KABOOM*, *SHING*. Décris l'aura de Ki.
            3.  **Ton Roshi**: Tu es espiègle mais un maître sérieux.
            4.  **Fin du Tutoriel**: Dès que tu juges que le joueur a compris les bases (distance, membres, Ki), passe "tutorial_complete" à true.
            5.  **Format JSON**: Retourne un objet JSON avec les clés "narrative" (string) et "tutorial_complete" (boolean).
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
                aiResponse.narrative += "\n\n*FÉLICITATIONS ! Tu es prêt pour l'aventure. Utilise /menu pour explorer l'univers.*";
            }

            await sendWithImage(sock, jid, aiResponse);
        } catch (error) {
            console.error("Erreur AI tutoriel:", error);
            // Fallback to avoid blocking the user
            await sock.sendMessage(jid, { text: "Maître Roshi : 'Pas mal ! C'est suffisant pour aujourd'hui. Bienvenue dans le monde des guerriers !'\n\n*Utilise /menu pour commencer ton aventure.*" });
            await player.update({ tutorialStep: 3, mode: 'normal' });
        }
    }
}

module.exports = { startTutorial, handleTutorialAction };
