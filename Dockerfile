FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    ca-certificates \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

COPY start.sh /start.sh
RUN chmod +x /start.sh

# Exposer le port pour le model-server (et potentiellement health check)
EXPOSE 3001
# Note: Skype bot utilise généralement le port 3000 par défaut sur Render
EXPOSE 3000

CMD ["/start.sh"]
