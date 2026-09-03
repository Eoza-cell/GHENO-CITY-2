const sharp = require('sharp');

const W = 1280, H = 720;

function esc(v='') {
  return String(v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function bar(value, max, width=330) {
  const ratio = Math.max(0, Math.min(1, Number(value || 0) / Math.max(1, Number(max || 1))));
  return { width, fill: Math.round(width * ratio), pct: Math.round(ratio * 100) };
}

async function render(svg) {
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

function shell(title, subtitle, body) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111827"/><stop offset="0.55" stop-color="#05070c"/><stop offset="1" stop-color="#162032"/></linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#33c7ff"/><stop offset="1" stop-color="#9b5cff"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-opacity=".45"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="720" fill="url(#accent)"/>
  <rect x="52" y="42" width="1176" height="92" rx="12" fill="#0a0f18" stroke="#2b425d" stroke-width="2"/>
  <text x="84" y="82" fill="#dff7ff" font-size="34" font-family="Arial" font-weight="700">${esc(title)}</text>
  <text x="84" y="113" fill="#7f9ab3" font-size="18" font-family="Arial">${esc(subtitle)}</text>
  <text x="1170" y="88" text-anchor="end" fill="#33c7ff" font-size="20" font-family="Arial" font-weight="700">ATR ONLINE</text>
  <circle cx="1198" cy="108" r="7" fill="#55e88b"/>
  ${body}
  <text x="84" y="686" fill="#5d7086" font-size="16" font-family="Arial">AFTER THE REBIRTH • INTERFACE TACTIQUE</text>
  </svg>`;
}

async function generateRegistrationPanel(step, data={}) {
  const steps = ['IDENTITÉ','PROFIL','ÂGE','APPARENCE','VALIDATION'];
  const current = Math.max(0, Math.min(4, Number(step)||0));
  let stepSvg = steps.map((s,i)=>{
    const x=90+i*220, active=i===current, done=i<current;
    return `<rect x="${x}" y="168" width="190" height="46" rx="8" fill="${active?'#12344b':done?'#153326':'#0b111a'}" stroke="${active?'#33c7ff':done?'#55e88b':'#243447'}"/><text x="${x+95}" y="198" text-anchor="middle" fill="${active?'#dff7ff':done?'#9ff5bf':'#64748b'}" font-size="16" font-family="Arial" font-weight="700">${i+1}. ${s}</text>`;
  }).join('');

  const prompts=[
    ['CHOISIS TON NOM','Entre un nom de 3 à 20 caractères.'],
    ['IDENTITÉ DU PERSONNAGE','Indique le genre/identité que tu souhaites pour ton personnage.'],
    ['ÂGE DU PERSONNAGE','Entre un âge entre 1 et 149.'],
    ['APPARENCE & STYLE','Décris les cheveux, yeux, silhouette, style et détails visuels.'],
    ['PERSONNAGE CRÉÉ','Ton identité est maintenant enregistrée dans la matrice.']
  ];
  const [headline,desc]=prompts[current];
  const body=`
  ${stepSvg}
  <rect x="90" y="260" width="1100" height="300" rx="16" fill="#08111d" stroke="#263a50" filter="url(#shadow)"/>
  <text x="140" y="332" fill="#33c7ff" font-size="22" font-family="Arial" font-weight="700">CRÉATION DU PERSONNAGE</text>
  <text x="140" y="395" fill="#ffffff" font-size="40" font-family="Arial" font-weight="700">${headline}</text>
  <text x="140" y="438" fill="#a9bac9" font-size="23" font-family="Arial">${desc}</text>
  <rect x="140" y="480" width="900" height="2" fill="#20354a"/>
  <text x="140" y="525" fill="#7f9ab3" font-size="19" font-family="Arial">HÉRITIER : ${esc(data.name || 'NON DÉFINI')}</text>
  `;
  return render(shell('AFTER THE REBIRTH', 'MATRICE D’INCARNATION • ÉTAPE '+(current+1)+'/5', body));
}

async function generateTacticalStatus(player, equipped={}) {
  const hp=bar(player.health,player.maxHealth), mp=bar(player.mana,player.maxMana);
  const row=(label,b,y,color)=>`<text x="110" y="${y}" fill="#d7e5f0" font-size="20" font-family="Arial" font-weight="700">${label}</text><rect x="300" y="${y-20}" width="${b.width}" height="16" rx="8" fill="#182635"/><rect x="300" y="${y-20}" width="${b.fill}" height="16" rx="8" fill="${color}"/><text x="650" y="${y}" fill="#d7e5f0" font-size="18" font-family="Arial">${b.pct}%</text>`;
  const body=`
  <rect x="78" y="165" width="720" height="470" rx="16" fill="#09131f" stroke="#263f57"/>
  <text x="110" y="220" fill="#fff" font-size="30" font-family="Arial" font-weight="700">${esc(player.name || 'HÉRITIER')}</text>
  <text x="110" y="255" fill="#8199ad" font-size="18" font-family="Arial">NIVEAU ${player.level || 1} • RANG ${esc(player.rank || 'F')}</text>
  ${row('VIE',hp,325,'#ff4d67')}
  ${row('MANA',mp,380,'#4ba8ff')}
  <text x="110" y="450" fill="#9db2c4" font-size="19" font-family="Arial">💰 COL</text><text x="650" y="450" fill="#fff" font-size="25" font-family="Arial" text-anchor="end">${player.col || 0}</text>
  <text x="110" y="500" fill="#9db2c4" font-size="19" font-family="Arial">📍 POSITION</text><text x="650" y="500" fill="#fff" font-size="19" font-family="Arial" text-anchor="end">${esc(player.location || 'Inconnue')}</text>
  <text x="110" y="550" fill="#9db2c4" font-size="19" font-family="Arial">👗 TENUE</text><text x="650" y="550" fill="#fff" font-size="18" font-family="Arial" text-anchor="end">${esc(player.equippedOutfit || 'Tenue de base')}</text>
  <rect x="835" y="165" width="360" height="470" rx="16" fill="#0a111b" stroke="#263f57"/>
  <text x="875" y="220" fill="#33c7ff" font-size="22" font-family="Arial" font-weight="700">ÉQUIPEMENT</text>
  ${['head','chest','arms','legs','weapon'].map((s,i)=>`<text x="875" y="${280+i*58}" fill="${equipped[s]?'#7df7ad':'#718096'}" font-size="22" font-family="Arial">${equipped[s]?'●':'○'} ${s.toUpperCase()}</text>`).join('')}
  `;
  return render(shell('STATUT TACTIQUE', 'LECTURE EN TEMPS RÉEL DE LA MATRICE', body));
}

async function generateMenuPanel(player) {
  const cards=[
    ['⚔','ACTION','/action • /quests'],
    ['👤','HÉRITIER','/profil • /statut'],
    ['🗺','MONDE','/map • /lieux'],
    ['👗','STYLE','/tenue • /boutique vetement'],
    ['📚','ARCHIVES','/lore'],
    ['⚙','SYSTÈME','/status • /help']
  ];
  const body=cards.map((c,i)=>{
    const col=i%3,row=Math.floor(i/3),x=85+col*370,y=180+row*210;
    return `<rect x="${x}" y="${y}" width="330" height="170" rx="16" fill="#0a1420" stroke="#294158"/><text x="${x+35}" y="${y+58}" font-size="34">${c[0]}</text><text x="${x+35}" y="${y+100}" fill="#eaf7ff" font-size="24" font-family="Arial" font-weight="700">${c[1]}</text><text x="${x+35}" y="${y+132}" fill="#8ca5ba" font-size="16" font-family="Arial">${c[2]}</text>`;
  }).join('');
  return render(shell('AFTER THE REBIRTH', `ACCÈS RAPIDE • ${player?.name || 'HÉRITIER'}`, body));
}

module.exports={generateRegistrationPanel,generateTacticalStatus,generateMenuPanel};
