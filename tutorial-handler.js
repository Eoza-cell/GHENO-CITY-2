const fs = require('fs');
const path = require('path');
const { generateClassSelectionImage } = require('./class-visualizer');
const { sendWithImage } = require('./message-handler');
const { callAI } = require('./ai-utils');

async function startTutorial(sock, jid, player) {
    await player.update({ tutorialStep: 1, mode: 'action' });

    const welcomeText = "*BIENVENUE DANS GHENO CITY 2 : LE TUTORIEL*\n\n" +
                        "Un homme à la carrure imposante et aux cheveux rouges se tient devant toi. Il s'agit de ton instructeur.\n\n" +
                        "Instructeur : 'Alors comme ça, tu veux devenir un joueur de haut niveau ? Voyons d'abord ce que tu as dans le ventre.'\n\n" +
                        "Il te tend trois parchemins anciens.\n\n" +
                        "'Choisis ta classe, aventurier.'";

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

            const nextText = `Instructeur : 'Un ${chosenClass}, hein ? Un choix audacieux. Passons maintenant à la pratique.'\n\n` +
                             "Il sort deux épées de bois (ou un bâton, selon ton choix) et se met en garde.\n\n" +
                             "'Donne-moi des coups. N'aie pas peur, je vais te montrer comment on se bat vraiment ici.'\n\n" +
                             "*CONSEIL : Décris tes attaques (ex: 'Je lance un coup d'épée vertical') pour apprendre les combos.*";

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
            Tu es l'Instructeur, un maître d'armes légendaire dans GHENO CITY 2. Ton but est d'évaluer et de former le nouveau joueur.
            Le joueur est un ${player.class} (FOR: ${player.strength}, AGI: ${player.agility}, INT: ${player.intelligence}).

            RÈGLES DU TUTORIEL:
            1.  **Réaction Dynamique**: Décris précisément l'impact de l'attaque du joueur en fonction de ses stats.
            2.  **Instruction Rapide**: Le tutoriel doit être court. Si l'action du joueur est correcte et créative, termine le tutoriel immédiatement.
            3.  **Ton Immersif**: Tu es un mentor sévère mais juste. Langage guerrier.
            4.  **Fin du Tutoriel**: Dès que tu juges que le joueur a compris (souvent après 1 ou 2 actions bien décrites), passe "tutorial_complete" à true.
            5.  **Format JSON**: Retourne UNIQUEMENT un objet JSON avec les clés "narrative" (string) et "tutorial_complete" (boolean).
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
