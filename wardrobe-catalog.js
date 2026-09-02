/**
 * AETHERYS WARDROBE CATALOG
 * Safe, modular clothing system: hundreds of combinations are generated from
 * curated style families and can later be linked to the project's PDF images.
 */

const collections = [
  { id:'imperial', label:'Collection Impériale', styles:['Uniforme impérial','Veste d’officier','Manteau cérémoniel','Tenue de ville'], colors:['ivoire','noir','bleu nuit','bordeaux'], price:650 },
  { id:'academy', label:'Académies', styles:['Uniforme académique','Blazer académique','Manteau d’étude','Tenue d’entraînement'], colors:['blanc','bleu','gris','noir'], price:450 },
  { id:'adventurer', label:'Aventuriers', styles:['Tenue d’explorateur','Veste de voyage','Manteau de terrain','Équipement léger'], colors:['brun','vert forêt','gris','noir'], price:800 },
  { id:'noble', label:'Noblesse', styles:['Habit noble','Veste aristocratique','Manteau royal','Tenue de réception'], colors:['bordeaux','bleu roi','noir','ivoire'], price:1800 },
  { id:'street', label:'Mode urbaine', styles:['Veste urbaine','Hoodie impérial','Ensemble décontracté','Manteau moderne'], colors:['noir','gris','blanc','bleu'], price:550 },
  { id:'winter', label:'Grand Nord', styles:['Parka runique','Manteau d’hiver','Cape polaire','Tenue thermique'], colors:['blanc','bleu glacier','gris','noir'], price:950 },
  { id:'desert', label:'Royaumes du Sud', styles:['Tunique de voyage','Manteau du désert','Ensemble léger','Veste saharienne'], colors:['sable','ocre','blanc','brun'], price:700 },
  { id:'combat', label:'Combat', styles:['Tenue martiale','Veste de combat','Uniforme tactique','Armure légère'], colors:['noir','gris acier','bleu nuit','bordeaux'], price:1100 },
  { id:'festival', label:'Festivals', styles:['Habit de festival','Veste de gala','Tenue de cérémonie','Manteau brodé'], colors:['rouge','or','violet','blanc'], price:1400 }
];

function slug(v){ return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

function buildWardrobeCatalog(){
  const items=[];
  let n=1;
  for(const col of collections){
    for(const style of col.styles){
      for(const color of col.colors){
        items.push({
          name: `${style} — ${color}`,
          description: `${col.label}. Une pièce conçue pour l’univers d’Aetherys, adaptée à la vie quotidienne et aux aventures.`,
          price: col.price + ((n%5)*125),
          type:'clothing',
          rarity: n%19===0?'legendary':n%11===0?'epic':n%5===0?'rare':'common',
          slot:'outfit',
          durability:100,
          visualData:{
            collection:col.id,
            collectionLabel:col.label,
            style,
            color,
            outfitId:`atr-${slug(col.id)}-${n}`,
            layers:['head','outer','top','bottom','feet','accessory']
          }
        });
        n++;
      }
    }
  }
  return items;
}

module.exports={collections,buildWardrobeCatalog};
