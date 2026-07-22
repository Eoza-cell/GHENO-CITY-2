# Aetherys AI API (Render)

Ce projet est une API autonome permettant de faire tourner un modèle de langage (LLM) léger sur Render en utilisant `llama.cpp` et Node.js.

## Installation et Déploiement

1. Créez un nouveau service "Web Service" sur Render.
2. Connectez votre dépôt GitHub contenant ce dossier.
3. Render détectera automatiquement le `Dockerfile`.
4. Assurez-vous d'ajouter un **Disk** (Disque Persistant) dans les réglages Render :
   - **Name**: `model-storage`
   - **Mount Path**: `/app/models`
   - **Size**: 1GB (ou plus selon le modèle)

## Variables d'Environnement

- `MODEL_URL` : Lien direct vers le fichier `.gguf` sur Hugging Face. (Par défaut : Qwen2.5-0.5B)
- `PORT` : Port d'écoute (géré par Render).

## Utilisation de l'API

### Route : `POST /generate`

**Corps de la requête :**
```json
{
  "prompt": "Bonjour, comment vas-tu ?",
  "max_tokens": 300,
  "temperature": 0.8
}
```

**Réponse :**
```json
{
  "response": "Bonjour ! Je suis une intelligence artificielle..."
}
```

## Connexion avec votre Bot WhatsApp (Node.js)

Voici comment appeler cette API depuis votre code principal (par exemple dans `ai-utils.js`) :

```javascript
async function callExternalAI(prompt) {
    const API_URL = "https://votre-app-ai.onrender.com/generate";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Échec de l'appel à l'IA externe:", error);
        return "Désolé, je ne peux pas répondre pour le moment.";
    }
}
```

## Optimisations incluses
- **Qwen2.5-0.5B** : Modèle extrêmement léger (environ 400MB de RAM) idéal pour les plans gratuits/low-cost.
- **llama-server** : Moteur performant en C++.
- **n_ctx 1024** : Fenêtre de contexte réduite pour minimiser l'usage mémoire.
- **Persistence** : Le modèle n'est téléchargé qu'une seule fois grâce au disque Render.
