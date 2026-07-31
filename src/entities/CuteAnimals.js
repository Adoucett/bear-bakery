/**
 * Cute full-body bakery animals — consistent cartoon style (not realistic).
 * Drawn in-code so every species matches. Supports idle breath + walk cycle.
 *
 * Coordinate system: origin at feet center; +x faces right; units relative to `s` (body scale).
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {string} opts.id species id
 * @param {number} opts.x top-left of character box
 * @param {number} opts.y top-left of character box
 * @param {number} opts.size box size (species scale)
 * @param {string} opts.color primary fill
 * @param {string} opts.accent secondary fill
 * @param {number} opts.facing 1 right, -1 left
 * @param {number} opts.time global time
 * @param {boolean} opts.walking
 */
export function drawCuteAnimal(ctx, opts) {
  const { id, x, y, size: s, color, accent, facing = 1, time = 0, walking = false } = opts;

  const breath = Math.sin(time * 2.4 + x * 0.01) * (walking ? 0.4 : 1.1);
  const walk = walking ? Math.sin(time * 10) : 0;
  const blink = Math.sin(time * 0.7 + x) > 0.96;
  const earTwitch = Math.sin(time * 3.5 + y) * (walking ? 0 : 0.08);

  // Shadow under feet
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s - 1, s * 0.32, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x + s / 2, y + s * 0.92);
  ctx.scale(facing, 1);
  // Normalize: draw in unit space where body height ≈ s
  ctx.scale(s / 48, s / 48);
  ctx.translate(0, breath * 0.8);

  const drawer = DRAWERS[id] || DRAWERS.bear;
  drawer(ctx, {
    color,
    accent,
    walk,
    blink,
    earTwitch,
    walking,
    time,
  });

  ctx.restore();
}

/** Shared cute face helper (eyes + smile + blush) */
function face(ctx, ox, oy, blink, scale = 1) {
  // Blush
  ctx.fillStyle = 'rgba(255, 140, 160, 0.35)';
  ctx.beginPath();
  ctx.ellipse(ox - 5 * scale, oy + 2 * scale, 2.2 * scale, 1.4 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(ox + 5 * scale, oy + 2 * scale, 2.2 * scale, 1.4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2b2118';
  if (blink) {
    ctx.lineWidth = 1.4 * scale;
    ctx.strokeStyle = '#2b2118';
    ctx.beginPath();
    ctx.moveTo(ox - 5 * scale, oy);
    ctx.lineTo(ox - 2 * scale, oy);
    ctx.moveTo(ox + 2 * scale, oy);
    ctx.lineTo(ox + 5 * scale, oy);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ox - 3.5 * scale, oy, 1.6 * scale, 0, Math.PI * 2);
    ctx.arc(ox + 3.5 * scale, oy, 1.6 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ox - 3 * scale, oy - 0.6 * scale, 0.6 * scale, 0, Math.PI * 2);
    ctx.arc(ox + 4 * scale, oy - 0.6 * scale, 0.6 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // Smile
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.arc(ox, oy + 3.5 * scale, 2.5 * scale, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

function legs(ctx, color, walk, spread = 6) {
  const liftL = Math.max(0, walk) * 3;
  const liftR = Math.max(0, -walk) * 3;
  ctx.fillStyle = color;
  // back / left leg
  roundRect(ctx, -spread - 2, -6 - liftL, 4, 8 + liftL * 0.3, 2);
  ctx.fill();
  // front / right leg
  roundRect(ctx, spread - 2, -6 - liftR, 4, 8 + liftR * 0.3, 2);
  ctx.fill();
}

function bodyOval(ctx, color, w, h, y = -14) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Soft belly highlight
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(1, y + 2, w * 0.45, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function headCircle(ctx, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

const DRAWERS = {
  bear(ctx, a) {
    legs(ctx, a.accent, a.walk, 7);
    bodyOval(ctx, a.color, 13, 11, -15);
    // Arms
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(-12, -16, 4, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(12, -16, 4, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    headCircle(ctx, a.color, 0, -30, 10);
    // Ears
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(-7, -38, 4, 0, Math.PI * 2);
    ctx.arc(7, -38, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5c6aa';
    ctx.beginPath();
    ctx.arc(-7, -38, 2, 0, Math.PI * 2);
    ctx.arc(7, -38, 2, 0, Math.PI * 2);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#e8c4a0';
    ctx.beginPath();
    ctx.ellipse(0, -27, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.ellipse(0, -28, 1.6, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 0, -32, a.blink, 1.05);
  },

  bunny(ctx, a) {
    legs(ctx, a.accent, a.walk, 5);
    bodyOval(ctx, a.color, 9, 10, -14);
    // Fluffy tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-9, -12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    headCircle(ctx, a.color, 0, -28, 8);
    // Long ears
    ctx.fillStyle = a.color;
    ctx.save();
    ctx.translate(-4, -36);
    ctx.rotate(-0.15 + a.earTwitch);
    roundRect(ctx, -2, -14, 4, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#f7a0b0';
    roundRect(ctx, -1, -12, 2, 12, 1);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(4, -36);
    ctx.rotate(0.15 - a.earTwitch);
    ctx.fillStyle = a.color;
    roundRect(ctx, -2, -14, 4, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#f7a0b0';
    roundRect(ctx, -1, -12, 2, 12, 1);
    ctx.fill();
    ctx.restore();
    face(ctx, 0, -28, a.blink, 0.95);
    // Tiny nose
    ctx.fillStyle = '#e88';
    ctx.beginPath();
    ctx.arc(0, -25, 1.2, 0, Math.PI * 2);
    ctx.fill();
  },

  dog(ctx, a) {
    legs(ctx, a.accent, a.walk, 6);
    bodyOval(ctx, a.color, 12, 9, -13);
    // Tail wag
    ctx.strokeStyle = a.accent;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.quadraticCurveTo(-16, -20 - a.walk * 4, -14, -26);
    ctx.stroke();
    headCircle(ctx, a.color, 2, -26, 8.5);
    // Floppy ears
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.ellipse(-6, -26, 3, 6, 0.3, 0, Math.PI * 2);
    ctx.ellipse(8, -28, 3, 5.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#f0d8b8';
    ctx.beginPath();
    ctx.ellipse(6, -23, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(8, -24, 1.4, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 1, -28, a.blink, 0.95);
  },

  frog(ctx, a) {
    const hop = a.walking ? Math.abs(a.walk) * 4 : 0;
    ctx.translate(0, -hop);
    // Legs
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.ellipse(-8, -4, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(8, -4, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    bodyOval(ctx, a.color, 11, 8, -12);
    // Big eye bumps
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(-5, -20, 5, 0, Math.PI * 2);
    ctx.arc(5, -20, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -20, 3.2, 0, Math.PI * 2);
    ctx.arc(5, -20, 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (!a.blink) {
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.arc(-4.5, -20, 1.6, 0, Math.PI * 2);
      ctx.arc(5.5, -20, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Smile
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },

  elephant(ctx, a) {
    legs(ctx, a.accent, a.walk, 9);
    bodyOval(ctx, a.color, 16, 13, -16);
    headCircle(ctx, a.color, 4, -30, 11);
    // Ears
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(-10, -30, 8, 10, 0.2, 0, Math.PI * 2);
    ctx.ellipse(14, -32, 6, 8, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8a0a8';
    ctx.beginPath();
    ctx.ellipse(-10, -30, 4, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Trunk
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -24);
    ctx.quadraticCurveTo(14, -14, 10 + a.walk * 2, -4);
    ctx.stroke();
    face(ctx, 2, -33, a.blink, 1.1);
  },

  giraffe(ctx, a) {
    legs(ctx, a.accent, a.walk, 6);
    bodyOval(ctx, a.color, 11, 9, -14);
    // Spots on body
    ctx.fillStyle = a.accent;
    for (const [px, py] of [[-4, -14], [3, -12], [-1, -18], [5, -16]]) {
      ctx.beginPath();
      ctx.ellipse(px, py, 2.2, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Long neck
    ctx.fillStyle = a.color;
    roundRect(ctx, -3, -36, 6, 22, 3);
    ctx.fill();
    headCircle(ctx, a.color, 2, -40, 7);
    // Ossicones
    ctx.fillStyle = a.accent;
    ctx.fillRect(-2, -50, 2, 6);
    ctx.fillRect(4, -50, 2, 6);
    ctx.beginPath();
    ctx.arc(-1, -50, 2, 0, Math.PI * 2);
    ctx.arc(5, -50, 2, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 2, -40, a.blink, 0.9);
  },

  hedgehog(ctx, a) {
    legs(ctx, a.accent, a.walk, 5);
    // Spikes
    ctx.fillStyle = a.accent;
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI + (i / 8) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 6, -16 + Math.sin(ang) * 4);
      ctx.lineTo(Math.cos(ang) * 14, -22 + Math.sin(ang) * 10);
      ctx.lineTo(Math.cos(ang + 0.25) * 6, -16 + Math.sin(ang + 0.25) * 4);
      ctx.fill();
    }
    bodyOval(ctx, a.color, 10, 8, -14);
    headCircle(ctx, a.color, 6, -18, 6);
    face(ctx, 6, -19, a.blink, 0.8);
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(10, -16, 1.3, 0, Math.PI * 2);
    ctx.fill();
  },

  capybara(ctx, a) {
    legs(ctx, a.accent, a.walk, 8);
    bodyOval(ctx, a.color, 15, 10, -13);
    headCircle(ctx, a.color, 10, -18, 8);
    // Squared snout
    ctx.fillStyle = a.color;
    roundRect(ctx, 12, -18, 8, 6, 2);
    ctx.fill();
    face(ctx, 10, -20, a.blink, 0.95);
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(18, -16, 1.2, 0, Math.PI * 2);
    ctx.fill();
  },

  lion(ctx, a) {
    legs(ctx, a.accent, a.walk, 7);
    bodyOval(ctx, a.color, 12, 10, -14);
    // Mane
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.arc(0, -28, 14, 0, Math.PI * 2);
    ctx.fill();
    headCircle(ctx, a.color, 0, -28, 8);
    face(ctx, 0, -28, a.blink, 1);
    // Tail
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-11, -12);
    ctx.quadraticCurveTo(-18, -8, -16, -2 + a.walk * 2);
    ctx.stroke();
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.arc(-16, -2 + a.walk * 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  leopard(ctx, a) {
    legs(ctx, '#5a4010', a.walk, 6);
    bodyOval(ctx, a.color, 12, 9, -13);
    ctx.fillStyle = a.accent;
    for (const [px, py] of [[-5, -14], [2, -12], [-2, -18], [6, -16], [0, -10]]) {
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    headCircle(ctx, a.color, 2, -26, 7.5);
    // Ears
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(-3, -33, 3, 0, Math.PI * 2);
    ctx.arc(7, -33, 3, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 2, -26, a.blink, 0.9);
    // Tail
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-11, -12);
    ctx.quadraticCurveTo(-18, -18, -14, -24);
    ctx.stroke();
  },

  tiger(ctx, a) {
    legs(ctx, '#1a1a1a', a.walk, 7);
    bodyOval(ctx, a.color, 12, 10, -14);
    ctx.strokeStyle = a.accent;
    ctx.lineWidth = 2;
    for (const ox of [-6, -1, 4]) {
      ctx.beginPath();
      ctx.moveTo(ox, -22);
      ctx.lineTo(ox + 1, -8);
      ctx.stroke();
    }
    headCircle(ctx, a.color, 1, -28, 8);
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(-5, -34, 3.5, 0, Math.PI * 2);
    ctx.arc(7, -34, 3.5, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 1, -28, a.blink, 0.95);
  },

  deer(ctx, a) {
    legs(ctx, a.accent, a.walk, 5);
    bodyOval(ctx, a.color, 10, 9, -14);
    // Neck
    ctx.fillStyle = a.color;
    roundRect(ctx, -2, -26, 5, 12, 2);
    ctx.fill();
    headCircle(ctx, a.color, 3, -30, 6.5);
    // Antlers
    ctx.strokeStyle = a.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(-4, -44);
    ctx.lineTo(-7, -42);
    ctx.moveTo(-4, -44);
    ctx.lineTo(-2, -48);
    ctx.moveTo(6, -35);
    ctx.lineTo(10, -44);
    ctx.lineTo(13, -41);
    ctx.moveTo(10, -44);
    ctx.lineTo(9, -48);
    ctx.stroke();
    face(ctx, 3, -30, a.blink, 0.85);
  },

  moose(ctx, a) {
    legs(ctx, a.accent, a.walk, 8);
    bodyOval(ctx, a.color, 15, 12, -16);
    headCircle(ctx, a.color, 6, -30, 9);
    // Big antlers
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.ellipse(-6, -42, 10, 5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(12, -44, 11, 5.5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Dewlap
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.ellipse(4, -20, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 6, -32, a.blink, 1);
  },

  crocodile(ctx, a) {
    legs(ctx, a.accent, a.walk, 8);
    // Long body
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.ellipse(2, -10, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Snout
    ctx.beginPath();
    ctx.ellipse(16, -12, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ridge bumps
    ctx.fillStyle = a.accent;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-6 + i * 5, -16, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tail
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.lineTo(-24, -6 + a.walk * 2);
    ctx.lineTo(-14, -6);
    ctx.fill();
    // Eyes on top
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(8, -16, 3.5, 0, Math.PI * 2);
    ctx.arc(14, -16, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (!a.blink) {
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.arc(8.5, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(14.5, -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cute smile teeth hint
    ctx.fillStyle = '#fff';
    ctx.fillRect(18, -12, 2, 2);
    ctx.fillRect(22, -12, 2, 2);
  },

  squirrel(ctx, a) {
    legs(ctx, a.accent, a.walk, 4);
    // Big bushy tail
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.ellipse(-10, -18, 8, 14, -0.5 + a.walk * 0.1, 0, Math.PI * 2);
    ctx.fill();
    bodyOval(ctx, a.color, 8, 9, -14);
    headCircle(ctx, a.color, 4, -26, 6.5);
    // Ear tufts
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(1, -32);
    ctx.lineTo(0, -40);
    ctx.lineTo(4, -32);
    ctx.moveTo(7, -32);
    ctx.lineTo(9, -40);
    ctx.lineTo(10, -31);
    ctx.fill();
    face(ctx, 4, -26, a.blink, 0.85);
  },

  panda(ctx, a) {
    legs(ctx, '#222', a.walk, 7);
    bodyOval(ctx, '#f5f5f5', 13, 11, -15);
    headCircle(ctx, '#f5f5f5', 0, -30, 10);
    // Ear patches
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-7, -38, 4, 0, Math.PI * 2);
    ctx.arc(7, -38, 4, 0, Math.PI * 2);
    ctx.fill();
    // Eye patches
    ctx.beginPath();
    ctx.ellipse(-4, -31, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(4, -31, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    face(ctx, 0, -30, a.blink, 1);
  },

  owl(ctx, a) {
    // Standing bird — body + tiny feet
    ctx.fillStyle = a.accent;
    roundRect(ctx, -3, -5, 2.5, 5, 1);
    ctx.fill();
    roundRect(ctx, 1, -5, 2.5, 5, 1);
    ctx.fill();
    bodyOval(ctx, a.color, 10, 12, -16);
    headCircle(ctx, a.color, 0, -30, 9);
    // Ear tufts
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.moveTo(-8, -36);
    ctx.lineTo(-10, -44);
    ctx.lineTo(-4, -36);
    ctx.moveTo(8, -36);
    ctx.lineTo(10, -44);
    ctx.lineTo(4, -36);
    ctx.fill();
    // Big round eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.5, -30, 3.5, 0, Math.PI * 2);
    ctx.arc(3.5, -30, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (!a.blink) {
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.arc(-3, -30, 1.5, 0, Math.PI * 2);
      ctx.arc(4, -30, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Beak
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-2, -23);
    ctx.lineTo(2, -23);
    ctx.fill();
    // Wing flap micro
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.ellipse(-9, -16, 4, 7, -0.3 + a.walk * 0.15, 0, Math.PI * 2);
    ctx.fill();
  },

  pig(ctx, a) {
    legs(ctx, a.accent, a.walk, 6);
    bodyOval(ctx, a.color, 12, 10, -14);
    headCircle(ctx, a.color, 2, -27, 8.5);
    // Ears
    ctx.fillStyle = a.accent;
    ctx.beginPath();
    ctx.moveTo(-5, -33);
    ctx.lineTo(-8, -40);
    ctx.lineTo(-1, -34);
    ctx.moveTo(7, -33);
    ctx.lineTo(10, -40);
    ctx.lineTo(3, -34);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#f7a0b0';
    ctx.beginPath();
    ctx.ellipse(4, -24, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(2, -24, 1, 0, Math.PI * 2);
    ctx.arc(6, -24, 1, 0, Math.PI * 2);
    ctx.fill();
    // Curl tail
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-12, -12, 3, 0, Math.PI * 1.5);
    ctx.stroke();
    face(ctx, 0, -29, a.blink, 0.9);
  },

  penguin(ctx, a) {
    // Waddle
    ctx.translate(a.walk * 1.5, 0);
    ctx.fillStyle = '#f2c14e';
    // Feet
    ctx.beginPath();
    ctx.ellipse(-4, -2, 4, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(4, -2, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(0, -16, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.ellipse(0, -14, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(0, -32, 8, 0, Math.PI * 2);
    ctx.fill();
    // Flippers
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(-10, -16, 3, 7, 0.4 + a.walk * 0.2, 0, Math.PI * 2);
    ctx.ellipse(10, -16, 3, 7, -0.4 - a.walk * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(6, -28);
    ctx.lineTo(0, -26);
    ctx.fill();
    face(ctx, -1, -33, a.blink, 0.85);
  },
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
