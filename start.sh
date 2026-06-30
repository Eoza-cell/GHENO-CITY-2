#!/bin/bash

# Démarrer Ollama en arrière-plan
# On redirige la sortie pour éviter de polluer les logs de Render inutilement,
# mais on garde le processus en vie.
ollama serve > /dev/null 2>&1 &

# Le bot et le model-server s'occupent maintenant de vérifier et de pull
# les modèles automatiquement en arrière-plan de manière non-bloquante.

# Lancer le bot WhatsApp (qui lancera aussi le model-server)
node skype-bot.js
