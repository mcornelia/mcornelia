// Rack Invaders — DC-themed Space Invaders
// Pure vanilla JS, canvas-based

(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // --- Constants ---
  const COLS = 8;
  const ROWS = 5;
  const INVADER_W = 28;
  const INVADER_H = 20;
  const INVADER_PAD_X = 14;
  const INVADER_PAD_Y = 12;
  const PLAYER_W = 36;
  const PLAYER_H = 24;
  const BULLET_W = 3;
  const BULLET_H = 10;
  const SHIELD_COUNT = 3;
  const SHIELD_W = 48;
  const SHIELD_H = 16;
  const SHIELD_HP = 4;

  // Colors — terminal green palette
  const C = {
    bg: '#0a0e0a',
    green: '#33ff33',
    greenDim: '#1a8c1a',
    greenDark: '#0d4d0d',
    amber: '#ffaa00',
    red: '#ff3333',
    white: '#ccffcc',
    gray: '#2a3a2a',
    scanline: 'rgba(0,0,0,0.12)',
  };

  // Point values per row (top row = hardest = most points)
  const ROW_POINTS = [30, 30, 20, 20, 10];

  // Row labels for the invader types
  const ROW_LABELS = ['SEV', 'SEV', 'GPU', 'GPU', 'ERR'];

  // --- Audio (Web Audio API beeps) ---
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  function beep(freq, duration, vol) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.value = vol || 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  }
  function sndShoot() { beep(880, 0.08, 0.06); }
  function sndHit() { beep(220, 0.15, 0.1); }
  function sndPlayerHit() { beep(110, 0.4, 0.12); }
  function sndLevelUp() { beep(660, 0.1, 0.08); setTimeout(() => beep(880, 0.1, 0.08), 100); setTimeout(() => beep(1100, 0.15, 0.08), 200); }

  // --- Game State ---
  let state = 'start'; // start | playing | gameover
  let score = 0;
  let highScore = parseInt(localStorage.getItem('rackInvadersHigh') || '0', 10);
  let lives = 3;
  let level = 1;
  let player, invaders, playerBullets, invaderBullets, shields;
  let invaderDir, invaderSpeed, invaderShootTimer, invaderDropAmount;
  let gameWidth, gameHeight, scale;
  let keys = {};
  let touchLeft = false, touchRight = false, touchShoot = false;
  let lastShootTime = 0;
  const SHOOT_COOLDOWN = 300;
  let animFrame = null;
  let lastTime = 0;

  // --- Sizing ---
  function resize() {
    const container = canvas.parentElement;
    const maxW = Math.min(container.clientWidth, 480);
    const maxH = Math.min(window.innerHeight * 0.65, 600);
    const aspect = 480 / 600;
    let w, h;
    if (maxW / maxH > aspect) {
      h = maxH;
      w = h * aspect;
    } else {
      w = maxW;
      h = w / aspect;
    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = 480;
    canvas.height = 600;
    gameWidth = 480;
    gameHeight = 600;
    scale = w / 480;
  }

  // --- Init Game ---
  function initGame() {
    player = { x: gameWidth / 2 - PLAYER_W / 2, y: gameHeight - 50, w: PLAYER_W, h: PLAYER_H };
    playerBullets = [];
    invaderBullets = [];
    invaders = [];
    shields = [];

    const gridW = COLS * (INVADER_W + INVADER_PAD_X) - INVADER_PAD_X;
    const startX = (gameWidth - gridW) / 2;
    const startY = 60;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        invaders.push({
          x: startX + c * (INVADER_W + INVADER_PAD_X),
          y: startY + r * (INVADER_H + INVADER_PAD_Y),
          w: INVADER_W,
          h: INVADER_H,
          row: r,
          alive: true,
        });
      }
    }

    invaderDir = 1;
    invaderSpeed = 0.4 + (level - 1) * 0.15;
    invaderDropAmount = INVADER_H * 0.6;
    invaderShootTimer = 0;

    const shieldY = gameHeight - 120;
    const shieldSpacing = gameWidth / (SHIELD_COUNT + 1);
    for (let i = 0; i < SHIELD_COUNT; i++) {
      shields.push({
        x: shieldSpacing * (i + 1) - SHIELD_W / 2,
        y: shieldY,
        w: SHIELD_W,
        h: SHIELD_H,
        hp: SHIELD_HP,
      });
    }
  }

  // --- Drawing ---
  function drawBg() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    // Scanlines
    ctx.fillStyle = C.scanline;
    for (let y = 0; y < gameHeight; y += 3) {
      ctx.fillRect(0, y, gameWidth, 1);
    }
  }

  function drawPlayer() {
    const p = player;
    // Server rack shape
    ctx.fillStyle = C.green;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Rack details — horizontal lines
    ctx.fillStyle = C.greenDark;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(p.x + 2, p.y + 4 + i * 7, p.w - 4, 1);
    }
    // LED indicators
    ctx.fillStyle = C.amber;
    ctx.fillRect(p.x + p.w - 6, p.y + 4, 3, 2);
    ctx.fillRect(p.x + p.w - 6, p.y + 11, 3, 2);
    ctx.fillStyle = C.green;
    ctx.fillRect(p.x + p.w - 6, p.y + 18, 3, 2);
    // Antenna / diagnostic tool tip
    ctx.fillRect(p.x + p.w / 2 - 1, p.y - 4, 3, 4);
  }

  function drawInvader(inv) {
    if (!inv.alive) return;
    const label = ROW_LABELS[inv.row];
    const color = inv.row < 2 ? C.red : inv.row < 4 ? C.amber : C.green;

    ctx.fillStyle = color;
    // Body
    ctx.fillRect(inv.x + 2, inv.y + 2, inv.w - 4, inv.h - 4);
    // "Screen" inner
    ctx.fillStyle = C.bg;
    ctx.fillRect(inv.x + 5, inv.y + 4, inv.w - 10, inv.h - 8);
    // Label text
    ctx.fillStyle = color;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, inv.x + inv.w / 2, inv.y + inv.h / 2 + 3);
    // "Legs" / connectors
    ctx.fillStyle = color;
    ctx.fillRect(inv.x, inv.y + inv.h - 4, 3, 4);
    ctx.fillRect(inv.x + inv.w - 3, inv.y + inv.h - 4, 3, 4);
  }

  function drawShield(s) {
    if (s.hp <= 0) return;
    const alpha = s.hp / SHIELD_HP;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.greenDim;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // Label
    ctx.fillStyle = C.bg;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COOL', s.x + s.w / 2, s.y + s.h / 2 + 3);
    ctx.globalAlpha = 1;
    // Damage cracks
    if (s.hp < SHIELD_HP) {
      ctx.fillStyle = C.bg;
      const cracks = SHIELD_HP - s.hp;
      for (let i = 0; i < cracks; i++) {
        const cx = s.x + 8 + i * 12;
        ctx.fillRect(cx, s.y, 4, s.h);
      }
    }
  }

  function drawBullet(b, color) {
    ctx.fillStyle = color;
    ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
    ctx.shadowBlur = 0;
  }

  function drawHUD() {
    ctx.fillStyle = C.green;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SERVERS REPAIRED: ' + score, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText('UPTIME: ' + lives, gameWidth - 12, 22);
    ctx.textAlign = 'center';
    ctx.fillText('WAVE ' + level, gameWidth / 2, 22);

    // Bottom status bar
    ctx.fillStyle = C.greenDark;
    ctx.fillRect(0, gameHeight - 18, gameWidth, 18);
    ctx.fillStyle = C.green;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HIGH SCORE: ' + highScore, 12, gameHeight - 5);
    ctx.textAlign = 'right';
    ctx.fillText('RACK INVADERS v1.0', gameWidth - 12, gameHeight - 5);
  }

  // --- Start Screen ---
  function drawStartScreen() {
    drawBg();
    ctx.fillStyle = C.green;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RACK', gameWidth / 2, 180);
    ctx.fillText('INVADERS', gameWidth / 2, 225);

    // Subtitle
    ctx.fillStyle = C.greenDim;
    ctx.font = '12px monospace';
    ctx.fillText('DATA CENTER DEFENSE SYSTEM', gameWidth / 2, 255);

    // Draw sample invaders
    ctx.fillStyle = C.red;
    ctx.font = 'bold 9px monospace';
    ctx.fillText('SEV  = 30 PTS', gameWidth / 2, 300);
    ctx.fillStyle = C.amber;
    ctx.fillText('GPU  = 20 PTS', gameWidth / 2, 320);
    ctx.fillStyle = C.green;
    ctx.fillText('ERR  = 10 PTS', gameWidth / 2, 340);

    // Controls
    ctx.fillStyle = C.green;
    ctx.font = '14px monospace';
    ctx.fillText('ARROWS / SWIPE: MOVE', gameWidth / 2, 400);
    ctx.fillText('SPACE / TAP: REPAIR', gameWidth / 2, 425);

    // Start prompt — blink
    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = C.green;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('PRESS SPACE / TAP TO START', gameWidth / 2, 490);
    }

    // High score
    if (highScore > 0) {
      ctx.fillStyle = C.amber;
      ctx.font = '12px monospace';
      ctx.fillText('HIGH SCORE: ' + highScore, gameWidth / 2, 530);
    }

    // CRT vignette
    drawVignette();
  }

  function drawGameOverScreen() {
    drawBg();
    ctx.fillStyle = C.red;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SEV-1', gameWidth / 2, 200);
    ctx.font = 'bold 20px monospace';
    ctx.fillText('DATA CENTER OFFLINE', gameWidth / 2, 240);

    ctx.fillStyle = C.green;
    ctx.font = '16px monospace';
    ctx.fillText('SERVERS REPAIRED: ' + score, gameWidth / 2, 310);

    if (score >= highScore && score > 0) {
      ctx.fillStyle = C.amber;
      ctx.font = 'bold 14px monospace';
      ctx.fillText('NEW HIGH SCORE!', gameWidth / 2, 345);
    } else {
      ctx.fillStyle = C.greenDim;
      ctx.font = '13px monospace';
      ctx.fillText('HIGH SCORE: ' + highScore, gameWidth / 2, 345);
    }

    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = C.green;
      ctx.font = 'bold 14px monospace';
      ctx.fillText('PRESS SPACE / TAP TO RESTART', gameWidth / 2, 430);
    }

    drawVignette();
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(
      gameWidth / 2, gameHeight / 2, gameHeight * 0.3,
      gameWidth / 2, gameHeight / 2, gameHeight * 0.8
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
  }

  // --- Update ---
  function update(dt) {
    if (state !== 'playing') return;

    // Player movement
    const speed = 220 * dt;
    if (keys['ArrowLeft'] || keys['a'] || touchLeft) {
      player.x -= speed;
    }
    if (keys['ArrowRight'] || keys['d'] || touchRight) {
      player.x += speed;
    }
    player.x = Math.max(0, Math.min(gameWidth - player.w, player.x));

    // Shooting
    const now = Date.now();
    if ((keys[' '] || touchShoot) && now - lastShootTime > SHOOT_COOLDOWN) {
      playerBullets.push({
        x: player.x + player.w / 2 - BULLET_W / 2,
        y: player.y - BULLET_H,
      });
      lastShootTime = now;
      sndShoot();
      touchShoot = false;
    }

    // Player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      playerBullets[i].y -= 400 * dt;
      if (playerBullets[i].y < -BULLET_H) {
        playerBullets.splice(i, 1);
      }
    }

    // Invader bullets
    for (let i = invaderBullets.length - 1; i >= 0; i--) {
      invaderBullets[i].y += 200 * dt;
      if (invaderBullets[i].y > gameHeight) {
        invaderBullets.splice(i, 1);
      }
    }

    // Move invaders
    let edgeHit = false;
    for (const inv of invaders) {
      if (!inv.alive) continue;
      inv.x += invaderSpeed * invaderDir;
      if (inv.x + inv.w > gameWidth - 10 || inv.x < 10) {
        edgeHit = true;
      }
    }
    if (edgeHit) {
      invaderDir *= -1;
      for (const inv of invaders) {
        if (!inv.alive) continue;
        inv.y += invaderDropAmount;
      }
    }

    // Invader shooting
    invaderShootTimer += dt;
    const shootInterval = Math.max(0.4, 1.5 - level * 0.12);
    if (invaderShootTimer > shootInterval) {
      invaderShootTimer = 0;
      const alive = invaders.filter(inv => inv.alive);
      if (alive.length > 0) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        invaderBullets.push({
          x: shooter.x + shooter.w / 2 - BULLET_W / 2,
          y: shooter.y + shooter.h,
        });
      }
    }

    // Collision: player bullets vs invaders
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
      const b = playerBullets[bi];
      for (const inv of invaders) {
        if (!inv.alive) continue;
        if (rectsOverlap(b.x, b.y, BULLET_W, BULLET_H, inv.x, inv.y, inv.w, inv.h)) {
          inv.alive = false;
          playerBullets.splice(bi, 1);
          score += ROW_POINTS[inv.row];
          sndHit();
          // Speed up remaining invaders slightly
          invaderSpeed += 0.03;
          break;
        }
      }
    }

    // Collision: player bullets vs shields
    for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
      const b = playerBullets[bi];
      for (const s of shields) {
        if (s.hp <= 0) continue;
        if (rectsOverlap(b.x, b.y, BULLET_W, BULLET_H, s.x, s.y, s.w, s.h)) {
          playerBullets.splice(bi, 1);
          break;
        }
      }
    }

    // Collision: invader bullets vs shields
    for (let bi = invaderBullets.length - 1; bi >= 0; bi--) {
      const b = invaderBullets[bi];
      for (const s of shields) {
        if (s.hp <= 0) continue;
        if (rectsOverlap(b.x, b.y, BULLET_W, BULLET_H, s.x, s.y, s.w, s.h)) {
          s.hp--;
          invaderBullets.splice(bi, 1);
          break;
        }
      }
    }

    // Collision: invader bullets vs player
    for (let bi = invaderBullets.length - 1; bi >= 0; bi--) {
      const b = invaderBullets[bi];
      if (rectsOverlap(b.x, b.y, BULLET_W, BULLET_H, player.x, player.y, player.w, player.h)) {
        invaderBullets.splice(bi, 1);
        lives--;
        sndPlayerHit();
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    }

    // Collision: invaders reach player row
    for (const inv of invaders) {
      if (inv.alive && inv.y + inv.h >= player.y) {
        gameOver();
        return;
      }
    }

    // Wave clear
    if (invaders.every(inv => !inv.alive)) {
      level++;
      sndLevelUp();
      initGame();
    }
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  function gameOver() {
    state = 'gameover';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('rackInvadersHigh', String(highScore));
    }
  }

  // --- Main Loop ---
  function loop(time) {
    animFrame = requestAnimationFrame(loop);
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (state === 'start') {
      drawStartScreen();
    } else if (state === 'playing') {
      update(dt);
      drawBg();
      shields.forEach(drawShield);
      invaders.forEach(drawInvader);
      playerBullets.forEach(b => drawBullet(b, C.green));
      invaderBullets.forEach(b => drawBullet(b, C.red));
      drawPlayer();
      drawHUD();
      drawVignette();
    } else if (state === 'gameover') {
      drawGameOverScreen();
    }
  }

  function startGame() {
    initAudio();
    score = 0;
    lives = 3;
    level = 1;
    initGame();
    state = 'playing';
  }

  // --- Input ---
  document.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (e.key === ' ') {
      e.preventDefault();
      if (state === 'start' || state === 'gameover') {
        startGame();
      }
    }
  });

  document.addEventListener('keyup', function (e) {
    keys[e.key] = false;
  });

  // Touch controls
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    initAudio();
    if (state === 'start' || state === 'gameover') {
      startGame();
      return;
    }
    handleTouches(e.touches);
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    handleTouches(e.touches);
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    if (e.touches.length === 0) {
      touchLeft = false;
      touchRight = false;
    } else {
      handleTouches(e.touches);
    }
  }, { passive: false });

  function handleTouches(touches) {
    touchLeft = false;
    touchRight = false;
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < touches.length; i++) {
      const tx = (touches[i].clientX - rect.left) / rect.width;
      const ty = (touches[i].clientY - rect.top) / rect.height;
      if (ty > 0.75) {
        // Bottom quarter — movement zone
        if (tx < 0.5) touchLeft = true;
        else touchRight = true;
      } else {
        // Upper area — shoot
        touchShoot = true;
      }
    }
  }

  // Click to start (desktop)
  canvas.addEventListener('click', function () {
    initAudio();
    if (state === 'start' || state === 'gameover') {
      startGame();
    }
  });

  // --- Boot ---
  resize();
  window.addEventListener('resize', resize);
  lastTime = performance.now();
  loop(lastTime);
})();
