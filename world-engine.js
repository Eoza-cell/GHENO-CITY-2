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
const NPCProfile = sequelize.define('NPCWorldProfile', {
 npcId:{type:DataTypes.INTEGER,primaryKey:true}, biography:DataTypes.TEXT, appearance:DataTypes.TEXT,
 voice:DataTypes.TEXT, values:DataTypes.TEXT, fears:DataTypes.TEXT, ambitions:DataTypes.TEXT,
 habits:DataTypes.TEXT, socialStyle:DataTypes.TEXT, professionDetail:DataTypes.TEXT,
 personalConflict:DataTypes.TEXT, reputation:DataTypes.TEXT
});
const NPCSocialLink = sequelize.define('NPCSocialLink', {
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true}, npcA:{type:DataTypes.INTEGER,allowNull:false},
 npcB:{type:DataTypes.INTEGER,allowNull:false}, relation:{type:DataTypes.STRING}, strength:{type:DataTypes.INTEGER,defaultValue:0},
 history:DataTypes.TEXT
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
 for(const m of [Region,Location,Faction,NPCMemory,NPCProfile,NPCSocialLink,Event,Market,Discipline,Law]) await m.sync();
 // Les continents et royaumes proviennent du catalogue historique du bot.
 const kingdoms = await Kingdom.findAll({order:[['continent','ASC'],['name','ASC']]});
 const byContinent = new Map();
 for(const kingdom of kingdoms){
   const continent=String(kingdom.continent||'Aetheria').trim();
   if(!byContinent.has(continent)) byContinent.set(continent,[]);
   byContinent.get(continent).push(kingdom);
 }
 for(const [continent,realmList] of byContinent){
   const regionKey=key(continent);
   const [region]=await Region.findOrCreate({where:{key:regionKey},defaults:{
     key:regionKey,name:continent,climate:'variable',culture:'Cultures et peuples des royaumes de '+continent,
     resources:JSON.stringify([]),stability:70,danger:25,
     lore:'Continent composé de '+realmList.length+' royaume(x): '+realmList.map(k=>k.name).join(', ')+'.'
   }});
   await region.update({lore:'Continent composé de '+realmList.length+' royaume(x): '+realmList.map(k=>k.name).join(', ')+'.'});
   for(const kingdom of realmList){
     const cityMatch=String(kingdom.description||'').match(/Villes\s*:\s*([^.]*)/i);
     const cities=cityMatch?cityMatch[1].split(',').map(v=>v.trim()).filter(Boolean):[];
     for(const city of cities){
       const cityKey=key(continent+'_'+kingdom.name+'_'+city);
       await Location.findOrCreate({where:{key:cityKey},defaults:{
         key:cityKey,regionKey,name:city,kind:'city',
         description:city+' est une ville du royaume '+kingdom.name+', sur le continent '+continent+'.',
         services:JSON.stringify(['commerce','vie locale','services du royaume']),
         ownerFaction:kingdom.name,population:1000,prosperity:50,security:50
       }});
     }
   }
 }
 // Lieux emblématiques déjà présents dans le moteur, conservés comme sous-lieux.
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
 const laws=[
 ['elion_magic','Empire Impérial d’Elion','Registre des arts','Les usages des arts à risque public sont encadrés par les autorités locales.','magie',3],
 ['elion_duel','Empire Impérial d’Elion','Duel reconnu','Un duel public doit être déclaré et ne peut impliquer de tiers non consentants.','justice',2],
 ['valkyrr_trade','Valkyrr','Charte des comptoirs','Les contrats marchands précisent quantité, qualité, délai et pénalités.','commerce',2],
 ['gheno_debt','Gheno souterrain','Loi des dettes','Les dettes reconnues engagent débiteur et garant selon les usages du quartier.','commerce',3],
 ['necropolis_rites','Nécropolis','Protection des stèles','Le déplacement d’une stèle exige l’accord des Veilleurs.','tradition',4]
 ];
 for(const [lawKey,realm,title,description,category,severity] of laws) await Law.findOrCreate({where:{lawKey},defaults:{lawKey,realm,title,description,category,severity}});
 const npcRows=await NPC.findAll({order:[['id','ASC']]});
 const choose=(arr,seed)=>arr[Math.abs(seed)%arr.length];
 const hash=(value)=>{let h=216.6136261;for(const ch of String(value||''))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};
 const valueSets={
   traits:['observateur','méfiant','patient','ambitieux','généreux','fier','ironique','discipliné','curieux','impulsif','prudent','loyal','indépendant','rêveur','calculateur'],
   values:['honneur','famille','liberté','savoir','richesse','justice','tradition','survie','foi','loyauté','reconnaissance','vengeance'],
   fears:['être oublié','perdre un proche','être trahi','échouer publiquement','perdre son statut','ne plus maîtriser son pouvoir','être enfermé','voir son foyer détruit'],
   goals:['protéger son entourage','gagner en influence','devenir maître de son art','réunir sa famille','découvrir un secret ancien','rembourser une dette','quitter son royaume','fonder une activité'],
   habits:['consulter les nouvelles au réveil','prendre un repas avec ses proches','s entraîner avant le travail','tenir un carnet personnel','observer les passants','visiter un lieu familier le soir'],
   voices:['voix grave et posée','débit rapide et nerveux','ton doux mais ferme','voix rauque et basse','parole précise et formelle','accent régional marqué'],
   conflicts:['un secret familial pèse sur ses décisions','une dette limite ses choix','une rivalité ancienne influence ses relations','il hésite entre ambition et loyauté','il protège une personne sans le révéler','il cherche à réparer une faute passée']
 };
 for(const n of npcRows){
   const seed=hash(n.id+':'+n.name), role=n.role||'habitant', spec=n.specialty||'aucune spécialité';
   const traits=[choose(valueSets.traits,seed),choose(valueSets.traits,seed>>>3),String(n.personality||'').trim()].filter(Boolean);
   const values=[choose(valueSets.values,seed>>>5),choose(valueSets.values,seed>>>8)];
   const fears=[choose(valueSets.fears,seed>>>11)];
   const goals=[choose(valueSets.goals,seed>>>14)];
   const appearance=n.description||'Apparence non documentée.';
   const biography=(n.description||n.name+' mène une vie encore peu connue.')+' Son métier de '+role.toLowerCase()+' et sa spécialité ('+spec+') influencent son quotidien dans '+(n.location||'son royaume')+'.';
   await NPCProfile.findOrCreate({where:{npcId:n.id},defaults:{
     npcId:n.id,biography,appearance,voice:choose(valueSets.voices,seed>>>17),
     values:JSON.stringify(values),fears:JSON.stringify(fears),ambitions:JSON.stringify(goals),
     habits:JSON.stringify([choose(valueSets.habits,seed>>>20),choose(valueSets.habits,seed>>>23)]),
     socialStyle:traits.join(', '),professionDetail:role+' — '+spec,
     personalConflict:choose(valueSets.conflicts,seed>>>26),reputation:JSON.stringify({public:50,local:50})
   }});
   await NPCMemory.findOrCreate({where:{npcId:n.id},defaults:{
     npcId:n.id,biography,traits:JSON.stringify(traits),values:JSON.stringify(values),fears:JSON.stringify(fears),
     goals:JSON.stringify(goals),secrets:'[]',memories:'[]',schedule:JSON.stringify({matin:'routine personnelle',midi:'travail ou études',soir:'vie sociale ou repos'})
   }});
 }
 // Liens sociaux persistants : les habitants d'un même lieu se connaissent.
 const groups=new Map();
 for(const n of npcRows){const k=String(n.location||'inconnu');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n);}
 for(const group of groups.values()){
   for(let i=0;i<group.length-1;i++){
     const a=group[i],b=group[i+1];
     const relation=choose(['collègues','connaissances','amis','rivaux','voisins','membres du même cercle'],hash(a.id+':'+b.id));
     await NPCSocialLink.findOrCreate({where:{npcA:a.id,npcB:b.id},defaults:{
       npcA:a.id,npcB:b.id,relation,strength:20+(hash(b.id+':'+a.id)%61),
       history:'Se connaissent parce qu’ils vivent ou travaillent dans le même lieu.'
     }});
   }
 }
 console.log('[WORLD] Atlas historique synchronisé:',byContinent.size,'continents,',kingdoms.length,'royaumes,',await Location.count(),'lieux,',npcRows.length,'PNJ individualisés.');
}
async function rememberNPC(npcId,entry,type='interaction'){
 if(!npcId||!entry)return; const [m]=await NPCMemory.findOrCreate({where:{npcId},defaults:{npcId}});
 const memories=json(m.memories); memories.push({type,entry:String(entry).slice(0,400),at:new Date().toISOString()});
 await m.update({memories:JSON.stringify(memories.slice(-40))});
}
async function snapshot(place=''){
 const where={}; // Include the full atlas; the AI can select the current region from it.
 const [regions,locations,factions,events,conflicts,laws,disciplines,kingdoms]=await Promise.all([Region.findAll(),Location.findAll({where,limit:100}),Faction.findAll({order:[['influence','DESC']]}),Event.findAll({where:{status:'active'},limit:8}),Conflict.findAll({where:{status:'active'},limit:8}),Law.findAll({where:{active:true},limit:20}),Discipline.findAll({order:[['name','ASC']]}),Kingdom.findAll({order:[['continent','ASC'],['name','ASC']]})]);
 return {regions,locations,factions,events,conflicts,laws,disciplines,kingdoms,featureCount:FEATURES.length};
}
async function worldContext(place=''){
 const s=await snapshot(place), lines=['ÉTAT PERSISTANT DU MONDE ATR'];
 for(const r of s.regions)lines.push('CONTINENT '+r.name+': '+r.climate+', stabilité '+r.stability+'/100, danger '+r.danger+'/100. '+r.lore);
 for(const k of s.kingdoms)lines.push('ROYAUME '+k.name+' | Continent: '+(k.continent||'inconnu')+' | Dirigeant: '+(k.leader||'inconnu')+' | Statut: '+k.status+' | Influence: '+k.influence+'/100 | Puissance militaire: '+k.militaryPower+'/100. '+k.description);
 for(const l of s.locations)lines.push('Lieu '+l.name+': '+l.description+' Services: '+json(l.services).join(', ')+'. Population '+l.population+', prospérité '+l.prosperity+', sécurité '+l.security+'.');
 for(const f of s.factions)lines.push('Faction '+f.name+': chef '+f.leader+', influence '+f.influence+', légitimité '+f.legitimacy+'. '+f.ideology+' Agenda: '+f.agenda);
 for(const e of s.events)lines.push('Événement '+e.title+': '+e.description);
 for(const c of s.conflicts)lines.push('Conflit '+c.title+': '+c.description);
 for(const l of s.laws)lines.push('Loi de '+l.realm+' — '+l.title+': '+l.description);
 for(const p of s.disciplines)lines.push('Pouvoir '+p.name+' (source '+p.source+'): '+p.philosophy+' Limites: '+p.limits+' Contres: '+p.counters);
 return lines.join('\n').slice(0,9000);
}
async function tickWorld(){
 const npcRows=await NPC.findAll({limit:1000});
 for(const n of npcRows){
   const seed=String(n.id)+':'+String(n.name); const h=seed.split('').reduce((a,ch)=>Math.imul(a^ch.charCodeAt(0),16777619)>>>0,2166136261);
   const [profile]=await NPCProfile.findOrCreate({where:{npcId:n.id},defaults:{npcId:n.id,biography:(n.description||'Histoire encore inconnue.')+' Métier: '+(n.role||'habitant')+'. Spécialité: '+(n.specialty||'aucune')+'.',appearance:n.description||'Apparence non documentée.',voice:['voix posée','ton nerveux','parole douce','voix grave','ton formel'][h%5],values:JSON.stringify(['famille','survie','honneur'].slice(0,1+(h%3))),fears:JSON.stringify(['être trahi','perdre un proche'].slice(0,1+(h%2))),ambitions:JSON.stringify(['protéger son entourage','gagner en influence']),habits:JSON.stringify(['observer les passants','tenir un carnet']),socialStyle:['réservé','curieux','fier','patient','méfiant'][h%5],professionDetail:(n.role||'habitant')+' — '+(n.specialty||'sans spécialité'),personalConflict:'Une difficulté personnelle influence ses décisions.'}});
   await NPCMemory.findOrCreate({where:{npcId:n.id},defaults:{npcId:n.id,biography:profile.biography,traits:JSON.stringify([profile.socialStyle,n.role||'habitant']),values:profile.values,fears:profile.fears,goals:profile.ambitions,secrets:'[]',memories:'[]'}});
 }
 const now=new Date(), memories=await NPCMemory.findAll({limit:200});
 for(const m of memories){const stress=Math.max(0,Math.min(100,m.stress+(Math.random()<.12?2:Math.random()<.18?-2:0)));await m.update({stress,mood:stress>75?'tendu':stress<20?'serein':m.mood,lastSimulatedAt:now});}
 const markets=await Market.findAll({limit:200});
 for(const m of markets){const pressure=(m.demand-m.supply)/Math.max(20,m.supply);const next=Math.max(1,Math.round(m.currentPrice*(1+pressure*.02+(Math.random()-.5)*.04)));await m.update({currentPrice:next});}
 const regions=await Region.findAll();
 for(const r of regions){
   const localEvents=await Event.count({where:{status:'active',locationKey:{[Op.like]:r.key+'%'}}});
   const stability=Math.max(0,Math.min(100,r.stability+(localEvents>2?-1:Math.random()<.2?1:0)));
   await r.update({stability});
 }
 const places=await Location.findAll();
 for(const p of places){
   const prosperity=Math.max(0,Math.min(100,p.prosperity+(Math.random()<.12?1:Math.random()<.1?-1:0)));
   const security=Math.max(0,Math.min(100,p.security+(Math.random()<.08?1:Math.random()<.08?-1:0)));
   await p.update({prosperity,security});
 }
 const factions=await Faction.findAll();
 for(const f of factions){
   const income=Math.max(5,Math.round(f.influence*.15));
   const treasury=Math.max(0,f.treasury+income-Math.round(f.military*.08));
   const legitimacy=Math.max(0,Math.min(100,f.legitimacy+(treasury>f.treasury?0.1:-0.1)));
   await f.update({treasury,legitimacy});
 }
 await Event.update({status:'resolved'},{where:{status:'active',endsAt:{[Op.lt]:now}}});
 if(Math.random()<.1){const places=await Location.findAll({limit:30});if(places.length){const p=places[Math.floor(Math.random()*places.length)];const title='Incident local à '+p.name;const eventKey=key(title)+'_'+Date.now();await Event.create({eventKey,title,category:'local',locationKey:p.key,description:'Un événement perturbe temporairement la vie quotidienne de '+p.name+'.',severity:2,consequences:JSON.stringify([{location:p.name}])});await WorldJournal.create({entry:title,importance:2,category:'world_event'});}}
}
async function marketQuote(name){const item=await Item.findOne({where:{name:{[Op.like]:'%'+name+'%'}}});if(!item)return null;const [m]=await Market.findOrCreate({where:{itemName:item.name},defaults:{itemName:item.name,basePrice:item.price||10,currentPrice:item.price||10}});return {name:item.name,price:m.currentPrice,supply:m.supply,demand:m.demand};}
module.exports={initializeWorld,rememberNPC,snapshot,worldContext,tickWorld,marketQuote,FEATURES,Region,Location,Faction,NPCMemory,NPCProfile,NPCSocialLink,Event,Market,Discipline,Law};
