const { Player, GameScore } = require('./database');
const fs = require('fs');
const path = require('path');

const activeGames = new Map();

const WORDS = ["whatsapp", "javascript", "ordinateur", "clavier", "souris", "telephone", "internet", "programmation", "algorithme", "developpeur", "intelligence", "artificielle", "robotique", "aventure", "mystere", "vitesse", "course", "victoire"];
const ARTISTS = ["booba", "damso", "ninho", "gims", "dadju", "aya nakamura", "jul", "pnl", "nekfeu", "soprano", "orelsan", "hamza", "sch", "niska", "kalash", "tiakola", "gazo", "laylow"];

async function addPoints(whatsappId, gameType, points) {
    const player = await Player.findByPk(whatsappId);
    if (player) {
        await player.increment('points', { by: points });
    }

    const [score, created] = await GameScore.findOrCreate({
        where: { playerWhatsappId: whatsappId, gameType: gameType }
    });
    await score.increment('score', { by: points });
}

async function handleGameMessage(sock, message, player, text) {
    const chatJid = message.key.remoteJid;
    const game = activeGames.get(chatJid);
    if (!game) return false;

    if (game.type === 'word' || game.type === 'artist') {
        if (text.toLowerCase() === game.answer.toLowerCase()) {
            activeGames.delete(chatJid);
            await addPoints(player.whatsappId, game.type, 10);
            await sock.sendMessage(chatJid, {
                text: `🎉 BRAVO @${player.whatsappId.split('@')[0]} ! Tu as trouvé: *${game.answer}*\n💰 +10 points`,
                mentions: [player.whatsappId]
            });
            return true;
        }
    }

    if (game.type === 'course' && game.status === 'started') {
        if (text.toLowerCase() === 'boost') {
            const participant = game.participants.find(p => p.jid === player.whatsappId);
            if (!participant) return false;

            participant.position += Math.floor(Math.random() * 10) + 5;

            if (participant.position >= 100) {
                activeGames.delete(chatJid);
                await addPoints(player.whatsappId, 'course', 20);

                let rankText = `🏁 *FIN DE LA COURSE !*\n\n🥇 Gagnant: @${player.whatsappId.split('@')[0]}\n💰 +20 points\n\n`;
                const sorted = game.participants.sort((a, b) => b.position - a.position);
                sorted.forEach((p, i) => {
                    rankText += `${i + 1}. ${p.name}: ${p.position}m\n`;
                });

                await sock.sendMessage(chatJid, {
                    text: rankText,
                    mentions: [player.whatsappId]
                });
            } else {
                // Progress bar visualization
                const progress = Math.min(10, Math.floor(participant.position / 10));
                const bar = "🏎️" + ".".repeat(progress) + "🏁";
                await sock.sendMessage(chatJid, { text: `${player.name}: [${"=".repeat(progress)}${" ".repeat(10-progress)}] ${participant.position}m` });
            }
            return true;
        }
    }

    if (game.type === 'loup') {
        return await handleLoupMessage(sock, message, player, text, game, chatJid);
    }

    return false;
}

async function handleLoupMessage(sock, message, player, text, game, chatJid) {
    if (game.status === 'night' && game.phase === 'loup_vote') {
        const participant = game.participants.find(p => p.jid === player.whatsappId);
        if (participant && participant.role === 'Loup' && participant.alive) {
            const targetIndex = parseInt(text) - 1;
            const target = game.participants[targetIndex];
            if (target && target.alive) {
                game.nightVotes[player.whatsappId] = target.jid;
                await sock.sendMessage(player.whatsappId, { text: `Tu as voté pour dévorer ${target.name}.` });

                // Check if all wolves voted
                const wolves = game.participants.filter(p => p.role === 'Loup' && p.alive);
                if (Object.keys(game.nightVotes).length === wolves.length) {
                    await nextLoupPhase(sock, chatJid, game);
                }
                return true;
            }
        }
    }

    if (game.status === 'day' && game.phase === 'village_vote') {
        const participant = game.participants.find(p => p.jid === player.whatsappId);
        if (participant && participant.alive) {
            const targetIndex = parseInt(text) - 1;
            const target = game.participants[targetIndex];
            if (target && target.alive) {
                game.dayVotes[player.whatsappId] = target.jid;
                await sock.sendMessage(chatJid, { text: `${player.name} a voté.` });

                const alivePlayers = game.participants.filter(p => p.alive);
                if (Object.keys(game.dayVotes).length === alivePlayers.length) {
                    await nextLoupPhase(sock, chatJid, game);
                }
                return true;
            }
        }
    }
    return false;
}

async function nextLoupPhase(sock, chatJid, game) {
    if (game.status === 'night') {
        // Resolve Night
        const votes = Object.values(game.nightVotes);
        const mostVoted = votes.sort((a,b) => votes.filter(v => v===a).length - votes.filter(v => v===b).length).pop();
        const victim = game.participants.find(p => p.jid === mostVoted);

        game.status = 'day';
        game.phase = 'announcement';

        let msg = "🌅 *LE JOUR SE LÈVE...*\n\n";
        if (victim) {
            victim.alive = false;
            msg += `Le village se réveille dans l'effroi : *${victim.name}* a été dévoré pendant la nuit. C'était un *${victim.role}*.\n`;
        } else {
            msg += "Contre toute attente, personne n'est mort cette nuit.\n";
        }

        await sock.sendMessage(chatJid, { text: msg });

        if (checkLoupWin(sock, chatJid, game)) return;

        game.phase = 'village_vote';
        game.dayVotes = {};

        let voteMsg = "⚖️ *VOTE DU VILLAGE*\n\nQui voulez-vous éliminer ? Répondez avec le numéro :\n";
        game.participants.forEach((p, i) => {
            if (p.alive) voteMsg += `${i + 1}. ${p.name}\n`;
        });
        await sock.sendMessage(chatJid, { text: voteMsg });

    } else if (game.status === 'day') {
        // Resolve Day
        const votes = Object.values(game.dayVotes);
        const mostVoted = votes.sort((a,b) => votes.filter(v => v===a).length - votes.filter(v => v===b).length).pop();
        const victim = game.participants.find(p => p.jid === mostVoted);

        let msg = "";
        if (victim) {
            victim.alive = false;
            msg += `⚖️ Le village a décidé d'éliminer *${victim.name}*. C'était un *${victim.role}*.\n`;
        } else {
            msg += "⚖️ Le village n'a pas pu se mettre d'accord.\n";
        }

        await sock.sendMessage(chatJid, { text: msg });

        if (checkLoupWin(sock, chatJid, game)) return;

        startLoupNight(sock, chatJid, game);
    }
}

function checkLoupWin(sock, chatJid, game) {
    const loups = game.participants.filter(p => p.role === 'Loup' && p.alive);
    const villagers = game.participants.filter(p => p.role !== 'Loup' && p.alive);

    if (loups.length === 0) {
        sock.sendMessage(chatJid, { text: "🎉 *VICTOIRE DU VILLAGE !* Tous les loups ont été éliminés." });
        activeGames.delete(chatJid);
        return true;
    }
    if (loups.length >= villagers.length) {
        sock.sendMessage(chatJid, { text: "🐺 *VICTOIRE DES LOUPS !* Ils sont désormais plus nombreux que les villageois." });
        activeGames.delete(chatJid);
        return true;
    }
    return false;
}

async function startLoupNight(sock, chatJid, game) {
    game.status = 'night';
    game.phase = 'loup_vote';
    game.nightVotes = {};

    await sock.sendMessage(chatJid, { text: "🌙 *LA NUIT TOMBE...*\nLe village s'endort. Les loups se préparent." });

    let voteMsg = "🐺 *VOTE DES LOUPS*\n\nQui voulez-vous dévorer ? Répondez avec le numéro :\n";
    game.participants.forEach((p, i) => {
        if (p.alive && p.role !== 'Loup') voteMsg += `${i + 1}. ${p.name}\n`;
    });

    const wolves = game.participants.filter(p => p.role === 'Loup' && p.alive);
    for (const wolf of wolves) {
        await sock.sendMessage(wolf.jid, { text: voteMsg });
    }
}

const gameLogic = {
    word: async (sock, chatJid) => {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        const scrambled = word.split('').sort(() => 0.5 - Math.random()).join('');
        activeGames.set(chatJid, { type: 'word', answer: word });
        await sock.sendMessage(chatJid, { text: `📝 *DEVINE LE MOT*\n\nLe mot est: *${scrambled}*\n\nTape le mot correct !` });
    },
    artist: async (sock, chatJid) => {
        const artist = ARTISTS[Math.floor(Math.random() * ARTISTS.length)];
        const scrambled = artist.split('').map(c => c === ' ' ? ' ' : '_').join(' ');
        activeGames.set(chatJid, { type: 'artist', answer: artist });
        await sock.sendMessage(chatJid, { text: `🎨 *DEVINE L'ARTISTE*\n\nNom: *${scrambled}*\n(Indices: ${artist.length} lettres)\n\nTape le nom de l'artiste !` });
    },
    course: async (sock, chatJid) => {
        const racingImg = path.join('assets', 'racing.jpg');
        const text = `🏎️ *COURSE NITRO ASPHALT*\n\nLa course va commencer ! Tapez */join* pour participer.\n\n30 secondes pour rejoindre !`;

        activeGames.set(chatJid, {
            type: 'course',
            participants: [],
            status: 'joining'
        });

        const msg = { text };
        if (fs.existsSync(racingImg)) {
            msg.image = fs.readFileSync(racingImg);
            msg.caption = text;
            delete msg.text;
        }

        await sock.sendMessage(chatJid, msg);

        setTimeout(async () => {
            const game = activeGames.get(chatJid);
            if (game && game.type === 'course' && game.status === 'joining') {
                if (game.participants.length < 1) {
                    activeGames.delete(chatJid);
                    await sock.sendMessage(chatJid, { text: "❌ Pas assez de participants pour la course." });
                } else {
                    game.status = 'started';
                    await sock.sendMessage(chatJid, { text: "🚦 *PARTEZ !* Tapez *boost* !" });
                }
            }
        }, 30000);
    },
    loup: async (sock, chatJid) => {
        activeGames.set(chatJid, {
            type: 'loup',
            participants: [],
            status: 'joining'
        });
        await sock.sendMessage(chatJid, { text: "🐺 *LOUPS-GAROUS*\n\nTapez */join* pour rejoindre la partie. (Min 4 joueurs)\nDémarrage dans 60 secondes." });

        setTimeout(async () => {
            const game = activeGames.get(chatJid);
            if (game && game.type === 'loup' && game.status === 'joining') {
                if (game.participants.length < 4) {
                    activeGames.delete(chatJid);
                    await sock.sendMessage(chatJid, { text: "❌ Pas assez de participants pour le Loup-Garou (min 4)." });
                } else {
                    // Assign roles
                    const participants = game.participants;
                    participants.forEach(p => p.alive = true);

                    const wolfIndex = Math.floor(Math.random() * participants.length);
                    participants[wolfIndex].role = 'Loup';

                    participants.forEach(p => {
                        if (!p.role) p.role = 'Villageois';
                    });

                    await sock.sendMessage(chatJid, { text: "🎭 *RÔLES DISTRIBUÉS !* Vérifiez vos messages privés." });

                    for (const p of participants) {
                        await sock.sendMessage(p.jid, { text: `Ton rôle est: *${p.role}*` });
                    }

                    await startLoupNight(sock, chatJid, game);
                }
            }
        }, 60000);
    }
};

module.exports = { gameLogic, handleGameMessage, activeGames, addPoints };
