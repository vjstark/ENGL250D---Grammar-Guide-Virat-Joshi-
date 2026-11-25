/* Level-file parser: reads the .md files packed in window.GAME_DATA. Shared by scene.js, sound.js and game.js (build.ps1 joins them). */

  var DATA = window.GAME_DATA || { files: [], images: {} };
  var app = document.getElementById('app');

  /* ---------------------------------------------------------------- utilities */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(tag, props) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  function append(n, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(n, k); }); return; }
    n.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }

  // Normalise typed answers: curly quotes → straight, collapse spaces.
  function norm(s) {
    return String(s || '').replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ').trim();
  }

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // "4:30 p.m." → minutes after midnight
  function parseTime(s) {
    if (!s) return null;
    var m = String(s).match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|noon)?/i);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0, ap = (m[3] || '').toLowerCase().replace(/[\s.]/g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (ap === 'noon') h = 12;
    return h * 60 + min;
  }
  function fmtTime(mins) {
    var h = Math.floor(mins / 60) % 24, m = mins % 60, ap = h >= 12 ? 'p.m.' : 'a.m.';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  /* ---------------------------------------------------------------- markdown */

  function imageHtml(alt, src) {
    var raw = src.replace(/&amp;/g, '&');
    var url = null;
    if (/^(https?:|data:)/i.test(raw)) url = raw;
    else {
      var key = raw.replace(/^\.?\//, '').toLowerCase();
      try { key = decodeURI(key); } catch (e) { /* keep as is */ }
      url = DATA.images[key] || DATA.images['images/' + key] || null;
    }
    if (!url) return '<span class="img-missing">[Picture not found: ' + esc(raw) + ']</span>';
    return '<img src="' + esc(url) + '" alt="' + alt + '">';
  }

  function inline(s) {
    var t = esc(s);
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) { return imageHtml(alt, src); });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, txt, url) {
      return /^(https?:|mailto:)/i.test(url) ? '<a href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>' : txt;
    });
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>');
    t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
    return t;
  }

  var RE = {
    heading: /^(#{1,4})\s+(.*)$/,
    hr: /^\s*(-{3,}|\*{3,}|_{3,})\s*$/,
    quote: /^\s*>/,
    ul: /^\s*[-*+]\s+/,
    ol: /^\s*\d+[.)]\s+/,
    tick: /^\s*[✓✔✗✘]/,
    tableRow: /^\s*\|/,
    tableSep: /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
  };
  function startsBlock(line, next) {
    return RE.heading.test(line) || RE.hr.test(line) || RE.quote.test(line) || RE.ul.test(line) ||
      RE.ol.test(line) || RE.tick.test(line) || (RE.tableRow.test(line) && next != null && RE.tableSep.test(next));
  }

  function md(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, m;
    function listItems(re) {
      var items = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].replace(re, ''));
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i])) { items[items.length - 1] += '\n' + lines[i].trim(); i++; }
      }
      return items.map(function (t) { return '<li>' + t.split('\n').map(inline).join('<br>') + '</li>'; }).join('');
    }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      if ((m = line.match(RE.heading))) {
        var lv = Math.min(m[1].length + 1, 5);
        out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'); i++; continue;
      }
      if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }
      if (RE.quote.test(line)) {
        var q = [];
        while (i < lines.length && RE.quote.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + md(q.join('\n')) + '</blockquote>'); continue;
      }
      if (RE.tableRow.test(line) && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
        var row = function (l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };
        var head = row(line); i += 2; var body = [];
        while (i < lines.length && RE.tableRow.test(lines[i])) { body.push(row(lines[i])); i++; }
        out.push('<div class="table-wrap"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>');
        continue;
      }
      if (RE.ul.test(line)) { out.push('<ul>' + listItems(RE.ul) + '</ul>'); continue; }
      if (RE.ol.test(line)) { out.push('<ol>' + listItems(RE.ol) + '</ol>'); continue; }
      if (RE.tick.test(line)) {
        var good = /^\s*[✓✔]/.test(line);
        out.push('<p class="' + (good ? 'ex-good' : 'ex-bad') + '">' + inline(line.trim()) + '</p>'); i++; continue;
      }
      var buf = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !startsBlock(lines[i], lines[i + 1])) { buf.push(lines[i]); i++; }
      out.push('<p>' + buf.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  /* ---------------------------------------------------------------- parsing level files */

  var warnings = [];

  function parseFrontMatter(text) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var meta = {}, order = [], body = text;
    var m = text.match(/^\s*---[ \t]*\n([\s\S]*?)\n---[ \t]*(\n|$)/);
    if (m) {
      body = text.slice(m[0].length);
      m[1].split('\n').forEach(function (line) {
        var kv = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
        if (kv && kv[2].trim()) { meta[kv[1].trim().toLowerCase()] = kv[2].trim(); order.push([kv[1].trim(), kv[2].trim()]); }
      });
    }
    return { meta: meta, order: order, body: body };
  }

  var LESSON_HIDDEN = { title: 1, type: 1, level: 1, document: 1, pass: 1 };
  // Lines the game reads but doesn't print on the document. Start/Deadline/Fail are left over from the
  // old per-document clock; they're ignored, so older files still work.
  var PROOF_CONTROL = { deadline: 1, start: 1, penalty: 1, hint: 1, document: 1, intro: 1, success: 1, fail: 1, type: 1, title: 1 };

  function looksLikeTest(body) {
    return /^\s*(correct\s+)?answer\s*:/im.test(body) || /^\s*passage\s*:/im.test(body) || /^\s*options?\s*:/im.test(body);
  }

  function parseTest(body, warn) {
    var lines = body.split('\n'), intro = [], blocks = [], cur = null;
    lines.forEach(function (line) {
      var m = line.match(/^##\s+(.*)$/);
      if (m) { cur = { title: m[1].trim(), lines: [] }; blocks.push(cur); }
      else if (cur) cur.lines.push(line);
      else intro.push(line);
    });
    var items = [];
    blocks.forEach(function (b, n) {
      var w = function (s) { warn('block ' + (n + 1) + ' ("## ' + b.title + '"): ' + s); };
      var isProof = b.lines.some(function (l) { return /^\s*passage\s*:/i.test(l); });
      var it = isProof ? parseProof(b, w) : parseMC(b, w);
      if (it) items.push(it);
    });
    return { intro: intro.join('\n').trim(), items: items };
  }

  function splitInlineOptions(s) {
    var out = [], re = /([A-H])\)\s*([\s\S]*?)(?=\s*(?:[·•|]\s*)?[A-H]\)\s|$)/g, m;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      out.push({ letter: m[1], text: m[2].replace(/\s*[·•|]\s*$/, '').trim() });
    }
    return out;
  }

  function parseMC(b, warn) {
    var q = [], opts = [], fb = {}, answer = '', hint = '', explain = '', last = null, fbMode = false, started = false;
    b.lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, ''), m;
      if (!line.trim()) { if (!started) q.push(''); last = null; return; }
      if ((m = line.match(/^\s*options?\s*:\s*(.*)$/i))) {
        started = true; fbMode = false; last = null;
        splitInlineOptions(m[1]).forEach(function (o) { opts.push(o); });
        return;
      }
      if ((m = line.match(/^\s*(?:correct\s+)?answer\s*:\s*\(?([A-Ha-h])\b\)?/i))) { started = true; fbMode = false; last = null; answer = m[1].toUpperCase(); return; }
      if ((m = line.match(/^\s*feedback\s*\(?([A-H])\)?\s*:\s*(.*)$/i))) {
        started = true; fbMode = false;
        var L = m[1].toUpperCase(); fb[L] = m[2];
        last = function (v) { fb[L] += ' ' + v; }; return;
      }
      if (/^\s*feedback\s*:\s*$/i.test(line)) { started = true; fbMode = true; last = null; return; }
      if ((m = line.match(/^\s*hint\s*:\s*(.*)$/i))) { started = true; fbMode = false; hint = m[1]; last = function (v) { hint += ' ' + v; }; return; }
      if ((m = line.match(/^\s*(?:explain|explanation|why)\s*:\s*(.*)$/i))) { started = true; fbMode = false; explain = m[1]; last = function (v) { explain += '\n' + v; }; return; }
      if ((m = line.match(/^\s*([A-H])\)\s+(.*)$/))) {
        started = true;
        var letter = m[1];
        if (fbMode) { fb[letter] = m[2]; last = function (v) { fb[letter] += ' ' + v; }; }
        else { var o = { letter: letter, text: m[2] }; opts.push(o); last = function (v) { o.text += ' ' + v; }; }
        return;
      }
      if ((m = line.match(/^\s*question\s*:\s*(.*)$/i)) && !started) { q.push(m[1]); return; }
      if (!started) { q.push(line); return; }
      if (last) { last(line.trim()); return; }
      warn('didn\'t understand the line "' + line.trim() + '".');
    });

    if (!opts.length && !answer) {
      return { kind: 'note', title: b.title, body: b.lines.join('\n').trim() };
    }
    var letters = opts.map(function (o) { return o.letter; });
    if (opts.length < 2) warn('a question needs at least two options (lines like "A) less").');
    if (!answer) warn('no "Answer:" line, so the game can\'t tell which option is right.');
    else if (letters.indexOf(answer) < 0) warn('"Answer: ' + answer + '" but there is no option ' + answer + ').');
    letters.forEach(function (L, k) { if (letters.indexOf(L) !== k) warn('option ' + L + ') appears twice.'); });
    Object.keys(fb).forEach(function (L) { if (letters.indexOf(L) < 0) warn('"Feedback ' + L + '" but there is no option ' + L + ').'); });
    if (fb[answer]) {
      // Feedback for the right answer is treated as the explanation.
      if (!explain) explain = fb[answer];
      delete fb[answer];
    }
    return {
      kind: 'mc', title: b.title, question: q.join('\n').trim(), options: opts,
      answer: answer, feedback: fb, hint: hint.trim(), explain: explain.trim()
    };
  }

  function parseProof(b, warn) {
    var meta = {}, header = [], intro = [], passage = [], inPassage = false;
    b.lines.forEach(function (line) {
      if (inPassage) { passage.push(line); return; }
      var m = line.match(/^\s*passage\s*:\s*(.*)$/i);
      if (m) { inPassage = true; if (m[1].trim()) passage.push(m[1]); return; }
      // Header line = a short label (1-3 words), a colon, a space, then the value ("Re: Supply order").
      // A colon with no space after it (as in 9:40) doesn't count, so instructions with times stay instructions.
      m = line.match(/^\s*([A-Za-z][\w.'\/()-]*(?:[ \t][\w.'\/()-]+){0,2})[ \t]*:[ \t]+(.+)$/);
      if (m) {
        var k = m[1].trim().toLowerCase();
        meta[k] = m[2].trim();
        if (!PROOF_CONTROL[k]) header.push([m[1].trim(), m[2].trim()]);
        return;
      }
      if (line.trim()) intro.push(line);
    });
    if (meta.intro) intro.unshift(meta.intro);

    var errors = 0;
    function parseMark(inner) {
      var feedback = '', bar = inner.indexOf('|');
      if (bar >= 0) { feedback = inner.slice(bar + 1).trim(); inner = inner.slice(0, bar); }
      var arrow = inner.indexOf('=>');
      if (arrow < 0) {
        warn('the mark {' + inner + '} needs "=>" between the wrong words and the fix, like {less => fewer}.');
        return { t: 'text', s: inner };
      }
      var wrong = inner.slice(0, arrow).trim();
      var rights = inner.slice(arrow + 2).split('//').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!wrong) { warn('a mark has nothing before "=>". Mark the word next to the missing piece instead, like {Jordan => Jordan,}.'); return { t: 'text', s: '' }; }
      var trap = rights.length > 0 && rights.every(function (r) { return norm(r) === norm(wrong); });
      if (!trap) errors++;
      return { t: 'mark', wrong: wrong, rights: rights, del: rights.length === 0, feedback: feedback, trap: trap };
    }
    function parseLine(line) {
      var segs = [], last = 0, re = /\{([^{}]*)\}/g, m;
      while ((m = re.exec(line))) {
        if (m.index > last) segs.push({ t: 'text', s: line.slice(last, m.index) });
        segs.push(parseMark(m[1]));
        last = re.lastIndex;
      }
      if (last < line.length) segs.push({ t: 'text', s: line.slice(last) });
      return segs;
    }
    var text = passage.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
    if (/[{}]/.test(text.replace(/\{[^{}]*\}/g, ''))) warn('a curly bracket { or } isn\'t closed.');
    var paras = text ? text.split(/\n[ \t]*\n/).map(function (p) { return p.split('\n').map(parseLine); }) : [];
    if (!text) warn('"Passage:" is empty.');
    // A passage with no errors marked is a clean document: the right call is to stamp it APPROVED.

    var penalty = meta.penalty ? parseInt(meta.penalty, 10) : 10;
    if (isNaN(penalty) || penalty < 0) { warn('"Penalty:" should be a number of minutes, like 10.'); penalty = 10; }

    return {
      kind: 'proof', title: b.title, document: meta.document || 'Memo', header: header,
      intro: intro.join('\n'), hint: meta.hint || '', success: meta.success || '',
      paras: paras, errors: errors, penalty: penalty
    };
  }

  function buildGame() {
    var settings = { meta: {}, body: '' };
    var steps = [], seen = {};
    (DATA.files || []).forEach(function (f) {
      if (/^(game|settings)\.md$/i.test(f.name)) { settings = parseFrontMatter(f.text); return; }
      var m = f.name.match(/^(\d+)([A-Za-z]?)(.*?)\.md$/i);
      if (!m) { warnings.push(f.name + ': skipped. Level file names must start with a number and a letter, like "01A Fewer vs less.md".'); return; }
      var warn = function (s) { warnings.push(f.name + ': ' + s); };
      var fm = parseFrontMatter(f.text);
      var rest = m[3].replace(/^[\s\-–—_.]+/, '').trim();
      var id = m[1] + m[2].toUpperCase();
      if (seen[id]) { warn('another file also starts with "' + id + '" (' + seen[id] + '). Give each file its own number and letter.'); id = f.name; }
      seen[id] = f.name;
      var step = {
        id: id, num: parseInt(m[1], 10), letter: m[2].toUpperCase(), file: f.name, meta: fm.meta,
        title: fm.meta.title || rest || f.name.replace(/\.md$/i, ''),
        header: fm.order.filter(function (p) { return !LESSON_HIDDEN[p[0].toLowerCase()]; })
      };
      if (!fm.order.length) warn('no settings block at the top (the lines between two "---" lines). The game will use the file name as the title.');
      var type = (fm.meta.type || '').toLowerCase();
      if (type.indexOf('test') === 0 || (type.indexOf('lesson') !== 0 && looksLikeTest(fm.body))) {
        var t = parseTest(fm.body, warn);
        step.kind = 'test'; step.intro = t.intro; step.items = t.items;
        if (!t.items.length) warn('this test has no blocks. Each question or passage starts with a line like "## Question".');
        var pass = fm.meta.pass ? parseFloat(fm.meta.pass) : null;
        if (fm.meta.pass && (isNaN(pass) || pass < 0 || pass > 100)) { warn('"Pass:" should be a percentage, like 70%.'); pass = null; }
        step.pass = pass;
      } else {
        step.kind = 'lesson'; step.body = fm.body;
        if (!fm.body.trim()) warn('this lesson has no text after the settings block.');
      }
      steps.push(step);
    });
    steps.sort(function (a, b) { return a.num - b.num || a.letter.localeCompare(b.letter) || a.file.localeCompare(b.file); });
    return { settings: settings, steps: steps };
  }

  var GAME = buildGame();
  var S = GAME.settings.meta;
  var GAME_TITLE = S.title || 'Grammar Guide';
  var FIRM = S.firm || 'The Law Office';
  document.title = GAME_TITLE;
