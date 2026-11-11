/* DEAD ZONE — application shell, title, camp/expedition wiring */

import { PLAYER_BASE, ITEMS, ZONES } from './data.js';
import { fieldRows, itemH } from './inventory.js';
import {
  newSave, loadGame, saveGame, wipeSave, addXp, storeExtractedLoot,
  loseFieldKit, processCampProduction
} from './save.js';
import { ModalManager, HUD, Toasts, InventoryScreen, itemIconCanvas } from './ui.js';
import { CampUI } from './camp.js';
import { Game } from './game.js';
import { audio } from './audio.js';
import { fmtTime } from './util.js';

const $ = (id) => document.getElementById(id);
const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch-device');

const screenTitle = $('screen-title');
const screenCamp = $('screen-camp');
const screenGame = $('screen-game');
const touchControls = $('touch-controls');
const titleCanvas = $('title-canvas');
const titleCtx = titleCanvas.getContext('2d');
const gameCanvas = $('game-canvas');

const modal = new ModalManager($('modal-root'));
const toasts = new Toasts($('toasts'));
const hud = new HUD();

let save = null;
let game = null;
let campUI = null;
let invScreen = null;
let resultOpen = false;
let titleRaf = null;
let titleStart = performance.now();
let joyPointer = null;
let autoPaused = false;

/* ================================================================== */
/* TITLE                                                              */
/* ================================================================== */

function drawTitle(now) {
  const t = (now - titleStart) / 1000;
  const ctx = titleCtx;
  const w = 240, h = 135;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const sky = ctx.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, '#090d0b');
  sky.addColorStop(.55, '#131a14');
  sky.addColorStop(1, '#26301f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  /* dead sun behind the smoke */
  const sun = ctx.createRadialGradient(176, 49, 2, 176, 49, 30);
  sun.addColorStop(0, 'rgba(190, 116, 76, .36)');
  sun.addColorStop(.35, 'rgba(150, 77, 58, .14)');
  sun.addColorStop(1, 'rgba(120, 60, 50, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(140, 14, 74, 74);
  ctx.fillStyle = 'rgba(186, 123, 86, .28)';
  ctx.beginPath(); ctx.arc(176, 49, 10, 0, Math.PI * 2); ctx.fill();

  /* distant ruined skyline */
  ctx.fillStyle = '#101610';
  const skyline = [[6, 72, 18, 36], [26, 60, 12, 48], [41, 68, 20, 40], [66, 74, 10, 34], [80, 64, 16, 44],
    [105, 73, 14, 35], [124, 57, 8, 51], [136, 70, 21, 38], [161, 66, 13, 42], [180, 73, 12, 35],
    [196, 62, 17, 46], [218, 71, 16, 37], [234, 68, 12, 40]];
  for (const [x, y, bw, bh] of skyline) {
    ctx.fillRect(x, y, bw, bh);
    if ((x + y) % 3 === 0) { ctx.fillStyle = 'rgba(180, 130, 70, .18)'; ctx.fillRect(x + 3, y + 8, 1, 1); ctx.fillStyle = '#101610'; }
  }

  /* ground */
  ctx.fillStyle = '#182015';
  ctx.fillRect(0, 96, w, h - 96);
  ctx.fillStyle = '#202a1a';
  ctx.fillRect(0, 99, w, 3);
  ctx.fillStyle = '#2b2a1d';
  ctx.beginPath();
  ctx.moveTo(82, 135); ctx.lineTo(117, 98); ctx.lineTo(149, 98); ctx.lineTo(196, 135); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#363321';
  ctx.fillRect(90, 126, 80, 2);
  ctx.fillStyle = '#232c1c';
  for (let i = 0; i < 50; i++) ctx.fillRect((i * 43) % w, 102 + (i * 29) % 28, 1 + i % 3, 1);

  /* trees */
  const trees = [[8, 96, 1.6], [25, 103, 1.1], [46, 97, 1.9], [214, 101, 1.4], [230, 95, 1.8], [201, 104, .9]];
  for (const [x, y, s] of trees) drawTitlePine(ctx, x, y, s);

  /* rain */
  ctx.strokeStyle = 'rgba(155, 178, 164, .13)';
  ctx.lineWidth = .6;
  for (let i = 0; i < 55; i++) {
    const x = ((i * 37 + t * 22 + i * i) % (w + 30)) - 15;
    const y = ((i * 53 + t * 96) % (h + 30)) - 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 7); ctx.stroke();
  }

  /* shamblers crossing the road */
  for (let i = 0; i < 4; i++) {
    const speed = (i % 2 ? 1 : -1) * (2.2 + i * .5);
    const x = ((i * 73 + 30 + t * speed + 400) % (w + 90)) - 45;
    const y = 104 + (i % 3) * 4;
    drawShambler(ctx, x, y, .8 + (i % 2) * .25, t * (1.5 + i * .2), i === 1);
  }

  /* campfire glow far left */
  const flicker = 1 + Math.sin(t * 9) * .15;
  const glow = ctx.createRadialGradient(38, 108, 1, 38, 108, 24 * flicker);
  glow.addColorStop(0, 'rgba(225, 142, 60, .28)');
  glow.addColorStop(1, 'rgba(225, 142, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(8, 80, 66, 50);
  ctx.fillStyle = '#c06432';
  ctx.fillRect(36, 107, 4, 4);
  ctx.fillStyle = '#e4a14c';
  ctx.fillRect(37, 106, 2, 2);

  /* fog */
  ctx.fillStyle = 'rgba(100, 120, 104, .035)';
  ctx.fillRect(0, 84 + Math.sin(t * .5) * 2, w, 8);
  ctx.fillRect(20, 90 + Math.cos(t * .35) * 3, w - 40, 5);

  /* vignette + scanline */
  const vg = ctx.createRadialGradient(w / 2, h / 2, 34, w / 2, h / 2, 155);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2, 4, 3, .8)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

function drawTitlePine(ctx, x, y, s) {
  ctx.fillStyle = '#0c130d';
  ctx.fillRect(x - 1, y - 4, 2, 13 * s);
  for (let i = 0; i < 3; i++) {
    const yy = y - 4 - i * 8 * s;
    const ww = (12 - i * 3) * s;
    ctx.beginPath();
    ctx.moveTo(x, yy - 11 * s);
    ctx.lineTo(x - ww / 2, yy + 3 * s);
    ctx.lineTo(x + ww / 2, yy + 3 * s);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShambler(ctx, x, y, s, phase, eyes) {
  const sway = Math.sin(phase) * 1.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#0b100b';
  ctx.fillRect(-2 + sway * .2, -11, 4, 7);
  ctx.fillRect(-2 + sway * .25, -15, 4, 4);
  ctx.fillRect(-4 + sway * .4, -9, 2, 5);
  ctx.fillRect(2 + sway * .1, -8, 5, 2);
  ctx.fillRect(-3, -4, 2, 5);
  ctx.fillRect(1 + sway * .15, -4, 2, 5);
  ctx.fillStyle = 'rgba(80, 92, 63, .55)';
  ctx.fillRect(-1 + sway * .2, -10, 3, 5);
  if (eyes) {
    ctx.fillStyle = '#cbb36a';
    ctx.fillRect(-1 + sway * .5, -14, 1, 1);
    ctx.fillRect(1 + sway * .5, -14, 1, 1);
  }
  ctx.restore();
}

function startTitle() {
  screenTitle.classList.remove('hidden');
  screenCamp.classList.add('hidden');
  screenGame.classList.add('hidden');
  document.body.classList.remove('in-game');
  touchControls.classList.add('hidden');
  hud.hide();
  if (game) { game.destroy(); game = null; }
  if (campUI) campUI.hide();
  updateTitleState();
  titleStart = performance.now();
  cancelAnimationFrame(titleRaf);
  const tick = (now) => {
    if (screenTitle.classList.contains('hidden')) return;
    drawTitle(now);
    titleRaf = requestAnimationFrame(tick);
  };
  titleRaf = requestAnimationFrame(tick);
}

function updateTitleState() {
  const cont = $('btn-continue');
  const info = $('title-save');
  const soundBtn = $('btn-title-sound');
  if (soundBtn) soundBtn.textContent = audio.enabled ? '♪ SOUND ON' : '♪ SOUND OFF';
  if (save) {
    cont.classList.remove('hidden');
    info.textContent = `DAY ${save.day} · LEVEL ${save.player.level} · ${save.player.extracted} EXTRACTIONS · ${save.player.deaths} DEATHS`;
  } else {
    cont.classList.add('hidden');
    info.textContent = 'NO SURVIVOR RECORDED · START A NEW RUN';
  }
}

/* ================================================================== */
/* HELP / CONFIRM                                                     */
/* ================================================================== */

function showHelp() {
  const content = document.createElement('div');
  content.className = 'modal-copy';
  content.innerHTML = `
    <p><b>THE DEAD ZONE</b> is an extraction survival game. Deploy into a ruined district, scavenge what you can, and reach a radio beacon before the raid clock runs out.</p>
    <h3>THE LOOP</h3>
    <p>Camp → Deploy → Scavenge / Fight → Extract. Dying or abandoning a run destroys your field kit and all equipped gear. Extraction keeps everything you carried and adds field-kit loot to camp storage.</p>
    <h3>CONTROLS — KEYBOARD + MOUSE</h3>
    <div class="keyrow"><kbd>WASD</kbd><span>Move · <b>Shift</b> sprint · <b>C</b> crouch</span></div>
    <div class="keyrow"><kbd>LMB</kbd><span>Fire / melee · mouse aims · <b>1</b>/<b>2</b> switch weapons</span></div>
    <div class="keyrow"><kbd>V</kbd><span>Toggle first-person / isometric view · click the field to capture the mouse</span></div>
    <div class="keyrow"><kbd>E</kbd><span>Search, harvest, use beacon</span></div>
    <div class="keyrow"><kbd>R</kbd><span>Reload · <b>F</b> med · <b>G</b> eat · <b>H</b> drink</span></div>
    <div class="keyrow"><kbd>TAB</kbd><span>Field kit · <b>M</b> map · <b>Esc</b> pause</span></div>
    <h3>CONTROLS — TOUCH</h3>
    <p>Use the left joystick to move. Drag anywhere on the field to look around in first-person. Tap VIEW under the minimap to switch view. On the right: STRIKE attacks, USE interacts, RUN sprints, MED/EAT/DRINK appear in the kit, and KIT opens your inventory.</p>
    <h3>SURVIVAL</h3>
    <p>Watch health, stamina, hunger and thirst. Bleeding drains health. Shoot only when you can afford the noise. Infected rear back before striking — use that moment to move or fire. Zombies investigate gunshots and can call nearby dead. Crouching reduces detection.</p>
    <h3>CAMP</h3>
    <p>Build a workbench to unlock crafting, crates for storage, gardens and collectors for daily supplies, walls and barricades for defense. The radio tower reveals extract beacons and speeds extraction. Each return advances the day.</p>`;
  modal.open({ title: 'SURVIVAL BRIEFING', subtitle: 'READ BEFORE YOU DEPLOY', content, className: 'narrow' });
}

function showConfirm(title, text, confirmLabel, onConfirm, onCancel = null) {
  const content = document.createElement('div');
  content.className = 'modal-copy';
  const p = document.createElement('p');
  p.textContent = text;
  content.appendChild(p);
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const no = document.createElement('button');
  no.className = 'btn';
  no.textContent = 'CANCEL';
  const yes = document.createElement('button');
  yes.className = 'btn danger';
  yes.textContent = confirmLabel;
  actions.append(no, yes);
  content.appendChild(actions);
  const handle = modal.open({ title, content, className: 'narrow', onClose: onCancel });
  no.addEventListener('click', () => modal.close(handle));
  yes.addEventListener('click', () => { modal.close(handle); onConfirm(); });
  return handle;
}

/* ================================================================== */
/* CAMP                                                               */
/* ================================================================== */

function enterCamp() {
  modal.closeAll();
  resultOpen = false;
  if (game) { game.destroy(); game = null; }
  screenGame.classList.add('hidden');
  document.body.classList.remove('in-game');
  hud.hide();
  hud.prompt({ text: '' });
  touchControls.classList.add('hidden');
  resetTouchControls();
  screenTitle.classList.add('hidden');
  cancelAnimationFrame(titleRaf);
  if (!save) { save = newSave(); saveGame(save); }
  if (!campUI) {
    campUI = new CampUI(save, {
      notify: (text, tone) => toasts.show(text, tone),
      onDeploy: startExpedition,
      onHelp: showHelp,
      onSave: () => saveGame(save)
    });
  } else {
    campUI.save = save;
    campUI.invScreen = null;
  }
  campUI.setTab('overview');
  campUI.show();
  audio.setEnabled(save.settings.sound);
  saveGame(save);
  toasts.clear();
}

function startNewGame() {
  const sound = save ? save.settings.sound : true;
  wipeSave();
  const fresh = newSave();
  fresh.settings.sound = sound;
  save = fresh;
  if (campUI) { campUI.save = save; campUI.invScreen = null; campUI.active = 'overview'; }
  saveGame(save);
  enterCamp();
}

/* ================================================================== */
/* EXPEDITION                                                         */
/* ================================================================== */

function ensureFieldRows() {
  const target = fieldRows(save.equipment);
  if (save.field.rows === target) return;
  if (!save.field.resize(PLAYER_BASE.cols, target)) {
    const overflow = save.field.items.filter(it => it.y + itemH(it) > target);
    for (const it of overflow.slice()) {
      const left = save.camp.storage.add(save.field.remove(it.uid));
      if (left > 0) save.field.add(it);
    }
    save.field.resize(PLAYER_BASE.cols, target);
  }
}

function startExpedition(zoneId) {
  if (!save) return;
  if (!ZONES[zoneId]) return;
  ensureFieldRows();
  saveGame(save);
  toasts.clear();
  modal.closeAll();
  if (campUI) campUI.hide();
  screenCamp.classList.add('hidden');
  screenTitle.classList.add('hidden');
  screenGame.classList.remove('hidden');
  document.body.classList.add('in-game');
  cancelAnimationFrame(titleRaf);
  resultOpen = false;
  autoPaused = false;
  hud.prompt({ text: '' });

  if (game) game.destroy();
  game = new Game(gameCanvas, save, zoneId, {
    hud: (data, force) => hud.update(data, force),
    prompt: (data) => hud.prompt(data),
    toast: (text, tone) => toasts.show(text, tone),
    pause: openPause,
    inventory: openRaidInventory,
    map: openMap,
    loot: openLoot,
    view: (mode) => {
      if (save && save.settings) save.settings.view = mode;
      if (save) saveGame(save);
    },
    end: (type, data) => finishExpedition(type, data)
  });
  hud.show();
  if (isTouch) touchControls.classList.remove('hidden');
  audio.setEnabled(save.settings.sound);
  audio.init();
  resetTouchControls();
}

function finishExpedition(type, data) {
  if (resultOpen) return;
  resultOpen = true;
  if (game) {
    game.setPaused(true);
    game.ended = true;
  }
  hud.prompt({ text: '' });
  touchControls.classList.add('hidden');
  if (invScreen) invScreen = null;

  const stats = data.stats || { kills: 0, xp: 0, shots: 0, looted: 0 };
  let report = null;
  let lost = null;
  let xpResult = { levels: 0, gained: 0 };
  let production = null;
  const zoneName = data.zone ? data.zone.name : (game ? game.zone.name : 'DEAD ZONE');

  save.player.totalKills += Math.max(0, stats.kills || 0);
  save.player.totalRaids++;

  if (type === 'extracted') {
    report = storeExtractedLoot(save);
    xpResult = addXp(save, stats.xp || 0);
    save.player.extracted++;
    save.day++;
    production = processCampProduction(save);
    saveGame(save);
    showExpeditionResult('extracted', data, { report, xpResult, production, zoneName, stats });
  } else if (type === 'death') {
    lost = loseFieldKit(save);
    xpResult = addXp(save, Math.round((stats.xp || 0) * 0.25));
    save.player.deaths++;
    save.day++;
    production = processCampProduction(save);
    saveGame(save);
    showExpeditionResult('death', data, { lost, xpResult, production, zoneName, stats });
  } else {
    lost = loseFieldKit(save);
    save.player.deaths++;
    save.day++;
    production = processCampProduction(save);
    saveGame(save);
    showExpeditionResult('abandoned', data, { lost, xpResult, production, zoneName, stats });
  }
}

function lootChip(entry, isLost) {
  const el = document.createElement('span');
  el.className = 'loot-entry' + (isLost ? ' lost' : '');
  el.appendChild(itemIconCanvas(entry.id, 18));
  const label = document.createElement('span');
  label.textContent = (ITEMS[entry.id] ? ITEMS[entry.id].name : entry.id) + (entry.qty > 1 ? ' ×' + entry.qty : '');
  el.appendChild(label);
  return el;
}

function showExpeditionResult(type, data, info) {
  const success = type === 'extracted';
  const abandoned = type === 'abandoned';
  const content = document.createElement('div');
  const banner = document.createElement('div');
  banner.className = 'modal-result-banner ' + (success ? 'success' : 'death');
  const title = success ? 'EXTRACTION COMPLETE' : abandoned ? 'RUN ABANDONED' : 'SIGNAL LOST';
  const big = success ? 'YOU MADE IT OUT' : abandoned ? 'YOU WALKED AWAY' : 'YOU DIED';
  const sub = success
    ? `${info.zoneName} · ${fmtTime(data.time || 0)} survived`
    : abandoned
      ? `Your field kit and gear were left behind.`
      : `${data.cause || 'Killed in the dead zone'} · ${fmtTime(data.time || 0)} survived`;
  banner.innerHTML = `<div class="result-kicker">${success ? 'RECOVERY REPORT' : 'CASUALTY REPORT'}</div>
    <div class="result-title">${big}</div>
    <div class="result-sub">${sub}</div>`;
  content.appendChild(banner);

  const grid = document.createElement('div');
  grid.className = 'stat-grid';
  const killed = info.stats.kills || 0;
  const xp = info.xpResult.gained || 0;
  grid.innerHTML = `
    <div class="stat-box"><b>${killed}</b><span>KILLS</span></div>
    <div class="stat-box"><b>${xp}</b><span>${success ? 'XP' : 'XP SALVAGED'}</span></div>
    <div class="stat-box"><b>${fmtTime(data.time || 0)}</b><span>TIME</span></div>
    <div class="stat-box"><b>${success ? '✓' : '✕'}</b><span>EXTRACTION</span></div>
    <div class="stat-box"><b>${save.day}</b><span>DAY</span></div>`;
  content.appendChild(grid);

  if (info.xpResult.levels > 0) {
    const line = document.createElement('div');
    line.className = 'report-line';
    line.innerHTML = `<b>LEVEL UP</b> — you are now level ${save.player.level}. Maximum health and stamina increased.`;
    content.appendChild(line);
  }

  if (success) {
    const head = document.createElement('h3');
    head.textContent = 'RECOVERED TO CAMP STORAGE';
    head.className = 'report-line';
    content.appendChild(head);
    const list = document.createElement('div');
    list.className = 'loot-report';
    if (info.report.stored.length) for (const e of info.report.stored) list.appendChild(lootChip(e, false));
    else {
      const none = document.createElement('div');
      none.className = 'report-line';
      none.textContent = 'The field kit was empty.';
      list.appendChild(none);
    }
    content.appendChild(list);
    if (info.report.lost.length) {
      const warn = document.createElement('div');
      warn.className = 'report-line';
      warn.style.color = '#c38576';
      warn.textContent = 'Camp storage was full — these were left behind:';
      content.appendChild(warn);
      const lostList = document.createElement('div');
      lostList.className = 'loot-report';
      for (const e of info.report.lost) lostList.appendChild(lootChip(e, true));
      content.appendChild(lostList);
    }
  } else {
    const head = document.createElement('h3');
    head.textContent = 'LOST WITH THE RUN';
    head.className = 'report-line';
    content.appendChild(head);
    const list = document.createElement('div');
    list.className = 'loot-report';
    if (info.lost && info.lost.length) for (const e of info.lost) list.appendChild(lootChip(e, true));
    else {
      const none = document.createElement('div');
      none.className = 'report-line';
      none.textContent = 'Nothing was on the body.';
      list.appendChild(none);
    }
    content.appendChild(list);
    const note = document.createElement('div');
    note.className = 'report-line';
    note.textContent = 'Your camp storage, buildings and level survived. Rebuild your kit and go again.';
    content.appendChild(note);
  }

  if (info.production && (info.production.items.length || info.production.raid)) {
    const prod = document.createElement('div');
    prod.className = 'report-line';
    let text = '';
    if (info.production.items.length) {
      text += '<b>Camp production:</b> ' + info.production.items.map(i => ITEMS[i.id].name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ') + '. ';
    }
    if (info.production.raid) {
      if (info.production.raid.repelled) text += '<b>Night raid repelled</b> by your defenses.';
      else if (info.production.raid.stolen.length) {
        text += '<b>Raiders stole:</b> ' + info.production.raid.stolen.map(i => ITEMS[i.id].name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ') + '.';
      }
    }
    prod.innerHTML = text;
    content.appendChild(prod);
  }

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const back = document.createElement('button');
  back.className = 'btn primary';
  back.textContent = 'RETURN TO CAMP';
  actions.appendChild(back);
  content.appendChild(actions);

  const handle = modal.open({
    title: success ? 'EXTRACTION REPORT' : 'EXPEDITION REPORT',
    subtitle: info.zoneName,
    content,
    className: 'wide',
    closable: false
  });
  back.addEventListener('click', () => {
    modal.close(handle);
    if (game) { game.destroy(); game = null; }
    resultOpen = false;
    enterCamp();
  });
}

/* ================================================================== */
/* EXPEDITION MODALS                                                  */
/* ================================================================== */

function openRaidInventory() {
  if (!game || game.ended || invScreen || resultOpen) return;
  const content = document.createElement('div');
  game.setPaused(true);
  hud.prompt({ text: '' });
  const handle = modal.open({
    title: 'FIELD KIT',
    subtitle: (game.zone ? game.zone.name.toUpperCase() + ' · ' : '') + 'DRAG TO MOVE · DOUBLECLICK TO USE / EQUIP',
    content,
    className: 'wide',
    onClose: () => {
      invScreen = null;
      if (game && !game.ended) game.setPaused(false);
    }
  });
  invScreen = new InventoryScreen({
    save,
    mode: 'raid',
    mount: content,
    game,
    notify: (text, tone) => toasts.show(text, tone),
    onChanged: () => { if (game) game.refreshGear(); },
    onDropItem: (item) => { if (game) game.dropItem(item); }
  });
  requestAnimationFrame(() => handle.overlay.classList.add('open'));
}

function openLoot(container, lootInv) {
  if (!game || game.ended || invScreen || resultOpen) return;
  game.setPaused(true);
  hud.prompt({ text: '' });
  const content = document.createElement('div');
  const handle = modal.open({
    title: 'SEARCH FIND',
    subtitle: (game.zone ? game.zone.name.toUpperCase() + ' · ' : '') + 'TAKE WHAT YOU CAN CARRY',
    content,
    className: 'wide',
    onClose: () => {
      invScreen = null;
      if (game && !game.ended) game.setPaused(false);
    }
  });
  invScreen = new InventoryScreen({
    save,
    mode: 'loot',
    mount: content,
    game,
    lootInv,
    lootContainer: container,
    notify: (text, tone) => toasts.show(text, tone),
    onChanged: () => { if (game) game.refreshGear(); },
    onDropItem: (item) => { if (game) game.dropItem(item); }
  });
  requestAnimationFrame(() => handle.overlay.classList.add('open'));
}

function openMap() {
  if (!game || game.ended || resultOpen) return;
  game.setPaused(true);
  const content = document.createElement('div');
  content.className = 'map-wrap';
  const canvas = document.createElement('canvas');
  canvas.id = 'full-map';
  canvas.width = 720;
  canvas.height = 720;
  content.appendChild(canvas);
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = `<span><i style="background:#f1eccb"></i>YOU</span>
    <span><i style="background:#c3d474"></i>EXTRACTION</span>
    <span><i style="background:#c8a055"></i>UNKNOWN SIGNAL</span>
    <span><i style="background:#64614f"></i>EXPLORED STRUCTURE</span>`;
  content.appendChild(legend);
  const handle = modal.open({
    title: 'DEAD ZONE MAP',
    subtitle: (game.zone ? game.zone.name.toUpperCase() : '') + ' · EXPLORED AREA ONLY',
    content,
    className: 'wide',
    onClose: () => { if (game && !game.ended) game.setPaused(false); }
  });
  requestAnimationFrame(() => {
    game.drawFullMap(canvas.getContext('2d'));
    handle.overlay.classList.add('open');
  });
}

function openPause() {
  if (!game || game.ended || resultOpen || modal.isOpen) return;
  game.setPaused(true);
  const content = document.createElement('div');
  content.className = 'modal-copy';
  const grid = document.createElement('div');
  grid.className = 'pause-grid';
  const resume = document.createElement('button');
  resume.className = 'btn primary';
  resume.textContent = 'RESUME';
  const kit = document.createElement('button');
  kit.className = 'btn';
  kit.textContent = 'FIELD KIT';
  const map = document.createElement('button');
  map.className = 'btn';
  map.textContent = 'MAP';
  const sound = document.createElement('button');
  sound.className = 'btn';
  sound.textContent = save.settings.sound ? 'SOUND: ON' : 'SOUND: OFF';
  const abandon = document.createElement('button');
  abandon.className = 'btn danger';
  abandon.textContent = 'ABANDON RUN';
  grid.append(resume, kit, map, sound, abandon);
  content.appendChild(grid);
  const note = document.createElement('p');
  note.style.marginTop = '14px';
  note.style.color = '#7e8970';
  note.style.fontSize = '9px';
  note.textContent = 'Abandoning a run loses your field kit and equipped gear, and advances the day.';
  content.appendChild(note);

  const handle = modal.open({
    title: 'PAUSED',
    subtitle: (game.zone ? game.zone.name.toUpperCase() : '') + ' · THE DEAD ARE WAITING',
    content,
    className: 'narrow',
    onClose: () => { if (game && !game.ended) game.setPaused(false); }
  });
  resume.addEventListener('click', () => modal.close(handle));
  kit.addEventListener('click', () => { modal.close(handle); setTimeout(openRaidInventory, 10); });
  map.addEventListener('click', () => { modal.close(handle); setTimeout(openMap, 10); });
  sound.addEventListener('click', () => {
    save.settings.sound = !save.settings.sound;
    audio.setEnabled(save.settings.sound);
    if (save.settings.sound) audio.init();
    sound.textContent = save.settings.sound ? 'SOUND: ON' : 'SOUND: OFF';
    saveGame(save);
  });
  abandon.addEventListener('click', () => {
    showConfirm('ABANDON EXPEDITION?', 'You will lose your field kit and all equipped gear. The camp survives, and the day advances.', 'ABANDON RUN', () => {
      modal.closeAll();
      if (game) game.setPaused(true);
      const stats = game ? game.stats : { kills: 0, xp: 0, shots: 0, looted: 0 };
      const zone = game ? game.zone : null;
      const time = game ? game.time : 0;
      if (game) { game.ended = true; }
      finishExpedition('abandoned', { zone, stats, time, cause: 'Run abandoned' });
    });
  });
}

/* ================================================================== */
/* TOUCH                                                              */
/* ================================================================== */

function resetTouchControls() {
  const knob = $('joystick-knob');
  if (knob) knob.style.transform = '';
  const zone = $('joystick-zone');
  if (zone) zone.classList.remove('active');
  joyPointer = null;
  if (game) {
    game.setMoveInput(0, 0);
    game.setTouchRun(false);
    game.setTouchAttack(false);
  }
  for (const id of ['tbtn-attack', 'tbtn-run']) {
    const btn = $(id);
    if (btn) btn.classList.remove('active');
  }
}

function bindHoldButton(id, down, up) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!game || game.ended) return;
    el.classList.add('active');
    down();
  });
  const end = (e) => {
    if (e) e.preventDefault();
    el.classList.remove('active');
    if (up) up();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
}

function bindTouch() {
  const zone = $('joystick-zone');
  const base = $('joystick-base');
  const knob = $('joystick-knob');
  if (!zone || !base || !knob) return;
  let radius = 38;
  let cx = 0, cy = 0;

  const move = (e) => {
    if (joyPointer == null || e.pointerId !== joyPointer) return;
    e.preventDefault();
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let nx = dx / radius, ny = dy / radius;
    if (Math.hypot(nx, ny) < .16) { nx = 0; ny = 0; }
    if (game) game.setMoveInput(nx, ny);
  };
  const end = (e) => {
    if (e && joyPointer != null && e.pointerId !== joyPointer) return;
    joyPointer = null;
    knob.style.transform = '';
    zone.classList.remove('active');
    if (game) game.setMoveInput(0, 0);
  };

  zone.addEventListener('pointerdown', (e) => {
    if (!game || game.ended) return;
    e.preventDefault();
    const rect = base.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
    radius = rect.width / 2 - 27;
    joyPointer = e.pointerId;
    zone.classList.add('active');
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    move(e);
  });
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  bindHoldButton('tbtn-attack',
    () => { if (game) game.setTouchAttack(true); },
    () => { if (game) game.setTouchAttack(false); });
  bindHoldButton('tbtn-run',
    () => { if (game) game.setTouchRun(true); },
    () => { if (game) game.setTouchRun(false); });

  const click = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); if (game && !game.ended) fn(); });
  };
  click('tbtn-interact', () => game.touchInteract());
  click('tbtn-heal', () => game.quickHeal());
  click('tbtn-reload', () => game.startReload());
  click('tbtn-crouch', () => game.toggleCrouch());
  click('tbtn-inventory', () => { resetTouchControls(); openRaidInventory(); });
  click('tbtn-map', () => { resetTouchControls(); openMap(); });
}

/* ================================================================== */
/* HUD BUTTONS / GLOBAL                                                */
/* ================================================================== */

function bindHudButtons() {
  const click = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  };
  click('btn-view', () => { if (game && !game.ended) game.toggleViewMode(); });
  click('btn-inventory', () => { if (game && !game.ended) { resetTouchControls(); openRaidInventory(); } });
  click('btn-map', () => { if (game && !game.ended) { resetTouchControls(); openMap(); } });
  click('btn-pause', () => { if (game && !game.ended) { resetTouchControls(); openPause(); } });
  click('btn-reload', () => { if (game) game.startReload(); });
  click('hot-primary', () => { if (game) game.switchWeapon('primary'); });
  click('hot-melee', () => { if (game) game.switchWeapon('melee'); });
  click('hot-heal', () => { if (game) game.quickHeal(); });
  click('btn-eat', () => { if (game) game.quickEat(); });
  click('btn-drink', () => { if (game) game.quickDrink(); });
  click('btn-crouch', () => { if (game) game.toggleCrouch(); });
}

function bindTitleButtons() {
  $('btn-new').addEventListener('click', () => {
    audio.init();
    if (save) {
      showConfirm('ABANDON CURRENT CAMP?', 'Starting a new game erases your camp, storage, equipment, level and all progress. This cannot be undone.', 'ERASE & START', startNewGame);
    } else startNewGame();
  });
  $('btn-continue').addEventListener('click', () => {
    audio.init();
    if (!save) { toasts.show('No save found.', 'warn'); return; }
    enterCamp();
  });
  $('btn-title-help').addEventListener('click', () => { audio.init(); showHelp(); });
  $('btn-title-sound').addEventListener('click', () => {
    audio.init();
    const next = !audio.enabled;
    audio.setEnabled(next);
    if (save) { save.settings.sound = next; saveGame(save); }
    updateTitleState();
  });
}

function bindGlobal() {
  bindHudButtons();
  bindTouch();
  window.addEventListener('pointerdown', () => {
    if (audio.enabled) audio.init();
  }, { once: true });
  window.addEventListener('beforeunload', () => {
    if (save && campUI && !screenCamp.classList.contains('hidden')) saveGame(save);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game && !game.ended && !game.paused) { autoPaused = true; game.setPaused(true); }
    } else if (autoPaused) {
      autoPaused = false;
      if (game && !game.ended && !modal.isOpen) game.setPaused(false);
    }
    if (campUI) campUI.syncLoop();
  });
  setInterval(() => {
    if (save && campUI && !screenCamp.classList.contains('hidden') && !modal.isOpen) saveGame(save);
  }, 20000);
}

/* ================================================================== */
/* BOOT                                                               */
/* ================================================================== */

function boot() {
  save = loadGame();
  audio.setEnabled(save ? save.settings.sound : true);
  bindTitleButtons();
  bindGlobal();
  startTitle();
}

boot();
