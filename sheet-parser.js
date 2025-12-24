function parseSheet(text, senderName) {
    const data = {};
    const lines = text.split('\n');

    const fields = {
        nom: /Nom\s*:\s*(.+)/i,
        prenom: /Prénom\s*:\s*(.+)/i,
        surnom: /Surnom\s*:\s*(.+)/i,
        titreNoblesse: /Titre de Noblesse\s*:\s*(.+)/i,
        villeActuelle: /Ville\/Région actuel\s*:\s*(.+)/i,
        villeOrigine: /Ville\/Région d'Origine\s*:\s*(.+)/i,
        age: /Âge\s*:\s*(\d+)\s*ans/i,
        taille: /Taille\s*:\s*(.+)/i,
        rang: /Rang\s*:\s*(.+)/i,
        serment: /Serment\s*:\s*(.+)/i,
        allegeance: /Allégeance\s*:\s*(.+)/i,
        regionFief: /Région\/Fief\s*:\s*(.+)/i,
        maitreDArmes: /Maître d'Armes\s*:\s*(\d+)/i,
        puissanceDeTension: /Puissance de Tension\s*:\s*(\d+)/i,
        puissanceDeJet: /Puissance de Jet\s*:\s*(\d+)/i,
        bouclier: /Bouclier\s*:\s*(\d+)/i,
        athletisme: /Athlétisme\s*:\s*(\d+)/i,
        equitation: /Équitation\s*:\s*(\d+)/i,
        archerieMontee: /Archerie Montée\s*:\s*(\d+)/i,
        pistage: /Pistage\s*:\s*(\d+)/i,
        reperage: /Repérage\s*:\s*(\d+)/i,
        ingenierie: /Ingénierie\s*:\s*(\d+)/i,
        commandement: /Commandement\s*:\s*(\d+)/i,
        soinsDesBlessures: /Soins des blessures\s*:\s*(\d+)/i,
    };

    lines.forEach(line => {
        for (const key in fields) {
            const match = line.match(fields[key]);
            if (match) {
                let value = match[1].trim();
                // Convert to number if the key corresponds to a numeric stat
                if (['age', 'maitreDArmes', 'puissanceDeTension', 'puissanceDeJet', 'bouclier', 'athletisme', 'equitation', 'archerieMontee', 'pistage', 'reperage', 'ingenierie', 'commandement', 'soinsDesBlessures'].includes(key)) {
                    value = parseInt(value, 10);
                }
                data[key] = value;
            }
        }
    });

    // Automatically fill in the 'roliste'
    data.roliste = senderName;

    // Basic validation to ensure key fields are present
    if (!data.nom || !data.prenom) {
        throw new Error("Le nom et le prénom sont obligatoires.");
    }

    return data;
}

module.exports = { parseSheet };
