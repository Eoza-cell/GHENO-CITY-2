const Groq = require('groq-sdk');
const { Player, Vehicle, PlayerVehicle } = require('./database');
const { isDay } = require('./gheno-city');
const { sendWithImage } = require('./command-handler');
const { locations, vehicles, weapons, shops } = require('./data'); // Importer les données centralisées

// IMPORTANT: La clé API de l'utilisateur doit être définie comme variable d'environnement `GROQ_API_KEY`
// sur la plateforme de déploiement.
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
    4.  **Format de réponse**: Tu DOIS répondre avec un objet JSON valide, et rien d'autre. L'objet doit avoir la structure suivante: \`{"action": "type_action", "parameters": {...}, "narrative": "texte_pour_le_joueur"}\`
    5.  **Créativité Narrative**: Tu peux ajouter des prompts pour la génération d'images dans tes narratives en utilisant le format \`[POLLINATION PROMPT: description de l'image]\`.

    TYPES D'ACTIONS POSSIBLES DANS LE JSON:
    - \`"action": "move"\`: Pour déplacer le joueur.
      - \`"parameters": {"destination": "nom_du_lieu"}\`
    - \`"action": "buy"\`: Pour acheter un véhicule.
      - \`"parameters": {"vehicleName": "nom_du_vehicule"}\`
    - \`"action": "narrate"\`: Pour toute action qui ne change pas l'état du jeu (regarder autour, parler à un PNJ, etc.).
      - \`"parameters": {}\`
    - \`"action": "error"\`: Si l'action du joueur est impossible ou illogique.
      - \`"parameters": {"reason": "description_de_l_erreur"}\`

    CONTEXTE ACTUEL:
    ---
    ${playerState}
    ---
    INVENTAIRE DE LA BOUTIQUE:
    ---
    ${shopInventory}
    ---
  `;

  // 2. Envoyer la requête à Groq
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: actionText },
      ],
      model: 'llama3-70b-8192',
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const aiResponse = JSON.parse(chatCompletion.choices[0].message.content);

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

      default:
        await sock.sendMessage(jid, { text: "L'IA a renvoyé une action inconnue. Réessaye." });
    }
  } catch (error) {
    console.error('Erreur détaillée de l\'API Groq:', error);

    let userMessage = "Le cerveau de la ville est en surchauffe... Une erreur est survenue avec l'IA. Réessaye ton action.";

    // Check if it's a Groq API error to provide more specific (but safe) feedback
    if (error instanceof Groq.APIError) {
      console.error('Status Code:', error.status);
      console.error('Error Type:', error.error?.type);
      console.error('Error Message:', error.error?.message);
      // Don't expose API key details to the user, but maybe give a hint if it's an auth error
      if (error.status === 401) {
        userMessage = "Erreur de connexion avec le cerveau de la ville. Le gardien des clés ne répond pas. (Problème d'authentification)";
      } else if (error.status >= 500) {
        userMessage = "Le cerveau de la ville subit une défaillance majeure. Les ingénieurs ont été alertés. (Erreur Serveur IA)";
      }
    }
    await sock.sendMessage(jid, { text: userMessage });
  }
}

module.exports = { handleFreeAction, locations };
