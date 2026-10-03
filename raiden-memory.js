/** Raiden persistent memory. DB is authoritative; this layer only retrieves existing facts. */
const { Op } = require('sequelize');
const { RPMessage, WorldJournal, NPC, NPCRelationship } = require('./database');

function terms(q) {
  return [...new Set(String(q || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').split(/[^a-z0-9À-ÿ]+/i).filter(w => w.length >= 4))].slice(0, 18);
}
function score(text, words) {
  const s = String(text || '').toLowerCase();
  return words.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
}
async function retrieve({ playerId, location, subLocation, query, limit = 24 }) {
  const words = terms(query); const out = [];
  if (playerId) {
    const rows = await RPMessage.findAll({ where: { senderJid: playerId }, order: [['id','DESC']], limit: 80 });
    for (const r of rows) { const text = r.senderName + ': ' + r.content; out.push({kind:'player_history', score:score(text,words)+(r.location===location?2:0)+(r.subLocation===subLocation?1:0), text}); }
  }
  if (location) {
    const rows = await RPMessage.findAll({ where: { location, subLocation }, order: [['id','DESC']], limit: 60 });
    for (const r of rows) { const text = r.senderName + ': ' + r.content; out.push({kind:'scene_history', score:score(text,words)+2, text}); }
  }
  const journal = await WorldJournal.findAll({ order: [['importance','DESC'],['id','DESC']], limit: 80 });
  for (const j of journal) { const text = '[' + j.category + '] ' + j.entry; out.push({kind:'world_memory', score:score(text,words)+Number(j.importance||1), text}); }
  if (location) {
    const npcs = await NPC.findAll({ where: { location }, order: [['powerLevel','DESC']], limit: 20 });
    for (const n of npcs) {
      let rel = null; if (playerId) rel = await NPCRelationship.findOne({where:{PlayerWhatsappId:playerId,NPCId:n.id}});
      let text = 'PNJ ' + n.name + ' | rôle=' + n.role + ' | personnalité=' + (n.personality||'') + ' | spécialité=' + (n.specialty||'');
      if (rel) text += ' | relation confiance=' + rel.trust + ' respect=' + rel.respect + ' peur=' + rel.fear + ' réputation=' + rel.reputation;
      out.push({kind:'npc_memory', score:score(text,words)+2, text});
    }
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,limit);
}
async function formatted(args) {
  const rows = await retrieve(args); if (!rows.length) return '';
  return '\n### RAIDEN_MEMOIRE_RETRIEVEE\n' + rows.map((r,i)=>(i+1)+'. ['+r.kind+'] '+r.text).join('\n') + '\n### FIN_MEMOIRE\n';
}
module.exports = { retrieve, formatted };