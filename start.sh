#!/bin/bash

# Démarrer Ollama en arrière-plan
echo "[SYSTEM] Démarrage de Ollama..."
ollama serve > ollama.log 2>&1 &

# Attendre que Ollama soit prêt
echo "[SYSTEM] Attente du service Ollama (localhost:11434)..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null; then
        echo "✅ Ollama est prêt."
        break
    fi
    sleep 2
done

# Pré-charger le modèle configuré (Gratuit et illimité)
MODEL_NAME=${OLLAMA_MODEL:-"gemma3:4b"}
echo "[SYSTEM] Vérification du modèle ${MODEL_NAME}..."
if ! ollama list | grep -q "${MODEL_NAME}"; then
    echo "[SYSTEM] Téléchargement de ${MODEL_NAME}..."
    ollama pull ${MODEL_NAME}
    echo "✅ Modèle ${MODEL_NAME} prêt."
else
    echo "✅ Modèle ${MODEL_NAME} déjà présent."
fi

# Lancer le bot WhatsApp
echo "[SYSTEM] Lancement de GHENO CITY 2..."
node skype-bot.js
