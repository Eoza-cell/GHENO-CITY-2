const { setupDatabase, GroupMessage } = require('./database');
const { recordGroupMessage, computeGroupStats, generateIntelligenceReport, isBotMentioned, generateHumanReply } = require('./spy-handler');

async function testSpyBot() {
    console.log('--- STARTING SPY BOT INTEGRATION VERIFICATION ---');
    await setupDatabase();

    // Clean test group messages
    await GroupMessage.destroy({ where: { groupJid: 'test_group_999@g.us' } });

    // 1. Test recording group messages
    console.log('\n[1] Testing message recording...');
    await recordGroupMessage({
        groupJid: 'test_group_999@g.us',
        groupName: 'Groupe Secret 999',
        senderJid: '33612345678@s.whatsapp.net',
        senderName: 'Charlie',
        messageText: 'Salut, on se voit jeudi à 18h ?'
    });

    await recordGroupMessage({
        groupJid: 'test_group_999@g.us',
        groupName: 'Groupe Secret 999',
        senderJid: '33687654321@s.whatsapp.net',
        senderName: 'David',
        messageText: 'Oui parfait pour jeudi !'
    });

    // 2. Test stats calculation
    console.log('\n[2] Testing stats calculation...');
    const stats = await computeGroupStats({ groupJid: 'test_group_999@g.us' });
    console.log(`Total messages in test group: ${stats.totalMessages}`);
    if (stats.totalMessages !== 2) {
        throw new Error('Expected 2 messages in stats');
    }
    console.log('User Breakdown:', stats.userStats.map(u => `${u.number} (${u.name}): ${u.count} msgs`));

    // 3. Test report generation
    console.log('\n[3] Testing intelligence report generation...');
    const report = await generateIntelligenceReport({ groupJid: 'test_group_999@g.us', periodName: 'Verification Test' });
    console.log('Generated Report Output:\n');
    console.log(report);

    if (!report.includes('+33612345678') || !report.includes('Charlie') || !report.includes('+33687654321') || !report.includes('David')) {
        throw new Error('Report missing expected number + pseudo classification!');
    }

    // 4. Test bot mention detection
    console.log('\n[4] Testing bot mention detection...');
    const mockSock = { user: { id: '33700000000:10@s.whatsapp.net' } };
    const mentionedMsg = {
        key: { remoteJid: 'test_group_999@g.us' },
        message: {
            extendedTextMessage: {
                text: 'Hey @33700000000 tu en penses quoi ?',
                contextInfo: { mentionedJid: ['33700000000@s.whatsapp.net'] }
            }
        }
    };
    const isMentioned = isBotMentioned(mentionedMsg, mockSock);
    console.log('Is bot mentioned:', isMentioned);
    if (!isMentioned) {
        throw new Error('Bot mention was not detected!');
    }

    // 5. Test natural human reply generation
    console.log('\n[5] Testing human reply generation...');
    const reply = await generateHumanReply('Tu viens à la réunion de demain ?', 'Charlie', 'Groupe Secret 999');
    console.log('Generated Human Reply:', reply);

    if (reply.toLowerCase().includes('bot') || reply.toLowerCase().includes('ia') || reply.toLowerCase().includes('menu') || reply.toLowerCase().includes('rpg')) {
        throw new Error('Reply contains bot/RPG jargon!');
    }

    console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
    process.exit(0);
}

testSpyBot().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
