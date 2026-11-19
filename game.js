(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (id) => document.getElementById(id);
  const el = {
    menu: $('menu'), pause: $('pauseScreen'), result: $('resultScreen'),
    hudLevel: $('hudLevel'), hudArmy: $('hudArmy'), hudLives: $('hudLives'),
    progress: $('progressFill'), note: $('worldNote'), tip: $('tip'), toast: $('toast'),
    coins: $('hudCoins'), menuCoins: $('menuCoins'), upgradeSoldiers: $('upgradeSoldiers'), upgradeArmor: $('upgradeArmor'),
    upgradeSoldiersCost: $('upgradeSoldiersCost'), upgradeArmorCost: $('upgradeArmorCost'), upgradeSoldiersLevel: $('upgradeSoldiersLevel'), upgradeArmorLevel: $('upgradeArmorLevel'),
    resultCoins: $('resultCoins'), combo: $('combo'), battleBanner: $('battleBanner'),
    sound: $('soundBtn'), pauseBtn: $('pauseBtn'), menuBest: $('menuBest'),
    resultIcon: $('resultIcon'), resultEyebrow: $('resultEyebrow'),
    resultTitle: $('resultTitle'), resultDescription: $('resultDescription'),
    resultLevel: $('resultLevel'), resultArmy: $('resultArmy'), resultBtn: $('resultBtn')
  };
  const TAU = Math.PI * 2;
  const MAX_ARMY = 999;
  const LENGTH = 765;
  const SAVE_KEY = 'battle-rush-save-v2';
  function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch { return {}; } }
  const saved = readSave();
  function upgradeCost(type) { return type === 'soldiers' ? 60 + upgrades.soldiers * 65 : 95 + upgrades.armor * 110; }
  const upgrades = { soldiers: clampInt(saved.soldiers, 0, 10), armor: clampInt(saved.armor, 0, 5) };
  function clampInt(v, a, b) { return Math.max(a, Math.min(b, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : a)); }
  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({coins:state.coins, soldiers:upgrades.soldiers, armor:upgrades.armor, best:state.best})); } catch {} }
  const startArmy = () => 10 + upgrades.soldiers * 5;
  let width = 390, height = 844, dpr = 1, lastFrame = 0, noteUntil = 0, toastUntil = 0;
  let audio = null;
  const storage = {
    read(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* private browsing */ } }
  };
  const state = {
    mode: 'menu', level: 1, best: Math.max(1, clampInt(saved.best ?? storage.read('battle-rush-best', '1'), 1, 99999)),
    coins: clampInt(saved.coins, 0, 999999), earned: 0, combo: 0, encounter: null, flash: 0, pace: 1,
    soundOn: storage.read('battle-rush-sound', '1') !== '0',
    distance: 0, army: 10, lives: 5, score: 0, playerX: 0,
    targetX: 0, time: 0, shake: 0, objects: [], particles: [], floaters: [],
    drag: false, moved: false, keyboard: 0, invulnerable: 0, resultWin: false
  };
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function random(seed) { let n = seed >>> 0; return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; }; }
  function resize() {
    width = Math.max(280, window.innerWidth);
    height = Math.max(360, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function project(x, z) {
    const p = 1 / (1 + Math.max(-9, z) / 58);
    const road = width * (.145 + .325 * p);
    return { x: width / 2 + x * road * .91, y: height * (.815 - .69 * (1 - p)), p, road };
  }
  function sound(freq = 440, duration = .09, type = 'triangle', end = freq * .72, volume = .065) {
    if (!state.soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio ||= new Ctx();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const t = audio.currentTime;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, t);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + duration);
      gain.gain.setValueAtTime(Math.max(.0001, volume), t);
      gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(t); oscillator.stop(t + duration);
    } catch { /* sound is optional */ }
  }
  function haptic(ms = 18) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* optional */ } }
  function setScreen(element, visible) {
    element.hidden = !visible;
    element.classList.toggle('visible', visible);
  }
  function announce(text, kind = 'good', seconds = 1.15) {
    el.note.textContent = text; el.note.className = 'world-note show ' + kind;
    noteUntil = state.time + seconds;
  }
  function toast(text) {
    el.toast.textContent = text; el.toast.classList.add('show'); toastUntil = state.time + 2.3;
  }
  function updateHud() {
    el.hudLevel.textContent = String(state.level).padStart(2, '0');
    el.hudArmy.textContent = state.army.toLocaleString('de-DE');
    el.hudLives.innerHTML = Array.from({length: 5}, (_, index) => index < state.lives ? '♥' : '<span class="lost">♥</span>').join(' ');
    el.hudLives.setAttribute('aria-label', state.lives + ' von fünf Leben');
    el.progress.style.width = (clamp(state.distance / LENGTH, 0, 1) * 100).toFixed(2) + '%';
    el.sound.textContent = state.soundOn ? '♫' : '♪';
    el.sound.setAttribute('aria-pressed', String(state.soundOn));
    el.menuBest.textContent = String(state.best).padStart(2, '0');
    el.coins.textContent = state.coins.toLocaleString('de-DE');
    el.menuCoins.textContent = state.coins.toLocaleString('de-DE');
    el.upgradeSoldiersCost.textContent = upgrades.soldiers >= 10 ? 'MAX' : upgradeCost('soldiers') + ' MÜNZEN';
    el.upgradeArmorCost.textContent = upgrades.armor >= 5 ? 'MAX' : upgradeCost('armor') + ' MÜNZEN';
    el.upgradeSoldiersLevel.textContent = '+' + upgrades.soldiers * 5;
    el.upgradeArmorLevel.textContent = upgrades.armor + '/5';
    el.upgradeSoldiers.disabled = upgrades.soldiers >= 10 || state.coins < upgradeCost('soldiers');
    el.upgradeArmor.disabled = upgrades.armor >= 5 || state.coins < upgradeCost('armor');
    el.combo.textContent = state.combo >= 2 ? '×' + state.combo + ' TORE IN FOLGE' : '';
    el.combo.classList.toggle('visible', state.combo >= 2);
  }
  function purchase(type) {
    if (state.mode !== 'menu') return;
    if (upgrades[type] >= (type === 'soldiers' ? 10 : 5)) return;
    const cost = upgradeCost(type);
    if (state.coins < cost) return;
    state.coins -= cost; upgrades[type]++; saveProgress();
    sound(620, .10, 'sine', 900, .06); setTimeout(() => sound(950, .12, 'sine', 1200, .06), 85);
    updateHud(); toast(type === 'soldiers' ? 'STARTTRUPPEN VERBESSERT' : 'RÜSTUNG VERBESSERT');
  }
  function addCoins(n) {
    const amount = Math.max(0, Math.round(n));
    if (!amount) return;
    state.coins = Math.min(999999, state.coins + amount);
    state.earned += amount;
    saveProgress();
  }
  function beginEncounter(obj) {
    obj.used = false;
    const boss = obj.type === 'boss';
    const casualties = Math.max(1, Math.ceil(obj.count * (1 - upgrades.armor * .075)));
    const beats = boss ? 1.75 : .8 + Math.min(.5, obj.count / 140);
    state.encounter = {obj, boss, elapsed: 0, duration: beats, startArmy: state.army, startEnemy: obj.count,
      losses: Math.min(state.army, casualties), opponentLosses: Math.min(obj.count, Math.ceil(state.army / (casualties || 1) * obj.count))};
    state.shake = boss ? 14 : 7;
    el.battleBanner.classList.add('visible');
    el.battleBanner.textContent = boss ? 'BOSS-SCHLACHT!' : 'SCHLACHT!';
    sound(215, .22, 'sawtooth', 110, .047);
    haptic(boss ? 45 : 20);
  }
  function updateEncounter(dt) {
    const e = state.encounter;
    if (!e) return;
    e.elapsed += dt;
    const progress = clamp(e.elapsed / e.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 1.55);
    const currentArmy = Math.max(0, Math.round(e.startArmy - e.losses * eased));
    const currentEnemy = Math.max(0, Math.round(e.startEnemy - e.opponentLosses * eased));
    state.army = currentArmy;
    e.obj.count = currentEnemy;
    if (Math.random() < dt * 22) {
      particlesAt(e.obj.x + (Math.random() - .5) * .35, 3, Math.random() < .5 ? '#fc4b5d' : '#49b8ff', 5, .5);
      state.shake = Math.max(state.shake, 2.5);
    }
    if (progress < 1) return;
    const obj = e.obj, boss = e.boss;
    state.encounter = null; obj.used = true;
    el.battleBanner.classList.remove('visible');
    particlesAt(obj.x, 2, '#ff5b71', boss ? 58 : 24, 1.15);
    floatText('-' + e.losses, obj.x, 2, '#ffe8ad');
    if (state.army <= 0) { takeLife(boss ? 'BOSS ZU STARK!' : 'ARMEE BESIEGT!'); return; }
    addCoins(boss ? 50 + state.level * 18 : 7 + Math.floor(e.startEnemy / 8));
    state.score += e.startEnemy * 10;
    if (boss) { showResult(true); }
    else { state.combo = 0; announce('GEGNER BESIEGT!', 'good', .95); sound(660, .15, 'triangle', 1040, .07); }
  }
  function buildLevel(level) {
    const rng = random(level * 19937 + 413);
    const items = [];
    const gatePositions = [65, 190, 313, 437, 566];
    const formulas = [
      [{label: '+18', kind: 'add', value: 18}, {label: '×2', kind: 'mul', value: 2}],
      [{label: '×3', kind: 'mul', value: 3}, {label: '+28', kind: 'add', value: 28}],
      [{label: '+35', kind: 'add', value: 35}, {label: '×2', kind: 'mul', value: 2}],
      [{label: '×2', kind: 'mul', value: 2}, {label: '+50', kind: 'add', value: 50}],
      [{label: '+45', kind: 'add', value: 45}, {label: '×3', kind: 'mul', value: 3}]
    ];
    gatePositions.forEach((z, group) => {
      const swapped = rng() > .5;
      const options = swapped ? [...formulas[group]].reverse() : formulas[group];
      options.forEach((item, index) => items.push({
        type: 'gate', group, z, x: index === 0 ? -.56 : .56,
        label: item.label, kind: item.kind, value: item.value, used: false
      }));
    });
    const enemyPlaces = [128, 255, 378, 500, 629];
    enemyPlaces.forEach((z, index) => items.push({
      type: 'enemy', z, x: [-.57, .56, -.54, .54, 0][index],
      count: Math.round(([12, 20, 30, 38, 55][index] + (level - 1) * (5 + index * 2)) * (.90 + rng() * .22)),
      used: false, seed: rng() * 300
    }));
    [154, 283, 410, 539].forEach((z, index) => items.push({
      type: 'barrel', z, x: [.58, -.54, .56, -.54][index],
      damage: Math.round([12, 17, 21, 28][index] * (1 + (level - 1) * .23)), used: false
    }));
    if (level >= 2) {
      items.push({type: 'spikes', z: 349, x: level % 2 ? -.53 : .51, damage: 14 + level * 4, used: false});
      if (level >= 3) items.push({type: 'spikes', z: 605, x: level % 2 ? .55 : -.53, damage: 20 + level * 5, used: false});
    }
    items.push({type: 'boss', z: 736, x: 0, count: 72 + (level - 1) * 40, used: false, seed: 0});
    return items;
  }
  function prepareLevel(level, army = startArmy()) {
    state.level = level; state.distance = 0; state.army = clamp(army, 10, MAX_ARMY);
    state.playerX = 0; state.targetX = 0; state.shake = 0; state.encounter = null; state.combo = 0; state.earned = 0;
    el.battleBanner.classList.remove('visible');
    state.objects = buildLevel(level); state.particles = []; state.floaters = [];
    state.invulnerable = 1.4; state.moved = false;
    el.tip.classList.remove('hide'); updateHud();
  }
  function startGame() {
    state.lives = 5; state.score = 0; state.time = 0; prepareLevel(1);
    state.mode = 'playing'; setScreen(el.menu, false); setScreen(el.pause, false); setScreen(el.result, false);
    announce('BAUE DEINE ARMEE!', 'good', 1.8);
    sound(510, .13, 'sine', 780, .07);
  }
  function pause() { if (state.mode !== 'playing') return; state.mode = 'paused'; setScreen(el.pause, true); }
  function resume() { if (state.mode !== 'paused') return; state.mode = 'playing'; setScreen(el.pause, false); lastFrame = performance.now(); }
  function backToMenu() {
    state.mode = 'menu'; setScreen(el.pause, false); setScreen(el.result, false);
    setScreen(el.menu, true); updateHud();
  }
  function showResult(win) {
    state.mode = 'result'; state.resultWin = win;
    el.resultIcon.textContent = win ? '★' : '✕';
    el.resultIcon.className = 'result-icon' + (win ? '' : ' lose');
    el.resultEyebrow.textContent = win ? 'LEVEL ABGESCHLOSSEN' : 'KEINE LEBEN MEHR';
    el.resultTitle.textContent = win ? 'SIEG!' : 'VERLOREN';
    el.resultDescription.textContent = win ? 'Starke Runde! Sammle mehr Soldaten und sichere dir den nächsten Sieg.' : 'Wähle stärkere Tore und halte deine Truppen zusammen.';
    if (win) addCoins(55 + state.level * 20 + Math.min(60, Math.floor(state.army / 4)));
    el.resultCoins.textContent = '+' + state.earned.toLocaleString('de-DE');
    el.resultLevel.textContent = String(state.level).padStart(2, '0');
    el.resultArmy.textContent = String(state.army);
    el.resultBtn.innerHTML = win ? 'NÄCHSTER LEVEL <span>▶</span>' : 'NOCH MAL SPIELEN <span>▶</span>';
    if (win) { state.best = Math.max(state.best, state.level + 1); storage.write('battle-rush-best', state.best); saveProgress(); confetti(); sound(700, .2, 'sine', 1100, .1); }
    else sound(190, .35, 'sawtooth', 60, .12);
    updateHud(); setScreen(el.result, true);
  }
  function takeLife(message) {
    state.lives = Math.max(0, state.lives - 1); state.shake = 13; haptic(90);
    sound(145, .25, 'sawtooth', 50, .11);
    if (!state.lives) { state.army = 0; showResult(false); return; }
    prepareLevel(state.level, startArmy()); state.invulnerable = 2;
    announce(message || 'ARMEE VERLOREN!', 'bad', 1.5);
    toast('Noch ' + state.lives + ' Leben – probiere andere Tore!');
  }
  function particlesAt(x, z, color, amount = 18, spread = 1) {
    const point = project(x, z);
    for (let i = 0; i < amount; i++) {
      const life = .4 + Math.random() * .6;
      state.particles.push({x: point.x, y: point.y - 14 * point.p, vx: (Math.random() - .5) * 180 * spread, vy: (-50 - Math.random() * 180) * spread,
        size: (2 + Math.random() * 5) * Math.max(.55, point.p), life, maxLife: life, color});
    }
    if (state.particles.length > 180) state.particles.splice(0, state.particles.length - 180);
  }
  function floatText(text, x, z, color = '#b6fbff') {
    const p = project(x, z);
    state.floaters.push({text, x: p.x, y: p.y - 47 * p.p, color, time: .95, max: .95});
  }
  function confetti() {
    for (let i = 0; i < 100; i++) {
      const colors = ['#66edff', '#ffe27b', '#ff6d87', '#d6f9ff'];
      state.particles.push({x: width * Math.random(), y: height * (.15 + Math.random() * .4), vx: (Math.random() - .5) * 250,
        vy: -130 - Math.random() * 220, size: 3 + Math.random() * 5, life: 1.8 + Math.random(), maxLife: 2.7, color: colors[i % 4]});
    }
  }
  function applyGate(obj) {
    const previous = state.army;
    state.army = clamp(obj.kind === 'mul' ? state.army * obj.value : state.army + obj.value, 1, MAX_ARMY);
    const gained = state.army - previous;
    state.combo++; if (state.combo >= 2) addCoins(3 * state.combo);
    particlesAt(obj.x, 2, '#52e4ff', 29, 1.25);
    floatText('+' + gained, obj.x, 1, '#a9fbff'); announce(obj.label + '  ·  +' + gained + ' SOLDATEN', 'good');
    sound(650, .15, 'sine', 1080, .075); haptic(20); state.score += gained;
  }
  function enemyFight(obj) { beginEncounter(obj); }
  function hitBarrel(obj) {
    state.combo = 0; state.army = Math.max(0, state.army - obj.damage);
    particlesAt(obj.x, 1, '#ffc15d', 32, 1.5);
    floatText('-' + obj.damage, obj.x, 0, '#ffd6a1');
    state.shake = 11; sound(105, .24, 'sawtooth', 50, .12); haptic(45);
    if (state.army <= 0) takeLife('FASS EXPLODIERT!');
    else announce('−' + obj.damage + ' SOLDATEN', 'bad');
  }
  function bossFight(obj) { beginEncounter(obj); }
  function handleCollisions() {
    if (state.encounter) return;
    for (const obj of state.objects) {
      if (obj.used || obj.z - state.distance > 2.5 || obj.z - state.distance < -7) continue;
      obj.used = true;
      if (obj.type === 'gate') {
        const siblings = state.objects.filter(other => other.type === 'gate' && other.group === obj.group);
        for (const sibling of siblings) sibling.used = true;
        const selected = siblings.find(gate => Math.abs(gate.x - state.playerX) < .49);
        if (selected) applyGate(selected);
        else toast('Tor verpasst! Lenke in eine der beiden Spuren.');
      } else if (obj.type === 'enemy') {
        if (Math.abs(state.playerX - obj.x) < .49) { enemyFight(obj); break; }
      } else if (obj.type === 'barrel') {
        if (Math.abs(state.playerX - obj.x) < .31) { hitBarrel(obj); if (state.mode !== 'playing') break; }
      } else if (obj.type === 'spikes') {
        if (Math.abs(state.playerX - obj.x) < .36) { hitBarrel(obj); if (state.mode !== 'playing') break; }
      } else if (obj.type === 'boss') { bossFight(obj); break; }
      if (state.distance < 1) break;
    }
  }
  function update(dt) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - 32 * dt);
    if (state.mode === 'playing') {
      if (state.keyboard) state.targetX = clamp(state.targetX + state.keyboard * dt * 1.85, -.88, .88);
      state.playerX = lerp(state.playerX, state.targetX, Math.min(1, dt * 12));
      if (state.encounter) updateEncounter(dt);
      else { state.distance += (21.7 + Math.min(3, (state.level - 1) * .35)) * dt; handleCollisions(); }
      state.invulnerable = Math.max(0, state.invulnerable - dt);
      if (state.distance > 16) el.tip.classList.add('hide');
      updateHud();
    }
    for (const particle of state.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 380 * dt; particle.life -= dt; }
    state.particles = state.particles.filter(p => p.life > 0);
    for (const floater of state.floaters) { floater.y -= 52 * dt; floater.time -= dt; }
    state.floaters = state.floaters.filter(f => f.time > 0);
    if (state.time > noteUntil) el.note.classList.remove('show');
    if (state.time > toastUntil) el.toast.classList.remove('show');
  }
  function roundedRect(x, y, w, h, r, fill) {
    if (w <= 0 || h <= 0) return;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#659bb9'); sky.addColorStop(.38, '#bfdfd6'); sky.addColorStop(.62, '#d0c99f'); sky.addColorStop(1, '#adad8b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const sun = ctx.createRadialGradient(width * .7, height * .17, 4, width * .7, height * .17, width * .7);
    sun.addColorStop(0, '#ffffffaa'); sun.addColorStop(.2, '#fff7cd66'); sun.addColorStop(1, '#ffffff00');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#71989b'; ctx.beginPath(); ctx.moveTo(0, height * .24);
    for (let x = 0; x <= width + 30; x += 25) ctx.lineTo(x, height * (.23 + .016 * Math.sin(x * .012) + .01 * Math.sin(x * .045)));
    ctx.lineTo(width, height * .44); ctx.lineTo(0, height * .44); ctx.fill();
    ctx.fillStyle = '#9eae9d'; ctx.beginPath(); ctx.moveTo(0, height * .31);
    for (let x = 0; x <= width + 30; x += 22) ctx.lineTo(x, height * (.295 + .009 * Math.sin(x * .028)));
    ctx.lineTo(width, height * .48); ctx.lineTo(0, height * .48); ctx.fill();
  }
  function drawRoad() {
    const far = project(0, 270), near = project(0, -12);
    const leftFar = project(-1.08, 270), rightFar = project(1.08, 270);
    const leftNear = project(-1.08, -12), rightNear = project(1.08, -12);
    const ground = ctx.createLinearGradient(0, far.y, 0, height);
    ground.addColorStop(0, '#d3c5a1'); ground.addColorStop(1, '#e3cb9f');
    ctx.beginPath(); ctx.moveTo(leftFar.x, far.y); ctx.lineTo(rightFar.x, far.y);
    ctx.lineTo(rightNear.x, near.y + 150); ctx.lineTo(leftNear.x, near.y + 150); ctx.closePath();
    ctx.fillStyle = ground; ctx.fill();
    // Light direction and edge glints add volume to the raised stone arena.
    const roadLight = ctx.createLinearGradient(leftNear.x, 0, rightNear.x, 0);
    roadLight.addColorStop(0, '#a88f7033'); roadLight.addColorStop(.22, '#fff7db55');
    roadLight.addColorStop(.65, '#ffffff00'); roadLight.addColorStop(1, '#79644b44');
    ctx.fillStyle = roadLight; ctx.fill();
    ctx.strokeStyle = '#fff4d199'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(leftFar.x,far.y); ctx.lineTo(leftNear.x,near.y+145);
    ctx.moveTo(rightFar.x,far.y); ctx.lineTo(rightNear.x,near.y+145); ctx.stroke();
    const linesOffset = state.distance % 10;
    for (let z = 250 - linesOffset; z >= -14; z -= 10) {
      const a = project(-1.08, z), b = project(1.08, z);
      ctx.strokeStyle = 'rgba(104,87,66,.115)'; ctx.lineWidth = Math.max(.5, 1.2 * a.p);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const lane of [-.71, -.36, 0, .36, .71]) {
      ctx.beginPath();
      for (let z = 260; z >= -12; z -= 5) {
        const p = project(lane, z);
        if (z === 260) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(100,83,60,.085)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Stone railings: close stones cover far stones for tangible 2.5D depth.
    for (let z = 210 - (state.distance % 17); z >= -12; z -= 17) {
      for (const side of [-1, 1]) {
        const p = project(side * 1.095, z);
        const size = 15 * p.p + 2, blockHeight = 18 * p.p + 3;
        const x = p.x - size / 2, y = p.y - blockHeight;
        ctx.fillStyle = '#746f5f45'; ctx.beginPath(); ctx.ellipse(p.x + 4 * p.p, p.y + 3, size * .78, 3 * p.p + 1, 0, 0, TAU); ctx.fill();
        roundedRect(x, y, size, blockHeight, size * .13, '#aca998');
        ctx.fillStyle = '#e5e0c7'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * .27, y - size * .25);
        ctx.lineTo(x + size * 1.17, y - size * .25); ctx.lineTo(x + size, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8c877b'; ctx.fillRect(x + size - 2 * p.p, y + 2, 2 * p.p, blockHeight - 2);
      }
    }
    drawScenery();
  }
  function drawScenery() {
    for (let z = 220 - (state.distance % 57); z >= 4; z -= 57) {
      for (const side of [-1, 1]) {
        const p = project(side * 1.5, z);
        const size = 20 * p.p;
        ctx.fillStyle = '#637d59b3';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, size * .7, size * .22, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#786b4c'; ctx.fillRect(p.x - size * .09, p.y - size * 1.6, size * .18, size * 1.6);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = ['#4b7656', '#679566', '#83a473'][k];
          ctx.beginPath(); ctx.arc(p.x + (k - 1) * size * .42, p.y - size * (1.9 + (k % 2) * .35), size * (.65 - k * .08), 0, TAU); ctx.fill();
        }
      }
    }
  }
  function drawSoldier(x, y, scale, color, tick, row) {
    const s = scale;
    if (s < .15) return;
    const enemy = color === 'red';
    const main = enemy ? '#db354a' : '#148cf0';
    const light = enemy ? '#ff8e8b' : '#76d8ff';
    const dark = enemy ? '#7f2136' : '#07539c';
    const bob = Math.sin(tick * 14 + row * 1.6 + x * .04) * 1.15 * s;
    // Contact shadow, animated stride and layered armor for a miniature figurine look.
    ctx.fillStyle = '#25374a40'; ctx.beginPath(); ctx.ellipse(x + 1 * s, y + 2 * s, 6.6 * s, 3.1 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2.35 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x-2.3*s,y-7*s+bob); ctx.lineTo(x-3.5*s,y+Math.sin(tick*14+row)*1.9*s);
    ctx.moveTo(x+2.3*s,y-7*s+bob); ctx.lineTo(x+3.4*s,y-Math.sin(tick*14+row)*1.9*s); ctx.stroke();
    ctx.fillStyle = dark; roundedRect(x-5.3*s,y-17.8*s+bob,10.6*s,12*s,2.3*s);
    const vest = ctx.createLinearGradient(x-5*s,y,x+5*s,y);
    vest.addColorStop(0,dark); vest.addColorStop(.35,light);vest.addColorStop(.55,main);vest.addColorStop(1,dark);
    roundedRect(x-4.2*s,y-17*s+bob,8.4*s,10*s,2*s,vest);
    ctx.fillStyle = '#ffffff45'; roundedRect(x-3.2*s,y-16.8*s+bob,1.4*s,7.3*s,.5*s);
    ctx.strokeStyle = dark;ctx.lineWidth = 2.25*s;
    ctx.beginPath(); ctx.moveTo(x-4.2*s,y-14.7*s+bob);ctx.lineTo(x-6.1*s,y-9.4*s+bob);
    ctx.moveTo(x+4.1*s,y-14.7*s+bob);ctx.lineTo(x+6.4*s,y-9.3*s+bob);ctx.stroke();
    // Spear silhouettes make armies readable at distance, matching the battle-runner language.
    if (s > .25) {
      ctx.strokeStyle = '#5b4f47';ctx.lineWidth = 1.2*s;
      ctx.beginPath();ctx.moveTo(x+6.4*s,y-7*s+bob);ctx.lineTo(x+7.7*s,y-29*s+bob);ctx.stroke();
      ctx.fillStyle = '#e5e9e8';ctx.beginPath();ctx.moveTo(x+7.7*s,y-33*s+bob);ctx.lineTo(x+5.5*s,y-27.5*s+bob);ctx.lineTo(x+9.3*s,y-28*s+bob);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#e6a783';ctx.beginPath();ctx.ellipse(x,y-19.6*s+bob,3.4*s,3.2*s,0,0,TAU);ctx.fill();
    const helm=ctx.createLinearGradient(x-4*s,y,x+4*s,y);
    helm.addColorStop(0,dark);helm.addColorStop(.32,light);helm.addColorStop(.66,main);helm.addColorStop(1,dark);
    ctx.fillStyle=helm;ctx.beginPath();ctx.ellipse(x,y-21.6*s+bob,4.4*s,3.15*s,0,Math.PI,TAU);ctx.fill();
    roundedRect(x-4.1*s,y-21.8*s+bob,8.2*s,1.7*s,.4*s,dark);
  }
  function drawCrowd(x, z, count, color, boss = false) {
    if (count <= 0) return;
    const n = Math.min(count, boss ? 82 : 90);
    const cols = Math.ceil(Math.sqrt(n * 1.65));
    const rows = Math.ceil(n / cols);
    const size = Math.min(1.20, width / 390) * (boss ? 1.10 : 1) * (n > 65 ? .86 : 1);
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (index >= n) continue;
        const rowCount = Math.min(cols, n - row * cols);
        if (col >= rowCount) continue;
        const jitter = Math.sin(index * 12.73 + (boss ? 1 : 2)) * .018;
        const xx = clamp(x + (col - (rowCount - 1) / 2) * (n > 65 ? .095 : .110) + jitter, -.94, .94);
        const zz = z + (rows - row - 1) * 3.05 + Math.sin(index * 4.9) * .55;
        if (zz < -11 || zz > 230) continue;
        const p = project(xx, zz);
        drawSoldier(p.x, p.y, size * p.p, color, state.time, index);
      }
    }
    const center = project(x, z + rows * 1.5);
    const labelY = center.y - Math.max(29, 31 * center.p + rows * 3 * center.p);
    const fs = clamp(15 * center.p + 9, 11, 25);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `1000 ${fs}px system-ui,sans-serif`;
    ctx.lineWidth = Math.max(2.5, 3.7 * center.p); ctx.strokeStyle = color === 'red' ? '#651326' : '#064776';
    ctx.strokeText(String(count), center.x, labelY);
    ctx.fillStyle = color === 'red' ? '#ffb2b9' : '#d4faff'; ctx.fillText(String(count), center.x, labelY);
  }
  function drawGate(obj, z) {
    const p = project(obj.x, z);
    const w = width * .31 * p.p + 8 * p.p, h = (68 * p.p + 2);
    const y = p.y - h;
    if (p.p < .19) return;
    ctx.fillStyle = '#06335c45'; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * .64, 8 * p.p, 0, 0, TAU); ctx.fill();
    const grad = ctx.createLinearGradient(0, y, 0, p.y);
    grad.addColorStop(0, obj.kind === 'mul' ? '#88f7bfee' : '#73e0ffed');
    grad.addColorStop(1, obj.kind === 'mul' ? '#119c7bbd' : '#097db5c9');
    ctx.shadowColor = obj.kind === 'mul' ? '#37f4ad' : '#21c9ff'; ctx.shadowBlur = 17 * p.p;
    roundedRect(p.x - w / 2, y, w, h, 4 * p.p, grad); ctx.shadowBlur=0;
    ctx.fillStyle='#ffffff2a'; roundedRect(p.x-w/2+5*p.p,y+4*p.p,w-10*p.p,5*p.p,1*p.p);
    ctx.lineWidth = Math.max(1.5, p.p * 4);
    ctx.strokeStyle = obj.kind === 'mul' ? '#bbffdd' : '#b2f6ff';
    ctx.strokeRect(p.x - w / 2 + 1, y + 1, w - 2, h - 1);
    const postW = 8 * p.p;
    roundedRect(p.x - w / 2 - postW * .5, y - 6 * p.p, postW, h + 11 * p.p, 1.8 * p.p, '#ded6a9');
    roundedRect(p.x + w / 2 - postW * .5, y - 6 * p.p, postW, h + 11 * p.p, 1.8 * p.p, '#a9a080');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `1000 ${Math.max(13, 34 * p.p)}px system-ui,sans-serif`;
    ctx.lineWidth = Math.max(2, 3 * p.p); ctx.strokeStyle = '#205b6888';
    ctx.strokeText(obj.label, p.x, y + h * .47);
    ctx.fillStyle = '#fff'; ctx.fillText(obj.label, p.x, y + h * .47);
  }
  function drawBarrel(obj, z) {
    const p = project(obj.x, z), s = Math.max(.14, p.p) * Math.min(1.3, width / 390);
    const bw = 48 * s, bh = 49 * s;
    ctx.fillStyle = '#182c3b44'; ctx.beginPath(); ctx.ellipse(p.x + 4 * s, p.y, bw * .63, 9 * s, 0, 0, TAU); ctx.fill();
    const wood = ctx.createLinearGradient(p.x - bw / 2, 0, p.x + bw / 2, 0);
    wood.addColorStop(0, '#80501e'); wood.addColorStop(.17, '#eab464'); wood.addColorStop(.52, '#c88532'); wood.addColorStop(.83, '#f2c875'); wood.addColorStop(1, '#7d4b20');
    roundedRect(p.x - bw / 2, p.y - bh, bw, bh, 10 * s, wood);
    ctx.fillStyle='#fff4ca55'; roundedRect(p.x-bw*.24,p.y-bh*.91,bw*.18,bh*.82,3*s);
    for (const yy of [p.y - bh * .78, p.y - bh * .17]) {
      ctx.fillStyle = '#596a73'; ctx.fillRect(p.x - bw / 2, yy, bw, 5 * s);
      ctx.fillStyle = '#c1cbd0'; ctx.fillRect(p.x - bw / 2, yy, bw, 1 * s);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `1000 ${Math.max(11, 26 * s)}px system-ui,sans-serif`;
    ctx.lineWidth = Math.max(2, 3 * s); ctx.strokeStyle = '#683b0d';
    ctx.strokeText(String(obj.damage), p.x, p.y - bh * .48);
    ctx.fillStyle = '#ffeda0'; ctx.fillText(String(obj.damage), p.x, p.y - bh * .48);
  }
  function drawSpikes(obj, z) {
    const p = project(obj.x, z), s = Math.max(.2, p.p) * Math.min(1.3, width / 390);
    const w = 65 * s;
    ctx.fillStyle = '#28334460'; ctx.beginPath();ctx.ellipse(p.x,p.y+4*s,w*.61,12*s,0,0,TAU);ctx.fill();
    roundedRect(p.x-w/2,p.y-8*s,w,9*s,2*s,'#515967');
    for (let i=0; i<5;i++) {
      const cx=p.x-w*.41+i*w*.205;
      ctx.fillStyle='#c7d4d7';ctx.beginPath();ctx.moveTo(cx-5*s,p.y-7*s);ctx.lineTo(cx,p.y-29*s);ctx.lineTo(cx+5*s,p.y-7*s);ctx.fill();
      ctx.fillStyle='#657582';ctx.beginPath();ctx.moveTo(cx,p.y-29*s);ctx.lineTo(cx+5*s,p.y-7*s);ctx.lineTo(cx,p.y-7*s);ctx.fill();
    }
  }
  function drawBoss(obj, z) {
    const p = project(0, z + 10);
    if (z < 220) drawCrowd(0, z, obj.count, 'red', true);
    const s = p.p;
    if (s < .25) return;
    const y = p.y - 95 * s;
    ctx.fillStyle = '#170c26aa'; roundedRect(p.x - 71 * s, y, 142 * s, 27 * s, 8 * s);
    ctx.fillStyle = '#ff6780'; roundedRect(p.x - 67 * s, y + 4 * s, 134 * s, 19 * s, 6 * s);
    ctx.font = `1000 ${21 * s}px system-ui,sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♛ BOSS  ' + obj.count, p.x, y + 13 * s);
  }
  function drawEntities() {
    const visible = state.objects.filter(obj => !obj.used && obj.z - state.distance > -11 && obj.z - state.distance < 220);
    visible.sort((a, b) => b.z - a.z);
    for (const obj of visible) {
      const z = obj.z - state.distance;
      if (obj.type === 'gate') drawGate(obj, z);
      else if (obj.type === 'enemy') drawCrowd(obj.x, z, obj.count, 'red');
      else if (obj.type === 'barrel') drawBarrel(obj, z);
      else if (obj.type === 'spikes') drawSpikes(obj, z);
      else if (obj.type === 'boss') drawBoss(obj, z);
    }
  }
  function drawPlayer() {
    if (state.mode !== 'playing' && state.mode !== 'paused') return;
    const p = project(state.playerX, 0);
    const pulse = Math.sin(state.time * 4) * 1.5;
    const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 83);
    glow.addColorStop(0, '#37d7ff48'); glow.addColorStop(1, '#2fd3ff00');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(p.x, p.y - 12, 110, 53, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#91eeff80'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 7, 36 + pulse, 13 + pulse * .3, 0, 0, TAU); ctx.stroke();
    drawCrowd(state.playerX, -1, state.army, 'blue');
  }
  function drawEffects() {
    for (const particle of state.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size * .76);
    }
    ctx.globalAlpha = 1;
    for (const floater of state.floaters) {
      ctx.globalAlpha = Math.min(1, floater.time / .3);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `1000 ${Math.round(clamp(width * .07, 20, 35))}px system-ui,sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#163450'; ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.color; ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (state.shake > 0) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawBackground(); drawRoad();
    if (state.mode !== 'menu') { drawEntities(); drawPlayer(); }
    else { const p = project(0, 22); drawCrowd(-.26, 26, 18, 'blue'); drawCrowd(.33, 52, 22, 'red'); }
    drawEffects();
    if (state.encounter) {
      const a = Math.max(.02,.07 * (1-Math.abs(Math.sin(state.time*17))));
      ctx.fillStyle = 'rgba(255,128,124,'+a+')';ctx.fillRect(0,0,width,height);
    }
  }
  function frame(now) {
    const dt = lastFrame ? clamp((now - lastFrame) / 1000, 0, .04) : 0;
    lastFrame = now;
    update(dt); render(); requestAnimationFrame(frame);
  }
  function pointerToX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const center = rect.left + rect.width * .5;
    return clamp((clientX - center) / (rect.width * .43), -.88, .88);
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (state.mode !== 'playing') return;
    if (event.pointerType === 'touch' && !event.isPrimary) return;
    state.drag = true; state.targetX = pointerToX(event.clientX); state.moved = true;
    el.tip.classList.add('hide');
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Safari */ }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (state.mode === 'playing' && state.drag) state.targetX = pointerToX(event.clientX);
  });
  const release = () => { state.drag = false; };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { state.keyboard = -1; event.preventDefault(); }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { state.keyboard = 1; event.preventDefault(); }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      if (state.mode === 'playing') pause(); else if (state.mode === 'paused') resume();
    }
    if (event.key === 'Enter' && state.mode === 'menu') startGame();
  });
  window.addEventListener('keyup', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) state.keyboard = 0;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  $('startBtn').addEventListener('click', startGame);
  el.upgradeSoldiers.addEventListener('click', () => purchase('soldiers'));
  el.upgradeArmor.addEventListener('click', () => purchase('armor'));
  $('pauseBtn').addEventListener('click', pause);
  $('resumeBtn').addEventListener('click', resume);
  $('restartBtn').addEventListener('click', startGame);
  $('resultBtn').addEventListener('click', () => {
    if (!state.resultWin) { startGame(); return; }
    const carry = Math.max(startArmy(), Math.min(135, Math.floor(state.army * .45)));
    prepareLevel(state.level + 1, carry); state.mode = 'playing'; setScreen(el.result, false);
    announce('LEVEL ' + String(state.level).padStart(2, '0'), 'good', 1.4);
  });
  $('resultMenuBtn').addEventListener('click', backToMenu);
  $('soundBtn').addEventListener('click', () => {
    state.soundOn = !state.soundOn; storage.write('battle-rush-sound', state.soundOn ? '1' : '0');
    updateHud(); if (state.soundOn) sound(720, .1, 'sine', 930, .06);
  });
  window.addEventListener('resize', resize);
  resize(); updateHud(); requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // Expose read-only state to browser smoke tests without altering the gameplay.
  Object.defineProperty(window, '__battleDiagnostics', {get: () => ({mode: state.mode, level: state.level, army: state.army, lives: state.lives, distance: state.distance, playerX: state.playerX, objectCount: state.objects.length, coins: state.coins, upgrades:{...upgrades}, encounter: !!state.encounter, fpsTarget: 60})});
})();