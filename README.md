GHENO CITY 2 - Cloud Edition

ARISE : GHENO CITY 2 est un jeu RPG immersif fonctionnant sur WhatsApp, propulsé par les meilleures IA cloud (OpenRouter, Pollinations). Ce projet transforme WhatsApp en un monde de jeu dynamique où chaque décision façonne l'histoire.

### Caractéristiques

* **IA Cloud Performante** - Utilisation de Pollinations AI (Gratuit) et OpenRouter pour une narration sans faille.
* **Jeu RPG sur WhatsApp** - Système complet de classes, quêtes, combats, économie.
* **Monde vivant** - Royaumes, factions, PNJ, donjons, conflits dynamiques.
* **Multi-joueurs** - Synchronisation des actions, tournois PVP, échanges.
* **Base de données** - PostgreSQL ou SQLite pour la persistance.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GHENO CITY 2.0                          │
├─────────────────────────────────────────────────────────────┤
│   WhatsApp Bot (skype-bot.js)                               │
│                                                             │
│  - Commandes & Base de données                              │
│  - Visuals & Actions MJ                                     │
│  - Orchestration IA (Pollinations, OpenRouter)              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │  Baileys    │
                       │  (WhatsApp) │
                       └─────────────┘
```

### Prérequis

* Node.js 18+
* Un numéro de téléphone WhatsApp pour le bot
* (Optionnel) Une clé API OpenRouter pour plus de puissance

### Installation Rapide

1. **Cloner et Configurer le Projet**
   ```bash
   git clone https://github.com/Eoza-cell/GHENO-CITY-2.git
   cd GHENO-CITY-2
   cp .env.example .env
   ```

2. **Configurer le fichier .env**
   ```env
   # OBLIGATOIRE - Votre numéro WhatsApp avec indicatif pays
   PHONE_NUMBER=33612345678

   # OPTIONNEL - OpenRouter
   OPENROUTER_API_KEY=votre_clé_ici
   ```

3. **Installer les Dépendances**
   ```bash
   npm install
   ```

4. **Démarrer**
   ```bash
   npm start
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

### Licence

ISC
