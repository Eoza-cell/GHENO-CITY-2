/**
 * AetherNarration: Procedural Narration Engine (The True "IA codée de 0")
 * Generates vast possibilities of response through fragment recombination.
 * Handles Anime tropes, Academy chill, Ecchi scenes, and powerful player domination.
 */

class AetherNarration {
    constructor() {
        this.onomatopoeias = ["BAM!", "SHRING!", "DODODO!", "KYAAAA!", "ZAP!", "BOOM!", "SWISH!", "THUD!"];

        this.fragments = {
            intro: [
                "L'air vibre sous ton impulsion.",
                "Dans un silence de mort, l'action se dessine.",
                "Les yeux fixés sur ta cible, tu t'élances.",
                "Le système Aetherys valide ta trajectoire.",
                "Une aura intense se dégage de ton corps.",
                "Le monde semble ralentir autour de toi.",
                "Une brise légère soulève la poussière du sol.",
                "Ton mana crépite, réagissant à ta volonté.",
                "Le destin se courbe devant ton intention.",
                "Une ombre fugace traverse ton regard déterminé.",
                "Chaque fibre de ton être est prête pour cet instant.",
                "L'Ether environnant se densifie brutalement.",
                "Un frisson parcourt l'assemblée alors que tu bouges.",
                "Tes sens, aiguisés par l'expérience, captent chaque détail.",
                "La réalité se distord légèrement à ton contact.",
                "L'instant est suspendu, comme gravé dans le cristal.",
                "Une pression invisible s'abat sur ton entourage.",
                "Tes muscles se bandent, chargés d'une énergie brute.",
                "Le sifflement du vent accompagne ton mouvement.",
                "Une lueur étrange brille au fond de tes pupilles."
            ],
            detail: [
                "alors que la poussière tourbillonne autour de tes pieds,",
                "tandis qu'une odeur de fer et d'ozone emplit l'air,",
                "sous le regard médusé des témoins de la scène,",
                "pendant que ton ombre s'étire de façon surnaturelle,",
                "au rythme des battements sourds de ton cœur,",
                "dans un éclat de lumière argentée éblouissante,",
                "alors que les lois de la physique semblent vaciller,",
                "avec une précision qui défie toute logique humaine,",
                "pendant que le flux de l'Ether chante à tes oreilles,",
                "sous une pluie de particules magiques scintillantes,"
            ],
            combat: {
                easy: [
                    "D'un geste nonchalant, tu balayes l'ennemi. *SHRING!* La différence de niveau est absolue.",
                    "Ton adversaire ne voit même pas ton coup venir. *BAM!* Il s'effondre comme une poupée de chiffon.",
                    "La puissance qui émane de toi suffit à briser sa garde. Tu l'écrases sans effort.",
                    "Un simple mouvement du poignet et le combat est terminé. *DODODO!* Trop facile.",
                    "Tu souris face à sa lenteur. D'une frappe précise, tu neutralises la menace avec élégance.",
                    "Tu marches à travers l'attaque ennemie comme s'il s'agissait de pluie. Une contre-attaque éclair règle le compte.",
                    "La terre tremble sous ton premier pas. L'ennemi recule, terrifié, avant de subir l'inévitable. *BOOM!*",
                    "D'un claquement de doigts, ton mana subjugue l'adversaire. Il tombe à genoux, brisé.",
                    "Ton arme décrit un arc parfait. Sang et poussière retombent en silence. Victoire instantanée.",
                    "Sans même te mettre en garde, tu évites chaque coup et frappes le point vital. *SWISH!*",
                    "L'adversaire est balayé comme un fétu de paille face à un ouragan. Tu ne ralentis même pas.",
                    "Une simple pression de ton aura suffit à faire craquer ses os. Le combat est déjà fini.",
                    "Tu l'observes avec un mépris froid avant de porter le coup de grâce. Une exécution parfaite.",
                    "Il n'y a aucune gloire dans ce massacre, juste la réalité brutale des chiffres.",
                    "Ta lame traverse sa défense comme si elle n'existait pas. Le résultat était écrit."
                ],
                hard: [
                    "Le choc est brutal. L'acier hurle contre l'acier. *BOOM!* Le sol se fissure.",
                    "Tu esquives de justesse une contre-attaque vicieuse. Ton souffle devient court.",
                    "Le sang gicle, la douleur est réelle. Le combat est une danse mortelle sur le fil du rasoir.",
                    "Chaque coup échangé fait trembler l'atmosphère. Tu dois tout donner.",
                    "Une lutte féroce s'engage. Vos auras s'entrechoquent dans une explosion de mana.",
                    "Tes muscles brûlent sous l'effort. L'ennemi est tenace, chaque erreur pourrait être la dernière.",
                    "Un impact dévastateur te propulse en arrière. Tu te relèves, crachant un peu de sang. *THUD!*",
                    "Les lames s'entrecroisent dans un déluge d'étincelles. Le rythme est effréné.",
                    "La sueur pique tes yeux alors que tu cherches une ouverture dans cette garde impénétrable.",
                    "L'adrénaline inonde ton système. C'est le moment de vérité, la mort rôde.",
                    "Chaque mouvement est un pari contre le destin. Ton endurance est mise à rude épreuve.",
                    "La violence de l'échange laisse des marques profondes sur l'environnement.",
                    "Tu sens la fatigue peser sur tes membres, mais ta volonté refuse de faiblir.",
                    "Un cri de rage s'échappe de ta gorge alors que vous repartez à l'assaut.",
                    "L'issue est incertaine, le chaos règne au centre de cet affrontement."
                ]
            },
            academy: [
                "L'ambiance à l'académie est électrique aujourd'hui. On entend les rires des élèves au loin.",
                "Sensei Sora passe en baillant, un magazine sous le bras. 'Encore vous ?'",
                "Maya te fait un signe discret de la main, ses lunettes brillant sous les néons magiques.",
                "Dans les couloirs, les duels d'entraînement se terminent souvent en éclats de rire.",
                "C'est le moment idéal pour une pause. L'odeur du pain de mana flotte dans l'air.",
                "Un malentendu drôle éclate entre deux étudiants juste à côté de toi.",
                "La bibliothèque est calme, mais une tension romantique semble flotter entre deux rayons.",
                "Un cours de magie s'achève par une explosion mineure et des visages barbouillés de suie.",
                "Les rumeurs circulent vite ici : il paraît qu'un nouvel élève a défié un Apôtre.",
                "Une brise printanière soulève les rideaux des salles de classe, apportant une douce sérénité.",
                "Une dispute absurde pour une place à la cafétéria anime le couloir principal.",
                "On chuchote que l'examen de demain sera le plus difficile de la décennie.",
                "Lukas essaie d'impressionner un groupe de filles avec une technique de flammes un peu trop voyante.",
                "Le tableau des scores affiche des résultats surprenants pour les nouveaux arrivants.",
                "Une élève court avec un morceau de pain dans la bouche, en retard pour son premier cours."
            ],
            ecchi: [
                "Une proximité troublante s'installe. Tu sens le souffle de l'autre contre ta peau.",
                "D'un geste maladroit, un vêtement glisse, révélant une courbe délicate. *KYAAAA!*",
                "Le regard est intense, chargé de sous-entendus. L'atmosphère devient lourde de désir.",
                "Une goutte de sueur perle sur son front, glissant lentement vers son décolleté.",
                "Dans la vapeur de la douche, les silhouettes se dessinent de manière suggestive.",
                "Un contact accidentel provoque un rougissement immédiat et une tension électrique.",
                "Ses doigts effleurent ton bras, déclenchant une onde de chaleur inattendue.",
                "La tenue est un peu trop serrée, mettant en valeur chaque forme avec une précision cruelle.",
                "Une chute maladroite vous fait atterrir l'un sur l'autre dans une position embarrassante.",
                "Le silence qui suit cette remarque est rempli d'une tension charnelle palpable.",
                "Un courant d'air malicieux soulève une jupe, provoquant une confusion générale.",
                "Le contact de ses mains, bien qu'accidentel, laisse une trace brûlante sur ta peau.",
                "Les yeux s'égarent malgré eux vers des détails anatomiques particulièrement troublants.",
                "La chaleur de la pièce devient soudainement insupportable alors que vos corps se rapprochent.",
                "Un murmure à l'oreille, trop proche pour être innocent, te fait frissonner."
            ],
            social: [
                "Le dialogue s'installe naturellement. Les mots pèsent leur poids de mana.",
                "On t'écoute avec attention. Ton influence dans ce monde grow.",
                "Un secret semble se cacher derrière ce sourire énigmatique.",
                "L'échange est fructueux, tu sens une connexion s'établir avec ton interlocuteur.",
                "Une rumeur intéressante parvient à tes oreilles pendant la discussion.",
                "Ton interlocuteur semble impressionné par ton aura. Ses mots deviennent plus prudents.",
                "Un rire partagé brise la glace, ouvrant la voie à une collaboration future.",
                "Les regards s'attardent un peu trop longtemps, trahissant un intérêt plus que professionnel.",
                "L'information que tu as obtenue pourrait bien changer le cours de ton aventure.",
                "Chaque phrase est une joute verbale où tu sembles avoir l'avantage.",
                "On sent que chaque mot est soigneusement choisi pour tester tes réactions.",
                "La conversation dévie sur des sujets plus personnels, révélant une facette cachée de l'interlocuteur.",
                "Un accord tacite semble avoir été passé entre vous deux sans un mot de plus.",
                "Tu décèles une pointe d'inquiétude dans sa voix, malgré son assurance apparente.",
                "L'autorité qui émane de tes propos force le respect de l'assemblée."
            ],
            movement: [
                "Tes pas te mènent vers de nouveaux horizons. L'aventure t'appelle.",
                "Le paysage change à mesure que tu avances, révélant la grandeur d'Aetherys.",
                "Tu arrives à destination, prêt pour ce qui t'attend dans ce nouveau lieu.",
                "La transition se fait sans encombre. Tes sens sont en alerte.",
                "Le voyage est calme, te laissant le temps de méditer sur ton prochain mouvement.",
                "Tu traverses des paysages à couper le souffle, du cristal pur aux forêts d'ombre.",
                "Ton arrival ne passe pas inaperçue ; les locaux te dévisagent avec curiosité.",
                "Un raccourci inattendu te fait gagner un temps précieux à travers l'Interstice.",
                "Le vent siffle à tes oreilles alors que tu te déplaces à une vitesse impressionnante.",
                "Chaque foulée renforce ta connexion avec cette terre mystique.",
                "Tu franchis une arche ancienne, sentant le changement de mana entre les régions.",
                "Le chemin est escarpé, mais ta détermination te pousse toujours plus loin.",
                "Une sensation de liberté t'envahit alors que tu laisses la ville derrière toi.",
                "Les échos de tes pas résonnent contre les parois de pierre millénaires.",
                "Une nouvelle carte se dessine dans ton esprit à mesure que tu explores l'inconnu."
            ],
            outcome: [
                "laissant derrière toi un sillage d'étonnement.",
                "marquant l'histoire de ce lieu à jamais.",
                "pendant que le système confirme la validité de l'acte.",
                "alors que les répercussions de ce geste commencent à se faire sentir.",
                "consolidant ta réputation parmi les Heritiers.",
                "ouvrant une voie que peu osent emprunter.",
                "déclenchant une série d'événements imprévisibles.",
                "prouvant une fois de plus ta valeur dans ce monde cruel.",
                "tandis que les fils de la Causalité se resserrent.",
                "dans un final digne des plus grandes légendes."
            ],
            outro: [
                "Le système enregistre tes progrès.",
                "La Causalité est en marche.",
                "L'histoire d'Aetherys continue de s'écrire par tes actes.",
                "Tout est calme... pour le moment.",
                "Ton destin semble s'éclaircir un peu plus.",
                "Les étoiles d'Aetherys brillent sur tes ambitions.",
                "Un nouveau chapitre s'ouvre, dicté par ta volonté.",
                "L'ombre se retire, mais pour combien de temps ?",
                "Le flux de l'Ether se stabilise autour de toi.",
                "Tu sens que le monde a été modifié par ton passage.",
                "La matrice bourdonne, satisfaite de ce nouvel apport d'énergie.",
                "Rien ne sera plus jamais comme avant après cet instant.",
                "Tu poursuis ton chemin, le regard tourné vers l'avenir.",
                "Le silence retombe, lourd de sens et de promesses.",
                "Aetherys te regarde, attendant ton prochain défi."
            ]
        };
    }

    /**
     * Generates a unique narration based on parsed intent and context.
     * With randomized fragments, this provides millions of potential combinations.
     */
    generate(comprehension, player, actionText, loreContext) {
        const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const intro = rand(this.fragments.intro);
        const detail = rand(this.fragments.detail);
        const outcome = rand(this.fragments.outcome);
        const outro = rand(this.fragments.outro);
        const ono = rand(this.onomatopoeias);

        const intent = comprehension.primaryIntent;
        const isPowerful = comprehension.isPowerful;

        let core = "";

        // 1. Core Logic Selection
        if (intent === 'COMBAT') {
            core = isPowerful ? rand(this.fragments.combat.easy) : rand(this.fragments.combat.hard);
        } else if (comprehension.atmosphere === 'academy') {
            core = rand(this.fragments.academy);
            if (intent === 'SOCIAL') core += " " + rand(this.fragments.social);
        } else if (comprehension.atmosphere === 'ecchi') {
            core = rand(this.fragments.ecchi);
        } else {
            if (intent === 'MOVEMENT') core = rand(this.fragments.movement);
            else if (intent === 'SOCIAL') core = rand(this.fragments.social);
            else if (intent === 'UTILITY') core = "Tu manipules tes possessions avec soin, optimisant ton équipement pour les défis à venir.";
            else core = "Tu agis avec détermination, sentant le flux de l'Ether t'accompagner.";
        }

        // 2. Fragment Expansion
        core = core.replace(/ton adversaire/gi, comprehension.targets[0]?.name || "l'adversaire");

        // 3. Narrative Assembly (The 7-Layer Recombination)
        // Millions of combinations: 20 * 10 * 15 * 10 * 20 * 8 = 4.8 million base
        // With expanded lists: 20 (intro) * 10 (detail) * 15 (core) * 10 (outcome) * 15 (outro) * 8 (ono) = 36 million combinations.
        let narrative = `${intro} ${detail} ${core} ${outcome} ${ono}\n\n${outro}`;

        // 4. Brain Polish
        if (comprehension.isPowerful && intent === 'COMBAT') {
            narrative += "\n\n*Ta supériorité est telle que tes ennemis ne sont que des ombres fuyantes.*";
        }

        return narrative;
    }
}

module.exports = new AetherNarration();
