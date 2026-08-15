const axios = require('axios');

/**
 * Fonction ultra-simple pour appeler l'IA via Pollinations (gratuit et sans clé nécessaire)
 * @param {string} systemPrompt Instructions pour l'IA
 * @param {string} userPrompt Message de l'utilisateur
 * @returns {Promise<string>} Réponse textuelle de l'IA
 */
async function callAI(systemPrompt, userPrompt) {
  try {
    const payload = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: 'openai',
      cache: false
    };

    const resp = await axios.post("https://text.pollinations.ai/", payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    if (resp.data) {
      return resp.data.trim();
    }
  } catch (e) {
    console.error("[AI] Erreur lors de l'appel à l'IA:", e.message);
  }
  return "Désolé, je rencontre des difficultés pour me connecter à mon cerveau IA actuellement.";
}

module.exports = { callAI };
