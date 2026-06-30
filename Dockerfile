FROM node:22-bookworm

# Installer les dépendances système et Ollama
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app

# Installer les dépendances Node.js
COPY package*.json ./
RUN npm install

# Copier le reste du code
COPY . .

# Configuration de l'environnement
ENV OLLAMA_HOST=0.0.0.0:11434
ENV PORT=3000
ENV NODE_ENV=production

# Exposer le port pour le health check de Render
EXPOSE 3000

# Commande de démarrage : Lance Ollama en arrière-plan, attend qu'il soit prêt,
# télécharge le modèle par défaut, puis lance le bot.
# Note: On utilise gemma2:2b par défaut si gemma4 n'est pas encore disponible
CMD bash -c "ollama serve & sleep 10 && (ollama pull gemma4:4b || ollama pull gemma2:2b) && node skype-bot.js"
