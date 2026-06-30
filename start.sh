#!/bin/bash

# Démarrer Ollama en arrière-plan
ollama serve &

# Attendre que le service soit prêt
sleep 10

# Télécharger le modèle (Gemma 4)
# On ajoute un fallback vers gemma2:2b au cas où gemma4 n'est pas encore disponible sur le registry public
ollama pull gemma4:4b || ollama pull gemma2:2b

# Lancer le bot WhatsApp
node skype-bot.js
