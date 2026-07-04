FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    ca-certificates \
    lsof \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

COPY start.sh /start.sh
RUN chmod +x /start.sh

# Note: Skype bot utilise généralement le port 3000 par défaut sur Render
EXPOSE 3000

CMD ["/start.sh"]
