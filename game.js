const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// --- Input ---
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.startsWith('Arrow')) e.preventDefault();
  if (e.key.toLowerCase() === 'r' && state.gameOver) reset();
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// --- Game state ---
let player, enemies, state;

function reset() {
  player = { x: W / 2, y: H / 2, radius: 12, speed: 220 };
  enemies = [];
  state = {
    gameOver: false,
    time: 0,         // seconds survived
    spawnTimer: 0,   // counts down to the next spawn
  };
}
reset();

// --- Helpers ---
function circlesOverlap(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
}

// Spawn just outside a random edge of the arena
function spawnEnemy() {
  const margin = 20;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -margin; }          // top
  else if (side === 1) { x = W + margin; y = Math.random() * H; } // right
  else if (side === 2) { x = Math.random() * W; y = H + margin; } // bottom
  else { x = -margin; y = Math.random() * H; }                    // left

  enemies.push({
    x, y,
    radius: 10,
    speed: 60 + Math.random() * 40 + state.time * 0.5, // enemies get faster over time
  });
}

// --- Update ---
function update(dt) {
  if (state.gameOver) return;
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

  // Spawning: interval shrinks as time passes (floor of 0.25s)
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.25, 1.0 - state.time * 0.01);
  }

  // Enemies chase the player
  for (const e of enemies) {
    const ex = player.x - e.x;
    const ey = player.y - e.y;
    const d = Math.hypot(ex, ey) || 1;
    e.x += (ex / d) * e.speed * dt;
    e.y += (ey / d) * e.speed * dt;

    if (circlesOverlap(player, e)) state.gameOver = true;
  }
}

// --- Draw ---
function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#e57373';
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Time: ${state.time.toFixed(1)}s`, 16, 28);

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '48px system-ui, sans-serif';
    ctx.fillText('Game Over', W / 2, H / 2 - 10);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`You survived ${state.time.toFixed(1)}s. Press R to restart`, W / 2, H / 2 + 30);
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