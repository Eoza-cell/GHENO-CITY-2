const https = require('https');
const { Player, Vehicle, PlayerVehicle } = require('./database');
const { isDay } = require('./gheno-city');
const { sendWithImage } = require('./command-handler');
const { getMission } = require('./missions');

// Données de localisation - cela fera partie du contexte donné à l'IA
const locations = {
  'Little Sicily': {
    description: "Ton quartier natal. Un peu miteux, mais c'est chez toi. C'est un quartier résidentiel avec des petites rues et des immeubles en briques.",
    connections: ['dealership'],
  },
  'dealership': {
    description: "Une concession de voitures d'occasion. L'odeur de l'essence et des rêves brisés flotte dans l'air. Des voitures sont alignées sous des néons clignotants.",
    connections: ['Little Sicily'],
  },
};

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  // 1. Construire le contexte pour l'IA
  const playerState = `
    - Nom: ${player.name}
    - Argent: ${player.money}$
    - Emplacement actuel: ${player.location} (${locations[player.location].description})
    - Destinations possibles: ${locations[player.location].connections.join(', ')}
  `;

  let shopInventory = "Aucun magasin ici.";
  if (player.location === 'dealership') {
    if (isDay()) {
      const vehicles = await Vehicle.findAll({ attributes: ['name', 'price'] });
      shopInventory = "Véhicules disponibles à l'achat:\n" + vehicles.map(v => `- ${v.name}: ${v.price}$`).join('\n');
    } else {
      shopInventory = "Le concessionnaire est fermé pour la nuit.";
    }
  }

  const systemPrompt = `
    Tu es l'IA maître du jeu pour "Gheno City 2", un RPG textuel ultra-réaliste et immersif.
    Ton rôle est d'interpréter les actions libres des joueurs et de faire avancer l'histoire.

    RÈGLES IMPÉRATIVES:
    1.  **Réalisme absolu**: Rien n'est magique. Les actions doivent être logiques. Un joueur ne peut pas se téléporter ou faire apparaître des objets.
    2.  **Immuabilité du monde**: Tu ne peux pas changer les règles du jeu, les prix des objets, ou l'état du monde qui ne dépend pas du joueur.
    3.  **Respecte le contexte**: Base tes réponses UNIQUEMENT sur l'état du joueur et le contexte que je te fournis.
    4.  **Format de réponse**: Tu DOIS répondre avec un objet JSON valide, et rien d'autre. L'objet doit avoir la structure suivante: {"action": "type_action", "parameters": {...}, "narrative": "texte_pour_le_joueur"}
    5.  **Créativité Narrative**: Tu peux ajouter des prompts pour la génération d'images dans tes narratives en utilisant le format [POLLINATION PROMPT: description de l'image].

    TYPES D'ACTIONS POSSIBLES DANS LE JSON:
    - "action": "move": Pour déplacer le joueur.
      - "parameters": {"destination": "nom_du_lieu"}
    - "action": "buy": Pour acheter un véhicule.
      - "parameters": {"vehicleName": "nom_du_vehicule"}
    - "action": "narrate": Pour toute action qui ne change pas l'état du jeu (regarder autour, parler à un PNJ, etc.).
      - "parameters": {}
    - "action": "error": Si l'action du joueur est impossible ou illogique.
      - "parameters": {"reason": "description_de_l_erreur"}
    - "action": "complete_quest": Quand le joueur a rempli l'objectif de sa mission actuelle.
      - "parameters": {}

    CONTEXTE ACTUEL:
    ---
    ${playerState}
    ---
    INVENTAIRE DE LA BOUTIQUE:
    ---
    ${shopInventory}
    ---
  `;

  // 2. Envoyer la requête à Pollination
  try {
    const postData = JSON.stringify({
      // Remplacer "openai" par un modèle plus probable comme "llama-3"
      model: "llama-3",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: actionText }
      ],
      stream: false,
      // jsonMode: true, // json_mode n'est peut-être pas supporté, l'enlever pour le test
    });

    const options = {
      hostname: 'api.pollinations.ai', // L'API principale est peut-être sur un autre sous-domaine
      path: '/openai',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 15000, // 15 secondes de timeout
    };

    const aiApiResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`La requête à Pollination a échoué avec le code: ${res.statusCode}`));
        }
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            // Log the raw response for debugging before parsing
            console.log("Raw Pollination API Response:", data);
            resolve(JSON.parse(data));
          } catch (e) {
            console.error("Failed to parse Pollination JSON response:", e);
            reject(new Error("Impossible de parser la réponse de l'API Pollination."));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error("La requête à Pollination a expiré."));
      });

      req.write(postData);
      req.end();
    });

    // La réponse de l'IA est imbriquée, nous devons l'extraire et la parser.
    const aiResponseContent = aiApiResponse.choices[0].message.content;
    const aiResponse = JSON.parse(aiResponseContent);

    // 3. Traiter la décision de l'IA
    switch (aiResponse.action) {
      case 'move':
        const destination = aiResponse.parameters.destination;
        if (locations[destination] && locations[player.location].connections.includes(destination)) {
          await player.update({ location: destination });
          await sendWithImage(sock, jid, aiResponse.narrative);
        } else {
          await sock.sendMessage(jid, { text: `L'IA a essayé de te déplacer vers un lieu invalide (${destination}). Réessaye.` });
        }
        break;

      case 'buy':
        const vehicleName = aiResponse.parameters.vehicleName;
        const vehicle = await Vehicle.findOne({ where: { name: vehicleName } });
        if (player.location !== 'dealership' || !isDay()) {
             await sock.sendMessage(jid, { text: "L'IA a compris que tu voulais acheter, mais le concessionnaire est fermé ou tu n'es pas au bon endroit." });
             break;
        }
        if (vehicle && player.money >= vehicle.price) {
          await player.update({ money: player.money - vehicle.price });
          await PlayerVehicle.create({
            PlayerWhatsappId: player.whatsappId,
            VehicleId: vehicle.id,
          });
          await sendWithImage(sock, jid, aiResponse.narrative);
        } else if (vehicle) {
           await sock.sendMessage(jid, { text: `L'IA a compris que tu voulais acheter une "${vehicleName}", mais tu n'as pas assez d'argent.` });
        } else {
           await sock.sendMessage(jid, { text: `L'IA a tenté de te vendre un véhicule qui n'existe pas ("${vehicleName}").` });
        }
        break;

      case 'narrate':
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'error':
        const errorNarrative = aiResponse.narrative || aiResponse.parameters.reason;
        await sendWithImage(sock, jid, errorNarrative);
        break;

      case 'complete_quest':
        const currentMission = getMission(player.chapter, player.quest);
        if (currentMission) {
            player.money += currentMission.reward.money || 0;
            player.xp += currentMission.reward.xp || 0;
            if (currentMission.nextQuest) {
                player.quest = currentMission.nextQuest;
            } else {
                // Handle chapter completion if necessary
                player.quest = 0; // 0 can signify no active quest
            }
            await player.save();
        }
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      default:
        await sock.sendMessage(jid, { text: "L'IA a renvoyé une action inconnue. Réessaye." });
    }
  } catch (error) {
    console.error('Erreur de communication avec l\'API Pollination:', error);
    await sock.sendMessage(jid, { text: "Le cerveau de la ville est en surchauffe... Une erreur est survenue avec l'IA. Réessaye ton action." });
  }
}

module.exports = { handleFreeAction, locations };
