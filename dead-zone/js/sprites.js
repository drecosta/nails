/* DEAD ZONE — procedural pixel art rendering */

import { ITEMS, ZOMBIE_TYPES } from './data.js';

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function circle(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

/* ------------------------------------------------------------------ */
/* ITEM ICONS                                                          */
/* ------------------------------------------------------------------ */
export function drawItemIcon(ctx, itemId, size = 16) {
  const d = ITEMS[itemId];
  if (!d) { rect(ctx, 3, 3, size - 6, size - 6, '#555'); return; }
  const s = size / 16;
  const P = (x, y, w, h, c) => rect(ctx, x * s, y * s, w * s, h * s, c);
  const c = d.color || '#9aa08b';
  const c2 = shade(c, -28), c3 = shade(c, 28);
  const dark = '#20231e';

  switch (d.icon) {
    case 'knife':
      P(2, 11, 4, 2, '#5a3f2b'); P(4, 10, 2, 2, '#7d5c3e');
      P(6, 3, 2, 8, c); P(8, 4, 2, 7, c3); P(7, 2, 2, 2, '#e1e7e8'); break;
    case 'machete':
      P(2, 12, 4, 2, dark); P(5, 10, 2, 3, '#6b4a30');
      P(6, 2, 3, 9, c); P(9, 3, 2, 7, c3); P(8, 1, 1, 2, '#d9e2e4'); break;
    case 'crowbar':
      P(2, 12, 4, 2, c2); P(4, 5, 2, 8, c); P(6, 3, 2, 3, c); P(8, 3, 2, 2, c3); P(9, 5, 1, 2, c); break;
    case 'bat':
      P(3, 13, 3, 2, '#4a3222'); P(5, 4, 3, 9, c); P(7, 2, 3, 4, c3); P(8, 2, 1, 1, '#d9d2b0'); P(6, 6, 1, 1, '#c9c0a0'); P(9, 7, 1, 1, '#c9c0a0'); break;
    case 'axe':
      P(3, 12, 3, 2, '#4e3323'); P(5, 4, 2, 9, '#755336'); P(7, 2, 5, 5, c); P(11, 3, 2, 3, c3); P(8, 7, 3, 2, c2); break;
    case 'sledge':
      P(3, 12, 3, 3, '#4e3323'); P(5, 4, 2, 9, '#755336'); P(6, 2, 7, 5, c); P(12, 3, 2, 3, c3); break;
    case 'spear':
      P(2, 13, 3, 2, '#5d412b'); P(4, 5, 1, 9, '#82633f'); P(4, 2, 2, 4, c); P(6, 2, 1, 3, c3); break;
    case 'pistol':
      P(2, 6, 9, 4, c); P(3, 5, 7, 1, c3); P(9, 6, 4, 2, c2); P(4, 10, 3, 4, dark); P(5, 10, 2, 4, '#6b6f70'); P(10, 8, 1, 2, '#3a3d3d'); break;
    case 'revolver':
      P(2, 6, 8, 3, c); P(3, 5, 5, 1, c3); P(9, 6, 3, 2, c2); P(4, 9, 3, 5, '#6b543a'); P(8, 7, 2, 2, c2); break;
    case 'smg':
      P(1, 6, 5, 3, c); P(5, 4, 4, 4, c2); P(8, 5, 5, 2, c); P(10, 7, 1, 3, dark); P(4, 9, 2, 4, dark); P(7, 9, 2, 2, c3); break;
    case 'rifle':
      P(0, 7, 9, 2, '#5d4933'); P(8, 6, 7, 3, c); P(12, 7, 4, 1, c2); P(4, 9, 2, 3, '#4a3828'); P(8, 9, 2, 3, c3); break;
    case 'shotgun':
      P(0, 7, 8, 3, '#5b3d29'); P(7, 6, 8, 2, c); P(13, 7, 3, 1, c2); P(4, 10, 3, 3, '#715137'); P(8, 9, 4, 2, '#463722'); break;
    case 'sniper':
      P(0, 7, 8, 2, '#4e533f'); P(7, 6, 9, 2, c); P(13, 7, 3, 1, c2); P(6, 3, 3, 3, '#3c4136'); P(9, 8, 1, 3, '#33352e'); P(2, 9, 2, 3, '#3e3326'); break;
    case 'ammo':
      for (let i = 0; i < 3; i++) { P(3 + i * 4, 5, 3, 7, c); P(3 + i * 4, 4, 3, 2, c3); P(4 + i * 4, 3, 1, 1, c3); }
      break;
    case 'shell':
      for (let i = 0; i < 2; i++) { P(4 + i * 5, 4, 4, 8, c); P(4 + i * 5, 9, 4, 3, '#b8a06a'); P(4 + i * 5, 11, 4, 1, '#6f5f3f'); }
      break;
    case 'armor':
      P(4, 3, 8, 3, c); P(3, 5, 10, 8, c); P(2, 6, 2, 4, c2); P(12, 6, 2, 4, c2); P(7, 6, 2, 6, c3); break;
    case 'vest':
      P(3, 4, 10, 9, c); P(5, 2, 2, 3, c2); P(9, 2, 2, 3, c2); P(4, 5, 2, 7, c3); P(10, 5, 2, 7, c3); P(6, 8, 4, 2, dark); break;
    case 'bag':
      P(4, 4, 8, 9, c); P(5, 2, 6, 3, c2); P(6, 3, 4, 1, '#c7bfa8'); P(5, 7, 6, 4, c2); P(7, 8, 2, 2, '#a59c7f'); break;
    case 'wood':
      P(2, 5, 12, 3, c); P(1, 8, 12, 3, c2); P(3, 11, 11, 2, c3); P(6, 5, 1, 3, '#5a3a24'); P(10, 8, 1, 3, '#5a3a24'); break;
    case 'scrap':
      P(3, 4, 9, 7, c); P(5, 2, 5, 4, c2); P(6, 6, 2, 2, dark); P(4, 9, 3, 2, c3); P(10, 9, 3, 2, c3); break;
    case 'fabric':
      P(3, 4, 10, 9, c); P(4, 3, 8, 2, c3); P(5, 6, 2, 2, c2); P(9, 9, 2, 2, c2); P(6, 11, 4, 1, c2); break;
    case 'components':
      P(3, 4, 10, 8, '#4a5a42'); P(4, 5, 8, 6, c); P(5, 6, 2, 2, '#c6d68a'); P(9, 8, 2, 2, '#c6d68a'); P(7, 5, 1, 6, '#2f3a2c'); P(11, 9, 1, 2, '#d0b65a'); break;
    case 'chemicals':
      P(6, 2, 4, 2, '#9ea698'); P(5, 4, 6, 2, '#c9d0c5'); P(4, 6, 8, 7, c); P(5, 8, 2, 3, c3); P(9, 10, 2, 1, '#53662e'); break;
    case 'fuel':
      P(3, 3, 10, 11, c); P(4, 2, 3, 2, c2); P(5, 1, 2, 1, '#5e4a2b'); P(4, 4, 2, 2, c3); P(5, 7, 6, 2, '#604123'); break;
    case 'rope':
      P(4, 3, 8, 2, c); P(2, 5, 12, 2, c2); P(3, 8, 10, 2, c); P(4, 11, 8, 2, c2); P(7, 5, 2, 3, '#7e6a48'); break;
    case 'stone':
      P(3, 6, 5, 5, c); P(7, 4, 5, 6, c2); P(5, 10, 7, 2, c3); P(9, 5, 2, 2, c3); break;
    case 'nails':
      for (let i = 0; i < 4; i++) { P(4 + i * 3, 4 + (i % 2) * 2, 1, 8, c); P(4 + i * 3, 3 + (i % 2) * 2, 2, 1, c3); }
      break;
    case 'can':
      P(5, 3, 7, 11, c); P(5, 3, 7, 2, c3); P(5, 12, 7, 2, c2); P(6, 6, 5, 1, c3); P(6, 8, 5, 1, '#d0c08a'); break;
    case 'ration':
      P(3, 4, 10, 9, c); P(4, 3, 8, 2, c2); P(5, 6, 6, 2, '#b5ad86'); P(6, 9, 4, 1, '#4f503a'); break;
    case 'bar':
      P(3, 5, 10, 7, c); P(4, 4, 8, 1, c3); P(5, 7, 6, 1, '#6b4a27'); P(6, 10, 4, 1, '#6b4a27'); break;
    case 'apple':
      P(4, 5, 8, 8, c); P(3, 7, 10, 5, c); P(8, 2, 1, 4, '#5f4327'); P(9, 3, 3, 2, '#5f7d3c'); P(6, 7, 2, 2, '#c97f6b'); break;
    case 'jerky':
      P(4, 3, 8, 10, c); P(5, 4, 6, 8, '#9a604b'); P(7, 5, 1, 6, '#633d30'); P(9, 6, 1, 4, '#633d30'); break;
    case 'bottle':
      P(6, 2, 4, 2, '#7e9aa8'); P(5, 4, 6, 3, c); P(4, 7, 8, 7, c); P(5, 7, 2, 5, c3); P(7, 8, 4, 1, '#d7e6e8'); break;
    case 'bandage':
      P(3, 4, 10, 9, c); P(4, 5, 8, 7, '#ece7d8'); P(6, 6, 4, 1, '#bdb6a4'); P(7, 8, 2, 4, '#bdb6a4'); break;
    case 'medkit':
      P(3, 3, 10, 10, c); P(4, 2, 6, 2, c2); P(7, 5, 2, 7, '#f0e8dc'); P(5, 7, 6, 2, '#f0e8dc'); break;
    case 'pills':
      P(4, 5, 8, 7, '#c6c1a8'); P(4, 5, 8, 2, '#8b8a7a'); P(6, 8, 4, 2, c); P(7, 7, 2, 4, c3); break;
    case 'flashlight':
      P(3, 7, 8, 4, c); P(9, 6, 4, 6, c3); P(4, 8, 2, 2, '#e8ddb0'); P(11, 7, 2, 4, '#f0e6b5'); break;
    case 'radio':
      P(3, 4, 10, 9, c); P(10, 2, 1, 3, '#9e9e8d'); P(4, 5, 4, 3, '#c8cfb4'); P(5, 9, 6, 1, '#4a5144'); P(8, 9, 1, 1, c2); P(10, 9, 1, 1, c2); break;
    case 'lockpick':
      P(3, 6, 8, 2, c); P(3, 8, 2, 4, c2); P(10, 5, 2, 2, c3); P(11, 7, 1, 4, c3); P(5, 10, 3, 1, '#8f866d'); break;
    case 'wrench':
      P(3, 5, 3, 3, c); P(4, 7, 2, 7, c2); P(9, 3, 4, 3, c); P(10, 5, 2, 2, dark); P(5, 12, 6, 2, c); break;
    case 'flare':
      P(6, 4, 4, 9, c); P(7, 2, 2, 3, '#e9c96a'); P(6, 12, 4, 2, '#6a3a2c'); P(7, 1, 2, 1, '#fff0b0'); break;
    case 'gasmask':
      P(4, 4, 8, 7, c); P(3, 5, 2, 4, c2); P(11, 5, 2, 4, c2); P(5, 6, 2, 2, '#3c463c'); P(9, 6, 2, 2, '#3c463c'); P(6, 9, 4, 3, '#444c3d'); break;
    case 'suppressor':
      P(2, 6, 12, 4, c); P(3, 5, 10, 1, c3); P(5, 5, 1, 5, '#4d5355'); P(8, 5, 1, 5, '#4d5355'); P(11, 5, 1, 5, '#4d5355'); break;
    case 'scope':
      P(4, 7, 8, 3, c); P(2, 6, 3, 5, c2); P(11, 6, 3, 5, c2); P(4, 6, 8, 1, c3); P(7, 5, 2, 1, '#aab5a4'); break;
    case 'mag':
      P(6, 2, 5, 10, c); P(5, 11, 6, 3, c2); P(7, 4, 2, 6, c3); break;
    case 'watch':
      circle(ctx, 8 * s, 8 * s, 6 * s, '#4a4a3f'); circle(ctx, 8 * s, 8 * s, 5 * s, c);
      P(7, 5, 1, 4, '#494a3d'); P(8, 8, 3, 1, '#494a3d'); P(7, 2, 2, 2, '#8b8770'); break;
    case 'battery':
      P(4, 3, 8, 10, c); P(6, 2, 4, 1, '#b9bb92'); P(4, 3, 8, 1, c3); P(6, 6, 4, 1, '#4e5838'); P(6, 9, 4, 1, '#4e5838'); break;
    default:
      P(3, 3, 10, 10, c); P(5, 5, 6, 6, c2);
  }
}

export function shade(hex, amt) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ------------------------------------------------------------------ */
/* ENTITIES                                                            */
/* ------------------------------------------------------------------ */

const SHADOW = 'rgba(0,0,0,0.35)';

export function drawPlayer(ctx, p, t) {
  const moving = p.moving;
  const run = p.running;
  const crouch = p.crouching;
  const bob = moving ? Math.sin(p.walkPhase * 2) * (crouch ? 0.5 : 1) : 0;
  const legSwing = moving ? Math.sin(p.walkPhase * (run ? 2.2 : 1.5)) * (run ? 3.2 : 2) : 0;
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.save();
  circle(ctx, x, y + 1, crouch ? 6 : 7, SHADOW);

  const skin = '#c49a72', skin2 = '#a87f5d';
  const shirt = p.shirt || '#3f4d3e';
  const shirt2 = shade(shirt, -22);
  const pants = p.pants || '#2e3540';
  const hair = p.hair || '#382e25';
  const bodyY = crouch ? y - 9 + bob : y - 13 + bob;
  const bodyH = crouch ? 6 : 8;

  /* backpack behind */
  if (p.backpack) {
    rect(ctx, x - 5, bodyY + 1, 4, 6, '#5c5238');
    rect(ctx, x - 5, bodyY + 3, 4, 2, '#756947');
  }

  /* legs */
  rect(ctx, x - 4, y - 6, 3, 6 + legSwing * 0.2, pants);
  rect(ctx, x + 1, y - 6, 3, 6 - legSwing * 0.2, shade(pants, -8));
  rect(ctx, x - 4, y - 1, 3, 2, '#25281f');
  rect(ctx, x + 1, y - 1, 3, 2, '#25281f');

  /* torso */
  rect(ctx, x - 4, bodyY, 8, bodyH, shirt);
  rect(ctx, x - 4, bodyY, 2, bodyH, shirt2);
  rect(ctx, x + 2, bodyY + 1, 2, bodyH - 2, shade(shirt, 14));
  if (p.armorSprite) {
    rect(ctx, x - 3, bodyY + 1, 6, bodyH - 2, p.armorSprite);
    rect(ctx, x - 3, bodyY + 1, 6, 1, shade(p.armorSprite, 20));
  }

  /* head */
  const headY = bodyY - 6;
  rect(ctx, x - 3, headY, 6, 6, skin);
  rect(ctx, x - 3, headY, 6, 2, hair);
  rect(ctx, x - 3, headY + 2, 1, 2, hair);
  if (p.facingX !== 0) {
    rect(ctx, x + (p.facingX > 0 ? 1 : -2), headY + 3, 1, 1, '#24211b');
  }

  /* arms / weapon */
  const aim = p.aimAngle;
  const faceRight = Math.cos(aim) >= 0;
  const armX = x + (faceRight ? 3 : -4);
  const armY = bodyY + 3;
  rect(ctx, armX, armY, 2, 4, skin2);
  if (p.weapon) {
    ctx.save();
    ctx.translate(x, bodyY + 3);
    ctx.rotate(aim);
    const wd = ITEMS[p.weapon.id];
    const gun = wd.weapon && wd.weapon.kind === 'gun';
    if (gun) {
      const long = wd.weapon.range > 300 ? 11 : 8;
      rect(ctx, 2, -2, long, 3, '#4f5555');
      rect(ctx, 2, -2, long, 1, '#7a8080');
      rect(ctx, 1, -1, 3, 5, '#333733');
      if (p.muzzle > 0) {
        rect(ctx, long + 1, -4, 4, 6, '#ffe08a');
        rect(ctx, long + 3, -2, 4, 2, '#fff6cc');
      }
    } else {
      rect(ctx, 2, -1, 8, 2, '#8d969a');
      rect(ctx, 8, -1, 4, 2, '#c5ced1');
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawZombie(ctx, z, t) {
  if (z.dead) return;
  const type = ZOMBIE_TYPES[z.type];
  const s = type.size || 1;
  const x = Math.round(z.x), y = Math.round(z.y);
  const low = z.type === 'crawler';
  const moving = z.moving;
  const phase = z.walkPhase || 0;
  const bob = moving ? Math.sin(phase * 1.7) * 0.8 : 0;
  const swing = moving ? Math.sin(phase * 1.8) * 2.5 : 0;
  const bodyY = low ? y - 7 : y - 13 * s + bob;
  const bodyH = low ? 5 : 8 * s;
  const skin = type.skin, cloth = type.color;
  ctx.save();
  circle(ctx, x, y + 1, 6 * s, SHADOW);

  if (!low) {
    rect(ctx, x - 4 * s, y - 6 * s, 3 * s, 6 * s + swing * 0.2, shade(cloth, -18));
    rect(ctx, x + 1 * s, y - 6 * s, 3 * s, 6 * s - swing * 0.2, shade(cloth, -26));
    rect(ctx, x - 4 * s, y - 1, 3 * s, 1.5, '#2b2a22');
    rect(ctx, x + 1 * s, y - 1, 3 * s, 1.5, '#2b2a22');
  }
  /* torso ragged */
  rect(ctx, x - 4 * s, bodyY, 8 * s, bodyH, cloth);
  rect(ctx, x - 4 * s, bodyY + bodyH - 2, 2 * s, 2, skin);
  rect(ctx, x + 2 * s, bodyY + 1, 2 * s, 2, shade(cloth, 18));
  /* stains */
  rect(ctx, x - 2 * s, bodyY + 2, 2 * s, 2, '#5c2f2b');
  rect(ctx, x + 1, bodyY + 4, 2, 1, '#4b2724');
  /* head */
  const headY = bodyY - 6 * s;
  rect(ctx, x - 3 * s, headY, 6 * s, 6 * s, skin);
  rect(ctx, x - 3 * s, headY, 6 * s, 1.5, shade(skin, -30));
  rect(ctx, x - 1.5 * s, headY + 2.4, 1.2 * s, 1.2 * s, '#231f19');
  rect(ctx, x + 1.8 * s, headY + 2.4, 1.2 * s, 1.2 * s, '#231f19');
  if (z.chase) {
    rect(ctx, x - 2 * s, headY + 4.2, 4 * s, 1, '#4a1f1e');
  }
  /* outstretched arms */
  const ang = z.aimAngle != null ? z.aimAngle : 0;
  const reach = z.chase ? 7 : 5;
  ctx.save();
  ctx.translate(x, bodyY + 3);
  ctx.rotate(ang);
  rect(ctx, 2, -3 * s, reach * s, 2 * s, skin);
  rect(ctx, 2, 1.2 * s, reach * s, 2 * s, shade(skin, -12));
  ctx.restore();
  if (z.hitFlash > 0) {
    ctx.globalAlpha = 0.35;
    rect(ctx, x - 5 * s, bodyY - 6 * s, 10 * s, bodyH + 6 * s, '#e9c0a0');
    ctx.globalAlpha = 1;
  }
  if (z.hp < z.maxHp) {
    const w = 10 * s;
    rect(ctx, x - w / 2, bodyY - 10 * s, w, 2, '#231f1c');
    rect(ctx, x - w / 2, bodyY - 10 * s, w * (z.hp / z.maxHp), 2, z.type === 'brute' ? '#c25d4a' : '#9db064');
  }
  ctx.restore();
}

export function drawTree(ctx, tr, t) {
  const x = tr.x, y = tr.y;
  if (tr.depleted) {
    circle(ctx, x, y, 4, 'rgba(0,0,0,0.25)');
    rect(ctx, x - 2, y - 4, 4, 4, '#5c4229');
    rect(ctx, x - 2, y - 4, 4, 1, '#82613c');
    return;
  }
  const sway = Math.sin(t * 1.1 + tr.sway) * 1.2;
  circle(ctx, x, y + 2, 6, 'rgba(0,0,0,0.3)');
  rect(ctx, x - 2, y - 9, 4, 10, '#4a3422');
  rect(ctx, x - 2, y - 9, 1, 10, '#6b4b2f');
  const tones = [
    ['#2c3b24', '#3f5430', '#526b3b'],
    ['#303c25', '#465630', '#5b6e3d'],
    ['#26351f', '#374a28', '#4b6234']
  ][tr.variant % 3];
  circle(ctx, x + sway, y - 14, 7, tones[0]);
  circle(ctx, x - 4 + sway, y - 11, 5, tones[0]);
  circle(ctx, x + 4 + sway, y - 11, 5, tones[0]);
  circle(ctx, x + sway, y - 15, 5.5, tones[1]);
  circle(ctx, x - 2 + sway, y - 12, 4, tones[1]);
  circle(ctx, x + 3 + sway, y - 13, 3.5, tones[2]);
  circle(ctx, x - 5 + sway, y - 10, 2.4, tones[2]);
}

export function drawRock(ctx, r, t) {
  const x = r.x, y = r.y;
  if (r.depleted) { circle(ctx, x, y, 4, '#3d3f3a'); return; }
  circle(ctx, x, y + 2, 6, 'rgba(0,0,0,0.3)');
  rect(ctx, x - 5, y - 3, 9, 5, '#666b64');
  rect(ctx, x - 3, y - 6, 7, 4, '#7b7f76');
  rect(ctx, x - 3, y - 6, 4, 2, '#92978c');
  rect(ctx, x + 2, y - 2, 3, 3, '#55594f');
  rect(ctx, x - 5, y + 1, 9, 1, '#44473f');
}

export function drawContainer(ctx, c, t) {
  const x = c.x, y = c.y, w = c.w, h = c.h;
  circle(ctx, x + w / 2, y + h - 1, w * 0.42, 'rgba(0,0,0,0.3)');
  const def = c.kind;
  const base = c.kind === 'car' ? '#586052' : c.kind === 'military' ? '#5a6045' : c.kind === 'fridge' ? '#8b928e' : c.kind === 'dumpster' ? '#485244' : c.kind === 'corpse' ? '#45302e' : '#7e603c';
  if (def === 'car') {
    rect(ctx, x + 2, y + 2, w - 4, h - 4, '#3b3e39');
    rect(ctx, x + 2, y + 2, w - 4, h - 4, base);
    rect(ctx, x + 4, y + 3, w - 8, 5, '#7c8d8a');
    rect(ctx, x + 4, y + h - 8, w - 8, 4, '#7c8d8a');
    rect(ctx, x + 6, y + 6, 7, 5, '#2a302d');
    rect(ctx, x + w - 14, y + 6, 7, 5, '#2a302d');
    rect(ctx, x + 4, y + 8, 3, 3, '#c9c288');
    rect(ctx, x + w - 7, y + 8, 3, 3, '#9c4d3c');
    if (c.opened) { ctx.globalAlpha = 0.4; rect(ctx, x + 1, y + 1, w - 2, h - 2, '#141612'); ctx.globalAlpha = 1; }
    return;
  }
  if (def === 'corpse') {
    circle(ctx, x + w / 2, y + h / 2, 7, '#3a2a2a');
    rect(ctx, x + 1, y + 3, w - 2, h - 5, '#4b3333');
    rect(ctx, x + 4, y + 2, 5, 3, '#725a4a');
    rect(ctx, x + 2, y + h - 3, w - 5, 2, '#5c2828');
    return;
  }
  /* generic furniture box */
  rect(ctx, x, y, w, h, shade(base, -25));
  rect(ctx, x + 1, y + 1, w - 2, h - 2, base);
  rect(ctx, x + 1, y + 1, w - 2, 2, shade(base, 25));
  if (def === 'locker') {
    rect(ctx, x + 3, y + 4, w - 6, h - 6, shade(base, -8));
    rect(ctx, x + w / 2, y + 4, 1, h - 6, shade(base, -30));
    rect(ctx, x + w - 5, y + h / 2, 2, 3, '#b8b29a');
  } else if (def === 'fridge') {
    rect(ctx, x + 2, y + 2, w - 4, 2, shade(base, 18));
    rect(ctx, x + w - 5, y + 5, 2, 5, '#d3d8cd');
    rect(ctx, x + w - 5, y + 12, 2, 3, '#d3d8cd');
  } else if (def === 'military') {
    rect(ctx, x + 2, y + 2, w - 4, h - 4, shade(base, -8));
    rect(ctx, x + w / 2 - 2, y + h / 2 - 2, 5, 5, '#c3c07a');
    rect(ctx, x + w / 2, y + h / 2 - 3, 1, 7, '#c3c07a');
    rect(ctx, x + w / 2 - 3, y + h / 2, 7, 1, '#c3c07a');
  } else if (def === 'toolbox') {
    rect(ctx, x + 2, y + 3, w - 4, h - 5, shade(base, -10));
    rect(ctx, x + w / 2 - 2, y + 2, 5, 2, '#4d4c43');
    rect(ctx, x + 3, y + 5, w - 6, 1, '#c2a263');
  } else if (def === 'medbox') {
    rect(ctx, x + w / 2 - 1, y + 4, 3, 8, '#b8483f');
    rect(ctx, x + 3, y + h / 2 - 1, w - 6, 3, '#b8483f');
  } else if (def === 'dumpster') {
    rect(ctx, x + 1, y + 2, w - 2, h - 4, shade(base, -8));
    rect(ctx, x + 2, y + h - 4, w - 4, 3, shade(base, -24));
    rect(ctx, x + 3, y + 4, w - 6, 2, '#666f5e');
  } else {
    rect(ctx, x + 3, y + 4, w - 6, h - 7, shade(base, -14));
    rect(ctx, x + 3, y + h - 5, w - 6, 2, shade(base, -30));
    rect(ctx, x + w / 2 - 1, y + 4, 2, h - 7, shade(base, 16));
  }
  if (c.locked && !c.opened) {
    rect(ctx, x + w / 2 - 2, y + h / 2 - 2, 4, 4, '#c9b55c');
    rect(ctx, x + w / 2 - 1, y + h / 2 - 3, 2, 2, '#8e8345');
  }
  if (c.opened) {
    ctx.globalAlpha = 0.35;
    rect(ctx, x, y, w, h, '#10130f');
    ctx.globalAlpha = 1;
  }
}

export function drawExtraction(ctx, e, t, known) {
  const x = e.x, y = e.y;
  ctx.save();
  ctx.globalAlpha = known ? 0.75 : 0.5;
  ctx.strokeStyle = known ? '#b9c96a' : '#9b7350';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(x, y, e.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  /* smoke beacon */
  for (let i = 0; i < 7; i++) {
    const life = ((t * 0.32 + i * 0.14) % 1);
    const px = x + Math.sin(i * 2.3 + t * 0.7) * 4;
    const py = y - 8 - life * 32;
    const r = 2 + life * 5;
    ctx.globalAlpha = (1 - life) * 0.22;
    circle(ctx, px, py, r, '#a8b09a');
  }
  ctx.globalAlpha = 1;
  /* beacon pole */
  rect(ctx, x - 2, y - 7, 4, 8, '#454a41');
  rect(ctx, x - 3, y - 11, 6, 5, known ? '#5f6b4b' : '#514b3d');
  const blink = Math.sin(t * 4.5) > 0;
  if (blink) {
    circle(ctx, x, y - 12, 2.5, known ? '#e6c76a' : '#a86a4a');
    ctx.globalAlpha = 0.25;
    circle(ctx, x, y - 12, 6, known ? '#e6c76a' : '#a86a4a');
    ctx.globalAlpha = 1;
  }
  rect(ctx, x - 4, y - 2, 8, 2, '#5e6454');
  ctx.restore();
}
