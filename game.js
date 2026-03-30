/* ============================================================
   CHROMATIC — game.js
   Premium color memory experience
============================================================ */

'use strict';

// ─────────────────────────────────────────────
// CONSTANTS & CONFIG
// ─────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { viewMs: 4000, hints: 1,    snapThreshold: 8 },
  medium: { viewMs: 2000, hints: 1,    snapThreshold: 5 },
  hard:   { viewMs: 1000, hints: 0,    snapThreshold: 3 },
};

const CIRCUMFERENCE = 2 * Math.PI * 44; // ring-fill r=44

const PHILOSOPHIES_RESULT = [
  '“Memory is deceptive because it is colored by today’s events.” - Albert Einstein',
  '“Nothing is ever really lost to us as long as we remember it.” - L. M. Montgomery',
  '“What we see depends mainly on what we look for.” - John Lubbock',
  '“Exactitude is not truth.” - Henri Matisse',
  '“Every act of perception is to some degree an act of creation.” - Oliver Sacks',
  '“We see with our brains, not just our eyes.” - Oliver Sacks',
  '“The act of seeing is inseparable from interpretation.” - Ernst Gombrich',
  '“The eye should learn to listen before it looks.” - Robert Frank',
  '“The brain constructs the world we think we see.” - David Eagleman',
  '“The eye is part of the mind.” - William Blake'

];

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let state = {
  mode:       'free',       // 'free' | 'daily'
  difficulty: 'null',
  targetHSB:  { h: 0, s: 0, b: 0 },
  userHSB:    { h: 180, s: 50, b: 50 },
  hintsLeft:  1,
  timerAnim:  null,
};

// ─────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const screens = {
  intro:       $('screen-intro'),
  difficulty:  $('screen-difficulty'),
  memorize:    $('screen-memorize'),
  recreate:    $('screen-recreate'),
  result:      $('screen-result'),
};

// ─────────────────────────────────────────────
// CUSTOM CURSOR
// ─────────────────────────────────────────────
const cursor      = $('cursor');
const cursorTrail = $('cursorTrail');
let mouseX = 0, mouseY = 0;
let trailX = 0, trailY = 0;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.08, ease: 'none' });
});

function animTrail() {
  trailX += (mouseX - trailX) * 0.14;
  trailY += (mouseY - trailY) * 0.14;
  gsap.set(cursorTrail, { x: trailX, y: trailY });
  requestAnimationFrame(animTrail);
}
animTrail();

// Scale cursor on clickables
document.querySelectorAll('button, .mode-card, .diff-card').forEach(el => {
  el.addEventListener('mouseenter', () => gsap.to(cursor, { scale: 2.5, duration: 0.25, ease: 'power2.out' }));
  el.addEventListener('mouseleave', () => gsap.to(cursor, { scale: 1, duration: 0.2, ease: 'power2.out' }));
});

// ─────────────────────────────────────────────
// SCREEN TRANSITIONS
// ─────────────────────────────────────────────
function showScreen(name, fromName) {
  const from = fromName ? screens[fromName] : document.querySelector('.screen.active');
  const to   = screens[name];

  // 👇 CONTROL CURSOR
  const hideCursorScreens = ['memorize', 'recreate'];

  if (hideCursorScreens.includes(name)) {
    document.body.classList.add('hide-cursor');
  } else {
    document.body.classList.remove('hide-cursor');
  }

  if (from && from !== to) {
    gsap.to(from, {
      opacity: 0,
      y: -12,
      duration: 0.45,
      ease: 'power2.in',
      onComplete: () => {
        from.classList.remove('active');
        gsap.set(from, { y: 0 });
      }
    });
  }

  gsap.set(to, { y: 18, opacity: 0 });
  to.classList.add('active');
  gsap.to(to, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    delay: 0.15,
    ease: 'power3.out',
  });
}

// ─────────────────────────────────────────────
// LOCALSTORAGE — STREAK
// ─────────────────────────────────────────────
function getStreak() {
  return {
    current:  parseInt(localStorage.getItem('chroma_streak') || '0', 10),
    best:     parseInt(localStorage.getItem('chroma_best')   || '0', 10),
    lastDate: localStorage.getItem('chroma_lastDate') || '',
  };
}

function saveStreak(streak) {
  localStorage.setItem('chroma_streak',   streak.current);
  localStorage.setItem('chroma_best',     streak.best);
  localStorage.setItem('chroma_lastDate', streak.lastDate);
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function hasPlayedToday() {
  return localStorage.getItem('chroma_lastDate') === getTodayKey();
}

function updateStreakAfterScore(score) {
  const sk = getStreak();
  const today = getTodayKey();
  sk.lastDate = today;
  if (score >= 85) {
    sk.current += 1;
    if (sk.current > sk.best) sk.best = sk.current;
  } else {
    sk.current = 0;
  }
  saveStreak(sk);
  return sk;
}

function renderStreakUI() {
  const sk = getStreak();
  $('streakCurrent').textContent = sk.current;
  $('streakBest').textContent    = sk.best;
}

// ─────────────────────────────────────────────
// DAILY COLOR — deterministic from date
// ─────────────────────────────────────────────
function getDailyColor() {
  const d = new Date();
  // Simple seeded pseudo-random based on date parts
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const r1 = seededRand(seed);
  const r2 = seededRand(seed + 1);
  const r3 = seededRand(seed + 2);
  return {
    h: Math.floor(r1 * 360),
    s: Math.floor(40 + r2 * 55),  // 40–95 — avoid very desaturated
    b: Math.floor(40 + r3 * 50),  // 40–90
  };
}

function seededRand(seed) {
  // mulberry32
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomColor() {
  return {
    h: Math.floor(Math.random() * 360),
    s: Math.floor(40 + Math.random() * 55),
    b: Math.floor(40 + Math.random() * 50),
  };
}

// ─────────────────────────────────────────────
// COLOR UTILITIES
// ─────────────────────────────────────────────
function hsbToCSS(h, s, b) {
  // HSB → CSS: use hsl conversion
  // b is brightness (0-100), s is saturation (0-100)
  const l = b * (1 - s / 200);   // lightness approximation
  const sl = s * b / (100 - Math.abs(2 * l - 100) + 0.001);
  return `hsl(${h}, ${Math.min(100, sl).toFixed(1)}%, ${l.toFixed(1)}%)`;
}

// Pure HSB-space distance for scoring
function scoreHSB(user, target) {
  const dh = Math.min(Math.abs(user.h - target.h), 360 - Math.abs(user.h - target.h)) / 180;
  const ds = Math.abs(user.s - target.s) / 100;
  const db = Math.abs(user.b - target.b) / 100;
  // Weighted: hue most important, then sat, then bri
  const dist = dh * 0.6 + ds * 0.25 + db * 0.15;

  // dificultad afecta la exigencia
  const exponent =
    state.difficulty === 'easy'   ? 1.4 :
    state.difficulty === 'medium' ? 1.8 :
                                   2.2;
                                   
  return Math.max(0, Math.round(Math.pow(1 - dist, 1.8) * 100));


}

function scoreLabel(pct) {
  if (pct >= 95) return ['Perfect', 'score-perfect'];
  if (pct >= 85) return ['Accurate', 'score-accurate'];
  if (pct >= 70) return ['Close', 'score-close'];
  return ['Off', 'score-off'];
}

// ─────────────────────────────────────────────
// SLIDER SYSTEM
// ─────────────────────────────────────────────
const sliderDefs = [
  { id: 'trackHue', thumbId: 'thumbHue', valId: 'valHue', key: 'h', min: 0, max: 360 },
  { id: 'trackSat', thumbId: 'thumbSat', valId: 'valSat', key: 's', min: 0, max: 100 },
  { id: 'trackBri', thumbId: 'thumbBri', valId: 'valBri', key: 'b', min: 0, max: 100 },
];

function initSliders() {
  sliderDefs.forEach(def => {
    const track = $(def.id);
    const thumb = $(def.thumbId);
    let dragging = false;

    function setFromEvent(e) {
      const rect  = track.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const raw   = (clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, raw));
      const val = Math.round(def.min + clamped * (def.max - def.min));
      setValue(def, val);
    }

    function onDown(e) {
      dragging = true;
      thumb.classList.add('dragging');
      setFromEvent(e);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      setFromEvent(e);
      e.preventDefault();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      thumb.classList.remove('dragging');
    }

    track.addEventListener('mousedown',   onDown);
    track.addEventListener('touchstart',  onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchend',  onUp);
  });
}

function setValue(def, val) {
  const key = def.key;
  state.userHSB[key] = val;
  const track = $(def.id);
  const thumb = $(def.thumbId);
  const valEl = $(def.valId);
  const pct = (val - def.min) / (def.max - def.min);

  // Position thumb
  gsap.set(thumb, { left: `${pct * 100}%` });
  valEl.textContent = val;

  // Snap detection
  const targetVal = key === 'h' ? state.targetHSB.h
                   : key === 's' ? state.targetHSB.s
                   : state.targetHSB.b;
  const threshold = DIFFICULTY[state.difficulty].snapThreshold;
  const isClose = Math.abs(val - targetVal) <= threshold
    || (key === 'h' && Math.min(Math.abs(val - targetVal), 360 - Math.abs(val - targetVal)) <= threshold);

  if (isClose) {
    thumb.classList.add('snapping');
    valEl.classList.add('snap');
  } else {
    thumb.classList.remove('snapping');
    valEl.classList.remove('snap');
  }

  updateSatBriTracks();
  updatePreview();
}

function updateSatBriTracks() {
  const h = state.userHSB.h;
  const satTrack = $('trackSat');
  satTrack.style.background = `linear-gradient(to right, hsl(${h}, 0%, 60%), hsl(${h}, 100%, 50%))`;

  const b = state.userHSB.b;
  const briTrack = $('trackBri');
  briTrack.style.background = `linear-gradient(to right, #000, hsl(${h}, 80%, ${b}%))`;
}

function updatePreview() {
  const { h, s, b } = state.userHSB;
  $('recreatePreview').style.background = hsbToCSS(h, s, b);
}

function setSliderPositions(hsb) {
  sliderDefs.forEach(def => {
    const val = def.key === 'h' ? hsb.h : def.key === 's' ? hsb.s : hsb.b;
    const pct = (val - def.min) / (def.max - def.min);
    gsap.set($(def.thumbId), { left: `${pct * 100}%` });
    $(def.valId).textContent = val;
  });
  state.userHSB = { ...hsb };
  updateSatBriTracks();
  updatePreview();
}

// ─────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────
function startGame() {
  document.body.classList.add('game-active');
  // Determine target color
  if (state.mode === 'daily') {
    state.targetHSB = getDailyColor();
  } else {
    state.targetHSB = randomColor();
  }

  // Reset user sliders to neutral mid-position
  setSliderPositions({ h: 180, s: 50, b: 50 });

  // Hints
  state.hintsLeft = DIFFICULTY[state.difficulty].hints;
  updateHintUI();

  showMemorize();
}

// ── MEMORIZE PHASE ──
function showMemorize() {
  showScreen('memorize');
  const { h, s, b } = state.targetHSB;
  const block = $('colorBlock');
  block.style.background = hsbToCSS(h, s, b);
  block.classList.add('pulse');

  gsap.set(block, { opacity: 0, scale: 0.88, filter: 'blur(8px)' });

  setTimeout(() => {
    // Animate in
    gsap.to(block, {
      opacity: 1, scale: 1, filter: 'blur(0px)',
      duration: 0.9, ease: 'power3.out'
    });

    // Timer ring
    const ringFill = $('ringFill');
    const viewMs = DIFFICULTY[state.difficulty].viewMs;
    ringFill.style.strokeDashoffset = 0;
    ringFill.style.transition = `stroke-dashoffset ${viewMs}ms linear`;
    setTimeout(() => {
      ringFill.style.strokeDashoffset = CIRCUMFERENCE;
    }, 50);

    // After view time, fade out
    setTimeout(() => {
      block.classList.remove('pulse');
      gsap.to(block, {
        opacity: 0,
        scale: 1.06,
        filter: 'blur(14px)',
        duration: 0.85,
        ease: 'power2.in',
        onComplete: () => showRecreate()
      });
    }, viewMs);

  }, 300);
}

// ── RECREATE PHASE ──
function showRecreate() {
  showScreen('recreate');
}

// ── HINT ──
function fireHint() {
  if (state.hintsLeft <= 0) return;
  state.hintsLeft--;
  updateHintUI();

  const { h, s, b } = state.targetHSB;
  const flash = $('hintFlash');
  flash.style.background = hsbToCSS(h, s, b);
  gsap.fromTo(flash, { opacity: 0 }, {
    opacity: 0.88, duration: 0.15, ease: 'power2.out',
    onComplete: () => {
      gsap.to(flash, { opacity: 0, duration: 0.45, delay: 0.35, ease: 'power2.in' });
    }
  });
}

function updateHintUI() {
  const btn = $('hintBtn');
  const cnt = $('hintCount');
  if (DIFFICULTY[state.difficulty].hints === 0) {
    btn.style.display = 'none';
    cnt.textContent = '';
    return;
  }
  btn.style.display = '';
  btn.disabled = state.hintsLeft <= 0;
  cnt.textContent = state.hintsLeft > 0
    ? `${state.hintsLeft} hint${state.hintsLeft > 1 ? 's' : ''} remaining`
    : 'hint already used';
}

// ── SUBMIT ──
function submitAnswer() {
  const score = scoreHSB(state.userHSB, state.targetHSB);
  showResult(score);
}

// ── RESULT ──
function showResult(score) {
  showScreen('result');

  const { h: uh, s: us, b: ub } = state.userHSB;
  const { h: th, s: ts, b: tb } = state.targetHSB;

  const swatchUser     = $('swatchUser');
  const swatchOriginal = $('swatchOriginal');

  // Start both swatches as user color, then animate original in
  swatchUser.style.background     = hsbToCSS(uh, us, ub);
  swatchOriginal.style.background = hsbToCSS(uh, us, ub);

  gsap.delayedCall(0.6, () => {
    gsap.to(swatchOriginal, {
      background: hsbToCSS(th, ts, tb),
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: function () {
        // GSAP can't tween CSS background directly → we tween a proxy
      }
    });
    // Proxy tween for swatch color animation
    const proxy = { t: 0 };
    gsap.to(proxy, {
      t: 1, duration: 1.2, ease: 'power2.inOut',
      onUpdate: () => {
        const interp = proxy.t;
        const hI = Math.round(lerpAngle(uh, th, interp));
        const sI = Math.round(lerp(us, ts, interp));
        const bI = Math.round(lerp(ub, tb, interp));
        swatchOriginal.style.background = hsbToCSS(hI, sI, bI);
      }
    });
  });

  // Score counter anim
  const scoreEl = $('resultScore');
  const counter = { val: 0 };
  gsap.to(counter, {
    val: score, duration: 1.1, delay: 0.3, ease: 'power2.out',
    onUpdate: () => { scoreEl.textContent = Math.round(counter.val) + '%'; }
  });

  // Label + color class
  const [label, cls] = scoreLabel(score);
  $('resultLabel').textContent = label;
  const resultInner = document.querySelector('.result-inner');
  resultInner.className = 'result-inner ' + cls;

  // Breakdown
  const dh = Math.min(Math.abs(uh - th), 360 - Math.abs(uh - th));
  $('bdH').textContent = `±${dh}°`;
  $('bdS').textContent = `±${Math.abs(us - ts)}%`;
  $('bdB').textContent = `±${Math.abs(ub - tb)}%`;

  // Philosophy
  const phil = PHILOSOPHIES_RESULT[Math.floor(Math.random() * PHILOSOPHIES_RESULT.length)];
  $('resultPhilosophy').textContent = phil;

  // Streak (daily only)
  let streakMsg = '';
  if (state.mode === 'daily') {
    const sk = updateStreakAfterScore(score);
    renderStreakUI();
    if (score >= 85) {
      streakMsg = `streak · ${sk.current} ${sk.current === 1 ? 'day' : 'days'}`;
    } else {
      streakMsg = 'streak reset — try again tomorrow';
    }
  }
  $('streakResult').textContent = streakMsg;

  // Actions
  const actWrap = $('resultActions');
  actWrap.innerHTML = '';

  if (state.mode === 'free') {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'cta-btn';
    retryBtn.textContent = 'Try again';
    retryBtn.addEventListener('click', startGame);
    actWrap.appendChild(retryBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'secondary-btn';
    menuBtn.textContent = 'Menu';
    menuBtn.addEventListener('click', () => {
      document.body.classList.remove('game-active');
      showScreen('intro');
    });
    actWrap.appendChild(menuBtn);
  } else {
    // Daily — share
    const shareBtn = document.createElement('button');
    shareBtn.className = 'cta-btn';
    shareBtn.textContent = 'Share result';
    shareBtn.addEventListener('click', () => shareResult(score));
    actWrap.appendChild(shareBtn);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'secondary-btn';
    menuBtn.textContent = 'Menu';
    menuBtn.addEventListener('click', () => {
      document.body.classList.remove('game-active');
      showScreen('intro');
    });
    actWrap.appendChild(menuBtn);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let diff = b - a;
  if (diff > 180)  diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

// ── SHARE ──
function shareResult(score) {
  const [label] = scoreLabel(score);
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const squares = score >= 95 ? '🟩🟩🟩' : score >= 85 ? '🟨🟩🟩' : score >= 70 ? '🟨🟨🟩' : '🟥🟨🟩';
  const text = `CHROMATIC · ${today}\n${squares}\n${score}% — ${label}\n\nA test of color memory`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('resultActions').querySelector('.cta-btn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1800);
    }
  });
}

// ─────────────────────────────────────────────
// INTRO SETUP
// ─────────────────────────────────────────────
function setupIntro() {
  // Daily badge
  const badge = $('dailyBadge');
  if (hasPlayedToday()) {
    badge.textContent = '✓ done';
  } else {
    badge.textContent = 'play now';
  }

  // Streak
  renderStreakUI();

  // Animate philosophy on load
  gsap.fromTo('#introPhilosophy .phil-line',
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 1.4, delay: 0.5, ease: 'power3.out' }
  );
}

// ─────────────────────────────────────────────
// EVENT BINDING
// ─────────────────────────────────────────────
function bindEvents() {
  // Intro → modes
  $('btn-free').addEventListener('click', () => {
    state.mode = 'free';

  // reset difficulty
  state.difficulty = null;

  // reset UI
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));

  const btn = $('startFreeGame');
  btn.disabled = true;
  btn.classList.remove('enabled');
  btn.classList.add('disabled');

  showScreen('difficulty');
  });

  $('btn-daily').addEventListener('click', () => {
    state.mode = 'daily';
    if (hasPlayedToday()) {
      // Show already-played message
      const badge = $('dailyBadge');
      badge.textContent = '✓ done';
      gsap.fromTo(badge, { scale: 1 }, { scale: 1.15, yoyo: true, repeat: 1, duration: 0.18 });
      return;
    }
    state.difficulty = 'medium';
    startGame();
  });

  // Back from difficulty
  $('backFromDiff').addEventListener('click', () => {
    document.body.classList.remove('game-active');
    showScreen('intro');
  });

  // Difficulty cards
  document.querySelectorAll('.diff-card').forEach(card => {
  card.addEventListener('click', () => {

    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    state.difficulty = card.dataset.diff;

    // 👇 activar botón
    const btn = $('startFreeGame');
    btn.disabled = false;
    btn.classList.remove('disabled');
    btn.classList.add('enabled');
  });
});

  // Start free game
  $('startFreeGame').addEventListener('click', startGame);

  // Hint
  $('hintBtn').addEventListener('click', fireHint);

  // Submit
  $('submitBtn').addEventListener('click', submitAnswer);
}

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
(function boot() {
  initSliders();
  bindEvents();
  setupIntro();

  // Stagger in intro elements
  gsap.fromTo(
    '#screen-intro .intro-inner > *',
    { opacity: 0, y: 22 },
    { opacity: 1, y: 0, stagger: 0.12, duration: 0.8, delay: 0.1, ease: 'power3.out' }
  );
})();
