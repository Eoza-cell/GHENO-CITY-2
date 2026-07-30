const { generateShopImage, generateDetailedItemCard } = require('./shop-generator');
const fs = require('fs');

async function test() {
    console.log("Compiling shop image grid with GBF image fallback...");
    const items = [
        {
            name: "Seven-Star Sword",
            price: 8000,
            type: "weapon",
            rarity: "legendary",
            description: "Une épée de lumière de Granblue Fantasy.",
            imageUrl: "https://static.wikia.nocookie.net/gbf/images/3/30/Seven-Star_Sword.png",
            statBonuses: { strength: 40, defense: 20 }
        }
    ];

    const grid = await generateShopImage("Forge de Brokk", items);
    fs.writeFileSync('test-wiki-shop.png', grid);
    console.log("Successfully compiled catalog grid to test-wiki-shop.png");

    const detailed = await generateDetailedItemCard(items[0]);
    fs.writeFileSync('test-wiki-detailed.png', detailed);
    console.log("Successfully compiled detailed wiki card to test-wiki-detailed.png");
}

test().catch(e => {
    console.error("Compilation error:", e);
    process.exit(1);
});
