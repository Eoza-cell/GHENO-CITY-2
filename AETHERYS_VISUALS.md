# AETHERYS — intégration du dossier visuel

Le dépôt contient déjà le pack visuel AETHERYS.

## Chargement

Au démarrage de skype-bot.js, prepareAetherysVisualPack() :
- lit le pack local sans appel à un service externe ;
- extrait les planches image dans assets/world/pages/ ;
- écrit assets/world/manifest.json ;
- prépare les portraits de Darius Freindry et Elysia Von Argentia dans assets/world/portraits/ ;
- ignore les planches qui ne sont pas adaptées à l'intégration.

Les fichiers extraits sont régénérés au démarrage. Leur absence ne bloque pas le démarrage de WhatsApp.

## Utilisation dans le bot

- /map : carte officielle du dossier AETHERYS, avec la liste des royaumes issue de la base de données.
- /world : atlas vivant et carte officielle.
- /lieux : position actuelle avec décor et portrait d'un PNJ présent, lorsqu'un visuel est disponible.
- /academies ou /uniformes : galerie des planches d'uniformes et d'académies.

Pendant une action RP, ai-handler.js utilise déjà buildSceneVisual() : les décors et portraits sont donc envoyés automatiquement lors d'un changement de scène visuelle.

## Références intégrées

- Elion : page 47
- Valkyrr : page 48
- Sylva-Lumia : page 49
- Gheno : page 50
- Interstice : page 51
- Nécropolis / Vharos : page 46
- Abysse inférieur : page 44
- Carte du monde : page 81, avec la page 84 en solution de repli
- Uniformes et académies : pages 75, 78, 82, 83, 85 et 86, plus les références de vêtements du catalogue.

Les profils de Darius Freindry et Elysia Von Argentia sont ajoutés à la liste des PNJ avec leurs portraits extraits des fiches du dossier.

## Données préservées

Cette intégration ne réinitialise ni les joueurs, ni leurs inventaires, ni les quêtes, ni les identifiants WhatsApp. Les références visuelles sont locales au dépôt et n'ajoutent aucun fournisseur d'images payant.
