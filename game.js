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
    resultLevel: $('resultLevel'), resultArmy: $('resultArmy'), resultBtn: $('resultBtn'),
    upgradeLuck: $('upgradeLuck'), upgradeLuckCost: $('upgradeLuckCost'), upgradeLuckLevel: $('upgradeLuckLevel'),
    bonus: $('bonusBadge'), levelTheme: $('levelTheme'), menuStartLevel: $('menuStartLevel'),
    menuReplay: $('menuReplay'), resultMedal: $('resultMedal'), resultPerfect: $('resultPerfect'),
    fever: $('feverFill'), shield: $('hudShield')
  };
  const TAU = Math.PI * 2;
  const MAX_ARMY = 999;
  const LENGTH = 765;
  const SAVE_KEY = 'battle-rush-save-v2'; // Reads v2 saves and stores backward-compatible v3 fields.
  const BATTLE_VERSION = '3.0';
  function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch { return {}; } }
  const saved = readSave();
  function upgradeCost(type) { return type === 'soldiers' ? 60 + upgrades.soldiers * 65 : type === 'armor' ? 95 + upgrades.armor * 110 : 110 + upgrades.luck * 120; }
  const upgrades = { soldiers: clampInt(saved.soldiers, 0, 10), armor: clampInt(saved.armor, 0, 5), luck: clampInt(saved.luck, 0, 5) };
  function clampInt(v, a, b) { return Math.max(a, Math.min(b, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : a)); }
  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({coins:state.coins, soldiers:upgrades.soldiers, armor:upgrades.armor, luck:upgrades.luck, best:state.best, victories:state.victories, version:BATTLE_VERSION})); } catch {} }
  const startArmy = () => 10 + upgrades.soldiers * 5;
  let width = 390, height = 844, dpr = 1, lastFrame = 0, noteUntil = 0, toastUntil = 0;
  let audio = null;
  const storage = {
    read(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* private browsing */ } }
  };
  const state = {
    mode: 'menu', level: 1, best: Math.max(1, clampInt(saved.best ?? storage.read('battle-rush-best', '1'), 1, 99999)),
    coins: clampInt(saved.coins, 0, 999999), victories: clampInt(saved.victories, 0, 99999), earned: 0, combo: 0, encounter: null, flash: 0, pace: 1,
    theme: 'castle', shield: 0, fever: 0, feverActive: 0, hurt: false, collected: 0, gatesHit: 0,
    elapsed: 0, lastReward: 0, medal: '', slowFrame: 0, fps: 60, fpsAvg: 60,
    soundOn: storage.read('battle-rush-sound', '1') !== '0',
    distance: 0, army: 10, lives: 5, score: 0, playerX: 0,
    targetX: 0, time: 0, shake: 0, objects: [], particles: [], floaters: [],
    drag: false, moved: false, keyboard: 0, invulnerable: 0, resultWin: false
  };
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function random(seed) { let n = seed >>> 0; return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; }; }
  const THEMES = {
    castle: {name:'KÖNIGSBRÜCKE',sky:['#73a7c5','#d1eee2','#c2d5a9'],hill:'#81a29d',hill2:'#b2b9a0',road:['#d4bb94','#f2dfb3'],rail:['#bbb49d','#f3ead0','#898777'],tree:['#46745a','#83a86c']},
    coast:  {name:'KÜSTENFESTUNG',sky:['#548bbb','#e8dcb5','#e4c39e'],hill:'#6b97a0',hill2:'#a0bbad',road:['#c6ae93','#e6d3b7'],rail:['#c5bbb0','#eee6d9','#91877f'],tree:['#286d6e','#69b4a0']},
    valley: {name:'GRÜNES TAL',sky:['#6ea8d3','#d6eccc','#b8daa5'],hill:'#65948c',hill2:'#85ad86',road:['#bdb18c','#ded5ac'],rail:['#abb09f','#e8eace','#818777'],tree:['#327e50','#81bd60']},
    dusk:   {name:'SONNENFESTUNG',sky:['#b37c98','#f5cba2','#e6bc9a'],hill:'#a07888',hill2:'#b69d96',road:['#c8ae9a','#edd4b5'],rail:['#bda4a0','#f5d9d1','#907b80'],tree:['#63765b','#c3a06a']}
  };
  function themeFor(level) { return ['castle','coast','valley','dusk'][Math.floor((level - 1) / 2) % 4]; }
  const palette = () => THEMES[state.theme] || THEMES.castle;
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
    if (el.fever) el.fever.style.width = (state.feverActive > 0 ? 100 : state.fever).toFixed(0) + '%';
    if (el.shield) { el.shield.textContent = state.shield > 0 ? '◆ ' + state.shield : ''; el.shield.classList.toggle('active', state.shield > 0); }
    if (el.levelTheme) el.levelTheme.textContent = palette().name;
    if (el.menuStartLevel) el.menuStartLevel.textContent = String(state.best).padStart(2,'0');
    if (el.bonus) { el.bonus.textContent = state.feverActive > 0 ? 'FEUER-MODUS!' : state.fever >= 80 ? 'FEUER FAST BEREIT!' : ''; el.bonus.classList.toggle('active', state.feverActive > 0); }
    el.upgradeLuckCost.textContent = upgrades.luck >= 5 ? 'MAX' : upgradeCost('luck') + ' MÜNZEN';
    el.upgradeLuckLevel.textContent = '+' + upgrades.luck * 10 + '%';
    el.upgradeLuck.disabled = upgrades.luck >= 5 || state.coins < upgradeCost('luck');
  }
  function purchase(type) {
    if (state.mode !== 'menu') return;
    if (upgrades[type] >= (type === 'soldiers' ? 10 : 5)) return;
    const cost = upgradeCost(type);
    if (state.coins < cost) return;
    state.coins -= cost; upgrades[type]++; saveProgress();
    sound(620, .10, 'sine', 900, .06); setTimeout(() => sound(950, .12, 'sine', 1200, .06), 85);
    updateHud(); toast(type === 'soldiers' ? 'STARTTRUPPEN VERBESSERT' : type === 'armor' ? 'RÜSTUNG VERBESSERT' : 'MÜNZENBONUS VERBESSERT');
  }
  function addCoins(n) {
    const amount = Math.max(0, Math.round(n * (1 + upgrades.luck * .10)));
    if (!amount) return;
    state.coins = Math.min(999999, state.coins + amount);
    state.earned += amount;
    saveProgress();
  }
  function beginEncounter(obj) {
    const boss = obj.type === 'boss';
    const elite = obj.type === 'elite';
    const advantage = state.army / Math.max(1, obj.count);
    const weight = boss ? 1.2 : elite ? 1.12 : 1;
    const armor = 1 - upgrades.armor * .075;
    const fury = state.feverActive > 0 ? .58 : 1;
    const outnumber = advantage > 2.6 ? .76 : advantage > 1.7 ? .88 : 1;
    const losses = Math.min(state.army, Math.max(1, Math.ceil(obj.count * weight * armor * fury * outnumber)));
    const wins = state.army > losses;
    state.encounter = {obj, boss, elite, elapsed:0, duration:(boss?2.35:elite?1.35:1.08) * (advantage>3?.85:1),
      startArmy:state.army,startEnemy:obj.count,losses, wins, opponentLosses:wins ? obj.count : Math.max(1,Math.round(obj.count * state.army / Math.max(losses,1) * .85))};
    state.shake = boss ? 11 : 5;
    el.battleBanner.classList.add('visible');
    el.battleBanner.textContent = boss ? 'BOSS-SCHLACHT!' : elite ? 'ELITE-ANGRIFF!' : 'SCHLACHT!';
    sound(boss?170:235,.22,'sawtooth',95,.047); haptic(boss?40:15);
  }
  function updateEncounter(dt) {
    const e = state.encounter;
    if (!e) return;
    e.elapsed += dt;
    const progress = clamp(e.elapsed / e.duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    state.army = Math.max(0, Math.round(e.startArmy - e.losses * eased));
    e.obj.count = Math.max(0, Math.round(e.startEnemy - e.opponentLosses * eased));
    if (Math.random() < dt * (e.boss ? 35 : 21)) {
      particlesAt(e.obj.x * .6, 4, Math.random() < .48 ? '#fa516c' : '#54c8ff', e.boss ? 8 : 4, .65);
      state.shake = Math.max(state.shake, e.boss ? 3.2 : 1.8);
      if (Math.random() < .24) sound(110 + Math.random() * 80,.07,'triangle',70,.025);
    }
    if (progress < 1) return;
    const obj=e.obj,boss=e.boss;
    state.encounter=null; obj.used=true;
    el.battleBanner.classList.remove('visible');
    particlesAt(obj.x, 2, boss?'#ffd976':'#ff5b71', boss?48:22, 1.12);
    floatText('-'+e.losses,obj.x,2,'#ffe8ad');
    if (state.army <= 0) { takeLife(boss?'BOSS ZU STARK!':'ARMEE BESIEGT!'); return; }
    addCoins(boss ? 48 + state.level*16 : e.elite ? 20+state.level*4 : 7+Math.floor(e.startEnemy/8));
    state.score += e.startEnemy*10;
    if (boss) showResult(true);
    else { state.combo=0; announce(e.elite?'ELITE BESIEGT!':'GEGNER BESIEGT!','good',.95); sound(660,.15,'triangle',1040,.07); }
  }
  function buildLevel(level) {
    const rng = random(level * 19937 + 413);
    const items=[];
    const gatePositions=[65,190,313,437,566];
    gatePositions.forEach((z, group) => {
      const add=16 + Math.round((group*9+level*3) * (.75+rng()*.5));
      const multiplication=(group===1 && level>=4) || (group===4 && level%3===0) ? 3 : 2;
      const options=[
        {label:'+'+add,kind:'add',value:add},
        {label:'×'+multiplication,kind:'mul',value:multiplication}
      ];
      // Occasional dramatic choice: a bonus multiplier on one side, a danger gate on the other.
      if (level>=3 && group===3 && level%2===1) {
        options[0]={label:'−'+Math.round(10+level*2),kind:'sub',value:Math.round(10+level*2)};
        options[1]={label:'×3',kind:'mul',value:3};
      }
      if (level>=5 && group===4 && level%4===1) options[1]={label:'×4',kind:'mul',value:4};
      if (rng()>.5) options.reverse();
      options.forEach((item,index)=>items.push({type:'gate',group,z,x:index===0?-.57:.57,...item,used:false}));
    });
    const enemies=[128,255,378,500,629];
    enemies.forEach((z,index)=>{
      const elite=level>=3 && (index===2 || (index===4 && level%2===0));
      const count=Math.round((([12,19,27,38,49][index]) + (level-1)*(4+index*2))*(.90+rng()*.18));
      items.push({type:elite?'elite':'enemy',z,x:[-.57,.56,-.54,.54,0][index],count,used:false,seed:rng()*300});
    });
    [154,283,410,539].forEach((z,index)=>items.push({
      type:'barrel',z,x:[.58,-.54,.56,-.54][index],
      damage:Math.round([12,17,21,28][index]*(1+(level-1)*.18)),used:false
    }));
    if (level>=2) {
      items.push({type:'spikes',z:349,x:level%2?-.53:.51,damage:12+level*4,used:false});
      if(level>=4) items.push({type:'spikes',z:605,x:level%2?.55:-.53,damage:18+level*5,used:false});
    }
    // Additional collection decisions between hazards and gates; no external service needed.
    [99,225,350,477,603].forEach((z,index)=> {
      const pos=(index+level)%3===0?0:((index+level)%2?-.56:.56);
      items.push({type:'coin',z,x:pos,value:9+level*2+index*2,used:false});
    });
    items.push({type:'shield',z:332,x:level%2?.55:-.55,used:false});
    items.push({type:'heart',z:684,x:level%2?-.54:.54,used:false});
    items.push({type:'boss',z:736,x:0,count:72+(level-1)*34,used:false,seed:0});
    return items;
  }
  function prepareLevel(level, army = startArmy()) {
    state.level = level; state.distance = 0; state.army = clamp(army, 10, MAX_ARMY); state.theme=themeFor(level);
    state.shield=0; state.fever=0; state.feverActive=0; state.hurt=false; state.collected=0; state.gatesHit=0; state.elapsed=0;
    state.playerX = 0; state.targetX = 0; state.shake = 0; state.encounter = null; state.combo = 0; state.earned = 0;
    el.battleBanner.classList.remove('visible');
    state.objects = buildLevel(level); state.particles = []; state.floaters = [];
    state.invulnerable = 1.4; state.moved = false;
    el.tip.classList.remove('hide'); updateHud();
  }
  function startGame(level = state.best) {
    state.lives = 5; state.score = 0; state.time = 0; prepareLevel(level);
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
    if (win) { addCoins(55 + state.level * 20 + Math.min(60, Math.floor(state.army / 4))); if(!state.hurt && state.gatesHit>=4) addCoins(35+state.level*5); state.victories++; }
    el.resultCoins.textContent = '+' + state.earned.toLocaleString('de-DE');
    el.resultLevel.textContent = String(state.level).padStart(2, '0');
    el.resultArmy.textContent = String(state.army);
    el.resultBtn.innerHTML = win ? 'NÄCHSTER LEVEL <span>▶</span>' : 'NOCH MAL SPIELEN <span>▶</span>';
    state.medal = win ? (!state.hurt && state.gatesHit >= 4 ? 'GOLD' : state.gatesHit >= 3 ? 'SILBER' : 'BRONZE') : '';
    if (el.resultMedal) el.resultMedal.textContent = win ? (state.medal==='GOLD'?'★ GOLD-MEDAILLE':state.medal==='SILBER'?'◆ SILBER-MEDAILLE':'● BRONZE-MEDAILLE') : 'VERSUCH ES ERNEUT';
    if (el.resultPerfect) el.resultPerfect.textContent = win ? `${state.gatesHit}/5 TORE · ${state.collected} BONUSOBJEKTE` : 'VERBESSERE DEINE STRATEGIE';
    if (win) { state.best = Math.max(state.best, state.level + 1); storage.write('battle-rush-best', state.best); saveProgress(); confetti(); sound(700, .2, 'sine', 1100, .1); }
    else sound(190, .35, 'sawtooth', 60, .12);
    updateHud(); setScreen(el.result, true);
  }
  function takeLife(message) {
    state.lives = Math.max(0, state.lives - 1); state.shake = 13; state.hurt=true; haptic(90);
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
    state.army = clamp(obj.kind === 'mul' ? state.army * obj.value : obj.kind === 'sub' ? state.army - obj.value : state.army + obj.value, 1, MAX_ARMY);
    const gained = state.army - previous;
    state.gatesHit++; state.combo++; if (state.combo >= 2) addCoins(3 * state.combo);
    state.fever=clamp(state.fever+24,0,100);
    if(state.fever>=100){state.feverActive=10;state.fever=0;announce('FEUER-MODUS! STARKE TRUPPEN','good',1.5);particlesAt(obj.x,2,'#ffda59',48,1.4);}
    particlesAt(obj.x, 2, '#52e4ff', 29, 1.25);
    floatText((gained>=0?'+':'') + gained, obj.x, 1, gained>=0?'#a9fbff':'#ffc0be'); announce(obj.label + '  ·  ' + (gained>=0?'+':'') + gained + ' SOLDATEN', gained>=0?'good':'bad');
    sound(650, .15, 'sine', 1080, .075); haptic(20); state.score += gained;
  }
  function enemyFight(obj) { beginEncounter(obj); }
  function hitBarrel(obj) {
    state.combo = 0;
    if(state.shield>0){state.shield--;particlesAt(obj.x,1,'#8cf3ff',40,1.5);floatText('BLOCK!',obj.x,1,'#bcfaff');announce('SCHILD HAT GESCHÜTZT!','good');sound(560,.28,'triangle',920,.09);return;}
    state.hurt=true; state.army = Math.max(0, state.army - obj.damage);
    particlesAt(obj.x, 1, '#ffc15d', 32, 1.5);
    floatText('-' + obj.damage, obj.x, 0, '#ffd6a1');
    state.shake = 11; sound(105, .24, 'sawtooth', 50, .12); haptic(45);
    if (state.army <= 0) takeLife(obj.type==='spikes'?'STACHELN GETROFFEN!':'FASS EXPLODIERT!');
    else announce('−' + obj.damage + ' SOLDATEN', 'bad');
  }
  function bossFight(obj) { beginEncounter(obj); }
  function pickUp(obj){
    const values={coin:'#ffdc6c',shield:'#74eaff',heart:'#ff789e'};
    particlesAt(obj.x,0,values[obj.type],24,.8);
    state.collected++;
    if(obj.type==='coin') {addCoins(obj.value);floatText('+'+obj.value+' MÜNZEN',obj.x,1,'#fff1a1');sound(820,.12,'sine',1260,.065);}
    else if(obj.type==='shield'){state.shield=Math.min(2,state.shield+1);announce('SCHUTZSCHILD GESAMMELT','good');sound(480,.23,'triangle',940,.072);}
    else {if(state.lives<5){state.lives++;announce('+1 LEBEN','good');}else{addCoins(18+state.level*3);announce('BONUS-MÜNZEN!','good');}sound(700,.23,'sine',1050,.072);}
  }
  function handleCollisions(){
    if(state.encounter) return;
    for(const obj of state.objects){
      if(obj.used || obj.z-state.distance>2.5 || obj.z-state.distance < -7) continue;
      if(!(['enemy','elite','boss'].includes(obj.type) && (obj.type==='boss'||Math.abs(state.playerX-obj.x)<.49))) obj.used=true;
      if(obj.type==='gate'){
        const siblings=state.objects.filter(other=>other.type==='gate'&&other.group===obj.group);
        for(const sibling of siblings) sibling.used=true;
        const selected=siblings.find(gate=>Math.abs(gate.x-state.playerX)<.49);
        if(selected)applyGate(selected);
        else {state.combo=0;toast('Tor verpasst! In die linke oder rechte Spur lenken.');}
      }else if(obj.type==='enemy'||obj.type==='elite'){
        if(Math.abs(state.playerX-obj.x)<.49){beginEncounter(obj);break;}
      }else if(obj.type==='barrel'||obj.type==='spikes'){
        if(Math.abs(state.playerX-obj.x)<.31){hitBarrel(obj);if(state.mode!=='playing')break;}
      }else if(obj.type==='coin'||obj.type==='shield'||obj.type==='heart'){
        if(Math.abs(state.playerX-obj.x)<.37)pickUp(obj);
      }else if(obj.type==='boss'){beginEncounter(obj);break;}
    }
  }
  function update(dt) {
    state.time += dt;
    if(state.mode==='playing'){state.elapsed+=dt;state.feverActive=Math.max(0,state.feverActive-dt);}
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
  function drawBackground(){
    const t=palette(), sky=ctx.createLinearGradient(0,0,0,height);
    sky.addColorStop(0,t.sky[0]);sky.addColorStop(.43,t.sky[1]);sky.addColorStop(1,t.sky[2]);
    ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    const sunX=width*(state.theme==='dusk'?.25:.72),sunY=height*.19;
    const sun=ctx.createRadialGradient(sunX,sunY,8,sunX,sunY,width*.78);
    sun.addColorStop(0,'#ffffe0af');sun.addColorStop(.17,'#fff4d15a');sun.addColorStop(1,'#ffffff00');
    ctx.fillStyle=sun;ctx.fillRect(0,0,width,height);
    // Subtle drifting clouds and layered mountain silhouettes follow level themes.
    ctx.fillStyle='#ffffff27';
    for(let i=0;i<5;i++){
      const cx=(width*((i*.29+.17+state.time*.0015)%1.5)) - width*.2;
      const cy=height*(.16+i*.026);
      ctx.beginPath();ctx.ellipse(cx,cy,34+(i%2)*13,8+(i%2)*2,0,0,TAU);ctx.fill();
    }
    ctx.fillStyle=t.hill;ctx.beginPath();ctx.moveTo(0,height*.27);
    for(let x=0;x<=width+35;x+=22)ctx.lineTo(x,height*(.265+.026*Math.sin(x*.012+state.level)+.011*Math.sin(x*.047)));
    ctx.lineTo(width,height*.48);ctx.lineTo(0,height*.48);ctx.fill();
    ctx.fillStyle=t.hill2;ctx.beginPath();ctx.moveTo(0,height*.34);
    for(let x=0;x<=width+25;x+=17)ctx.lineTo(x,height*(.325+.018*Math.sin(x*.021+1.3*state.level)));
    ctx.lineTo(width,height*.55);ctx.lineTo(0,height*.55);ctx.fill();
    // A simplified distant fortress gives the road a destination.
    const fy=height*.26,fw=Math.max(50,width*.19),fx=width*.5-fw*.5;
    ctx.fillStyle='#506d7750';ctx.fillRect(fx,fy-fw*.13,fw,fw*.43);
    for(let i=0;i<5;i++)ctx.fillRect(fx+i*fw*.23,fy-fw*.28,fw*.14,fw*.23);
    ctx.fillRect(fx+fw*.35,fy-fw*.48,fw*.3,fw*.58);
    ctx.fillStyle='#e9f8fa44';ctx.fillRect(fx+fw*.46,fy-fw*.41,fw*.035,fw*.18);
  }
  function drawRoad() {
    const far = project(0, 270), near = project(0, -12);
    const leftFar = project(-1.08, 270), rightFar = project(1.08, 270);
    const leftNear = project(-1.08, -12), rightNear = project(1.08, -12);
    const ground = ctx.createLinearGradient(0, far.y, 0, height);
    ground.addColorStop(0, palette().road[0]); ground.addColorStop(1, palette().road[1]);
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
        roundedRect(x, y, size, blockHeight, size * .13, palette().rail[0]);
        ctx.fillStyle = palette().rail[1]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size * .27, y - size * .25);
        ctx.lineTo(x + size * 1.17, y - size * .25); ctx.lineTo(x + size, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = palette().rail[2]; ctx.fillRect(x + size - 2 * p.p, y + 2, 2 * p.p, blockHeight - 2);
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
          ctx.fillStyle = k===1 ? palette().tree[1] : palette().tree[0];
          ctx.beginPath(); ctx.arc(p.x + (k - 1) * size * .42, p.y - size * (1.9 + (k % 2) * .35), size * (.65 - k * .08), 0, TAU); ctx.fill();
        }
      }
    }
  }
  // Soldier animation frames are rasterized once; one image draw replaces dozens of vector calls.
  const soldierSprites={blue:[],red:[],elite:[]};
  function createSoldierSprite(team,frame){
    const image=document.createElement('canvas'); image.width=72;image.height=114;
    const g=image.getContext('2d');g.scale(3,3);
    const x=12,y=36;
    const red=team!=='blue';
    const main=red?'#ed4256':'#168eea', dark=red?'#792239':'#114b94';
    const light=red?'#ff9292':'#7bd9ff',steel=team==='elite'?'#ffe19f':'#d7e6ed';
    const stride=Math.sin(frame*Math.PI*.5)*2.2;
    g.fillStyle='#1b2f4560';g.beginPath();g.ellipse(x+1,y+1,7,2.5,0,0,TAU);g.fill();
    g.strokeStyle=dark;g.lineWidth=2.2;g.lineCap='round';
    g.beginPath();g.moveTo(x-2.6,y-8);g.lineTo(x-3.6-stride*.4,y-.9);g.moveTo(x+2.6,y-8);g.lineTo(x+3.7+stride*.4,y-.9);g.stroke();
    g.fillStyle=dark;g.beginPath();g.roundRect(x-5,y-18,10,13,3);g.fill();
    const body=g.createLinearGradient(x-5,y,x+5,y);
    body.addColorStop(0,dark);body.addColorStop(.25,main);body.addColorStop(.53,light);body.addColorStop(.7,main);body.addColorStop(1,dark);
    g.fillStyle=body;g.beginPath();g.roundRect(x-4.7,y-17,9.4,11,2);g.fill();
    g.fillStyle='#ffffff60';g.fillRect(x-3.0,y-16.5,1.4,7);
    g.strokeStyle=dark;g.lineWidth=2.4;g.beginPath();g.moveTo(x-4.6,y-15);g.lineTo(x-7.3,y-9+stride*.24);g.moveTo(x+4.6,y-15);g.lineTo(x+6.6,y-9-stride*.24);g.stroke();
    // Round shoulder pauldron and polished diamond shield for a toy soldier silhouette.
    g.fillStyle=light;g.beginPath();g.ellipse(x-5.1,y-15.8,2.3,2.8,-.28,0,TAU);g.fill();
    g.fillStyle=steel;g.beginPath();g.moveTo(x-7.5,y-14);g.lineTo(x-2.8,y-12.4);g.lineTo(x-3.4,y-5.7);g.lineTo(x-6,y-3);g.lineTo(x-8,y-6);g.closePath();g.fill();
    g.strokeStyle=dark;g.lineWidth=.75;g.stroke();
    g.fillStyle=main;g.beginPath();g.moveTo(x-6.1,y-12);g.lineTo(x-4.2,y-8.6);g.lineTo(x-6.1,y-6);g.lineTo(x-7,y-9);g.fill();
    // Metallic spear point remains visible even at tiny projected sizes.
    g.strokeStyle='#5b4637';g.lineWidth=1.4;g.beginPath();g.moveTo(x+7.1,y-5);g.lineTo(x+7.7,y-27);g.stroke();
    g.fillStyle=steel;g.beginPath();g.moveTo(x+7.7,y-33);g.lineTo(x+5.5,y-27);g.lineTo(x+9.6,y-27);g.closePath();g.fill();
    g.fillStyle='#efb894';g.beginPath();g.ellipse(x,y-19.5,3.25,3.6,0,0,TAU);g.fill();
    const helm=g.createLinearGradient(x-4,y,x+4,y);
    helm.addColorStop(0,dark);helm.addColorStop(.35,light);helm.addColorStop(.63,main);helm.addColorStop(1,dark);
    g.fillStyle=helm;g.beginPath();g.ellipse(x,y-22,4.7,4,0,Math.PI,TAU);g.fill();
    g.fillStyle=dark;g.beginPath();g.roundRect(x-4.7,y-22,9.4,2,1);g.fill();
    if(team==='elite'){
      g.fillStyle='#ffe69a';g.beginPath();g.moveTo(x-1,y-26);g.lineTo(x,y-32);g.lineTo(x+2,y-27);g.closePath();g.fill();
      g.strokeStyle='#fce6a2';g.lineWidth=.9;g.strokeRect(x-3,y-16,6,7);
    }
    return image;
  }
  for(const team of Object.keys(soldierSprites))for(let frame=0;frame<4;frame++)soldierSprites[team].push(createSoldierSprite(team,frame));
  function drawSoldier(x,y,scale,color,tick,row){
    if(scale<.15)return;
    const phase=(Math.floor(tick*10+row*.68+x*.012)%4+4)%4;
    const sprite=soldierSprites[color]?.[phase] || soldierSprites.blue[phase];
    const bob=Math.sin(tick*13+row*.7)*.65*scale;
    ctx.drawImage(sprite,x-12*scale,y-37*scale+bob,24*scale,38*scale);
  }
  function drawCrowd(x, z, count, color, boss = false) {
    if (count <= 0) return;
    const n = Math.min(count, boss ? 92 : 98);
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
    ctx.lineWidth = Math.max(2.5, 3.7 * center.p); ctx.strokeStyle = color !== 'blue' ? '#651326' : '#064776';
    ctx.strokeText(String(count), center.x, labelY);
    ctx.fillStyle = color !== 'blue' ? '#ffb2b9' : '#d4faff'; ctx.fillText(String(count), center.x, labelY);
  }
  function drawGate(obj, z) {
    const p = project(obj.x, z);
    const w = width * .31 * p.p + 8 * p.p, h = (68 * p.p + 2);
    const y = p.y - h;
    if (p.p < .19) return;
    ctx.fillStyle = '#06335c45'; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * .64, 8 * p.p, 0, 0, TAU); ctx.fill();
    const grad = ctx.createLinearGradient(0, y, 0, p.y);
    grad.addColorStop(0, obj.kind === 'sub' ? '#ff8c96ef' : obj.kind === 'mul' ? '#88f7bfee' : '#73e0ffed');
    grad.addColorStop(1, obj.kind === 'sub' ? '#c73549d9' : obj.kind === 'mul' ? '#119c7bbd' : '#097db5c9');
    ctx.shadowColor = obj.kind === 'sub' ? '#ff6370' : obj.kind === 'mul' ? '#37f4ad' : '#21c9ff'; ctx.shadowBlur = 17 * p.p;
    roundedRect(p.x - w / 2, y, w, h, 4 * p.p, grad); ctx.shadowBlur=0;
    ctx.fillStyle='#ffffff2a'; roundedRect(p.x-w/2+5*p.p,y+4*p.p,w-10*p.p,5*p.p,1*p.p);
    ctx.lineWidth = Math.max(1.5, p.p * 4);
    ctx.strokeStyle = obj.kind === 'sub' ? '#ffebea' : obj.kind === 'mul' ? '#bbffdd' : '#b2f6ff';
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
  function drawPickup(obj,z){
    const p=project(obj.x,z),s=Math.max(.25,p.p)*Math.min(1.3,width/390);
    if(s<.25)return;
    const float=Math.sin(state.time*4+obj.z*.1)*3.7*s;
    const cy=p.y-30*s+float;
    ctx.fillStyle='#233a4244';ctx.beginPath();ctx.ellipse(p.x,p.y,22*s,5*s,0,0,TAU);ctx.fill();
    const aura=ctx.createRadialGradient(p.x,cy,2,p.x,cy,35*s);
    const glow=obj.type==='coin'?'255,212,84':obj.type==='shield'?'66,222,252':'255,103,153';
    aura.addColorStop(0,`rgba(${glow},.35)`);aura.addColorStop(1,`rgba(${glow},0)`);
    ctx.fillStyle=aura;ctx.beginPath();ctx.ellipse(p.x,cy,37*s,37*s,0,0,TAU);ctx.fill();
    if(obj.type==='coin'){
      const spin=.50+.5*Math.abs(Math.cos(state.time*3+obj.z));
      const w=18*s*spin;
      const gold=ctx.createLinearGradient(p.x-w,cy-20*s,p.x+w,cy+20*s);
      gold.addColorStop(0,'#fff9bc');gold.addColorStop(.48,'#ffca39');gold.addColorStop(1,'#be7522');
      ctx.fillStyle=gold;ctx.beginPath();ctx.ellipse(p.x,cy,w,19*s,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#fff6be';ctx.lineWidth=2.5*s;ctx.stroke();
      if(spin>.44){ctx.fillStyle='#986325';ctx.font=`1000 ${21*s}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('★',p.x,cy);}
    }else if(obj.type==='shield'){
      ctx.fillStyle='#71edff';ctx.beginPath();ctx.moveTo(p.x,cy-25*s);ctx.lineTo(p.x+20*s,cy-13*s);ctx.lineTo(p.x+15*s,cy+13*s);ctx.lineTo(p.x,cy+24*s);ctx.lineTo(p.x-15*s,cy+13*s);ctx.lineTo(p.x-20*s,cy-13*s);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#f0ffff';ctx.lineWidth=3*s;ctx.stroke();
      ctx.fillStyle='#0d7dbe';ctx.font=`1000 ${22*s}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('◆',p.x,cy);
    }else{
      ctx.font=`1000 ${42*s}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3*s;ctx.strokeStyle='#fff0f5';ctx.strokeText('♥',p.x,cy);ctx.fillStyle='#ff4973';ctx.fillText('♥',p.x,cy);
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
      else if (obj.type === 'enemy' || obj.type === 'elite') drawCrowd(obj.x, z, obj.count, obj.type==='elite'?'elite':'red');
      else if (obj.type === 'barrel') drawBarrel(obj, z);
      else if (obj.type === 'spikes') drawSpikes(obj, z);
      else if (['coin','shield','heart'].includes(obj.type)) drawPickup(obj,z);
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
    drawCrowd(state.playerX, state.encounter?-1.7:-1, state.army, 'blue');
    if(state.shield>0){ctx.strokeStyle='#a5f8ffb6';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y-6,54,31,0,0,TAU);ctx.stroke();}
    if(state.feverActive>0){ctx.strokeStyle='#ffd76a99';ctx.lineWidth=2.8;ctx.beginPath();ctx.ellipse(p.x,p.y-7,62+Math.sin(state.time*9)*2,35,0,0,TAU);ctx.stroke();}
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
    if(dt>0 && dt<.05) state.fpsAvg=state.fpsAvg*.93+(1/dt)*.07;
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
  $('startBtn').addEventListener('click', () => startGame(state.best));
  el.menuReplay.addEventListener('click', () => startGame(1));
  el.upgradeSoldiers.addEventListener('click', () => purchase('soldiers'));
  el.upgradeArmor.addEventListener('click', () => purchase('armor'));
  el.upgradeLuck.addEventListener('click', () => purchase('luck'));
  $('pauseBtn').addEventListener('click', pause);
  $('resumeBtn').addEventListener('click', resume);
  $('restartBtn').addEventListener('click', () => startGame(state.level));
  $('resultBtn').addEventListener('click', () => {
    if (!state.resultWin) { startGame(state.level); return; }
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
  window.addEventListener('pagehide', () => {if(state.mode==='playing')pause();});
  resize(); updateHud(); requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // Expose read-only state to browser smoke tests without altering the gameplay.
  Object.defineProperty(window, '__battleDiagnostics', {get: () => ({mode: state.mode, level: state.level, army: state.army, lives: state.lives, distance: state.distance, playerX: state.playerX, objectCount: state.objects.length, coins: state.coins, upgrades:{...upgrades}, encounter: !!state.encounter, fpsTarget: 60, fps:Math.round(state.fpsAvg),shield:state.shield,fever:Math.round(state.fever),theme:state.theme,objects:state.objects.map(({type,z,x,used,count})=>({type,z,x,used,count}))})});
})();