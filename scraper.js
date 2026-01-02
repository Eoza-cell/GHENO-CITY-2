const axios = require('axios');
const cheerio = require('cheerio');
const { sequelize, Equipment } = require('./database'); // Import only necessary db components

const url = 'https://saointegralfactor.fandom.com/wiki/Equipment';

async function scrapeAndStoreData() {
  try {
    // 1. Connect to the database and ensure the Equipment table is fresh
    await sequelize.authenticate();
    console.log('Database connection established.');
    // Using { force: true } will drop the table if it already exists and create a new one.
    // This is ideal for a scraper to ensure fresh data without conflicts.
    await Equipment.sync({ force: true });
    console.log('Equipment table was successfully (re)created.');

    // 2. Scrape the data from the wiki
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    console.log('HTML data fetched from wiki.');

    const equipmentsToInsert = [];

    // --- WEAPONS ---
    console.log('Scraping weapons...');
    const processWeaponTable = (table, source) => {
      if (!table.length) return;
      const headers = [];
      table.find('tr').first().find('th, td').each((i, el) => headers.push($(el).text().trim()));
      table.find('tr').slice(1).each((i, row) => {
        const level = parseInt($(row).find('td').first().text().trim());
        if (isNaN(level)) return;
        $(row).find('td').slice(1).each((j, cell) => {
          const name = $(cell).text().trim();
          if (name) {
            equipmentsToInsert.push({ name, level, category: 'Weapon', type: headers[j + 1], source });
          }
        });
      });
    };
    $('h3 > span#Weapons_obtained_through_story_progression').parent().nextAll('table').first().each((i, table) => processWeaponTable($(table), 'Story Progression'));
    $('h4 > span#Weapons_from_floors_1-61').parent().nextAll('table').first().each((i, table) => processWeaponTable($(table), 'Craftable (Floors 1-61)'));
    const endgameTable = $('h4 > span#Endgame_equipment').parent().nextAll('table').first();
    if (endgameTable.length) {
        const headers = [];
        endgameTable.find('tr').first().find('th, td').each((i, el) => headers.push($(el).text().trim()));
        endgameTable.find('tr').slice(1).each((i, row) => {
            const series = $(row).find('td').first().text().trim();
            const level = parseInt($(row).find('td').eq(1).text().trim());
            if(isNaN(level)) return;
            $(row).find('td').slice(2).each((j, cell) => {
                const name = $(cell).text().trim();
                if (name && name.toLowerCase() !== 'none') {
                    equipmentsToInsert.push({ name, level, category: 'Weapon', type: headers[j + 2], source: `Endgame (${series})` });
                }
            });
        });
    }
    $('h4 > span#Equipment_crafted_with_materials_obtained_by_fishing').parent().nextAll('table').first().each((i, table) => processWeaponTable($(table), 'Fishing'));

    // --- ARMORS ---
    console.log('Scraping armors...');
    const processArmorTable = (table, source) => {
        if(!table.length) return;
        table.find('tr').slice(1).each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length < 3) return;
            const level = parseInt($(cells[0]).text().trim());
            if(isNaN(level)) return;
            const upperArmor = $(cells[1]).text().trim();
            const lowerArmor = $(cells[2]).text().trim();
            if (upperArmor) equipmentsToInsert.push({ name: upperArmor, level, category: 'Armor', type: 'Upper Body', source });
            if (lowerArmor) equipmentsToInsert.push({ name: lowerArmor, level, category: 'Armor', type: 'Lower Body', source });
        });
    };
    $('h4 > span#Equipment_crafted_with_materials_found_on_the_Floors').parent().nextAll('table').first().each((i, table) => processArmorTable($(table), 'Craftable (Floors)'));
    const chaosTable = $('h4 > span#Equipment_crafted_with_materials_obtained_from_Chaos_Showdown_Bosses').parent().nextAll('table').first();
    if (chaosTable.length) {
        chaosTable.find('tr').slice(1).each((i, row) => {
            const cells = $(row).find('td');
            if(cells.length < 4) return;
            const series = $(cells[0]).text().trim();
            const level = parseInt($(cells[1]).text().trim());
            if(isNaN(level)) return;
            const upperArmor = $(cells[2]).text().trim();
            const lowerArmor = $(cells[3]).text().trim();
            if (upperArmor) equipmentsToInsert.push({ name: upperArmor, level, category: 'Armor', type: 'Upper Body', source: `Chaos Showdown (${series})` });
            if (lowerArmor) equipmentsToInsert.push({ name: lowerArmor, level, category: 'Armor', type: 'Lower Body', source: `Chaos Showdown (${series})` });
        });
    }
    $('h4 > span:contains("Equipment crafted with materials obtained by fishing")').last().parent().nextAll('table').first().each((i, table) => processArmorTable($(table), 'Fishing'));


    // 3. Store data in the database
    console.log('Storing data in the database...');
    await Equipment.bulkCreate(equipmentsToInsert);
    console.log(`Successfully inserted ${equipmentsToInsert.length} equipment items.`);

  } catch (error) {
    console.error('An error occurred during the scraping and storing process:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
}

scrapeAndStoreData();
