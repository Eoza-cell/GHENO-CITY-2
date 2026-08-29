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

# Modèle à installer : surchargeable via OLLAMA_MODEL, sinon la variante
# e4b (rapide, tourne sur la plupart des machines). Pour plus de qualité si
# tu as assez de VRAM : gemma4:12b, gemma4:26b ou gemma4:31b.
MODEL="${OLLAMA_MODEL:-gemma4:e4b}"

echo "📥 Téléchargement et lancement du modèle ${MODEL}..."
echo "Cela peut prendre quelques minutes selon votre connexion internet."
echo ""

# Start Ollama service if not already running (mostly for Linux/macOS)
if ! pgrep -x "ollama" > /dev/null
then
    echo "⚙️ Démarrage du service Ollama en arrière-plan..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
fi

# Download the model explicitly first (clearer error if it fails than via `run`)
ollama pull "$MODEL"

echo ""
echo "⚙️  Rappel : Ollama limite par défaut la fenêtre de contexte à 4K tokens,"
echo "   ce qui est trop court pour les longues parties d'ATR/GHENO CITY."
echo "   Le bot force déjà OLLAMA_NUM_CTX=32768 via ai-utils.js."
echo ""

echo "🔍 Vérification que le service répond..."
if curl -s -m 5 http://127.0.0.1:11434/api/tags > /dev/null; then
    echo "✅ Ollama répond bien sur http://127.0.0.1:11434"
else
    echo "⚠️  Ollama ne répond pas encore sur le port 11434. Vérifie 'ollama serve'."
fi

echo ""
echo "=========================================================="
echo "✅ ${MODEL} est maintenant actif localement et prêt pour le bot !"
echo "   (le bot l'utilisera automatiquement comme IA principale)"
echo "=========================================================="
