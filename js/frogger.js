(function () { 'use strict';
const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d');
canvas.width = 480; canvas.height = 480;
let state = 'START';
let gameResult = null;
let lastTime = performance.now();
let score = 0;
let lives = 3;
let highScore = parseInt(localStorage.getItem('frogger_highscore'), 10) || 0;
let frogX = 200; let frogY = 440;
let ridingLog = null;
const gridCellSize = 40;
const numRows = 12; const numCols = 12;
const carRows = [5, 6, 7, 8];
const logRows = [1, 2, 3];
let vehicles = [];
let logs = [];
let goals = [{x: 40, y: 0, filled: false}, {x: 160, y: 0, filled: false}, {x: 280, y: 0, filled: false}];
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq, duration, vol) {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}
function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawFrog(x, y, size) {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + size * 0.28, y + size * 0.28, 4, 4);
    ctx.fillRect(x + size * 0.68, y + size * 0.28, 4, 4);
}
function drawVehicle(x, y, w, h, color) {
    const bodyY = y + h * 0.2;
    const bodyH = h * 0.6;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, bodyY, w - 4, bodyH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, bodyY, w - 4, bodyH);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + w * 0.15, bodyY + bodyH * 0.15, w * 0.3, bodyH * 0.5);
    ctx.fillRect(x + w * 0.55, bodyY + bodyH * 0.15, w * 0.3, bodyH * 0.5);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x + w * 0.2, y + h * 0.82, h * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.8, y + h * 0.82, h * 0.16, 0, Math.PI * 2);
    ctx.fill();
}
function drawLog(x, y, w, h) {
    ctx.fillStyle = 'saddlebrown';
    ctx.fillRect(x, y + 6, w, h - 12);
    ctx.strokeStyle = '#3d2410';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 6, w, h - 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h / 2);
    ctx.lineTo(x + w - 2, y + h / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(x + w * 0.25, y + h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
}
function drawText(text, x, y, font, color) { ctx.font = font; ctx.fillStyle = color; ctx.fillText(text, x, y); }
document.addEventListener('keydown', function(e) {
    if (state === 'START' || state === 'GAMEOVER') {
        if (e.key === ' ' || e.key === 'Enter') { initAudio(); startGame(); }
    } else if (state === 'PLAYING') {
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                moveFrog(0, -1); break;
            case 'ArrowDown':
            case 's':
            case 'S':
                moveFrog(0, 1); break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                moveFrog(-1, 0); break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                moveFrog(1, 0); break;
        }
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) e.preventDefault();
});
let touchStartX, touchStartY;
canvas.addEventListener('touchstart', function(e) {
    initAudio(); e.preventDefault();
    if (state === 'START' || state === 'GAMEOVER') startGame();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});
canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
});
canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    if (!touchStartX || !touchStartY) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > 30 || absDy > 30) {
        if (absDx > absDy) {
            if (dx > 0) moveFrog(1, 0); else moveFrog(-1, 0);
        } else {
            if (dy > 0) moveFrog(0, 1); else moveFrog(0, -1);
        }
    }
    touchStartX = null;
    touchStartY = null;
});
canvas.addEventListener('click', function(e) {
    initAudio(); e.preventDefault();
    if (state === 'START' || state === 'GAMEOVER') startGame();
});
function startGame() {
    score = 0;
    lives = 3;
    frogX = 200; frogY = 440;
    ridingLog = null;
    goals.forEach(goal => goal.filled = false);
    vehicles = [];
    logs = [];
    carRows.forEach((row, rowIndex) => {
        const speed = (row % 2 === 1) ? -(77 + rowIndex * 12) : (69 + rowIndex * 12);
        const spacing = 160;
        const count = Math.ceil(canvas.width / spacing) + 1;
        for (let i = 0; i < count; i++) {
            let x = i * spacing - (row % 2 === 1 ? 0 : spacing / 2);
            vehicles.push({x, y: row * gridCellSize, width: Math.random() > 0.5 ? 80 : 60, height: gridCellSize, speed});
        }
    });
    logRows.forEach((row, rowIndex) => {
        const speed = (row % 2 === 1) ? -(38 + rowIndex * 7) : (34 + rowIndex * 7);
        const spacing = 140;
        const count = Math.ceil(canvas.width / spacing) + 1;
        for (let i = 0; i < count; i++) {
            let x = i * spacing - (row % 2 === 1 ? 0 : spacing / 2);
            logs.push({x, y: row * gridCellSize, width: Math.random() > 0.5 ? 80 : 60, height: gridCellSize, speed});
        }
    });
    state = 'PLAYING';
    gameResult = null;
}
function moveFrog(dx, dy) {
    if (state !== 'PLAYING') return;
    const newX = frogX + dx * gridCellSize;
    const newY = frogY + dy * gridCellSize;
    if (newX >= 0 && newX < canvas.width - gridCellSize && newY >= 0 && newY < canvas.height - gridCellSize) {
        frogX = newX; frogY = newY;
        checkCollision();
        beep(440, 0.1, 0.5);
    }
}
function checkCollision() {
    ridingLog = null;
    if (frogY === 0) {
        const goalIndex = goals.findIndex(goal => frogX >= goal.x && frogX < goal.x + gridCellSize);
        if (goalIndex !== -1 && !goals[goalIndex].filled) {
            goals[goalIndex].filled = true;
            score += 500;
            beep(880, 0.2, 0.6);
            if (goals.every(goal => goal.filled)) {
                endGame('WIN');
            }
        } else {
            loseLife();
        }
    } else if (frogY >= logRows[0] * gridCellSize && frogY <= logRows[logRows.length - 1] * gridCellSize) {
        const log = logs.find(log => frogX + gridCellSize > log.x && frogX < log.x + log.width && frogY === log.y);
        if (log) {
            ridingLog = log;
        } else {
            loseLife();
        }
    } else if (frogY >= carRows[0] * gridCellSize && frogY <= carRows[carRows.length - 1] * gridCellSize) {
        const vehicle = vehicles.find(vehicle => frogX + gridCellSize > vehicle.x && frogX < vehicle.x + vehicle.width && frogY === vehicle.y);
        if (vehicle) {
            loseLife();
        }
    }
}
function loseLife() {
    resetFrog();
    lives--;
    beep(196, 0.3, 0.5);
    if (lives <= 0) endGame('LOSE');
}
function resetFrog() {
    frogX = 200; frogY = 440;
    ridingLog = null;
}
function endGame(result) {
    state = 'GAMEOVER';
    gameResult = result;
    highScore = Math.max(highScore, score);
    localStorage.setItem('frogger_highscore', highScore.toString());
    beep(result === 'WIN' ? 880 : 130.81, 0.5, 0.7);
}
function update(dt) {
    if (state !== 'PLAYING') return;
    vehicles.forEach(vehicle => {
        vehicle.x += vehicle.speed * dt;
        if (vehicle.x < -vehicle.width) vehicle.x = canvas.width;
        else if (vehicle.x > canvas.width) vehicle.x = -vehicle.width;
    });
    logs.forEach(log => {
        log.x += log.speed * dt;
        if (log.x < -log.width) log.x = canvas.width;
        else if (log.x > canvas.width) log.x = -log.width;
    });
    if (ridingLog) {
        frogX += ridingLog.speed * dt;
        if (frogX < 0 || frogX > canvas.width - gridCellSize) {
            loseLife();
        }
    }
}
function render(dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRect(0, 0, canvas.width, gridCellSize, '#228B22');
    drawRect(0, gridCellSize, canvas.width, 3 * gridCellSize, '#1E90FF');
    drawRect(0, 4 * gridCellSize, canvas.width, gridCellSize, '#32CD32');
    drawRect(0, 5 * gridCellSize, canvas.width, 4 * gridCellSize, '#404040');
    drawRect(0, 9 * gridCellSize, canvas.width, 3 * gridCellSize, '#32CD32');
    if (state === 'START' || state === 'GAMEOVER') {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        drawText('FROGGER', canvas.width / 2, canvas.height / 2 - 60, '48px monospace', '#FFD700');
        if (state === 'START') drawText('Press SPACE or Tap to Start', canvas.width / 2, canvas.height / 2, '24px monospace', '#FFFFFF');
        else {
            const resultMessage = gameResult === 'WIN' ? 'YOU WIN!' : 'GAME OVER';
            drawText(resultMessage, canvas.width / 2, canvas.height / 2 - 30, '36px monospace', '#FFD700');
            drawText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 5, '18px monospace', '#FFFFFF');
            if (Math.floor(performance.now() / 500) % 2 === 0) drawText('PRESS SPACE / TAP TO RESTART', canvas.width / 2, canvas.height / 2 + 40, '20px monospace', '#FFFFFF');
        }
        drawText(`High Score: ${highScore}`, canvas.width / 2, canvas.height - 30, '20px monospace', '#FFFFFF');
    } else if (state === 'PLAYING') {
        goals.forEach(goal => drawRect(goal.x + 2, goal.y + 2, gridCellSize - 4, gridCellSize - 4, goal.filled ? '#FFD700' : '#145214'));
        logs.forEach(log => drawLog(log.x, log.y, log.width, log.height));
        vehicles.forEach(vehicle => drawVehicle(vehicle.x, vehicle.y, vehicle.width, vehicle.height, '#FF6347'));
        drawFrog(frogX, frogY, gridCellSize);
        ctx.textAlign = 'left';
        drawText(`Score: ${score}`, 20, 38, '24px monospace', '#FFFFFF');
        drawText(`Lives: ${lives}`, canvas.width - 120, 38, '24px monospace', '#FFFFFF');
    }
}
function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    const realDt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    update(realDt);
    render(realDt);
}
gameLoop(performance.now());
})();
