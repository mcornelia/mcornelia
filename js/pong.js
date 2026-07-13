(function () { 'use strict';

let audioCtx = null;
function initAudio() { if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } }
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

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = 480;
canvas.height = 480;

const paddleWidth = 15;
const paddleHeight = 60;
const ballSize = 10;
const baseBallSpeed = 220;
const maxBallSpeed = 480;
const playerSpeed = 320;
const aiSpeed = 210;

let state = 'START';
let lastTime = performance.now();
let playerScore = 0;
let aiScore = 0;
let totalWins = localStorage.getItem('pong_wins') ? parseInt(localStorage.getItem('pong_wins'), 10) : 0;
let gameOverSoundPlayed = false;

let playerY = canvas.height / 2 - paddleHeight / 2;
let aiY = canvas.height / 2 - paddleHeight / 2;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeedX = baseBallSpeed;
let ballSpeedY = 0;

const keys = {};

function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawCircle(x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2, false);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawText(text, x, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function resetBall() {
  ballX = canvas.width / 2;
  ballY = canvas.height / 2;
  ballSpeedX = ballSpeedX > 0 ? -baseBallSpeed : baseBallSpeed;
  ballSpeedY = 0;
}

function aiMovePaddle(dt) {
  const targetY = ballY - paddleHeight / 2 + Math.random() * 40 - 20;
  if (aiY < targetY) aiY += aiSpeed * dt;
  else if (aiY > targetY) aiY -= aiSpeed * dt;
  aiY = Math.max(0, Math.min(canvas.height - paddleHeight, aiY));
}

function update(dt) {
  if (state === 'PLAYING') {
    if (keys['ArrowUp'] || keys['KeyW']) playerY -= playerSpeed * dt;
    if (keys['ArrowDown'] || keys['KeyS']) playerY += playerSpeed * dt;
    playerY = Math.max(0, Math.min(canvas.height - paddleHeight, playerY));

    ballX += ballSpeedX * dt;
    ballY += ballSpeedY * dt;

    if (ballY <= 0 || ballY >= canvas.height) {
      ballSpeedY *= -1;
      beep(256, 0.1);
    }

    const paddleHit = (
      (ballSpeedX < 0 && ballX <= paddleWidth && ballY + ballSize >= playerY && ballY <= playerY + paddleHeight) ||
      (ballSpeedX > 0 && ballX >= canvas.width - paddleWidth - ballSize && ballY + ballSize >= aiY && ballY <= aiY + paddleHeight)
    );

    if (paddleHit) {
      const hitPaddleY = ballX < canvas.width / 2 ? playerY : aiY;
      ballSpeedX *= -1.05;
      ballSpeedY = ((ballY - (hitPaddleY + paddleHeight / 2)) / (paddleHeight / 2)) * maxBallSpeed;

      if (Math.abs(ballSpeedX) > maxBallSpeed) {
        ballSpeedX = Math.sign(ballSpeedX) * maxBallSpeed;
      }

      beep(512, 0.1);
    } else if (ballX <= 0) {
      aiScore++;
      resetBall();
      beep(128, 0.1, 0.2);
    } else if (ballX >= canvas.width) {
      playerScore++;
      resetBall();
      beep(128, 0.1, 0.2);
    }

    aiMovePaddle(dt);

    if (playerScore >= 11 || aiScore >= 11) {
      state = 'GAMEOVER';
      if (playerScore >= 11) totalWins++;
      localStorage.setItem('pong_wins', totalWins.toString());
      playGameOverSound();
    }
  }
}

function playGameOverSound() {
  if (gameOverSoundPlayed) return;
  gameOverSoundPlayed = true;
  if (playerScore >= 11) beep(768, 0.5);
}

function drawStartScreen() {
  ctx.fillStyle = '#44FF44';
  ctx.textAlign = 'center';
  drawText('PONG', canvas.width / 2, 100, '32px monospace', '#44FF44');
  drawText('W/S or ARROW KEYS to move', canvas.width / 2, 200, '16px monospace', '#44FF44');
  drawText(`WINS: ${totalWins}`, canvas.width / 2, 250, '16px monospace', '#44FF44');

  if (Math.floor(performance.now() / 500) % 2 === 0) {
    drawText('PRESS SPACE / TAP TO START', canvas.width / 2, 350, '16px monospace', '#44FF44');
  }
}

function drawGameOverScreen() {
  ctx.fillStyle = '#FF4444';
  ctx.textAlign = 'center';
  drawText(playerScore >= 11 ? 'YOU WIN' : 'YOU LOSE', canvas.width / 2, 150, '32px monospace', playerScore >= 11 ? '#44FF44' : '#FF4444');
  drawText(`FINAL SCORE: ${playerScore} - ${aiScore}`, canvas.width / 2, 250, '16px monospace', '#FFFFFF');
  drawText('PRESS SPACE / TAP TO RESTART', canvas.width / 2, 350, '16px monospace', '#44FF44');
}

function render() {
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRect(0, playerY, paddleWidth, paddleHeight, '#44FF44');
  drawRect(canvas.width - paddleWidth, aiY, paddleWidth, paddleHeight, '#FF4444');
  drawCircle(ballX, ballY, ballSize, '#FFFFFF');

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  drawText(`${playerScore} - ${aiScore}`, canvas.width / 2, 30, '20px monospace', '#FFFFFF');

  if (state === 'START') {
    drawStartScreen();
  } else if (state === 'GAMEOVER') {
    drawGameOverScreen();
  }
}

function startGame() {
  playerScore = 0;
  aiScore = 0;
  gameOverSoundPlayed = false;
  resetBall();
  state = 'PLAYING';
}

let lastTouchY = null;

canvas.addEventListener('touchstart', function(e) {
  initAudio();
  if (state === 'START' || state === 'GAMEOVER') {
    startGame();
  } else {
    const touch = e.touches[0];
    lastTouchY = touch.clientY;
  }
});

canvas.addEventListener('click', function() {
  initAudio();
  if (state === 'START' || state === 'GAMEOVER') {
    startGame();
  }
});

canvas.addEventListener('touchmove', function(e) {
  if (lastTouchY !== null && state === 'PLAYING') {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.height / rect.height;
    playerY += (e.touches[0].clientY - lastTouchY) * scale;
    lastTouchY = e.touches[0].clientY;
  }
});

canvas.addEventListener('touchend', function() {
  lastTouchY = null;
});

document.addEventListener('keydown', function(e) {
  keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    initAudio();
    if (state === 'START' || state === 'GAMEOVER') {
      startGame();
    }
  }
});

document.addEventListener('keyup', function(e) {
  keys[e.code] = false;
});

function gameLoop(time) {
  requestAnimationFrame(gameLoop);
  const realDt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  update(realDt);
  render();
}

gameLoop(performance.now());

})();