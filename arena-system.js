const { Player } = require('./database');

// Arena definitions matching prompt specifications
const ARENAS = {
  sylvar: {
    id: 'sylvar',
    name: '🏟️ 𝗦𝗬𝗟𝗩𝗔𝗥 𝗔𝗥𝗘𝗡𝗔 🏟️',
    shortName: 'Sylvar Arena',
    description: "ⓘ ᴜɴᴇ ᴘʟᴀᴛᴇғᴏʀᴍᴇ ᴀɴᴄɪᴇɴɴᴇ sᴜsᴘᴇɴᴅᴜᴇ ᴅᴀɴs ʟᴇ ᴠɪᴅᴇ, ғᴏʀᴍᴇᴇ ᴅᴇ ᴍᴇᴛᴀʟ ʀᴜɪɴᴇ ᴇᴛ ᴅᴇ ʀᴀᴄɪɴᴇs ᴄᴏʟᴏssᴀʟᴇs. ᴅᴇs ᴘᴏɴᴛs ᴏʀɢᴀɴɪǫᴜᴇs ʀᴇʟɪᴇɴᴛ ʟᴇs ᴘɪʟɪᴇʀs ᴅᴇ ᴄᴇᴛᴛᴇ sᴛʀᴜᴄᴛᴜʀᴇ ᴏᴜʙʟɪᴇᴇ, ᴛᴀɴᴅɪs ǫᴜᴇ ᴅᴇ ᴇᴘᴀɪssᴇs ʙʀᴜᴍᴇs ᴄᴀᴄʜᴇɴᴛ ʟᴇs ᴀʙɪᴍᴇs sᴏᴜs ʟ’ᴀʀᴇɴᴇ. ʟᴀ ɴᴀᴛᴜʀᴇ ᴇᴛ ʟᴀ ᴛᴇᴄʜɴᴏʟᴏɢɪᴇ s’ʏ sᴏɴᴛ ғᴜsɪᴏɴɴᴇᴇs ᴅᴇᴘᴜɪs ᴅᴇs sɪᴇᴄʟᴇs.",
    specs: {
      distance: '15m',
      latency: '10min',
      dimension: '500×500 m',
    },
    rules: "🏟️ : ʟᴇs ʀᴀᴄɪɴᴇs ɢᴇᴀɴᴛᴇs ᴏғғʀᴇɴᴛ +15% ᴇsǫᴜɪᴠᴇ. ʟᴇs ᴘʟᴀǫᴜᴇs ᴀɴᴄɪᴇɴɴᴇs ᴀᴄᴄᴏʀᴅᴇɴᴛ +10% ᴀᴜx sᴏɪɴs ᴇᴛ ᴀ ʟᴀ ʀᴇɢᴇɴᴇʀᴀᴛɪᴏɴ. ʟᴇs ʙᴏʀᴅs ғʀᴀɢɪʟɪsᴇs ɪɴғʟɪɢᴇɴᴛ 70 ᴅᴇɢᴀᴛs ᴇɴ ᴄᴀs ᴅᴇ ᴘʀᴏᴊᴇᴄᴛɪᴏɴ. ʟᴀ ʙʀᴜᴍᴇ ʀᴇᴅᴜɪᴛ ʟᴀ ᴠɪsɪʙɪʟɪᴛᴇ ᴀ 15ᴍ, ᴜɴᴇ ᴄʜᴜᴛᴇ ᴅᴀɴs ʟᴇ ᴠɪᴅᴇ ɪɴғʟɪɢᴇ 250 ᴅᴇɢᴀᴛs.",
    modifications: [
      "🌿 Révélation Sylvestre : La brume se dissipe légèrement (+5m de visi, +5% précision).",
      "⚡ Décharge des plaques anciennes : Soins bonus augmentés à +15% pendant 2 tours.",
      "💨 Vents des Abîmes : Risque de projection vers les bords augmenté (+10% dégâts de chute).",
      "🌱 Poussée de racines : Les racines offrent +20% esquive mais réduisent la vitesse de déplacement.",
      "🔒 Résonance technologique : La régénération de mana/énergie est boostée de +10%."
    ]
  },
  abyssal: {
    id: 'abyssal',
    name: '🌑 𝗔𝗕𝗬𝗦𝗦𝗔𝗟_𝗔𝗥𝗘𝗡𝗔 🌑',
    shortName: 'Abyssal Arena',
    description: "ⓘ ɪᴍᴇɴsᴇ sᴀʟʟᴇ sᴏᴜᴛᴇʀᴀɪɴᴇ ᴘʟᴏɴɢᴇ ᴅᴀɴs ᴜɴᴇ ᴏʙsᴄᴜʀɪᴛᴇ ǫᴜᴀsɪ ᴛᴏᴛᴀʟᴇ. ʟ'ᴀʀᴇɴᴇ ᴘʀɪɴᴄɪᴘᴀʟᴇ ᴇsᴛ ᴇɴᴛᴏᴜʀᴇᴇ ᴅᴇ ɴᴏᴍʙʀᴇᴜsᴇs ᴘʟᴀᴛᴇғᴏʀᴍᴇs ᴄɪʀᴄᴜʟᴀɪʀᴇs sᴜsᴘᴇɴᴅᴜᴇs ᴀᴜ-ᴅᴇssᴜs ᴅ'ᴜɴ ɢᴏᴜғғʀᴇ. ᴄᴇʀᴛᴀɪɴᴇs sᴏɴᴛ ᴀᴄᴄᴇssɪʙʟᴇs ᴅᴇᴘᴜɪs ʟᴇ sᴏʟ ᴘʀɪɴᴄɪᴘᴀʟ, ᴛᴀɴᴅɪs ǫᴜᴇ ᴅ'ᴀᴜᴛʀᴇs ɴᴇᴄᴇssɪᴛᴇɴᴛ ᴅᴇs ᴅᴇᴘʟᴀᴄᴇᴍᴇɴᴛs ᴀᴇʀɪᴇɴs ᴏᴜ ᴅᴇs sᴀᴜᴛs.",
    specs: {
      distance: '20 m',
      size: '70m de diamètre',
      platforms: '8',
      latency: '10 min',
    },
    rules: "🏟️ : ʟᴇs ᴅᴇᴘʟᴀᴄᴇᴍᴇɴᴛs ᴇɴᴛʀᴇ ᴘʟᴀᴛᴇғᴏʀᴍᴇs sᴏɴᴛ ғᴀᴄɪʟɪᴛᴇs ᴘᴏᴜʀ ʟᴇs ᴄᴏᴍʙᴀᴛᴛᴀɴᴛs ᴘᴏssᴇᴅᴀɴᴛ ᴜɴᴇ ᴄᴀᴘᴀᴄɪᴛᴇ ᴀᴇʀɪᴇɴᴇ. ᴜɴᴇ ᴄʜᴜᴛᴇ ᴅᴇᴘᴜɪs ᴜɴᴇ ᴘʟᴀᴛᴇғᴏʀᴍᴇ ɪɴғʟɪɢᴇ -40 ᴘᴠ. ʟᴇs ᴘʟᴀᴛᴇғᴏʀᴍᴇs sᴇᴄᴏɴᴅᴀɪʀᴇs ᴘᴇᴜᴠᴇɴᴛ ᴇᴛʀᴇ ᴅᴇᴛʀᴜɪᴛᴇs ᴏᴜ ᴅᴇᴘʟᴀᴄᴇᴇs ᴘᴀʀ ᴄᴇʀᴛᴀɪɴᴇs ᴄᴏᴍᴘᴇᴛᴇɴᴄᴇs.",
    modifications: [
      "🌌 Ombre Profonde : L'obscurité s'intensifie, attaques furtives +15% dégâts.",
      "💥 Instabilité des Plateformes : 2 plateformes vacillent, risque de chute accru (-50 PV en chute).",
      "🌀 Courant d'Air Ascendant : Les déplacements aériens consomment 50% moins d'énergie.",
      "🔮 Résonance Abyssale : Les sorts de type Ténèbres/Ombre gagnent +15 DMG.",
      "🛡️ Bouclier des Prophètes : La plateforme centrale active un bouclier temporaire de 20 PV."
    ]
  },
  solarys: {
    id: 'solarys',
    name: '🏜️ 𝗦𝗢𝗟𝗔𝗥𝗬𝗦_𝗗𝗨𝗡𝗘 🏜️',
    shortName: 'Solarys Dune',
    description: "ⓘ ɪᴍᴍᴇɴsᴇ ᴇᴛᴇɴᴅᴜᴇ ᴅᴇsᴇʀᴛɪǫᴜᴇ ʀᴇᴄᴏᴜᴠᴇʀᴛᴇ ᴅ'ᴜɴ sᴀʙʟᴇ ʙʀᴜʟᴀɴᴛ ᴇᴛ ᴘᴀʀᴄᴏᴜʀᴜᴇ ᴅᴇ ɢɪɢᴀɴᴛᴇsǫᴜᴇs sᴛʀᴜᴄᴛᴜʀᴇs ʀᴏᴄʜᴇᴜsᴇs. ʟᴇs ғᴏʀᴍᴀᴛɪᴏɴs ᴅʀᴇssᴇs ᴅᴀɴs ʟᴇ ᴅᴇsᴇʀᴛ ᴄᴏɴsᴛɪᴛᴜᴇɴᴛ ʟᴇs sᴇᴜʟs ᴠᴇʀɪᴛᴀʙʟᴇs ᴏʙsᴛᴀᴄʟᴇs ᴅᴜ ᴛᴇʀʀᴀɪɴ. ʟ'ᴀʙsᴇɴᴄᴇ ᴅᴇ ᴄᴏᴜᴠᴇʀᴛᴜʀᴇ ᴇɴᴛʀᴇ ᴄᴇs sᴛʀᴜᴄᴛᴜʀᴇs ᴛʀᴀɴsғᴏʀᴍᴇ ʟᴇs ᴀғғʀᴏɴᴛᴇᴍᴇɴᴛs ᴀ ᴅɪsᴛᴀɴᴄᴇ ᴇɴ ᴠᴇʀɪᴛᴀʙʟᴇs ᴅᴜᴇʟs ᴅᴇ ᴘᴏsɪᴛɪᴏɴɴᴇᴍᴇɴᴛ.",
    specs: {
      distance: '25 m',
      dimension: '150m x 150m',
      latency: '10 min',
    },
    rules: "🏟️ : ʟᴇs ᴄᴏᴍᴘᴇᴛᴇɴᴄᴇs ᴅᴇ ᴛʏᴘᴇ ғᴇᴜ ɢᴀɢɴᴇɴᴛ +10 ᴅᴍɢ. ʟᴀ ᴄʜᴀʟᴇᴜʀ ᴀᴜɢᴍᴇɴᴛᴇ ᴘʀᴏɢʀᴇssɪᴠᴇᴍᴇɴᴛ : ᴀᴘʀᴇs 5 ᴛᴏᴜʀs, ᴄʜᴀǫᴜᴇ ᴄᴏᴍʙᴀᴛᴛᴀɴᴛ ᴘᴇʀᴅ -5 ᴘᴠ ᴘᴀʀ ᴛᴏᴜʀ. ʟᴇs ғᴏʀᴍᴀᴛɪᴏɴs ʀᴏᴄʜᴇᴜsᴇs ᴏғʀᴇɴᴛ ᴜɴᴇ ᴘʀᴏᴛᴇᴄᴛɪᴏɴ ᴄᴏɴᴛʀᴇ ʟᴇs ᴀᴛᴛᴀǫᴜᴇs ᴅɪʀᴇᴄᴛᴇs ᴍᴀɪs ᴘᴇᴜᴠᴇɴᴛ ᴇᴛʀᴇ ᴅᴇᴛʀᴜɪᴛᴇs.",
    modifications: [
      "🔥 Vague de Chaleur : Compétences Feu +15 DMG (au lieu de +10), dégâts de chaleur avancés au tour 3.",
      "🌪️ Tempête de Sable : Visi réduite à 10m, attaques à distance subissent -20% précision.",
      "🪨 Éboulement Rocheux : Une nouvelle formation rocheuse apparaît au centre.",
      "☀️ Éclat Solaire : Les cibles découvertes subissent +5% de dégâts critiques.",
      "🏜️ Oasis Miragène : Une zone de sable frais offre +10 PV de soin aux combattants immobiles."
    ]
  },
  dracocrypt: {
    id: 'dracocrypt',
    name: '🐉 𝗗𝗿𝗮𝗰𝗼𝗰𝗿𝘆𝗽𝘁_𝗔𝗿𝗲𝗻𝗮 🐉',
    shortName: 'Dracocrypt Arena',
    description: "ⓘ sᴀɴᴄᴛᴜᴀɪʀᴇ ᴄᴏʟᴏssᴀʟ ᴄᴏɴsᴛʀᴜɪᴛ ᴀᴜᴛᴏᴜʀ ᴅᴇs ʀᴇsᴛᴇs ᴅ'ᴜɴᴇ ᴄʀᴇᴀᴛᴜʀᴇ ᴅʀᴀᴄᴏɴɪǫᴜᴇ ᴀɴᴛɪǫᴜᴇ. ᴜɴᴇ ɪᴍᴍᴇɴsᴇ ᴛᴇᴛᴇ ᴅᴇ ᴅʀᴀɢᴏɴ ᴅᴏᴍɪɴᴇ ʟ'ᴀʀᴇɴᴇ ᴅᴇᴘᴜɪs ʟᴇs ᴘʀᴏғᴏɴᴅᴇᴜʀs ᴅᴇ ʟᴀ sᴀʟᴇ. ᴅᴇs ᴘɪʟɪᴇʀs ᴄʜᴀʀɢᴇs ᴅ'ᴇɴᴇʀɢɪᴇ ᴇɴᴛᴏᴜʀᴇɴᴛ ʟᴀ ᴢᴏɴᴇ ᴄᴇɴᴛʀᴀʟᴇ ᴇᴛ ᴀʟɪᴍᴇɴᴛᴇɴᴛ ᴄᴏɴᴛɪɴᴜᴇʟᴇᴍᴇɴᴛ ʟᴇ ᴄᴇʀᴄʟᴇ ᴅᴇ ᴄᴏᴍʙᴀᴛ.",
    specs: {
      distance: '15m',
      size: '60m diamètre',
      pillars: '8',
      latency: '10 min',
    },
    rules: "🏟️ : ʟᴇs ᴄᴏᴍᴘᴇᴛᴇɴᴄᴇs ᴇʟᴇᴍᴇɴᴛᴀɪʀᴇs ɢᴀɢɴᴇɴᴛ +10 ᴅᴍɢ. ʟᴏʀsǫᴜ'ᴜɴᴇ ᴄᴏᴍᴘᴇᴛᴇɴᴄᴇ ᴘᴜɪssᴀɴᴛᴇ ғʀᴀᴘᴇ ʟᴇ ᴄᴇʀᴄʟᴇ ᴄᴇɴᴛʀᴀʟ, ᴜɴᴇ ʀᴇsᴏɴᴀɴᴄᴇ ᴅʀᴀᴄᴏɴɪǫᴜᴇ ᴘᴇᴜᴛ ᴘʀᴏᴠᴏǫᴜᴇʀ ᴜɴᴇ ᴏɴᴅᴇ ᴅᴇ ᴄʜᴏᴄ ᴀᴜᴛᴏᴜʀ ᴅᴜ ᴘᴏɪɴᴛ ᴅ'ɪᴍᴘᴀᴄᴛ. ʟᴇs ᴘɪʟɪᴇʀs ᴘᴇᴜᴠᴇɴᴛ sᴇʀᴠɪʀ ᴅᴇ ᴄᴏᴜᴠᴇʀᴛᴜʀᴇ ᴍᴀɪs ᴘᴇᴜᴠᴇɴᴛ ᴇᴛʀᴇ ᴅᴇᴛʀᴜɪᴛs.",
    modifications: [
      "🔥 Souffle Draconique Residual : Les compétences élémentaires gagnent +15 DMG.",
      "⚡ Surcharge des Piliers : Un pilier libère une vague d'énergie (20 DMG zone circulaire).",
      "🛡️ Égide Ancienne : La tête de dragon projette une aura protectrice (+10 DEF).",
      "💥 Ébranlement du Sanctuaire : Fréquence de l'onde de choc augmentée à chaque coup au centre.",
      "🐲 Rugissement Ancestral : Tous les participants gagnent +10% d'attaque pendant 1 tour."
    ]
  }
};

// Global arena state memory (supports per-group or global arena)
const arenaStates = new Map();

function getArenaState(chatId = 'default') {
  if (!arenaStates.has(chatId)) {
    arenaStates.set(chatId, {
      currentArenaId: 'sylvar',
      changeGauge: 0, // 0 to 100%
      modification: "Arène active dans son état standard initial.",
      shiftCount: 0
    });
  }
  return arenaStates.get(chatId);
}

function renderProgressBar(percentage, length = 10) {
  const filled = Math.min(length, Math.round((percentage / 100) * length));
  const empty = length - filled;
  return '🔷'.repeat(filled) + '◽'.repeat(empty);
}

function shiftArena(chatId = 'default', targetArenaId = null) {
  const state = getArenaState(chatId);
  const keys = Object.keys(ARENAS);

  let nextArenaId = targetArenaId;
  if (!nextArenaId || !ARENAS[nextArenaId]) {
    // Pick next arena sequentially or randomly
    const currentIndex = keys.indexOf(state.currentArenaId);
    nextArenaId = keys[(currentIndex + 1) % keys.length];
  }

  state.currentArenaId = nextArenaId;
  state.changeGauge = 0;
  state.shiftCount += 1;

  const arenaData = ARENAS[nextArenaId];
  const mods = arenaData.modifications;
  state.modification = mods[Math.floor(Math.random() * mods.length)];

  return { state, arena: arenaData };
}

function advanceGauge(chatId = 'default', amount = 25) {
  const state = getArenaState(chatId);
  state.changeGauge += amount;

  let shifted = false;
  if (state.changeGauge >= 100) {
    shiftArena(chatId);
    shifted = true;
  } else {
    // Pick dynamic minor modification for current state advance
    const arenaData = ARENAS[state.currentArenaId];
    const mods = arenaData.modifications;
    state.modification = mods[Math.floor(Math.random() * mods.length)];
  }

  return { state, shifted, arena: ARENAS[state.currentArenaId] };
}

function formatArenaDisplay(chatId = 'default') {
  const state = getArenaState(chatId);
  const arena = ARENAS[state.currentArenaId];
  const bar = renderProgressBar(state.changeGauge, 10);

  let specsText = '';
  if (arena.specs.distance) specsText += `- *📏ᴅɪsᴛᴀɴᴄᴇ : ${arena.specs.distance}*\n`;
  if (arena.specs.latency) specsText += `- *⏱️ʟᴀᴛᴇɴᴄᴇ : ${arena.specs.latency}*\n`;
  if (arena.specs.dimension) specsText += `- *⛳ᴅɪᴍᴇɴᴛⁿ: ${arena.specs.dimension}*\n`;
  if (arena.specs.size) specsText += `- *⛳ᴛᴀɪʟʟᴇ : ${arena.specs.size}*\n`;
  if (arena.specs.platforms) specsText += `- *🪨ᴘʟᴀᴛᴇғᴏʀᴍᴇs :${arena.specs.platforms}*\n`;
  if (arena.specs.pillars) specsText += `- *🗿ᴘɪʟɪᴇʀs : ${arena.specs.pillars}*\n`;

  return `${arena.name}\n` +
         `▭▬▭▬▭▬▭▬▭▬▭▬▭\n` +
         `> *${arena.description}*\n` +
         `▭▬▭▬▭▬▭▬▭▬▭▬▭\n` +
         `${specsText}` +
         `▭▬▭▬▭▬▭▬▭▬▭▬▭\n` +
         `${arena.rules}\n\n` +
         `⚡ *⚙️ 𝗠𝗢𝗗𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗗𝗬𝗡𝗔𝗠𝗜𝗤𝗨𝗘:* ${state.modification}\n` +
         `📊 *𝗕𝗔𝗥𝗥𝗘 𝗗𝗘 𝗖𝗛𝗔𝗡𝗚𝗘𝗠𝗘𝗡𝗧 𝗗'𝗔𝗥𝗘̀𝗡𝗘:* [ ${bar} ] *${state.changeGauge}%*`;
}

module.exports = {
  ARENAS,
  getArenaState,
  shiftArena,
  advanceGauge,
  formatArenaDisplay,
  renderProgressBar
};
