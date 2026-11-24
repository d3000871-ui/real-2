// DIYORBEK MMORPG — Dark Fantasy Diablo Client Engine

const $ = id => document.getElementById(id);

let token = localStorage.getItem('diyorbekToken');
let me = null;
let socket = null;
let worldState = {
  room: 'bosh_qala',
  mapDef: null,
  players: [],
  mobs: [],
  chests: []
};
let selectedSkill = 'slash';
let activeFilter = 'all';
let allMaps = {};

// AUDIO SYNTHESIZER (Web Audio API - zero external files required)
let audioCtx = null;
let isMuted = localStorage.getItem('diyorbek_muted') === 'true';

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

function updateSoundButton() {
  $('soundBtn').textContent = isMuted ? '🔇 Ovoz o\'chiq' : '🔊 Ovoz yoqiq';
}

function playSynth(type, freq, duration, stopFreq, gainVal = 0.1) {
  if (isMuted) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (stopFreq) {
      osc.frequency.exponentialRampToValueAtTime(stopFreq, audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

const Sound = {
  hit() { playSynth('sawtooth', 180, 0.12, 60, 0.12); },
  crit() { playSynth('square', 380, 0.22, 120, 0.18); },
  fireball() { playSynth('sine', 340, 0.28, 80, 0.15); },
  whirlwind() { playSynth('triangle', 220, 0.35, 110, 0.16); },
  heal() { playSynth('sine', 260, 0.4, 520, 0.15); },
  coin() { playSynth('sine', 587, 0.15, 880, 0.12); },
  levelUp() {
    playSynth('triangle', 440, 0.2, 554, 0.2);
    setTimeout(() => playSynth('triangle', 554, 0.2, 659, 0.2), 120);
    setTimeout(() => playSynth('triangle', 659, 0.45, 880, 0.25), 240);
  },
  portal() { playSynth('sine', 160, 0.5, 420, 0.16); }
};

$('soundBtn').onclick = () => {
  isMuted = !isMuted;
  localStorage.setItem('diyorbek_muted', isMuted ? 'true' : 'false');
  updateSoundButton();
};
updateSoundButton();

// 100 HERO CARDS CATALOG
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

// UI NAVIGATION
function showAuth() {
  $('auth').classList.remove('hidden');
  $('game').classList.add('hidden');
}

function showGame() {
  $('auth').classList.add('hidden');
  $('game').classList.remove('hidden');
}

async function api(url, body) {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Server xatosi');
  return d;
}

// UPDATE USER HUD & DATA
function update(p) {
  me = p;
  $('coins').textContent = (p.coins || 0).toLocaleString();
  $('level').textContent = p.level || 1;

  // Bars
  const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
  const manaPct = Math.max(0, Math.min(100, Math.round((p.mana / p.maxMana) * 100)));
  const xpNeeded = p.level * 100;
  const xpPct = Math.max(0, Math.min(100, Math.round((p.xp / xpNeeded) * 100)));

  $('hpFill').style.width = hpPct + '%';
  $('hpText').textContent = `${p.hp} / ${p.maxHp}`;

  $('manaFill').style.width = manaPct + '%';
  $('manaText').textContent = `${p.mana} / ${p.maxMana}`;

  $('xpFill').style.width = xpPct + '%';
  $('xpText').textContent = `${p.xp} / ${xpNeeded}`;

  // Gear labels in Shop
  const wLvl = p.gear.weapon || 0;
  const aLvl = p.gear.armor || 0;
  const amLvl = p.gear.amulet || 0;

  $('weaponLevelText').textContent = `Daraja ${wLvl} · Hujum +${wLvl * 14}`;
  $('weaponBtn').textContent = `${250 + wLvl * 250} 🪙`;

  $('armorLevelText').textContent = `Daraja ${aLvl} · Himoya +${aLvl * 10} · HP +${aLvl * 45}`;
  $('armorBtn').textContent = `${250 + aLvl * 250} 🪙`;

  $('amuletLevelText').textContent = `Daraja ${amLvl} · Krit +${amLvl * 5}% · MP +${amLvl * 30}`;
  $('amuletBtn').textContent = `${250 + amLvl * 250} 🪙`;

  // Stats
  $('statAtk').textContent = p.attackPower || 0;
  $('statDef').textContent = p.defensePower || 0;
  $('statCrit').textContent = (p.critRate || 0) + '%';
  $('statKills').textContent = p.stats?.kills || 0;
  $('statBossKills').textContent = p.stats?.bossKills || 0;

  // Active Companion
  if (p.activeCompanion !== null && p.activeCompanion !== undefined) {
    const compHero = ALL_HEROES[p.activeCompanion];
    if (compHero) {
      $('compEmoji').textContent = compHero[1];
      $('compName').textContent = compHero[0];
      const bonusPct = Math.round((compHero[3] - 1) * 100);
      $('compBonusTag').textContent = `+${bonusPct}% Kuch`;
      $('compBonusTag').className = `pill ${compHero[2]}`;
    }
  } else {
    $('compEmoji').textContent = '🛡️';
    $('compName').textContent = 'Hamrohsiz';
    $('compBonusTag').textContent = '+0%';
    $('compBonusTag').className = 'pill';
  }

  // Cards & Quests
  renderCards();
  renderQuests();
}

// RENDER HERO CARDS
function renderCards() {
  const counts = {};
  (me.cards || []).forEach(c => {
    counts[c.card] = (counts[c.card] || 0) + 1;
  });

  const total = (me.cards || []).length;
  $('cardCount').textContent = total;
  $('tabCardCount').textContent = total;

  const cardIds = Object.keys(counts).map(Number);
  const filtered = cardIds.filter(id => {
    const h = ALL_HEROES[id];
    if (!h) return false;
    if (activeFilter === 'all') return true;
    return h[2] === activeFilter;
  });

  if (filtered.length === 0) {
    $('cards').innerHTML = '<p class="muted" style="grid-column:1/-1; text-align:center; padding:20px;">Bu toifada karta topilmadi. Sandiqlardan qahramonlar yig\'ing!</p>';
    return;
  }

  $('cards').innerHTML = filtered.map(id => {
    const h = ALL_HEROES[id];
    const n = counts[id];
    const isEquipped = me.activeCompanion === id;
    const bonusPct = Math.round((h[3] - 1) * 100);
    return `
      <div class="character rarity-${h[2]} ${isEquipped ? 'equipped' : ''}" data-id="${id}">
        <div class="emoji">${h[1]}</div>
        <b>${h[0]}</b>
        <small>${h[2].toUpperCase()} · x${n}</small>
        <small style="display:block; color:#79c788;">+${bonusPct}% Kuch</small>
        <div class="card-actions">
          <button class="small" onclick="equipCompanion(${id})">${isEquipped ? '✓ Faol' : 'Hamroh'}</button>
          ${n > 1 ? `<button class="small secondary" onclick="sellCard(${id})">Sotish</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.equipCompanion = async function(cardId) {
  try {
    const d = await api('/api/cards/equip', { card: cardId });
    update(d.player);
    $('cardActionMsg').textContent = d.message;
    Sound.levelUp();
  } catch (e) {
    $('cardActionMsg').textContent = e.message;
  }
};

window.sellCard = async function(cardId) {
  try {
    const d = await api('/api/cards/sell', { card: cardId });
    update(d.player);
    $('cardActionMsg').textContent = d.message;
    Sound.coin();
  } catch (e) {
    $('cardActionMsg').textContent = e.message;
  }
};

// CARD FILTER BUTTONS
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderCards();
  };
});

// QUESTS
function renderQuests() {
  const qObj = me.quests || {};
  const html = Object.entries(qObj).map(([key, q]) => {
    const isDone = q.done;
    const isClaimed = q.claimed;
    return `
      <div class="quest-item ${isDone ? 'completed' : ''}">
        <div>
          <div class="quest-title">${isDone ? '✅' : '⏳'} ${q.label}</div>
          <div class="quest-desc">Mukofot: +${q.rewardCoins} 🪙 tanga, +${q.rewardXp} XP</div>
        </div>
        <div>
          ${isClaimed 
            ? '<span class="pill">Olingan</span>' 
            : isDone 
              ? `<button class="small" onclick="claimQuest('${key}')">Mukofotni olish</button>` 
              : `<span class="quest-progress">${q.current || 0}/${q.target || 1}</span>`}
        </div>
      </div>
    `;
  }).join('');

  $('questsList').innerHTML = html || '<p class="muted">Hozircha faol kvestlar yo\'q.</p>';
  if ($('questsModalList')) $('questsModalList').innerHTML = html;
}

window.claimQuest = async function(questId) {
  try {
    const d = await api('/api/quests/claim', { questId });
    update(d.player);
    $('questActionMsg').textContent = d.message;
    Sound.levelUp();
  } catch (e) {
    $('questActionMsg').textContent = e.message;
  }
};

// TAB SWITCHING
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    const pane = $(btn.dataset.tab);
    if (pane) pane.classList.remove('hidden');

    if (btn.dataset.tab === 'tabRank') loadLeaderboard();
  };
});

// LEADERBOARD
async function loadLeaderboard() {
  try {
    const d = await api('/api/leaderboard');
    const rows = (d.leaderboard || []).map((p, idx) => `
      <tr>
        <td><b>#${idx + 1}</b></td>
        <td><b>${p.name}</b></td>
        <td>Lv.${p.level}</td>
        <td>${p.kills} ta</td>
        <td>${p.coins.toLocaleString()} 🪙</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;">O\'yinchilar topilmadi.</td></tr>';

    $('leaderboardBody').innerHTML = rows;

    const modalRows = (d.leaderboard || []).map((p, idx) => `
      <tr>
        <td><b>#${idx + 1}</b></td>
        <td><b>${p.name}</b></td>
        <td>Lv.${p.level}</td>
        <td>${p.kills} ta</td>
        <td>${p.bossKills || 0} ta</td>
        <td>${p.coins.toLocaleString()} 🪙</td>
      </tr>
    `).join('');
    if ($('modalLeaderboardBody')) $('modalLeaderboardBody').innerHTML = modalRows;
  } catch (e) {}
}

// MODALS
$('openMapModalBtn').onclick = () => { loadZoneGrid(); $('zoneModal').classList.remove('hidden'); };
$('closeZoneModal').onclick = () => $('zoneModal').classList.add('hidden');

$('openQuestsModalBtn').onclick = () => { renderQuests(); $('questsModal').classList.remove('hidden'); };
$('closeQuestsModal').onclick = () => $('questsModal').classList.add('hidden');

$('openLeaderboardBtn').onclick = () => { loadLeaderboard(); $('leaderboardModal').classList.remove('hidden'); };
$('closeLeaderboardModal').onclick = () => $('leaderboardModal').classList.add('hidden');

window.onclick = e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
};

// LOAD ALL MAPS FOR MODAL
async function loadZoneGrid() {
  if (!Object.keys(allMaps).length) {
    try {
      const d = await api('/api/maps');
      allMaps = d.maps || {};
    } catch (e) {}
  }

  $('zoneGrid').innerHTML = Object.values(allMaps).map(m => {
    const isCurrent = (worldState.room === m.id);
    const locked = (me && me.level < m.levelReq);
    return `
      <div class="zone-card ${isCurrent ? 'current' : ''}">
        <div>
          <b>${m.name} ${m.isSafeZone ? '🕊️' : '⚔️'}</b>
          <p>${m.desc}</p>
          <small class="muted">Talab: Lv.${m.levelReq}+ · Monstrlar: ${m.mobs.length} ta</small>
        </div>
        <div>
          ${isCurrent 
            ? '<span class="pill safe">Shu yerdasiz</span>' 
            : locked 
              ? `<span class="pill danger">Lv.${m.levelReq} kerak</span>` 
              : `<button class="small" onclick="teleportToMap('${m.id}')">O'tish</button>`}
        </div>
      </div>
    `;
  }).join('');
}

window.teleportToMap = function(mapId) {
  $('zoneModal').classList.add('hidden');
  socket?.emit('change_map', { targetMap: mapId });
  Sound.portal();
};

// AUTH
async function enter(mode) {
  try {
    const d = await api('/api/' + mode, {
      name: $('name').value,
      password: $('password').value
    });
    token = d.token;
    localStorage.setItem('diyorbekToken', token);
    update(d.player);
    showGame();
    connect();
  } catch (e) {
    $('authMsg').textContent = e.message;
  }
}

$('login').onclick = () => enter('login');
$('register').onclick = () => enter('register');
$('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') enter('login');
});

// LOGOUT
$('logout').onclick = () => {
  socket?.disconnect();
  token = null;
  localStorage.removeItem('diyorbekToken');
  showAuth();
};

// PROMO
$('promoBtn').onclick = async () => {
  try {
    const d = await api('/api/promo', { code: $('promo').value });
    update(d.player);
    $('promoMsg').textContent = d.message;
    Sound.levelUp();
  } catch (e) {
    $('promoMsg').textContent = e.message;
  }
};

// BUY & UPGRADE
async function buy(type) {
  try {
    const d = await api('/api/buy', { type });
    update(d.player);
    $('shopMsg').textContent = d.message;
    if (type === 'chest') {
      Sound.coin();
      if (d.cards?.length) {
        $('shopMsg').textContent += ' ' + d.cards.map(c => ALL_HEROES[c.card][0]).join(', ');
      }
    } else {
      Sound.hit();
    }
  } catch (e) {
    $('shopMsg').textContent = e.message;
  }
}

$('chestBtn').onclick = () => buy('chest');
$('weaponBtn').onclick = () => buy('weapon');
$('armorBtn').onclick = () => buy('armor');
$('amuletBtn').onclick = () => buy('amulet');

// SKILLS HOTBAR
function selectSkill(skill) {
  selectedSkill = skill;
  document.querySelectorAll('.skill-slot').forEach(el => {
    el.style.borderColor = (el.dataset.skill === skill) ? '#dfaa4f' : '#664522';
  });
}

$('skillSlash').onclick = () => selectSkill('slash');
$('skillFireball').onclick = () => selectSkill('fireball');
$('skillWhirlwind').onclick = () => selectSkill('whirlwind');
$('skillHeal').onclick = () => {
  // Use closest shrine or inform player
  const mapDef = worldState.mapDef;
  if (!mapDef || !mapDef.shrines || !mapDef.shrines.length) {
    addChat({ system: true, text: "Bu xaritada shifo chashmasi mavjud emas." });
    return;
  }
  socket?.emit('use_shrine', { shrineId: mapDef.shrines[0].id });
};

window.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'q') selectSkill('slash');
  if (k === 'w') selectSkill('fireball');
  if (k === 'e') selectSkill('whirlwind');
  if (k === 'r') $('skillHeal').click();
});
selectSkill('slash');

// CHAT
function addChat(m) {
  const el = document.createElement('div');
  if (m.system) {
    el.className = 'sys-msg';
    el.textContent = '⚙ ' + m.text;
  } else {
    el.innerHTML = `<span style="color:#f0c56c;">[${m.time || ''}] <b>${m.name}:</b></span> ${m.text}`;
  }
  $('chatLog').append(el);
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}

$('chatForm').onsubmit = e => {
  e.preventDefault();
  const s = $('chatInput').value.trim();
  if (s) socket?.emit('chat', s);
  $('chatInput').value = '';
};

// ==========================================
// GRAPHICS & CANVAS WORLD ENGINE (900 x 560)
// ==========================================
const canvas = $('world');
const ctx = canvas.getContext('2d');
const W = 900;
const H = 560;

// Particle Engine
const particles = [];
for (let i = 0; i < 45; i++) {
  particles.push({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    size: Math.random() * 2.5 + 1,
    alpha: Math.random() * 0.7 + 0.3
  });
}

// Floating Damage & Text Effects
const floaters = [];
function addFloater(x, y, text, color = '#ff4d4f', isLarge = false) {
  floaters.push({
    x: x + (Math.random() - 0.5) * 20,
    y: y - 10,
    text,
    color,
    isLarge,
    vy: -1.2,
    alpha: 1.0,
    life: 0,
    maxLife: 45
  });
}

// Combat FX Animations (rings, slashes, fireballs)
const spellFx = [];
function addSpellFx(type, x, y) {
  spellFx.push({
    type,
    x,
    y,
    frame: 0,
    maxFrame: 18
  });
}

// CONNECT SOCKET.IO
function connect() {
  if (socket) socket.disconnect();
  socket = io({ auth: { token } });

  socket.on('connect_error', () => {
    addChat({ system: true, text: "Serverga ulanib bo'lmadi. Qayta urinilmoqda..." });
  });

  socket.on('player_sync', data => {
    if (data.player) update(data.player);
  });

  socket.on('world_state', state => {
    worldState = state;
    $('online').textContent = (state.players || []).length;
    if (state.mapDef) {
      $('currentZoneName').textContent = `🌍 ${state.mapDef.name}`;
      const isSafe = state.mapDef.isSafeZone;
      $('zoneSafetyPill').className = isSafe ? 'pill safe' : 'pill danger';
      $('zoneSafetyPill').textContent = isSafe ? 'TINCH HUDUD' : 'XAVFLI HUDUD';
    }
  });

  socket.on('combat_effect', data => {
    if (data.type === 'player_hit') {
      const txt = data.isCrit ? `⚡ KRIT! -${data.damage}` : `-${data.damage}`;
      const col = data.isCrit ? '#ffd24c' : '#ffffff';
      addFloater(data.x, data.y, txt, col, data.isCrit);
      addSpellFx(data.skill || 'slash', data.x, data.y);
      if (data.isCrit) Sound.crit();
      else if (data.skill === 'fireball') Sound.fireball();
      else if (data.skill === 'whirlwind') Sound.whirlwind();
      else Sound.hit();
    } else if (data.type === 'mob_hit') {
      addFloater(data.x, data.y, `-${data.damage}`, '#ff4438');
      Sound.hit();
    }
  });

  socket.on('loot_drop', data => {
    addFloater(me?.x || 450, me?.y || 280, `+${data.coins} 🪙`, '#ffd769');
    addFloater(me?.x || 450, (me?.y || 280) - 25, `+${data.xp} XP`, '#36cfc9');
    Sound.coin();
    if (data.card) {
      addChat({ system: true, text: `🎁 Sizga yangi karta tushdi: ${data.card[1]} ${data.card[0]} (${data.card[2].toUpperCase()})!` });
    }
    if (data.levelUp) {
      Sound.levelUp();
      addFloater(me?.x || 450, (me?.y || 280) - 45, `⭐ DARAJA OSHDI!`, '#ffec3d', true);
    }
  });

  socket.on('chest_opened', data => {
    addFloater(me?.x || 450, me?.y || 280, `+${data.coins} 🪙`, '#ffd769');
    addFloater(me?.x || 450, (me?.y || 280) - 25, `+${data.xp} XP`, '#36cfc9');
    if (data.card) {
      addChat({ system: true, text: `🎉 Sandiqdan karta chiqdi: ${data.card[1]} ${data.card[0]}!` });
    }
    Sound.coin();
  });

  socket.on('shrine_used', data => {
    addFloater(me?.x || 450, me?.y || 280, `✨ TO'LIQ SHIFO!`, '#52c41a', true);
    addChat({ system: true, text: data.message });
    Sound.heal();
  });

  socket.on('player_died', data => {
    addChat({ system: true, text: data.text });
  });

  socket.on('chat', m => addChat(m));
}

// Pseudo-random deterministic noise
function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ANIMATION LOOP
let animTime = 0;
function render() {
  animTime += 0.025;
  ctx.clearRect(0, 0, W, H);

  const theme = worldState.mapDef?.theme || 'town';

  // 1. Draw Map Biome Background
  drawBiome(theme);

  // 2. Draw Map Structures & Ambient Props
  drawProps(theme);

  // 3. Draw Portals
  drawPortals();

  // 4. Draw Shrines
  drawShrines();

  // 5. Draw Chests
  drawChests();

  // 6. Draw Monsters
  drawMobs();

  // 7. Draw Players & Companions
  drawPlayers();

  // 8. Draw Spell FX Animations
  drawSpellFx();

  // 9. Draw Floating Numbers
  drawFloaters();

  // 10. Atmospheric Weather & Particle Overlay
  drawWeather(theme);

  // 11. Vignette & Cinematic Shadow
  drawVignette(theme);

  // 12. Minimap Radar
  drawMinimap();

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// 1. BIOME DRAWING
function drawBiome(theme) {
  if (theme === 'town') {
    // Cobblestone Paving
    ctx.fillStyle = '#1c1510';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 38) {
      for (let x = 0; x < W; x += 55) {
        const offset = (y % 76) ? 24 : 0;
        const n = seeded(x * 5 + y * 7);
        ctx.fillStyle = ['#2e2219', '#241a13', '#1e1610', '#34261c'][Math.floor(n * 4)];
        ctx.beginPath();
        ctx.rect(x + offset + 2, y + 2, 51, 34);
        ctx.fill();
        ctx.strokeStyle = '#120d09';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  } else if (theme === 'forest') {
    // Dark Mossy Soil with Earth Patches
    ctx.fillStyle = '#0f160e';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 40) {
      for (let x = 0; x < W; x += 60) {
        const n = seeded(x * 4 + y * 9);
        ctx.fillStyle = ['#152014', '#111b10', '#1c281b', '#181f12'][Math.floor(n * 4)];
        ctx.fillRect(x, y, 60, 40);
        if (n > 0.6) {
          ctx.fillStyle = '#263a23';
          ctx.fillRect(x + 10, y + 10, 8, 4);
        }
      }
    }
  } else if (theme === 'catacombs') {
    // Dark Stone Labyrinth Tiles
    ctx.fillStyle = '#0d0d10';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 42) {
      for (let x = 0; x < W; x += 65) {
        const n = seeded(x * 3 + y * 8);
        ctx.fillStyle = ['#1d1c22', '#151419', '#24222a', '#18171f'][Math.floor(n * 4)];
        ctx.fillRect(x + 2, y + 2, 61, 38);
        ctx.strokeStyle = '#08080a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, 61, 38);
      }
    }
  } else if (theme === 'desert') {
    // Crimson & Golden Sand Dunes
    ctx.fillStyle = '#2a1a0f';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 40) {
      for (let x = 0; x < W; x += 60) {
        const n = seeded(x * 6 + y * 5);
        ctx.fillStyle = ['#3f2615', '#331e10', '#4a2c18', '#2b190d'][Math.floor(n * 4)];
        ctx.fillRect(x, y, 60, 40);
      }
    }
  } else if (theme === 'inferno') {
    // Demonic Obsidian & Molten Lava Rivers
    ctx.fillStyle = '#160806';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 45) {
      for (let x = 0; x < W; x += 65) {
        const n = seeded(x * 7 + y * 6);
        ctx.fillStyle = ['#230d0a', '#1a0907', '#2a100c', '#150705'][Math.floor(n * 4)];
        ctx.fillRect(x + 2, y + 2, 61, 41);
        ctx.strokeStyle = '#38120b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, 61, 41);
      }
    }

    // Molten Lava River
    ctx.beginPath();
    ctx.moveTo(380, 0);
    ctx.bezierCurveTo(460, 160, 410, 380, 490, H);
    ctx.lineWidth = 42;
    ctx.strokeStyle = '#d63b11';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(380, 0);
    ctx.bezierCurveTo(460, 160, 410, 380, 490, H);
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#f59f23';
    ctx.stroke();
  }
}

// 2. PROPS DRAWING
function drawProps(theme) {
  if (theme === 'town') {
    // Center Fountain
    const fx = 450, fy = 280;
    ctx.fillStyle = '#110c08';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 45, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#856238';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Water ripple
    const wave = (Math.sin(animTime * 3) + 1) * 6;
    ctx.fillStyle = '#246b8f';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 32 + wave, 18 + wave * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Center Angel/Warrior Statue
    ctx.fillStyle = '#bfa57c';
    ctx.fillRect(fx - 6, fy - 36, 12, 28);
    ctx.beginPath();
    ctx.arc(fx, fy - 40, 7, 0, Math.PI * 2);
    ctx.fill();

    // Corner Stone Guard Towers / Pillars
    for (const [x, y] of [[70, 70], [830, 70], [70, 490], [830, 490]]) {
      ctx.fillStyle = '#402e1d';
      ctx.fillRect(x - 18, y - 24, 36, 42);
      ctx.fillStyle = '#6e5134';
      ctx.fillRect(x - 22, y - 28, 44, 8);
      ctx.fillStyle = '#22170e';
      ctx.fillRect(x - 8, y - 10, 16, 26);
    }
  } else if (theme === 'forest') {
    // Ancient Twisted Trees
    for (const [x, y] of [[150, 120], [750, 130], [200, 460], [780, 460]]) {
      ctx.fillStyle = '#080c07';
      ctx.beginPath();
      ctx.ellipse(x, y + 15, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#302013';
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 14);
      ctx.lineTo(x + 14, y + 14);
      ctx.lineTo(x + 8, y - 40);
      ctx.lineTo(x - 8, y - 40);
      ctx.fill();

      // Foliage
      ctx.fillStyle = '#163319';
      ctx.beginPath();
      ctx.arc(x, y - 55, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme === 'catacombs') {
    // Sarcophagi & Skull Piles
    for (const [x, y] of [[180, 100], [720, 460], [450, 300]]) {
      ctx.fillStyle = '#07070a';
      ctx.fillRect(x - 22, y - 12, 44, 28);
      ctx.fillStyle = '#474653';
      ctx.fillRect(x - 20, y - 14, 40, 24);
      ctx.strokeStyle = '#6f6c82';
      ctx.strokeRect(x - 20, y - 14, 40, 24);
    }
  } else if (theme === 'desert') {
    // Colossal Dragon / Beast Rib Cages
    for (const [x, y] of [[180, 420], [720, 140]]) {
      ctx.strokeStyle = '#c9bca0';
      ctx.lineWidth = 4;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(x + i * 16, y, 22, Math.PI, 0);
        ctx.stroke();
      }
    }
  } else if (theme === 'inferno') {
    // Demon Horns & Pentagram Runes
    const cx = 640, cy = 280;
    ctx.strokeStyle = '#e7451955';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Torches with Dynamic Glow
  const torchCoords = [[40, 180], [860, 180], [40, 380], [860, 380]];
  for (const [tx, ty] of torchCoords) {
    const flicker = Math.sin(animTime * 10 + tx) * 6;
    const glow = ctx.createRadialGradient(tx, ty, 2, tx, ty, 65 + flicker);
    glow.addColorStop(0, '#f0782499');
    glow.addColorStop(1, '#f0782400');
    ctx.fillStyle = glow;
    ctx.fillRect(tx - 70, ty - 70, 140, 140);

    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(tx - 3, ty, 6, 16);
    ctx.fillStyle = '#ffbe42';
    ctx.beginPath();
    ctx.arc(tx, ty - 5, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 3. PORTALS DRAWING
function drawPortals() {
  const portals = worldState.mapDef?.portals || [];
  portals.forEach(p => {
    const x = p.x, y = p.y;
    const rot = animTime * 2.5;

    // Glowing aura
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 48);
    glow.addColorStop(0, '#38a8e8cc');
    glow.addColorStop(0.6, '#6f42c166');
    glow.addColorStop(1, '#0000');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 50, y - 50, 100, 100);

    // Swirling rings
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#5ad8f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(-rot * 2);
    ctx.strokeStyle = '#c772f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Portal Label Tag
    ctx.fillStyle = '#080b12ee';
    ctx.strokeStyle = '#38a8e8';
    ctx.lineWidth = 1;
    const txt = p.label;
    ctx.font = 'bold 11px Cinzel, sans-serif';
    const tw = ctx.measureText(txt).width;
    ctx.fillRect(x - tw / 2 - 6, y - 38, tw + 12, 18);
    ctx.strokeRect(x - tw / 2 - 6, y - 38, tw + 12, 18);
    ctx.fillStyle = '#7de2fc';
    ctx.textAlign = 'center';
    ctx.fillText(txt, x, y - 25);
  });
}

// 4. SHRINES DRAWING
function drawShrines() {
  const shrines = worldState.mapDef?.shrines || [];
  shrines.forEach(s => {
    const x = s.x, y = s.y;
    const pulse = Math.sin(animTime * 3) * 4;

    // Holy glow
    const glow = ctx.createRadialGradient(x, y, 3, x, y, 38 + pulse);
    glow.addColorStop(0, '#52c41acc');
    glow.addColorStop(1, '#0000');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 45, y - 45, 90, 90);

    // Stone Font
    ctx.fillStyle = '#35452f';
    ctx.fillRect(x - 14, y - 10, 28, 22);
    ctx.fillStyle = '#73d13d';
    ctx.beginPath();
    ctx.arc(x, y - 8, 9, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.font = 'bold 10px Cinzel, sans-serif';
    ctx.fillStyle = '#a0d911';
    ctx.textAlign = 'center';
    ctx.fillText(s.name, x, y - 22);
  });
}

// 5. CHESTS DRAWING
function drawChests() {
  const chests = worldState.chests || [];
  chests.forEach(c => {
    const x = c.x, y = c.y;
    ctx.fillStyle = '#090705';
    ctx.fillRect(x - 16, y - 10, 32, 22);

    if (c.opened) {
      ctx.fillStyle = '#5c4832';
      ctx.fillRect(x - 14, y - 6, 28, 16);
      ctx.strokeStyle = '#382b1c';
      ctx.strokeRect(x - 14, y - 6, 28, 16);
    } else {
      // Golden Chest
      ctx.fillStyle = '#a67c2e';
      ctx.fillRect(x - 14, y - 10, 28, 18);
      ctx.fillStyle = '#e5b955';
      ctx.fillRect(x - 14, y - 6, 28, 5);
      ctx.fillStyle = '#20160b';
      ctx.fillRect(x - 3, y - 4, 6, 6);

      // Sparkle
      const sp = Math.sin(animTime * 6) * 3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6 + sp, y - 12, 2, 2);
    }
  });
}

// 6. MONSTERS DRAWING
function drawMobs() {
  const mobs = worldState.mobs || [];
  mobs.forEach(m => {
    if (m.hp <= 0) return; // Dead, waiting respawn

    const x = m.x, y = m.y;
    const isBoss = m.isBoss;
    const bob = Math.sin(animTime * 4 + x) * 2;

    // Shadow
    ctx.fillStyle = '#00000099';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, isBoss ? 28 : 16, isBoss ? 12 : 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura for Boss
    if (isBoss) {
      const bossAura = ctx.createRadialGradient(x, y, 5, x, y, 65);
      bossAura.addColorStop(0, '#e7451977');
      bossAura.addColorStop(1, '#0000');
      ctx.fillStyle = bossAura;
      ctx.fillRect(x - 65, y - 65, 130, 130);
    }

    // Mob Body
    const type = m.type || '';
    if (type === 'dummy') {
      ctx.fillStyle = '#8c6843';
      ctx.fillRect(x - 8, y - 24 + bob, 16, 26);
      ctx.fillStyle = '#deb887';
      ctx.beginPath();
      ctx.arc(x, y - 28 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (type.includes('wolf')) {
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(x - 16, y - 12 + bob, 32, 16);
      ctx.fillStyle = '#ff4d4f';
      ctx.fillRect(x + 8, y - 10 + bob, 3, 3);
    } else if (type.includes('goblin')) {
      ctx.fillStyle = '#38702b';
      ctx.fillRect(x - 10, y - 20 + bob, 20, 22);
      ctx.fillStyle = '#599c43';
      ctx.beginPath();
      ctx.arc(x, y - 24 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (type.includes('skeleton')) {
      ctx.fillStyle = '#d9d9d9';
      ctx.fillRect(x - 6, y - 22 + bob, 12, 22);
      ctx.beginPath();
      ctx.arc(x, y - 26 + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 10 + bob);
      ctx.lineTo(x + 14, y - 24 + bob);
      ctx.stroke();
    } else if (type.includes('boss')) {
      // GIANT DEMON LORD (AZAZEL)
      ctx.fillStyle = '#7a1912';
      ctx.beginPath();
      ctx.moveTo(x - 22, y - 36 + bob);
      ctx.lineTo(x + 22, y - 36 + bob);
      ctx.lineTo(x + 26, y + 8 + bob);
      ctx.lineTo(x - 26, y + 8 + bob);
      ctx.closePath();
      ctx.fill();

      // Demon Head & Horns
      ctx.fillStyle = '#4a0d08';
      ctx.beginPath();
      ctx.arc(x, y - 42 + bob, 16, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Red Eyes
      ctx.fillStyle = '#ffe58f';
      ctx.fillRect(x - 6, y - 44 + bob, 4, 4);
      ctx.fillRect(x + 2, y - 44 + bob, 4, 4);

      // Horns
      ctx.strokeStyle = '#e74519';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 48 + bob);
      ctx.lineTo(x - 24, y - 65 + bob);
      ctx.moveTo(x + 12, y - 48 + bob);
      ctx.lineTo(x + 24, y - 65 + bob);
      ctx.stroke();
    } else {
      // Default Monster Figure
      ctx.fillStyle = '#542618';
      ctx.fillRect(x - 12, y - 22 + bob, 24, 24);
      ctx.fillStyle = '#873822';
      ctx.beginPath();
      ctx.arc(x, y - 26 + bob, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP Bar above Mob
    const hpPct = Math.max(0, m.hp / m.maxHp);
    const bw = isBoss ? 70 : 42;
    const bh = isBoss ? 6 : 4;
    const bx = x - bw / 2;
    const by = y - (isBoss ? 72 : 44) + bob;

    ctx.fillStyle = '#0a0a0d';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = isBoss ? '#f5222d' : '#e8453c';
    ctx.fillRect(bx, by, bw * hpPct, bh);

    // Mob Name Tag
    ctx.font = `bold ${isBoss ? '12px' : '10px'} Cinzel, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isBoss ? '#ffd666' : '#f0f0f0';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${m.name} Lv.${m.level}`, x, by - 4);
    ctx.shadowBlur = 0;
  });
}

// 7. PLAYERS & ACTIVE COMPANIONS
function drawPlayers() {
  const players = worldState.players || [];
  players.forEach(p => {
    const isOwn = (p.name === me?.name);
    const x = isOwn ? (me.x || 450) : (p.x || 450);
    const y = isOwn ? (me.y || 280) : (p.y || 280);
    const bob = Math.sin(animTime * 6) * 1.5;

    // Ground Shadow
    ctx.fillStyle = '#000000aa';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Own Player Selection Circle
    if (isOwn) {
      ctx.strokeStyle = '#e2b354';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 22, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Adventurer Cloak
    const cloakCol = isOwn ? '#9c281e' : '#2b4d6b';
    ctx.fillStyle = cloakCol;
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 8 + bob);
    ctx.lineTo(x + 11, y - 8 + bob);
    ctx.lineTo(x + 14, y + 10 + bob);
    ctx.lineTo(x, y + 16 + bob);
    ctx.lineTo(x - 14, y + 10 + bob);
    ctx.closePath();
    ctx.fill();

    // Armor Chestplate
    ctx.fillStyle = '#cca774';
    ctx.fillRect(x - 6, y - 10 + bob, 12, 12);

    // Head & Helmet
    ctx.fillStyle = '#2d1e13';
    ctx.beginPath();
    ctx.arc(x, y - 15 + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Weapon
    ctx.strokeStyle = '#f5e4b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 4 + bob);
    ctx.lineTo(x + 18, y - 20 + bob);
    ctx.stroke();

    // Player HP Bar
    const hpPct = Math.max(0, p.hp / (p.maxHp || 100));
    ctx.fillStyle = '#0a0a0d';
    ctx.fillRect(x - 20, y - 42, 40, 4);
    ctx.fillStyle = isOwn ? '#52c41a' : '#1890ff';
    ctx.fillRect(x - 19, y - 41, 38 * hpPct, 2);

    // Name Tag
    ctx.font = 'bold 11px Georgia, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isOwn ? '#f7d282' : '#d9d0be';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.fillText(`${p.name} · Lv.${p.level}`, x, y - 46);
    ctx.shadowBlur = 0;

    // ACTIVE COMPANION PET (Floating beside player)
    if (p.activeCompanion) {
      const comp = p.activeCompanion;
      const petX = x + 26;
      const petY = y - 14 + Math.sin(animTime * 4) * 5;

      // Glow circle
      const petGlow = ctx.createRadialGradient(petX, petY, 1, petX, petY, 18);
      petGlow.addColorStop(0, '#ffd59188');
      petGlow.addColorStop(1, '#0000');
      ctx.fillStyle = petGlow;
      ctx.beginPath();
      ctx.arc(petX, petY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Pet Emoji
      ctx.font = '16px sans-serif';
      ctx.fillText(comp[1] || '🛡️', petX, petY + 6);
    }
  });
}

// 8. SPELL FX
function drawSpellFx() {
  for (let i = spellFx.length - 1; i >= 0; i--) {
    const fx = spellFx[i];
    fx.frame++;
    const progress = fx.frame / fx.maxFrame;

    if (fx.type === 'slash') {
      ctx.strokeStyle = `rgba(255, 230, 160, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 14 + progress * 24, -Math.PI * 0.4, Math.PI * 0.6);
      ctx.stroke();
    } else if (fx.type === 'fireball') {
      const rad = 10 + progress * 30;
      const g = ctx.createRadialGradient(fx.x, fx.y, 2, fx.x, fx.y, rad);
      g.addColorStop(0, `rgba(255, 220, 80, ${1 - progress})`);
      g.addColorStop(0.5, `rgba(235, 75, 20, ${0.8 - progress * 0.8})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, rad, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.type === 'whirlwind') {
      ctx.strokeStyle = `rgba(180, 50, 40, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 20 + progress * 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (fx.frame >= fx.maxFrame) spellFx.splice(i, 1);
  }
}

// 9. FLOATING NUMBERS
function drawFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y += f.vy;
    f.life++;
    f.alpha = 1 - f.life / f.maxLife;

    ctx.save();
    ctx.globalAlpha = Math.max(0, f.alpha);
    ctx.fillStyle = f.color;
    ctx.font = f.isLarge ? 'bold 15px Cinzel, sans-serif' : 'bold 12px Roboto Condensed, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();

    if (f.life >= f.maxLife) floaters.splice(i, 1);
  }
}

// 10. WEATHER PARTICLES
function drawWeather(theme) {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H;
    if (p.y > H) p.y = 0;

    if (theme === 'forest') {
      // Green / Golden Fireflies
      ctx.fillStyle = `rgba(160, 240, 100, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'inferno') {
      // Fiery Embers
      ctx.fillStyle = `rgba(255, 120, 30, ${p.alpha})`;
      ctx.fillRect(p.x, p.y, p.size * 1.5, p.size * 1.5);
    } else if (theme === 'desert') {
      // Drifting Sand Dust
      ctx.fillStyle = `rgba(220, 180, 120, ${p.alpha * 0.4})`;
      ctx.fillRect(p.x, p.y, p.size * 2, p.size);
    } else {
      // Subtle Dust Motes
      ctx.fillStyle = `rgba(220, 200, 170, ${p.alpha * 0.25})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  });
}

// 11. VIGNETTE
function drawVignette(theme) {
  const vig = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 540);
  vig.addColorStop(0, '#0000');
  vig.addColorStop(1, theme === 'inferno' ? '#2b0905cc' : '#000000d9');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// 12. MINIMAP RADAR
function drawMinimap() {
  const mw = 130, mh = 80;
  const mx = W - mw - 14, my = 14;

  ctx.fillStyle = '#0c0805cc';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#856238';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx, my, mw, mh);

  const sx = mw / W;
  const sy = mh / H;

  // Portals on radar
  (worldState.mapDef?.portals || []).forEach(p => {
    ctx.fillStyle = '#38a8e8';
    ctx.fillRect(mx + p.x * sx - 2, my + p.y * sy - 2, 4, 4);
  });

  // Mobs on radar
  (worldState.mobs || []).forEach(m => {
    if (m.hp > 0) {
      ctx.fillStyle = m.isBoss ? '#faad14' : '#ff4d4f';
      ctx.fillRect(mx + m.x * sx - 1.5, my + m.y * sy - 1.5, 3, 3);
    }
  });

  // Players on radar
  (worldState.players || []).forEach(p => {
    const isOwn = (p.name === me?.name);
    ctx.fillStyle = isOwn ? '#52c41a' : '#1890ff';
    ctx.beginPath();
    ctx.arc(mx + (p.x || 450) * sx, my + (p.y || 280) * sy, isOwn ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// CANVAS CLICK INTERACTION
canvas.onclick = e => {
  const r = canvas.getBoundingClientRect();
  const clickX = (e.clientX - r.left) * (W / r.width);
  const clickY = (e.clientY - r.top) * (H / r.height);

  // 1. Check Click on Mob (Attack)
  const clickedMob = (worldState.mobs || []).find(m => {
    if (m.hp <= 0) return false;
    const hitRadius = m.isBoss ? 45 : 28;
    const dx = clickX - m.x;
    const dy = clickY - m.y;
    return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
  });

  if (clickedMob) {
    socket?.emit('attack_mob', { mobId: clickedMob.id, skill: selectedSkill });
    return;
  }

  // 2. Check Click on Portal
  const clickedPortal = (worldState.mapDef?.portals || []).find(p => {
    const dx = clickX - p.x;
    const dy = clickY - p.y;
    return Math.sqrt(dx * dx + dy * dy) <= 35;
  });

  if (clickedPortal) {
    socket?.emit('change_map', {
      targetMap: clickedPortal.target,
      spawnX: clickedPortal.spawnX,
      spawnY: clickedPortal.spawnY
    });
    Sound.portal();
    return;
  }

  // 3. Check Click on Chest
  const clickedChest = (worldState.chests || []).find(c => {
    if (c.opened) return false;
    const dx = clickX - c.x;
    const dy = clickY - c.y;
    return Math.sqrt(dx * dx + dy * dy) <= 30;
  });

  if (clickedChest) {
    socket?.emit('open_world_chest', { chestId: clickedChest.id });
    return;
  }

  // 4. Check Click on Shrine
  const clickedShrine = (worldState.mapDef?.shrines || []).find(s => {
    const dx = clickX - s.x;
    const dy = clickY - s.y;
    return Math.sqrt(dx * dx + dy * dy) <= 35;
  });

  if (clickedShrine) {
    socket?.emit('use_shrine', { shrineId: clickedShrine.id });
    return;
  }

  // 5. Otherwise: Move player
  if (me) {
    me.x = clickX;
    me.y = clickY;
  }
  socket?.emit('move', { x: clickX, y: clickY });
};

// AUTO-RESUME SESSION ON REFRESH
async function resume() {
  if (!token) return showAuth();
  try {
    const d = await api('/api/me');
    update(d.player);
    showGame();
    connect();
  } catch (e) {
    token = null;
    localStorage.removeItem('diyorbekToken');
    showAuth();
  }
}

resume();
