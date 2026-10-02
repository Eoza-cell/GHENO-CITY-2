/**
 * AETHERIS / ATR — World location registry.
 *
 * Single source of truth for explicit player destinations.
 * Keep gameplay state compatible with the existing Player fields:
 *   location    = realm / kingdom
 *   zone        = city, district or major area
 *   subLocation = exact building / landmark / scene anchor
 *
 * This file only registers places already represented in the project lore/data
 * plus the explicit scene anchors that the navigation resolver already knew.
 * It does not create database rows by itself.
 */

const WORLD_LOCATIONS = [
  {
    id: 'empire_elion',
    name: "Empire Impérial d'Elion",
    aliases: ['empire', 'elion'],
    continent: 'Aetheria',
    places: [
      { name: 'Eldoria', aliases: ['eldoria', 'capitale'], zone: 'Eldoria' },
      { name: 'Solis', aliases: ['solis'], zone: 'Solis' },
      { name: 'Riverbend', aliases: ['riverbend'], zone: 'Riverbend' },
      { name: 'Green-Fields', aliases: ['green fields', 'green-fields'], zone: 'Green-Fields' },
      { name: "Portes d'Elion", aliases: ['portes elion', 'portes d elion'], zone: "Portes d'Elion" },

      { name: 'Place du Marché', aliases: ['place du marche', 'place marche'], zone: 'Centre-ville' },
      { name: 'Marché Central', aliases: ['marche central', 'marche'], zone: 'Centre-ville' },
      { name: 'Poste de la Milice', aliases: ['poste milice', 'poste de la milice', 'caserne', 'quartier general'], zone: 'Quartier Militaire' },
      { name: 'Hôpital', aliases: ['hopital'], zone: 'Centre-ville' },
      { name: 'Banque Centrale', aliases: ['banque centrale', 'banque'], zone: 'Centre-ville' },
      { name: 'Taverne', aliases: ['taverne'], zone: 'Centre-ville' },
      { name: 'Auberge', aliases: ['auberge'], zone: 'Centre-ville' },
      { name: 'Gare Impériale', aliases: ['gare imperiale', 'gare'], zone: 'Centre-ville' },
      { name: 'Port Impérial', aliases: ['port imperial', 'port'], zone: 'Quartier Portuaire' },
      { name: 'Quartier Résidentiel', aliases: ['quartier residentiel', 'maison'], zone: 'Quartier Résidentiel' },
      { name: 'Château Impérial', aliases: ['chateau imperial', 'chateau', "chateau d eldoria"], zone: 'Quartier Royal' },
      { name: 'Palais Impérial', aliases: ['palais imperial', 'palais'], zone: 'Quartier Royal' },

      { name: 'Académie Impériale', aliases: ['academie imperiale', 'academie'], zone: 'Quartier Scolaire' },
      { name: 'Salle de Combat', aliases: ['salle de combat', 'salle combat', 'dojo', 'terrain combat'], zone: 'Quartier Scolaire' },
      { name: "Cour de l’Académie", aliases: ['cour academie', 'cour de academie'], zone: 'Quartier Scolaire' },
      { name: "Bibliothèque de l’Académie", aliases: ['bibliotheque academie', 'bibliotheque de academie'], zone: 'Quartier Scolaire' },
      { name: 'Salle de Classe', aliases: ['salle de classe', 'classe'], zone: 'Quartier Scolaire' },
      { name: 'Dortoirs', aliases: ['dortoir', 'dortoirs'], zone: 'Quartier Scolaire' },
      { name: 'Infirmerie de l’Académie', aliases: ['infirmerie academie', 'infirmerie'], zone: 'Quartier Scolaire' },
      { name: 'Bureau des Inscriptions', aliases: ['bureau inscriptions', 'bureau des inscriptions', 'inscription'], zone: 'Quartier Scolaire' },
      { name: 'Académie de la Lame d’Argent', aliases: ['academie lame argent', 'lame argent', 'academie lame'], zone: 'Quartier Scolaire' },
      { name: 'Quartier Militaire', aliases: ['quartier militaire'], zone: 'Quartier Militaire' },
      { name: 'Quartier Général', aliases: ['quartier general'], zone: 'Quartier Militaire' }
    ]
  },

  {
    id: 'valkyrr',
    name: 'Royaume de Valkyrr',
    aliases: ['valkyrr', 'royaume valkyrr'],
    continent: 'Aetheria',
    places: [
      { name: 'Gearhead', aliases: ['gearhead'], zone: 'Gearhead' },
      { name: 'Sparkwell', aliases: ['sparkwell'], zone: 'Sparkwell' },
      { name: 'Grand Laboratoire', aliases: ['grand laboratoire', 'laboratoire'], zone: 'Grand Laboratoire' },
      { name: "Marché de l'Éther", aliases: ['marche ether', 'marche de ether'], zone: "Marché de l'Éther" },
      { name: "Lycée de l'Éther", aliases: ['lycee ether', 'lycee de ether'], zone: "Lycée de l'Éther" },
      { name: 'Quartier des Sciences', aliases: ['quartier sciences', 'quartier des sciences'], zone: 'Quartier des Sciences' },
      { name: 'Poste de Contrôle', aliases: ['poste controle', 'poste de controle'], zone: 'Poste de Contrôle' },
      { name: 'Palais de Valkyrr', aliases: ['palais valkyrr'], zone: 'Quartier Royal' },
      { name: 'Colline des Nobles', aliases: ['colline nobles', 'colline des nobles'], zone: 'Colline des Nobles' },
      { name: 'Académie de Valkyrr', aliases: ['academie valkyrr'], zone: 'Quartier Scolaire' }
    ]
  },

  {
    id: 'gheno_souterrain',
    name: 'Gheno souterrain',
    aliases: ['gheno souterrain', 'gheno'],
    continent: 'Aetheria',
    places: [
      { name: 'Marché Noir', aliases: ['marche noir'], zone: 'Marché Noir' },
      { name: 'Caveau des Ombres', aliases: ['caveau ombres', 'caveau des ombres'], zone: 'Caveau des Ombres' },
      { name: "Taverne de l'Exilé", aliases: ['taverne exile', 'taverne de exile'], zone: "Taverne de l'Exilé" },
      { name: 'École des Ombres', aliases: ['ecole ombres', 'ecole des ombres'], zone: 'Bas-fonds' },
      { name: 'Bas-fonds', aliases: ['bas fonds', 'bas-fonds'], zone: 'Bas-fonds' }
    ]
  },

  {
    id: 'foret_eveil',
    name: "Forêt de l'Éveil",
    aliases: ['foret eveil', 'foret de eveil'],
    continent: 'Aetheria',
    places: [
      { name: 'Sylva-Lumia', aliases: ['sylva lumia', 'sylva-lumia'], zone: 'Sylva-Lumia' },
      { name: 'Arbre-Mère', aliases: ['arbre mere', 'arbre-mere'], zone: 'Arbre-Mère' },
      { name: "Sources d'Argent", aliases: ['sources argent', 'sources d argent'], zone: "Sources d'Argent" },
      { name: 'Clairière du Destin', aliases: ['clairiere destin', 'clairiere du destin'], zone: 'Clairière du Destin' },
      { name: 'Racines Éternelles', aliases: ['racines eternelles'], zone: 'Racines Éternelles' }
    ]
  },

  {
    id: 'archipel_murmures',
    name: 'Archipel des Murmures',
    aliases: ['archipel murmures'],
    continent: 'Aetheria',
    places: [
      { name: 'Port-Brume', aliases: ['port brume', 'port-brume'], zone: 'Port-Brume' },
      { name: 'Crique de Corail', aliases: ['crique corail', 'crique de corail'], zone: 'Crique de Corail' },
      { name: "Phare d'Écume", aliases: ['phare ecume', 'phare d ecume'], zone: "Phare d'Écume" },
      { name: 'Atoll des Sirènes', aliases: ['atoll sirenes', 'atoll des sirenes'], zone: 'Atoll des Sirènes' },
      { name: 'Rocher Percé', aliases: ['rocher perce'], zone: 'Rocher Percé' }
    ]
  },

  {
    id: 'terres_bestiales',
    name: 'Terres Bestiales',
    aliases: ['terres bestiales'],
    continent: 'Zendora',
    places: [
      { name: 'Oakhaven', aliases: ['oakhaven'], zone: 'Oakhaven' },
      { name: 'Claw-reach', aliases: ['claw reach', 'claw-reach'], zone: 'Claw-reach' },
      { name: 'Jungle de Fer', aliases: ['jungle fer', 'jungle de fer'], zone: 'Jungle de Fer' },
      { name: 'Caverne Primordiale', aliases: ['caverne primordiale'], zone: 'Caverne Primordiale' },
      { name: 'Pic du Prédateur', aliases: ['pic predateur', 'pic du predateur'], zone: 'Pic du Prédateur' }
    ]
  },

  {
    id: 'bastion_orkh',
    name: "Bastion d'Orkh",
    aliases: ['bastion orkh'],
    continent: 'Zendora',
    places: [
      { name: 'Fort-Sang', aliases: ['fort sang', 'fort-sang'], zone: 'Fort-Sang' },
      { name: 'Arène de Iron', aliases: ['arene iron', 'arene de iron'], zone: 'Arène de Iron' },
      { name: 'Mines Rouges', aliases: ['mines rouges'], zone: 'Mines Rouges' },
      { name: 'Canyon des Crânes', aliases: ['canyon cranes', 'canyon des cranes'], zone: 'Canyon des Crânes' },
      { name: 'Temple de la Rage', aliases: ['temple rage', 'temple de la rage'], zone: 'Temple de la Rage' }
    ]
  },

  {
    id: 'montagnes_iron',
    name: 'Montagnes de Iron',
    aliases: ['montagnes iron'],
    continent: 'Zendora',
    places: [
      { name: 'Forge-Profonde', aliases: ['forge profonde', 'forge-profonde'], zone: 'Forge-Profonde' },
      { name: 'Cité-Sous-Montagne', aliases: ['cite sous montagne', 'cite-sous-montagne'], zone: 'Cité-Sous-Montagne' },
      { name: "Gouffre d'Or", aliases: ['gouffre or', 'gouffre d or'], zone: "Gouffre d'Or" },
      { name: 'Porte de Granit', aliases: ['porte granit', 'porte de granit'], zone: 'Porte de Granit' },
      { name: 'Salle du Trône', aliases: ['salle trone', 'salle du trone'], zone: 'Salle du Trône' }
    ]
  },

  {
    id: 'desert_ambre',
    name: "Désert d'Ambre",
    aliases: ['desert ambre', 'desert d ambre'],
    continent: 'Zendora',
    places: [
      { name: "Oasis d'Or", aliases: ['oasis or', 'oasis d or'], zone: "Oasis d'Or" },
      { name: 'Cité des Dunes', aliases: ['cite dunes', 'cite des dunes'], zone: 'Cité des Dunes' },
      { name: 'Souk des Mirages', aliases: ['souk mirages', 'souk des mirages'], zone: 'Souk des Mirages' },
      { name: 'Pyramide de Cristal', aliases: ['pyramide cristal', 'pyramide de cristal'], zone: 'Pyramide de Cristal' },
      { name: 'Temple Solaire', aliases: ['temple solaire'], zone: 'Temple Solaire' }
    ]
  },

  {
    id: 'dominion_vharos',
    name: 'Dominion Noir de Vharos',
    aliases: ['dominion noir', 'dominion vharos', 'vharos'],
    continent: 'Umbra',
    places: [
      { name: 'Marais Putrides', aliases: ['marais putrides'], zone: 'Marais Putrides' },
      { name: 'Donjon de la Liche', aliases: ['donjon liche', 'donjon de la liche'], zone: 'Donjon de la Liche' },
      { name: 'Champs Éternels', aliases: ['champs eternels'], zone: 'Champs Éternels' },
      { name: 'Fort-Désolation', aliases: ['fort desolation', 'fort-desolation'], zone: 'Fort-Désolation' },
      { name: 'Sépulture de Sang', aliases: ['sepulture sang', 'sepulture de sang'], zone: 'Sépulture de Sang' },
      { name: 'Académie du Dominion Noir', aliases: ['academie dominion noir', 'academie noir'], zone: 'Quartier Scolaire' }
    ]
  },

  {
    id: 'necropolis',
    name: 'Nécropolis',
    aliases: ['necropolis'],
    continent: 'Umbra',
    places: [
      { name: 'Le Seuil', aliases: ['seuil', 'le seuil'], zone: 'Le Seuil' },
      { name: 'Allée des Tombeaux', aliases: ['allee tombeaux', 'allee des tombeaux'], zone: 'Allée des Tombeaux' },
      { name: 'Trône du Jugement', aliases: ['trone jugement', 'trone du jugement'], zone: 'Trône du Jugement' },
      { name: 'Val des Pleurs', aliases: ['val pleurs', 'val des pleurs'], zone: 'Val des Pleurs' },
      { name: "Nécropole d'Ébène", aliases: ['necropole ebene', 'necropole d ebene'], zone: "Nécropole d'Ébène" },
      { name: 'Entrée de Nécropolis', aliases: ['entree necropolis', 'entree de necropolis'], zone: 'Cité des Morts' },
      { name: 'Cimetière de Nécropolis', aliases: ['cimetiere necropolis', 'cimetiere de necropolis'], zone: 'Cité des Morts' },
      { name: 'Catacombes', aliases: ['catacombes'], zone: 'Souterrains' }
    ]
  },

  {
    id: 'interstice',
    name: "L'Interstice",
    aliases: ['interstice', 'interstice originel'],
    continent: 'Umbra',
    places: [
      { name: 'Ravin des Âmes', aliases: ['ravin ames', 'ravin des ames'], zone: 'Ravin des Âmes' },
      { name: 'Forêt des Béhérits', aliases: ['foret behérits', 'foret beherits', 'foret des beherits'], zone: 'Forêt des Béhérits' },
      { name: 'Tour de la Main', aliases: ['tour main', 'tour de la main'], zone: 'Tour de la Main' },
      { name: 'Miroir Déformé', aliases: ['miroir deforme', 'miroir déformé'], zone: 'Miroir Déformé' },
      { name: 'Fissure du Néant', aliases: ['fissure neant', 'fissure du neant'], zone: 'Fissure du Néant' },
      { name: 'Interstice Originel', aliases: ['interstice originel'], zone: 'Interstice Originel' }
    ]
  },

  {
    id: 'cite_verre',
    name: 'Cité de Verre',
    aliases: ['cite verre', 'cité verre'],
    continent: 'Umbra',
    places: [
      { name: 'Palais des Reflets', aliases: ['palais reflets', 'palais des reflets'], zone: 'Palais des Reflets' },
      { name: "Prisme d'Ombre", aliases: ['prisme ombre', 'prisme d ombre'], zone: "Prisme d'Ombre" },
      { name: 'Labyrinthe de Cristal', aliases: ['labyrinthe cristal', 'labyrinthe de cristal'], zone: 'Labyrinthe de Cristal' },
      { name: 'Tour de Verre', aliases: ['tour verre', 'tour de verre'], zone: 'Tour de Verre' },
      { name: 'Miroir Brisé', aliases: ['miroir brise'], zone: 'Miroir Brisé' }
    ]
  },

  {
    id: 'royaume_celeste',
    name: 'Royaume Céleste',
    aliases: ['royaume celeste', 'celeste'],
    continent: 'Caelum',
    places: [
      { name: "Palais d'Argent", aliases: ['palais argent', 'palais d argent'], zone: "Palais d'Argent" }
    ]
  },

  {
    id: 'abysse_inferieur',
    name: 'Abysse Inférieur',
    aliases: ['abysse inferieur', 'abysse'],
    continent: 'Caelum',
    places: [
      { name: 'Cité de Pandémonium', aliases: ['cite pandemonium', 'cite de pandemonium'], zone: 'Cité de Pandémonium' },
      { name: 'Lac de Soufre', aliases: ['lac soufre', 'lac de soufre'], zone: 'Lac de Soufre' },
      { name: 'Trône de Flammes', aliases: ['trone flammes', 'trone de flammes'], zone: 'Trône de Flammes' },
      { name: 'Bastion du Pêché', aliases: ['bastion peche', 'bastion du peche'], zone: 'Bastion du Pêché' },
      { name: 'Fosse de Sang', aliases: ['fosse sang', 'fosse de sang'], zone: 'Fosse de Sang' }
    ]
  },

  {
    id: 'origine_existence',
    name: "Origine de l'Existence",
    aliases: ['origine existence', 'origine de existence'],
    continent: 'Caelum',
    places: [
      { name: 'Autel de la Causalité', aliases: ['autel causalite', 'autel de la causalite'], zone: 'Autel de la Causalité' },
      { name: 'Mer de Conscience', aliases: ['mer conscience', 'mer de conscience'], zone: 'Mer de Conscience' },
      { name: 'Portes du Temps', aliases: ['portes temps', 'portes du temps'], zone: 'Portes du Temps' },
      { name: 'Origine du Vide', aliases: ['origine vide', 'origine du vide'], zone: 'Origine du Vide' },
      { name: 'Zenith Absolu', aliases: ['zenith absolu'], zone: 'Zenith Absolu' }
    ]
  },

  {
    id: 'cite_aube',
    name: "Cité de l'Aube",
    aliases: ['cite aube', 'cite de aube'],
    continent: 'Caelum',
    places: [
      { name: "Bastion de l'Aurore", aliases: ['bastion aurore', 'bastion de aurore'], zone: "Bastion de l'Aurore" },
      { name: "Palais d'Or", aliases: ['palais or', 'palais d or'], zone: "Palais d'Or" },
      { name: 'Jardins Suspendus', aliases: ['jardins suspendus'], zone: 'Jardins Suspendus' },
      { name: 'Port de Lumière', aliases: ['port lumiere', 'port de lumiere'], zone: 'Port de Lumière' },
      { name: 'Tour du Matin', aliases: ['tour matin', 'tour du matin'], zone: 'Tour du Matin' }
    ]
  }
];

function normalizeLocationText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function destinationScore(alias, text) {
  const a = normalizeLocationText(alias);
  if (!a || !text) return 0;
  if (text === a) return 1000 + a.length;
  if (text.includes(a)) return 500 + a.length;
  return 0;
}

function resolveWorldDestination(actionText = '') {
  const text = normalizeLocationText(actionText);
  if (!text) return null;

  let best = null;
  let bestScore = 0;

  for (const realm of WORLD_LOCATIONS) {
    const realmAliases = [realm.name, ...(realm.aliases || [])];

    for (const place of realm.places || []) {
      const aliases = [place.name, ...(place.aliases || [])];

      for (const alias of aliases) {
        const score = destinationScore(alias, text);
        if (score > bestScore) {
          bestScore = score;
          best = {
            location: realm.name,
            zone: place.zone || place.name,
            subLocation: place.name,
            anchor: place.name,
            source: 'world-registry',
            continent: realm.continent,
            locationId: realm.id
          };
        }
      }
    }

    for (const alias of realmAliases) {
      const score = destinationScore(alias, text) - 50;
      if (score > bestScore) {
        bestScore = score;
        best = {
          location: realm.name,
          zone: realm.name,
          subLocation: realm.name,
          anchor: realm.name,
          source: 'world-registry',
          continent: realm.continent,
          locationId: realm.id
        };
      }
    }
  }

  return best;
}

function getWorldLocations() {
  return WORLD_LOCATIONS;
}

module.exports = {
  WORLD_LOCATIONS,
  normalizeLocationText,
  resolveWorldDestination,
  getWorldLocations
};
