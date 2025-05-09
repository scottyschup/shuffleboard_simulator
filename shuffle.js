const canvas = document.getElementById("shuffleCanvas");
const ctx = canvas.getContext("2d");

const PX_PER_FT = 15;
const COURT_LENGTH = 52 * PX_PER_FT;
const COURT_WIDTH = 6 * PX_PER_FT;
const BISCUIT_RADIUS = 6;
const FRICTION = 0.99;

canvas.width = COURT_WIDTH;
canvas.height = COURT_LENGTH;

const biscuits = [];
let nextColor = "black";

const TRIANGLE_HEIGHT = 9 * PX_PER_FT;
const ZONE_HEIGHT = 3 * PX_PER_FT;
const KITCHEN_HEIGHT = 1.5 * PX_PER_FT;

function triangleBaseYTop() {
  return KITCHEN_HEIGHT;
}

function triangleBaseYBottom() {
  return canvas.height - KITCHEN_HEIGHT;
}

class Biscuit {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = BISCUIT_RADIUS;
    this.color = color;
    this.stopped = false;
    this.score = null;
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (this.stopped && this.score !== null) {
      ctx.fillStyle = this.color === "black" ? "white" : "black";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(this.score, this.x - 6, this.y + 4);
    }
  }

  update() {
    if (this.stopped) return;

    this.x += this.vx;
    this.y += this.vy;
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    if (Math.abs(this.vx) < 0.05 && Math.abs(this.vy) < 0.05) {
      this.vx = this.vy = 0;
      this.stopped = true;
      this.score = getScoreZone(this);
    }

    if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
      this.vx *= -1;
    }
    if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
      this.vy *= -1;
    }
  }
}

function drawScoringZones() {
  drawTriangle(triangleBaseYTop(), 1);    // Top triangle
  drawTriangle(triangleBaseYBottom(), -1); // Bottom triangle

  // Top kitchen (at y = 0 to 1.5 PX_PER_FT)
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, KITCHEN_HEIGHT);
  ctx.fillStyle = "#ffdddd";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "black";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("-10", canvas.width / 2, KITCHEN_HEIGHT - 5);

  // Bottom kitchen
  const bottomY = canvas.height - KITCHEN_HEIGHT;
  ctx.beginPath();
  ctx.rect(0, bottomY, canvas.width, KITCHEN_HEIGHT);
  ctx.fillStyle = "#ffdddd";
  ctx.fill();
  ctx.stroke();
  ctx.fillText("-10", canvas.width / 2, bottomY + 18);
}

function drawTriangle(baseY, direction) {
  const centerX = canvas.width / 2;
  const tipY = baseY + direction * TRIANGLE_HEIGHT;

  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(centerX, tipY);
  ctx.lineTo(canvas.width, baseY);
  ctx.closePath();
  ctx.fillStyle = "#d1e8ff";
  ctx.fill();
  ctx.stroke();

  // Scoring zone lines
  for (let i = 1; i < 3; i++) {
    const y = baseY + direction * i * ZONE_HEIGHT;
    const widthAtY = canvas.width * (1 - i / 3);
    ctx.beginPath();
    ctx.moveTo(centerX - widthAtY / 2, y);
    ctx.lineTo(centerX + widthAtY / 2, y);
    ctx.stroke();
  }

  // Labels
  ctx.fillStyle = "black";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("10", centerX, tipY + (direction === 1 ? 15 : -5));
  ctx.fillText("8", centerX, baseY + direction * ZONE_HEIGHT + (direction === 1 ? 15 : -5));
  ctx.fillText("7", centerX, baseY + direction * ZONE_HEIGHT * 2 + (direction === 1 ? 15 : -5));
}

function getScoreZone(biscuit) {
  const x = biscuit.x;
  const y = biscuit.y;
  const centerX = canvas.width / 2;

  // Kitchen zones
  if (y <= KITCHEN_HEIGHT) return -10;
  if (y >= canvas.height - KITCHEN_HEIGHT) return -10;

  function triangleScore(baseY, direction) {
    const localY = (y - baseY) * direction;
    if (localY < 0 || localY > TRIANGLE_HEIGHT) return null;

    const progress = localY / TRIANGLE_HEIGHT;
    const halfWidth = (canvas.width / 2) * (1 - progress);
    const dx = Math.abs(x - centerX);
    if (dx > halfWidth) return null;

    if (localY < ZONE_HEIGHT) return 7;
    else if (localY < ZONE_HEIGHT * 2) return 8;
    else return 10;
  }

  const topScore = triangleScore(triangleBaseYTop(), 1);
  if (topScore !== null) return topScore;

  const bottomScore = triangleScore(triangleBaseYBottom(), -1);
  if (bottomScore !== null) return bottomScore;

  return null;
}

function resolveCollision(b1, b2) {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < b1.radius + b2.radius) {
    const angle = Math.atan2(dy, dx);
    const speed1 = Math.sqrt(b1.vx ** 2 + b1.vy ** 2);
    const speed2 = Math.sqrt(b2.vx ** 2 + b2.vy ** 2);

    const dir1 = Math.atan2(b1.vy, b1.vx);
    const dir2 = Math.atan2(b2.vy, b2.vx);

    const vx1 = speed1 * Math.cos(dir1 - angle);
    const vy1 = speed1 * Math.sin(dir1 - angle);
    const vx2 = speed2 * Math.cos(dir2 - angle);
    const vy2 = speed2 * Math.sin(dir2 - angle);

    b1.vx = Math.cos(angle) * vx2 + Math.cos(angle + Math.PI / 2) * vy1;
    b1.vy = Math.sin(angle) * vx2 + Math.sin(angle + Math.PI / 2) * vy1;
    b2.vx = Math.cos(angle) * vx1 + Math.cos(angle + Math.PI / 2) * vy2;
    b2.vy = Math.sin(angle) * vx1 + Math.sin(angle + Math.PI / 2) * vy2;

    const overlap = b1.radius + b2.radius - distance;
    const offsetX = (dx / distance) * (overlap / 2);
    const offsetY = (dy / distance) * (overlap / 2);
    b1.x -= offsetX;
    b1.y -= offsetY;
    b2.x += offsetX;
    b2.y += offsetY;
  }
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScoringZones();

  for (let i = 0; i < biscuits.length; i++) {
    biscuits[i].update();
    for (let j = i + 1; j < biscuits.length; j++) {
      resolveCollision(biscuits[i], biscuits[j]);
    }
    biscuits[i].draw();
  }

  requestAnimationFrame(update);
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.lePX_PER_FT;
  const y = e.clientY - rect.top;

  const biscuit = new Biscuit(x, y, nextColor);
  biscuit.vy = y > canvas.height / 2 ? -6 : 6;
  biscuits.push(biscuit);

  nextColor = nextColor === "black" ? "yellow" : "black";
});

update();
