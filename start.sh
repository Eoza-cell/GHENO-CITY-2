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

# Pré-charger le modèle gemma3:4b (Fallback local) en arrière-plan pour ne pas bloquer le démarrage du bot
(
    echo "[SYSTEM] Vérification du modèle gemma3:4b..."
    if ! ollama list | grep -q "gemma3:4b"; then
        echo "[SYSTEM] Téléchargement de gemma3:4b (en arrière-plan)..."
        ollama pull gemma3:4b
        echo "✅ Modèle gemma3:4b prêt."
    else
        echo "✅ Modèle gemma3:4b déjà présent."
    fi
) &

# Lancer le bot WhatsApp
echo "[SYSTEM] Lancement de GHENO CITY 2..."
node skype-bot.js
