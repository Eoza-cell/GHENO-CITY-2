# Étape 1 : Construction de llama.cpp
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# On clone llama.cpp
RUN git clone https://github.com/ggerganov/llama.cpp.git

WORKDIR /app/llama.cpp

# On compile le serveur
RUN cmake -B build -DGGML_CUDA=OFF
RUN cmake --build build --config Release --target llama-server

# Étape 2 : Runtime Node.js
FROM node:20-bookworm-slim

WORKDIR /app

# On récupère le binaire compilé
COPY --from=builder /app/llama.cpp/build/bin/llama-server ./llama-server

# Copie des fichiers du projet Node
COPY package*.json ./
RUN npm install --production

COPY . .

# Création du dossier models
RUN mkdir -p models

# Droits d'exécution pour le binaire
RUN chmod +x ./llama-server

EXPOSE 3000

CMD ["npm", "start"]
