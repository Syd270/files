const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// --- Game state ---
// state.mode is one of: 'playing' | 'paused' | 'levelup' | 'gameover'
let player, enemies, bullets, gems, state;

function reset() {
  player = {
    x: W / 2,
    y: H / 2,
    radius: 12,
    speed: 220,
    fireInterval: 0.6,
    damage: 1,
    bulletSpeed: 450,
    projectiles: 1,
    pickupRange: 70,
    fireTimer: 0,
  };
  enemies = [];
  bullets = [];
  gems = [];
  state = {
    mode: 'playing',
    time: 0,
    spawnTimer: 0,
    kills: 0,
    xp: 0,
    xpToNext: 5,
    level: 1,
    choices: [],
  };
}
reset();

// --- Upgrades ---
const UPGRADES = [
  { name: 'Rapid Fire', desc: 'Shoot 20% faster', apply: () => { player.fireInterval = Math.max(0.1, player.fireInterval * 0.8); } },
  { name: 'Heavy Rounds', desc: '+1 bullet damage', apply: () => { player.damage += 1; } },
  { name: 'Multishot', desc: '+1 projectile per shot', apply: () => { player.projectiles += 1; } },
  { name: 'Swift Feet', desc: '+15% move speed', apply: () => { player.speed *= 1.15; } },
  { name: 'Velocity', desc: '+25% bullet speed', apply: () => { player.bulletSpeed *= 1.25; } },
  { name: 'Magnet', desc: '+50% pickup range', apply: () => { player.pickupRange *= 1.5; } },
];

function pickChoices() {
  const pool = [...UPGRADES];
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function levelUp() {
  state.xp -= state.xpToNext;
  state.level++;
  state.xpToNext = Math.floor(state.xpToNext * 1.4) + 2;
  state.choices = pickChoices();
  state.mode = 'levelup';
}

function chooseUpgrade(i) {
  const choice = state.choices[i];
  if (!choice) return;
  choice.apply();
  state.mode = 'playing';
  if (state.xp >= state.xpToNext) levelUp(); // handle back-to-back level ups
}

// --- Pause ---
function togglePause() {
  if (state.mode === 'playing') state.mode = 'paused';
  else if (state.mode === 'paused') state.mode = 'playing';
}

const pauseBtn = { x: W - 56, y: 16, w: 40, h: 40 };

function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function cardRect(i) {
  const w = 240, h = 160, gap = 30;
  const startX = (W - (3 * w + 2 * gap)) / 2;
  return { x: startX + i * (w + gap), y: H / 2 - 60, w, h };
}

// --- Input ---
const keys = {};
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.key.startsWith('Arrow')) e.preventDefault();

  if (k === 'p' || k === 'escape') togglePause();
  if (k === 'r' && state.mode === 'gameover') reset();
  if (state.mode === 'levelup' && ['1', '2', '3'].includes(k)) chooseUpgrade(Number(k) - 1);
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Auto-pause when the tab loses focus
window.addEventListener('blur', () => {
  if (state.mode === 'playing') state.mode = 'paused';
});

canvas.addEventListener('click', (e) => {
  // Convert from CSS pixels to canvas pixels (the canvas can be scaled down)
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) * W) / rect.width;
  const my = ((e.clientY - rect.top) * H) / rect.height;

  if ((state.mode === 'playing' || state.mode === 'paused') && inRect(mx, my, pauseBtn)) {
    togglePause();
  } else if (state.mode === 'paused') {
    togglePause();
  } else if (state.mode === 'levelup') {
    for (let i = 0; i < 3; i++) {
      if (inRect(mx, my, cardRect(i))) chooseUpgrade(i);
    }
  }
});

// --- Helpers ---
function circlesOverlap(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
}

function nearestEnemy() {
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

function spawnEnemy() {
  const margin = 20;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -margin; }
  else if (side === 1) { x = W + margin; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H + margin; }
  else { x = -margin; y = Math.random() * H; }

  enemies.push({
    x, y,
    radius: 10,
    speed: 60 + Math.random() * 40 + state.time * 0.5,
    hp: 1 + Math.floor(state.time / 40),
  });
}

// Fire `projectiles` bullets in a small fan centered on the target
function shootAt(target) {
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const spread = 0.18; // radians between bullets
  const n = player.projectiles;
  for (let i = 0; i < n; i++) {
    const angle = baseAngle + (i - (n - 1) / 2) * spread;
    bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * player.bulletSpeed,
      vy: Math.sin(angle) * player.bulletSpeed,
      radius: 4,
      damage: player.damage,
    });
  }
}

// --- Update ---
function update(dt) {
  if (state.mode !== 'playing') return;
  state.time += dt;

  // Player movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  const len = Math.hypot(dx, dy);
  if (len > 0) {
    player.x += (dx / len) * player.speed * dt;
    player.y += (dy / len) * player.speed * dt;
  }
  player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));

  // Spawning
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.25, 1.0 - state.time * 0.01);
  }

  // Auto-fire
  player.fireTimer -= dt;
  if (player.fireTimer <= 0) {
    const target = nearestEnemy();
    if (target) {
      shootAt(target);
      player.fireTimer = player.fireInterval;
    }
  }

  // Move bullets
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }

  // Move enemies, check player collision
  for (const e of enemies) {
    const ex = player.x - e.x;
    const ey = player.y - e.y;
    const d = Math.hypot(ex, ey) || 1;
    e.x += (ex / d) * e.speed * dt;
    e.y += (ey / d) * e.speed * dt;

    if (circlesOverlap(player, e)) state.mode = 'gameover';
  }

  // Bullet vs enemy collisions; dead enemies drop XP gems
  for (const b of bullets) {
    for (const e of enemies) {
      if (e.hp > 0 && !b.dead && circlesOverlap(b, e)) {
        e.hp -= b.damage;
        b.dead = true;
        if (e.hp <= 0) {
          state.kills++;
          gems.push({ x: e.x, y: e.y, radius: 5, value: 1 });
        }
      }
    }
  }

  // Gems: get pulled toward the player when in range, collected on touch
  for (const g of gems) {
    const gx = player.x - g.x;
    const gy = player.y - g.y;
    const d = Math.hypot(gx, gy) || 1;
    if (d < player.pickupRange) {
      g.x += (gx / d) * 350 * dt;
      g.y += (gy / d) * 350 * dt;
    }
    if (circlesOverlap(player, g)) {
      g.collected = true;
      state.xp += g.value;
    }
  }

  // Cleanup
  enemies = enemies.filter((e) => e.hp > 0);
  bullets = bullets.filter(
    (b) => !b.dead && b.x > -50 && b.x < W + 50 && b.y > -50 && b.y < H + 50
  );
  gems = gems.filter((g) => !g.collected);

  if (state.mode === 'playing' && state.xp >= state.xpToNext) levelUp();
}

// --- Draw ---
function drawOverlay(alpha) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function drawLevelUp() {
  drawOverlay(0.7);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(`Level ${state.level}!`, W / 2, H / 2 - 100);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Pick an upgrade (click or press 1, 2, 3)', W / 2, H / 2 - 68);

  state.choices.forEach((c, i) => {
    const r = cardRect(i);
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = '#4fc3f7';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 30);
    ctx.fillStyle = '#fff';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(c.name, r.x + r.w / 2, r.y + 80);
    ctx.fillStyle = '#bbb';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(c.desc, r.x + r.w / 2, r.y + 115);
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // XP gems
  ctx.fillStyle = '#81c784';
  for (const g of gems) {
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies
  ctx.fillStyle = '#e57373';
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bullets
  ctx.fillStyle = '#fff176';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // XP bar across the top
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, W, 8);
  ctx.fillStyle = '#81c784';
  ctx.fillRect(0, 0, W * Math.min(1, state.xp / state.xpToNext), 8);

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Level ${state.level}`, 16, 34);
  ctx.fillText(`Time: ${state.time.toFixed(1)}s`, 16, 58);
  ctx.fillText(`Kills: ${state.kills}`, 16, 82);

  // Pause button
  if (state.mode === 'playing' || state.mode === 'paused') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(pauseBtn.x, pauseBtn.y, pauseBtn.w, pauseBtn.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(pauseBtn.x + 11, pauseBtn.y + 10, 6, 20);
    ctx.fillRect(pauseBtn.x + 23, pauseBtn.y + 10, 6, 20);
  }

  if (state.mode === 'paused') {
    drawOverlay(0.6);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '48px system-ui, sans-serif';
    ctx.fillText('Paused', W / 2, H / 2);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Press P, Esc, or click to resume', W / 2, H / 2 + 36);
  }

  if (state.mode === 'levelup') drawLevelUp();

  if (state.mode === 'gameover') {
    drawOverlay(0.6);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '48px system-ui, sans-serif';
    ctx.fillText('Game Over', W / 2, H / 2 - 10);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(
      `Level ${state.level}, ${state.time.toFixed(1)}s, ${state.kills} kills. Press R to restart`,
      W / 2,
      H / 2 + 30
    );
  }
}

// --- Game loop ---
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);