'use strict';

// Patch ciblé de Baileys 6.7.24 : inclure le bundle de clés dès le PREMIER
// retry après un échec de déchiffrement. Sans cela, Baileys demande un renvoi
// mais n'envoie pas les clés nécessaires pour rétablir une session Signal.
// Source vérifiée : WhiskeySockets/Baileys v6.7.24, src/Socket/messages-recv.ts.
const fs = require('fs');
const path = require('path');

const entry = require.resolve('@whiskeysockets/baileys');
const packageRoot = path.resolve(path.dirname(entry), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

if (packageJson.version !== '6.7.24') {
  throw new Error('[BAILEYS-PATCH] Version inattendue ' + packageJson.version + '. Vérifier le patch avant toute mise à jour.');
}

const target = path.join(path.dirname(entry), 'Socket', 'messages-recv.js');
if (!fs.existsSync(target)) {
  throw new Error('[BAILEYS-PATCH] Fichier compilé introuvable : ' + target);
}

const source = fs.readFileSync(target, 'utf8');
const original = 'if (retryCount > 1 || forceIncludeKeys)';
const patched = 'if (retryCount >= 1 || forceIncludeKeys)';

if (source.includes(patched)) {
  console.log('[BAILEYS-PATCH] Correctif du premier retry déjà présent.');
} else {
  const occurrences = source.split(original).length - 1;
  if (occurrences !== 1) {
    throw new Error('[BAILEYS-PATCH] Condition attendue trouvée ' + occurrences + ' fois. Arrêt sans modification.');
  }
  fs.writeFileSync(target, source.replace(original, patched), 'utf8');
  console.log('[BAILEYS-PATCH] Premier retry Signal : bundle de clés inclus.');
}
