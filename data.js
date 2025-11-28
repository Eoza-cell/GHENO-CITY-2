// Gheno City 2 - Fichier de Données Centralisé

// 1. Carte de la Ville
const locations = {
  'Little Sicily': {
    name: "Little Sicily",
    description: "Ton quartier natal. Un peu miteux, mais c'est chez toi. C'est un quartier résidentiel avec des petites rues et des immeubles en briques.",
    connections: ['Dealership', 'Downtown'],
    shop: null,
  },
  'Dealership': {
    name: "Concessionnaire 'Pre-owned Promises'",
    description: "Une concession de voitures d'occasion. L'odeur de l'essence et des rêves brisés flotte dans l'air. Des voitures sont alignées sous des néons clignotants.",
    connections: ['Little Sicily'],
    shop: 'vehicle', // Fait référence à la clé dans la section 'shops'
  },
   'Downtown': {
    name: "Centre-ville",
    description: "Le cœur battant de Gheno City. Des gratte-ciels percent les nuages et les rues sont un ballet incessant de taxis jaunes et de gens pressés.",
    connections: ['Little Sicily', 'Gun Shop'],
    shop: null,
  },
  'Gun Shop': {
    name: "Ammu-Nation",
    description: "Une boutique d'armes bien achalandée. L'odeur de la poudre et du métal froid est omniprésente. Le vendeur, un homme bourru, te jauge du regard.",
    connections: ['Downtown'],
    shop: 'weapon',
  },
};

// 2. Véhicules
const vehicles = {
  // Compactes
  'Bollokan Prairie': { name: 'Bollokan Prairie', type: 'Compact', price: 8000, acceleration: 6, topSpeed: 160, inertia: 1.1, brakePower: 8 },
  'Declasse Asea': { name: 'Declasse Asea', type: 'Compact', price: 9500, acceleration: 7, topSpeed: 165, inertia: 1.2, brakePower: 7 },
  // Berlines
  'Albany Primo': { name: 'Albany Primo', type: 'Sedan', price: 15000, acceleration: 8, topSpeed: 180, inertia: 1.5, brakePower: 9 },
  'Cheval Fugitive': { name: 'Cheval Fugitive', type: 'Sedan', price: 18000, acceleration: 9, topSpeed: 185, inertia: 1.6, brakePower: 8 },
  // Sportives
  'Bravado Gauntlet': { name: 'Bravado Gauntlet', type: 'Sports', price: 32000, acceleration: 15, topSpeed: 220, inertia: 1.4, brakePower: 12 },
  'Maibatsu Penumbra': { name: 'Maibatsu Penumbra', type: 'Sports', price: 28000, acceleration: 14, topSpeed: 215, inertia: 1.3, brakePower: 11 },
  // Supercars (pour plus tard)
  'Grotti Cheetah': { name: 'Grotti Cheetah', type: 'Super', price: 450000, acceleration: 25, topSpeed: 280, inertia: 1.2, brakePower: 18 },
};

// 3. Armes
const weapons = {
  // Armes de poing
  'Pistolet': { name: 'Pistolet', type: 'Handgun', price: 500, damage: 25, accuracy: 80 },
  'Pistolet de Combat': { name: 'Pistolet de Combat', type: 'Handgun', price: 1200, damage: 30, accuracy: 85 },
  // Mitraillettes
  'Micro SMG': { name: 'Micro SMG', type: 'SMG', price: 2500, damage: 20, accuracy: 60 },
  // Fusils d'assaut
  'AK-47': { name: 'AK-47', type: 'Assault Rifle', price: 8000, damage: 40, accuracy: 70 },
};

// 4. Boutiques (Inventaires)
const shops = {
  vehicle: {
    name: "Concessionnaire",
    inventory: Object.keys(vehicles), // Contient les noms de tous les véhicules
    isAvailable: (game) => game.isDay(), // Le concessionnaire n'est ouvert que le jour
  },
  weapon: {
    name: "Ammu-Nation",
    inventory: Object.keys(weapons), // Contient les noms de toutes les armes
    isAvailable: () => true, // Toujours ouvert
  },
};


module.exports = {
  locations,
  vehicles,
  weapons,
  shops,
};
