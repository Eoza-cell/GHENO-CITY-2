/** RAiden Core — single AI gateway for ATR. Puter.js is the only model provider used here. */
const memory = require('./raiden-memory');
let puter = null;
function loadPuter() {
  if (puter) return puter;
  try { const { init } = require('@heyputer/puter.js/src/init.cjs'); puter = init(process.env.PUTER_AUTH_TOKEN || process.env.PUTER_TOKEN); return puter; }
  catch (e) { console.error('[RAIDEN] Puter init failed:', e.message); return null; }
}
function extractPlayerId(text) { const m=String(text||'').match(/\[JOUEUR_ID:\s*([^\]]+)\]/i); return m ? m[1].trim() : null; }
function cleanJson(text) {
  if (typeof text !== 'string') return text;
  const raw=text.replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/i,'').trim();
  const start=raw.indexOf('{'), end=raw.lastIndexOf('}');
  if (start<0 || end<=start) throw new Error('Raiden: JSON introuvable');
  return JSON.parse(raw.slice(start,end+1));
}
function valid(r) { return r && typeof r.narrative==='string' && r.narrative.trim().length>=3 && Array.isArray(r.actions); }
async function ask(messages, model) {
  const client=loadPuter(); if (!client?.ai?.chat) throw new Error('Puter.js indisponible');
  const response=await client.ai.chat(messages,{model,stream:false,temperature:0.7,max_tokens:1800,reasoning_effort:'medium',normalize:true});
  const content=response?.message?.content ?? response?.choices?.[0]?.message?.content ?? response?.text;
  if (!content) throw new Error('Puter: réponse vide');
  return cleanJson(content);
}
async function run(systemPrompt,userPrompt,options={}) {
  const playerId=options.playerId || extractPlayerId(userPrompt);
  const remembered=await memory.formatted({playerId,location:options.location,subLocation:options.subLocation,query:options.query||userPrompt});
  const system=systemPrompt+'\n\nRAIDEN — RÈGLES ABSOLUES:\n'+
    '- La base de données est la vérité. Ne crée jamais de statistiques, positions, inventaires, quêtes, PNJ ou joueurs absents.\n'+
    '- La mémoire narrative ne dépasse jamais l’état actuel de la DB.\n'+
    '- Ne mélange jamais deux joueurs. Une action sans cible explicite concerne uniquement son auteur.\n'+
    '- Ne transforme jamais une intention en réussite automatique.\n'+
    '- Les distances X/Y fournies sont déterministes.\n'+
    '- Réponds UNIQUEMENT avec un JSON valide: {"pensee_mj":"","narrative":"","actions":[],"imagePrompt":""}\n'+
    '- actions: objets {"type":"...","parameters":{...}}. Si aucune modification DB: [].\n'+
    '- Pas de faux fallback ni de message technique dans la narration.\n'+remembered;
  const messages=[{role:'system',content:system},{role:'user',content:userPrompt}];
  const primary=process.env.PUTER_MODEL || 'gemini-2.5-flash';
  const models=[...new Set([primary,'gpt-4o-mini','claude-3-5-sonnet'])];
  let lastError=null;
  for (const model of models) {
    try { console.log('[RAIDEN] Puter model='+model+' player='+(playerId||'unknown')+' memories='+(remembered?'yes':'no')); const result=await ask(messages,model); if(valid(result)) return JSON.stringify(result); lastError=new Error('JSON Raiden invalide'); }
    catch(e) { lastError=e; console.warn('[RAIDEN] '+model+' failed: '+e.message); }
  }
  throw lastError || new Error('Raiden indisponible');
}
module.exports={run};