// ============================================
// ASTEROIDS — Retro Arcade Game
// Pure vanilla JS, canvas-based
// ============================================

(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // --- Audio ---
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playSound(freq, duration, type, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function sndShoot() { playSound(800, 0.08, 'square', 0.06); }
  function sndExplosion() { playSound(80, 0.3, 'sawtooth', 0.1); }
  function sndSmallExplosion() { playSound(200, 0.15, 'sawtooth', 0.06); }
  function sndThrust() { playSound(60, 0.05, 'sawtooth', 0.03); }
  function sndLevelUp() {
    playSound(523, 0.1, 'square', 0.06);
    setTimeout(function () { playSound(659, 0.1, 'square', 0.06); }, 100);
    setTimeout(function () { playSound(784, 0.15, 'square', 0.06); }, 200);
  }
  function sndDeath() {
    playSound(200, 0.3, 'sawtooth', 0.1);
    setTimeout(function () { playSound(100, 0.4, 'sawtooth', 0.1); }, 150);
  }
  function sndExtraLife() {
    playSound(440, 0.1, 'square', 0.08);
    setTimeout(function () { playSound(660, 0.1, 'square', 0.08); }, 100);
    setTimeout(function () { playSound(880, 0.2, 'square', 0.08); }, 200);
  }

  // --- Game State ---
  var state = 'start'; // start, playing, dead, gameover
  var score = 0;
  var lives = 3;
  var level = 1;
  var highScore = parseInt(localStorage.getItem('asteroids_high') || '0', 10);
  var ship = null;
  var bullets = [];
  var asteroids = [];
  var particles = [];
  var respawnTimer = 0;
  var invincibleTimer = 0;
  var extraLifeThreshold = 10000;

  // --- Input ---
  var keys = {};
  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (state === 'start' && e.code === 'Space') startGame();
    else if (state === 'gameover' && e.code === 'Space') startGame();
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  // --- Touch Controls ---
  var touches = { left: false, right: false, thrust: false, fire: false };
  var lastFireTouch = 0;

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (state === 'start' || state === 'gameover') { startGame(); return; }
    handleTouches(e.touches);
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    handleTouches(e.touches);
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    if (e.touches.length === 0) {
      touches.left = false;
      touches.right = false;
      touches.thrust = false;
    } else {
      handleTouches(e.touches);
    }
  }, { passive: false });

  function handleTouches(touchList) {
    touches.left = false;
    touches.right = false;
    touches.thrust = false;
    var fired = false;
    var rect = canvas.getBoundingClientRect();
    for (var i = 0; i < touchList.length; i++) {
      var tx = (touchList[i].clientX - rect.left) / rect.width;
      var ty = (touchList[i].clientY - rect.top) / rect.height;
      // Left third: rotate left, right third: rotate right
      // Top half of left/right: also thrust
      // Center tap: fire
      if (tx < 0.33) {
        touches.left = true;
        if (ty < 0.5) touches.thrust = true;
      } else if (tx > 0.66) {
        touches.right = true;
        if (ty < 0.5) touches.thrust = true;
      } else {
        // Center column: fire + thrust
        touches.thrust = ty < 0.5;
        var now = Date.now();
        if (now - lastFireTouch > 200) {
          fired = true;
          lastFireTouch = now;
        }
      }
    }
    if (fired) touches.fire = true;
  }

  // --- Ship ---
  function createShip() {
    return {
      x: W / 2,
      y: H / 2,
      angle: -Math.PI / 2,
      vx: 0,
      vy: 0,
      radius: 12,
      thrustOn: false,
      shootCooldown: 0
    };
  }

  function drawShip(s) {
    if (!s) return;
    if (invincibleTimer > 0 && Math.floor(invincibleTimer * 10) % 2 === 0) return; // blink

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    // Ship body
    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.stroke();

    // Thrust flame
    if (s.thrustOn) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-18 - Math.random() * 8, 0);
      ctx.lineTo(-8, 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  function updateShip(s, dt) {
    if (!s) return;

    var rotating = false;
    var thrusting = false;
    var shooting = false;

    if (keys['ArrowLeft'] || keys['KeyA'] || touches.left) { s.angle -= 4.5 * dt; rotating = true; }
    if (keys['ArrowRight'] || keys['KeyD'] || touches.right) { s.angle += 4.5 * dt; rotating = true; }

    if (keys['ArrowUp'] || keys['KeyW'] || touches.thrust) {
      s.vx += Math.cos(s.angle) * 200 * dt;
      s.vy += Math.sin(s.angle) * 200 * dt;
      s.thrustOn = true;
      thrusting = true;
      if (Math.random() < 0.3) sndThrust();
    } else {
      s.thrustOn = false;
    }

    // Speed limit
    var speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    var maxSpeed = 350;
    if (speed > maxSpeed) {
      s.vx = (s.vx / speed) * maxSpeed;
      s.vy = (s.vy / speed) * maxSpeed;
    }

    // Drag
    s.vx *= (1 - 0.5 * dt);
    s.vy *= (1 - 0.5 * dt);

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // Wrap around
    if (s.x < -20) s.x = W + 20;
    if (s.x > W + 20) s.x = -20;
    if (s.y < -20) s.y = H + 20;
    if (s.y > H + 20) s.y = -20;

    s.shootCooldown -= dt;

    if ((keys['Space'] || touches.fire) && s.shootCooldown <= 0) {
      fireBullet(s);
      s.shootCooldown = 0.15;
      touches.fire = false;
    }

    if (invincibleTimer > 0) invincibleTimer -= dt;
  }

  // --- Bullets ---
  function fireBullet(s) {
    sndShoot();
    bullets.push({
      x: s.x + Math.cos(s.angle) * 18,
      y: s.y + Math.sin(s.angle) * 18,
      vx: Math.cos(s.angle) * 500 + s.vx * 0.3,
      vy: Math.sin(s.angle) * 500 + s.vy * 0.3,
      life: 1.2
    });
  }

  function updateBullets(dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // Wrap
      if (b.x < 0) b.x = W;
      if (b.x > W) b.x = 0;
      if (b.y < 0) b.y = H;
      if (b.y > H) b.y = 0;

      if (b.life <= 0) bullets.splice(i, 1);
    }
  }

  function drawBullets() {
    ctx.fillStyle = '#33ff33';
    for (var i = 0; i < bullets.length; i++) {
      ctx.beginPath();
      ctx.arc(bullets[i].x, bullets[i].y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Asteroids ---
  function createAsteroid(x, y, size) {
    var speed = (60 + Math.random() * 40) * (4 - size) * 0.6 + level * 5;
    var angle = Math.random() * Math.PI * 2;
    var radius = size === 3 ? 40 : size === 2 ? 22 : 12;

    // Generate jagged shape
    var verts = [];
    var numVerts = 8 + Math.floor(Math.random() * 5);
    for (var i = 0; i < numVerts; i++) {
      var a = (i / numVerts) * Math.PI * 2;
      var r = radius * (0.7 + Math.random() * 0.3);
      verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    return {
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: radius,
      size: size,
      rotAngle: 0,
      rotSpeed: (Math.random() - 0.5) * 2,
      verts: verts
    };
  }

  function spawnAsteroids(count) {
    for (var i = 0; i < count; i++) {
      var x, y;
      // Spawn away from ship
      do {
        x = Math.random() * W;
        y = Math.random() * H;
      } while (ship && dist(x, y, ship.x, ship.y) < 150);
      asteroids.push(createAsteroid(x, y, 3));
    }
  }

  function updateAsteroids(dt) {
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rotAngle += a.rotSpeed * dt;

      // Wrap
      if (a.x < -a.radius) a.x = W + a.radius;
      if (a.x > W + a.radius) a.x = -a.radius;
      if (a.y < -a.radius) a.y = H + a.radius;
      if (a.y > H + a.radius) a.y = -a.radius;
    }
  }

  function drawAsteroids() {
    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1.2;
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotAngle);
      ctx.beginPath();
      ctx.moveTo(a.verts[0].x, a.verts[0].y);
      for (var j = 1; j < a.verts.length; j++) {
        ctx.lineTo(a.verts[j].x, a.verts[j].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  function breakAsteroid(a, idx) {
    asteroids.splice(idx, 1);

    // Score
    var pts = a.size === 3 ? 20 : a.size === 2 ? 50 : 100;
    score += pts;

    // Check extra life
    if (score >= extraLifeThreshold) {
      lives++;
      extraLifeThreshold += 10000;
      sndExtraLife();
    }

    // Particles
    spawnParticles(a.x, a.y, a.size === 3 ? 12 : a.size === 2 ? 8 : 5);

    if (a.size === 3) {
      sndExplosion();
      asteroids.push(createAsteroid(a.x, a.y, 2));
      asteroids.push(createAsteroid(a.x, a.y, 2));
    } else if (a.size === 2) {
      sndSmallExplosion();
      asteroids.push(createAsteroid(a.x, a.y, 1));
      asteroids.push(createAsteroid(a.x, a.y, 1));
    } else {
      sndSmallExplosion();
    }
  }

  // --- Particles ---
  function spawnParticles(x, y, count) {
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 30 + Math.random() * 80;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var alpha = Math.max(0, p.life / 1.0);
      ctx.fillStyle = 'rgba(51, 255, 51, ' + alpha + ')';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }

  // --- Collision ---
  function dist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function checkCollisions() {
    // Bullet vs asteroid
    for (var i = bullets.length - 1; i >= 0; i--) {
      for (var j = asteroids.length - 1; j >= 0; j--) {
        if (dist(bullets[i].x, bullets[i].y, asteroids[j].x, asteroids[j].y) < asteroids[j].radius) {
          bullets.splice(i, 1);
          breakAsteroid(asteroids[j], j);
          break;
        }
      }
    }

    // Ship vs asteroid
    if (ship && invincibleTimer <= 0) {
      for (var k = 0; k < asteroids.length; k++) {
        if (dist(ship.x, ship.y, asteroids[k].x, asteroids[k].y) < asteroids[k].radius + ship.radius - 4) {
          killShip();
          break;
        }
      }
    }
  }

  function killShip() {
    sndDeath();
    spawnParticles(ship.x, ship.y, 20);
    ship = null;
    lives--;

    if (lives <= 0) {
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroids_high', String(highScore));
      }
    } else {
      state = 'dead';
      respawnTimer = 2;
    }
  }

  // --- Level ---
  function checkLevel() {
    if (asteroids.length === 0) {
      level++;
      sndLevelUp();
      spawnAsteroids(3 + level);
    }
  }

  // --- Drawing ---
  function drawHUD() {
    // Score
    ctx.fillStyle = '#33ff33';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, 15, 25);

    // High score
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1a6b1a';
    ctx.font = '12px monospace';
    ctx.fillText('BEST: ' + highScore, W - 15, 25);

    // Level
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a6b1a';
    ctx.fillText('WAVE ' + level, W / 2, 25);

    // Lives as ship icons
    ctx.save();
    for (var i = 0; i < lives; i++) {
      ctx.strokeStyle = '#33ff33';
      ctx.lineWidth = 1.2;
      var lx = 25 + i * 22;
      var ly = 45;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -6);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawStartScreen() {
    // Background
    ctx.fillStyle = '#0a0e0a';
    ctx.fillRect(0, 0, W, H);

    // Stars
    drawStars();

    // Title
    ctx.fillStyle = '#33ff33';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(51, 255, 51, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fillText('ASTEROIDS', W / 2, H / 2 - 80);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#1a6b1a';
    ctx.font = '14px monospace';
    ctx.fillText('navigate the void', W / 2, H / 2 - 50);

    // Draw a sample asteroid
    ctx.save();
    ctx.translate(W / 2, H / 2 + 10);
    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    var sampleR = 35;
    for (var i = 0; i <= 10; i++) {
      var sa = (i / 10) * Math.PI * 2;
      var sr = sampleR * (0.75 + Math.sin(i * 2.3) * 0.25);
      if (i === 0) ctx.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
      else ctx.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Controls
    ctx.fillStyle = '#33ff33';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS SPACE / TAP TO START', W / 2, H / 2 + 80);

    // High score
    if (highScore > 0) {
      ctx.fillStyle = '#1a6b1a';
      ctx.font = '13px monospace';
      ctx.fillText('HIGH SCORE: ' + highScore, W / 2, H / 2 + 110);
    }

    // Scanlines
    drawScanlines();
  }

  function drawGameOverScreen() {
    ctx.fillStyle = '#0a0e0a';
    ctx.fillRect(0, 0, W, H);
    drawStars();

    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 51, 51, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fillText('GAME OVER', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#33ff33';
    ctx.font = '18px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 - 20);

    if (score >= highScore && score > 0) {
      ctx.fillStyle = '#ffff33';
      ctx.font = '14px monospace';
      ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 10);
    }

    ctx.fillStyle = '#1a6b1a';
    ctx.font = '14px monospace';
    ctx.fillText('BEST: ' + highScore, W / 2, H / 2 + 40);

    ctx.fillStyle = '#33ff33';
    ctx.font = '14px monospace';
    ctx.fillText('PRESS SPACE / TAP TO RESTART', W / 2, H / 2 + 80);

    drawScanlines();
  }

  // --- Background effects ---
  var stars = [];
  for (var si = 0; si < 80; si++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      brightness: 0.2 + Math.random() * 0.4,
      size: Math.random() < 0.3 ? 1.5 : 1
    });
  }

  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.fillStyle = 'rgba(51, 255, 51, ' + s.brightness + ')';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  function drawScanlines() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (var y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
    // Vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Game Loop ---
  function startGame() {
    state = 'playing';
    score = 0;
    lives = 3;
    level = 1;
    extraLifeThreshold = 10000;
    bullets = [];
    asteroids = [];
    particles = [];
    ship = createShip();
    invincibleTimer = 3;
    spawnAsteroids(4);
  }

  var lastTime = 0;

  function gameLoop(timestamp) {
    var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (state === 'start') {
      drawStartScreen();
    } else if (state === 'gameover') {
      drawGameOverScreen();
    } else {
      // Clear
      ctx.fillStyle = '#0a0e0a';
      ctx.fillRect(0, 0, W, H);
      drawStars();

      if (state === 'dead') {
        respawnTimer -= dt;
        if (respawnTimer <= 0) {
          ship = createShip();
          invincibleTimer = 3;
          state = 'playing';
        }
      }

      // Update
      updateShip(ship, dt);
      updateBullets(dt);
      updateAsteroids(dt);
      updateParticles(dt);
      checkCollisions();
      checkLevel();

      // Draw
      drawAsteroids();
      drawBullets();
      drawShip(ship);
      drawParticles();
      drawHUD();

      // Scanlines
      drawScanlines();
    }

    requestAnimationFrame(gameLoop);
  }

  // Click to start
  canvas.addEventListener('click', function () {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (state === 'start') startGame();
    else if (state === 'gameover') startGame();
  });

  requestAnimationFrame(gameLoop);
})();
