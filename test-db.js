const { setupDatabase, Card, Player, PlayerCard } = require('./database');

async function test() {
    await setupDatabase();
    console.log("Database setup complete.");

    const cardCount = await Card.count();
    console.log(`Seeded cards: ${cardCount}`);

    const player = await Player.create({ whatsappId: 'test@s.whatsapp.net', name: 'TestCoach' });
    console.log(`Player created: ${player.name}`);

    const { pullGacha } = require('./command-handler'); // This won't work directly since pullGacha is not exported.
    // I should have exported it or test it differently.

    const cards = await Card.findAll();
    console.log(`First card: ${cards[0].name} (${cards[0].rarity})`);

    process.exit(0);
}

test();
