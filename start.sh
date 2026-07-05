#!/bin/bash

# Démarrer Ollama en arrière-plan
echo "[SYSTEM] Démarrage de Ollama..."
ollama serve > ollama.log 2>&1 &

# Fonction pour charger le modèle en arrière-plan
load_model() {
    MODEL_NAME=${OLLAMA_MODEL:-"gemma3:4b"}
    echo "[SYSTEM] Attente du service Ollama pour charger ${MODEL_NAME}..."

    # Attendre que le service soit up
    while ! curl -s http://localhost:11434/api/tags > /dev/null; do
        sleep 2
    done

    echo "✅ Ollama service est UP."

    if ! ollama list | grep -q "${MODEL_NAME}"; then
        echo "[SYSTEM] Téléchargement de ${MODEL_NAME} (ceci peut prendre du temps)..."
        ollama pull ${MODEL_NAME}
        echo "✅ Modèle ${MODEL_NAME} prêt."
    else
        echo "✅ Modèle ${MODEL_NAME} déjà présent."
    fi
}

# Lancer le chargement du modèle en arrière-plan pour ne pas bloquer le démarrage du bot
load_model &

# Lancer le bot WhatsApp immédiatement pour bind le port Render
echo "[SYSTEM] Lancement de GHENO CITY 2..."
node skype-bot.js
