#!/bin/bash

echo "=========================================================="
echo "    INSTRUCTEUR D'INSTALLATION LOCAL GEMMA 4 - ARIS BOT   "
echo "=========================================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null
then
    echo "❌ Ollama n'est pas installé sur votre machine."
    echo "👉 Pour l'installer automatiquement :"
    echo "   - Sur macOS / Linux : curl -fsSL https://ollama.com/install.sh | sh"
    echo "   - Sur Windows : Téléchargez l'installateur sur https://ollama.com"
    echo ""
    exit 1
fi

echo "✅ Ollama détecté !"
echo "📥 Téléchargement et lancement du modèle Gemma 4 (31B ou standard)..."
echo "Cela peut prendre quelques minutes selon votre connexion internet."
echo ""

# Start Ollama service if not already running (mostly for Linux/macOS)
if ! pgrep -x "ollama" > /dev/null
then
    echo "⚙️ Démarrage du service Ollama en arrière-plan..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
fi

# Run gemma4
ollama run gemma4

echo ""
echo "=========================================================="
echo "✅ Gemma 4 est maintenant actif localement et prêt pour le bot !"
echo "=========================================================="
