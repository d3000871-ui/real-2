const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const PORT = process.env.PORT || 3000;

// Vercel serverless environment check
const isVercel = Boolean(process.env.VERCEL);
const DATA = isVercel ? path.join(os.tmpdir(), 'diyorbek_rpg') : path.join(__dirname, 'data');

try {
  if (!fs.existsSync(DATA)) {
    fs.mkdirSync(DATA, { recursive: true });
  }
} catch (e) {
  console.warn('Filesystem mkdir warning (using in-memory store):', e.message);
}

const DB_FILE = path.join(DATA, 'players.json');
let players = {};
try {
  if (fs.existsSync(DB_FILE)) {
    players = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('DB read warning, using in-memory store:', e.message);
  players = {};
}

const sessions = new Map();
const online = new Map();
const rooms = new Map();

const save = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));
  } catch (e) {
    // In serverless read-only mode, players still persists in-memory per instance
  }
};

const hash = (s, salt) => crypto.scryptSync(s, salt, 64).toString('hex');

// 100 Hero Cards catalog definition
const HERO_RARITIES = ['common', 'rare', 'epic', 'legendary'];
const BASE_HEROES = [
  ['Sherlok Xolms', '🕵️', 'rare', 1.2],
  ['Robin Gud', '🏹', 'rare', 1.25],
  ['Qirol Artur', '👑', 'epic', 1.35],
  ['Drakula', '🧛', 'epic', 1.4],
  ['Elis', '🐇', 'common', 1.1],
  ['Merlin', '🧙', 'legendary', 1.6],
  ['Zorro', '🗡️', 'rare', 1.2],
  ['Viking Jangchi', '🪓', 'common', 1.15],
  ['Samuray', '🥷', 'rare', 1.3],
  ['Ajdarho Sohibi', '🐉', 'legendary', 1.7],
  ['Farishta', '🪽', 'epic', 1.45],
  ['Qorong‘u Ritsar', '🦇', 'legendary', 1.65],
  ['Sehrgar', '🔮', 'epic', 1.35],
  ['Muz Malikasi', '❄️', 'epic', 1.4],
  ['Olov Jangchisi', '🔥', 'rare', 1.25],
  ['Soya Qotili', '🌑', 'epic', 1.45],
  ['Cho‘l Sayyohi', '🏜️', 'common', 1.1],
  ['Dengiz Qaroqchisi', '🏴‍☠️', 'rare', 1.25],
  ['O‘rmon Qo‘riqchisi', '🌿', 'common', 1.15],
  ['Yulduz Jangchisi', '🌟', 'legendary', 1.75]
];
const PREFIXES = ['Afsonaviy', 'Qadimiy', 'Jasur', 'Sirli', 'Olovli'];
const SUFFIXES = ['Himoyachi', 'Sohib', 'Jangchi', 'Sehrgar', 'Qo‘riqchi'];
const ALL_HEROES = Array.from({ length: 100 }, (_, i) => {
  if (i < BASE_HEROES.length) return BASE_HEROES[i];
  const rarity = HERO_RARITIES[i % 4];
  const mult = rarity === 'legendary' ? 1.6 : rarity === 'epic' ? 1.35 : rarity === 'rare' ? 1.2 : 1.1;
  const emoji = ['🛡️', '⚔️', '🧝', '🐺', '🦁', '🧿', '🌋', '🌙', '🦅', '🪄'][i % 10];
  const name = `${PREFIXES[i % 5]} ${SUFFIXES[Math.floor(i / 5) % 5]} ${i + 1}`;
  return [name, emoji, rarity, mult];
});

// MAPS CONFIGURATION
const MAPS = {
  bosh_qala: {
    id: 'bosh_qala',
    name: "Bosh Qal'a (Oromgoh)",
    theme: 'town',
    levelReq: 1,
    desc: "Qahramonlar boshpanasi, xavfsiz shahar va savdo markazi.",
    isSafeZone: true,
    width: 900,
    height: 560,
    portals: [
      { id: 'p_to_forest', target: 'qorongi_ormon', x: 840, y: 280, label: "Qorong'i O'rmon (Lv 1+)", spawnX: 80, spawnY: 280 },
      { id: 'p_to_cata', target: 'katakomba', x: 450, y: 70, label: "Qadimiy Katakomba (Lv 5+)", spawnX: 450, spawnY: 480 }
    ],
    shrines: [
      { id: 'sh_heal_1', x: 450, y: 280, type: 'heal', name: "Muqaddas Hayot Chashmasi" }
    ],
    chests: [],
    mobs: [
      { id: 'm_dummy_1', name: "Mashq Manekeni", level: 1, maxHp: 200, hp: 200, attack: 0, defense: 2, x: 220, y: 200, type: 'dummy', respawn: 4000, xp: 8, coins: 5 }
    ]
  },
  qorongi_ormon: {
    id: 'qorongi_ormon',
    name: "Qorong'i O'rmon",
    theme: 'forest',
    levelReq: 1,
    desc: "Yovvoyi hayvonlar, o'rmon goblinlari va qadimgi xarobalar.",
    isSafeZone: false,
    width: 900,
    height: 560,
    portals: [
      { id: 'p_to_town', target: 'bosh_qala', x: 60, y: 280, label: "Bosh Qal'aga qaytish", spawnX: 790, spawnY: 280 },
      { id: 'p_to_cata2', target: 'katakomba', x: 840, y: 140, label: "Katakomba (Lv 5+)", spawnX: 80, spawnY: 280 },
      { id: 'p_to_desert', target: 'qonli_sahro', x: 840, y: 440, label: "Qonli Sahro (Lv 10+)", spawnX: 80, spawnY: 280 }
    ],
    shrines: [
      { id: 'sh_forest_heal', x: 450, y: 100, type: 'heal', name: "O'rmon Shifo Chashmasi" }
    ],
    chests: [
      { id: 'ch_forest_1', x: 450, y: 470, opened: false, respawnAt: 0 }
    ],
    mobs: [
      { id: 'm_wolf_1', name: "Qora Bo'ri", level: 2, maxHp: 110, hp: 110, attack: 12, defense: 3, x: 270, y: 200, type: 'wolf', respawn: 6000, xp: 22, coins: 15 },
      { id: 'm_wolf_2', name: "Qora Bo'ri", level: 2, maxHp: 110, hp: 110, attack: 12, defense: 3, x: 350, y: 380, type: 'wolf', respawn: 6000, xp: 22, coins: 15 },
      { id: 'm_goblin_1', name: "O'rmon Goblini", level: 3, maxHp: 160, hp: 160, attack: 17, defense: 5, x: 620, y: 210, type: 'goblin', respawn: 7000, xp: 35, coins: 25 },
      { id: 'm_goblin_2', name: "Goblin Kamonchisi", level: 4, maxHp: 180, hp: 180, attack: 22, defense: 6, x: 710, y: 360, type: 'goblin_archer', respawn: 8000, xp: 45, coins: 32 },
      { id: 'm_bear_1', name: "Yirtqich Ayiq", level: 5, maxHp: 300, hp: 300, attack: 29, defense: 9, x: 490, y: 290, type: 'bear', respawn: 10000, xp: 75, coins: 60 }
    ]
  },
  katakomba: {
    id: 'katakomba',
    name: "Qadimiy Katakomba",
    theme: 'catacombs',
    levelReq: 5,
    desc: "Qorong'u qabr labirinti. Skelet jangchilar va sharpalar makoni.",
    isSafeZone: false,
    width: 900,
    height: 560,
    portals: [
      { id: 'p_to_town_c', target: 'bosh_qala', x: 450, y: 510, label: "Bosh Qal'aga chiqish", spawnX: 450, spawnY: 130 },
      { id: 'p_to_inferno', target: 'dozax_qasri', x: 840, y: 280, label: "Do'zax Qasri (Lv 15+)", spawnX: 80, spawnY: 280 }
    ],
    shrines: [
      { id: 'sh_cata_heal', x: 120, y: 120, type: 'heal', name: "Hayot Runi Chashmasi" }
    ],
    chests: [
      { id: 'ch_cata_1', x: 750, y: 120, opened: false, respawnAt: 0 }
    ],
    mobs: [
      { id: 'm_skel_1', name: "Skelet Jangchi", level: 6, maxHp: 360, hp: 360, attack: 35, defense: 12, x: 270, y: 210, type: 'skeleton', respawn: 8000, xp: 95, coins: 75 },
      { id: 'm_skel_2', name: "Skelet Nayzaboz", level: 7, maxHp: 420, hp: 420, attack: 42, defense: 14, x: 370, y: 390, type: 'skeleton_sword', respawn: 8000, xp: 120, coins: 95 },
      { id: 'm_wraith_1', name: "Qorong'u Arvoh", level: 8, maxHp: 500, hp: 500, attack: 50, defense: 18, x: 620, y: 190, type: 'wraith', respawn: 10000, xp: 160, coins: 130 },
      { id: 'm_zombie_1', name: "Zombi Ritsar", level: 10, maxHp: 700, hp: 700, attack: 62, defense: 24, x: 680, y: 370, type: 'zombie', respawn: 12000, xp: 230, coins: 190 }
    ]
  },
  qonli_sahro: {
    id: 'qonli_sahro',
    name: "Qonli Sahro",
    theme: 'desert',
    levelReq: 10,
    desc: "Qizil qum barxanlari va olovli jinlar, zaharli chayonlar.",
    isSafeZone: false,
    width: 900,
    height: 560,
    portals: [
      { id: 'p_to_forest_d', target: 'qorongi_ormon', x: 60, y: 280, label: "Qorong'i O'rmonga qaytish", spawnX: 780, spawnY: 440 },
      { id: 'p_to_inferno_d', target: 'dozax_qasri', x: 840, y: 280, label: "Do'zax Qasri (Lv 15+)", spawnX: 80, spawnY: 280 }
    ],
    shrines: [
      { id: 'sh_desert_oasis', x: 450, y: 480, type: 'heal', name: "Sahro Vohasi Chashmasi" }
    ],
    chests: [
      { id: 'ch_desert_1', x: 230, y: 110, opened: false, respawnAt: 0 }
    ],
    mobs: [
      { id: 'm_scorp_1', name: "Zaharli Qum Chayoni", level: 12, maxHp: 850, hp: 850, attack: 72, defense: 28, x: 290, y: 250, type: 'scorpion', respawn: 9000, xp: 310, coins: 260 },
      { id: 'm_ripper_1', name: "Cho'l Yirtqichi", level: 14, maxHp: 1100, hp: 1100, attack: 88, defense: 35, x: 570, y: 190, type: 'ripper', respawn: 11000, xp: 420, coins: 350 },
      { id: 'm_ifrit_1', name: "Olov Jini (Ifrit)", level: 16, maxHp: 1400, hp: 1400, attack: 106, defense: 42, x: 680, y: 370, type: 'ifrit', respawn: 13000, xp: 580, coins: 480 }
    ]
  },
  dozax_qasri: {
    id: 'dozax_qasri',
    name: "Do'zax Qasri (Boss Makoni)",
    theme: 'inferno',
    levelReq: 15,
    desc: "Qaynoq lava va qorong'u kuchlar makoni. Bosh Boss Lord Azazel shu yerda!",
    isSafeZone: false,
    width: 900,
    height: 560,
    portals: [
      { id: 'p_to_town_inf', target: 'bosh_qala', x: 60, y: 280, label: "Bosh Qal'a (Xavfsiz)", spawnX: 450, spawnY: 360 }
    ],
    shrines: [
      { id: 'sh_inferno_well', x: 450, y: 70, type: 'heal', name: "Sehrli Ruh Chashmasi" }
    ],
    chests: [
      { id: 'ch_inferno_1', x: 800, y: 80, opened: false, respawnAt: 0 },
      { id: 'ch_inferno_2', x: 800, y: 480, opened: false, respawnAt: 0 }
    ],
    mobs: [
      { id: 'm_guard_1', name: "Do'zax Qorovuli", level: 18, maxHp: 1800, hp: 1800, attack: 122, defense: 50, x: 270, y: 190, type: 'hellguard', respawn: 12000, xp: 750, coins: 620 },
      { id: 'm_demon_1', name: "Iblis Qotili", level: 20, maxHp: 2300, hp: 2300, attack: 145, defense: 58, x: 270, y: 380, type: 'demon', respawn: 14000, xp: 950, coins: 800 },
      { id: 'm_boss_azazel', name: "LORD AZAZEL (BOSS)", level: 25, isBoss: true, maxHp: 8000, hp: 8000, attack: 180, defense: 75, x: 640, y: 280, type: 'boss', respawn: 25000, xp: 4000, coins: 3500 }
    ]
  }
};

// In-memory dynamic state for each map
const mapStates = {};
for (const [mapId, mapDef] of Object.entries(MAPS)) {
  mapStates[mapId] = {
    mobs: mapDef.mobs.map(m => ({ ...m })),
    chests: mapDef.chests.map(c => ({ ...c }))
  };
}

function computeStats(p) {
  const level = p.level || 1;
  const armor = p.gear?.armor || 0;
  const weapon = p.gear?.weapon || 0;
  const amulet = p.gear?.amulet || 0;

  const maxHp = 100 + level * 30 + armor * 45;
  const maxMana = 60 + level * 15 + amulet * 30;

  let compBonus = 1.0;
  if (p.activeCompanion !== null && p.activeCompanion !== undefined) {
    const compHero = ALL_HEROES[p.activeCompanion];
    if (compHero) compBonus = compHero[3] || 1.1;
  }

  const attackPower = Math.round((18 + level * 5 + weapon * 14) * compBonus);
  const defensePower = Math.round(5 + level * 3 + armor * 10);
  const critRate = Math.min(60, 8 + amulet * 5);

  return { maxHp, maxMana, attackPower, defensePower, critRate, compBonus };
}

function normalizePlayer(p) {
  if (!p.gear) p.gear = { weapon: 0, armor: 0, amulet: 0 };
  if (p.gear.amulet === undefined) p.gear.amulet = 0;
  if (!p.cards) p.cards = [];
  if (!p.claimedPromos) p.claimedPromos = [];
  if (!p.room || !MAPS[p.room]) p.room = 'bosh_qala';
  if (p.activeCompanion === undefined) p.activeCompanion = null;
  if (p.x === undefined) p.x = 450;
  if (p.y === undefined) p.y = 280;
  if (!p.stats) p.stats = { kills: 0, bossKills: 0, chestsOpened: 0 };

  if (!p.quests) {
    p.quests = {
      explore_forest: { done: false, target: 1, current: 0, label: "Qorong'i O'rmon xaritasiga o'tish", rewardCoins: 150, rewardXp: 100 },
      kill_mobs: { done: false, target: 5, current: 0, label: "5 ta maxluqni yo'q qilish", rewardCoins: 250, rewardXp: 200 },
      open_chest: { done: false, target: 1, current: 0, label: "Xaritadagi xazina sandig'ini ochish", rewardCoins: 200, rewardXp: 150 },
      upgrade_weapon: { done: false, target: 1, current: p.gear.weapon, label: "Qurolni 1-darajaga kuchaytirish", rewardCoins: 300, rewardXp: 250 },
      defeat_boss: { done: false, target: 1, current: 0, label: "Do'zax Qasridagi Lord Azazelni yengish", rewardCoins: 1500, rewardXp: 1200 }
    };
  }

  const { maxHp, maxMana } = computeStats(p);
  if (p.hp === undefined || p.hp <= 0) p.hp = maxHp;
  if (p.mana === undefined) p.mana = maxMana;
  p.hp = Math.min(p.hp, maxHp);
  p.mana = Math.min(p.mana, maxMana);
}

const safe = p => {
  normalizePlayer(p);
  const { maxHp, maxMana, attackPower, defensePower, critRate, compBonus } = computeStats(p);
  return {
    name: p.name,
    level: p.level,
    xp: p.xp,
    xpNext: p.level * 100,
    coins: p.coins,
    hp: p.hp,
    maxHp,
    mana: p.mana,
    maxMana,
    gear: p.gear,
    activeCompanion: p.activeCompanion,
    cards: p.cards,
    room: p.room,
    x: p.x,
    y: p.y,
    stats: p.stats,
    quests: p.quests,
    attackPower,
    defensePower,
    critRate,
    compBonus
  };
};

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// API Routes
app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    platform: isVercel ? 'Vercel Serverless' : 'Node.js Server',
    online: online.size,
    rooms: rooms.size,
    maps: Object.keys(MAPS).length
  });
});

app.get('/api/maps', (_, res) => {
  res.json({ maps: MAPS });
});

app.get('/api/world/:room', (req, res) => {
  const room = req.params.room || 'bosh_qala';
  const mapDef = MAPS[room] || MAPS.bosh_qala;
  const state = mapStates[room] || { mobs: [], chests: [] };
  res.json({
    room,
    mapDef,
    mobs: state.mobs,
    chests: state.chests
  });
});

app.post('/api/register', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 18);
  const password = String(req.body.password || '');
  if (!/^[\p{L}\p{N}_-]{3,18}$/u.test(name) || password.length < 4) {
    return res.status(400).json({ error: "Login 3-18 belgi (harf, raqam, _, -), parol kamida 4 belgi bo'lsin." });
  }
  const key = name.toLowerCase();
  if (players[key]) return res.status(409).json({ error: "Bu login allaqachon band." });

  const salt = crypto.randomBytes(16).toString('hex');
  const newPlayer = {
    name,
    passwordSalt: salt,
    passwordHash: hash(password, salt),
    level: 1,
    xp: 0,
    coins: 500,
    hp: 130,
    mana: 75,
    cards: [],
    gear: { weapon: 0, armor: 0, amulet: 0 },
    activeCompanion: null,
    claimedPromos: [],
    room: 'bosh_qala',
    x: 450,
    y: 280,
    stats: { kills: 0, bossKills: 0, chestsOpened: 0 }
  };
  normalizePlayer(newPlayer);
  players[key] = newPlayer;
  save();

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, key);
  res.json({ token, player: safe(newPlayer) });
});

app.post('/api/login', (req, res) => {
  const key = String(req.body.name || '').trim().toLowerCase();
  const p = players[key];
  const password = String(req.body.password || '');
  if (!p || hash(password, p.passwordSalt) !== p.passwordHash) {
    return res.status(401).json({ error: "Login yoki parol noto'g'ri." });
  }
  normalizePlayer(p);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, key);
  res.json({ token, player: safe(p) });
});

function auth(req, res, next) {
  const key = sessions.get(req.headers.authorization || '');
  if (!key || !players[key]) return res.status(401).json({ error: "Sessiya tugagan, qayta kiring." });
  normalizePlayer(players[key]);
  req.playerKey = key;
  req.player = players[key];
  next();
}

app.get('/api/me', auth, (req, res) => {
  res.json({ player: safe(req.player) });
});

// Promocode endpoint
app.post('/api/promo', auth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (code !== 'DIYORBEK') return res.status(400).json({ error: "Bunday promokod mavjud emas." });
  if (req.player.claimedPromos.includes(code)) return res.status(409).json({ error: "Bu promokoddan avval foydalangansiz." });

  req.player.claimedPromos.push(code);
  req.player.coins += 1000;
  for (let i = 0; i < 100; i++) {
    req.player.cards.push({ id: crypto.randomUUID(), card: Math.floor(Math.random() * 100), at: Date.now() });
  }
  save();
  res.json({
    message: "Tabriklaymiz! 100 ta qahramon kartasi va +1000 tanga berildi!",
    player: safe(req.player)
  });
});

// Shop / Equipment Upgrade
app.post('/api/buy', auth, (req, res) => {
  const type = String(req.body.type || '');
  const p = req.player;

  if (type === 'chest') {
    if (p.coins < 100) return res.status(400).json({ error: "Sandiq ochish uchun 100 tanga kerak." });
    p.coins -= 100;
    const count = 3 + Math.floor(Math.random() * 3);
    const newCards = [];
    for (let i = 0; i < count; i++) {
      const cardIdx = Math.floor(Math.random() * 100);
      const cardObj = { id: crypto.randomUUID(), card: cardIdx, at: Date.now() };
      p.cards.push(cardObj);
      newCards.push(cardObj);
    }
    save();
    return res.json({
      message: `Sandiqdan ${count} ta yangi qahramon kartasi chiqdi!`,
      cards: newCards,
      player: safe(p)
    });
  }

  if (type === 'weapon' || type === 'armor' || type === 'amulet') {
    const current = p.gear[type] || 0;
    const price = 250 + current * 250;
    if (p.coins < price) return res.status(400).json({ error: `Kuchaytirish uchun ${price} tanga kerak.` });
    p.coins -= price;
    p.gear[type] = current + 1;

    if (type === 'weapon' && p.quests.upgrade_weapon && !p.quests.upgrade_weapon.done) {
      p.quests.upgrade_weapon.done = true;
      p.quests.upgrade_weapon.current = p.gear.weapon;
    }

    save();
    const typeNames = { weapon: 'Qurol (Hujum)', armor: 'Sovut (Himoya & HP)', amulet: 'Tilsim (Krit & Mana)' };
    return res.json({ message: `${typeNames[type]} darajasi ${p.gear[type]} ga ko'tarildi!`, player: safe(p) });
  }

  res.status(400).json({ error: "Noma'lum mahsulot turi." });
});

// Equip companion card
app.post('/api/cards/equip', auth, (req, res) => {
  const cardIdx = Number(req.body.card);
  const p = req.player;
  if (!Number.isInteger(cardIdx) || cardIdx < 0 || cardIdx >= ALL_HEROES.length) {
    return res.status(400).json({ error: "Karta topilmadi." });
  }
  const hasCard = p.cards.some(c => c.card === cardIdx);
  if (!hasCard) return res.status(403).json({ error: "Sizda bu karta mavjud emas." });

  p.activeCompanion = cardIdx;
  save();
  res.json({ message: `${ALL_HEROES[cardIdx][0]} faol jangchi hamroh etib tayinlandi!`, player: safe(p) });
});

// Sell duplicate card
app.post('/api/cards/sell', auth, (req, res) => {
  const cardIdx = Number(req.body.card);
  const p = req.player;
  const count = p.cards.filter(c => c.card === cardIdx).length;
  if (count <= 1) {
    return res.status(400).json({ error: "Nusxasi bo'lmagan yagona kartani sotib bo'lmaydi." });
  }
  const removeIndex = p.cards.findIndex(c => c.card === cardIdx);
  p.cards.splice(removeIndex, 1);
  const hero = ALL_HEROES[cardIdx];
  const price = hero[2] === 'legendary' ? 150 : hero[2] === 'epic' ? 80 : hero[2] === 'rare' ? 45 : 25;
  p.coins += price;
  save();
  res.json({ message: `${hero[0]} kartasi sotildi: +${price} tanga olindi!`, player: safe(p) });
});

// Claim Quest reward
app.post('/api/quests/claim', auth, (req, res) => {
  const questId = String(req.body.questId || '');
  const p = req.player;
  const q = p.quests[questId];
  if (!q) return res.status(404).json({ error: "Kvest topilmadi." });
  if (!q.done) return res.status(400).json({ error: "Kvest hali bajarilmagan." });
  if (q.claimed) return res.status(409).json({ error: "Mukofot allaqachon olingan." });

  q.claimed = true;
  p.coins += q.rewardCoins;
  p.xp += q.rewardXp;

  // Check level up
  const xpNeeded = p.level * 100;
  let levelUpMsg = '';
  if (p.xp >= xpNeeded) {
    p.xp -= xpNeeded;
    p.level++;
    p.coins += 200;
    const { maxHp, maxMana } = computeStats(p);
    p.hp = maxHp;
    p.mana = maxMana;
    levelUpMsg = ` Daraja oshdi! Endi Lv.${p.level}!`;
  }
  save();
  res.json({ message: `Mukofot olindi: +${q.rewardCoins} tanga, +${q.rewardXp} XP!${levelUpMsg}`, player: safe(p) });
});

// Leaderboard
app.get('/api/leaderboard', (_, res) => {
  const list = Object.values(players)
    .map(p => ({
      name: p.name,
      level: p.level || 1,
      coins: p.coins || 0,
      kills: p.stats?.kills || 0,
      bossKills: p.stats?.bossKills || 0,
      cardCount: (p.cards || []).length
    }))
    .sort((a, b) => b.level - a.level || b.kills - a.kills || b.coins - a.coins)
    .slice(0, 15);
  res.json({ leaderboard: list });
});

// REST Fallback Action Endpoints (Works without WebSockets on Vercel)
app.post('/api/action/move', auth, (req, res) => {
  const p = req.player;
  const { x, y } = req.body;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    p.x = Math.max(30, Math.min(870, x));
    p.y = Math.max(30, Math.min(530, y));
    save();
  }
  res.json({ ok: true, player: safe(p) });
});

app.post('/api/action/attack', auth, (req, res) => {
  const p = req.player;
  const { mobId, skill = 'slash' } = req.body;
  const room = p.room || 'bosh_qala';
  const state = mapStates[room];
  if (!state) return res.status(400).json({ error: "Xarita holati topilmadi." });

  const mob = state.mobs.find(m => m.id === mobId);
  if (!mob || mob.hp <= 0) return res.status(400).json({ error: "Maxluq mavjud emas." });

  let manaCost = 0;
  let skillMultiplier = 1.0;
  if (skill === 'fireball') { manaCost = 15; skillMultiplier = 1.6; }
  else if (skill === 'whirlwind') { manaCost = 25; skillMultiplier = 2.2; }

  if (p.mana < manaCost) return res.status(400).json({ error: "Yetarli Mana yo'q!" });
  p.mana -= manaCost;

  const { attackPower, critRate, defensePower } = computeStats(p);
  const isCrit = Math.random() * 100 < critRate;
  let rawDamage = attackPower * skillMultiplier;
  if (isCrit) rawDamage *= 1.8;
  const damage = Math.max(8, Math.round(rawDamage - (mob.defense || 0)));

  mob.hp -= damage;
  let loot = null;
  let levelUp = false;

  if (mob.hp <= 0) {
    mob.hp = 0;
    const earnedXp = mob.xp || 20;
    const earnedCoins = mob.coins || 15;
    p.xp += earnedXp;
    p.coins += earnedCoins;
    p.stats.kills = (p.stats.kills || 0) + 1;

    let cardDrop = null;
    const dropThreshold = mob.isBoss ? 1.0 : 0.35;
    if (Math.random() < dropThreshold) {
      const dropCardIdx = Math.floor(Math.random() * 100);
      p.cards.push({ id: crypto.randomUUID(), card: dropCardIdx, at: Date.now() });
      cardDrop = ALL_HEROES[dropCardIdx];
    }

    if (mob.isBoss) {
      p.stats.bossKills = (p.stats.bossKills || 0) + 1;
      if (p.quests.defeat_boss) {
        p.quests.defeat_boss.done = true;
        p.quests.defeat_boss.current = 1;
      }
    }

    if (p.quests.kill_mobs && !p.quests.kill_mobs.done) {
      p.quests.kill_mobs.current++;
      if (p.quests.kill_mobs.current >= p.quests.kill_mobs.target) p.quests.kill_mobs.done = true;
    }

    const xpNeeded = p.level * 100;
    if (p.xp >= xpNeeded) {
      p.xp -= xpNeeded;
      p.level++;
      p.coins += 200;
      const { maxHp, maxMana } = computeStats(p);
      p.hp = maxHp;
      p.mana = maxMana;
      levelUp = true;
    }

    loot = { coins: earnedCoins, xp: earnedXp, card: cardDrop, levelUp };
    setTimeout(() => { mob.hp = mob.maxHp; }, mob.respawn || 8000);
  } else if (mob.attack > 0) {
    const mobDmg = Math.max(4, Math.round(mob.attack - defensePower * 0.4));
    p.hp -= mobDmg;
    if (p.hp <= 0) {
      const { maxHp } = computeStats(p);
      p.hp = Math.round(maxHp * 0.5);
      p.room = 'bosh_qala';
      p.x = 450;
      p.y = 280;
    }
  }

  save();
  res.json({
    damage,
    isCrit,
    skill,
    mobHp: mob.hp,
    mobMaxHp: mob.maxHp,
    mobDead: mob.hp <= 0,
    loot,
    player: safe(p)
  });
});

app.post('/api/action/portal', auth, (req, res) => {
  const p = req.player;
  const { targetMap, spawnX, spawnY } = req.body;
  if (!MAPS[targetMap]) return res.status(400).json({ error: "Xarita topilmadi." });
  if (p.level < MAPS[targetMap].levelReq) {
    return res.status(403).json({ error: `Kamida Lv.${MAPS[targetMap].levelReq} kerak!` });
  }

  p.room = targetMap;
  p.x = spawnX || 450;
  p.y = spawnY || 280;

  if (targetMap === 'qorongi_ormon' && p.quests.explore_forest && !p.quests.explore_forest.done) {
    p.quests.explore_forest.done = true;
    p.quests.explore_forest.current = 1;
  }
  save();
  res.json({ player: safe(p), mapDef: MAPS[targetMap] });
});

app.post('/api/action/shrine', auth, (req, res) => {
  const p = req.player;
  const { maxHp, maxMana } = computeStats(p);
  p.hp = maxHp;
  p.mana = maxMana;
  save();
  res.json({ message: "Barcha Salomatlik va Mana to'liq tiklandi!", player: safe(p) });
});

app.post('/api/action/chest', auth, (req, res) => {
  const p = req.player;
  const bonusCoins = 100 + Math.floor(Math.random() * 100);
  const bonusXp = 80;
  p.coins += bonusCoins;
  p.xp += bonusXp;
  p.stats.chestsOpened = (p.stats.chestsOpened || 0) + 1;

  const cardIdx = Math.floor(Math.random() * 100);
  p.cards.push({ id: crypto.randomUUID(), card: cardIdx, at: Date.now() });

  if (p.quests.open_chest && !p.quests.open_chest.done) {
    p.quests.open_chest.done = true;
    p.quests.open_chest.current = 1;
  }
  save();
  res.json({ coins: bonusCoins, xp: bonusXp, card: ALL_HEROES[cardIdx], player: safe(p) });
});

// Socket.IO Multiplayer & Realtime Engine
io.use((socket, next) => {
  const key = sessions.get(socket.handshake.auth?.token || '');
  if (!key || !players[key]) return next(new Error('AUTH_FAILED'));
  socket.playerKey = key;
  next();
});

function broadcastRoom(room) {
  const memberKeys = Array.from(rooms.get(room) || []);
  const playerList = memberKeys.map(k => {
    const q = players[k];
    const { attackPower, defensePower } = computeStats(q);
    return {
      name: q.name,
      level: q.level,
      hp: q.hp,
      maxHp: computeStats(q).maxHp,
      x: q.x || 450,
      y: q.y || 280,
      gear: q.gear,
      activeCompanion: q.activeCompanion !== null ? ALL_HEROES[q.activeCompanion] : null,
      attackPower,
      defensePower
    };
  });

  const state = mapStates[room] || { mobs: [], chests: [] };
  io.to(room).emit('world_state', {
    room,
    mapDef: MAPS[room],
    players: playerList,
    mobs: state.mobs,
    chests: state.chests
  });
}

io.on('connection', socket => {
  const key = socket.playerKey;
  const p = players[key];
  online.set(key, socket.id);

  let currentRoom = p.room || 'bosh_qala';
  socket.join(currentRoom);
  if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
  rooms.get(currentRoom).add(key);

  socket.emit('chat', { system: true, text: `⚔ ${MAPS[currentRoom].name} xaritasiga xush kelibsiz, ${p.name}!` });
  broadcastRoom(currentRoom);

  socket.on('move', pos => {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
    p.x = Math.max(30, Math.min(870, pos.x));
    p.y = Math.max(30, Math.min(530, pos.y));
    broadcastRoom(currentRoom);
  });

  socket.on('change_map', data => {
    const targetMap = String(data?.targetMap || '');
    if (!MAPS[targetMap]) return socket.emit('chat', { system: true, text: "Noma'lum xarita." });

    if (p.level < MAPS[targetMap].levelReq) {
      return socket.emit('chat', { system: true, text: `⛔ Bu xaritaga kirish uchun kamida Lv.${MAPS[targetMap].levelReq} kerak!` });
    }

    socket.leave(currentRoom);
    rooms.get(currentRoom)?.delete(key);
    broadcastRoom(currentRoom);

    currentRoom = targetMap;
    p.room = targetMap;
    p.x = data.spawnX || 450;
    p.y = data.spawnY || 280;

    socket.join(currentRoom);
    if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
    rooms.get(currentRoom).add(key);

    if (targetMap === 'qorongi_ormon' && p.quests.explore_forest && !p.quests.explore_forest.done) {
      p.quests.explore_forest.done = true;
      p.quests.explore_forest.current = 1;
    }

    save();
    socket.emit('chat', { system: true, text: `🌌 Siz ${MAPS[targetMap].name} xaritasiga kirdingiz!` });
    socket.emit('player_sync', { player: safe(p) });
    broadcastRoom(currentRoom);
  });

  socket.on('attack_mob', data => {
    const mobId = String(data?.mobId || '');
    const skill = String(data?.skill || 'slash');
    const state = mapStates[currentRoom];
    if (!state) return;

    const mob = state.mobs.find(m => m.id === mobId);
    if (!mob || mob.hp <= 0) return;

    const dx = (p.x || 450) - mob.x;
    const dy = (p.y || 280) - mob.y;
    if (Math.sqrt(dx * dx + dy * dy) > 180) {
      return socket.emit('chat', { system: true, text: "Maxluq juda uzoqda! Yaqinroq boring." });
    }

    let manaCost = 0;
    let skillMultiplier = 1.0;
    if (skill === 'fireball') { manaCost = 15; skillMultiplier = 1.6; }
    else if (skill === 'whirlwind') { manaCost = 25; skillMultiplier = 2.2; }

    if (p.mana < manaCost) {
      return socket.emit('chat', { system: true, text: "Yetarli Mana yo'q!" });
    }
    p.mana -= manaCost;

    const { attackPower, critRate } = computeStats(p);
    const isCrit = Math.random() * 100 < critRate;
    let rawDamage = attackPower * skillMultiplier;
    if (isCrit) rawDamage *= 1.8;
    const damage = Math.max(8, Math.round(rawDamage - (mob.defense || 0)));

    mob.hp -= damage;

    io.to(currentRoom).emit('combat_effect', {
      type: 'player_hit',
      targetId: mob.id,
      damage,
      isCrit,
      skill,
      x: mob.x,
      y: mob.y
    });

    if (mob.hp <= 0) {
      mob.hp = 0;
      const earnedXp = mob.xp || 20;
      const earnedCoins = mob.coins || 15;
      p.xp += earnedXp;
      p.coins += earnedCoins;
      p.stats.kills = (p.stats.kills || 0) + 1;

      let cardDrop = null;
      const dropThreshold = mob.isBoss ? 1.0 : 0.35;
      if (Math.random() < dropThreshold) {
        const dropCardIdx = Math.floor(Math.random() * 100);
        p.cards.push({ id: crypto.randomUUID(), card: dropCardIdx, at: Date.now() });
        cardDrop = ALL_HEROES[dropCardIdx];
      }

      if (mob.isBoss) {
        p.stats.bossKills = (p.stats.bossKills || 0) + 1;
        if (p.quests.defeat_boss && !p.quests.defeat_boss.done) {
          p.quests.defeat_boss.done = true;
          p.quests.defeat_boss.current = 1;
        }
        io.to(currentRoom).emit('chat', {
          system: true,
          text: `🔥 AFSONAVIY G'ALABA! ${p.name} qudratli ${mob.name}ni yer tishlatdi!`
        });
      }

      if (p.quests.kill_mobs && !p.quests.kill_mobs.done) {
        p.quests.kill_mobs.current++;
        if (p.quests.kill_mobs.current >= p.quests.kill_mobs.target) p.quests.kill_mobs.done = true;
      }

      let levelUp = false;
      const xpNeeded = p.level * 100;
      if (p.xp >= xpNeeded) {
        p.xp -= xpNeeded;
        p.level++;
        p.coins += 200;
        const { maxHp, maxMana } = computeStats(p);
        p.hp = maxHp;
        p.mana = maxMana;
        levelUp = true;
        io.to(currentRoom).emit('chat', {
          system: true,
          text: `⭐ Qoyil! ${p.name} yangi Lv.${p.level} darajasiga erishdi!`
        });
      }

      socket.emit('loot_drop', {
        mobName: mob.name,
        coins: earnedCoins,
        xp: earnedXp,
        card: cardDrop,
        levelUp
      });

      setTimeout(() => {
        mob.hp = mob.maxHp;
        broadcastRoom(currentRoom);
      }, mob.respawn || 8000);
    } else if (mob.attack > 0) {
      const { defensePower } = computeStats(p);
      const mobDmg = Math.max(4, Math.round(mob.attack - defensePower * 0.4));
      p.hp -= mobDmg;

      io.to(currentRoom).emit('combat_effect', {
        type: 'mob_hit',
        targetName: p.name,
        damage: mobDmg,
        x: p.x,
        y: p.y
      });

      if (p.hp <= 0) {
        const { maxHp } = computeStats(p);
        p.hp = Math.round(maxHp * 0.5);
        socket.leave(currentRoom);
        rooms.get(currentRoom)?.delete(key);
        broadcastRoom(currentRoom);

        currentRoom = 'bosh_qala';
        p.room = 'bosh_qala';
        p.x = 450;
        p.y = 280;
        socket.join(currentRoom);
        if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
        rooms.get(currentRoom).add(key);

        socket.emit('player_died', {
          text: `☠ Siz ${mob.name} tomonidan mag'lub bo'ldingiz va Bosh Qal'ada jonlandingiz.`
        });
      }
    }

    save();
    socket.emit('player_sync', { player: safe(p) });
    broadcastRoom(currentRoom);
  });

  socket.on('use_shrine', data => {
    const shrineId = String(data?.shrineId || '');
    const mapDef = MAPS[currentRoom];
    if (!mapDef) return;

    const shrine = mapDef.shrines.find(s => s.id === shrineId);
    if (!shrine) return;

    const dx = (p.x || 450) - shrine.x;
    const dy = (p.y || 280) - shrine.y;
    if (Math.sqrt(dx * dx + dy * dy) > 120) {
      return socket.emit('chat', { system: true, text: "Chashmaga yaqinroq keling!" });
    }

    const { maxHp, maxMana } = computeStats(p);
    p.hp = maxHp;
    p.mana = maxMana;
    save();

    socket.emit('shrine_used', { message: `✨ ${shrine.name} sizning barcha Salomatlik va Manangizni to'liq tikladi!` });
    socket.emit('player_sync', { player: safe(p) });
    broadcastRoom(currentRoom);
  });

  socket.on('open_world_chest', data => {
    const chestId = String(data?.chestId || '');
    const state = mapStates[currentRoom];
    if (!state) return;

    const chest = state.chests.find(c => c.id === chestId);
    if (!chest || chest.opened) return;

    const dx = (p.x || 450) - chest.x;
    const dy = (p.y || 280) - chest.y;
    if (Math.sqrt(dx * dx + dy * dy) > 120) {
      return socket.emit('chat', { system: true, text: "Sandiqqa yaqinroq boring!" });
    }

    chest.opened = true;
    const bonusCoins = 100 + Math.floor(Math.random() * 100);
    const bonusXp = 80;
    p.coins += bonusCoins;
    p.xp += bonusXp;
    p.stats.chestsOpened = (p.stats.chestsOpened || 0) + 1;

    const cardIdx = Math.floor(Math.random() * 100);
    p.cards.push({ id: crypto.randomUUID(), card: cardIdx, at: Date.now() });

    if (p.quests.open_chest && !p.quests.open_chest.done) {
      p.quests.open_chest.done = true;
      p.quests.open_chest.current = 1;
    }

    save();
    socket.emit('chest_opened', { coins: bonusCoins, xp: bonusXp, card: ALL_HEROES[cardIdx] });
    socket.emit('player_sync', { player: safe(p) });
    broadcastRoom(currentRoom);

    setTimeout(() => {
      chest.opened = false;
      broadcastRoom(currentRoom);
    }, 45000);
  });

  socket.on('chat', msg => {
    const text = String(msg || '').trim().slice(0, 180);
    if (!text) return;
    io.to(currentRoom).emit('chat', {
      name: p.name,
      text,
      time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('disconnect', () => {
    online.delete(key);
    rooms.get(currentRoom)?.delete(key);
    broadcastRoom(currentRoom);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Diyorbek MMORPG Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
