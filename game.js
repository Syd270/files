const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// --- Input ---
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.startsWith('Arrow')) e.preventDefault(); // stop page scrolling
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// --- Game state ---
const player = {
  x: W / 2,
  y: H / 2,
  radius: 12,
  speed: 220, // pixels per second
};

// --- Update: runs once per frame; dt = seconds since last frame ---
function update(dt) {
  let dx = 0;
  let dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  // Normalize so diagonal movement isn't faster
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    player.x += (dx / len) * player.speed * dt;
    player.y += (dy / len) * player.speed * dt;
  }

  // Keep the player inside the arena
  player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));
}

// --- Draw ---
function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

// --- Game loop ---
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); // cap dt so tab-switching doesn't cause huge jumps
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
