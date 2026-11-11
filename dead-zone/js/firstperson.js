/* DEAD ZONE — lightweight first-person 2.5D renderer */

import { TILE, T, TILE_INFO } from './world.js';
import { ITEMS, ZOMBIE_TYPES, CONTAINERS } from './data.js';
import { shade } from './sprites.js';
import { clamp, normAngle } from './util.js';

const FOV = Math.PI * 0.42;
const WALL_HEIGHT = 20;
const WALL_TILES = new Set([T.WALL_WOOD, T.WALL_CONCRETE]);
const FOG = [37, 45, 41];
const FOG_HEX = '#252d29';
const PI2 = Math.PI * 2;

function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function circle(ctx, x, y, r, c) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI2);
  ctx.fill();
}
function limb(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

const hexCache = new Map();
function hexRgb(hex) {
  if (hexCache.has(hex)) return hexCache.get(hex);
  let h = String(hex || '#777777').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16) || 0;
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  hexCache.set(hex, rgb);
  return rgb;
}
function packRgb(r, g, b) {
  return (255 << 24) | (clamp(b, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(r, 0, 255);
}
function fogged(rgb, distance) {
  const f = clamp((distance - 12) / 360, 0, 0.9);
  return packRgb(
    rgb[0] + (FOG[0] - rgb[0]) * f,
    rgb[1] + (FOG[1] - rgb[1]) * f,
    rgb[2] + (FOG[2] - rgb[2]) * f
  );
}

function drawZombieSprite(ctx, W, H, type, dir, frame, variant, chase, pose = 'walk') {
  const def = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.walker;
  const low = type === 'crawler';
  const dead = pose.indexOf('dead') === 0;
  const deadStage = dead ? Number(pose.slice(4)) || 0 : 0;
  const windStage = pose.indexOf('wind') === 0 ? Number(pose.slice(4)) || 1 : 0;
  const strike = pose === 'strike';
  const walking = pose === 'walk';
  const skin = shade(def.skin, (variant - 1) * 9);
  const skinDark = shade(skin, -24);
  const cloth = shade(def.color, (variant - 1) * 11);
  const clothDark = shade(cloth, -30);
  const blood = '#592b28';
  const side = Math.sin(dir * Math.PI / 4);
  const front = Math.cos(dir * Math.PI / 4);
  const stride = walking ? Math.sin((frame / 4) * PI2) : 0;
  const strideAbs = Math.abs(stride);
  const sway = walking ? Math.cos((frame / 4) * PI2) : 0;
  const bodyBob = strideAbs * H * 0.012;
  const eyeCol = windStage || strike ? '#ff9d63' : '#221e18';
  const mouthOpen = chase || windStage || strike;

  if (dead) {
    const ground = H - 1;
    const heapY = ground - H * (0.05 + (1 - Math.min(1, deadStage)) * 0.04);
    ctx.fillStyle = 'rgba(78, 25, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(W * 0.5, ground - 1, W * 0.4, H * 0.065, 0, 0, PI2);
    ctx.fill();
    ctx.fillStyle = clothDark;
    ctx.beginPath();
    ctx.ellipse(W * 0.48 + side * W * 0.07, heapY - H * 0.04, W * 0.36, H * 0.13, side * 0.3, 0, PI2);
    ctx.fill();
    rect(ctx, W * 0.23, heapY - H * 0.08, W * 0.48, H * 0.09, cloth);
    rect(ctx, W * 0.27, heapY - H * 0.055, W * 0.19, H * 0.045, skinDark);
    const hx = W * (0.65 + side * 0.07);
    circle(ctx, hx, heapY - H * 0.075, W * 0.13, skin);
    rect(ctx, hx - W * 0.06, heapY - H * 0.09, W * 0.035, H * 0.025, '#241f1a');
    rect(ctx, hx + W * 0.025, heapY - H * 0.09, W * 0.035, H * 0.025, '#241f1a');
    rect(ctx, hx - W * 0.04, heapY - H * 0.035, W * 0.08, H * 0.018, '#4a1f1e');
    limb(ctx, W * 0.32, heapY - H * 0.02, W * 0.12, ground - 2, W * 0.07, skinDark);
    limb(ctx, W * 0.59, heapY - H * 0.02, W * 0.8, ground - 2, W * 0.06, skin);
    rect(ctx, W * 0.38, heapY - H * 0.02, W * 0.14, H * 0.045, blood);
    return;
  }

  if (low) {
    const bodyY = H * 0.64 + bodyBob * 0.45;
    const lunge = strike ? W * 0.09 : windStage ? -W * 0.06 : 0;
    const crawl = stride * W * 0.05;
    ctx.fillStyle = clothDark;
    ctx.beginPath();
    ctx.ellipse(W * 0.5, bodyY, W * 0.33, H * 0.19, 0.08 + side * 0.15, 0, PI2);
    ctx.fill();
    rect(ctx, W * 0.2, bodyY - H * 0.08, W * 0.6, H * 0.24, cloth);
    rect(ctx, W * 0.24, bodyY + H * 0.09, W * 0.25, H * 0.12, skinDark);
    rect(ctx, W * 0.5, bodyY + H * 0.1, W * 0.26, H * 0.11, skin);
    const hx = W * (0.5 + side * 0.24) + lunge;
    circle(ctx, hx, bodyY - H * 0.11 - (windStage ? H * 0.02 : 0), W * 0.15, skin);
    rect(ctx, hx - W * 0.06, bodyY - H * 0.145, W * 0.04, H * 0.025, eyeCol);
    rect(ctx, hx + W * 0.035, bodyY - H * 0.145, W * 0.04, H * 0.025, eyeCol);
    if (mouthOpen) rect(ctx, hx - W * 0.055, bodyY - H * 0.07, W * 0.11, H * 0.025, '#3f1918');
    rect(ctx, W * 0.32, bodyY - H * 0.03, W * 0.16, H * 0.08, blood);
    limb(ctx, W * 0.35, bodyY + H * 0.03, W * 0.13 + crawl, H - 2, W * 0.08, skinDark);
    limb(ctx, W * 0.67, bodyY + H * 0.03, W * 0.87 - crawl, H - 2, W * 0.08, skin);
    limb(ctx, W * 0.4, bodyY + H * 0.06, W * 0.25 + crawl + (strike ? W * 0.11 : 0), H - H * 0.1, W * 0.055, skin);
    limb(ctx, W * 0.61, bodyY + H * 0.07, W * 0.78 - crawl - (strike ? W * 0.11 : 0), H - H * 0.08, W * 0.055, skinDark);
    return;
  }

  const runner = type === 'runner';
  const brute = type === 'brute';
  const ground = H - 1;
  const legH = H * (brute ? 0.29 : 0.31);
  const torsoH = H * (brute ? 0.36 : 0.33);
  const hunch = chase ? H * 0.018 : 0;
  const torsoTop = ground - legH - torsoH - bodyBob + hunch;
  const shoulder = torsoTop + torsoH * 0.15;
  const headW = W * (brute ? 0.31 : 0.26);
  const headH = headW * 0.96;
  const lean = (runner ? W * 0.05 : 0) + (chase ? W * 0.025 : 0) +
    (strike ? W * 0.09 : 0) - (windStage ? W * 0.035 : 0);
  const headX = W * 0.5 + side * W * 0.05 + lean + sway * W * 0.012;
  const headY = torsoTop - headH * 0.78 + (windStage ? -H * 0.018 : strike ? H * 0.025 : 0);

  ctx.fillStyle = clothDark;
  const legW = W * (brute ? 0.14 : 0.115);
  const legStep = stride * W * (runner ? 0.075 : 0.045);
  rect(ctx, W * 0.5 - legW * 1.6, ground - legH, legW, legH + legStep, shade(cloth, -32));
  rect(ctx, W * 0.5 + legW * 0.55, ground - legH, legW, legH - legStep, shade(cloth, -22));
  rect(ctx, W * 0.5 - legW * 1.75, ground - H * 0.045 + Math.max(0, -legStep), legW * 1.3, H * 0.055, '#25251e');
  rect(ctx, W * 0.5 + legW * 0.5, ground - H * 0.045 + Math.max(0, legStep), legW * 1.3, H * 0.055, '#25251e');

  rect(ctx, W * 0.5 - W * 0.17, torsoTop, W * 0.34, torsoH, cloth);
  rect(ctx, W * 0.5 - W * 0.17, torsoTop, W * 0.1, torsoH, clothDark);
  rect(ctx, W * 0.5 + W * 0.05, torsoTop + 2, W * 0.1, torsoH - 5, shade(cloth, 16));
  poly(ctx, [
    [W * 0.33, torsoTop + torsoH * 0.55],
    [W * 0.28, torsoTop + torsoH],
    [W * 0.39, torsoTop + torsoH * 0.79],
    [W * 0.47, torsoTop + torsoH],
    [W * 0.54, torsoTop + torsoH * 0.74],
    [W * 0.61, torsoTop + torsoH],
    [W * 0.68, torsoTop + torsoH * 0.56]
  ], cloth);
  if (brute) {
    circle(ctx, W * 0.32, torsoTop + torsoH * 0.22, W * 0.1, shade(cloth, 12));
    circle(ctx, W * 0.68, torsoTop + torsoH * 0.22, W * 0.1, shade(cloth, 12));
  }
  rect(ctx, W * 0.4, torsoTop + torsoH * 0.32, W * 0.12, torsoH * 0.15, blood);
  rect(ctx, W * 0.56, torsoTop + torsoH * 0.57, W * 0.07, torsoH * 0.12, '#4b2422');
  if (windStage) {
    rect(ctx, W * 0.36, torsoTop + torsoH * 0.6, W * 0.28, torsoH * 0.12, '#3a201e');
  }

  const armW = W * (brute ? 0.13 : 0.1);
  if (windStage) {
    limb(ctx, W * 0.34, shoulder, W * 0.18, shoulder - H * 0.05, armW, skinDark);
    limb(ctx, W * 0.66, shoulder, W * 0.82, shoulder - H * 0.03, armW, skin);
    circle(ctx, W * 0.16, shoulder - H * 0.045, W * 0.058, skinDark);
    circle(ctx, W * 0.84, shoulder - H * 0.025, W * 0.058, skin);
  } else if (strike) {
    const reach = W * (brute ? 0.48 : 0.42);
    limb(ctx, W * 0.4, shoulder + torsoH * 0.12, W * 0.5 - reach, shoulder + H * 0.23, armW, skinDark);
    limb(ctx, W * 0.6, shoulder + torsoH * 0.12, W * 0.5 + reach, shoulder + H * 0.21, armW, skin);
    circle(ctx, W * 0.5 - reach, shoulder + H * 0.235, W * 0.06, skinDark);
    circle(ctx, W * 0.5 + reach, shoulder + H * 0.215, W * 0.06, skin);
  } else if (front > 0.1) {
    const armSwing = stride * W * 0.025;
    limb(ctx, W * 0.34, shoulder, W * 0.18 + armSwing, shoulder + H * 0.22, armW, skinDark);
    limb(ctx, W * 0.66, shoulder, W * 0.82 - armSwing, shoulder + H * 0.2, armW, skin);
    circle(ctx, W * 0.16 + armSwing, shoulder + H * 0.23, W * 0.055, skinDark);
    circle(ctx, W * 0.84 - armSwing, shoulder + H * 0.21, W * 0.055, skin);
  } else {
    const reach = side !== 0 ? side : 1;
    limb(ctx, W * 0.5, shoulder + torsoH * 0.2, W * 0.5 + reach * W * 0.38, shoulder + H * 0.17, armW, skinDark);
    limb(ctx, W * 0.42, shoulder + torsoH * 0.35, W * 0.3 - reach * W * 0.08, shoulder + H * 0.3, W * 0.09, shade(skin, -38));
    circle(ctx, W * 0.5 + reach * W * 0.39, shoulder + H * 0.17, W * 0.055, skin);
  }

  rect(ctx, headX - headW / 2, headY, headW, headH, skin);
  rect(ctx, headX - headW / 2, headY, headW, headH * 0.25, shade(skin, -34));
  if (front > -0.35) {
    const ex = headX + side * headW * 0.18;
    rect(ctx, ex - headW * 0.24, headY + headH * 0.38, headW * 0.14, headH * 0.16, eyeCol);
    rect(ctx, ex + headW * 0.12, headY + headH * 0.38, headW * 0.14, headH * 0.16, eyeCol);
    if (windStage || strike) {
      ctx.globalAlpha = 0.18;
      circle(ctx, ex - headW * 0.17, headY + headH * 0.46, headW * 0.13, '#ff8d54');
      circle(ctx, ex + headW * 0.19, headY + headH * 0.46, headW * 0.13, '#ff8d54');
      ctx.globalAlpha = 1;
    }
    if (mouthOpen) {
      rect(ctx, headX - headW * 0.17, headY + headH * 0.67, headW * 0.34, headH * 0.12, '#3f1918');
      rect(ctx, headX - headW * 0.1, headY + headH * 0.68, headW * 0.05, headH * 0.04, '#9b7a5d');
      rect(ctx, headX + headW * 0.05, headY + headH * 0.68, headW * 0.05, headH * 0.04, '#9b7a5d');
    }
  } else {
    rect(ctx, headX - headW * 0.25, headY + headH * 0.18, headW * 0.5, headH * 0.35, shade(skin, -22));
    if (windStage || strike) {
      rect(ctx, headX - headW * 0.18, headY + headH * 0.3, headW * 0.36, headH * 0.05, '#c56c4c');
    }
  }
  rect(ctx, headX - headW * 0.18, headY + headH * 0.82, headW * 0.16, headH * 0.15, blood);
}

function drawTreeSprite(ctx, W, H, variant, dir) {
  const tones = [
    ['#26351f', '#374a28', '#4b6234', '#5f7941'],
    ['#2c3b24', '#3f5430', '#526b3b', '#67824a'],
    ['#303c25', '#465630', '#5b6e3d', '#72864e']
  ][variant % 3];
  const ground = H - 1;
  const off = Math.sin(dir * Math.PI / 2) * W * 0.08;
  const trunkTop = H * 0.52;
  poly(ctx, [
    [W * 0.46, ground],
    [W * 0.41, H * 0.42],
    [W * 0.55, H * 0.39],
    [W * 0.54, ground]
  ], '#4a3422');
  poly(ctx, [
    [W * 0.46, ground],
    [W * 0.45, H * 0.42],
    [W * 0.49, H * 0.41],
    [W * 0.5, ground]
  ], '#6b4b2f');
  limb(ctx, W * 0.5, trunkTop + H * 0.13, W * 0.31 + off, H * 0.37, W * 0.035, '#4a3422');
  limb(ctx, W * 0.5, trunkTop + H * 0.07, W * 0.7 + off, H * 0.31, W * 0.03, '#4a3422');

  const clusters = [
    [0.5, 0.28, 0.27, 0],
    [0.31, 0.38, 0.2, 1],
    [0.69, 0.37, 0.21, 1],
    [0.39, 0.24, 0.19, 2],
    [0.62, 0.23, 0.2, 2],
    [0.5, 0.16, 0.18, 3],
    [0.24, 0.31, 0.15, 0],
    [0.76, 0.3, 0.15, 0]
  ];
  for (const [cx, cy, cr, tone] of clusters) {
    circle(ctx, W * cx + off, H * cy, W * cr, tones[tone]);
  }
  ctx.globalAlpha = 0.2;
  circle(ctx, W * 0.56 + off, H * 0.22, W * 0.11, '#a8b278');
  ctx.globalAlpha = 1;
}

function drawRockSprite(ctx, W, H, variant, dir) {
  const ground = H - 1;
  const lean = Math.sin(dir * Math.PI / 2) * W * 0.08;
  poly(ctx, [
    [W * 0.08, ground],
    [W * 0.18, H * 0.36],
    [W * 0.42 + lean, H * 0.12],
    [W * 0.7, H * 0.3],
    [W * 0.92, ground]
  ], '#55594f');
  poly(ctx, [
    [W * 0.18, H * 0.38],
    [W * 0.42 + lean, H * 0.13],
    [W * 0.63, H * 0.32],
    [W * 0.52, ground],
    [W * 0.24, ground]
  ], '#6b7067');
  poly(ctx, [
    [W * 0.24, H * 0.37],
    [W * 0.42 + lean, H * 0.14],
    [W * 0.52, H * 0.3],
    [W * 0.35, H * 0.43]
  ], variant % 2 ? '#81867b' : '#757a71');
  rect(ctx, W * 0.5, H * 0.58, W * 0.16, 2, '#464a42');
  rect(ctx, W * 0.27, H * 0.7, W * 0.12, 2, '#454940');
}

function drawContainerSprite(ctx, W, H, kind, dir, opened, locked) {
  const def = CONTAINERS[kind] || { color: '#7e603c' };
  const base = def.color || '#7e603c';
  const ground = H - 1;
  if (kind === 'corpse') {
    circle(ctx, W * 0.45, H * 0.64, W * 0.28, '#342525');
    ctx.fillStyle = '#493030';
    ctx.beginPath();
    ctx.ellipse(W * 0.48, H * 0.65, W * 0.3, H * 0.22, 0.2, 0, PI2);
    ctx.fill();
    circle(ctx, W * 0.72, H * 0.57, W * 0.13, '#6c5446');
    rect(ctx, W * 0.28, H * 0.75, W * 0.3, H * 0.1, '#592525');
    return;
  }
  if (kind === 'car') {
    const bodyY = H * 0.28;
    rect(ctx, W * 0.04, bodyY, W * 0.92, H * 0.5, '#353a35');
    rect(ctx, W * 0.08, bodyY + H * 0.06, W * 0.84, H * 0.32, base);
    rect(ctx, W * 0.18, bodyY + H * 0.02, W * 0.26, H * 0.25, '#7b8b87');
    rect(ctx, W * 0.52, bodyY + H * 0.02, W * 0.26, H * 0.25, '#7b8b87');
    rect(ctx, W * 0.15, bodyY + H * 0.37, W * 0.7, H * 0.1, shade(base, -18));
    circle(ctx, W * 0.23, H * 0.83, W * 0.1, '#1f2321');
    circle(ctx, W * 0.77, H * 0.83, W * 0.1, '#1f2321');
    rect(ctx, W * 0.06, bodyY + H * 0.26, W * 0.06, H * 0.1, '#d1c285');
    rect(ctx, W * 0.88, bodyY + H * 0.26, W * 0.06, H * 0.1, '#a84f41');
    if (opened) { ctx.globalAlpha = 0.4; rect(ctx, 0, bodyY, W, H - bodyY, '#11130f'); ctx.globalAlpha = 1; }
    return;
  }
  const top = H * 0.18;
  const sideShade = dir === 1 || dir === 2 ? shade(base, -18) : shade(base, 8);
  rect(ctx, W * 0.06, top, W * 0.88, H - top - 2, shade(base, -30));
  rect(ctx, W * 0.1, top + 2, W * 0.8, H - top - 7, base);
  rect(ctx, W * 0.1, top + 2, W * 0.12, H - top - 7, sideShade);
  rect(ctx, W * 0.1, top + 2, W * 0.8, H * 0.08, shade(base, 24));
  if (kind === 'fridge') {
    rect(ctx, W * 0.78, top + H * 0.24, W * 0.05, H * 0.14, '#d3d8cd');
    rect(ctx, W * 0.78, top + H * 0.52, W * 0.05, H * 0.12, '#d3d8cd');
  } else if (kind === 'locker') {
    rect(ctx, W * 0.49, top + H * 0.08, 2, H * 0.66, shade(base, -32));
    rect(ctx, W * 0.78, top + H * 0.42, W * 0.05, H * 0.08, '#b8b29a');
  } else if (kind === 'military') {
    rect(ctx, W * 0.42, top + H * 0.34, W * 0.16, H * 0.1, '#c3c07a');
    rect(ctx, W * 0.48, top + H * 0.26, W * 0.05, H * 0.26, '#c3c07a');
    rect(ctx, W * 0.36, top + H * 0.38, W * 0.28, H * 0.04, '#c3c07a');
  } else if (kind === 'medbox') {
    rect(ctx, W * 0.47, top + H * 0.28, W * 0.08, H * 0.28, '#b8483f');
    rect(ctx, W * 0.34, top + H * 0.4, W * 0.34, H * 0.08, '#b8483f');
  } else if (kind === 'toolbox') {
    rect(ctx, W * 0.42, top - H * 0.05, W * 0.18, H * 0.08, '#4d4c43');
    rect(ctx, W * 0.2, top + H * 0.16, W * 0.6, 2, '#c2a263');
  } else if (kind === 'dumpster') {
    rect(ctx, W * 0.1, top, W * 0.8, H * 0.13, shade(base, -18));
    rect(ctx, W * 0.18, top + H * 0.24, W * 0.64, H * 0.05, '#666f5e');
  } else {
    rect(ctx, W * 0.22, top + H * 0.2, W * 0.56, H * 0.55, shade(base, -14));
    rect(ctx, W * 0.22, top + H * 0.63, W * 0.56, H * 0.12, shade(base, -30));
    rect(ctx, W * 0.46, top + H * 0.2, W * 0.07, H * 0.55, shade(base, 16));
  }
  if (locked && !opened) {
    rect(ctx, W * 0.45, top + H * 0.47, W * 0.11, H * 0.13, '#c9b55c');
    rect(ctx, W * 0.48, top + H * 0.42, W * 0.05, H * 0.06, '#8e8345');
  }
  if (opened) {
    ctx.globalAlpha = 0.35;
    rect(ctx, W * 0.08, top, W * 0.84, H - top - 2, '#10130f');
    ctx.globalAlpha = 1;
  }
}

function drawFenceSprite(ctx, W, H) {
  const ground = H - 1;
  rect(ctx, W * 0.12, H * 0.18, W * 0.09, H * 0.76, '#555b4a');
  rect(ctx, W * 0.79, H * 0.18, W * 0.09, H * 0.76, '#555b4a');
  rect(ctx, W * 0.1, H * 0.34, W * 0.8, H * 0.1, '#737660');
  rect(ctx, W * 0.1, H * 0.64, W * 0.8, H * 0.1, '#687057');
  ctx.strokeStyle = '#737660';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = W * (0.18 + i * 0.1);
    ctx.moveTo(x, H * 0.26);
    ctx.lineTo(x, ground - H * 0.02);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(W * 0.1, ground - H * 0.05, W * 0.8, H * 0.05);
}

function drawBeaconSprite(ctx, W, H) {
  const ground = H - 1;
  ctx.globalAlpha = 0.18;
  circle(ctx, W * 0.5, H * 0.18, W * 0.32, '#e6c76a');
  ctx.globalAlpha = 1;
  rect(ctx, W * 0.43, H * 0.22, W * 0.14, H * 0.74, '#454a41');
  rect(ctx, W * 0.3, H * 0.15, W * 0.4, H * 0.12, '#5f6b4b');
  rect(ctx, W * 0.36, H * 0.11, W * 0.28, H * 0.05, '#d4bd66');
  rect(ctx, W * 0.34, ground - H * 0.03, W * 0.32, H * 0.03, '#5e6454');
  rect(ctx, W * 0.46, H * 0.3, W * 0.08, H * 0.12, '#e6c76a');
}

export class FirstPersonRenderer {
  constructor(game) {
    this.game = game;
    this.sprites = new Map();
    this.ground = new Map();
    this.floorCanvas = null;
    this.floorCtx = null;
    this.floorImage = null;
    this.floorPixels = null;
    this.floorW = 0;
    this.floorH = 0;
    this.zBuffer = null;
  }

  clear() {
    this.sprites.clear();
    this.ground.clear();
    this.floorCanvas = null;
    this.floorCtx = null;
    this.floorImage = null;
    this.floorPixels = null;
    this.floorW = 0;
    this.floorH = 0;
    this.zBuffer = null;
  }

  sprite(key, w, h, draw) {
    const k = key + ':' + Math.round(w) + 'x' + Math.round(h);
    let c = this.sprites.get(k);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const cx = c.getContext('2d');
    if (cx) {
      cx.imageSmoothingEnabled = false;
      draw(cx, c.width, c.height);
    }
    this.sprites.set(k, c);
    return c;
  }

  groundRgb(t, v) {
    const key = t + ':' + v;
    let c = this.ground.get(key);
    if (c) return c;
    const info = TILE_INFO[t] || TILE_INFO[T.GRASS];
    let base = info.color;
    if (t === T.GRASS) base = v % 2 ? '#34402c' : '#37432e';
    else if (t === T.DARK_GRASS) base = v % 2 ? '#29331f' : '#2d3722';
    else if (t === T.DIRT) base = v % 2 ? '#4b4030' : '#504536';
    else if (t === T.SAND) base = v % 2 ? '#5d5540' : '#625a44';
    else if (t === T.ROAD) base = v % 2 ? '#35383a' : '#383b3d';
    else if (t === T.ASPHALT) base = v % 2 ? '#3d4042' : '#414446';
    else if (t === T.WOOD_FLOOR) base = v % 2 ? '#5b4935' : '#574532';
    else if (t === T.CONCRETE || t === T.TILE_FLOOR) base = v % 2 ? '#565a56' : '#5b5e58';
    else if (t === T.PAVEMENT) base = v % 2 ? '#4c4e4a' : '#50524d';
    else if (t === T.DIRT_ROAD) base = v % 2 ? '#4d4433' : '#514736';
    else if (t === T.RUBBLE) base = v % 2 ? '#4a4a43' : '#464640';
    else if (t === T.WATER) base = v % 2 ? '#263c42' : '#2a4249';
    else base = shade(base, (v - 1.5) * 5);
    c = hexRgb(base);
    this.ground.set(key, c);
    return c;
  }

  render(ctx, w, h) {
    const g = this.game;
    const p = g.player;
    const yaw = g.fpYaw || 0;
    const pitch = g.fpPitch || 0;
    const shake = g.camera.shake || 0;
    const shakeX = shake ? (Math.random() - 0.5) * shake * 0.7 : 0;
    const shakeY = shake ? (Math.random() - 0.5) * shake * 0.45 : 0;
    const bob = p.moving ? Math.sin(p.walkPhase * 2) * 1.1 : Math.sin(g.time * 1.6) * 0.35;
    const horizon = clamp(h * 0.52 + pitch * h * 0.55 + shakeY + bob, h * 0.14, h * 0.9);
    const camH = p.crouching ? 5.6 : 8;
    const focal = (w * 0.5) / Math.tan(FOV / 2);
    const view = {
      w, h, yaw, horizon, camH, focal,
      cos: Math.cos(yaw), sin: Math.sin(yaw),
      tanHalf: Math.tan(FOV / 2), shakeX, shakeY, p
    };

    this.renderSky(ctx, view);
    this.renderFloor(ctx, view);
    const zbuf = this.renderWalls(ctx, view);
    this.renderEntities(ctx, view, zbuf);
    this.renderParticles(ctx, view, zbuf);
    this.renderTracers(ctx, view, zbuf);
    this.renderFloaters(ctx, view);
    this.renderAtmosphere(ctx, view);
    this.drawWeapon(ctx, view);
    this.drawCrosshair(ctx, view);
    this.renderOverlays(ctx, view);
  }

  renderSky(ctx, view) {
    const { w, h, horizon, yaw } = view;
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    grad.addColorStop(0, '#070b0a');
    grad.addColorStop(0.42, '#131b19');
    grad.addColorStop(0.78, '#29322d');
    grad.addColorStop(1, '#3d453e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#0c120f';
    const start = yaw - FOV / 2;
    for (let x = 0; x < w; x += 6) {
      const ang = start + (x / w) * FOV;
      const n = Math.sin(ang * 31.7) * 0.42 + Math.sin(ang * 11.3 + 1.8) * 0.34 + Math.sin(ang * 5.1 + 0.7) * 0.24;
      const bh = Math.max(2, 5 + n * 7);
      ctx.fillRect(x, horizon - bh, 7, bh + 1);
    }
    ctx.fillStyle = 'rgba(176, 130, 78, 0.09)';
    ctx.fillRect(0, horizon - 20, w, 20);
  }

  renderFloor(ctx, view) {
    const { w, h, horizon, camH, focal, p, cos, sin } = view;
    if (horizon >= h - 2) return;
    const scale = 3;
    const fw = Math.max(2, Math.ceil(w / scale));
    const fh = Math.max(2, Math.ceil((h - horizon) / scale));
    if (!this.floorCanvas || this.floorW !== fw || this.floorH !== fh) {
      this.floorCanvas = document.createElement('canvas');
      this.floorCanvas.width = fw;
      this.floorCanvas.height = fh;
      this.floorCtx = this.floorCanvas.getContext('2d');
      this.floorImage = this.floorCtx ? this.floorCtx.createImageData(fw, fh) : null;
      this.floorPixels = this.floorImage ? new Uint32Array(this.floorImage.data.buffer) : null;
      this.floorW = fw;
      this.floorH = fh;
    }
    if (!this.floorImage || !this.floorPixels) return;
    const sx = w / fw;
    const sy = (h - horizon) / fh;
    const world = this.game.world;
    const px = p.x, py = p.y;
    const invFocal = 1 / focal;
    const pixels = this.floorPixels;
    for (let yy = 0; yy < fh; yy++) {
      const screenY = horizon + (yy + 0.5) * sy;
      const dy = Math.max(0.55, screenY - horizon);
      const dist = Math.min(620, camH * focal / dy);
      const forwardX = cos * dist;
      const forwardY = sin * dist;
      const rightScale = dist * invFocal;
      const row = yy * fw;
      for (let xx = 0; xx < fw; xx++) {
        const lateral = (xx + 0.5) * sx - w / 2;
        const wx = px + forwardX - sin * lateral * rightScale;
        const wy = py + forwardY + cos * lateral * rightScale;
        const tx = Math.floor(wx / TILE);
        const ty = Math.floor(wy / TILE);
        const t = world.tileAt(tx, ty);
        let v = 0;
        if (t === T.WATER) v = ((Math.sin(world.time * 1.4 + wx * 0.07 + wy * 0.04) > 0) ? 1 : 0);
        else v = ((tx * 73856093 ^ ty * 19349663) >>> 0) & 3;
        const rgb = this.groundRgb(t, v);
        pixels[row + xx] = fogged(rgb, dist);
      }
    }
    this.floorCtx.putImageData(this.floorImage, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.floorCanvas, 0, horizon, w, h - horizon);
  }

  renderWalls(ctx, view) {
    const { w, h, horizon, camH, focal, p, cos, sin, tanHalf, shakeX, shakeY } = view;
    if (!this.zBuffer || this.zBuffer.length !== w) this.zBuffer = new Float32Array(w);
    const zbuf = this.zBuffer;
    zbuf.fill(4000);
    const strip = 2;
    const world = this.game.world;
    const posX = p.x / TILE;
    const posY = p.y / TILE;
    const dirX = cos, dirY = sin;
    const planeX = -sin * tanHalf, planeY = cos * tanHalf;

    for (let x = 0; x < w; x += strip) {
      const cameraX = (2 * (x + strip / 2) / w - 1);
      const rayX = dirX + planeX * cameraX;
      const rayY = dirY + planeY * cameraX;
      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);
      const deltaX = Math.abs(1 / (rayX || 0.00001));
      const deltaY = Math.abs(1 / (rayY || 0.00001));
      let stepX, stepY, sideX, sideY;
      if (rayX < 0) { stepX = -1; sideX = (posX - mapX) * deltaX; }
      else { stepX = 1; sideX = (mapX + 1 - posX) * deltaX; }
      if (rayY < 0) { stepY = -1; sideY = (posY - mapY) * deltaY; }
      else { stepY = 1; sideY = (mapY + 1 - posY) * deltaY; }

      let side = 0;
      let tile = T.WATER;
      let hit = false;
      for (let i = 0; i < 72; i++) {
        if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
        else { sideY += deltaY; mapY += stepY; side = 1; }
        tile = world.tileAt(mapX, mapY);
        if (WALL_TILES.has(tile)) { hit = true; break; }
        if (mapX < -2 || mapY < -2 || mapX > world.cols + 2 || mapY > world.rows + 2) break;
      }
      if (!hit) continue;
      const perp = side === 0 ? sideX - deltaX : sideY - deltaY;
      const dist = Math.max(1, perp * TILE);
      for (let k = 0; k < strip && x + k < w; k++) zbuf[x + k] = dist;
      const base = TILE_INFO[tile] ? TILE_INFO[tile].color : '#6b5136';
      const v = ((mapX * 13 + mapY * 7) >>> 0) & 3;
      const rgb = hexRgb(shade(base, side ? -18 : 0));
      const top = horizon + camH * focal / dist - WALL_HEIGHT * focal / dist + shakeY;
      const bottom = horizon + camH * focal / dist + shakeY;
      const height = Math.max(1, bottom - top);
      const color = 'rgb(' + Math.round(rgb[0] + (FOG[0] - rgb[0]) * clamp((dist - 12) / 360, 0, 0.9)) + ',' +
        Math.round(rgb[1] + (FOG[1] - rgb[1]) * clamp((dist - 12) / 360, 0, 0.9)) + ',' +
        Math.round(rgb[2] + (FOG[2] - rgb[2]) * clamp((dist - 12) / 360, 0, 0.9)) + ')';
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x + shakeX), Math.floor(top), strip, Math.ceil(height));
      ctx.fillStyle = 'rgba(255,255,240,' + (side ? 0.025 : 0.055) + ')';
      ctx.fillRect(Math.floor(x + shakeX), Math.floor(top), strip, Math.max(1, height * 0.035));
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(Math.floor(x + shakeX), Math.floor(bottom - height * 0.08), strip, Math.max(1, height * 0.08));
      if (((v + mapX + mapY) & 3) === 0) {
        ctx.fillStyle = 'rgba(15,18,14,0.16)';
        ctx.fillRect(Math.floor(x + shakeX), Math.floor(top + height * 0.32), strip, Math.max(1, height * 0.018));
      }
    }
    return zbuf;
  }

  project(x, y, view) {
    const dx = x - view.p.x;
    const dy = y - view.p.y;
    const depth = dx * view.cos + dy * view.sin;
    const lateral = -dx * view.sin + dy * view.cos;
    return { depth, lateral };
  }

  renderEntities(ctx, view, zbuf) {
    const g = this.game;
    const world = g.world;
    const p = g.player;
    const list = [];
    const add = (x, y, wWorld, hWorld, sprite, kind, data) => {
      const pr = this.project(x, y, view);
      if (pr.depth < 3 || pr.depth > 300) return;
      if (Math.abs(pr.lateral) > pr.depth * view.tanHalf + 70) return;
      list.push({ x, y, depth: pr.depth, lateral: pr.lateral, wWorld, hWorld, sprite, kind, data });
    };

    for (const e of world.extractions) {
      const sprite = this.sprite('beacon', 40, 76, (c, W, H) => drawBeaconSprite(c, W, H));
      add(e.x, e.y, 12, 28, sprite, 'beacon', e);
    }
    for (const tr of world.trees) {
      if (tr.depleted) continue;
      const dir = Math.abs(Math.round((normAngle(Math.atan2(p.y - tr.y, p.x - tr.x) - view.yaw) + Math.PI) / (Math.PI / 2))) % 4;
      const sprite = this.sprite('tree:' + tr.variant + ':' + dir, 64, 92,
        (c, W, H) => drawTreeSprite(c, W, H, tr.variant, dir));
      add(tr.x, tr.y, 20 + tr.variant * 2, 27 + tr.variant * 2, sprite, 'tree', tr);
    }
    for (const r of world.rocks) {
      if (r.depleted) continue;
      const dir = Math.abs(Math.round((normAngle(Math.atan2(p.y - r.y, p.x - r.x) - view.yaw) + Math.PI) / (Math.PI / 2))) % 4;
      const sprite = this.sprite('rock:' + r.variant + ':' + dir, 44, 30,
        (c, W, H) => drawRockSprite(c, W, H, r.variant, dir));
      add(r.x, r.y, 15, 7, sprite, 'rock', r);
    }
    for (const c of world.containers) {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      const dir = Math.abs(Math.round((normAngle(Math.atan2(cy - p.y, cx - p.x) - view.yaw) + Math.PI) / (Math.PI / 2))) % 4;
      const kind = c.kind || 'crate';
      const corner = kind === 'car' ? [72, 40] : [48, 40];
      const sprite = this.sprite('box:' + kind + ':' + dir + ':' + (c.opened ? 1 : 0) + ':' + (c.locked ? 1 : 0),
        corner[0], corner[1], (cc, W, H) => drawContainerSprite(cc, W, H, kind, dir, c.opened, c.locked));
      add(cx, cy, kind === 'car' ? 26 : Math.max(10, c.w * 0.8), kind === 'car' ? 14 : Math.max(7, c.h * 0.72), sprite, 'container', c);
    }
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    for (let ty = pty - 16; ty <= pty + 16; ty++) {
      for (let tx = ptx - 16; tx <= ptx + 16; tx++) {
        if (world.tileAt(tx, ty) !== T.FENCE) continue;
        const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
        if (Math.abs(wx - p.x) + Math.abs(wy - p.y) > 240) continue;
        const sprite = this.sprite('fence', 34, 26, (c, W, H) => drawFenceSprite(c, W, H));
        add(wx, wy, 16, 10, sprite, 'fence', null);
      }
    }
    for (const z of g.zombies) {
      const deadAge = z.dead ? g.time - (z.deathTime || g.time) : 0;
      if (z.dead && deadAge > 1.15) continue;
      const def = ZOMBIE_TYPES[z.type] || ZOMBIE_TYPES.walker;
      const dir = Math.round(normAngle((z.aimAngle || 0) - view.yaw - Math.PI) / (Math.PI / 4)) & 7;
      let pose = 'idle';
      let frame = 0;
      if (z.dead) {
        pose = 'dead' + (deadAge > 0.16 ? 1 : 0);
      } else if (z.attackWindup > 0) {
        const progress = z.attackWindupMax ? 1 - z.attackWindup / z.attackWindupMax : 0.5;
        pose = 'wind' + (progress > 0.45 ? 2 : 1);
      } else if (z.attackAnim > 0) {
        pose = 'strike';
      } else if (z.moving) {
        pose = 'walk';
        frame = Math.floor(z.walkPhase * 2.4) % 4;
      } else if (z.chase) {
        pose = 'walk';
        frame = Math.floor(z.walkPhase * 1.4) % 4;
      }
      const dims = z.type === 'crawler' ? [40, 31] :
        z.type === 'brute' ? [56, 70] : [42, 60];
      const sprite = this.sprite('zombie:' + z.type + ':' + dir + ':' + frame + ':' + z.variant + ':' +
        (z.chase ? 1 : 0) + ':' + pose,
        dims[0], dims[1], (c, W, H) => drawZombieSprite(c, W, H, z.type, dir, frame, z.variant, z.chase, pose));
      const size = def.size || 1;
      add(z.x, z.y, z.type === 'brute' ? 16 : z.type === 'crawler' ? 13 : 11,
        z.type === 'crawler' ? 7 : 17 * size, sprite, 'zombie', z);
    }

    list.sort((a, b) => b.depth - a.depth);
    for (const o of list) {
      const screenX = view.w / 2 + (o.lateral / o.depth) * view.focal + view.shakeX;
      const baseY = view.horizon + view.camH * view.focal / o.depth + view.shakeY;
      const screenH = o.hWorld * view.focal / o.depth;
      const screenW = o.wWorld * view.focal / o.depth;
      if (screenH < 1 || screenW < 1) continue;
      const sway = o.kind === 'tree' ? Math.sin(this.game.time * 1.1 + o.data.sway) * screenW * 0.035 : 0;
      const left = screenX - screenW / 2 + sway;
      const top = baseY - screenH;
      const deadZombie = o.kind === 'zombie' && o.data.dead;
      const fade = deadZombie ? 1 - clamp((this.game.time - o.data.deathTime - 0.7) / 0.45, 0, 1) : 1;
      if (fade <= 0.01) continue;

      ctx.save();
      if (fade < 1) ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(0,0,0,' + (o.kind === 'beacon' ? 0.18 : 0.32) + ')';
      ctx.beginPath();
      ctx.ellipse(screenX, baseY, Math.max(1, screenW * 0.55), Math.max(1, screenW * 0.11), 0, 0, PI2);
      ctx.fill();
      if (o.kind === 'beacon') {
        const glow = ctx.createRadialGradient(screenX, top + screenH * 0.14, 1, screenX, top + screenH * 0.14, Math.max(8, screenW * 3));
        glow.addColorStop(0, 'rgba(230,199,106,0.22)');
        glow.addColorStop(1, 'rgba(230,199,106,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(screenX - screenW * 3, top - screenW * 2, screenW * 6, screenW * 4);
      }
      this.drawBillboard(ctx, o.sprite, left, top, screenW, screenH, o.depth, zbuf, view.w);
      if (o.kind === 'zombie' && !o.data.dead) {
        if (o.data.hp < o.data.maxHp && o.depth < 120) {
          const bw = Math.max(12, screenW * 0.8);
          const by = top - Math.max(2, 4 * view.focal / o.depth);
          ctx.fillStyle = 'rgba(16,18,15,0.8)';
          ctx.fillRect(screenX - bw / 2, by, bw, Math.max(2, bw * 0.08));
          ctx.fillStyle = o.data.type === 'brute' ? '#c25d4a' : '#9db064';
          ctx.fillRect(screenX - bw / 2, by, bw * clamp(o.data.hp / o.data.maxHp, 0, 1), Math.max(2, bw * 0.08));
        }
        if (o.data.attackWindup > 0) {
          const pulse = 0.55 + Math.sin(this.game.time * 26) * 0.35;
          const mark = clamp(screenH * 0.12, 3, 8);
          const my = top - mark * 2.6;
          ctx.fillStyle = 'rgba(244,154,88,' + clamp(pulse, 0.2, 0.95) + ')';
          ctx.fillRect(screenX - mark * 0.16, my, Math.max(1, mark * 0.32), mark * 1.2);
          ctx.fillRect(screenX - mark * 0.16, my + mark * 1.6, Math.max(1, mark * 0.32), mark * 0.4);
        }
      }
      ctx.restore();
    }
  }

  drawBillboard(ctx, sprite, left, top, dw, dh, depth, zbuf, w) {
    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(w - 1, Math.ceil(left + dw));
    if (x1 <= x0) return;
    let minZ = Infinity, maxZ = 0;
    for (let x = x0; x <= x1; x += 2) {
      const z = zbuf[x];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (depth <= minZ - 1) {
      ctx.drawImage(sprite, left, top, dw, dh);
      return;
    }
    if (depth >= maxZ + 1) return;
    let run = -1;
    for (let x = x0; x <= x1; x += 2) {
      const visible = depth < zbuf[x];
      if (visible && run < 0) run = x;
      if ((!visible || x >= x1) && run >= 0) {
        const end = visible ? Math.min(x1, x + 2) : x;
        const sw = Math.max(1, end - run);
        const srcX = clamp((run - left) / dw * sprite.width, 0, sprite.width - 1);
        const srcW = clamp(sw / dw * sprite.width, 1, sprite.width - srcX);
        ctx.drawImage(sprite, srcX, 0, srcW, sprite.height, run, top, sw, dh);
        run = -1;
      }
    }
  }

  renderParticles(ctx, view, zbuf) {
    for (const q of this.game.particles) {
      const pr = this.project(q.x, q.y, view);
      if (pr.depth < 3 || pr.depth > 190) continue;
      const sx = view.w / 2 + (pr.lateral / pr.depth) * view.focal + view.shakeX;
      const sy = view.horizon + view.camH * view.focal / pr.depth + view.shakeY;
      if (sx < 0 || sx >= view.w || sy < 0 || sy >= view.h) continue;
      if (pr.depth >= zbuf[Math.floor(sx)]) continue;
      const size = Math.max(1, q.size * view.focal / pr.depth * 0.28);
      ctx.globalAlpha = Math.max(0.08, q.life / q.maxLife);
      ctx.fillStyle = q.color;
      ctx.fillRect(sx, sy - size, size, size);
    }
    ctx.globalAlpha = 1;
  }

  renderTracers(ctx, view, zbuf) {
    for (const tr of this.game.tracers) {
      const a = this.project(tr.x1, tr.y1, view);
      const b = this.project(tr.x2, tr.y2, view);
      if (a.depth < 1 || b.depth < 1) continue;
      const ax = view.w / 2 + (a.lateral / a.depth) * view.focal + view.shakeX;
      const ay = view.horizon + view.camH * view.focal / a.depth + view.shakeY;
      const bx = view.w / 2 + (b.lateral / b.depth) * view.focal + view.shakeX;
      const by = view.horizon + view.camH * view.focal / b.depth + view.shakeY;
      const mx = clamp(Math.floor((ax + bx) / 2), 0, view.w - 1);
      if (Math.min(a.depth, b.depth) >= zbuf[mx]) continue;
      ctx.globalAlpha = tr.life / tr.maxLife;
      ctx.strokeStyle = '#f2d68a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  renderFloaters(ctx, view) {
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    for (const f of this.game.floaters) {
      const pr = this.project(f.x, f.y, view);
      if (pr.depth < 4 || pr.depth > 180) continue;
      const sx = view.w / 2 + (pr.lateral / pr.depth) * view.focal + view.shakeX;
      const sy = view.horizon + view.camH * view.focal / pr.depth + view.shakeY - 6;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(f.text, sx + 1, sy + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  renderAtmosphere(ctx, view) {
    const { w, h, horizon } = view;
    const g = this.game;
    const grad = ctx.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.2, w / 2, h * 0.52, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(4,7,7,0)');
    grad.addColorStop(0.55, 'rgba(4,7,7,0.14)');
    grad.addColorStop(1, 'rgba(3,5,6,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(24,34,44,0.1)';
    ctx.fillRect(0, 0, w, h);

    if (g.world.weather === 'rain') {
      ctx.strokeStyle = 'rgba(156,178,184,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const t = g.time;
      for (let i = 0; i < 80; i++) {
        const rx = (i * 73.1 + t * 38 * (0.7 + ((i * 17) % 10) / 10)) % (w + 30) - 15;
        const ry = (i * 41.7 + t * 150 * (0.5 + ((i * 13) % 10) / 10)) % (h + 30) - 15;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 7);
      }
      ctx.stroke();
    }

    if (g.flashlight) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cx = w * 0.53;
      const cy = h * 0.58;
      const lg = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.48);
      lg.addColorStop(0, 'rgba(240,225,165,0.16)');
      lg.addColorStop(0.45, 'rgba(240,225,165,0.07)');
      lg.addColorStop(1, 'rgba(240,225,165,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(10,14,11,0.08)';
    ctx.fillRect(0, 0, w, Math.min(h, horizon * 0.16));
  }

  drawWeapon(ctx, view) {
    const g = this.game;
    const p = g.player;
    const weapon = g.currentWeapon();
    const s = Math.max(0.62, Math.min(view.w / 480, view.h / 270));
    const reload = g.reloadState ? clamp(g.reloadState.t / g.reloadState.dur, 0, 1) : 0;
    const reloadDip = g.reloadState ? Math.sin(reload * Math.PI) * 24 * s : 0;
    const bobX = p.moving ? Math.sin(p.walkPhase * 1.65) * 3 * s : Math.sin(g.time * 1.35) * 0.8 * s;
    const bobY = p.moving ? Math.abs(Math.cos(p.walkPhase * 1.65)) * 2.2 * s : Math.sin(g.time * 1.55) * 0.6 * s;
    const recoil = p.muzzle > 0 ? (p.muzzle / 0.07) * 7 * s : 0;
    const melee = weapon && ITEMS[weapon.id].weapon && ITEMS[weapon.id].weapon.kind === 'melee';
    const meleeT = melee && p.attackAnim > 0 ? clamp(1 - p.attackAnim / 0.22, 0, 1) : 0;
    const sleeve = p.shirt || '#3f4d3e';
    const sleeveDark = shade(sleeve, -28);

    if (!weapon) {
      this.drawFists(ctx, view, s, bobX, bobY, sleeve, sleeveDark);
      return;
    }
    const def = ITEMS[weapon.id];
    if (def.weapon && def.weapon.kind === 'gun') {
      this.drawGun(ctx, view, s, weapon, bobX, bobY, reloadDip, recoil, sleeve, sleeveDark);
    } else {
      this.drawMelee(ctx, view, s, weapon, bobX, bobY, reloadDip, meleeT, sleeve, sleeveDark);
    }
  }

  drawFists(ctx, view, s, bobX, bobY, sleeve, sleeveDark) {
    const w = view.w, h = view.h;
    const skin = '#c49a72', skin2 = '#a87f5d';
    limb(ctx, w * 0.82, h * 1.1, w * 0.68 + bobX, h * 0.84 + bobY, 13 * s, sleeve);
    limb(ctx, w * 0.58, h * 1.1, w * 0.66 + bobX, h * 0.9 + bobY, 13 * s, sleeveDark);
    circle(ctx, w * 0.68 + bobX, h * 0.82 + bobY, 8 * s, skin);
    circle(ctx, w * 0.66 + bobX, h * 0.88 + bobY, 7 * s, skin2);
    rect(ctx, w * 0.65 + bobX, h * 0.84 + bobY, 7 * s, 3 * s, skin);
  }

  drawGun(ctx, view, s, weapon, bobX, bobY, reloadDip, recoil, sleeve, sleeveDark) {
    const w = view.w, h = view.h;
    const def = ITEMS[weapon.id];
    const icon = def.icon;
    const col = def.color || '#7d858a';
    const gx = w * 0.63 + bobX;
    const gy = h * 0.95 + bobY + reloadDip + recoil * 0.35;
    const tx = w * 0.525 + bobX * 0.35;
    const ty = h * 0.55 + bobY * 0.35 - recoil;
    const angle = Math.atan2(ty - gy, tx - gx);
    const len = Math.hypot(tx - gx, ty - gy);
    const skin = '#c49a72';

    limb(ctx, w * 0.84, h * 1.1, gx + Math.cos(angle) * len * 0.34, gy + Math.sin(angle) * len * 0.34, 13 * s, sleeveDark);
    limb(ctx, w * 0.73, h * 1.12, gx, gy, 14 * s, sleeve);
    circle(ctx, gx + Math.cos(angle) * len * 0.34, gy + Math.sin(angle) * len * 0.34, 6.5 * s, '#b58a64');

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle);
    const bodyH = (icon === 'pistol' || icon === 'revolver' ? 6 : 7) * s;
    const grip = (icon === 'pistol' || icon === 'revolver' ? 12 : 16) * s;

    if (icon === 'pistol') {
      rect(ctx, -3 * s, -bodyH * 0.55, len * 0.82, bodyH, shade(col, -18));
      rect(ctx, -1 * s, -bodyH * 0.55, len * 0.78, bodyH * 0.35, shade(col, 22));
      rect(ctx, -2 * s, bodyH * 0.25, grip * 0.5, grip, '#3b3f3e');
      rect(ctx, len * 0.78, -bodyH * 0.32, len * 0.22, bodyH * 0.55, shade(col, -32));
      rect(ctx, len * 0.9, -bodyH * 0.75, 2 * s, bodyH * 0.3, '#3a3d3d');
    } else if (icon === 'revolver') {
      rect(ctx, -3 * s, -bodyH * 0.55, len * 0.76, bodyH, shade(col, -16));
      circle(ctx, len * 0.27, 0, bodyH * 0.65, shade(col, 12));
      rect(ctx, -2 * s, bodyH * 0.18, grip * 0.5, grip, '#6b543a');
      rect(ctx, len * 0.76, -bodyH * 0.3, len * 0.24, bodyH * 0.5, shade(col, -30));
    } else {
      rect(ctx, -18 * s, -bodyH * 0.45, 20 * s, bodyH * 1.1, shade('#5d4933', -10));
      rect(ctx, 0, -bodyH * 0.55, len * 0.62, bodyH, shade(col, -18));
      rect(ctx, 0, -bodyH * 0.55, len * 0.6, bodyH * 0.28, shade(col, 20));
      rect(ctx, len * 0.55, -bodyH * 0.28, len * 0.45, bodyH * 0.5, shade(col, -28));
      rect(ctx, 2 * s, bodyH * 0.28, grip * 0.48, grip, '#353a38');
      if (icon === 'smg') {
        rect(ctx, len * 0.26, bodyH * 0.3, 8 * s, 14 * s, '#333836');
        rect(ctx, len * 0.42, -bodyH * 1.05, len * 0.16, 3 * s, '#6d736f');
      } else if (icon === 'shotgun') {
        rect(ctx, len * 0.41, bodyH * 0.28, len * 0.19, 5 * s, '#6b4a30');
        rect(ctx, len * 0.58, -bodyH * 0.48, len * 0.38, 3 * s, shade(col, -34));
      } else if (icon === 'sniper') {
        rect(ctx, len * 0.25, -bodyH * 1.15, len * 0.26, 3 * s, '#3c4136');
        rect(ctx, len * 0.22, -bodyH * 0.95, 3 * s, 6 * s, '#2e332c');
        rect(ctx, len * 0.47, -bodyH * 0.95, 3 * s, 6 * s, '#2e332c');
      } else {
        rect(ctx, len * 0.3, -bodyH * 1.0, len * 0.18, 2.5 * s, '#4b5047');
      }
    }
    circle(ctx, 2 * s, bodyH * 0.38, 7 * s, skin);
    circle(ctx, len * 0.3, bodyH * 0.1, 6 * s, '#b58a64');
    if (this.game.player.muzzle > 0) {
      const fx = len, fy = 0;
      poly(ctx, [
        [fx, -bodyH * 1.3],
        [fx + 13 * s, -bodyH * 0.4],
        [fx + 25 * s, 0],
        [fx + 13 * s, bodyH * 0.4],
        [fx, bodyH * 1.3],
        [fx + 4 * s, 0]
      ], 'rgba(255,224,138,0.9)');
      poly(ctx, [
        [fx, -bodyH * 0.55],
        [fx + 15 * s, 0],
        [fx, bodyH * 0.55]
      ], 'rgba(255,248,204,0.95)');
    }
    ctx.restore();
  }

  drawMelee(ctx, view, s, weapon, bobX, bobY, reloadDip, meleeT, sleeve, sleeveDark) {
    const w = view.w, h = view.h;
    const icon = ITEMS[weapon.id].icon;
    const col = ITEMS[weapon.id].color || '#9ca4a8';
    const swing = meleeT > 0 ? Math.sin(meleeT * Math.PI) : 0;
    const handX = w * 0.66 + bobX - swing * w * 0.14;
    const handY = h * 0.94 + bobY + reloadDip * 0.3 - swing * h * 0.05;
    const angle = -Math.PI * 0.71 + swing * 1.25;
    const len = (icon === 'spear' ? 96 : icon === 'sledge' || icon === 'axe' ? 86 : 76) * s;
    const skin = '#c49a72';
    limb(ctx, w * 0.86, h * 1.12, handX, handY, 13 * s, sleeve);
    limb(ctx, w * 0.72, h * 1.12, handX - 4 * s, handY + 3 * s, 12 * s, sleeveDark);

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(angle);
    rect(ctx, -5 * s, -2.5 * s, 24 * s, 5 * s, '#5b3d29');
    rect(ctx, 12 * s, -1.5 * s, 18 * s, 3 * s, shade('#5b3d29', 18));
    if (icon === 'knife' || icon === 'machete') {
      poly(ctx, [
        [27 * s, -3.5 * s],
        [len, -2 * s],
        [len, 2 * s],
        [27 * s, 3.5 * s]
      ], shade(col, -18));
      poly(ctx, [
        [30 * s, -2.5 * s],
        [len - 3 * s, -1 * s],
        [len - 3 * s, 0.2 * s],
        [30 * s, 0.8 * s]
      ], shade(col, 28));
    } else if (icon === 'bat') {
      rect(ctx, 24 * s, -5 * s, len - 24 * s, 10 * s, col);
      rect(ctx, 30 * s, -4 * s, len - 32 * s, 3 * s, shade(col, 18));
      for (let i = 0; i < 4; i++) {
        rect(ctx, (38 + i * 10) * s, -6 * s, 1.5 * s, 3 * s, '#b7beb8');
      }
    } else if (icon === 'crowbar') {
      rect(ctx, 22 * s, -2 * s, len - 22 * s, 4 * s, col);
      rect(ctx, len - 14 * s, -10 * s, 5 * s, 12 * s, shade(col, -10));
      rect(ctx, len - 4 * s, -11 * s, 10 * s, 4 * s, shade(col, 12));
      rect(ctx, 30 * s, -1 * s, len - 34 * s, 1.5 * s, shade(col, 25));
    } else if (icon === 'axe' || icon === 'sledge') {
      rect(ctx, 22 * s, -2.5 * s, len - 20 * s, 5 * s, '#755336');
      if (icon === 'axe') {
        poly(ctx, [
          [len - 24 * s, -2 * s],
          [len - 8 * s, -15 * s],
          [len + 8 * s, -13 * s],
          [len + 4 * s, 0],
          [len + 8 * s, 13 * s],
          [len - 8 * s, 15 * s]
        ], col);
        poly(ctx, [
          [len - 10 * s, -12 * s],
          [len + 6 * s, -11 * s],
          [len + 4 * s, -4 * s],
          [len - 8 * s, -4 * s]
        ], shade(col, 24));
      } else {
        rect(ctx, len - 18 * s, -13 * s, 25 * s, 26 * s, shade(col, -18));
        rect(ctx, len - 15 * s, -10 * s, 19 * s, 7 * s, shade(col, 18));
      }
    } else if (icon === 'spear') {
      rect(ctx, 22 * s, -2 * s, len * 1.12, 4 * s, '#82633f');
      poly(ctx, [
        [len * 1.12, -5 * s],
        [len * 1.3, 0],
        [len * 1.12, 5 * s]
      ], shade(col, 18));
    } else {
      rect(ctx, 24 * s, -4 * s, len - 24 * s, 8 * s, col);
    }
    circle(ctx, 0, 0, 7 * s, skin);
    circle(ctx, 9 * s, 1 * s, 5 * s, '#b58a64');
    ctx.restore();
  }

  drawCrosshair(ctx, view) {
    const g = this.game;
    if (g.paused || g.ended) return;
    const w = view.w, h = view.h;
    const weapon = g.currentWeapon();
    const stats = weapon && ITEMS[weapon.id].weapon ? ITEMS[weapon.id].weapon : null;
    let spread = 3.5;
    if (stats) spread += (stats.spread || 0) * 90 + (g.player.attackAnim > 0 ? 3 : 0);
    if (g.player.moving) spread += 1.5;
    ctx.strokeStyle = 'rgba(225,220,185,0.72)';
    ctx.lineWidth = 1;
    const cx = Math.round(w / 2), cy = Math.round(h / 2);
    const gap = Math.round(spread);
    ctx.beginPath();
    ctx.moveTo(cx - gap - 4, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + 4, cy);
    ctx.moveTo(cx, cy - gap - 4); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(225,220,185,0.55)';
    ctx.fillRect(cx, cy, 1, 1);
    if (g.hitMarker > 0) {
      const a = clamp(g.hitMarker / 0.16, 0, 1);
      const len = 5 + (1 - a) * 3;
      ctx.strokeStyle = g.hitMarkerKill ? 'rgba(231,201,107,' + a + ')' : 'rgba(240,229,192,' + a + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - gap - 2, cy - gap - 2); ctx.lineTo(cx - gap - 2 - len, cy - gap - 2 - len);
      ctx.moveTo(cx + gap + 2, cy - gap - 2); ctx.lineTo(cx + gap + 2 + len, cy - gap - 2 - len);
      ctx.moveTo(cx - gap - 2, cy + gap + 2); ctx.lineTo(cx - gap - 2 - len, cy + gap + 2 + len);
      ctx.moveTo(cx + gap + 2, cy + gap + 2); ctx.lineTo(cx + gap + 2 + len, cy + gap + 2 + len);
      ctx.stroke();
    }
  }

  renderOverlays(ctx, view) {
    const g = this.game;
    const p = g.player;
    const w = view.w, h = view.h;
    if (p.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(150,30,25,' + (p.hurtFlash * 0.5) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    const hpRatio = p.health / p.maxHealth;
    if (hpRatio < 0.35) {
      const a = (0.12 + Math.sin(g.time * 4) * 0.05) * (1 - hpRatio / 0.35);
      ctx.fillStyle = 'rgba(95,18,16,' + a + ')';
      ctx.fillRect(0, 0, w, h);
    }
    if (g.overrun) {
      ctx.fillStyle = 'rgba(100,22,18,0.08)';
      ctx.fillRect(0, 0, w, h);
    }
    if (g.lastHurtTimer > 0) {
      const rel = normAngle(g.lastHurtAngle - g.fpYaw);
      const angle = rel - Math.PI / 2;
      const radius = Math.min(w, h) * 0.27;
      const alpha = clamp(g.lastHurtTimer / 1.1, 0, 1) * 0.85;
      ctx.strokeStyle = 'rgba(210,70,54,' + alpha + ')';
      ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.5, radius, angle - 0.24, angle + 0.24);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    let danger = 0;
    for (const z of g.zombies) {
      if (z.dead || z.attackWindup <= 0) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      danger = Math.max(danger, clamp(1 - d / 55, 0, 1));
    }
    if (danger > 0) {
      const grad = ctx.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.22, w / 2, h * 0.52, Math.max(w, h) * 0.7);
      grad.addColorStop(0, 'rgba(120,25,18,0)');
      grad.addColorStop(1, 'rgba(150,30,20,' + (0.1 + Math.sin(g.time * 9) * 0.035) * danger + ')');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
