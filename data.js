const locations = {
  'little_sicily': {
    name: "Little Sicily",
    description: "Ton quartier natal. Les rues sont étroites, les bâtiments en brique rouge et l'odeur de la sauce tomate flotte dans l'air.",
    connections: ['downtown', 'dealership']
  },
  'downtown': {
    name: "Centre-ville",
    description: "Le cœur de Gheno City. Gratte-ciel imposants, néons aveuglants et un trafic incessant.",
    connections: ['little_sicily', 'marina']
  },
  'marina': {
    name: "La Marina",
    description: "Des yachts luxueux se balancent doucement sur l'eau. L'air est salin et les mouettes crient au-dessus.",
    connections: ['downtown']
  },
  'dealership': {
    name: "Concessionnaire 'Prestige Autos'",
    description: "Une salle d'exposition étincelante remplie de voitures qui valent plus que tu ne gagneras en dix vies. Ou pas...",
    connections: ['little_sicily']
  }
};

const vehicles = [
    // Compactes
    { name: 'Emperor', price: 12000, topSpeed: 140, acceleration: 12, inertia: 1.1, brakePower: 15 },
    { name: 'Bollokan', price: 15000, topSpeed: 150, acceleration: 14, inertia: 1.0, brakePower: 16 },

    // Berlines
    { name: 'Schwarzer', price: 25000, topSpeed: 180, acceleration: 18, inertia: 1.4, brakePower: 18 },
    { name: 'Oracle', price: 32000, topSpeed: 190, acceleration: 17, inertia: 1.5, brakePower: 17 },

    // Sportives
    { name: 'Banshee', price: 150000, topSpeed: 240, acceleration: 30, inertia: 1.2, brakePower: 22 },
    { name: 'Comet', price: 180000, topSpeed: 250, acceleration: 32, inertia: 1.1, brakePower: 25 },
    { name: 'Feltzer', price: 210000, topSpeed: 255, acceleration: 35, inertia: 1.3, brakePower: 24 },

    // Supercars
    { name: 'Adder', price: 750000, topSpeed: 300, acceleration: 50, inertia: 1.8, brakePower: 30 },
    { name: 'Zentorno', price: 980000, topSpeed: 310, acceleration: 55, inertia: 1.6, brakePower: 32 },
];


const weapons = {
  'poings': { name: "Poings", damage: 5, accuracy: 95 },
  'couteau': { name: "Couteau", price: 150, damage: 15, accuracy: 90 },
  'pistolet': { name: "Pistolet 9mm", price: 500, damage: 30, accuracy: 80 },
  'fusil_a_pompe': { name: "Fusil à Pompe", price: 2500, damage: 80, accuracy: 50 },
  'fusil_assaut': { name: "Fusil d'Assaut AK-47", price: 7000, damage: 55, accuracy: 70 },
};

module.exports = { locations, vehicles, weapons };
