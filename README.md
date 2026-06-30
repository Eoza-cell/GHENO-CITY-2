GHENO CITY 2 - Serveur Gemma 4 Local

ARISE : GHENO CITY 2 est un jeu RPG immersif fonctionnant sur WhatsApp, propulsé par l'IA Gemma 4 de Google exécutée localement via Ollama. Ce projet est une version améliorée de GHENO-CITY-2 avec un serveur d'IA local autonome.

### Caractéristiques

* **IA Locale Gemma 4** - Plus besoin de clés API ! L'IA tourne entièrement sur votre machine
* **Jeu RPG sur WhatsApp** - Système complet de classes, quêtes, combats, économie
* **Monde vivant** - Royaumes, factions, PNJ, donjons, conflits dynamiques
* **Multi-joueurs** - Synchronisation des actions, tournois PVP, échanges
* **Base de données** - PostgreSQL ou SQLite pour la persistance

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GHENO CITY 2.0                          │
├──────────────────────┬──────────────────────────────────────┤
│   WhatsApp Bot       │   World Intelligence Server          │
│   (skype-bot.js)     │   (model-server.js)                  │
│                      │                                      │
│  - Commandes         │  - API compatible OpenAI             │
│  - Base de données   │  - Gemma 4 via Ollama                │
│  - Visuals           │  - Contexte monde enrichi            │
│  - Actions MJ        │  - Health check endpoint             │
└──────────┬───────────┴──────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
    ┌─────────────┐           ┌──────────────┐
    │  Baileys    │           │   Ollama     │
    │  (WhatsApp) │           │  (Gemma 4)   │
    └─────────────┘           └──────────────┘
```

### Prérequis

* Node.js 18+
* Ollama installé : [https://ollama.com](https://ollama.com)
* Gemma 4 téléchargé : `ollama pull gemma4:4b` (ou `gemma4:12b`)
* Un numéro de téléphone WhatsApp pour le bot

### Installation Rapide

1. **Installer Ollama et Gemma 4**
   ```bash
   # Installer Ollama (Linux/Mac)
   curl -fsSL https://ollama.com/install.sh | sh
   # Ou télécharger depuis https://ollama.com for Windows

   # Télécharger Gemma 4 (version 4B = ~3GB, version 12B = ~8GB)
   ollama pull gemma4:4b
   ```

2. **Cloner et Configurer le Projet**
   ```bash
   git clone https://github.com/Eoza-cell/GHENO-CITY-2.git
   cd GHENO-CITY-2
   cp .env.example .env
   ```

3. **Configurer le fichier .env**
   ```env
   # OBLIGATOIRE - Votre numéro WhatsApp avec indicatif pays
   PHONE_NUMBER=33612345678

   # Ollama / Gemma 4
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=gemma4:4b
   ```

4. **Installer les Dépendances**
   ```bash
   npm install
   ```

5. **Démarrer**
   ```bash
   # Mode simple - Démarre le bot + le serveur IA
   npm start

   # Mode développement (les deux en parallèle)
   npm run dev
   ```

### Commandes du Jeu

* `/start` - Commencer l'aventure
* `/menu` - Menu principal
* `/profile` - Voir ton profil
* `/action` - Mode RP immersif
* `/next` - Forcer la réponse du MJ
* `/map` - Carte du monde
* `/inventory` - Inventaire
* `/competences` - Techniques et sorts
* `/bank` - Compte en banque

### Configuration Gemma 4

Modifier dans `.env` :
`OLLAMA_MODEL=gemma4:4b` # ou gemma4:12b, gemma4:27b

### Licence

ISC
