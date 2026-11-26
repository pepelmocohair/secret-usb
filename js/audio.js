// 音。音声ファイルは使わず、Web Audio でその場で作る（file:// でも鳴る）。
// ブラウザは、プレイヤーが一度クリックかキーを押すまで音を出させてくれない。
// なので最初の操作で音を起こし、それまでに頼まれた場面は覚えておいて、起きた瞬間に鳴らす。
//
// ゲームから使うのはこれだけ：
//   SOUND.scene("basement")   環境音の場面を切り替える
//                             silent / basement / ai / monitor / zero（zero は即座に完全な無音）
//   SOUND.theme("musicbox")   テーマ曲を1回流す。musicbox / eerie / cut / full
//                             cut は曲の cutoffBeat で切れる。{ onCut: 関数 } を渡すと、切れた瞬間に呼ぶ
//   SOUND.stopTheme()         テーマ曲を止める
//   SOUND.sfx("deny")         効果音。blip / select / deny / drawer / usb / glitch / flood / thump / steps / relay / fanstop
//   SOUND.tension(0.5)        低いうなりの強さ（0〜1）。地下室とAIの場面で効く
//   SOUND.toggleMute()        音あり／なし（M キーと画面右上のボタンでも切り替わる。設定は保存される）
var SOUND = (function () {
  "use strict";

  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, bus = {}, noise = {};
  var muted = false;
  try { muted = localStorage.getItem("secretusb.mute") === "1"; } catch (e) {}

  var sceneName = "silent";   // いま鳴らしたい場面（音が起きる前でも覚えておく）
  var built = null;           // 実際に組み立て済みの場面
  var layers = [], timers = [];
  var tensionLevel = 0, tensionNodes = [];
  var themeNow = null;
  var lastBlip = 0;

  // ---------- 小道具 ----------
  function quiet(p) { if (p && p.catch) p.catch(function () {}); }
  function now() { return ctx.currentTime; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function gain(v, dest) { var n = ctx.createGain(); n.gain.value = v; if (dest) n.connect(dest); return n; }
  function osc(type, f, dest) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (dest) o.connect(dest); return o; }
  function filt(type, f, q, dest) {
    var n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f;
    if (q != null) n.Q.value = q; if (dest) n.connect(dest); return n;
  }
  function noiseSrc(kind, dest) {
    var s = ctx.createBufferSource(); s.buffer = noise[kind]; s.loop = true;
    if (dest) s.connect(dest); return s;
  }
  // 0 から立ち上がって消える、1回きりの音量の山
  function env(node, t, peak, attack, release) {
    node.gain.setValueAtTime(0, t);
    node.gain.linearRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }
  function lfo(rate, depth, param) {
    var o = osc("sine", rate), d = gain(depth); o.connect(d); d.connect(param); return o;
  }

  function makeNoise() {
    var sr = ctx.sampleRate, len = sr * 4;
    var w = ctx.createBuffer(1, len, sr), b = ctx.createBuffer(1, len, sr);
    var wd = w.getChannelData(0), bd = b.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      wd[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * wd[i]) / 1.02;
      bd[i] = last * 3.5;
    }
    noise.white = w; noise.brown = b;
  }

  function setup(c) {
    ctx = c;
    master = gain(muted ? 0 : 1);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    bus.music = gain(0.6, master);
    bus.amb = gain(0.55, master);
    bus.sfx = gain(0.7, master);
    makeNoise();
  }

  // 最初の操作で音を起こす
  function unlock() {
    if (!AC) return;
    if (!ctx) { try { setup(new AC()); } catch (e) { AC = null; return; } }
    if (ctx.state === "suspended") quiet(ctx.resume());
    if (built !== sceneName) scene(sceneName);
  }
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) {
    document.addEventListener(ev, unlock, true);
  });
  // 別のタブを見ている間は止める
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    quiet(document.hidden ? ctx.suspend() : ctx.resume());
  });

  // ---------- 環境音 ----------
  function layer(level, fadeIn) {
    var L = { out: gain(0, bus.amb), src: [] };
    L.out.gain.setTargetAtTime(level, now(), fadeIn == null ? 0.6 : fadeIn);
    layers.push(L);
    return L;
  }
  function run(L, node) { node.start(); L.src.push(node); return node; }

  // 地下室の換気扇：低いゴーッという音と、羽根のばたつき
  function fan() {
    var L = layer(0.55);
    var body = gain(1, L.out);
    L.ctrl = body; fanLayer = L;
    run(L, noiseSrc("brown", filt("lowpass", 230, 0.7, gain(0.9, body))));
    var hum = filt("lowpass", 170, 1, gain(0.05, body));
    run(L, osc("sawtooth", 49, hum));
    run(L, osc("sawtooth", 98.7, hum));
    var flap = gain(0.04, body);
    run(L, noiseSrc("white", filt("bandpass", 650, 1.2, flap)));
    run(L, lfo(12.5, 0.035, flap.gain));
  }
  var fanLayer = null;

  // 天井ぎわの小窓から入る風
  function vent() {
    var L = layer(0.35);
    var g = gain(0.1, L.out);
    run(L, noiseSrc("white", filt("bandpass", 480, 0.6, g)));
    run(L, lfo(0.07, 0.07, g.gain));
  }

  // CRTのキーンという音と、ほこりっぽいノイズ
  function crt(level) {
    var L = layer(level == null ? 1 : level);
    run(L, osc("sine", Math.min(15734, ctx.sampleRate / 2 - 600), gain(0.004, L.out)));
    run(L, noiseSrc("white", filt("highpass", 6000, 0.7, gain(0.006, L.out))));
  }

  // 緊張したときだけ聞こえる、低いうなり（三全音でにごらせる）
  function dread(root) {
    var L = layer(1);
    var t = gain(tensionLevel * 0.5, L.out);
    tensionNodes.push(t);
    run(L, osc("sine", root, gain(0.5, t)));
    run(L, osc("sine", root * 1.012, gain(0.4, t)));
    var lp = filt("lowpass", 190, 2, gain(0.35, t));
    run(L, osc("sawtooth", root, lp));
    run(L, lfo(0.05, 90, lp.frequency));
    run(L, osc("sine", root * Math.SQRT2, gain(0.12, t)));
  }

  // ネットワークの暗い空間：深いドローンと、ささやくような風
  function voidDrone(level) {
    var L = layer(level == null ? 0.7 : level, 1.5);
    run(L, osc("sine", 65.4, gain(0.22, L.out)));
    run(L, osc("sine", 65.9, gain(0.2, L.out)));
    var lp = filt("lowpass", 400, 3, gain(0.12, L.out));
    run(L, osc("sawtooth", 130.8, lp));
    run(L, osc("sawtooth", 131.5, lp));
    run(L, lfo(0.03, 260, lp.frequency));
    var breath = gain(0.05, L.out);
    run(L, noiseSrc("white", filt("bandpass", 1300, 9, breath)));
    run(L, lfo(0.11, 0.05, breath.gain));
    var glass = gain(0.008, L.out);
    run(L, osc("sine", 1046.5 * 1.003, glass));
    run(L, lfo(0.4, 0.008, glass.gain));
  }

  // 監視モニター：電源のジーという音と、時計のような規則正しいカチ
  function monitor() {
    var L = layer(0.6);
    run(L, osc("square", 60, filt("lowpass", 280, 1, gain(0.05, L.out))));
    timers.push(setInterval(function () { click(now(), 0.12, 3500); }, 1000));
  }

  // ときどき起きること（地下室だけ）
  function basementEvents() {
    function next() {
      timers.push(setTimeout(function () {
        var r = Math.random();
        if (r < 0.5) fanStop(); else if (r < 0.8) steps(); else relay();
        next();
      }, rnd(35000, 80000)));
    }
    next();
  }

  var SCENES = {
    silent: [],
    zero: [],
    basement: [fan, vent, function () { crt(1); }, function () { dread(55); }, basementEvents],
    ai: [function () { voidDrone(0.7); }, function () { dread(41.2); }],
    monitor: [monitor, function () { crt(0.6); }, function () { voidDrone(0.35); }]
  };

  function teardown(fade) {
    var t = now();
    layers.forEach(function (L) {
      L.out.gain.cancelScheduledValues(t);
      L.out.gain.setValueAtTime(L.out.gain.value, t);
      L.out.gain.linearRampToValueAtTime(0, t + fade);
      L.src.forEach(function (s) { try { s.stop(t + fade + 0.05); } catch (e) {} });
    });
    layers = []; tensionNodes = []; fanLayer = null;
    timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
    timers = [];
  }

  function scene(name, fade) {
    if (!SCENES[name]) return;
    sceneName = name;
    if (!ctx) return; // 音が起きたら unlock() が組み立てる
    built = name;
    var t = now();
    if (name === "zero") {
      // 0 bytes：一瞬で、全部消す
      teardown(0.015);
      stopTheme(0.015);
      bus.sfx.gain.cancelScheduledValues(t);
      bus.sfx.gain.setValueAtTime(bus.sfx.gain.value, t);
      bus.sfx.gain.linearRampToValueAtTime(0, t + 0.015);
      return;
    }
    teardown(fade == null ? 0.8 : fade);
    bus.sfx.gain.cancelScheduledValues(t);
    bus.sfx.gain.setTargetAtTime(0.7, t, 0.05);
    SCENES[name].forEach(function (fn) { fn(); });
  }

  function tension(v) {
    tensionLevel = Math.max(0, Math.min(1, v));
    if (!ctx) return;
    tensionNodes.forEach(function (n) { n.gain.setTargetAtTime(tensionLevel * 0.5, now(), 1.2); });
  }

  // ---------- 効果音 ----------
  function click(t, vol, hp) {
    var g = gain(0, bus.sfx), s = noiseSrc("white", filt("highpass", hp || 2500, 0.7, g));
    env(g, t, vol, 0.001, 0.01);
    s.start(t, Math.random() * 3); s.stop(t + 0.03);
  }

  function thump(t, vol) {
    var g = gain(0, filt("lowpass", 260, 0.7, bus.sfx));
    var o = osc("sine", 75, g);
    o.frequency.setValueAtTime(75, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.25);
    env(g, t, vol, 0.005, 0.3);
    o.start(t); o.stop(t + 0.4);
    var ng = gain(0, filt("lowpass", 180, 0.7, bus.sfx)), n = noiseSrc("brown", ng);
    env(ng, t, vol * 0.8, 0.003, 0.12);
    n.start(t, Math.random() * 3); n.stop(t + 0.2);
  }

  // 上の階を誰かが歩く
  function steps() {
    var t = now() + 0.05, k = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < k; i++) thump(t + i * rnd(0.5, 0.65), 0.22);
  }

  // サーバーラックのリレーが勝手に鳴る
  function relay() {
    var t = now() + 0.05, k = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < k; i++) click(t + i * rnd(0.07, 0.2), 0.1, 1800);
  }

  // 換気扇が、ふっと止まる。止まっている間がいちばん静か
  function fanStop() {
    if (!fanLayer) return;
    var p = fanLayer.ctrl.gain, t = now();
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(0, t + 0.5);
    p.setValueAtTime(0, t + 3.2);
    p.linearRampToValueAtTime(1, t + 5.5);
  }

  function blip() {
    var t = now();
    if (t - lastBlip < 0.045) return;
    lastBlip = t;
    var g = gain(0, filt("lowpass", 3000, 0.7, bus.sfx));
    var o = osc("triangle", rnd(1180, 1280), g);
    env(g, t, 0.05, 0.002, 0.03);
    o.start(t); o.stop(t + 0.05);
  }

  function select() {
    var t = now(), g = gain(0, filt("lowpass", 2600, 0.7, bus.sfx));
    var o = osc("square", 660, g);
    o.frequency.setValueAtTime(990, t + 0.05);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.005);
    g.gain.setValueAtTime(0.05, t + 0.09);
    g.gain.linearRampToValueAtTime(0, t + 0.11);
    o.start(t); o.stop(t + 0.12);
  }

  // 却下：低いブザー
  function deny() {
    var t = now(), g = gain(0, filt("lowpass", 700, 1, bus.sfx));
    [98, 103.8].forEach(function (f) {
      var o = osc("sawtooth", f, g);
      o.frequency.setValueAtTime(f, t + 0.2);
      o.frequency.linearRampToValueAtTime(f * 0.94, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.01);
    g.gain.setValueAtTime(0.28, t + 0.32);
    g.gain.linearRampToValueAtTime(0, t + 0.5);
  }

  function drawer() {
    var t = now(), g = gain(0, bus.sfx), bp = filt("bandpass", 300, 3, g);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.linearRampToValueAtTime(900, t + 0.35);
    var n = noiseSrc("white", bp);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.05);
    g.gain.linearRampToValueAtTime(0, t + 0.36);
    n.start(t); n.stop(t + 0.4);
    thump(t + 0.38, 0.35);
  }

  function usb() {
    var t = now();
    click(t, 0.4, 2000); click(t + 0.06, 0.3, 2000);
    var g = gain(0, bus.sfx), o = osc("sine", 220, g);
    o.frequency.setValueAtTime(220, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    env(g, t + 0.15, 0.25, 0.005, 0.25);
    o.start(t + 0.15); o.stop(t + 0.5);
    // 何かが、読み込まれはじめる
    var g2 = gain(0, filt("lowpass", 3000, 4, bus.sfx)), o2 = osc("square", 300, g2);
    o2.frequency.setValueAtTime(300, t + 0.35);
    o2.frequency.exponentialRampToValueAtTime(2400, t + 1.2);
    g2.gain.setValueAtTime(0, t + 0.35);
    g2.gain.linearRampToValueAtTime(0.04, t + 0.5);
    g2.gain.linearRampToValueAtTime(0, t + 1.25);
    o2.start(t + 0.35); o2.stop(t + 1.3);
  }

  // 画面が割れる音：細切れの電子音とノイズが、だんだん詰まっていく
  function glitch(dur) {
    dur = dur || 1.6;
    var t0 = now(), t = t0;
    while (t < t0 + dur) {
      var p = (t - t0) / dur, len = rnd(0.03, 0.09) * (1 - p * 0.6), r = Math.random();
      if (r < 0.45) {
        var g = gain(0, bus.sfx), o = osc(Math.random() < 0.5 ? "square" : "sawtooth", rnd(80, 2200), g);
        g.gain.setValueAtTime(0.1, t); g.gain.setValueAtTime(0, t + len);
        o.start(t); o.stop(t + len + 0.01);
      } else if (r < 0.8) {
        var ng = gain(0, filt(Math.random() < 0.5 ? "highpass" : "bandpass", rnd(400, 5000), 1, bus.sfx));
        var n = noiseSrc("white", ng);
        ng.gain.setValueAtTime(0.25, t); ng.gain.setValueAtTime(0, t + len);
        n.start(t, Math.random() * 3); n.stop(t + len + 0.01);
      }
      t += len;
    }
  }

  // 欲望データの津波：せり上がるノイズと、無数の小さなデータ音
  function flood(dur) {
    dur = dur || 2.6;
    var t = now(), g = gain(0, bus.sfx), bp = filt("bandpass", 200, 2, g);
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(4000, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + dur);
    var n = noiseSrc("white", bp); n.start(t); n.stop(t + dur + 0.05);
    var rg = gain(0, filt("lowpass", 120, 1, bus.sfx)), ro = osc("sawtooth", 41, rg);
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.35, t + dur);
    ro.start(t); ro.stop(t + dur + 0.05);
    for (var i = 0; i < 70; i++) {
      var bt = t + Math.pow(Math.random(), 0.6) * dur;
      var bg = gain(0, bus.sfx), bo = osc("sine", rnd(1500, 5200), bg);
      env(bg, bt, 0.035, 0.002, 0.05);
      bo.start(bt); bo.stop(bt + 0.08);
    }
  }

  // 暗号通信端末の呼び出し音：小さめの2音の電子音
  function call() {
    var t = now();
    [0, 0.14].forEach(function (off, k) {
      var g = gain(0, filt("lowpass", 2800, 0.7, bus.sfx));
      var o = osc("sine", k ? 1320 : 880, g);
      env(g, t + off, 0.08, 0.005, 0.1);
      o.start(t + off); o.stop(t + off + 0.12);
    });
  }

  var SFX = {
    blip: blip, select: select, deny: deny, drawer: drawer, usb: usb,
    glitch: glitch, flood: flood, steps: steps, relay: relay, fanstop: fanStop,
    call: call,
    thump: function () { thump(now() + 0.01, 0.5); }
  };
  function sfx(name, arg) {
    if (!ctx || ctx.state !== "running" || !SFX[name]) return;
    if (name === "blip" && !api.typeBlips) return;
    SFX[name](arg);
  }

  // ---------- テーマ曲 ----------
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function currentSong() {
    if (typeof THEMES === "undefined") return null;
    return THEMES[typeof THEME_PICK !== "undefined" ? THEME_PICK : "GLASS"] || null;
  }

  // オルゴールの1音：すぐ消える正弦波と、金属っぽい倍音
  function vBox(t, f, det, vol, out) {
    var g = gain(0, out), o = osc("sine", f, g);
    o.detune.value = det;
    env(g, t, vol, 0.004, 1.8);
    o.start(t); o.stop(t + 1.9);
    var g2 = gain(0, out), o2 = osc("sine", f * 4, g2);
    o2.detune.value = det;
    env(g2, t, vol * 0.22, 0.002, 0.22);
    o2.start(t); o2.stop(t + 0.3);
    var g3 = gain(0, out), o3 = osc("sine", f * 6.6, g3);
    env(g3, t, vol * 0.06, 0.002, 0.08);
    o3.start(t); o3.stop(t + 0.12);
  }

  // 不気味版の1音：にごった低いノコギリ波が、ゆっくり出てきて、最後に沈む
  function vEerie(t, f, dur, out) {
    var g = gain(0, out), lp = filt("lowpass", 300, 2, g);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(950, t + 0.4);
    lp.frequency.linearRampToValueAtTime(420, t + dur);
    [-9, 9].forEach(function (d) {
      var o = osc("sawtooth", f, lp);
      o.detune.value = d;
      o.frequency.setValueAtTime(f, t + dur * 0.6);
      o.frequency.linearRampToValueAtTime(f * 0.97, t + dur + 0.8);
      o.start(t); o.stop(t + dur + 1.3);
    });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.085, t + 0.35);
    g.gain.setValueAtTime(0.085, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 1.2);
    // 三全音下の影
    var sg = gain(0, out), so = osc("sine", f / Math.SQRT2, sg);
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.06, t + 0.5);
    sg.gain.linearRampToValueAtTime(0, t + dur + 1);
    so.start(t); so.stop(t + dur + 1.1);
  }

  // 完奏版の主旋律：三角波に少し矩形波を混ぜ、のばすとビブラートがかかる
  function vLead(t, f, dur, out) {
    var g = gain(0, out), lp = filt("lowpass", 2400, 0.7, g);
    var a = osc("triangle", f, lp), b = osc("square", f, gain(0.12, lp));
    var vib = osc("sine", 5.5), vd = gain(0);
    vib.connect(vd); vd.connect(a.frequency); vd.connect(b.frequency);
    vd.gain.setValueAtTime(0, t);
    vd.gain.linearRampToValueAtTime(0, t + 0.25);
    vd.gain.linearRampToValueAtTime(f * 0.006, t + 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.linearRampToValueAtTime(0.11, t + 0.2);
    g.gain.setValueAtTime(0.11, t + dur * 0.92);
    g.gain.linearRampToValueAtTime(0, t + dur * 0.92 + 0.12);
    [a, b, vib].forEach(function (o) { o.start(t); o.stop(t + dur + 0.2); });
  }

  function vPad(t, notes, dur, out, vol) {
    var g = gain(0, filt("lowpass", 1500, 0.7, out));
    notes.forEach(function (m) { var o = osc("triangle", hz(m), g); o.start(t); o.stop(t + dur + 0.6); });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.15);
    g.gain.setValueAtTime(vol, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.5);
  }

  function vBass(t, m, dur, out) {
    var g = gain(0, out), o = osc("triangle", hz(m), g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.06, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.start(t); o.stop(t + dur + 0.1);
  }

  function stopTheme(fade) {
    if (!themeNow) return;
    var th = themeNow; themeNow = null;
    th.timers.forEach(clearTimeout);
    if (!ctx) return;
    var t = now(), f = fade == null ? 0.4 : fade;
    th.out.gain.cancelScheduledValues(t);
    th.out.gain.setValueAtTime(th.out.gain.value, t);
    th.out.gain.linearRampToValueAtTime(0, t + f);
    setTimeout(function () { th.out.disconnect(); }, (f + 0.1) * 1000);
  }

  // style: musicbox（地下室・壊れたオルゴール） / eerie（クロードの場面・低くゆっくり）
  //        cut（cutoffBeat で詰まって切れて 0 bytes） / full（青空・全部の音がそろって最後まで）
  // 戻り値：鳴り終わるまでの秒数（cut は切れるまでの秒数）
  function theme(style, opts) {
    opts = opts || {};
    var song = opts.song || currentSong();
    if (!ctx || !song || sceneName === "zero") return 0;
    stopTheme(0.3);
    var th = { out: gain(1, bus.music), timers: [] };
    themeNow = th;
    var out = th.out, spb = 60 / song.bpm, bpb = song.beatsPerBar;
    var mel = song.melody, harp = song.harp || [], chords = song.chords || [];
    var total = song.totalBeats || (mel[mel.length - 1][0] + mel[mel.length - 1][1]);
    var warped = song.warpedIndices || [];
    var t0 = now() + 0.15, i;

    if (style === "musicbox") {
      // 後半になるほど、ゼンマイが切れて遅くなり、音程が下がっていく
      var h = total / 2;
      var at = function (b) {
        if (b <= h) return t0 + b * spb;
        return t0 + spb * (b + 0.45 * (b - h) * (b - h) / (2 * h));
      };
      var lateOf = function (b) { return Math.max(0, (b - h) / h); };
      for (i = 0; i < mel.length; i++) {
        var b = mel[i][0], late = lateOf(b);
        if (late > 0.5 && Math.random() < 0.12) continue; // 歯が欠けて、音が抜ける
        var det = rnd(-8, 8) - late * 65 + (warped.indexOf(i) >= 0 ? -42 : 0);
        vBox(at(b), hz(midi(mel[i][2])), det, 0.22, out);
      }
      // 伴奏は小節の頭の1音だけ、低く小さく
      for (i = 0; i < harp.length; i++) {
        if (harp[i][0] % bpb !== 0) continue;
        if (lateOf(harp[i][0]) > 0.5 && Math.random() < 0.12) continue;
        vBox(at(harp[i][0]), hz(midi(harp[i][2])), rnd(-8, 8) - lateOf(harp[i][0]) * 65, 0.09, out);
      }
      return at(total) + 1.8 - now();
    }

    if (style === "eerie") {
      var slow = spb * 1.8, end = t0 + total * slow;
      var dg = gain(0, out), d = hz(midi(song.drone));
      var dl = filt("lowpass", 160, 1, dg);
      var d1 = osc("sawtooth", d, dl), d2 = osc("sine", d * 1.006, dg);
      d1.start(t0); d2.start(t0); d1.stop(end + 3.2); d2.stop(end + 3.2);
      dg.gain.setValueAtTime(0, t0);
      dg.gain.linearRampToValueAtTime(0.15, t0 + 3);
      dg.gain.setValueAtTime(0.15, end);
      dg.gain.linearRampToValueAtTime(0, end + 3);
      for (i = 0; i < mel.length; i++) {
        vEerie(t0 + mel[i][0] * slow, hz(midi(mel[i][2]) - 24), mel[i][1] * slow, out);
      }
      return end + 3 - now();
    }

    if (style === "cut") {
      var cutB = opts.cutoffBeat || song.cutoffBeat || total * 0.6, lastN = null;
      for (i = 0; i < mel.length && mel[i][0] < cutB; i++) {
        vBox(t0 + mel[i][0] * spb, hz(midi(mel[i][2])), rnd(-6, 6), 0.22, out);
        lastN = mel[i][2];
      }
      for (i = 0; i < harp.length && harp[i][0] < cutB; i++) {
        if (harp[i][0] % bpb === 0) vBox(t0 + harp[i][0] * spb, hz(midi(harp[i][2])), rnd(-6, 6), 0.09, out);
      }
      // 同じ音が引っかかって、詰まって、消える
      var t = t0 + cutB * spb, f = hz(midi(lastN));
      [0.16, 0.12, 0.09, 0.06, 0.045, 0.03, 0.02].forEach(function (gp, k) {
        var g = gain(0, out), o = osc(k < 2 ? "sine" : "square", f * (1 - k * 0.04), g);
        g.gain.setValueAtTime(0.18, t); g.gain.setValueAtTime(0, t + gp * 0.8);
        o.start(t); o.stop(t + gp);
        t += gp;
      });
      var ng = gain(0, out), n = noiseSrc("white", ng);
      ng.gain.setValueAtTime(0.2, t); ng.gain.setValueAtTime(0, t + 0.04);
      n.start(t); n.stop(t + 0.05);
      t += 0.04;
      // 鳴り残っているオルゴールの余韻も、ここで断ち切る
      out.gain.setValueAtTime(1, t);
      out.gain.linearRampToValueAtTime(0, t + 0.01);
      if (opts.onCut) th.timers.push(setTimeout(opts.onCut, (t - now()) * 1000));
      return t - now();
    }

    if (style === "full") {
      // 和音をのばし、一番下の音をベースに、ハープの分散和音を全部、旋律は2つの音色で重ねる
      for (i = 0; i < chords.length; i++) {
        var cb = t0 + chords[i][0] * spb, cl = chords[i][1] * spb, last = i === chords.length - 1;
        var ms = chords[i][2].map(midi);
        vPad(cb, ms, last ? cl + 2.5 : cl * 0.95, out, 0.03);
        vBass(cb, Math.min.apply(null, ms) - 12, last ? cl + 2 : spb * 0.9, out);
      }
      for (i = 0; i < harp.length; i++) {
        vBox(t0 + harp[i][0] * spb, hz(midi(harp[i][2])), 0, 0.1, out);
      }
      for (i = 0; i < mel.length; i++) {
        var lb = t0 + mel[i][0] * spb, ll = mel[i][1] * spb, m0 = midi(mel[i][2]);
        vLead(lb, hz(m0), i === mel.length - 1 ? ll + 2 : ll, out);
        vBox(lb, hz(m0 + 12), 0, 0.07, out);
      }
      return t0 + total * spb + 3 - now();
    }
    return 0;
  }

  // ---------- 音あり／なし ----------
  var btn = null;
  function setMuted(v) {
    muted = v;
    try { localStorage.setItem("secretusb.mute", v ? "1" : "0"); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(v ? 0 : 1, now(), 0.05);
    if (btn) btn.textContent = label();
  }
  function label() {
    var T = typeof TEXTS !== "undefined" ? TEXTS : {};
    return muted ? (T.soundOff || "♪ OFF") : (T.soundOn || "♪ ON");
  }
  function toggleMute() { setMuted(!muted); return muted; }

  document.addEventListener("keydown", function (e) {
    if (e.key === "m" || e.key === "M") toggleMute();
  });
  var screenEl = document.getElementById("screen");
  if (screenEl) {
    btn = document.createElement("button");
    btn.id = "sound-toggle";
    btn.type = "button";
    btn.textContent = label();
    btn.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    btn.addEventListener("click", function () { toggleMute(); btn.blur(); });
    screenEl.appendChild(btn);
  }

  var api = {
    scene: scene, theme: theme, stopTheme: stopTheme, sfx: sfx, tension: tension,
    toggleMute: toggleMute, isMuted: function () { return muted; },
    typeBlips: true, // 文字送りのピッという音。うるさければ false
    _setup: setup     // テスト用：OfflineAudioContext を差し込む
  };
  return api;
})();
