const fs = require('fs');
const path = require('path');

const MEMORY_FILE_PATH = path.join(__dirname, 'assets', 'atr_infinite_memory.csv');

/**
 * Ensures that the Excel/CSV Infinite Memory file exists with headers.
 */
function initializeExcelMemory() {
    const dir = path.dirname(MEMORY_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(MEMORY_FILE_PATH)) {
        const headers = 'Timestamp,WhatsappID,PlayerName,Location,SubLocation,ActionType,Content,StatsSnapshot\n';
        fs.writeFileSync(MEMORY_FILE_PATH, headers, 'utf8');
        console.log('[EXCEL MEMORY] Initialized new infinite memory spreadsheet:', MEMORY_FILE_PATH);
    }
}

/**
 * Escapes CSV field value to prevent formatting corruption.
 */
function escapeCsv(val) {
    if (val == null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

/**
 * Appends a new event row to the Excel/CSV infinite memory spreadsheet.
 */
async function appendExcelMemory({ whatsappId, playerName, location, subLocation, actionType, content, statsSnapshot }) {
    initializeExcelMemory();

    const timestamp = new Date().toISOString();
    const row = [
        escapeCsv(timestamp),
        escapeCsv(whatsappId),
        escapeCsv(playerName),
        escapeCsv(location),
        escapeCsv(subLocation),
        escapeCsv(actionType),
        escapeCsv(content),
        escapeCsv(typeof statsSnapshot === 'object' ? JSON.stringify(statsSnapshot) : statsSnapshot)
    ].join(',') + '\n';

    try {
        fs.appendFileSync(MEMORY_FILE_PATH, row, 'utf8');
    } catch (err) {
        console.error('[EXCEL MEMORY] Error appending to infinite memory spreadsheet:', err.message);
    }
}

/**
 * Retrieves the infinite historical memory for a specific player from the Excel spreadsheet.
 */
function getInfiniteMemoryForPlayer(whatsappId, limit = 50) {
    initializeExcelMemory();

    if (!fs.existsSync(MEMORY_FILE_PATH)) return [];

    try {
        const lines = fs.readFileSync(MEMORY_FILE_PATH, 'utf8').split('\n').filter(Boolean);
        if (lines.length <= 1) return [];

        const records = [];
        // Skip header at index 0
        for (let i = lines.length - 1; i >= 1; i--) {
            const line = lines[i];
            if (line.includes(`"${whatsappId}"`)) {
                // Simple CSV parse
                const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (matches && matches.length >= 7) {
                    const clean = matches.map(m => m.replace(/^"|"$/g, '').replace(/""/g, '"'));
                    records.push({
                        timestamp: clean[0],
                        whatsappId: clean[1],
                        playerName: clean[2],
                        location: clean[3],
                        subLocation: clean[4],
                        actionType: clean[5],
                        content: clean[6],
                        statsSnapshot: clean[7] || ''
                    });
                }
                if (records.length >= limit) break;
            }
        }
        return records.reverse();
    } catch (err) {
        console.error('[EXCEL MEMORY] Error reading infinite memory:', err.message);
        return [];
    }
}

/**
 * Purges non-official narrative memory lines for a specific player or all players from the CSV.
 */
function purgeExcelMemory(whatsappId = null) {
    initializeExcelMemory();
    if (!fs.existsSync(MEMORY_FILE_PATH)) return;

    try {
        const lines = fs.readFileSync(MEMORY_FILE_PATH, 'utf8').split('\n');
        if (lines.length <= 1) return;

        const headers = lines[0];
        let keptLines = [headers];

        if (whatsappId) {
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] && !lines[i].includes(`"${whatsappId}"`)) {
                    keptLines.push(lines[i]);
                }
            }
        } else {
            keptLines = [headers];
        }

        fs.writeFileSync(MEMORY_FILE_PATH, keptLines.join('\n') + '\n', 'utf8');
        console.log(`[EXCEL MEMORY] Purged narrative memory for ${whatsappId || 'ALL'}.`);
    } catch (err) {
        console.error('[EXCEL MEMORY] Error purging narrative memory:', err.message);
    }
}

module.exports = {
    initializeExcelMemory,
    appendExcelMemory,
    getInfiniteMemoryForPlayer,
    purgeExcelMemory,
    MEMORY_FILE_PATH
};
