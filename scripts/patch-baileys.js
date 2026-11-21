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

const decodeTarget = path.join(path.dirname(entry), 'Utils', 'decode-wa-message.js');
if (!fs.existsSync(decodeTarget)) {
  throw new Error('[BAILEYS-PATCH] Module de déchiffrement introuvable : ' + decodeTarget);
}

let decodeSource = fs.readFileSync(decodeTarget, 'utf8');
const decodeMarker = 'stanza-provided PN/LID pairing';
if (decodeSource.includes(decodeMarker)) {
  console.log('[BAILEYS-PATCH] Repli LID/PN déjà présent.');
} else {
  const decodePattern = /(const user = isJidUser\(sender\) \? sender : author;)[\s\S]*?msgBuffer = await repository\.decryptMessage\(\{\s*jid: user,\s*type: e2eType,\s*ciphertext: content\s*\}\);;
  const decodeReplacement = `$1
                                try {
                                    msgBuffer = await repository.decryptMessage({
                                        jid: user,
                                        type: e2eType,
                                        ciphertext: content
                                    });
                                } catch (originalError) {
                                    // WhatsApp supplies the paired PN/LID identity on the stanza.
                                    // Retry with that exact alternate identity before dropping the message.
                                    const alternateUser = isLidUser(user)
                                        ? (stanza.attrs.participant_pn || stanza.attrs.sender_pn)
                                        : (stanza.attrs.participant_lid || stanza.attrs.sender_lid);
                                    if (!alternateUser || alternateUser === user) throw originalError;

                                    logger.debug(
                                        { key: fullMessage.key, primary: user, retryWith: alternateUser },
                                        'primary identity failed to decrypt, retrying with stanza-provided PN/LID pairing'
                                    );
                                    try {
                                        msgBuffer = await repository.decryptMessage({
                                            jid: alternateUser,
                                            type: e2eType,
                                            ciphertext: content
                                        });
                                    } catch {
                                        throw originalError;
                                    }
                                }`;
  const matchCount = decodePattern.test(decodeSource) ? 1 : 0;
  if (matchCount !== 1) {
    throw new Error('[BAILEYS-PATCH] Bloc de déchiffrement LID/PN introuvable ou ambigu (matches=' + matchCount + '). Aucun changement appliqué à ce module.');
  }
  decodeSource = decodeSource.replace(decodePattern, decodeReplacement);
  fs.writeFileSync(decodeTarget, decodeSource, 'utf8');
  console.log('[BAILEYS-PATCH] Repli de déchiffrement LID/PN activé pour les messages privés et de groupe.');
}
