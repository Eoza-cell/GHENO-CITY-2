const fs = require('fs');
const path = require('path');
const { generateClassSelectionImage } = require('./class-visualizer');
const { generateLinkStartImage } = require('./start-image-generator');
const { generateProfileCard } = require('./profile-generator');
const { sendWithImage } = require('./message-handler');
const { callAI } = require('./ai-utils');
const { Skill, Op } = require('./database');

async function startTutorial(sock, jid, player) {
    await player.update({ tutorialStep: 1, mode: 'action' });

    const welcomeText = "--- 🧬 *START: INITIALISATION DE LA MATRICE* --- \n\n" +
                        "Tu te réveilles dans une salle blanche et stérile. Un homme en costume sombre, l'air fatigué, te regarde à travers une vitre.\n\n" +
                        "Superviseur : 'Encore un... Ne te fais pas d'illusions. Tu n'es pas un héros, juste une autre personne essayant de survivre dans ce système.'\n\n" +
                        "Il pianote sur une console virtuelle.\n\n" +
                        "'Pour t'enregistrer, nous devons définir ton profil de base. *Quelle voie souhaites-tu suivre ?* (Guerrier, Mage, Assassin, etc.)'";

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
            tutorialStep: 1.7, // Move to Occupation selection
            strength: player.strength + bonus.strength,
            defense: player.defense + bonus.defense,
            intelligence: player.intelligence + bonus.intelligence,
            agility: player.agility + (bonus.agility || 0),
            luck: player.luck + (bonus.luck || 0)
        });

        const nextText = `Superviseur : 'Style ${derivative} enregistré.'\n\n` +
                         "Il te regarde avec indifférence.\n\n" +
                         "'Le combat n'est pas tout dans cette vie. Quelle sera ta place dans la société d'Aetherys ?'\n\n" +
                         "1. **Artisan** (Forge et création)\n" +
                         "2. **Commerçant** (Économie et négoce)\n" +
                         "3. **Politicien** (Influence et pouvoir social)\n" +
                         "4. **Chercheur** (Connaissance et science)\n" +
                         "5. **Simple Citoyen** (Polyvalence modeste)\n\n" +
                         "Réponds par le nom de ton métier choisi.";

        try {
            const profileCard = await generateProfileCard(player);
            await sock.sendMessage(jid, { image: profileCard, caption: `📇 *STATUT DE LA MATRICE - PHASE 2*\n\nStyle ${derivative} enregistré.` });
        } catch (e) {}

        await sock.sendMessage(jid, { text: nextText });
        return;
    }

    if (player.tutorialStep === 1.7) {
        const lowerAction = actionText.toLowerCase();
        let occupation = "Simple Citoyen";
        let bonus = { intelligence: 0, luck: 0, col: 0, influence: 0 };

        if (lowerAction.includes("artisan")) {
            occupation = "Artisan";
            bonus.intelligence = 5;
            bonus.col = 200;
        } else if (lowerAction.includes("commerçant")) {
            occupation = "Commerçant";
            bonus.luck = 10;
            bonus.col = 500;
        } else if (lowerAction.includes("politicien")) {
            occupation = "Politicien";
            bonus.influence = 20;
            bonus.intelligence = 10;
        } else if (lowerAction.includes("chercheur")) {
            occupation = "Chercheur";
            bonus.intelligence = 15;
        }

        await player.update({
            occupation: occupation,
            influence: bonus.influence,
            intelligence: player.intelligence + bonus.intelligence,
            luck: player.luck + bonus.luck,
            col: player.col + bonus.col,
            tutorialStep: 1.8 // Move to Gift selection
        });

        const nextText = `Superviseur : 'Un ${occupation}... C'est noté.'\n\n` +
                         "Il s'arrête un instant, observant un écran de diagnostic.\n\n" +
                         "'Le système détecte une anomalie mineure dans ton code génétique. Nous pouvons la stabiliser de trois manières différentes. Choisis ton **Don Initial** :'\n\n" +
                         "1. **Instinct de Survie** (+20 PV Max)\n" +
                         "2. **Flux d'Éther** (+20 PM Max)\n" +
                         "3. **Surcharge de Potentiel** (+5 SP immédiats)\n\n" +
                         "Réponds par le nom du don choisi.";

        try {
            const profileCard = await generateProfileCard(player);
            await sock.sendMessage(jid, { image: profileCard, caption: `📇 *STATUT DE LA MATRICE - PHASE 3*\n\nOccupation: ${occupation}` });
        } catch (e) {}

        await sock.sendMessage(jid, { text: nextText });
        return;
    }

    if (player.tutorialStep === 1.8) {
        const lowerAction = actionText.toLowerCase();
        let gift = "Aucun";
        let bonus = { maxHealth: 0, maxMana: 0, skillPoints: 0 };

        if (lowerAction.includes("instinct")) {
            gift = "Instinct de Survie";
            bonus.maxHealth = 20;
        } else if (lowerAction.includes("éther")) {
            gift = "Flux d'Éther";
            bonus.maxMana = 20;
        } else if (lowerAction.includes("surcharge")) {
            gift = "Surcharge de Potentiel";
            bonus.skillPoints = 5;
        }

        await player.update({
            maxHealth: player.maxHealth + bonus.maxHealth,
            health: player.health + bonus.maxHealth,
            maxMana: player.maxMana + bonus.maxMana,
            mana: player.mana + bonus.maxMana,
            skillPoints: player.skillPoints + bonus.skillPoints,
            tutorialStep: 2
        });

        const nextText = `Superviseur : 'Don ${gift} activé. Ton profil est maintenant complet.'\n\n` +
                         `*GÉNÉRATION FINALE DU PROFIL...*\n\n` +
                         "Il appuie sur un bouton et le sol se dérobe. Tu tombes dans une simulation de combat.\n\n" +
                         "Instructeur : 'Debout, vermisseau ! Tu n'es personne ici, mais si tu ne veux pas mourir, apprends à te battre !'\n\n" +
                         "--- 💡 *CONSEIL DE SURVIE* --- \n" +
                         "Décris tes actions avec précision (membre utilisé, cible). L'IA est impitoyable.";

        try {
            const profileCard = await generateProfileCard(player);
            await sock.sendMessage(jid, { image: profileCard, caption: "📇 *TON PROFIL COMPLET*" });

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

                // Assign basic skills for the class (strictly capped at 5 starting techniques/skills)
                const basicSkills = await Skill.findAll({ where: { type: chosenClass } });
                const startingSkills = basicSkills.slice(0, 5);
                for (const s of startingSkills) {
                    await player.addSkill(s);
                    // Apply stat bonuses immediately
                    const bonuses = s.statBonuses || {};
                    for (const [stat, val] of Object.entries(bonuses)) {
                        if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                            await player.increment(stat, { by: val });
                        }
                    }
                }
                await player.reload();

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

            nextText += "Mais ce n'est pas tout. Chaque individu a un style qui lui est propre, une *dérivée* de ses capacités de base.\n\n" +
                        "Quel est ton style de combat de prédilection ?\n" +
                        "1. **Berserker** (Force brute)\n" +
                        "2. **Tank** (Défense)\n" +
                        "3. **Sniper/Assassin** (Agilité)\n" +
                        "4. **Tacticien/Mage de Soutien** (Intelligence)\n" +
                        "5. **Équilibré** (Polyvalence)\n\n" +
                        "Réponds par le nom du style choisi.";

            try {
                const profileCard = await generateProfileCard(player);
                await sock.sendMessage(message.key.remoteJid, { image: profileCard, caption: "📇 *STATUT DE LA MATRICE - PHASE 1*\n\nVoici ton enregistrement initial." });
            } catch (e) {
                console.error("Error sending mid-tutorial profile card:", e);
            }

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
            Tu es l'Instructeur dans la simulation de GHENO CITY. Ton but est de tester les réflexes d'une personne ordinaire.
            Le joueur est un ${player.class} (${player.derivative}), métier: ${player.occupation}.
            Stats: FOR: ${player.strength}, AGI: ${player.agility}, INT: ${player.intelligence}.

            STYLE: Français technique, sec et direct. Style "Hardboiled" / Berserk. Pas de métaphores. Pas de poésie.
            LONGUEUR: CONCISION EXTRÊME. Max 100 mots.
            PRÉCISION TECHNIQUE: Mentionne la distance exacte en METRES (m) et les membres impliqués (Membre attaquant -> Membre cible).

            RÈGLES DU TUTORIEL (PERSONNE ORDINAIRE) :
            1. PAS UN HÉROS : Le joueur n'est personne. Ne sois pas indulgent.
            2. RÉACTIVITÉ ABSOLUE (RÈGLE D'OR) : Ne décris JAMAIS les pensées, paroles ou actions d'un joueur. Commence par les conséquences directes.
            3. IMPACTS PHYSIQUES : Sois précis sur les os brisés, les ecchymoses et le recul physique en mètres.
            4. ADHÉRENCE STRICTE : Le joueur est faible. Logique > Fantaisie.
            5. PNJ : L'Instructeur est impitoyable et technique.
            6. LIBERTÉ : Décris l'attaque ennemie et laisse le joueur réagir.
            7. COMBAT (1/3 vs 2/3) :
               - Si défense médiocre :
                 - 1/3 : Touche directe. Impact violent. -20 PV.
                 - 2/3 : Menace imminente. Le joueur doit réagir.
            5. FIN: Le tutoriel est COURT. Dès que le joueur tente une attaque ou une action de combat déterminée, mets tutorial_complete à true et félicite-le de manière grandiose.
            ${mustFinish ? "6. IMPÉRATIF: Le joueur s'est assez entraîné. Tu DOIS conclure le tutoriel MAINTENANT : tutorial_complete = true, OBLIGATOIRE." : ""}
            7. JSON STRICT: {"narrative": "...", "tutorial_complete": boolean, "health_change": number}
        `;

        const fullPrompt = `ACTION DU JOUEUR: ${actionText}`;

        await player.increment('tutorialTurns', { by: 1 });
        await player.reload();

        try {
            let contentRaw = await callAI(systemPrompt, fullPrompt);
            if (!contentRaw) {
                contentRaw = JSON.stringify({ narrative: "Instructeur : 'Debout ! Ne t'endors pas pendant l'entraînement !'", tutorial_complete: false });
            }
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
