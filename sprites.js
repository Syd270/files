// sprites.js: pixel art drawn as text grids, turned into canvas images at load time.
// Each character is one pixel. '.' is transparent; other letters map to a palette color.

const ART = {
  knight: [
    '.....RR.....',
    '....SSSS....',
    '...SSSSSS...',
    '...SDDDDS.W.',
    '...SSSSSS.W.',
    '..sSSSSSSsW.',
    '.YYsBBBBs.W.',
    '.YYYBBBBB.W.',
    '.YYYBBBBB.W.',
    '..Y.BBBBBYYY',
    '....BBBB..L.',
    '....BBBB....',
    '....LL.LL...',
    '...LLL.LLL..',
  ],
  skeleton: [
    '..BBBBBB..',
    '.BBBBBBBB.',
    '.BDRBBRDB.',
    '..BBDDBB..',
    '...BbBb...',
    '....bb....',
    '..bBBBBb..',
    '.b.BbbB.b.',
    '.b..BB..b.',
    '.b.BbbB.b.',
    '...bBBb...',
    '...b..b...',
    '..bb..bb..',
  ],
  dragon: [
    '.....g....................',
    '.....gg.............H.H...',
    '....gRRg.............H.H..',
    '....gRRRg............ggggg',
    '....gRRRRg...........gGEGK',
    '...gRRRRRRg........ggGGGGg',
    '...gRRRRRRRg.......gGGKKKg',
    '...gRRRRRRRRg.....gGGGgHgH',
    '...gRRRRRGGGGggg..gGGg....',
    'gg.....gGGGGGGGGggGGg.....',
    '..gg..gGGGGGGGGGGGGGg.....',
    '..ggggGGGGGGGGGGGGGg......',
    '....ggGGGGGGGGGGGGg.......',
    '......ggLLLLLLLLLg........',
    '........gLgggggLg.........',
    '........gg.....gg.........',
    '........gg.....gg.........',
    '........HH.....HH.........',
  ],
  bullet: [
    '.Y.',
    'YWY',
    '.Y.',
  ],
  gem: [
    '..g..',
    '.gGg.',
    'gGWGg',
    '.gGg.',
    '..g..',
  ],
  fireball: [
    '.ROR.',
    'ROYOR',
    'OYYYO',
    'ROYOR',
    '.ROR.',
  ],
};

const PALETTES = {
  knight: {"S": "#b0bec5", "s": "#78909c", "D": "#263238", "R": "#e53935", "B": "#3949ab", "Y": "#ffd54f", "W": "#eceff1", "L": "#5d4037"},
  skeleton: {"B": "#eceff1", "b": "#b0bec5", "D": "#212121", "R": "#ff5252"},
  dragon: {"G": "#4caf50", "g": "#2e7d32", "L": "#c5e1a5", "R": "#c62828", "E": "#ffeb3b", "H": "#fff3e0", "K": "#1b1b1b"},
  bullet: {"Y": "#fff176", "W": "#ffffff"},
  gem: {"g": "#2e7d32", "G": "#66bb6a", "W": "#e8f5e9"},
  fireball: {"R": "#e53935", "O": "#ff9800", "Y": "#ffeb3b"},
};

// Pre-render a sprite (and mirrored / white "hit flash" versions) so drawing is just drawImage.
function buildSprite(rows, palette, scale) {
  const h = rows.length;
  const w = rows[0].length;

  const render = (flip, white) => {
    const c = document.createElement('canvas');
    c.width = w * scale;
    c.height = h * scale;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        g.fillStyle = white ? '#ffffff' : palette[ch];
        const px = flip ? w - 1 - x : x;
        g.fillRect(px * scale, y * scale, scale, scale);
      }
    }
    return c;
  };

  return {
    w: w * scale,
    h: h * scale,
    right: render(false, false),
    left: render(true, false),
    rightFlash: render(false, true),
    leftFlash: render(true, true),
  };
}

// Draw a sprite centered on (x, y). `facingRight` picks the mirrored version.
function drawSprite(ctx, sprite, x, y, facingRight = true, flash = false) {
  const img = facingRight
    ? (flash ? sprite.rightFlash : sprite.right)
    : (flash ? sprite.leftFlash : sprite.left);
  ctx.drawImage(img, Math.round(x - sprite.w / 2), Math.round(y - sprite.h / 2));
}

const SPRITES = {
  knight: buildSprite(ART.knight, PALETTES.knight, 3),
  skeleton: buildSprite(ART.skeleton, PALETTES.skeleton, 3),
  dragon: buildSprite(ART.dragon, PALETTES.dragon, 4),
  bullet: buildSprite(ART.bullet, PALETTES.bullet, 3),
  gem: buildSprite(ART.gem, PALETTES.gem, 3),
  fireball: buildSprite(ART.fireball, PALETTES.fireball, 3),
};
