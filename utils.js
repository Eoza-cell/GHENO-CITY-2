/**
 * Escapes characters for SVG/XML.
 * @param {string} unsafe
 * @returns {string}
 */
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

/**
 * Calculates a stable/deterministic distance in meters between two players
 * based on their locations and hashed IDs.
 */
function getDistanceInMeters(p1, p2) {
    if (!p1 || !p2) return 9999;
    const loc1 = p1.location || '';
    const loc2 = p2.location || '';
    const sub1 = p1.subLocation || '';
    const sub2 = p2.subLocation || '';
    const jid1 = p1.whatsappId || '';
    const jid2 = p2.whatsappId || '';

    if (loc1 !== loc2) {
        const hash = Math.abs((jid1 + jid2).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
        return 50000 + (hash % 10) * 20000;
    }
    if (sub1 !== sub2) {
        const hash = Math.abs((jid1 + jid2).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
        return 40 + (hash % 260);
    }
    const hash = Math.abs((jid1 + jid2).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    return 1 + (hash % 14); // 1 to 14 meters
}

module.exports = { escapeXml, getDistanceInMeters };
