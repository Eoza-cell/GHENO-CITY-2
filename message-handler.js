const { delay } = require('@whiskeysockets/baileys');

async function sendAnimatedMessage(sock, jid, initialText) {
    const loadingBarFrames = [
        "▱▱▱▱▱▱▱▱▱▱",
        "▰▱▱▱▱▱▱▱▱▱",
        "▰▰▱▱▱▱▱▱▱▱",
        "▰▰▰▱▱▱▱▱▱▱",
        "▰▰▰▰▱▱▱▱▱▱",
        "▰▰▰▰▰▱▱▱▱▱",
        "▰▰▰▰▰▰▱▱▱▱",
        "▰▰▰▰▰▰▰▱▱▱",
        "▰▰▰▰▰▰▰▰▱▱",
        "▰▰▰▰▰▰▰▰▰▱",
        "▰▰▰▰▰▰▰▰▰▰",
    ];

    // Send the initial message
    const key = (await sock.sendMessage(jid, { text: initialText })).key;

    // Animate the loading bar
    for (const frame of loadingBarFrames) {
        await sock.sendMessage(jid, { text: `${initialText}\n${frame}`, edit: key });
        await delay(200); // Adjust delay for animation speed
    }

    return key;
}

module.exports = { sendAnimatedMessage };
