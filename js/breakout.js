/**
 * Breakout — mcornelia.com
 * Canvas 480×560, dark neon aesthetic.
 */

(function () {
  'use strict';

  /* ── Canvas / Context ──────────────────────────────────────────────── */
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width;   // 480
  const H = canvas.height;  // 560

  /* ── Constants ─────────────────────────────────────────────────────── */
  const BG           = '#111';
  const PADDLE_COLOR = '#39ff14';   // neon green
  const BALL_COLOR   = '#00eeff';   // cyan
  const SCORE_COLOR  = '#ffffff';
  const DIM_COLOR    = '#666';

  const PADDLE_W     = 80;
  const PADDLE_H     = 12;
  const PADDLE_Y     = H - 48;
  const PADDLE_SPEED = 6;
  const PADDLE_RADIUS = 6;

  const BALL_R       = 7;
  const BALL_SPEED_INIT = 4.8;
  const BALL_SPEED_MAX  = 9.0;
  const BALL_SPEED_INC  = 0.08;   // speed bump per paddle hit

  const BRICK_COLS   = 8;
  const BRICK_ROWS   = 6;
  const BRICK_GAP    = 5;
  const BRICK_TOP    = 60;         // y-offset for first row
  const BRICK_RADIUS = 4;
  const BRICK_W      = (W - (BRICK_COLS + 1) * BRICK_GAP) / BRICK_COLS;
  const BRICK_H      = 18;

  const LIVES_INIT   = 3;
  const LS_KEY       = 'breakout_best';

  /* Row colours — top row = highest score, vivid neon palette */
  const ROW_COLORS = [
    '#ff3860',   // row 0 — red-pink    7 pts
    '#ff6b00',   // row 1 — orange      6 pts
    '#ffe600',   // row 2 — yellow      5 pts
    '#39ff14',   // row 3 — neon green  4 pts
    '#00eeff',   // row 4 — cyan        3 pts
    '#7b5ea7',   // row 5 — purple      2 pts (bottom / easiest)
  ];
  const ROW_POINTS = [7, 6, 5, 4, 3, 2];

  /* ── Game state ────────────────────────────────────────────────────── */
  let state;       // 'start' | 'playing' | 'dead' | 'gameover' | 'levelclear' | 'nextlevel'
  let score, lives, level, bestScore;
  let bricks = [];
  let paddle  = { x: W / 2 - PADDLE_W / 2, speed: 0 };
  let ball    = {};
  let ballStuck;   // ball stuck to paddle before launch
  let ballSpeed;
  let flashTimer = 0;
  let flashMsg   = '';
  let blinkTimer = 0;

  /* ── Input ─────────────────────────────────────────────────────────── */
  const keys = {};
  let mouseX = null;
  let touchLeft = false, touchRight = false;

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      handleLaunch();
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
      e.preventDefault();
      mouseX = null; // yield control back to keyboard
    }
  });
  window.addEventListener('keyup',  e => { keys[e.code] = false; });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
  });
  canvas.addEventListener('mouseleave', () => { mouseX = null; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handleTouchInput(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    handleTouchInput(e);
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    touchLeft = false;
    touchRight = false;
    // Detect tap: fire handleLaunch for start/gameover/ball-stuck states
    if (state === 'start' || state === 'gameover' || (state === 'playing' && ballStuck)) {
      handleLaunch();
    }
  }, { passive: false });

  function handleTouchInput(e) {
    touchLeft = false; touchRight = false;
    for (const t of e.touches) {
      const rect = canvas.getBoundingClientRect();
      const tx = (t.clientX - rect.left) * (W / rect.width);
      if (tx < W / 2) touchLeft  = true;
      else             touchRight = true;
    }
  }

  function handleLaunch() {
    if (state === 'start' || state === 'gameover') {
      initGame();
      return;
    }
    if (state === 'playing' && ballStuck) {
      launchBall();
    }
  }

  /* ── Init / Reset ──────────────────────────────────────────────────── */
  function initGame() {
    bestScore = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
    score  = 0;
    lives  = LIVES_INIT;
    level  = 1;
    state  = 'playing';
    buildBricks();
    resetBall();
  }

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const x = BRICK_GAP + c * (BRICK_W + BRICK_GAP);
        const y = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
        bricks.push({ x, y, w: BRICK_W, h: BRICK_H, alive: true, row: r });
      }
    }
  }

  function resetBall() {
    ballStuck = true;
    ball.x = paddle.x + PADDLE_W / 2;
    ball.y = PADDLE_Y - BALL_R - 1;
    ballSpeed = BALL_SPEED_INIT + (level - 1) * 0.6;
    ball.dx = 0;
    ball.dy = -ballSpeed;
  }

  function launchBall() {
    ballStuck = false;
    /* angle depends on position relative to paddle centre */
    const relX  = (ball.x - (paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2);
    const angle = relX * (Math.PI / 3);   // ±60° from vertical
    ball.dx = ballSpeed * Math.sin(angle);
    ball.dy = -Math.abs(ballSpeed * Math.cos(angle));
  }

  /* ── Update ────────────────────────────────────────────────────────── */
  function update() {
    if (state !== 'playing') return;

    /* Paddle movement */
    if (mouseX !== null) {
      paddle.x = mouseX - PADDLE_W / 2;
    } else {
      if (keys['ArrowLeft']  || touchLeft)  paddle.x -= PADDLE_SPEED;
      if (keys['ArrowRight'] || touchRight) paddle.x += PADDLE_SPEED;
    }
    paddle.x = Math.max(0, Math.min(W - PADDLE_W, paddle.x));

    /* Stuck ball follows paddle */
    if (ballStuck) {
      ball.x = paddle.x + PADDLE_W / 2;
      ball.y = PADDLE_Y - BALL_R - 1;
      return;
    }

    /* Move ball */
    ball.x += ball.dx;
    ball.y += ball.dy;

    /* Wall collisions */
    if (ball.x - BALL_R < 0) {
      ball.x = BALL_R;
      ball.dx = Math.abs(ball.dx);
    }
    if (ball.x + BALL_R > W) {
      ball.x = W - BALL_R;
      ball.dx = -Math.abs(ball.dx);
    }
    if (ball.y - BALL_R < 0) {
      ball.y = BALL_R;
      ball.dy = Math.abs(ball.dy);
    }

    /* Paddle collision */
    if (
      ball.dy > 0 &&
      ball.x + BALL_R > paddle.x &&
      ball.x - BALL_R < paddle.x + PADDLE_W &&
      ball.y + BALL_R > PADDLE_Y &&
      ball.y + BALL_R < PADDLE_Y + PADDLE_H + 4
    ) {
      ball.y = PADDLE_Y - BALL_R;
      const relX  = (ball.x - (paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2);
      const angle = relX * (Math.PI / 3);
      /* bump speed */
      ballSpeed = Math.min(ballSpeed + BALL_SPEED_INC, BALL_SPEED_MAX);
      ball.dx = ballSpeed * Math.sin(angle);
      ball.dy = -Math.abs(ballSpeed * Math.cos(angle));
    }

    /* Brick collisions */
    for (const b of bricks) {
      if (!b.alive) continue;
      if (
        ball.x + BALL_R > b.x &&
        ball.x - BALL_R < b.x + b.w &&
        ball.y + BALL_R > b.y &&
        ball.y - BALL_R < b.y + b.h
      ) {
        b.alive = false;
        score += ROW_POINTS[b.row] * 10;

        /* Determine bounce axis (overlap method) */
        const overlapL = (ball.x + BALL_R) - b.x;
        const overlapR = (b.x + b.w)  - (ball.x - BALL_R);
        const overlapT = (ball.y + BALL_R) - b.y;
        const overlapB = (b.y + b.h)  - (ball.y - BALL_R);
        const minH = Math.min(overlapL, overlapR);
        const minV = Math.min(overlapT, overlapB);
        if (minH < minV) ball.dx = -ball.dx;
        else             ball.dy = -ball.dy;

        break;  // one brick per frame max
      }
    }

    /* Ball lost */
    if (ball.y - BALL_R > H) {
      lives--;
      if (lives <= 0) {
        state = 'gameover';
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem(LS_KEY, bestScore);
        }
      } else {
        state = 'dead';
        setTimeout(() => {
          if (state === 'dead') {
            resetBall();
            state = 'playing';
          }
        }, 1200);
      }
      return;
    }

    /* Level clear */
    if (bricks.every(b => !b.alive)) {
      state = 'levelclear';
      flashMsg = `LEVEL ${level} CLEAR!`;
      flashTimer = 120;
      setTimeout(() => {
        level++;
        buildBricks();
        resetBall();
        state = 'playing';
      }, 2000);
    }
  }

  /* ── Draw helpers ───────────────────────────────────────────────────── */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function glowText(text, x, y, color, size, blur) {
    ctx.save();
    ctx.font = `bold ${size}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur || 16;
    ctx.fillStyle   = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawBricks() {
    for (const b of bricks) {
      if (!b.alive) continue;
      const color = ROW_COLORS[b.row];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = color;
      roundRect(b.x, b.y, b.w, b.h, BRICK_RADIUS);
      ctx.fill();
      /* subtle shine line */
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 3);
      ctx.restore();
    }
  }

  function drawPaddle() {
    ctx.save();
    ctx.shadowColor = PADDLE_COLOR;
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = PADDLE_COLOR;
    roundRect(paddle.x, PADDLE_Y, PADDLE_W, PADDLE_H, PADDLE_RADIUS);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.shadowColor = BALL_COLOR;
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLOR;
    ctx.fill();
    /* tiny inner highlight */
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = SCORE_COLOR;

    /* Score */
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${score}`, 12, 22);

    /* Level */
    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${level}`, W / 2, 22);

    /* Lives (dots) */
    ctx.textAlign = 'right';
    ctx.fillText('LIVES', W - 12 - (LIVES_INIT * 14), 22);
    for (let i = 0; i < LIVES_INIT; i++) {
      ctx.save();
      const alive = i < lives;
      ctx.shadowColor = PADDLE_COLOR;
      ctx.shadowBlur  = alive ? 10 : 0;
      ctx.beginPath();
      ctx.arc(W - 12 - i * 14, 16, 5, 0, Math.PI * 2);
      ctx.fillStyle = alive ? PADDLE_COLOR : '#333';
      ctx.fill();
      ctx.restore();
    }

    /* Best */
    ctx.textAlign = 'right';
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText(`BEST ${bestScore}`, W - 12, 38);
    ctx.restore();
  }

  function drawDivider() {
    ctx.save();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(W, 44);
    ctx.stroke();
    ctx.restore();
  }

  /* ── Screens ────────────────────────────────────────────────────────── */
  function drawStartScreen() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    glowText('BREAKOUT', W / 2, H / 2 - 60, '#ff3860', 52, 30);

    ctx.save();
    ctx.font = '16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Smash every brick. Don\'t drop the ball.', W / 2, H / 2);
    ctx.restore();

    blinkTimer++;
    if (Math.floor(blinkTimer / 30) % 2 === 0) {
      glowText('PRESS SPACE OR TAP TO START', W / 2, H / 2 + 50, PADDLE_COLOR, 15, 12);
    }

    if (bestScore > 0) {
      ctx.save();
      ctx.font = '13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`BEST: ${bestScore}`, W / 2, H / 2 + 90);
      ctx.restore();
    }
  }

  function drawGameOverScreen() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    glowText('GAME OVER', W / 2, H / 2 - 70, '#ff3860', 44, 28);

    ctx.save();
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 - 10);

    const isNewBest = score >= bestScore && score > 0;
    ctx.fillStyle = isNewBest ? '#ffd700' : '#888';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText(
      isNewBest ? `NEW BEST: ${bestScore}!` : `BEST: ${bestScore}`,
      W / 2, H / 2 + 24
    );
    ctx.restore();

    blinkTimer++;
    if (Math.floor(blinkTimer / 30) % 2 === 0) {
      glowText('PRESS SPACE OR TAP TO PLAY AGAIN', W / 2, H / 2 + 74, PADDLE_COLOR, 14, 10);
    }
  }

  function drawDeadScreen() {
    /* Brief overlay — game still shows underneath */
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ff3860';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    glowText('BALL LOST!', W / 2, H / 2, '#fff', 36, 20);
  }

  function drawLevelClearScreen() {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    glowText(flashMsg, W / 2, H / 2 - 20, '#ffe600', 36, 24);
    glowText(`LEVEL ${level + 1} INCOMING`, W / 2, H / 2 + 26, PADDLE_COLOR, 20, 14);
  }

  function drawPlayingFlash() {
    if (flashTimer > 0) {
      const alpha = Math.min(1, flashTimer / 20);
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      glowText(flashMsg, W / 2, H / 2, '#ffe600', 36, 24);
      ctx.restore();
      flashTimer--;
    }
  }

  /* ── Main render loop ───────────────────────────────────────────────── */
  function render() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    if (state === 'start') {
      drawStartScreen();
      return;
    }

    if (state === 'gameover') {
      drawGameOverScreen();
      return;
    }

    /* Playing / dead / levelclear all show the game field */
    drawBricks();
    drawPaddle();
    drawBall();
    drawDivider();
    drawHUD();

    if (state === 'dead')       drawDeadScreen();
    if (state === 'levelclear') drawLevelClearScreen();
    if (state === 'playing')    drawPlayingFlash();

    /* "Tap to launch" hint when ball is stuck */
    if (state === 'playing' && ballStuck) {
      blinkTimer++;
      if (Math.floor(blinkTimer / 30) % 2 === 0) {
        ctx.save();
        ctx.font = '13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#aaa';
        ctx.fillText('SPACE / TAP TO LAUNCH', W / 2, H - 18);
        ctx.restore();
      }
    } else {
      blinkTimer = 0;
    }
  }

  /* ── Loop ───────────────────────────────────────────────────────────── */
  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  function boot() {
    bestScore = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
    paddle.x  = W / 2 - PADDLE_W / 2;
    ball.x    = W / 2;
    ball.y    = PADDLE_Y - BALL_R - 1;
    state     = 'start';
    score     = 0;
    lives     = LIVES_INIT;
    level     = 1;
    buildBricks();
    requestAnimationFrame(loop);
  }

  boot();
})();
