const canvas = document.getElementById("shuffleCanvas");
const ctx = canvas.getContext("2d");

// Scale (1 ft = 15 px)
const FT = 15;
const COURT_LENGTH = 52 * FT;
const COURT_WIDTH = 6 * FT;

canvas.width = COURT_LENGTH;
canvas.height = COURT_WIDTH;

const BISCUIT_RADIUS = 6; // about 6 inches
const FRICTION = 0.99;
const biscuits = [];

class Biscuit {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = BISCUIT_RADIUS;
    this.color = color;
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    // Bounce off edges
    if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
      this.vx *= -1;
    }
    if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
      this.vy *= -1;
    }
  }
}

// Collision detection between two biscuits
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

    const final_vx1 = vx2;
    const final_vx2 = vx1;

    b1.vx = Math.cos(angle) * final_vx1 + Math.cos(angle + Math.PI / 2) * vy1;
    b1.vy = Math.sin(angle) * final_vx1 + Math.sin(angle + Math.PI / 2) * vy1;
    b2.vx = Math.cos(angle) * final_vx2 + Math.cos(angle + Math.PI / 2) * vy2;
    b2.vy = Math.sin(angle) * final_vx2 + Math.sin(angle + Math.PI / 2) * vy2;

    // Separate the biscuits to avoid sticking
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

  for (let i = 0; i < biscuits.length; i++) {
    biscuits[i].update();
    for (let j = i + 1; j < biscuits.length; j++) {
      resolveCollision(biscuits[i], biscuits[j]);
    }
    biscuits[i].draw();
  }

  requestAnimationFrame(update);
}

// Add biscuit on click
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const biscuit = new Biscuit(x, y, randomColor());
  // Shoot the biscuit forward
  biscuit.vx = 6;
  biscuit.vy = 0;
  biscuits.push(biscuit);
});

function randomColor() {
  return `hsl(${Math.random() * 360}, 80%, 60%)`;
}

update();
