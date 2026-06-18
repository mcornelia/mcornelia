/**
 * Snake — mcornelia.com arcade
 * Canvas 480×480, grid 24×24 at 20px per cell.
 */
(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  const CANVAS_SIZE   = 480;
  const CELL          = 20;
  const COLS          = CANVAS_SIZE / CELL; // 24
  const ROWS          = CANVAS_SIZE / CELL; // 24

  const COLOR_BG      = '#111111';
  const COLOR_GRID    = '#1a1a1a';
  const COLOR_SNAKE   = '#39ff14';   // neon green
  const COLOR_SNAKE_H = '#7fff3a';   // lighter head
  const COLOR_FOOD    = '#ff3b3b';   // bright red
  const COLOR_FOOD_EX = '#ff9500';   // extra food (bonus)
  const COLOR_TEXT    = '#e8e8e8';
  const COLOR_DIM     = '#666666';
  const COLOR_SCORE   = '#39ff14';

  const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };

  // Base tick interval (ms). Decreases as score increases.
  const BASE_SPEED   = 150;
  const MIN_SPEED    = 55;
  const SPEED_STEP   = 8;   // ms faster per 5 food eaten

  const HS_KEY = 'snake_highscore';

  // ─── State ────────────────────────────────────────────────────────────────
  let canvas, ctx;
  let state        = 'START';  // START | PLAYING | DEAD
  let snake        = [];       // [{x,y}, ...] head first
  let dir          = DIR.RIGHT;
  let pendingDir   = DIR.RIGHT;
  let food         = null;
  let score        = 0;
  let highScore    = 0;
  let tickInterval = null;
  let tickMs       = BASE_SPEED;
  let foodEaten    = 0;
  let flashTimer   = 0;        // frames for food-eat flash
  let flashCell    = null;

  // Touch tracking
  let touchStartX = 0;
  let touchStartY = 0;

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');

    highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10);

    canvas.addEventListener('keydown', onKey);
    // Make canvas focusable so it captures keys when clicked
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none';

    // Also listen on document for convenience
    document.addEventListener('keydown', onKey);

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: true });
    canvas.addEventListener('click',      onTap);

    drawStart();
  }

  // ─── Game lifecycle ───────────────────────────────────────────────────────
  function startGame() {
    // Build initial snake in the middle, length 3, pointing right
    const midY = Math.floor(ROWS / 2);
    const midX = Math.floor(COLS / 2);
    snake = [
      { x: midX,     y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    dir        = DIR.RIGHT;
    pendingDir = DIR.RIGHT;
    score      = 0;
    foodEaten  = 0;
    flashTimer = 0;
    flashCell  = null;
    tickMs     = BASE_SPEED;

    placeFood();

    state = 'PLAYING';
    scheduleNext();
    requestAnimationFrame(renderLoop);
  }

  function scheduleNext() {
    clearTimeout(tickInterval);
    tickInterval = setTimeout(tick, tickMs);
  }

  function tick() {
    if (state !== 'PLAYING') return;

    dir = pendingDir;

    // Compute new head
    const head = snake[0];
    let nx = head.x, ny = head.y;
    if (dir === DIR.UP)    ny--;
    if (dir === DIR.DOWN)  ny++;
    if (dir === DIR.LEFT)  nx--;
    if (dir === DIR.RIGHT) nx++;

    // Wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      die();
      return;
    }

    // Self collision (don't check the tail tip — it will move away)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        die();
        return;
      }
    }

    const newHead = { x: nx, y: ny };
    snake.unshift(newHead);

    // Check food
    if (food && nx === food.x && ny === food.y) {
      score++;
      foodEaten++;
      flashTimer = 6;
      flashCell  = { x: food.x, y: food.y };
      food = null;

      // Save high score
      if (score > highScore) {
        highScore = score;
        localStorage.setItem(HS_KEY, highScore);
      }

      // Speed up every 5 food
      if (foodEaten % 5 === 0) {
        tickMs = Math.max(MIN_SPEED, tickMs - SPEED_STEP);
      }

      placeFood();
      // Don't pop tail — snake grows
    } else {
      snake.pop();
    }

    scheduleNext();
  }

  function die() {
    clearTimeout(tickInterval);
    state = 'DEAD';
  }

  // ─── Food placement ───────────────────────────────────────────────────────
  function placeFood() {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    let x, y;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
      attempts++;
    } while (occupied.has(`${x},${y}`) && attempts < 500);
    food = { x, y };
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  let rafId = null;

  function renderLoop() {
    draw();
    if (state === 'PLAYING' || state === 'DEAD') {
      rafId = requestAnimationFrame(renderLoop);
    }
  }

  function draw() {
    if (state === 'START') { drawStart(); return; }
    if (state === 'DEAD')  { drawDead();  return; }
    drawGame();
  }

  function clearCanvas() {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function drawGrid() {
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth   = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, CANVAS_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(CANVAS_SIZE, y * CELL);
      ctx.stroke();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawSnake() {
    const pad = 2;
    const r   = 4;
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const px  = seg.x * CELL + pad;
      const py  = seg.y * CELL + pad;
      const sz  = CELL - pad * 2;

      // Gradient: slightly brighter at head
      const t = i === 0 ? 1 : Math.max(0.4, 1 - i / snake.length);
      ctx.fillStyle = i === 0 ? COLOR_SNAKE_H : lerpColor(COLOR_BG, COLOR_SNAKE, t);

      roundRect(px, py, sz, sz, r);
      ctx.fill();

      // Subtle inner glow on head
      if (i === 0) {
        ctx.strokeStyle = '#b0ff7a';
        ctx.lineWidth   = 1;
        roundRect(px + 1, py + 1, sz - 2, sz - 2, r - 1);
        ctx.stroke();
      }
    }
  }

  function drawFood() {
    if (!food) return;
    const px = food.x * CELL;
    const py = food.y * CELL;
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    const rad = CELL / 2 - 3;

    // Pulsing glow
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
    ctx.shadowColor = COLOR_FOOD;
    ctx.shadowBlur  = 10 * pulse;

    ctx.fillStyle = COLOR_FOOD;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx - rad * 0.3, cy - rad * 0.3, rad * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlash() {
    if (flashTimer <= 0 || !flashCell) return;
    const alpha = flashTimer / 6;
    const px = flashCell.x * CELL;
    const py = flashCell.y * CELL;
    ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.6})`;
    ctx.fillRect(px, py, CELL, CELL);
    flashTimer--;
  }

  function drawHUD() {
    ctx.shadowBlur  = 0;
    ctx.font        = 'bold 14px monospace';
    ctx.textBaseline = 'top';

    // Score on left
    ctx.fillStyle = COLOR_SCORE;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${score}`, 8, 8);

    // High score on right
    ctx.fillStyle = COLOR_DIM;
    ctx.textAlign = 'right';
    ctx.fillText(`BEST  ${highScore}`, CANVAS_SIZE - 8, 8);

    ctx.shadowBlur = 0;
  }

  function drawGame() {
    clearCanvas();
    drawGrid();
    drawFlash();
    drawFood();
    drawSnake();
    drawHUD();
  }

  function drawStart() {
    clearCanvas();
    drawGrid();

    // Title
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = COLOR_SNAKE;
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = COLOR_SNAKE;
    ctx.font        = 'bold 52px monospace';
    ctx.fillText('SNAKE', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 48);

    ctx.shadowBlur = 0;
    ctx.fillStyle  = COLOR_TEXT;
    ctx.font       = '16px monospace';
    ctx.fillText('Press Space or tap to start', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 12);

    if (highScore > 0) {
      ctx.fillStyle = COLOR_DIM;
      ctx.font      = '13px monospace';
      ctx.fillText(`Best: ${highScore}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 44);
    }

    // Arrow hint
    ctx.fillStyle = COLOR_DIM;
    ctx.font      = '12px monospace';
    ctx.fillText('Arrow keys / WASD to move', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 72);
  }

  function drawDead() {
    // Draw the frozen game board first
    clearCanvas();
    drawGrid();
    if (food) drawFood();
    drawSnake();

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // "GAME OVER"
    ctx.fillStyle  = '#ff3b3b';
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur  = 20;
    ctx.font        = 'bold 44px monospace';
    ctx.fillText('GAME OVER', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 52);

    ctx.shadowBlur = 0;

    // Score
    ctx.fillStyle = COLOR_TEXT;
    ctx.font      = 'bold 20px monospace';
    ctx.fillText(`Score: ${score}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 2);

    // High score
    ctx.fillStyle = score >= highScore && score > 0 ? '#ffd700' : COLOR_DIM;
    ctx.font      = '15px monospace';
    if (score >= highScore && score > 0) {
      ctx.fillText(`New Best: ${highScore}!`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 32);
    } else {
      ctx.fillText(`Best: ${highScore}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 32);
    }

    // Restart prompt — blink
    const blink = Math.floor(Date.now() / 600) % 2 === 0;
    if (blink) {
      ctx.fillStyle = COLOR_TEXT;
      ctx.font      = '14px monospace';
      ctx.fillText('Press Space or tap to restart', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 68);
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────
  function onKey(e) {
    const k = e.key;

    if (state === 'START' || state === 'DEAD') {
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        startGame();
        return;
      }
    }

    if (state !== 'PLAYING') return;

    // Prevent page scroll on arrow keys
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k)) {
      e.preventDefault();
    }

    setDir(k);
  }

  function setDir(key) {
    // Accept arrow keys and WASD; no 180° reversal
    const map = {
      ArrowUp:    DIR.UP,
      ArrowDown:  DIR.DOWN,
      ArrowLeft:  DIR.LEFT,
      ArrowRight: DIR.RIGHT,
      w: DIR.UP,  W: DIR.UP,
      s: DIR.DOWN, S: DIR.DOWN,
      a: DIR.LEFT, A: DIR.LEFT,
      d: DIR.RIGHT, D: DIR.RIGHT,
    };
    const newDir = map[key];
    if (newDir === undefined) return;

    // Prevent reversing
    const opposite = { [DIR.UP]: DIR.DOWN, [DIR.DOWN]: DIR.UP, [DIR.LEFT]: DIR.RIGHT, [DIR.RIGHT]: DIR.LEFT };
    if (newDir !== opposite[dir]) {
      pendingDir = newDir;
    }
  }

  function onTap() {
    if (state === 'START' || state === 'DEAD') {
      startGame();
    }
  }

  function onTouchStart(e) {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }

  function onTouchEnd(e) {
    if (state === 'START' || state === 'DEAD') {
      startGame();
      return;
    }
    if (state !== 'PLAYING') return;

    const t  = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const threshold = 20;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return; // tap, not swipe

    if (Math.abs(dx) > Math.abs(dy)) {
      setDir(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      setDir(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function lerpColor(c1, c2, t) {
    // Very simple hex lerp for snake body gradient
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r  = Math.round(r1 + (r2 - r1) * t);
    const g  = Math.round(g1 + (g2 - g1) * t);
    const b  = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }

  // ─── Start ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
