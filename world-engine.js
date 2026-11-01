const { DataTypes, Op } = require('sequelize');
const { sequelize, NPC, Kingdom, Conflict, WorldJournal, Item } = require('./database');

const Region = sequelize.define('WorldRegion', {
 key:{type:DataTypes.STRING,primaryKey:true}, name:DataTypes.STRING, climate:DataTypes.STRING,
 culture:DataTypes.TEXT, resources:DataTypes.TEXT, stability:{type:DataTypes.INTEGER,defaultValue:70},
 danger:{type:DataTypes.INTEGER,defaultValue:10}, lore:DataTypes.TEXT
});
const Location = sequelize.define('WorldLocation', {
 key:{type:DataTypes.STRING,primaryKey:true}, regionKey:DataTypes.STRING, name:DataTypes.STRING,
 kind:DataTypes.STRING, description:DataTypes.TEXT, services:DataTypes.TEXT, ownerFaction:DataTypes.STRING,
 population:{type:DataTypes.INTEGER,defaultValue:100}, prosperity:{type:DataTypes.INTEGER,defaultValue:50},
 security:{type:DataTypes.INTEGER,defaultValue:50}, discoveryLevel:{type:DataTypes.INTEGER,defaultValue:0}
});
const Faction = sequelize.define('WorldFaction', {
 key:{type:DataTypes.STRING,primaryKey:true}, name:DataTypes.STRING, ideology:DataTypes.TEXT,
 leader:DataTypes.STRING, treasury:{type:DataTypes.INTEGER,defaultValue:10000},
 influence:{type:DataTypes.INTEGER,defaultValue:30}, military:{type:DataTypes.INTEGER,defaultValue:20},
 legitimacy:{type:DataTypes.INTEGER,defaultValue:50}, territory:DataTypes.TEXT, agenda:DataTypes.TEXT
});
const NPCMemory = sequelize.define('NPCMemory', {
 npcId:{type:DataTypes.INTEGER,primaryKey:true}, biography:DataTypes.TEXT, traits:DataTypes.TEXT,
 values:DataTypes.TEXT, fears:DataTypes.TEXT, goals:DataTypes.TEXT, secrets:DataTypes.TEXT,
 memories:DataTypes.TEXT, mood:{type:DataTypes.STRING,defaultValue:'neutre'},
 trust:{type:DataTypes.INTEGER,defaultValue:0}, stress:{type:DataTypes.INTEGER,defaultValue:10},
 wealth:{type:DataTypes.INTEGER,defaultValue:50}, health:{type:DataTypes.INTEGER,defaultValue:100},
 schedule:DataTypes.TEXT, lastSimulatedAt:DataTypes.DATE
});
const Event = sequelize.define('WorldEvent', {
 eventKey:{type:DataTypes.STRING,primaryKey:true}, title:DataTypes.STRING, category:DataTypes.STRING,
 locationKey:DataTypes.STRING, description:DataTypes.TEXT, status:{type:DataTypes.STRING,defaultValue:'active'},
 severity:{type:DataTypes.INTEGER,defaultValue:1}, startsAt:{type:DataTypes.DATE,defaultValue:DataTypes.NOW},
 endsAt:DataTypes.DATE, consequences:DataTypes.TEXT
});
const Market = sequelize.define('WorldMarket', {
 itemName:{type:DataTypes.STRING,primaryKey:true}, basePrice:DataTypes.INTEGER,
 currentPrice:DataTypes.INTEGER, supply:{type:DataTypes.INTEGER,defaultValue:100},
 demand:{type:DataTypes.INTEGER,defaultValue:100}, volatility:{type:DataTypes.FLOAT,defaultValue:0.05}
});
const Discipline = sequelize.define('PowerDiscipline', {
 key:{type:DataTypes.STRING,primaryKey:true}, name:DataTypes.STRING, source:DataTypes.STRING,
 philosophy:DataTypes.TEXT, strengths:DataTypes.TEXT, limits:DataTypes.TEXT, counters:DataTypes.TEXT
});
const Law = sequelize.define('PoliticalLaw', {
 lawKey:{type:DataTypes.STRING,primaryKey:true}, realm:DataTypes.STRING, title:DataTypes.STRING,
 description:DataTypes.TEXT, category:DataTypes.STRING, severity:DataTypes.INTEGER,
 active:{type:DataTypes.BOOLEAN,defaultValue:true}
});
const json = v => { try{return JSON.parse(v||'[]')}catch{return []} };
const key = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_');
const FEATURES = [
'Identité, biographie et apparence propres à chaque PNJ','Traits de caractère, valeurs, peurs et ambitions','Secrets individuels et mémoire des interactions','Confiance, stress, humeur et réputation envers chaque joueur','Horaires, routines et déplacements des PNJ','Relations familiales, amitiés, rivalités et dettes','Rumeurs locales et témoins persistants','Métiers, revenus et niveau de vie des habitants','Régions avec climat, culture, ressources et danger','Lieux avec services, population, sécurité et prospérité','Sous-lieux et lieux secrets à découvrir','Factions avec idéologie, chef, trésor et agenda','Relations diplomatiques et rivalités de factions','Lois propres à chaque royaume','Justice, amendes, primes et emprisonnement','Impôts et dépenses publiques','Offre, demande et prix variables','Pénuries, surplus et inflation locale','Routes commerciales et taxes','Production, artisanat et métiers','Événements locaux persistants','Conséquences à long terme des événements','Chronique historique du monde','Saisons et météo régionale','Voyages avec étapes et rencontres','Exploration et découverte progressive','Disciplines de pouvoir documentées','Sources, coûts et limites des pouvoirs','Contres et compatibilités entre disciplines','Progression et transmission du savoir','Reliques avec histoire et résonance','Programmes et examens académiques','Clubs, guildes et contrats','Réputation et influence des organisations','Conflits, négociations et traités','Sièges, reconstruction et conséquences','Religions, fêtes et traditions','Gastronomie, faune et flore régionales','Écosystèmes et catastrophes','Archives et généalogies','Relations joueur-PNJ persistantes','Dialogues conditionnés par le vécu','Quêtes émergentes liées au monde','Commerce direct avec les habitants','Événements personnels des PNJ','Sauvegarde durable de l’état du monde'
];

async function initializeWorld(){
 for(const m of [Region,Location,Faction,NPCMemory,Event,Market,Discipline,Law]) await m.sync();
 const regions=[
 ['elion','Empire Impérial d’Elion','tempéré','Cour impériale, noblesse et académies',['fer','céréales','mana'],78,20,'Le pouvoir est partagé entre la Couronne, les maisons nobles et les académies.'],
 ['valkyrr','Valkyrr','froid','Guildes, pactes et technologie éthérique',['cristal','mithril','éther'],65,35,'Les conseils de guildes arbitrent les intérêts des cités.'],
 ['gheno','Gheno souterrain','souterrain','Réseaux clandestins et communautés autonomes',['reliques','métaux'],42,65,'Le pouvoir est fragmenté entre syndicats et familles.'],
 ['necropolis','Nécropolis','brumeux','Culte des ancêtres et rites funéraires',['essence','obsidienne'],55,75,'Les Veilleurs protègent les stèles et les archives.'],
 ['caelum','Caelum','maritime','Cités portuaires et navigateurs',['perles','poissons'],68,55,'Le commerce maritime finance les cités.']
 ];
 for(const [k,n,c,u,r,s,d,l] of regions) await Region.findOrCreate({where:{key:k},defaults:{key:k,name:n,climate:c,culture:u,resources:JSON.stringify(r),stability:s,danger:d,lore:l}});
 const places=[
 ['palais_elion','elion','Palais Impérial','palace','Siège de la Couronne et des audiences.',['audience','archives','cour']],
 ['place_marche','elion','Place du Marché','market','Artisans, négociants et voyageurs.',['commerce','rumeurs','artisanat']],
 ['lame_argent','elion','Académie de la Lame d’Argent','academy','Escrime de Mana, examens et clubs.',['cours','examens','clubs']],
 ['quartier_noble','elion','Quartier Noble','district','Demeures des maisons influentes.',['résidences','politique']],
 ['port_valkyrr','valkyrr','Port de Valkyrr','port','Chantiers navals, douanes et comptoirs.',['commerce','transport']],
 ['lycee_ether','valkyrr','Lycée de l’Éther','academy','Techno-magie et recherche.',['cours','laboratoires']],
 ['marche_noir','gheno','Marché Noir','market','Échanges clandestins et intermédiaires.',['commerce gris','informations']],
 ['catacombes','necropolis','Catacombes de Nécropolis','dungeon','Galeries funéraires et mémoires anciennes.',['exploration','reliques']],
 ['abysse','caelum','Abysse Inférieur','dungeon','Faille océanique instable.',['exploration','recherche']]
 ];
 for(const [k,r,n,t,d,s] of places) await Location.findOrCreate({where:{key:k},defaults:{key:k,regionKey:r,name:n,kind:t,description:d,services:JSON.stringify(s)}});
 const factions=[
 ['couronne','Couronne d’Elion','Ordre impérial et centralisation.','Impératrice',85000,85,90,78,'Maintenir la stabilité et contenir les maisons.'],
 ['maisons','Grandes Maisons','Autonomie nobiliaire et patrimoine.','Conseil des Maisons',62000,72,55,48,'Étendre leur influence à la Cour.'],
 ['ligue','Ligue des Guildes','Liberté contractuelle et innovation.','Premier Syndic',93000,80,65,72,'Sécuriser les routes commerciales.'],
 ['syndicat','Syndicat de Gheno','Secret et contrôle des échanges.','Courtier Gris',41000,68,45,35,'Étendre ses réseaux.'],
 ['veilleurs','Ordre des Veilleurs','Protection des morts et des archives.','Matriarche des Stèles',28000,54,40,80,'Protéger les sanctuaires.']
 ];
 for(const [k,n,i,l,t,inf,mil,leg,a] of factions) await Faction.findOrCreate({where:{key:k},defaults:{key:k,name:n,ideology:i,leader:l,treasury:t,influence:inf,military:mil,legitimacy:leg,agenda:a}});
 const powers=[
 ['ether','Éther','Énergie ambiante','Polyvalence et adaptation.','Surcharge et dépendance au milieu.','Silence éthérique.'],
 ['mana','Mana','Réserve intérieure','Contrôle et endurance.','Épuisement et capacité limitée.','Perturbation du flux.'],
 ['aura','Aura','Volonté incarnée','Renforcement et présence.','Émotions instables.','Dissipation.'],
 ['ombre','Arts de l’Ombre','Ombre et absence','Infiltration et mobilité.','Lumière révélatrice.','Détection et illumination.'],
 ['relique','Résonance des Reliques','Objets anciens','Effets singuliers et mémoire.','Compatibilité et dette.','Désaccord de résonance.']
 ];
 for(const [k,n,s,p,lim,c] of powers) await Discipline.findOrCreate({where:{key:k},defaults:{key:k,name:n,source:s,philosophy:p,limits:lim,counters:c}});
 const npcRows=await NPC.findAll();
 for(const n of npcRows) await NPCMemory.findOrCreate({where:{npcId:n.id},defaults:{npcId:n.id,biography:n.description||'Histoire encore inconnue.',traits:JSON.stringify([n.personality||'réservé',n.role||'habitant',n.specialty||'sans spécialité']),values:JSON.stringify(['survie','dignité']),fears:JSON.stringify(['perdre ses proches']),goals:JSON.stringify(['préserver ses intérêts']),secrets:'[]',memories:'[]',schedule:JSON.stringify({matin:'activité',midi:'échanges',soir:'foyer'})}});
 console.log('[WORLD] Monde initialisé:',await Location.count(),'lieux,',await Faction.count(),'factions,',npcRows.length,'PNJ enrichis.');
}
async function rememberNPC(npcId,entry,type='interaction'){
 if(!npcId||!entry)return; const [m]=await NPCMemory.findOrCreate({where:{npcId},defaults:{npcId}});
 const memories=json(m.memories); memories.push({type,entry:String(entry).slice(0,400),at:new Date().toISOString()});
 await m.update({memories:JSON.stringify(memories.slice(-40))});
}
async function snapshot(place=''){
 const where=place?{name:{[Op.iLike]:'%'+place+'%'}}:{};
 const [regions,locations,factions,events,conflicts]=await Promise.all([Region.findAll(),Location.findAll({where,limit:25}),Faction.findAll({order:[['influence','DESC']]}),Event.findAll({where:{status:'active'},limit:8}),Conflict.findAll({where:{status:'active'},limit:8})]);
 return {regions,locations,factions,events,conflicts,featureCount:FEATURES.length};
}
async function worldContext(place=''){
 const s=await snapshot(place), lines=['ÉTAT PERSISTANT DU MONDE ATR'];
 for(const r of s.regions)lines.push('Région '+r.name+': '+r.climate+', stabilité '+r.stability+'/100, danger '+r.danger+'/100. '+r.lore);
 for(const l of s.locations)lines.push('Lieu '+l.name+': '+l.description+' Services: '+json(l.services).join(', ')+'. Population '+l.population+', prospérité '+l.prosperity+', sécurité '+l.security+'.');
 for(const f of s.factions)lines.push('Faction '+f.name+': chef '+f.leader+', influence '+f.influence+', légitimité '+f.legitimacy+'. '+f.ideology+' Agenda: '+f.agenda);
 for(const e of s.events)lines.push('Événement '+e.title+': '+e.description);
 for(const c of s.conflicts)lines.push('Conflit '+c.title+': '+c.description);
 return lines.join('\n').slice(0,7000);
}
async function tickWorld(){
 const now=new Date(), memories=await NPCMemory.findAll({limit:200});
 for(const m of memories){const stress=Math.max(0,Math.min(100,m.stress+(Math.random()<.12?2:Math.random()<.18?-2:0)));await m.update({stress,mood:stress>75?'tendu':stress<20?'serein':m.mood,lastSimulatedAt:now});}
 const markets=await Market.findAll({limit:200});
 for(const m of markets){const pressure=(m.demand-m.supply)/Math.max(20,m.supply);const next=Math.max(1,Math.round(m.currentPrice*(1+pressure*.02+(Math.random()-.5)*.04)));await m.update({currentPrice:next});}
 await Event.update({status:'resolved'},{where:{status:'active',endsAt:{[Op.lt]:now}}});
 if(Math.random()<.1){const places=await Location.findAll({limit:30});if(places.length){const p=places[Math.floor(Math.random()*places.length)];const title='Incident local à '+p.name;const eventKey=key(title)+'_'+Date.now();await Event.create({eventKey,title,category:'local',locationKey:p.key,description:'Un événement perturbe temporairement la vie quotidienne de '+p.name+'.',severity:2,consequences:JSON.stringify([{location:p.name}])});await WorldJournal.create({entry:title,importance:2,category:'world_event'});}}
}
async function marketQuote(name){const item=await Item.findOne({where:{name:{[Op.iLike]:'%'+name+'%'}}});if(!item)return null;const [m]=await Market.findOrCreate({where:{itemName:item.name},defaults:{itemName:item.name,basePrice:item.price||10,currentPrice:item.price||10}});return {name:item.name,price:m.currentPrice,supply:m.supply,demand:m.demand};}
module.exports={initializeWorld,rememberNPC,snapshot,worldContext,tickWorld,marketQuote,FEATURES,Region,Location,Faction,NPCMemory,Event,Market,Discipline,Law};
