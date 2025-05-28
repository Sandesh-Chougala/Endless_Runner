import {
  ref,
  set,
  get,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

let canvas, ctx;
let player, obstacles = [], gameSpeed = 5, score = 0, gameOver = false, playerName = "";
let patternCooldown = 0;
const gravity = 0.4;
let isPlayerImageLoaded = false;
let pause = false;

// Backgrounds
const bgLayer1 = new Image();
const bgLayer2 = new Image();
bgLayer1.src = "./img/b1.png";
bgLayer2.src = "./img/b2.png";

let bgX1 = 0, bgX2 = 0;

// Player sprite
const playerSprite = new Image();
playerSprite.src = "./img/player-img.png";
const spriteWidth = 40;
const spriteHeight = 40;
const spriteFrames = 1;
let currentFrame = 0;
let frameCount = 0;

playerSprite.onload = () => { isPlayerImageLoaded = true; };

document.getElementById("start-game").addEventListener("click", startGame);
document.addEventListener("keydown", handleKey);
document.addEventListener("touchstart", handleJump);
document.addEventListener("click", handleJump);

function startGame() {
  const input = document.getElementById("player-name").value.trim();
  if (!input) return alert("Please enter your name.");
  playerName = input;
  localStorage.setItem("playerName", playerName);

  document.getElementById("login-container").style.display = "none";
  document.getElementById("game-container").style.display = "block";

  setupGame();
  gameLoop();
}

function setupGame() {
  const oldCanvas = document.querySelector("#game-screen canvas");
  if (oldCanvas) oldCanvas.remove();

  canvas = document.createElement("canvas");
  canvas.width = Math.min(800, window.innerWidth - 20);
  canvas.height = Math.max(200, window.innerHeight / 3);
  ctx = canvas.getContext("2d");
  document.getElementById("game-screen").appendChild(canvas);

  player = {
    x: 50,
    y: canvas.height - spriteHeight,
    width: spriteWidth,
    height: spriteHeight,
    velocityY: 0,
    isJumping: false,
  };

  obstacles = [];
  gameSpeed = 2;
  score = 0;
  gameOver = false;
  patternCooldown = 0;

  bgX1 = bgX2 = 0;
  pause = false;

  updateLeaderboardDisplay();
}

function gameLoop() {
  if (!isPlayerImageLoaded || !bgLayer1.complete || !bgLayer2.complete) {
    requestAnimationFrame(gameLoop);
    return;
  }

  if (!pause) update();
  draw();

  if (!gameOver) requestAnimationFrame(gameLoop);
}

function update() {
  bgX1 -= gameSpeed * 0.1;
  bgX2 -= gameSpeed * 0.5;
  if (bgX1 <= -canvas.width) bgX1 = 0;
  if (bgX2 <= -canvas.width) bgX2 = 0;

  if (player.isJumping) {
    player.y += player.velocityY;
    player.velocityY += gravity;
    if (player.y >= canvas.height - player.height) {
      player.y = canvas.height - player.height;
      player.isJumping = false;
    }
  }

  obstacles.forEach(o => o.x -= gameSpeed);
  obstacles = obstacles.filter(o => o.x + o.width > 0);

  if (patternCooldown <= 0) {
    spawnObstaclePattern();
    patternCooldown = Math.max(90, 150 - Math.floor(score / 10));
  } else {
    patternCooldown--;
  }

  if (obstacles.some(o => checkCollision(player, o))) {
    gameOver = true;
    updateLeaderboard();
  }

  score++;
  if (score % 100 === 0 && gameSpeed < 80) gameSpeed += 0.5;

  frameCount++;
  if (frameCount >= 6) {
    currentFrame = (currentFrame + 1) % spriteFrames;
    frameCount = 0;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(bgLayer1, bgX1, 0, canvas.width, canvas.height);
  ctx.drawImage(bgLayer1, bgX1 + canvas.width, 0, canvas.width, canvas.height);
  ctx.drawImage(bgLayer2, bgX2, 0, canvas.width, canvas.height);
  ctx.drawImage(bgLayer2, bgX2 + canvas.width, 0, canvas.width, canvas.height);

  ctx.drawImage(
    playerSprite,
    currentFrame * spriteWidth, 0, spriteWidth, spriteHeight,
    player.x, player.y, player.width, player.height
  );

  ctx.fillStyle = "red";
  obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.width, o.height));

  ctx.fillStyle = "#222";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${score}`, 10, 25);
  ctx.fillText(`Speed: ${gameSpeed.toFixed(1)}`, 10, 45);

  if (pause) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, canvas.height / 2 - 30, canvas.width, 60);
    ctx.fillStyle = "#fff";
    ctx.font = "30px Arial";
    ctx.fillText("PAUSED", canvas.width / 2 - 60, canvas.height / 2 + 10);
  }

  if (gameOver) {
    ctx.fillStyle = "darkred";
    ctx.font = "20px Arial";
    ctx.fillText("GAME OVER! Tap or press Space to Restart", canvas.width / 2 - 180, canvas.height / 2);
  }
}

function spawnObstaclePattern() {
  const types = ["single", "cluster", "stairs", "gap"];
  const weights = getPatternWeights();
  const type = weightedRandom(types, weights);

  switch (type) {
    case "single":
      obstacles.push(createObstacle(canvas.width, 20, rand(20, 40)));
      break;
    case "cluster":
      const count = score < 500 ? 2 : 3;
      for (let i = 0; i < count; i++) {
        obstacles.push(createObstacle(canvas.width + i * 30, 20, rand(20, 40)));
      }
      break;
    case "stairs":
      const base = rand(15, 25);
      for (let i = 0; i < 3; i++) {
        obstacles.push(createObstacle(canvas.width + i * 30, 20, base + i * 10));
      }
      break;
    case "gap":
      obstacles.push(createObstacle(canvas.width, 20, rand(20, 40)));
      obstacles.push(createObstacle(canvas.width + 100, 20, rand(20, 40)));
      break;
  }
}

function getPatternWeights() {
  if (score < 200) return [80, 10, 5, 5];
  if (score < 500) return [50, 30, 15, 5];
  if (score < 800) return [30, 30, 25, 15];
  return [20, 25, 30, 25];
}

function createObstacle(x, width, height) {
  return { x, y: canvas.height - height, width, height };
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let rnd = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    if (rnd < weights[i]) return items[i];
    rnd -= weights[i];
  }
  return items[items.length - 1];
}

function handleKey(e) {
  if (e.code === "Space") {
    if (gameOver) {
      setupGame();
      gameLoop();
    } else if (!player.isJumping && !pause) {
      player.isJumping = true;
      player.velocityY = -10;
    }
  }
  if (e.code === "KeyP") {
    pause = !pause;
    if (!pause && !gameOver) gameLoop();
  }
}

function handleJump() {
  if (gameOver) {
    setupGame();
    gameLoop();
  } else if (!player.isJumping && !pause) {
    player.isJumping = true;
    player.velocityY = -10;
  }
}

// 🏆 Firebase Leaderboard
async function updateLeaderboard() {
  const db = window.db;
  const playerKey = playerName.trim().toLowerCase();
  const playerRef = ref(db, `leaderboard/${playerKey}`);

  const snapshot = await get(playerRef);
  const existing = snapshot.exists() ? snapshot.val().score : null;

  if (existing === null || score > existing) {
    await set(playerRef, {
      name: playerName,
      score,
      timestamp: Date.now()
    });
  }

  updateLeaderboardDisplay();
}

async function updateLeaderboardDisplay() {
  const db = window.db;
  const leaderboardRef = query(ref(db, "leaderboard"), orderByChild("score"), limitToLast(5));

  const snapshot = await get(leaderboardRef);
  const entries = [];
  snapshot.forEach(child => entries.push(child.val()));
  entries.sort((a, b) => b.score - a.score);

  const list = document.getElementById("leaderboard");
  list.innerHTML = "";
  entries.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = `${entry.name}: ${entry.score}`;
    list.appendChild(li);
  });
}

// Load player name from localStorage
window.onload = () => {
  const saved = localStorage.getItem("playerName");
  if (saved) document.getElementById("player-name").value = saved;
};
