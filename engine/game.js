/* The game: title screen, week planner, and each day's shift at the desk.
   Layout uses the scene's 320 x 180 grid; at() turns those numbers into stage pixels (x3). */

  /* ---------------------------------------------------------------- settings */

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  var SHIFT_START = parseTime(S['shift start']) || 9 * 60;
  var SHIFT_END = parseTime(S['shift end']) || 17 * 60;
  var SPEED = num(S.speed, 80);                 // game minutes per real minute
  var HEARTS = Math.max(1, Math.min(5, Math.round(num(S.hearts, 3))));
  var NOTE_PENALTY = num(S['note penalty'], 5); // minutes lost for a wrong sticky-note answer
  var PAY = { note: num(S['pay note'], 20), hint: num(S['pay hint'], 10), doc: num(S['pay document'], 50), fix: num(S['pay fix'], 10), over: num(S['fine'], 10) };
  var BOSS = S.boss || S.reviewer || 'Ms. Fewster, Managing Partner';
  var BOSS_SHORT = BOSS.split(',')[0];

  var DEFAULT_LINES = {
    start: 'Morning. Your inbox is full.//Coffee first. Then the inbox.//Clock in. The clients are waiting.',
    right: 'Good.//Correct.//That’s the job.//Fine work.',
    wrong: 'Check the rulebook.//Not quite.//Careful.',
    over: 'That word was fine.//Don’t fix what isn’t broken.//Leave correct words alone.',
    approvebad: 'That went out with errors.//The client will notice that.',
    returnclean: 'There was nothing wrong with it.//Why did this come back?',
    missed: 'You missed some.//Close, but not clean.',
    clean: 'Clean. Good.//Exactly right.',
    hurry: 'Thirty minutes left.//Clock’s ticking.',
    closing: 'It’s five. We’re closing.',
    fired: 'Clear your desk.',
    done: 'Inbox empty. Go home.//That’s everything. Good night.'
  };
  function line(key) {
    var src = S['line ' + key] || DEFAULT_LINES[key] || '';
    var opts = src.split('//').map(function (s) { return s.trim(); }).filter(Boolean);
    return opts[Math.floor(Math.random() * opts.length)] || '';
  }

  /* ---------------------------------------------------------------- days and progress */

  var DAYS = [];
  GAME.steps.forEach(function (s) {
    var d = DAYS.filter(function (x) { return x.num === s.num; })[0];
    if (!d) { d = { num: s.num, lessons: [], tests: [] }; DAYS.push(d); }
    (s.kind === 'lesson' ? d.lessons : d.tests).push(s);
  });
  DAYS.forEach(function (d, i) {
    d.index = i; d.no = d.num; // the file number is the day shown: 00 = Day 0 (tutorial), 01 = Day 1
    var named = d.lessons.concat(d.tests).filter(function (s) { return s.meta.level; })[0];
    d.name = named ? named.meta.level : '';
    d.items = [];
    d.tests.forEach(function (t) { d.items = d.items.concat(t.items); });
    d.intro = d.tests.map(function (t) { return t.intro; }).filter(Boolean).join('\n\n');
    d.meta = {};
    d.tests.forEach(function (t) { Object.keys(t.meta).forEach(function (k) { if (!(k in d.meta)) d.meta[k] = t.meta[k]; }); });
    d.pass = d.tests.map(function (t) { return t.pass; }).filter(function (p) { return p != null; })[0];
    if (d.pass == null) { var gp = parseFloat(S.pass); d.pass = isNaN(gp) ? 50 : gp; }
    d.shiftStart = parseTime(d.meta['shift start']) || SHIFT_START;
    d.shiftEnd = parseTime(d.meta['shift end']) || SHIFT_END;
  });
  function dayLabel(d) { return 'Day ' + d.no + (d.name ? ': ' + d.name : ''); }
  function countWork(d) { return d.items.filter(function (it) { return it.kind !== 'note'; }).length; }

  var STORE_KEY = 'grammar-guide-desk:' + slug(GAME_TITLE);
  var progress = { days: {}, unlockAll: false, muted: false };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') progress = { days: saved.days || {}, unlockAll: !!saved.unlockAll, muted: !!saved.muted };
  } catch (e) { /* no saved progress */ }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked */ } }
  Sound.setMuted(progress.muted); SC.muted = progress.muted;

  function dayDone(d) { return !!progress.days[d.num]; }
  function dayUnlocked(d) { return progress.unlockAll || DAYS.slice(0, d.index).every(dayDone); }
  function nextDay() { return DAYS.filter(function (d) { return !dayDone(d); })[0] || null; }
  function totalPay() { return DAYS.reduce(function (a, d) { return a + ((progress.days[d.num] && progress.days[d.num].pay) || 0); }, 0); }

  /* ---------------------------------------------------------------- stage */

  app.innerHTML = '';
  var canvas = el('canvas', { class: 'scene', width: 960, height: 540, 'aria-hidden': 'true' });
  var layer = el('div', { class: 'layer' });
  var stage = el('div', { class: 'stage' }, canvas, layer);
  var srStatus = el('p', { class: 'sr-only', 'aria-live': 'polite' });
  app.appendChild(el('div', { class: 'viewport' }, stage));
  app.appendChild(srStatus);
  function fit() {
    var s = Math.min(window.innerWidth / 960, window.innerHeight / 540);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit); fit();
  startScene(canvas);

  function at(x, y, w, h) { return 'left:' + x * 3 + 'px;top:' + y * 3 + 'px;width:' + w * 3 + 'px;height:' + h * 3 + 'px'; }
  function announce(text) { srStatus.textContent = text; }
  function shake() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
  function btn(text, onclick, cls, attrs) {
    var b = el('button', Object.assign({ class: 'px-btn' + (cls ? ' ' + cls : ''), type: 'button', text: text }, attrs || {}));
    b.addEventListener('click', function (e) { Sound.play('click'); onclick(e); });
    return b;
  }

  var keyHandler = null;
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && closeTopOverlay()) { e.preventDefault(); return; }
    if (keyHandler) keyHandler(e);
  });

  var overlays = [];
  function openOverlay(node, onClose) {
    var wrap = el('div', { class: 'overlay' }, node);
    layer.appendChild(wrap);
    overlays.push({ wrap: wrap, onClose: onClose });
    var f = node.querySelector('[data-autofocus]') || node.querySelector('button');
    if (f) f.focus({ preventScroll: true });
    return wrap;
  }
  function closeTopOverlay() {
    var o = overlays[overlays.length - 1];
    if (!o || !o.onClose) return false;
    overlays.pop(); o.wrap.remove(); o.onClose();
    return true;
  }
  function clearLayer() { layer.innerHTML = ''; overlays = []; keyHandler = null; bubble = null; }

  /* ---------------------------------------------------------------- boss speech */

  var bubble = null, bubbleTimer = null;
  function bossSay(text, ms) {
    if (!text) return;
    ms = ms || 3600;
    if (bubble) bubble.remove();
    clearTimeout(bubbleTimer);
    bubble = el('div', { class: 'bubble', style: at(4, 60, 100, 34), role: 'status' },
      el('span', { class: 'bubble-name', text: BOSS_SHORT }), el('span', { class: 'bubble-text', text: text }));
    layer.appendChild(bubble);
    SC.talkUntil = performance.now() + Math.min(ms, 1600);
    var mine = bubble;
    bubbleTimer = setTimeout(function () { if (mine.parentNode) mine.remove(); if (bubble === mine) bubble = null; }, ms);
  }

  /* ---------------------------------------------------------------- shared bits */

  var DOC_LABEL = { email: 'Email', memo: 'Memo', letter: 'Letter', 'court-filing': 'Court filing', court: 'Court filing' };
  function docHeader(kind, header, title) {
    var rows = header.slice();
    if (kind === 'email' && title && !rows.some(function (p) { return /^subject$/i.test(p[0]); })) rows.push(['Subject', title]);
    if (kind === 'court-filing' || kind === 'court') {
      return el('div', { class: 'doc-head court-head' }, rows.map(function (p) {
        return el('p', null, el('span', { class: 'court-label', text: p[0] }), el('span', { class: 'court-value', text: p[1] }));
      }));
    }
    return el('div', { class: 'doc-head head-' + kind },
      kind === 'memo' ? el('p', { class: 'memo-word', text: 'Memorandum' }) : null,
      kind === 'letter' ? el('p', { class: 'letterhead', text: FIRM }) : null,
      rows.length ? el('dl', { class: 'head-rows' }, rows.map(function (p) { return [el('dt', { text: p[0] }), el('dd', { text: p[1] })]; })) : null);
  }
  function stars(n) {
    var out = [];
    for (var k = 1; k <= 3; k++) out.push(el('span', { class: k <= n ? 'star-on' : 'star-off', 'aria-hidden': 'true', text: '★' }));
    return el('span', { class: 'stars', role: 'img', 'aria-label': n + ' of 3 stars' }, out);
  }
  function money(n) { return (n < 0 ? '−$' : '$') + Math.abs(n); }

  /* ---------------------------------------------------------------- title screen */

  function renderTitle() {
    stopRun();
    clearLayer();
    SC.mode = 'title';
    var started = Object.keys(progress.days).length > 0;
    var unlock = el('input', { type: 'checkbox', id: 'opt-unlock' }); unlock.checked = progress.unlockAll;
    unlock.addEventListener('change', function () { progress.unlockAll = unlock.checked; save(); });
    var sound = el('input', { type: 'checkbox', id: 'opt-sound' }); sound.checked = !progress.muted;
    sound.addEventListener('change', function () { setMuted(!sound.checked); });
    var panel = el('div', { class: 'px-panel title-panel' },
      el('p', { class: 'title-firm', text: FIRM }),
      el('h1', { class: 'title-name', text: GAME_TITLE }),
      S.subtitle ? el('p', { class: 'title-sub', text: S.subtitle }) : null,
      GAME.settings.body.trim() ? el('div', { class: 'md title-intro', html: md(GAME.settings.body) }) : null,
      DAYS.length
        ? el('div', { class: 'row center' },
          btn(started ? 'Continue' : (S.start || 'Start your first day'), function () {
            if (!started && DAYS[0]) startDay(DAYS[0]); else renderPlanner();
          }, 'big', { 'data-autofocus': true }),
          started ? btn('Your week', renderPlanner, 'ghost') : null)
        : el('p', { class: 'warn-text', text: 'No level files found. Add .md files to the levels folder, then run build.cmd.' }),
      el('details', { class: 'title-options' },
        el('summary', { text: 'Options' }),
        el('label', { class: 'check' }, sound, ' Sound effects'),
        el('label', { class: 'check' }, unlock, ' Unlock every day (for instructors and testing)'),
        btn('Reset progress', function () {
          if (confirm('Reset all progress and pay?')) { progress.days = {}; progress.unlockAll = false; save(); renderTitle(); }
        }, 'small ghost'),
        el('p', { class: 'tiny', text: GAME.steps.length + ' level files' + (DATA.built ? ' · built ' + DATA.built : '') })),
      warnings.length ? el('details', { class: 'warnings', open: true },
        el('summary', { text: '⚠ ' + warnings.length + (warnings.length === 1 ? ' problem' : ' problems') + ' in the level files' }),
        el('ul', null, warnings.map(function (w) { return el('li', { text: w }); }))) : null);
    layer.appendChild(el('div', { class: 'title-wrap', style: at(40, 8, 240, 164) }, panel));
    var f = panel.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true });
  }

  function setMuted(m) { progress.muted = !!m; SC.muted = progress.muted; Sound.setMuted(progress.muted); save(); }

  /* ---------------------------------------------------------------- week planner */

  function renderPlanner() {
    stopRun();
    clearLayer();
    SC.mode = 'title';
    var nd = nextDay();
    var allDone = DAYS.length > 0 && !nd;
    var grid = el('div', { class: 'planner-grid' }, DAYS.map(function (d) {
      var done = progress.days[d.num], open = dayUnlocked(d);
      var b = el('button', { class: 'day-card' + (done ? ' is-done' : '') + (d === nd ? ' is-next' : '') + (open ? '' : ' is-locked'), type: 'button', disabled: !open },
        el('span', { class: 'day-no', text: 'Day ' + d.no }),
        el('span', { class: 'day-name', text: d.name || ' ' }),
        done ? el('span', { class: 'day-stat' }, done.stars != null ? stars(done.stars) : el('span', { text: '✓' }), el('span', { class: 'day-pay', text: done.pay != null ? money(done.pay) : '' }))
          : el('span', { class: 'day-stat', text: open ? (d === nd ? 'Next' : 'Open') : 'Locked' }));
      b.addEventListener('click', function () { Sound.play('click'); startDay(d); });
      return b;
    }));
    var panel = el('div', { class: 'px-panel planner' },
      el('div', { class: 'planner-head' },
        el('h1', { text: 'Your week at ' + FIRM }),
        el('p', { class: 'planner-total' }, 'Earned so far: ', el('strong', { text: money(totalPay()) }))),
      grid,
      el('div', { class: 'row center' },
        allDone ? btn('Read your performance review', renderReview, '', { 'data-autofocus': true }) : nd ? btn('Start ' + dayLabel(nd), function () { startDay(nd); }, '', { 'data-autofocus': true }) : null,
        btn('Title screen', renderTitle, 'ghost')));
    layer.appendChild(el('div', { class: 'planner-wrap', style: at(16, 10, 288, 162) }, panel));
    var f = panel.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- a day at the desk */

  var RUN = null;

  function stopRun() { if (RUN) { RUN.ended = true; RUN.clockOn = false; } RUN = null; }

  function officeChrome() {
    clearLayer();
    SC.mode = 'office';
    var muteBtn = el('button', { class: 'hit', type: 'button', style: at(290, 2, 13, 11), 'aria-label': progress.muted ? 'Turn sound on' : 'Turn sound off', title: 'Sound' });
    muteBtn.addEventListener('click', function () { setMuted(!progress.muted); muteBtn.setAttribute('aria-label', progress.muted ? 'Turn sound on' : 'Turn sound off'); });
    var weekBtn = el('button', { class: 'hit', type: 'button', style: at(305, 2, 13, 11), 'aria-label': 'Leave the desk: your week', title: 'Your week' });
    weekBtn.addEventListener('click', function () {
      if (RUN && !RUN.ended && RUN.started && !confirm('Leave this day? You’ll have to start it again.')) return;
      renderPlanner();
    });
    var bookBtn = el('button', { class: 'hit', type: 'button', style: at(254, 156, 60, 20), 'aria-label': 'Open the rulebook', title: 'Rulebook' });
    bookBtn.addEventListener('click', openRulebook);
    var approve = el('button', { class: 'hit stamp-hit', type: 'button', style: at(255, 102, 32, 51), 'aria-label': 'Stamp APPROVE: no errors, send it out', disabled: true });
    var ret = el('button', { class: 'hit stamp-hit', type: 'button', style: at(287, 102, 32, 51), 'aria-label': 'Stamp RETURN: has errors, send it back with my corrections', disabled: true });
    approve.addEventListener('click', function () { if (RUN && RUN.onStamp) RUN.onStamp('approve'); });
    ret.addEventListener('click', function () { if (RUN && RUN.onStamp) RUN.onStamp('return'); });
    var zone = el('div', { class: 'zone', style: at(108, 18, 142, 160) });
    append(layer, [zone, muteBtn, weekBtn, bookBtn, approve, ret]);
    return { zone: zone, approve: approve, ret: ret };
  }

  function setStamps(mode) {
    SC.stamps = mode;
    if (!RUN || !RUN.ui) return;
    RUN.ui.approve.disabled = mode !== 'on';
    RUN.ui.ret.disabled = mode === 'off';
    RUN.ui.approve.title = mode === 'return-only' ? 'You’ve corrected errors, so this one goes back.' : '';
  }

  function startDay(d) {
    stopRun();
    RUN = {
      day: d, pos: 0, results: [], hearts: HEARTS, pay: 0, time: d.shiftStart,
      clockOn: false, started: false, ended: false, hurried: false, lastTick: -1, onStamp: null,
      payNotes: 0, payDocs: 0, payFixes: 0, fines: 0, hints: 0
    };
    var ui = officeChrome();
    RUN.ui = ui;
    SC.dayText = dayLabel(d).toUpperCase();
    SC.time = d.shiftStart; SC.hearts = HEARTS; SC.maxHearts = HEARTS; SC.pay = 0;
    SC.inbox = countWork(d); SC.outbox = 0;
    setStamps('off');
    var card = el('div', { class: 'px-panel day-intro' },
      el('p', { class: 'day-big', text: 'Day ' + d.no }),
      d.name ? el('h1', { text: d.name }) : null,
      el('p', { text: fmtTime(d.shiftStart) + ' – ' + fmtTime(d.shiftEnd) }),
      el('p', { class: 'tiny', text: (d.lessons.length ? (d.lessons.length === 1 ? '1 lesson' : d.lessons.length + ' lessons') + ' · ' : '') + countWork(d) + ' items in your inbox' }),
      btn('Start the day', function () { overlays.pop(); wrap.remove(); morning(0); }, 'big', { 'data-autofocus': true }));
    var wrap = openOverlay(card, null);
    announce(dayLabel(d));
  }

  function morning(i) {
    var d = RUN.day;
    if (i >= d.lessons.length) { clockInScreen(); return; }
    var s = d.lessons[i], kind = slug(s.meta.document || 'memo');
    Sound.play('paper');
    var paper = el('article', { class: 'paper enter doc-' + kind, tabindex: '-1' },
      el('p', { class: 'paper-tag', text: 'Today’s lesson · ' + (DOC_LABEL[kind] || 'Memo') }),
      kind === 'memo' || kind === 'note' ? el('h2', { class: 'paper-title', text: s.title }) : null,
      docHeader(kind, s.header, s.title),
      el('div', { class: 'md', html: md(s.body) }));
    var file = btn('File it in the rulebook ▸', function () {
      file.disabled = true;
      Sound.play('paper');
      paper.classList.add('fly-binder');
      setTimeout(function () { morning(i + 1); }, 420);
    }, '', { 'data-autofocus': true });
    swapZone([paper, el('div', { class: 'zone-foot' }, file)]);
    file.focus();
    bossSay(i === 0 ? 'Read this first. It goes in your rulebook.' : 'One more for the rulebook.');
  }

  function clockInScreen() {
    var d = RUN.day;
    if (!d.items.length) { finishDayNoTest(); return; }
    var card = el('article', { class: 'paper card-small enter' },
      el('h2', { class: 'paper-title', text: 'Your shift' }),
      el('p', null, 'Shift: ', el('strong', { text: fmtTime(d.shiftStart) + ' – ' + fmtTime(d.shiftEnd) })),
      d.intro ? el('div', { class: 'md', html: md(d.intro) }) : null,
      el('ul', { class: 'tips' },
        el('li', { text: 'Sticky notes: click the right answer.' }),
        el('li', { text: 'Documents: correct each wrong word, then stamp RETURN. If there’s nothing wrong, stamp APPROVE.' }),
        el('li', { text: 'Wrong stamps cost a heart. Lose them all and you’re fired.' }),
        el('li', { text: 'The rulebook (bottom right) has every lesson. The clock keeps running while it’s open.' })));
    var go = btn('Clock in ▸', function () {
      RUN.started = true; RUN.clockOn = true;
      Sound.play('stamp');
      nextItem();
    }, 'big', { 'data-autofocus': true });
    swapZone([card, el('div', { class: 'zone-foot' }, go)]);
    go.focus();
    bossSay(line('start'));
  }

  function swapZone(nodes) {
    var z = RUN.ui.zone;
    z.innerHTML = '';
    append(z, nodes);
    z.scrollTop = 0;
  }

  /* ---------- the clock */

  var lastFrame = null;
  function clockLoop(t) {
    var dt = lastFrame == null ? 0 : Math.min(t - lastFrame, 250);
    lastFrame = t;
    if (RUN && RUN.clockOn && !RUN.ended) {
      advance(dt / 60000 * SPEED);
    }
    requestAnimationFrame(clockLoop);
  }
  requestAnimationFrame(clockLoop);

  function advance(mins) {
    if (!RUN || RUN.ended) return;
    RUN.time += mins;
    SC.time = RUN.time;
    var end = RUN.day.shiftEnd;
    if (!RUN.hurried && RUN.time >= end - 30) { RUN.hurried = true; bossSay(line('hurry')); }
    if (RUN.time >= end - 30) {
      var m = Math.floor(RUN.time / 5);
      if (m !== RUN.lastTick) { RUN.lastTick = m; Sound.play('tick'); }
    }
    if (RUN.time >= end) closing();
  }
  function penalty(mins) {
    if (!RUN || !RUN.clockOn) return;
    advance(mins);
    floatText('−' + mins + ' min', 'loss', 140, 16);
  }
  function addPay(n, bucket) {
    if (!n) return;
    RUN.pay += n; SC.pay = RUN.pay;
    if (bucket) RUN[bucket] += n;
    floatText((n > 0 ? '+' : '−') + '$' + Math.abs(n), n > 0 ? 'gain' : 'loss', 252, 16);
    if (n > 0) Sound.play('coin');
  }
  function loseHeart() {
    RUN.hearts = Math.max(0, RUN.hearts - 1);
    SC.hearts = RUN.hearts;
    floatText('−♥', 'loss', 192, 16);
    shake();
    announce('You lost a heart. ' + RUN.hearts + ' left.');
  }
  function floatText(text, cls, x, y) {
    var f = el('div', { class: 'float ' + cls, style: 'left:' + x * 3 + 'px;top:' + y * 3 + 'px', 'aria-hidden': 'true', text: text });
    layer.appendChild(f);
    setTimeout(function () { f.remove(); }, 1100);
  }

  /* ---------- items */

  function nextItem() {
    if (!RUN || RUN.ended) return;
    setStamps('off'); RUN.onStamp = null; keyHandler = null;
    var it = RUN.day.items[RUN.pos];
    if (!it) { endOfDay('done'); return; }
    Sound.play('paper');
    if (it.kind !== 'note') SC.inbox = Math.max(0, SC.inbox - 1);
    if (it.kind === 'mc') showSticky(it);
    else if (it.kind === 'proof') showDoc(it);
    else showMemo(it);
  }
  function finishItem(result, card) {
    if (!RUN || RUN.ended) return;
    RUN.results[RUN.pos] = result;
    RUN.pos++;
    setStamps('off'); RUN.onStamp = null; keyHandler = null;
    if (result) SC.outbox++;
    if (RUN.hearts <= 0) { fired(); return; }
    if (card) { card.classList.add('fly-out'); Sound.play('paper'); setTimeout(nextItem, 380); }
    else nextItem();
  }

  function showMemo(it) {
    var card = el('article', { class: 'paper card-small enter' },
      el('p', { class: 'paper-tag', text: 'Note from ' + BOSS_SHORT }),
      it.title ? el('h2', { class: 'paper-title', text: it.title }) : null,
      el('div', { class: 'md', html: md(it.body) }));
    var ok = btn('OK ▸', function () { finishItem(null, card); }, '', { 'data-autofocus': true });
    swapZone([card, el('div', { class: 'zone-foot' }, ok)]);
    ok.focus();
  }

  function showSticky(it) {
    var wrongs = [], hintUsed = false, solved = false;
    var fb = el('div', { class: 'note-fb', 'aria-live': 'polite' });
    var card;
    var opts = it.options.map(function (o) {
      var b = el('button', { class: 'opt', type: 'button' }, el('span', { class: 'opt-l', text: o.letter }), el('span', { class: 'opt-t', html: inline(o.text) }));
      b.addEventListener('click', function () { pick(o, b); });
      return b;
    });
    var hintBtn = it.hint ? btn('Hint (−$' + (PAY.note - PAY.hint) + ')', function () {
      hintUsed = true; RUN.hints++; hintBtn.remove();
      fb.className = 'note-fb hint'; fb.innerHTML = '<strong>Hint:</strong> ' + inline(it.hint);
    }, 'small ghost') : null;
    var nextBtn = btn('Into the outbox ▸', function () {
      finishItem({ kind: 'mc', item: it, firstTry: wrongs.length === 0, hint: hintUsed, wrongs: wrongs }, card);
    }, '', { hidden: true });
    function pick(o, b) {
      if (solved || b.disabled || RUN.ended) return;
      if (o.letter === it.answer) {
        solved = true;
        b.classList.add('right');
        opts.forEach(function (x) { x.disabled = true; });
        Sound.play('right');
        var earned = wrongs.length ? 0 : hintUsed ? PAY.hint : PAY.note;
        addPay(earned, 'payNotes');
        fb.className = 'note-fb good';
        fb.innerHTML = '<strong>' + (wrongs.length ? 'That’s it.' : 'Correct!') + '</strong>' + (it.explain ? ' ' + it.explain.split('\n').map(inline).join('<br>') : '');
        if (hintBtn) hintBtn.remove();
        nextBtn.hidden = false; nextBtn.focus();
        if (!wrongs.length && Math.random() < 0.3) bossSay(line('right'), 2200);
      } else {
        wrongs.push(o.letter);
        b.classList.add('wrong'); b.disabled = true;
        Sound.play('wrong');
        card.classList.remove('wobble'); void card.offsetWidth; card.classList.add('wobble');
        fb.className = 'note-fb bad';
        fb.innerHTML = '<strong>Not quite.</strong> ' + (it.feedback[o.letter] ? inline(it.feedback[o.letter]) : 'Try another answer.');
        penalty(NOTE_PENALTY);
        if (wrongs.length === 1 && Math.random() < 0.4) bossSay(line('wrong'), 2200);
      }
    }
    var who = it.title && !/^question\b/i.test(it.title) ? it.title : '';
    card = el('article', { class: 'sticky enter' },
      el('div', { class: 'tape', 'aria-hidden': 'true' }),
      el('p', { class: 'sticky-from', text: who || 'Quick question' }),
      el('div', { class: 'md sticky-q', html: md(it.question) }),
      el('div', { class: 'opts', role: 'group', 'aria-label': 'Answers' }, opts),
      fb);
    swapZone([card, el('div', { class: 'zone-foot' }, hintBtn, nextBtn)]);
    if (opts[0]) opts[0].focus();
    keyHandler = function (e) {
      var k = e.key.toUpperCase();
      if (k.length === 1 && k >= 'A' && k <= 'H') {
        var n = it.options.findIndex(function (o) { return o.letter === k; });
        if (n >= 0) { e.preventDefault(); opts[n].click(); }
      }
    };
  }

  function showDoc(it) {
    var kind = slug(it.document || 'memo');
    var found = 0, mistakes = 0, revealed = 0, over = 0, current = null, locked = false;
    var markSpans = [];
    var log = el('ol', { class: 'log', 'aria-live': 'polite' });
    var counter = el('span', { class: 'counter', text: 'Corrections: 0' });
    var msg = el('div', { class: 'doc-msg', 'aria-live': 'polite' });

    var input = el('input', { type: 'text', class: 'fix-input', 'aria-label': 'Corrected text', autocomplete: 'off', spellcheck: 'false' });
    var fixLabel = el('p', { class: 'fix-label' });
    var panel = el('form', { class: 'fix-panel', hidden: true },
      fixLabel,
      el('div', { class: 'fix-row' }, input,
        el('button', { class: 'px-btn small', type: 'submit', text: 'Fix it' }),
        btn('Delete it', function () { tryFix('', true); }, 'small ghost')),
      el('div', { class: 'fix-row' },
        btn('Show me (−' + it.penalty + ' min)', reveal, 'small link'),
        btn('Cancel', closePanel, 'small link')));
    panel.addEventListener('submit', function (e) { e.preventDefault(); tryFix(input.value, false); });

    function say(cls, html) { msg.className = 'doc-msg ' + cls; msg.innerHTML = html; }
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    function mistake(html) {
      mistakes++;
      Sound.play('wrong');
      say('bad', html);
      penalty(it.penalty);
    }
    function closePanel() { panel.hidden = true; if (current) current.span.classList.remove('sel'); current = null; }
    function openPanel(mark, span) {
      if (current) current.span.classList.remove('sel');
      current = { mark: mark, span: span };
      span.classList.add('sel');
      fixLabel.innerHTML = 'Red pen: <strong>' + esc(mark.wrong) + '</strong>';
      input.value = mark.wrong;
      panel.hidden = false;
      input.focus(); input.select();
      paper.scrollTop = Math.max(0, span.offsetTop - paper.clientHeight / 3);
    }
    function fixLine(mark, text) {
      return '<strong>' + esc(mark.wrong) + '</strong> → ' + (text ? '<strong>' + esc(text) + '</strong>' : '<em>deleted</em>') + (mark.feedback ? '. ' + inline(mark.feedback) : '');
    }
    function showFix(span, mark, text, cls) {
      span.classList.add(cls);
      span.removeAttribute('tabindex'); span.removeAttribute('role');
      span.innerHTML = text ? '<del>' + esc(mark.wrong) + '</del> <ins>' + esc(text) + '</ins>' : '<del>' + esc(mark.wrong) + '</del>';
    }
    function solve(text, how) {
      var c = current; closePanel();
      c.mark.solved = true; found++;
      showFix(c.span, c.mark, text, how === 'revealed' ? 'revealed' : 'fixed');
      log.appendChild(el('li', { class: how === 'revealed' ? 'l-revealed' : 'l-fixed', html: fixLine(c.mark, text) }));
      counter.textContent = 'Corrections: ' + found;
      setStamps('return-only');
    }
    function tryFix(value, isDelete) {
      if (!current || locked) return;
      var m = current.mark, v = norm(value);
      if (isDelete || v === '') {
        if (m.del) { Sound.play('right'); say('good', '<strong>Corrected.</strong>'); solve('', 'fixed'); }
        else mistake('<strong>That word needs fixing, not deleting.</strong>');
        return;
      }
      if (m.del) { mistake('<strong>Not quite.</strong> Try removing it.'); return; }
      if (v === norm(m.wrong)) { say('info', 'Change the text in the box first, then press <strong>Fix it</strong>.'); return; }
      if (m.rights.some(function (r) { return norm(r) === v; })) { Sound.play('right'); say('good', '<strong>Corrected.</strong>'); solve(value.trim(), 'fixed'); return; }
      var loose = m.rights.some(function (r) { return norm(r).toLowerCase() === v.toLowerCase(); });
      mistake(loose ? '<strong>Close.</strong> Check your capital letters.' : '<strong>Not quite.</strong> Try again, or ask to be shown.');
    }
    function reveal() {
      if (!current || locked) return;
      revealed++; mistakes++;
      say('info', 'Here’s the fix. Read why before you move on.');
      solve(current.mark.rights[0] || '', 'revealed');
      penalty(it.penalty);
    }
    function tokenSpan(text, onClick) {
      var s = el('span', { class: 'tok', role: 'button', tabindex: '0', text: text });
      s.addEventListener('click', function () { onClick(s); });
      s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(s); } });
      return s;
    }
    function overCorrect(s, html) {
      if (locked || s.classList.contains('over')) return;
      closePanel(); over++;
      s.classList.add('over'); s.removeAttribute('tabindex');
      addPay(-PAY.over, 'fines');
      mistake('<strong>“' + esc(s.textContent) + '” was already correct.</strong> ' + html);
      if (over === 1 || Math.random() < 0.3) bossSay(line('over'), 2400);
    }
    function renderSegs(segs) {
      var out = [];
      segs.forEach(function (seg) {
        if (seg.t === 'text') {
          seg.s.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) out.push(part);
            else out.push(tokenSpan(part, function (s) { overCorrect(s, 'Changing correct words is an error too.'); }));
          });
        } else if (seg.trap) {
          out.push(tokenSpan(seg.wrong, function (s) { overCorrect(s, seg.feedback ? inline(seg.feedback) : 'Changing correct words is an error too.'); }));
        } else {
          seg.solved = false;
          var span = tokenSpan(seg.wrong, function (s) { if (!locked && !seg.solved) openPanel(seg, s); });
          markSpans.push({ seg: seg, span: span });
          out.push(span);
        }
      });
      return out;
    }
    var body = it.paras.map(function (para) {
      var first = para[0] && para[0].length === 1 && para[0][0].t === 'text' ? para[0][0].s : '';
      if (para.length === 1 && /^#\s+/.test(first)) return el('p', { class: 'passage-heading' }, renderSegs([{ t: 'text', s: first.replace(/^#\s+/, '') }]));
      var p = el('p');
      para.forEach(function (segs, n) { if (n) p.appendChild(el('br')); append(p, renderSegs(segs)); });
      return p;
    });

    var paper = el('article', { class: 'paper passage enter doc-' + kind },
      el('div', { class: 'paper-bar' }, el('span', { class: 'paper-tag', text: it.title }), counter),
      it.intro ? el('div', { class: 'md doc-intro', html: md(it.intro) }) : null,
      docHeader(kind, it.header, it.title),
      el('div', { class: 'passage-body' }, body),
      log);
    var hintBtn = it.hint ? btn('Hint', function () { hintBtn.remove(); say('hint', '<strong>Hint:</strong> ' + inline(it.hint)); }, 'small ghost') : null;
    // The message sits in the footer (it replaces "Stamp it" while shown); the red-pen box floats over the bottom of the page.
    var foot = el('div', { class: 'zone-foot doc-foot' }, msg, el('span', { class: 'stamp-help', text: 'Stamp it →' }), hintBtn);
    swapZone([paper, panel, foot]);
    setStamps('on');
    keyHandler = null;

    RUN.onStamp = function (choice) {
      if (locked || RUN.ended) return;
      if (choice === 'approve' && found > 0) return;
      locked = true; closePanel();
      RUN.onStamp = null;
      SC.press[choice] = performance.now();
      Sound.play('stamp'); shake();
      setStamps('off');
      var hasErrors = it.errors > 0;
      var right = hasErrors ? choice === 'return' : choice === 'approve';
      var missed = 0;
      markSpans.forEach(function (ms) {
        if (ms.seg.solved) return;
        missed++;
        showFix(ms.span, ms.seg, ms.seg.rights[0] || '', 'missed');
        log.appendChild(el('li', { class: 'l-missed', html: 'Missed: ' + fixLine(ms.seg, ms.seg.rights[0] || '') }));
      });
      paper.classList.add('locked');
      paper.appendChild(el('div', { class: 'impression imp-' + choice, 'aria-hidden': 'true', text: choice === 'approve' ? 'Approved' : 'Returned' }));
      var title, text, bossLine;
      if (choice === 'approve' && hasErrors) { title = 'This went out with errors'; text = plural(missed, 'error') + ' reached the client. They’re marked in blue.'; bossLine = 'approvebad'; }
      else if (choice === 'approve') { title = 'Approved. Nothing needed fixing.'; text = it.success ? inline(it.success) : 'Good call: every word was already correct.'; bossLine = 'clean'; }
      else if (!hasErrors) { title = 'Returned, but nothing was wrong'; text = 'This document was already correct.'; bossLine = 'returnclean'; }
      else if (missed) { title = 'Returned, but you missed ' + plural(missed, 'error'); text = 'They’re marked in blue.'; bossLine = 'missed'; }
      else { title = 'Returned with every error corrected'; text = it.success ? inline(it.success) : 'Clean work.'; bossLine = 'clean'; }
      if (over) text += ' You changed ' + plural(over, 'correct word') + '.';
      var good = right && !missed;
      if (!good) loseHeart();
      if (good) addPay(PAY.doc + PAY.fix * (found - revealed), 'payDocs');
      else if (right && found > revealed) addPay(PAY.fix * (found - revealed), 'payDocs');
      bossSay(line(bossLine), 2600);
      var score = Math.max(0, (found + (right ? 1 : 0)) / (it.errors + 1 + mistakes));
      var go = btn(RUN.hearts <= 0 ? 'Uh oh ▸' : 'Into the outbox ▸', function () {
        finishItem({ kind: 'proof', item: it, errors: it.errors, found: found, missed: missed, mistakes: mistakes, revealed: revealed, over: over, right: right, score: score }, paper);
      }, '', { 'data-autofocus': true });
      say(good ? 'good' : 'bad', '<strong>' + esc(title.replace(/\.$/, '')) + '.</strong> ' + text);
      foot.innerHTML = ''; append(foot, [msg, go]);
      go.focus();
    };
  }

  /* ---------- the end of the day */

  function closing() {
    if (!RUN || RUN.ended) return;
    RUN.ended = true; RUN.clockOn = false;
    RUN.time = RUN.day.shiftEnd; SC.time = RUN.time;
    setStamps('off'); RUN.onStamp = null; keyHandler = null;
    for (var i = RUN.pos; i < RUN.day.items.length; i++) {
      var it = RUN.day.items[i];
      if (it.kind === 'mc') RUN.results[i] = { kind: 'mc', item: it, firstTry: false, hint: false, wrongs: [], unfinished: true };
      else if (it.kind === 'proof') RUN.results[i] = { kind: 'proof', item: it, errors: it.errors, found: 0, missed: it.errors, mistakes: 0, revealed: 0, over: 0, right: false, score: 0, unfinished: true };
    }
    Sound.play('fired');
    bossSay(line('closing'));
    var card = el('div', { class: 'px-panel day-intro' },
      el('p', { class: 'day-big', text: fmtTime(RUN.day.shiftEnd) }),
      el('h1', { text: 'The office is closing' }),
      el('p', { text: 'Anything left in your inbox counts as unfinished.' }),
      btn('See your pay slip', function () { endOfDay('closing'); }, 'big', { 'data-autofocus': true }));
    openOverlay(card, null);
  }

  function fired() {
    RUN.ended = true; RUN.clockOn = false;
    Sound.play('fired');
    bossSay(line('fired'), 6000);
    var d = RUN.day;
    var card = el('div', { class: 'px-panel day-intro fired' },
      el('p', { class: 'day-big', text: 'You’re fired!' }),
      el('p', { text: 'You ran out of hearts. Read the rulebook, then try ' + dayLabel(d) + ' again.' }),
      el('div', { class: 'row center' },
        btn('Try the day again', function () { startDay(d); }, 'big', { 'data-autofocus': true }),
        btn('Your week', renderPlanner, 'ghost')));
    openOverlay(card, null);
  }

  function finishDayNoTest() {
    var d = RUN.day;
    progress.days[d.num] = progress.days[d.num] || { read: true };
    save();
    RUN.ended = true;
    Sound.play('done');
    var nd = nextDay();
    openOverlay(el('div', { class: 'px-panel day-intro' },
      el('h1', { text: dayLabel(d) + ' done' }),
      el('div', { class: 'row center' },
        nd ? btn('Start ' + dayLabel(nd), function () { startDay(nd); }, 'big', { 'data-autofocus': true }) : btn('Read your performance review', renderReview, 'big', { 'data-autofocus': true }),
        btn('Your week', renderPlanner, 'ghost'))), null);
  }

  function endOfDay(reason) {
    var d = RUN.day;
    RUN.ended = true; RUN.clockOn = false;
    if (reason === 'done') { Sound.play('done'); bossSay(line('done')); }
    var scored = RUN.results.filter(Boolean);
    var total = 0;
    scored.forEach(function (r) { total += r.kind === 'mc' ? (r.firstTry ? (r.hint ? 0.75 : 1) : 0) : r.score; });
    var pct = scored.length ? Math.round(total / scored.length * 100) : 100;
    var nStars = pct >= 90 ? 3 : pct >= 70 ? 2 : 1;
    var passed = d.pass == null || pct >= d.pass;
    var mcs = scored.filter(function (r) { return r.kind === 'mc'; });
    var docs = scored.filter(function (r) { return r.kind === 'proof'; });
    var unfinished = scored.filter(function (r) { return r.unfinished; }).length;
    function sum(k) { return docs.reduce(function (a, r) { return a + (r[k] || 0); }, 0); }
    if (passed) {
      var prev = progress.days[d.num] || {};
      progress.days[d.num] = { stars: Math.max(nStars, prev.stars || 0), best: Math.max(pct, prev.best || 0), pay: Math.max(RUN.pay, prev.pay || 0) };
      save();
    }
    var noteKey = passed ? 'note ' + nStars : 'note fail';
    var DEFAULT_NOTES = { 'note 3': 'Excellent work.', 'note 2': 'Acceptable.', 'note 1': 'See me tomorrow morning.', 'note fail': 'Not good enough. Do it again.' };
    var note = d.meta[noteKey] || (passed && d.meta.note) || S[noteKey] || DEFAULT_NOTES[noteKey];

    function row(label, count, amount) {
      return el('tr', null, el('th', { scope: 'row', text: label }), el('td', { class: 'c', text: count }), el('td', { class: 'a', text: amount == null ? '' : money(amount) }));
    }
    var rows = [];
    if (mcs.length) rows.push(row('Sticky notes right first try', mcs.filter(function (r) { return r.firstTry; }).length + ' / ' + mcs.length, RUN.payNotes));
    if (docs.length) {
      rows.push(row('Documents stamped correctly', docs.filter(function (r) { return r.right && !r.missed; }).length + ' / ' + docs.length, RUN.payDocs));
      rows.push(row('Errors corrected', String(sum('found')), null));
      rows.push(row('Errors missed', String(sum('missed')), null));
      rows.push(row('Correct words changed', String(sum('over')), RUN.fines));
    }
    if (RUN.hints) rows.push(row('Hints used', String(RUN.hints), null));
    if (unfinished) rows.push(row('Unfinished', String(unfinished), null));
    var missedQs = mcs.filter(function (r) { return !r.firstTry && !r.unfinished; });
    var nd = DAYS[d.index + 1];
    var slip = el('div', { class: 'px-panel slip' },
      el('div', { class: 'slip-head' },
        el('p', { class: 'slip-kicker', text: 'Pay slip · ' + FIRM }),
        el('h1', { text: dayLabel(d) })),
      el('table', { class: 'slip-rows' }, el('tbody', null, rows)),
      el('div', { class: 'slip-total' },
        el('span', null, 'Total pay ', el('strong', { text: money(RUN.pay) })),
        el('span', null, 'Score ', el('strong', { text: pct + '%' }), ' ', passed ? stars(nStars) : null)),
      passed ? null : el('p', { class: 'warn-text', text: 'You need ' + d.pass + '% to pass this day.' }),
      el('blockquote', { class: 'boss-note' }, el('p', { text: '“' + note + '”' }), el('cite', { text: '— ' + BOSS })),
      missedQs.length ? el('details', { class: 'review' },
        el('summary', { text: 'Worth another look (' + missedQs.length + ')' }),
        el('ol', null, missedQs.map(function (r) {
          var right = r.item.options.filter(function (o) { return o.letter === r.item.answer; })[0];
          return el('li', null, el('div', { class: 'md', html: md(r.item.question) }),
            el('p', { class: 'review-answer', html: 'Answer: <strong>' + esc(r.item.answer) + ')</strong> ' + (right ? inline(right.text) : '') }),
            r.item.explain ? el('p', { class: 'tiny', html: inline(r.item.explain) }) : null);
        }))) : null,
      el('div', { class: 'row center' },
        passed && nd ? btn('Start ' + dayLabel(nd) + ' ▸', function () { startDay(nd); }, '', { 'data-autofocus': true })
          : passed && !nextDay() ? btn('Read your performance review', renderReview, '', { 'data-autofocus': true }) : null,
        btn('Redo this day', function () { startDay(d); }, passed ? 'ghost' : '', passed ? null : { 'data-autofocus': true }),
        btn('Your week', renderPlanner, 'ghost')));
    setTimeout(function () { openOverlay(slip, null); }, reason === 'done' ? 500 : 0);
  }

  /* ---------------------------------------------------------------- rulebook */

  function openRulebook() {
    if (layer.querySelector('.book')) { closeTopOverlay(); return; }
    var upTo = RUN ? RUN.day.num : Infinity;
    var lessons = GAME.steps.filter(function (s) { return s.kind === 'lesson' && s.num <= upTo; });
    var page = el('div', { class: 'book-page md' });
    var tabs = el('nav', { class: 'book-tabs', 'aria-label': 'Rulebook sections' });
    function showLesson(s, b) {
      tabs.querySelectorAll('button').forEach(function (x) { x.classList.remove('cur'); x.removeAttribute('aria-current'); });
      b.classList.add('cur'); b.setAttribute('aria-current', 'true');
      page.innerHTML = '';
      var d = DAYS.filter(function (x) { return x.num === s.num; })[0];
      append(page, [el('p', { class: 'tiny', text: d ? dayLabel(d) : '' }), el('h2', { text: s.title })]);
      page.insertAdjacentHTML('beforeend', md(s.body));
      page.scrollTop = 0;
    }
    var last = null;
    lessons.forEach(function (s) {
      var d = DAYS.filter(function (x) { return x.num === s.num; })[0];
      var b = el('button', { type: 'button' }, el('span', { class: 'tab-day', text: d ? 'Day ' + d.no : '' }), el('span', { text: s.title }));
      b.addEventListener('click', function () { Sound.play('paper'); showLesson(s, b); });
      tabs.appendChild(b); last = { s: s, b: b };
    });
    var book = el('div', { class: 'book', role: 'dialog', 'aria-label': 'Rulebook' },
      el('div', { class: 'book-head' }, el('strong', { text: 'Rulebook' }),
        RUN && RUN.clockOn ? el('span', { class: 'tiny', text: 'The clock keeps running' }) : null,
        btn('Close', function () { closeTopOverlay(); }, 'small ghost', { 'data-autofocus': true })),
      el('div', { class: 'book-body' }, tabs, lessons.length ? page : el('p', { class: 'book-page', text: 'No lessons yet.' })));
    var prevFocus = document.activeElement;
    Sound.play('paper');
    openOverlay(book, function () { if (prevFocus && prevFocus.focus) prevFocus.focus(); });
    if (last) showLesson(last.s, last.b);
  }

  /* ---------------------------------------------------------------- performance review */

  function renderReview() {
    stopRun();
    clearLayer();
    SC.mode = 'title';
    var tested = DAYS.filter(function (d) { return d.items.length; });
    var earned = 0;
    tested.forEach(function (d) { earned += (progress.days[d.num] && progress.days[d.num].stars) || 0; });
    var panel = el('div', { class: 'px-panel slip review-panel' },
      el('div', { class: 'slip-head' }, el('p', { class: 'slip-kicker', text: 'Memorandum · ' + FIRM }), el('h1', { text: 'Performance review' })),
      el('p', { class: 'tiny', text: 'From ' + (S.reviewer || BOSS) }),
      el('table', { class: 'slip-rows' }, el('tbody', null, tested.map(function (d) {
        var r = progress.days[d.num] || {};
        return el('tr', null, el('th', { scope: 'row', text: dayLabel(d) }), el('td', { class: 'c', text: r.best != null ? r.best + '%' : '–' }), el('td', { class: 'a' }, stars(r.stars || 0)));
      }))),
      el('div', { class: 'slip-total' },
        el('span', null, 'Stars ', el('strong', { text: earned + ' / ' + tested.length * 3 })),
        el('span', null, 'Total pay ', el('strong', { text: money(totalPay()) }))),
      S.ending ? el('div', { class: 'md', html: md(S.ending) }) : el('p', { text: 'You made it through every day on your desk.' }),
      el('div', { class: 'row center' }, btn('Your week', renderPlanner, '', { 'data-autofocus': true }), btn('Title screen', renderTitle, 'ghost')));
    layer.appendChild(el('div', { class: 'planner-wrap', style: at(40, 8, 240, 164) }, panel));
    var f = panel.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true });
    Sound.play('done');
  }

  renderTitle();
