/**
 * ATR Wardrobe System
 * A deterministic catalog: scalable to hundreds of purchasable cosmetics.
 */

const CATEGORIES = {
  tops: ['Veste académique','Hoodie urbain','Chemise impériale','Manteau long','Veste de combat','Pull royal','Blouson de voyage','Kimono moderne','Cape légère','Veste de mage'],
  bottoms: ['Pantalon droit','Jean urbain','Pantalon tactique','Pantalon académique','Jogging','Pantalon noble','Pantalon de voyage','Jupe académique','Pantalon de mage','Pantalon renforcé'],
  shoes: ['Baskets','Bottes impériales','Chaussures académiques','Bottes de voyage','Bottes tactiques','Mocassins nobles','Chaussures de mage','Sandales de combat'],
  accessories: ['Aucun','Écharpe','Lunettes','Gants','Collier','Bracelet','Sac','Masque cérémoniel','Broche impériale','Bandeau']
};

const THEMES = [
  ['Blanc Elion','blanc et rouge'],
  ['Noir Obsidienne','noir profond'],
  ['Bleu Azur','bleu et argent'],
  ['Rouge Valkyrr','rouge sombre'],
  ['Vert Émeraude','vert et or'],
  ['Violet Astral','violet et noir'],
  ['Gris Acier','gris métallique'],
  ['Or Royal','or et ivoire']
];

const RARITIES = [
  { name: 'Commun', multiplier: 1 },
  { name: 'Rare', multiplier: 2 },
  { name: 'Épique', multiplier: 5 },
  { name: 'Légendaire', multiplier: 12 }
];

function buildCatalog() {
  const items = [];
  let n = 1;
  for (const [theme, palette] of THEMES) {
    for (const [slot, names] of Object.entries(CATEGORIES)) {
      names.forEach((base, index) => {
        const rarity = RARITIES[(index + THEMES.indexOf(THEMES.find(t => t[0] === theme))) % RARITIES.length];
        const price = Math.round((150 + index * 75 + slot.length * 10) * rarity.multiplier);
        items.push({
          id: 'cloth_' + String(n++).padStart(3, '0'),
          name: base + ' — ' + theme,
          slot,
          theme,
          palette,
          rarity: rarity.name,
          price,
          cosmetic: true
        });
      });
    }
  }
  return items;
}

const CATALOG = buildCatalog();

function starterWardrobe() {
  return ['cloth_001','cloth_081','cloth_161','cloth_225'];
}

function getItem(idOrName) {
  const needle = String(idOrName || '').trim().toLowerCase();
  return CATALOG.find(i => i.id.toLowerCase() === needle || i.name.toLowerCase() === needle) ||
    CATALOG.find(i => i.name.toLowerCase().includes(needle));
}

function getOwned(player) {
  const owned = Array.isArray(player.wardrobe) ? player.wardrobe : [];
  return [...new Set([...starterWardrobe(), ...owned])];
}

function getEquipped(player) {
  const value = player.equippedOutfit || {};
  return {
    tops: value.tops || null,
    bottoms: value.bottoms || null,
    shoes: value.shoes || null,
    accessories: value.accessories || null
  };
}

function formatItem(item) {
  return item ? item.name + ' [' + item.rarity + '] — ' + item.price + ' Col' : 'Vide';
}

module.exports = { CATALOG, starterWardrobe, getItem, getOwned, getEquipped, formatItem };
