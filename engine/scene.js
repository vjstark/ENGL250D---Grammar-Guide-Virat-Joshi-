/* Pixel-art office scene. Laid out on a 320 x 180 grid and drawn 3x (960 x 540), so text stays sharp.
   game.js changes SC (scene state); the scene redraws itself every frame from it. */

  var SC = {
    mode: 'title',          // 'title' = no top bar, 'office' = full desk
    dayText: '', time: null, hearts: 3, maxHearts: 3, pay: 0,
    inbox: 0, outbox: 0,
    stamps: 'off',          // 'off' | 'on' | 'return-only'
    press: { approve: -1e9, 'return': -1e9 },
    talkUntil: 0, muted: false
  };
  var PIX_FONT = '"Pixelify Sans", "Lucida Console", monospace';

  function startScene(canvas) {
    var x = canvas.getContext('2d');
    var K = '#3B2A2A';
    function R(a, b, w, h, c) { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), w, h); }
    // Box with outline, top-left highlight and bottom-right shadow.
    function B(a, b, w, h, base, lt, dk, ol) {
      R(a, b, w, h, ol || K); R(a + 1, b + 1, w - 2, h - 2, base);
      R(a + 1, b + 1, w - 2, 1, lt); R(a + 1, b + 1, 1, h - 2, lt);
      R(a + 1, b + h - 2, w - 2, 1, dk); R(a + w - 2, b + 1, 1, h - 2, dk);
    }
    function spr(rows, pal, ox, oy, s) {
      s = s || 1;
      rows.forEach(function (r, j) {
        for (var i = 0; i < r.length; i++) { var c = pal[r[i]]; if (c) R(ox + i * s, oy + j * s, Math.ceil(s), Math.ceil(s), c); }
      });
    }
    function T(t, a, b, c, sz, al, sh) {
      t = String(t).replace(/f(?=[filtj])/g, 'f‌');  // stop the font joining "fi" etc. into one odd-looking letter
      x.font = (sz || 7) + 'px ' + PIX_FONT; x.textAlign = al || 'left'; x.textBaseline = 'top';
      if (sh) { x.fillStyle = sh; x.fillText(t, a + 1, b + 1); }
      x.fillStyle = c; x.fillText(t, a, b);
    }
    function shadow(a, b, w, h) { R(a + 3, b + 3, w, h, 'rgba(60,30,10,0.16)'); }

    var BOSS = ['....kkkkkkkkkk......', '..kkhhhhhhhhhhkk....', '.khhHHHhhhhhhhhhk...', 'khhHHhhhhhhhhhhhhk..',
      'khhhhhhhhhhhhhhhhk..', 'khhsssssssssssshhk..', 'khsssssssssssssshk..', 'khsggggssssggggshk..',
      'khsgwegssssgwegshk..', 'khsggggssssggggshk..', 'khsbsssssSsssssbshk.', 'khSsssssssssssssShk.',
      '.khSssssmmmmsssShk..', '.khhSSssssssssShhk..', '..kkkSSSSSSSSkkk....', '.....kSSSSSSk.......',
      '..kkkJjjcccjjJkkk...', '.kJjjjjjcccjjjjjJk..', 'kJjjjjjjcccjjjjjjJk.', 'kJjjjjjjjcjjjjjjjJk.'];
    var BOSS_PAL = { k: K, h: '#6B4334', H: '#8A5A45', s: '#F7CFAE', S: '#E3A985', g: K, w: '#DFF3FF', e: K, m: '#C0504D', j: '#4C6FD1', J: '#3A55A8', c: '#FFFFFF', b: '#F4A3A3' };
    var HEART = ['.rr.rr.', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];

    function wall(t) {
      R(0, 0, 320, 180, '#FFE7CC');
      for (var j = 18; j < 72; j += 8) for (var i = (j / 8 % 2) * 8; i < 320; i += 16) R(i + 4, j, 1, 1, '#F6D3AE');
      R(0, 70, 320, 22, '#F2C79C');
      for (i = 4; i < 320; i += 40) { R(i, 74, 32, 14, '#E8B888'); R(i + 1, 75, 30, 1, '#F7D3AE'); }
      R(0, 92, 320, 3, '#D9A070'); R(0, 95, 320, 2, '#B9804F');
    }
    function windowAndLight(t) {
      B(6, 20, 54, 48, '#FFFFFF', '#FFFFFF', '#D9E7EE');
      R(10, 24, 46, 40, '#8FD3F4'); R(10, 24, 46, 10, '#A9DEF7'); R(10, 54, 46, 10, '#7CC6EC');
      var cx = (t / 140) % 60;
      R(10 + cx % 36, 29, 12, 4, '#FFFFFF'); R(13 + cx % 36, 26, 6, 3, '#FFFFFF');
      R(34, 46, 10, 3, '#FFFFFF'); R(37, 44, 5, 2, '#FFFFFF');
      R(32, 24, 3, 40, '#FFFFFF'); R(10, 42, 46, 3, '#FFFFFF');
      R(4, 67, 58, 4, '#E8B888'); R(4, 67, 58, 1, '#FFFFFF');
      x.save(); x.globalAlpha = 0.14; x.fillStyle = '#FFFFFF';
      x.beginPath(); x.moveTo(10, 68); x.lineTo(56, 68); x.lineTo(120, 180); x.lineTo(40, 180); x.closePath(); x.fill(); x.restore();
    }
    function boss(t) {
      B(64, 16, 38, 42, '#E0A35E', '#F4C489', '#B87A45');
      R(67, 19, 32, 36, '#CDEBF5'); R(67, 19, 32, 6, '#DDF2FA');
      var rows = BOSS.slice();
      if (Math.floor(t / 150) % 26 === 0) rows[8] = 'khsggggssssggggshk..';
      if (t < SC.talkUntil && Math.floor(t / 130) % 2 === 0) rows[12] = '.khSsssmkkkkmssShk..';
      spr(rows, BOSS_PAL, 68, 22, 1.5);
      B(96, 50, 4, 4, '#FFFFFF', '#FFFFFF', '#FFFFFF');
    }
    function corkboard() {
      B(122, 20, 120, 72, '#D9A15F', '#E6B576', '#C08443', '#8C5536');
      for (var i = 0; i < 40; i++) R(126 + (i * 37) % 112, 24 + (i * 23) % 64, 1, 1, '#C08443');
      shadow(130, 28, 34, 40); B(130, 28, 34, 40, '#FFFFFF', '#FFFFFF', '#E6E6E6');
      R(132, 30, 30, 8, '#E05A5A'); T('CALENDAR', 147, 31, '#FFFFFF', 6, 'center');
      for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++) R(133 + c * 6, 41 + r * 6, 4, 4, (r * 5 + c) % 7 === 3 ? '#FFE066' : '#EDE7DD');
      R(146, 26, 3, 3, '#E05A5A');
      shadow(172, 32, 30, 24); B(172, 32, 30, 24, '#FFE873', '#FFF4A8', '#E8C94F');
      R(176, 38, 20, 1, '#B9A04A'); R(176, 43, 16, 1, '#B9A04A'); R(176, 48, 18, 1, '#B9A04A'); R(186, 30, 3, 3, '#4C6FD1');
      shadow(208, 26, 26, 30); B(208, 26, 26, 30, '#FFFFFF', '#FFFFFF', '#E6E6E6'); R(211, 29, 20, 18, '#8FD3F4');
      R(211, 40, 20, 7, '#5BBF6A'); R(216, 33, 6, 6, '#FFE066'); R(219, 24, 3, 3, '#5BBF6A');
      shadow(176, 62, 52, 22); B(176, 62, 52, 22, '#FFFFFF', '#FFFFFF', '#E6E6E6');
      T('MISSION:', 180, 65, '#4C6FD1', 6); T('no typos', 180, 73, K, 6); R(200, 60, 3, 3, '#3FAF6B');
    }
    function shelf() {
      B(250, 18, 66, 76, '#B5714A', '#CC8A60', '#8C5536');
      R(254, 22, 58, 32, '#7A4730'); R(254, 58, 58, 32, '#7A4730'); R(254, 54, 58, 4, '#B5714A');
      var o = 0;
      [['#E8665A', 6, 24], ['#4FB3A9', 5, 22], ['#F2B33D', 7, 26], ['#7A8CE0', 5, 23], ['#E8665A', 4, 20], ['#5BBF6A', 6, 25], ['#F2B33D', 5, 22], ['#C27BD6', 6, 24], ['#7A8CE0', 5, 21]].forEach(function (b) {
        R(255 + o, 54 - b[2], b[1], b[2], b[0]); R(255 + o, 54 - b[2] + 4, b[1], 1, 'rgba(255,255,255,0.4)'); R(255 + o + b[1] - 1, 54 - b[2], 1, b[2], 'rgba(0,0,0,0.13)'); o += b[1] + 1;
      });
      o = 0;
      [['#7A8CE0', 7, 26], ['#F2B33D', 5, 22], ['#E8665A', 6, 24], ['#4FB3A9', 5, 20]].forEach(function (b) {
        R(255 + o, 88 - b[2], b[1], b[2], b[0]); R(255 + o, 88 - b[2] + 4, b[1], 1, 'rgba(255,255,255,0.4)'); o += b[1] + 1;
      });
      B(292, 76, 16, 12, '#E07B53', '#F29B76', '#B85E3C'); R(290, 74, 20, 3, '#C96A45');
      spr(['...g.....G..', '..gGg...gGg.', '.gGGg..gGGg.', 'gGGGgggGGGg.', '.gGGGgGGGg..', '..ggGGGGg...', '....gGGg....', '....gGg.....'],
        { g: '#3E9A52', G: '#6FD07E' }, 292, 59, 1.4);
    }
    function desk() {
      R(0, 97, 320, 83, '#DDA06A');
      for (var j = 99; j < 180; j += 17) R(0, j, 320, 1, '#C68A55');
      for (var i = 0; i < 14; i++) R((i * 53) % 300 + 8, 104 + (i * 29) % 70, 16 + (i % 3) * 6, 1, '#CC8F5B');
      x.save(); x.globalAlpha = 0.09; x.fillStyle = '#FFFFFF';
      x.beginPath(); x.moveTo(20, 97); x.lineTo(80, 97); x.lineTo(130, 180); x.lineTo(60, 180); x.closePath(); x.fill(); x.restore();
    }
    function tray(y, n, label) {
      shadow(6, y, 56, 34); B(6, y, 56, 34, '#B87A45', '#D1925E', '#8C5A34');
      var shown = Math.min(n, 5);
      for (var i = 0; i < shown; i++) {
        var off = (i * 7) % 3;
        B(11 + off, y + 15 - i * 2, 44, 14, '#FFF8E7', '#FFFFFF', '#E9DCC0');
        if (i === shown - 1) { R(16 + off, y + 19 - i * 2, 30, 1, '#B9BFCB'); R(16 + off, y + 23 - i * 2, 22, 1, '#B9BFCB'); }
      }
      B(14, y + 25, 40, 8, '#E8C77A', '#F6DFA3', '#C9A050');
      T(label + ' ' + n, 34, y + 25, '#6B4A3A', 6, 'center');
    }
    function mug(t) {
      shadow(70, 150, 20, 22); B(70, 150, 20, 22, '#5BA4E6', '#8CC4F2', '#3D80C2'); B(88, 155, 6, 11, '#5BA4E6', '#8CC4F2', '#3D80C2');
      R(72, 152, 16, 4, '#6B4A3A'); R(73, 152, 14, 1, '#8A6350');
      for (var s = 0; s < 3; s++) {
        var y = ((t / 45 + s * 9) % 24);
        x.globalAlpha = 1 - y / 24; R(74 + s * 5 + Math.sin(t / 300 + s) * 2, 146 - y, 2, 2, '#FFFFFF'); x.globalAlpha = 1;
      }
      for (var i = 0; i < 24; i++) R(92 + i, 178 - i * 0.5, 2, 2, i < 3 ? '#F4A3A3' : i < 20 ? '#F2B33D' : '#6B4A3A');
    }
    function stamp(ox, col, lt, dk, word, pressedAt, t, off) {
      var dy = t - pressedAt < 180 ? 5 : 0;
      shadow(ox, 126, 26, 10);
      B(ox + 7, 104 + dy, 12, 9, '#8C5A43', '#A87358', '#6B4232');
      B(ox + 10, 112 + dy, 6, 14, '#7A4E3A', '#946049', '#5E3A2B');
      B(ox, 125 + dy, 26, 11, col, lt, dk); R(ox + 1, 135 + dy, 24, 2, dk);
      B(ox - 3, 141, 32, 11, '#FFFFFF', '#FFFFFF', '#EDE7DD', col);
      T(word, ox + 13, 142, col, 6.5, 'center');
      if (off) { x.globalAlpha = 0.6; R(ox - 3, 102, 32, 51, '#F3D2AE'); x.globalAlpha = 1; }
    }
    function binder() {
      shadow(254, 156, 60, 20); B(254, 156, 60, 20, '#4C6FD1', '#7A8CE0', '#3A55A8');
      R(258, 159, 3, 14, '#AEB6C2'); R(258, 162, 3, 1, '#FFFFFF'); R(258, 168, 3, 1, '#FFFFFF');
      B(266, 160, 44, 11, '#FFF8E7', '#FFFFFF', '#E9DCC0'); T('RULEBOOK', 288, 161, '#3A55A8', 6.5, 'center');
    }
    function hud(t) {
      R(0, 0, 320, 15, '#4FB3A9'); R(0, 0, 320, 1, '#7FD1C8'); R(0, 14, 320, 1, '#3A9488');
      function panel(a, w) { B(a, 2, w, 11, '#3E9A90', '#3E9A90', '#3E9A90', '#3A9488'); }
      panel(3, 120); T(SC.dayText, 7, 3, '#FFFFFF', 7.5, 'left', '#2E7A72');
      panel(128, 58);
      R(132, 5, 6, 6, '#FFFFFF'); R(134, 6, 1, 3, '#3E9A90'); R(134, 8, 2, 1, '#3E9A90');
      var late = SC.time != null && SC.time >= 16 * 60 + 30;
      T(SC.time == null ? '--:--' : fmtTime(Math.floor(SC.time)), 141, 3, late && Math.floor(t / 400) % 2 ? '#FFE066' : '#FFFFFF', 7.5, 'left', '#2E7A72');
      for (var i = 0; i < SC.maxHearts; i++) {
        spr(HEART, i < SC.hearts ? { r: '#FF6B6B', R: '#FFB3B3' } : { r: '#2E7A72' }, 190 + i * 9, 4);
      }
      var pw = 46; panel(240, pw);
      R(244, 4, 7, 7, '#C98A1A'); R(245, 5, 5, 5, '#F2B33D'); R(246, 6, 2, 2, '#FFE066');
      T('$' + SC.pay, 254, 3, '#FFFFFF', 7.5, 'left', '#2E7A72');
      // sound and week buttons (the clickable parts are HTML buttons laid over these)
      B(290, 2, 13, 11, '#3E9A90', '#5FB8AE', '#3A9488', '#2E7A72');
      spr(['...w..', '..ww..', 'wwww..', 'wwww..', '..ww..', '...w..'], { w: '#FFFFFF' }, 292, 4);
      if (SC.muted) { R(299, 5, 1, 1, '#FFB3B3'); R(300, 6, 1, 1, '#FFB3B3'); R(301, 7, 1, 1, '#FFB3B3'); R(301, 5, 1, 1, '#FFB3B3'); R(299, 7, 1, 1, '#FFB3B3'); }
      else { R(299, 5, 1, 5, '#FFFFFF'); R(301, 4, 1, 7, '#FFFFFF'); }
      B(305, 2, 13, 11, '#3E9A90', '#5FB8AE', '#3A9488', '#2E7A72');
      R(308, 5, 7, 1, '#FFFFFF'); R(308, 7, 7, 1, '#FFFFFF'); R(308, 9, 7, 1, '#FFFFFF');
    }

    function draw(t) {
      x.setTransform(3, 0, 0, 3, 0, 0);  // draw at full size: shapes stay blocky, text stays sharp
      x.imageSmoothingEnabled = false;
      wall(t); windowAndLight(t); boss(t); corkboard(); shelf(); desk();
      if (SC.mode === 'office') {
        tray(100, SC.inbox, 'INBOX'); tray(138, SC.outbox, 'OUTBOX');
        stamp(258, '#3FAF6B', '#6FCB92', '#2E8A52', 'APPROVE', SC.press.approve, t, SC.stamps !== 'on');
        stamp(290, '#E05A5A', '#F08A8A', '#B94444', 'RETURN', SC.press['return'], t, SC.stamps === 'off');
        binder(); mug(t); hud(t);
      } else {
        tray(100, 3, 'INBOX'); tray(138, 0, 'OUTBOX'); mug(t);
        stamp(258, '#3FAF6B', '#6FCB92', '#2E8A52', 'APPROVE', -1e9, t, false);
        stamp(290, '#E05A5A', '#F08A8A', '#B94444', 'RETURN', -1e9, t, false);
        binder();
      }
    }
    function loop(t) { draw(t); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  }
