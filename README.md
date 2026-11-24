# ⚔ DIYORBEK MMORPG — Dark Fantasy Diablo Edition

O'zbek tilidagi to'liq multiplayer Dark Fantasy / Diablo uslubidagi brauzer MMORPG o'yini. Real-time xaritalar, Socket.IO ko'p o'yinchili sinxronizatsiya, 5 ta keng qamrovli xarita (zone), real jang tizimi (skills & damage), maxluqlar, yovuz Bosslar, 100 xil qahramon kartasi kolleksiyasi, faol jangchi hamrohlar (companion pet), kvestlar, reyting va procedural Web Audio ovoz effektlari.

---

## 🌟 Asosiy Yangiliklar va Imkoniyatlar

### 🗺 1. Mukammal Xaritalar Tizimi (5 ta alohida Zone):
1. **Bosh Qal'a (Oromgoh / Sanctuary Hub) — Tinch hudud (Lv.1+)**:
   - Qahramonlar boshpanasi, toshli ko'chalar, markaziy hayot favvorasi va mashq manekeni.
   - Portal orqali xavfli hududlarga o'tish imkoniyati.
2. **Qorong'i O'rmon (Whispering Woods) — Xavfli hudud (Lv.1–5)**:
   - Qadimiy ulkan daraxtlar, moxli zamin, porlovchi qo'ziqorinlar va xilvat burchaklar.
   - Maxluqlar: *Qora Bo'ri (Lv.2)*, *O'rmon Goblini (Lv.3)*, *Goblin Kamonchisi (Lv.4)*, *Yirtqich Ayiq (Lv.5)*.
   - Xazina sandig'i va Shifo chashmasi.
3. **Qadimiy Katakomba (Ancient Catacombs) — Xavfli hudud (Lv.5–10)**:
   - Tosh labirintlar, sarkofaglar, suyak uyumlari va qorong'u ritsarlar.
   - Maxluqlar: *Skelet Jangchi (Lv.6)*, *Skelet Nayzaboz (Lv.7)*, *Qorong'u Arvoh (Lv.8)*, *Zombi Ritsar (Lv.10)*.
4. **Qonli Sahro (Crimson Desert) — Xavfli hudud (Lv.10–16)**:
   - Qizil qum barxanlari, ajdarho qovurg'alari va jazirama chang to'zonlari.
   - Maxluqlar: *Zaharli Qum Chayoni (Lv.12)*, *Cho'l Yirtqichi (Lv.14)*, *Olov Jini - Ifrit (Lv.16)*.
5. **Do'zax Qasri (Infernal Citadel / Boss Lair) — Bosh Boss (Lv.15–25)**:
   - Obsidiyan toshlar, qaynoq oqayotgan lava daryolari, iblis shoxlari va yonayotgan mash'alalar.
   - Maxluqlar: *Do'zax Qorovuli (Lv.18)*, *Iblis Qotili (Lv.20)* va olamning eng qudratli Bosh Bossi — **LORD AZAZEL (Lv.25 Boss, 8000 HP)**!

---

### ⚔ 2. Haqiqiy Jang va Ko'nikmalar (Combat System):
- **[Q] ⚔ Qilich Zarbasi**: Oddiy va tezkor hujum (0 MP, 100% hujum kuchi).
- **[W] 🔥 Olovli To'p**: Kuchli masofaviy sehr (15 MP, 160% hujum kuchi).
- **[E] 🌀 Qonli Girdob**: Katta zarbali kuchli ko'nikma (25 MP, 220% hujum kuchi).
- **[R] ✨ Shifo Chashmasi**: Xaritadagi hayot bulog'iga yaqinlashib, Salomatlik (HP) va Sehr kuchini (MP) 100% to'liq tiklash.
- **Kritik zarbalar (Critical Hits)**: Tilsim (Amulet) darajasiga qarab 1.8x yuqori zarar.
- **Suzuvchi raqamlar (Floating Damage Text)**: Har bir zarba ekranda oq, qizil va oltin ranglarda ko'rinadi.

---

### 🃏 3. 100 xil Karta va Faol Jangchi Hamroh (Companion Pet):
- 100 ta original fantaziya qahramoni (Sherlok Xolms, Robin Gud, Qirol Artur, Drakula, Merlin, Ajdarho Sohibi va boshqalar).
- **Faol Hamroh tizimi**: O'zingiz yoqtirgan kartani "Faol Hamroh" etib tayinlang! Hamrohingiz xaritada qahramoningiz yonida suzib yuradi va umumiy hujum kuchingizga **+10% dan +75% gacha bonus** beradi!
- **Nusxa kartalarni sotish**: Bir nechta nusxadagi kartalarni tangaga sotib, qurollaringizni kuchaytirish mumkin.

---

### 📜 4. Kvestlar va Kuchlilar Reytingi:
- **Qahramon kvestlari**: O'rmonni o'rganish, maxluqlarni yengish, xazina sandiqlarini ochish, qurolni charxlash va Lord Azazelni mag'lub etish.
- Mukofotlar: minglab oltin tangalar, katta XP va maxsus unvonlar!
- **Top Reyting jadvali**: Daraja, o'ldirilgan maxluqlar, yengilgan Bosslar va to'plangan boylik bo'yicha saralangan o'yinchilar ro'yxati.

---

### 🔊 5. Ovoz va Vizual Effektlar:
- Web Audio API orqali procedural retro RPG tovushlari: qilich zarbalari, olovli to'plar, tanga jaranglashi, daraja oshishi fanfarasi, portaldan o'tish tovushi.
- Dinamik atmosfera zarrachalari: o'rmonda miltillovchi yorug'lik qo'ng'izlari (fireflies), sahroda chang to'zoni, do'zaxda uchuvchi olov cho'g'lari va mash'ala yorug'liklari.
- Kichik radar (Minimap) yuqori o'ng burchakda o'yinchi, maxluqlar va portallarni ko'rsatib turadi.

---

## 🚀 Ishga Tushirish Qo'llanmasi

### Talablar:
- [Node.js](https://nodejs.org/) (v18 yoki undan yuqori)
- NPM yoki PNPM

### 1. Bog'liqliklarni o'rnatish:
```bash
npm install
```

### 2. O'yinni ishga tushirish:
```bash
npm start
```
Yoki dasturchi rejimida:
```bash
npm run dev
```

### 3. Brauzerda ochish:
Brauzeringizda quyidagi manzilni oching:
```
http://localhost:3000
```

---

## 🎁 Promokod

O'yinga kirgach, Promokod bo'limiga:
```
DIYORBEK
```
so'zini kiriting va **100 ta qahramon kartasi hamda +1000 bepul tanga**ga ega bo'ling!

---

## 🌐 Internetga Joylash (Deployment)

Loyiha **Vercel**, **Render**, **Railway** va **VPS** serverlariga 100% moslashtirilgan:

### ▲ Vercel orqali ishga tushirish (Tavsiya etiladi):
Loyiha tarkibida `vercel.json` va `api/index.js` serverless funksiyasi sozlangan.
1. [Vercel.com](https://vercel.com) saytiga kiring va GitHub akkauntingizni ulang.
2. `real-2` repozitoriyasini tanlang va **Deploy** tugmasini bosing!
3. Vercel loyihani avtomatik aniqlaydi va bir necha soniyada bepul domen (`https://real-2.vercel.app`) beradi.
*Eslatma: Vercel serverless arxitekturasida barcha xaritalar, do'kon, kvestlar, janglar va reyting REST Serverless API orqali uzluksiz ishlaydi.*

### 🟣 Render.com / Railway.app (Doimiy WebSocket rejim):
- **Render.com**: Web Service yarating, Build Command: `npm install`, Start Command: `npm start`. Persistent disk ulab `data/` papkasini saqlash tavsiya etiladi.
- **Railway.app**: Repozitoriyani to'g'ridan-to'g'ri ulang va WebSocket qo'llab-quvvatlash bilan ishga tushiring.

### 🖥 VPS (Ubuntu/Debian):
```bash
pm2 start server.js --name "diyorbek-rpg"
```

---

## 🛡 Litsenziya va Mualliflik

Loyiha: **DIYORBEK ONLINE MMORPG**  
Repozitoriya: [https://github.com/d3000871-ui/real-2](https://github.com/d3000871-ui/real-2)
