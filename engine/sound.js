/* Tiny synthesized sound effects (no audio files). Muted state is saved with progress. */

  var Sound = (function () {
    var ctx = null, muted = false;
    function ac() {
      if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(a, freq, dur, type, vol, slideTo, delay) {
      var t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function noise(a, dur, vol, freq, delay) {
      var t0 = a.currentTime + (delay || 0), len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(a.destination); src.start(t0);
    }
    var FX = {
      stamp: function (a) { noise(a, 0.12, 0.6, 700); tone(a, 110, 0.18, 'sine', 0.5, 45); },
      paper: function (a) { noise(a, 0.22, 0.12, 3000); },
      right: function (a) { tone(a, 660, 0.08, 'square', 0.07); tone(a, 990, 0.14, 'square', 0.07, null, 0.08); },
      wrong: function (a) { tone(a, 200, 0.22, 'square', 0.07, 110); },
      coin: function (a) { tone(a, 988, 0.06, 'square', 0.06); tone(a, 1319, 0.16, 'square', 0.06, null, 0.06); },
      tick: function (a) { tone(a, 1800, 0.025, 'square', 0.03); },
      click: function (a) { tone(a, 520, 0.03, 'square', 0.04); },
      fired: function (a) { tone(a, 330, 0.25, 'square', 0.07, 220); tone(a, 220, 0.4, 'square', 0.07, 110, 0.25); },
      done: function (a) { [523, 659, 784, 1047].forEach(function (f, i) { tone(a, f, 0.14, 'square', 0.06, null, i * 0.1); }); }
    };
    return {
      play: function (name) { if (muted || !FX[name]) return; var a = ac(); if (a) FX[name](a); },
      setMuted: function (m) { muted = !!m; },
      isMuted: function () { return muted; }
    };
  })();
