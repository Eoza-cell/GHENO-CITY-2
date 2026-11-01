const RANKS = ['F','E','D','C','B','A','S','SS','SSS','EX'];
const HABITATS = [
  { place:'Forêt des Gobelins', region:'Elion', climate:'forêt', creatures:['Ronge-racine','Gobelin pisteur','Loup cendré','Araignée sylvestre','Ent dryade'], flavor:'Les sous-bois abritent des chasseurs territoriaux et des espèces attirées par le mana végétal.' },
  { place:'Mine de Cobalt', region:'Valkyrr', climate:'souterrain', creatures:['Mite de cobalt','Kobold foreur','Sanglier de schiste','Golem fissuré','Ver des profondeurs'], flavor:'La pression minérale et les cristaux d’éther ont altéré la faune des galeries.' },
  { place:'Désert d’Ambre', region:'Solis', climate:'désert', creatures:['Scarabée solaire','Hyène des dunes','Basilic de sable','Manticore ocre','Colosse des mirages'], flavor:'Les espèces du désert économisent leur énergie et traquent les voyageurs épuisés.' },
  { place:'Marais des Murmures', region:'Gheno', climate:'marais', creatures:['Sangsue spectrale','Crapaud venimeux','Serpent des roseaux','Sorcière des eaux','Hydre saumâtre'], flavor:'Brumes toxiques, eaux mouvantes et prédateurs capables de dissimuler leur présence.' },
  { place:'Catacombes de Nécropolis', region:'Nécropolis', climate:'nécropole', creatures:['Rat ossuaire','Revenant errant','Chien funéraire','Chevalier sépulcral','Liche mineure'], flavor:'Les souvenirs des morts imprègnent les créatures et perturbent les sens des vivants.' },
  { place:'Volcan d’Ignis', region:'Ignis', climate:'volcanique', creatures:['Salamandre braise','Lézard de lave','Élémentaire ardent','Drake magmatique','Titan caldeira'], flavor:'La chaleur extrême favorise les organismes ignés et les prédateurs cuirassés.' },
  { place:'Abysse de Caelum', region:'Caelum', climate:'abyssal', creatures:['Méduse abyssale','Anguille foudroyante','Requin runique','Léviathan juvénile','Oracle des abysses'], flavor:'Les profondeurs abritent des organismes bioluminescents et des intelligences anciennes.' },
  { place:'Hautes terres de Valkyrr', region:'Valkyrr', climate:'montagne', creatures:['Chèvre-lame','Harpie des crêtes','Griffon sauvage','Wyverne orageuse','Roc ancestral'], flavor:'Les courants aériens et les falaises ont façonné des espèces rapides et territoriales.' }
];
const ARCHETYPES = [
  { role:'charognard', behavior:'Évite les adversaires en groupe et attaque les blessés.', ability:'Morsure opportuniste', weakness:'Feu et lumière vive', drops:'Fourrure, crocs, viande' },
  { role:'prédateur', behavior:'Traque sa cible, contourne les gardes et frappe par surprise.', ability:'Bond prédateur', weakness:'Bruits puissants et pièges', drops:'Griffes, peau, essence bestiale' },
  { role:'armuré', behavior:'Avance lentement, protège ses points vitaux et défend son territoire.', ability:'Carapace renforcée', weakness:'Articulations et attaques perforantes', drops:'Écailles, plaques, minerai' },
  { role:'mystique', behavior:'Maintient ses distances et utilise son environnement pour contrôler le terrain.', ability:'Décharge d’éther', weakness:'Rupture de concentration', drops:'Noyau magique, poussière d’éther' },
  { role:'dominant', behavior:'Défend un territoire, commande parfois des créatures plus faibles et n’abandonne pas facilement.', ability:'Cri de domination', weakness:'Isolement et épuisement', drops:'Matériau rare, noyau puissant' },
  { role:'ancien', behavior:'Observe avant d’agir, adapte sa stratégie et protège un site ou un trésor.', ability:'Éveil ancestral', weakness:'Sceau de son habitat', drops:'Relique, essence ancienne' }
];
const RANK_POWER = { F:1, E:1.5, D:2.2, C:3.2, B:4.8, A:7, S:11, SS:17, SSS:26, EX:40 };

const creatures = [];
for (let h=0; h<HABITATS.length; h++) {
  const habitat = HABITATS[h];
  for (let a=0; a<ARCHETYPES.length; a++) {
    const archetype = ARCHETYPES[a];
    const rank = RANKS[Math.min(RANKS.length-1, Math.floor((h+a)/1.7))];
    const scale = RANK_POWER[rank];
    const name = habitat.creatures[a];
    creatures.push({
      name, rank, location:habitat.place, subLocation:habitat.place, region:habitat.region,
      speciesType:archetype.role, rarity:a===5?'légendaire':a===4?'épique':a===3?'rare':a===2?'inhabituelle':'commune',
      habitat:habitat.climate, behavior:archetype.behavior, abilities:archetype.ability,
      weaknesses:archetype.weakness, drops:archetype.drops,
      description:habitat.flavor+' '+name+' est une espèce '+archetype.role+'.',
      health:Math.round(35*scale*(1+a*.22)), strength:Math.round(8*scale*(1+a*.18)),
      defense:Math.round(5*scale*(1+a*.2)), agility:Math.round(9*scale*(a===1?1.35:1)),
      intelligence:Math.round(5*scale*(a>=3?1.5:1)), xp_reward:Math.round(18*scale),
      col_reward:Math.round(8*scale), isBoss:a===5
    });
  }
}
for (let h=0; h<HABITATS.length; h++) {
  const habitat=HABITATS[h], rank= h<2?'A':h<4?'S':'SS';
  const scale=RANK_POWER[rank];
  creatures.push({
    name:['Ancien Sylvestre','Cœur de la Montagne','Phénix d’Ambre','Dame du Marais','Roi des Sans-Repos','Drake Primordial','Léviathan du Vide','Roc des Tempêtes'][h],
    rank, location:habitat.place, subLocation:'Territoire interdit — '+habitat.place, region:habitat.region,
    speciesType:'boss', rarity:'mythique', habitat:habitat.climate,
    behavior:'Boss territorial : analyse les menaces, change de tactique et peut appeler des créatures de son habitat.',
    abilities:'Phase d’éveil; attaque de zone; compétence signature liée à son habitat.',
    weaknesses:'Son point faible doit être découvert par observation, enquête ou exploration.',
    drops:'Noyau mythique, matériau de rang élevé, relique de territoire',
    description:'Gardien majeur de '+habitat.place+'. '+habitat.flavor,
    health:Math.round(1200*scale), strength:Math.round(90*scale), defense:Math.round(75*scale),
    agility:Math.round(55*scale), intelligence:Math.round(65*scale),
    xp_reward:Math.round(1800*scale), col_reward:Math.round(900*scale), isBoss:true
  });
}
module.exports = { creatures, HABITATS };
