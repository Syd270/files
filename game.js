const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// --- Tunables ---
const GEM_LIFETIME = 10; // seconds before an uncollected XP gem vanishes
const BOSS_EVERY = 4;    // a dragon shows up at level 4, 8, 12, etc

// --- High score (saved in the browser) ---
const BEST_KEY = 'survivor-best-time';

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* ignore */
  }
}

let best = loadBest();

// --- Game state ---
// state.mode: 'menu' | 'playing' | 'paused' | 'levelup' | 'gameover'
let player, enemies, bullets, gems, particles, fireballs, shockwaves, state;

function reset(mode = 'playing') {
  player = {
    x: W / 2,
    y: H / 2,
    radius: 13,
    speed: 220,
    fireInterval: 0.6,
    damage: 1,
    bulletSpeed: 450,
    projectiles: 1,
    pickupRange: 70,
    fireTimer: 0,
    facingRight: true,
    moving: false,
    walk: 0,
    invuln: 0, // seconds of invulnerability left
  };
  enemies = [];
  bullets = [];
  gems = [];
  particles = [];
  fireballs = [];
  shockwaves = [];
  state = {
    mode,
    time: 0,
    spawnTimer: 0,
    kills: 0,
    xp: 0,
    xpToNext: 5,
    level: 1,
    choices: [],
    newBest: false,
    nextBossLevel: BOSS_EVERY,
    bosses: 0,
    alert: 0,
    levelPending: 0, // > 0 while the 'LEVEL UP!' slow-motion plays
    menuAge: 0,      // seconds the upgrade menu has been open
  };
}
reset('menu');

function endGame() {
  if (state.mode === 'gameover') return;
  state.mode = 'gameover';
  state.newBest = state.time > best;
  if (state.newBest) {
    best = state.time;
    saveBest(best);
  }
}

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
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

const SHOCK_RADIUS = 520;
const SLOWMO_TIME = 0.6; // real seconds of slow-motion before the menu opens

function startLevelUp() {
  state.xp -= state.xpToNext;
  state.level++;
  state.xpToNext = Math.floor(state.xpToNext * 1.4) + 2;
  state.choices = pickChoices();
  state.levelPending = SLOWMO_TIME;
  player.invuln = 2;
  applyShockwave();

  if (state.level >= state.nextBossLevel) {
    spawnDragon();
    state.nextBossLevel += BOSS_EVERY;
  }
}

function openLevelMenu() {
  state.levelPending = 0;
  state.mode = 'levelup';
  state.menuAge = 0;
}

// Level-ups push nearby skeletons away and stun them, so you're never stuck in a crowd
function applyShockwave() {
  shockwaves.push({ x: player.x, y: player.y, t: 0 });
  burst(player.x, player.y, '#fff176', 24);
  for (const e of enemies) {
    if (e.boss) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < SHOCK_RADIUS) {
      const push = 900 * (1 - (d / SHOCK_RADIUS) * 0.5); // closer = stronger
      e.kx = (dx / d) * push;
      e.ky = (dy / d) * push;
      e.stun = 1.2;
    }
  }
  fireballs = fireballs.filter(
    (f) => Math.hypot(f.x - player.x, f.y - player.y) > SHOCK_RADIUS
  );
}

function chooseUpgrade(i) {
  if (state.menuAge < 0.3) return; // ignore accidental clicks while the menu fades in
  const choice = state.choices[i];
  if (!choice) return;
  choice.apply();
  state.mode = 'playing';
  player.invuln = 2; // grace period after resuming
  if (state.xp >= state.xpToNext) startLevelUp();
}

// --- Pause / start ---
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
  if (e.key.startsWith('Arrow') || k === ' ') e.preventDefault();

  if (state.mode === 'menu' && (k === 'enter' || k === ' ')) reset('playing');
  else if (state.mode === 'gameover' && (k === 'r' || k === 'enter')) reset('playing');
  else if (k === 'p' || k === 'escape') togglePause();
  else if (state.mode === 'levelup' && ['1', '2', '3'].includes(k)) chooseUpgrade(Number(k) - 1);
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener('blur', () => {
  if (state.mode === 'playing') state.mode = 'paused';
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) * W) / rect.width;
  const my = ((e.clientY - rect.top) * H) / rect.height;

  if (state.mode === 'menu') {
    reset('playing');
  } else if (state.mode === 'gameover') {
    reset('playing');
  } else if ((state.mode === 'playing' || state.mode === 'paused') && inRect(mx, my, pauseBtn)) {
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

// Auto-aim: a dragon within range takes priority, otherwise the nearest enemy
function pickTarget() {
  let closest = null;
  let closestDist = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (e.boss && d < 500) return e;
    if (d < closestDist) {
      closestDist = d;
      closest = e;
    }
  }
  return closest;
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
    radius: 11,
    speed: 60 + Math.random() * 40 + state.time * 0.5,
    hp: 1 + Math.floor(state.time / 40),
    flash: 0,
    facingRight: true,
    boss: false,
    stun: 0,
    kx: 0,
    ky: 0,
  });
}

function spawnDragon() {
  const fromLeft = player.x > W / 2; // enter from the side away from the player
  const hp = 60 + 30 * state.bosses;
  enemies.push({
    x: fromLeft ? -70 : W + 70,
    y: 130,
    radius: 34,
    speed: 55,
    hp,
    maxHp: hp,
    flash: 0,
    facingRight: fromLeft,
    boss: true,
    fireTimer: 2.5,
    stun: 0,
    kx: 0,
    ky: 0,
  });
  state.bosses++;
  state.alert = 3;
}

function breatheFire(dragon) {
  const mx = dragon.x + (dragon.facingRight ? 40 : -40);
  const my = dragon.y - 12;
  const base = Math.atan2(player.y - my, player.x - mx);
  for (let i = -1; i <= 1; i++) {
    const a = base + i * 0.28;
    fireballs.push({
      x: mx,
      y: my,
      vx: Math.cos(a) * 210,
      vy: Math.sin(a) * 210,
      radius: 7,
      life: 5,
    });
  }
}

function shootAt(target) {
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const spread = 0.18;
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

function burst(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 140;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.4,
      maxLife: 0.4,
      color,
    });
  }
}

function killEnemy(e) {
  state.kills++;
  if (e.boss) {
    // Big XP reward, and the dragon's fireballs disappear with it
    for (let i = 0; i < 12; i++) {
      gems.push({
        x: e.x + (Math.random() - 0.5) * 100,
        y: e.y + (Math.random() - 0.5) * 70,
        radius: 7,
        value: 3,
        life: 20,
      });
    }
    burst(e.x, e.y, '#ff9800', 40);
    burst(e.x, e.y, '#4caf50', 30);
    fireballs = [];
  } else {
    gems.push({ x: e.x, y: e.y, radius: 7, value: 1, life: GEM_LIFETIME });
    burst(e.x, e.y, '#eceff1');
  }
}

// --- Update ---
function update(rawDt) {
  if (state.mode === 'levelup') {
    state.menuAge += rawDt;
    return;
  }
  if (state.mode !== 'playing') return;

  // While a level-up is announced, time slows to 25% and then the menu opens
  let dt = rawDt;
  if (state.levelPending > 0) {
    dt = rawDt * 0.25;
    state.levelPending -= rawDt;
    if (state.levelPending <= 0) {
      openLevelMenu();
      return;
    }
  }

  state.time += dt;
  state.alert = Math.max(0, state.alert - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  // Player movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  if (player.moving) {
    player.x += (dx / len) * player.speed * dt;
    player.y += (dy / len) * player.speed * dt;
    player.walk += dt * 12;
    if (dx !== 0) player.facingRight = dx > 0;
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
    const target = pickTarget();
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

  // Move enemies; the dragon hovers at a distance and breathes fire
  for (const e of enemies) {
    const ex = player.x - e.x;
    const ey = player.y - e.y;
    const d = Math.hypot(ex, ey) || 1;
    e.facingRight = ex > 0;
    e.flash = Math.max(0, e.flash - dt);
    e.stun = Math.max(0, e.stun - dt);

    // Knockback uses real time so the shockwave feels snappy even in slow-motion
    e.x += e.kx * rawDt;
    e.y += e.ky * rawDt;
    const decay = Math.max(0, 1 - 6 * rawDt);
    e.kx *= decay;
    e.ky *= decay;

    if ((!e.boss || d > 240) && e.stun <= 0) {
      e.x += (ex / d) * e.speed * dt;
      e.y += (ey / d) * e.speed * dt;
    }

    if (e.boss) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        breatheFire(e);
        e.fireTimer = 2.4;
      }
    }

    if (player.invuln <= 0 && circlesOverlap(player, e)) {
      endGame();
      break;
    }
  }

  // Fireballs
  for (const f of fireballs) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    if (player.invuln <= 0 && circlesOverlap(player, f)) endGame();
  }

  // Bullet vs enemy collisions
  for (const b of bullets) {
    for (const e of enemies) {
      if (e.hp > 0 && !b.dead && circlesOverlap(b, e)) {
        e.hp -= b.damage;
        e.flash = 0.08;
        b.dead = true;
        if (e.hp <= 0) killEnemy(e);
      }
    }
  }

  // Gems: pulled in when close, collected on touch, vanish when their timer runs out
  for (const g of gems) {
    g.life -= dt;
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

  // Particles
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }

  // Shockwave rings (real time)
  for (const w of shockwaves) w.t += rawDt;
  shockwaves = shockwaves.filter((w) => w.t < 0.5);

  // Cleanup
  enemies = enemies.filter((e) => e.hp > 0);
  bullets = bullets.filter(
    (b) => !b.dead && b.x > -50 && b.x < W + 50 && b.y > -50 && b.y < H + 50
  );
  gems = gems.filter((g) => !g.collected && g.life > 0);
  fireballs = fireballs.filter(
    (f) => f.life > 0 && f.x > -50 && f.x < W + 50 && f.y > -50 && f.y < H + 50
  );
  particles = particles.filter((p) => p.life > 0);

  if (state.mode === 'playing' && state.levelPending <= 0 && state.xp >= state.xpToNext) startLevelUp();
}

// --- Drawing: one small function per entity type ---
function drawGem(g) {
  // Blink during the last 3 seconds as a warning
  if (g.life < 3 && Math.floor(g.life * 8) % 2 === 0) return;
  drawSprite(ctx, SPRITES.gem, g.x, g.y);
}

function drawEnemy(e) {
  if (e.boss) {
    drawSprite(ctx, SPRITES.dragon, e.x, e.y, e.facingRight, e.flash > 0);
    // Health bar above the dragon
    const barW = 100;
    const barX = e.x - barW / 2;
    const barY = e.y - SPRITES.dragon.h / 2 - 12;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, 6);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(barX, barY, barW * Math.max(0, e.hp / e.maxHp), 6);
  } else {
    drawSprite(ctx, SPRITES.skeleton, e.x, e.y, e.facingRight, e.flash > 0);
  }
}

function drawBullet(b) {
  drawSprite(ctx, SPRITES.bullet, b.x, b.y);
}

function drawFireball(f) {
  drawSprite(ctx, SPRITES.fireball, f.x, f.y);
}

function drawPlayer() {
  const bob = player.moving ? -Math.abs(Math.sin(player.walk)) * 3 : 0;
  // Blink while invulnerable
  if (player.invuln > 0 && Math.floor(performance.now() / 90) % 2 === 0) ctx.globalAlpha = 0.4;
  drawSprite(ctx, SPRITES.knight, player.x, player.y + bob, player.facingRight);
  ctx.globalAlpha = 1;
}

function drawParticle(p) {
  ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
  ctx.fillStyle = p.color;
  ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
  ctx.globalAlpha = 1;
}

function drawOverlay(alpha) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function drawMenu() {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4fc3f7';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText('SURVIVOR', W / 2, H / 2 - 100);

  ctx.fillStyle = '#ccc';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('A knight, on a rescue mission.', W / 2, H / 2 - 60);

  ctx.fillStyle = '#999';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Move: WASD / Arrow keys     Pause: P / Esc', W / 2, H / 2 + 0);
  ctx.fillText('Your knight fires automatically', W / 2, H / 2 + 28);
  ctx.fillText('Grab the green gems before they vanish', W / 2, H / 2 + 56);

  if (best > 0) {
    ctx.fillStyle = '#fff176';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`Best: ${best.toFixed(1)}s`, W / 2, H / 2 + 100);
  }

  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 350);
  ctx.fillStyle = '#fff';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Press Enter or click to start', W / 2, H / 2 + 150);
  ctx.globalAlpha = 1;

  // Cast of characters
  drawSprite(ctx, SPRITES.knight, W / 2 - 70, H - 60, true);
  drawSprite(ctx, SPRITES.skeleton, W / 2 + 70, H - 60, false);
  drawSprite(ctx, SPRITES.dragon, W - 130, 90, false);
}

function drawLevelUp() {
  const fade = Math.min(1, state.menuAge / 0.35);
  drawOverlay(0.55 * fade);

  ctx.textAlign = 'center';
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#fff176';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(`Level ${state.level}!`, W / 2, H / 2 - 100);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Pick an upgrade (click or press 1, 2, 3)', W / 2, H / 2 - 68);

  state.choices.forEach((c, i) => {
    // Cards fade and slide in one after another
    const t = Math.min(1, Math.max(0, (state.menuAge - i * 0.08) / 0.3));
    const ease = 1 - (1 - t) * (1 - t);
    const r = cardRect(i);
    const y = r.y + (1 - ease) * 30;
    ctx.globalAlpha = ease;

    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(r.x, y, r.w, r.h);
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, y, r.w, r.h);

    ctx.fillStyle = '#4fc3f7';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, y + 30);
    ctx.fillStyle = '#fff';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(c.name, r.x + r.w / 2, y + 80);
    ctx.fillStyle = '#bbb';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(c.desc, r.x + r.w / 2, y + 115);
  });
  ctx.globalAlpha = 1;
}

function drawGameOver() {
  drawOverlay(0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '48px system-ui, sans-serif';
  ctx.fillText('Game Over', W / 2, H / 2 - 40);

  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(
    `Level ${state.level}  |  ${state.time.toFixed(1)}s  |  ${state.kills} kills`,
    W / 2,
    H / 2 + 0
  );

  if (state.newBest) {
    ctx.fillStyle = '#fff176';
    ctx.fillText('New best time!', W / 2, H / 2 + 34);
  } else {
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Best: ${best.toFixed(1)}s`, W / 2, H / 2 + 34);
  }

  ctx.fillStyle = '#fff';
  ctx.fillText('Press R, Enter, or click to play again', W / 2, H / 2 + 80);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  if (state.mode === 'menu') {
    drawMenu();
    return;
  }

  gems.forEach(drawGem);
  enemies.filter((e) => !e.boss).forEach(drawEnemy);
  drawPlayer();
  enemies.filter((e) => e.boss).forEach(drawEnemy); // dragon flies above everything
  fireballs.forEach(drawFireball);
  bullets.forEach(drawBullet);
  particles.forEach(drawParticle);

  // Level-up shockwave rings
  for (const w of shockwaves) {
    const t = w.t / 0.5;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = '#fff176';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w.x, w.y, SHOCK_RADIUS * t, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // XP bar
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
  if (best > 0) {
    ctx.fillStyle = '#fff176';
    ctx.fillText(`Best: ${best.toFixed(1)}s`, 16, 106);
  }

  // Dragon warning
  if (state.alert > 0 && state.mode === 'playing') {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 120);
    ctx.fillStyle = '#ff5252';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText('A DRAGON APPROACHES!', W / 2, 90);
    ctx.globalAlpha = 1;
  }

  // "LEVEL UP!" banner during the slow-motion moment
  if (state.levelPending > 0) {
    ctx.globalAlpha = Math.min(1, state.levelPending / 0.3);
    ctx.fillStyle = '#fff176';
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('LEVEL UP!', W / 2, H / 2 - 80);
    ctx.globalAlpha = 1;
  }

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
  if (state.mode === 'gameover') drawGameOver();
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