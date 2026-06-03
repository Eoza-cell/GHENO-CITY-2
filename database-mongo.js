const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  whatsappId: { type: String, required: true, unique: true },
  name: { type: String, default: 'Rookie' },
  shoot: { type: Number, default: 40 },
  pass: { type: Number, default: 40 },
  dribble: { type: Number, default: 40 },
  defense: { type: Number, default: 40 },
  speed: { type: Number, default: 40 },
  power: { type: Number, default: 40 },
  stamina: { type: Number, default: 100 },
  iq: { type: Number, default: 40 },
  goalkeeping: { type: Number, default: 10 },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  position: { type: String },
  jerseyNumber: { type: Number, default: 99 },
  currentClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  nation: { type: String, default: 'France' },
  salary: { type: Number, default: 500 },
  money: { type: Number, default: 1000 },
  fame: { type: Number, default: 0 },
  country: { type: String, default: 'France' },
  city: { type: String, default: 'Paris' },
  location: { type: String, default: 'Hôtel' },
  appearanceImageUrl: { type: String },
  currentDay: { type: Number, default: 1 },
  lastChronoUpdate: { type: Date, default: Date.now },
  mode: { type: String, default: 'normal' },
  registrationStep: { type: String },
});

const clubSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  country: { type: String },
  league: { type: String },
  reputation: { type: Number, default: 50 },
  formation: { type: String, default: '4-3-3' }
});

const trophySchema = new mongoose.Schema({
  name: { type: String },
  type: { type: String },
  year: { type: Number },
  playerWhatsappId: { type: String }
});

const contractOfferSchema = new mongoose.Schema({
    playerWhatsappId: { type: String },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
    salary: { type: Number },
    jerseyNumber: { type: Number },
    status: { type: String, default: 'pending' }
});

const npcSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  role: { type: String },
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  stats: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const rpMessageSchema = new mongoose.Schema({
    senderJid: { type: String },
    senderName: { type: String },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
});

const credsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String },
});

const Player = mongoose.model('Player', playerSchema);
const Club = mongoose.model('Club', clubSchema);
const Trophy = mongoose.model('Trophy', trophySchema);
const ContractOffer = mongoose.model('ContractOffer', contractOfferSchema);
const NPC = mongoose.model('NPC', npcSchema);
const RPMessage = mongoose.model('RPMessage', rpMessageSchema);
const Creds = mongoose.model('Creds', credsSchema);

async function setupDatabase() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://Yun:fThRV6QFJ3FQRRIe@cluster0.0ysskom.mongodb.net/?appName=Cluster0';
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const clubCount = await Club.countDocuments();
        if (clubCount < 5) {
            const clubs = [
                { name: 'Paris Saint-Germain', country: 'France', league: 'Ligue 1', reputation: 85 },
                { name: 'FC Barcelone', country: 'Espagne', league: 'La Liga', reputation: 90 },
                { name: 'Real Madrid', country: 'Espagne', league: 'La Liga', reputation: 95 },
                { name: 'Manchester United', country: 'Angleterre', league: 'Premier League', reputation: 88 },
                { name: 'Manchester City', country: 'Angleterre', league: 'Premier League', reputation: 92 },
                { name: 'Bayern Munich', country: 'Allemagne', league: 'Bundesliga', reputation: 89 },
                { name: 'AC Milan', country: 'Italie', league: 'Serie A', reputation: 85 },
                { name: 'Club de Formation', country: 'France', league: 'National', reputation: 20 }
            ];
            for (const c of clubs) {
                await Club.findOneAndUpdate({ name: c.name }, c, { upsert: true });
            }
        }

        // Similar logic for NPCs can be added if needed, but Club is essential for foreign keys
    } catch (e) {
        console.error('MongoDB Connection Error:', e);
    }
}

module.exports = { Player, Club, Trophy, ContractOffer, NPC, RPMessage, Creds, setupDatabase, mongoose };
