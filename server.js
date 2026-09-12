const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT) || 3000;
const rooms = new Map();

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/health', (_req, res) => res.status(200).type('text').send('OK - AUCTION GAME V26'));
app.get('/api/status', (_req, res) => res.json({ ok: true, game: 'auction', version: '26' }));
// Always serve the game for browser routes. Socket.IO and real files are handled above.
app.use((_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const ITEMS = [
  { name: 'صندوق غامض 🎁', desc: 'جائزة مجهولة... قد تكون كنزًا أو مفاجأة!' },
  { name: 'سيارة فاخرة 🚗', desc: 'من يدفع أكثر يحصل على السيارة الافتراضية.' },
  { name: 'مفتاح القصر 🏰', desc: 'مفتاح لقصر فاخر... هل يستحق المخاطرة؟' },
  { name: 'كنز القراصنة 💰', desc: 'كنز مليء بالنقاط، لكن سعره قد يكون مرتفعًا.' },
  { name: 'بطاقة المضاعفة ⚡', desc: 'تضاعف مكافأة الجائزة الخاصة في نهاية اللعبة.' },
  { name: 'الدرع 🛡️', desc: 'درع يحميك من أول سرقة.' },
  { name: 'صندوق الذهب 🪙', desc: 'جائزة ذهبية قوية ومحدودة.' },
  { name: 'القنبلة 💣', desc: 'جائزة مشاغبة... لا أحد يعرف نتيجتها.' },
  { name: 'تاج الملك 👑', desc: 'جائزة نادرة لصاحب أعلى مزايدة.' },
  { name: 'بوابة الحظ 🎲', desc: 'الحظ يقرر قيمة المكافأة.' },
  { name: 'السرقة الكبرى 🕵️', desc: 'قد تحصل على فرصة لقلب النتيجة.' },
  { name: 'صندوق الحظ 🍀', desc: 'مفاجأة عشوائية بالكامل.' }
];

function makeCode() {
  let code;
  do code = crypto.randomInt(0, 10000).toString().padStart(4, '0');
  while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || '').trim().replace(/[<>]/g, '');
  return n.slice(0, 18) || 'لاعب';
}

function publicState(room) {
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    totalRounds: room.totalRounds,
    item: room.item,
    bid: room.bid,
    bidder: room.bidder,
    endsAt: room.endsAt,
    message: room.message,
    winner: room.winner,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      balance: p.balance,
      connected: p.connected,
      shield: p.shield,
      double: p.double
    }))
  };
}

function broadcast(room) { io.to(room.code).emit('state', publicState(room)); }
function stopTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }

function createRoom() {
  return {
    code: makeCode(), phase: 'waiting', round: 0, totalRounds: 10,
    item: null, bid: 0, bidder: null, endsAt: 0,
    players: new Map(), winner: null, message: 'بانتظار لاعبين...', timer: null, nextTimer: null
  };
}

function startRound(room) {
  if (!rooms.has(room.code) || room.phase === 'finished') return;
  if (room.players.size < 2) { room.phase = 'waiting'; room.message = 'نحتاج لاعبين اثنين على الأقل.'; broadcast(room); return; }
  if (room.round >= room.totalRounds) { finishGame(room); return; }

  room.round += 1;
  room.item = ITEMS[crypto.randomInt(0, ITEMS.length)];
  room.bid = 0;
  room.bidder = null;
  room.winner = null;
  room.message = 'المزاد مفتوح!';
  room.phase = 'auction';
  room.endsAt = Date.now() + 15000;
  stopTimer(room);
  room.timer = setTimeout(() => finishRound(room), 15000);
  broadcast(room);
}

function finishRound(room) {
  if (!rooms.has(room.code) || room.phase !== 'auction') return;
  stopTimer(room);
  room.phase = 'result';
  if (room.bidder) {
    const player = room.players.get(room.bidder);
    if (player && room.bid <= player.balance) {
      player.balance -= room.bid;
      room.winner = { id: player.id, name: player.name, cost: room.bid };
      if (room.item.name.includes('المضاعفة')) player.double = true;
      if (room.item.name.includes('الدرع')) player.shield = true;
      room.message = `${player.name} فاز بالجائزة مقابل ${room.bid} نقطة!`;
    } else {
      room.winner = null;
      room.message = 'تعذر إتمام المزايدة.';
    }
  } else {
    room.message = 'انتهى الوقت ولم يزايد أحد.';
  }
  broadcast(room);
  room.nextTimer = setTimeout(() => startRound(room), 3500);
}

function finishGame(room) {
  stopTimer(room);
  if (room.nextTimer) clearTimeout(room.nextTimer);
  room.phase = 'finished'; room.endsAt = 0; room.item = null;
  const sorted = [...room.players.values()].sort((a,b) => b.balance - a.balance);
  room.winner = sorted[0] ? { id: sorted[0].id, name: sorted[0].name, cost: sorted[0].balance } : null;
  room.message = sorted[0] ? `البطل هو ${sorted[0].name}!` : 'انتهت اللعبة!';
  broadcast(room);
}

function normalizeCode(value) {
  const code = String(value || '').replace(/\D/g, '');
  return code.length === 4 ? code : null;
}

io.on('connection', socket => {
  socket.on('room:create', () => {
    const room = createRoom();
    rooms.set(room.code, room);
    socket.data.role = 'display'; socket.data.code = room.code;
    socket.join(room.code);
    socket.emit('room:created', { code: room.code });
    broadcast(room);
  });

  socket.on('room:watch', ({ code } = {}) => {
    const roomCode = normalizeCode(code);
    const room = roomCode && rooms.get(roomCode);
    if (!room) return socket.emit('errorMsg', 'رمز الغرفة غير صحيح أو الغرفة غير موجودة.');
    socket.data.role = 'display'; socket.data.code = roomCode;
    socket.join(roomCode);
    socket.emit('room:created', { code: roomCode });
    socket.emit('state', publicState(room));
  });

  socket.on('room:join', ({ code, name } = {}) => {
    const roomCode = normalizeCode(code);
    const room = roomCode && rooms.get(roomCode);
    if (!room) return socket.emit('errorMsg', 'رمز الغرفة غير صحيح أو الغرفة غير موجودة.');
    if (room.phase === 'finished') return socket.emit('errorMsg', 'هذه اللعبة انتهت. أنشئ غرفة جديدة.');
    if (room.players.size >= 16) return socket.emit('errorMsg', 'الغرفة ممتلئة (16 لاعبًا).');

    const player = { id: socket.id, name: cleanName(name), balance: 1000, connected: true, shield: false, double: false };
    room.players.set(socket.id, player);
    socket.data.role = 'player'; socket.data.code = roomCode;
    socket.join(roomCode);
    socket.emit('joined', { id: socket.id, code: roomCode });
    broadcast(room);

    if (room.phase === 'waiting' && room.players.size >= 2) {
      setTimeout(() => { if (room.phase === 'waiting') startRound(room); }, 1200);
    }
  });

  socket.on('bid', ({ amount } = {}) => {
    const room = rooms.get(socket.data.code);
    const player = room?.players.get(socket.id);
    if (!room || socket.data.role !== 'player' || room.phase !== 'auction' || !player) return;
    const amountNum = Math.floor(Number(amount));
    if (!Number.isFinite(amountNum) || amountNum <= room.bid || amountNum > player.balance) {
      return socket.emit('errorMsg', `لازم تكون المزايدة أعلى من ${room.bid} وضمن رصيدك (${player.balance}).`);
    }
    room.bid = amountNum; room.bidder = socket.id;
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) player.connected = false;
    broadcast(room);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Auction game V26 listening on ${PORT}`));
