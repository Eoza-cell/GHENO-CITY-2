const fs = require('fs');
const path = require('path');
const { generateClassSelectionImage } = require('./class-visualizer');
const { sendWithImage } = require('./message-handler');
const Puter = require('@heyputer/puter.js').default;

const puter = new Puter(process.env.PUTER_API_KEY);

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
            Le joueur a choisi la classe : ${player.class}.

            RÈGLES DU TUTORIEL:
            1.  **Réaction Dynamique**: Pour chaque action du joueur, décris ta parade, ton esquive ou le fait que tu encaisses le coup pour tester sa force.
            2.  **Instruction Pédagogique**: Explique les mécanismes. Si c'est un Guerrier, parle de la puissance brute et des enchaînements. Si c'est un Mage, explique comment canaliser le mana pour des sorts dévastateurs. Si c'est un Assassin, insiste sur la précision et la vitesse.
            3.  **Ton Immersif**: Tu es un mentor sévère mais juste. Utilise un langage guerrier et inspirant.
            4.  **Progression**: Introduis progressivement des concepts comme les combos (ex: 'Charge' + 'Coup de bouclier') ou les sub-classes (ex: Mage -> Nécromancien).
            5.  **Fin du Tutoriel**: Après 3-4 échanges de qualité, conclus le tutoriel. Offre un mot d'encouragement final.
            6.  **Format JSON**: Retourne un JSON avec les clés "narrative" (obligatoire) et "tutorial_complete" (booléen, true pour terminer).
        `;

        const fullPrompt = `JOUEUR (${player.class}) ACTION: ${actionText}`;

        try {
            const response = await puter.ai.chat(
                "gpt-4o-mini",
                {
                    system: systemPrompt,
                    prompt: fullPrompt,
                    stream: false,
                }
            );

            let content = response.toString();
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("Impossible d'extraire le JSON de la réponse de l'IA.");
            }

            const aiResponse = JSON.parse(jsonMatch[0]);

            if (aiResponse.tutorial_complete) {
                await player.update({ tutorialStep: 3, mode: 'normal' });
                aiResponse.narrative += "\n\n*FÉLICITATIONS ! Tu as terminé le tutoriel. Tu es maintenant prêt à explorer GHENO CITY 2. Utilise /menu pour commencer.*";
            }

            await sendWithImage(sock, jid, aiResponse);
        } catch (error) {
            console.error("Erreur AI tutoriel:", error);
            await sock.sendMessage(jid, { text: "Instructeur : 'Belle tentative, mais essaie encore !'" });
        }
    }
}

module.exports = { startTutorial, handleTutorialAction };
