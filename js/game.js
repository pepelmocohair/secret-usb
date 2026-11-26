// ゲーム本体。file:// で動くよう、モジュールも fetch も使わない。
(function () {
  "use strict";

  var TILE = 16, COLS = 20, ROWS = 15;
  var STEP_MS = 140; // 1マス歩く時間

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var dialogEl = document.getElementById("dialog");
  var textEl = document.getElementById("dialog-text");
  var choicesEl = document.getElementById("dialog-choices");
  var nextEl = document.getElementById("dialog-next");
  var overlayEl = document.getElementById("overlay");

  // マップの形が崩れていたら、すぐ気づけるようにする
  BASEMENT_MAP.forEach(function (row, i) {
    if (row.length !== COLS) console.error("マップ " + i + " 行目の長さが " + row.length + " です（20のはず）");
  });

  var map = BASEMENT_MAP;
  var SOLID = "#pwRLCDbSKEToB";

  var state = {
    mode: "scene", // scene | walk | dialog | ending
    tx: PLAYER_START.x, ty: PLAYER_START.y, dir: PLAYER_START.dir,
    fromX: PLAYER_START.x, fromY: PLAYER_START.y, moveStart: 0, moving: false,
    hasUSB: false,
    hasBeer: false,
    crtOn: false,
    tRinging: false,
    tAnswered: false,
    aiOnline: false,
    drawerStep: 0,
    looked: {},
    lookCount: 0,
    ch2: null,
    seen: {}, // 調べた回数
    endingStart: 0,
    endingPhase: 0,
    scene: { kind: "ch1", i: 0, scene: "title", who: null, lit: null, phase: 0, level: 0, panel: null, heart: false, gemiDark: false, sat: false }
  };

  // スチル画像（なければノイズで代用）
  var waveImg = new Image();
  var waveReady = false;
  waveImg.onload = function () { waveReady = true; };
  waveImg.src = "img/stills/wave.png";

  // ---------- 入力 ----------
  var held = {};
  var KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right",
    z: "act", Z: "act", Enter: "act", " ": "act"
  };

  document.addEventListener("keydown", function (e) {
    var k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (e.repeat && k === "act") return;
    press(k);
  });
  document.addEventListener("keyup", function (e) {
    var k = KEYMAP[e.key];
    if (k) held[k] = false;
  });

  document.querySelectorAll("#pad button").forEach(function (btn) {
    var k = btn.getAttribute("data-key");
    btn.addEventListener("pointerdown", function (e) { e.preventDefault(); press(k); });
    btn.addEventListener("pointerup", function () { held[k] = false; });
    btn.addEventListener("pointerleave", function () { held[k] = false; });
  });
  dialogEl.addEventListener("pointerdown", function (e) {
    if (choicesEl.contains(e.target)) return;
    press("act");
  });
  canvas.addEventListener("pointerdown", function (e) {
    if (state.mode === "scene" || state.mode === "dialog") {
      e.preventDefault();
      press("act");
    }
  });

  function press(k) {
    if (k !== "act") held[k] = true;
    if (state.mode === "dialog" || state.mode === "scene") dialogInput(k);
    else if (state.mode === "walk" && k === "act") check();
  }

  // ---------- 歩く ----------
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function tileAt(x, y) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return "#";
    return map[y].charAt(x);
  }

  function tryMove(now) {
    if (state.moving || state.mode !== "walk") return;
    var order = ["up", "down", "left", "right"];
    for (var i = 0; i < order.length; i++) {
      var d = order[i];
      if (!held[d]) continue;
      state.dir = d;
      var nx = state.tx + DIRS[d][0], ny = state.ty + DIRS[d][1];
      if (SOLID.indexOf(tileAt(nx, ny)) === -1) {
        state.fromX = state.tx; state.fromY = state.ty;
        state.tx = nx; state.ty = ny;
        state.moveStart = now; state.moving = true;
      }
      return;
    }
  }

  // ---------- 調べる ----------
  function nextText(key) {
    var list = TEXTS[key];
    var n = state.seen[key] || 0;
    state.seen[key] = n + 1;
    return list[n % list.length];
  }

  var LOOK_KEYS = { R: 1, b: 1, L: 1, o: 1, B: 1, C: 1 };

  function check() {
    if (state.moving) return;
    var fx = state.tx + DIRS[state.dir][0], fy = state.ty + DIRS[state.dir][1];
    var t = tileAt(fx, fy);

    if (state.ch2 === "walkD" && LOOK_KEYS[t]) {
      if (t === "R") SOUND.sfx("relay");
      var pages = TEXTS["look_" + t].split("|");
      if (!state.looked[t]) {
        state.looked[t] = true;
        state.lookCount++;
        if (state.lookCount === 2) pages.push({ who: "chappy", text: TEXTS.look_aside_chappy });
        else if (state.lookCount === 3) pages.push({ who: "gemi", text: TEXTS.look_aside_gemi });
      }
      openDialog(pages, state.lookCount >= 4 ? startCh2Life : null);
      return;
    }

    if (t === "T") {
      if (state.ch2 === "walkA") startCh2Call();
      else say(nextText(state.tAnswered ? "T_after" : "T_before"));
    } else if (t === "C") {
      if (state.ch2 === "walkB") {
        SOUND.sfx("relay");
        state.crtOn = true;
        say(TEXTS.C_boot, startCh2Meeting);
      } else if (state.ch2 === "walkF" || state.hasUSB) {
        askUSB();
      } else {
        say(nextText(state.crtOn ? "C_on" : "C_off"));
      }
    } else if (t === "K") {
      if (state.ch2 === "walkC") {
        state.hasBeer = true;
        say(TEXTS.K_takeBeer, startCh2Beer);
      } else {
        say(nextText(state.hasBeer ? "K_afterBeer" : "K"));
      }
    } else if (t === "D") {
      if (state.ch2 === "walkE") {
        if (state.drawerStep === 0) {
          state.drawerStep = 1;
          SOUND.sfx("drawer");
          say(TEXTS.D_hesitate);
        } else if (state.drawerStep === 1) {
          SOUND.sfx("drawer");
          say(TEXTS.D_open, openDrawerMenu);
        } else {
          say(nextText("D_after"));
        }
      } else if (state.hasUSB) {
        say(nextText("D_after"));
      } else {
        say(nextText("D_before"));
      }
    } else if (t === "b") {
      say(nextText(state.hasBeer ? "b_beer" : "b"));
    } else if (TEXTS[t]) {
      if (t === "R") SOUND.sfx("relay");
      say(nextText(t));
    }
  }

  function openDrawerMenu() {
    openDialog([{
      text: TEXTS.D_menu_q,
      choices: [
        { label: CH2_UI.drawerPhoto, action: function () { say(nextText("D_photo"), openDrawerMenu); } },
        { label: CH2_UI.drawerCable, action: function () { say(nextText("D_cable"), openDrawerMenu); } },
        {
          label: CH2_UI.drawerUsb,
          action: function () {
            state.drawerStep = 2;
            state.hasUSB = true;
            SOUND.tension(0.25);
            say(TEXTS.D_usb, startCh2Usb);
          }
        }
      ]
    }]);
  }

  function askUSB() {
    openDialog([
      TEXTS.C_withUSB_intro,
      {
        text: TEXTS.C_withUSB_question,
        onShow: function () { SOUND.tension(0.6); },
        choices: [
          { label: CH2_UI.yes, action: function () { SOUND.sfx("usb"); startCh2Baka(); } },
          { label: CH2_UI.no, action: function () { SOUND.tension(0.25); say(nextText("C_no")); } }
        ]
      }
    ]);
  }

  // ---------- セリフ ----------
  var dlg = { pages: [], i: 0, shown: 0, full: "", bodyEl: null, choices: null, choiceSel: 0, onDone: null, timer: null };

  function say(str, onDone) { openDialog(str.split("|"), onDone); }

  function openDialog(pages, onDone) {
    if (state.mode !== "scene") state.mode = "dialog";
    dlg.pages = pages; dlg.i = 0; dlg.onDone = onDone || null;
    dialogEl.classList.remove("hidden");
    showPage();
  }

  function showPage() {
    var p = dlg.pages[dlg.i];
    var page = typeof p === "string" ? { text: p } : p;
    if (page.onShow) page.onShow();
    dlg.full = page.text; dlg.shown = 0; dlg.choices = page.choices || null; dlg.choiceSel = 0;
    textEl.innerHTML = "";
    textEl.classList.toggle("gold", !!page.gold);
    if (page.who && SPEAKERS[page.who]) {
      var sp = document.createElement("span");
      sp.style.color = SPEAKERS[page.who].color;
      sp.textContent = SPEAKERS[page.who].name + "：";
      textEl.appendChild(sp);
    }
    dlg.bodyEl = document.createElement("span");
    textEl.appendChild(dlg.bodyEl);
    choicesEl.innerHTML = "";
    nextEl.classList.add("off");
    clearInterval(dlg.timer);
    dlg.timer = setInterval(function () {
      dlg.shown++;
      var ch = dlg.full.charAt(dlg.shown - 1);
      if (ch && !/\s/.test(ch)) SOUND.sfx("blip");
      dlg.bodyEl.textContent = dlg.full.slice(0, dlg.shown);
      if (dlg.shown >= dlg.full.length) finishTyping();
    }, 35);
  }

  function finishTyping() {
    clearInterval(dlg.timer);
    dlg.shown = dlg.full.length;
    if (dlg.bodyEl) dlg.bodyEl.textContent = dlg.full;
    if (dlg.choices) renderChoices();
    else nextEl.classList.remove("off");
  }

  function renderChoices() {
    choicesEl.innerHTML = "";
    dlg.choices.forEach(function (c, i) {
      var el = document.createElement("div");
      el.textContent = c.label;
      if (i === dlg.choiceSel) el.className = "sel";
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault(); dlg.choiceSel = i; pickChoice();
      });
      choicesEl.appendChild(el);
    });
  }

  function pickChoice() {
    var c = dlg.choices[dlg.choiceSel];
    SOUND.sfx("select");
    closeDialog();
    c.action();
  }

  function dialogInput(k) {
    if (dlg.shown < dlg.full.length) { if (k === "act") finishTyping(); return; }
    if (dlg.choices) {
      if (k === "up") dlg.choiceSel = (dlg.choiceSel + dlg.choices.length - 1) % dlg.choices.length;
      else if (k === "down") dlg.choiceSel = (dlg.choiceSel + 1) % dlg.choices.length;
      else if (k === "act") { pickChoice(); return; }
      renderChoices();
      return;
    }
    if (k !== "act") return;
    dlg.i++;
    if (dlg.i < dlg.pages.length) showPage();
    else {
      var done = dlg.onDone;
      closeDialog();
      if (done) done();
    }
  }

  function closeDialog() {
    clearInterval(dlg.timer);
    dialogEl.classList.add("hidden");
    if (state.mode === "dialog") state.mode = "walk";
    held = {};
  }

  // ---------- シーン再生（第1章・第2章共通） ----------
  var sceneRunner = { steps: null, onStep: null, onDone: null };

  function applySceneState(step, idx) {
    if (idx != null) state.scene.i = idx;
    if (step.scene != null) state.scene.scene = step.scene;
    state.scene.who = step.who || null;
    state.scene.lit = step.lit != null ? step.lit : null;
    if (step.phase != null) state.scene.phase = step.phase;
    if (step.level != null) state.scene.level = step.level;
    if (step.panel !== undefined) state.scene.panel = step.panel;
    state.scene.heart = !!step.heart;
    state.scene.gemiDark = !!step.gemiDark;
    if (step.sat !== undefined) state.scene.sat = !!step.sat;
  }

  function runInlineSteps(lines, onDone) {
    var i = 0;
    function next() {
      if (i >= lines.length) { onDone(); return; }
      var line = lines[i++];
      applySceneState(line, null);
      if (sceneRunner.onStep) sceneRunner.onStep(line, null);
      openDialog([{ text: line.text, who: line.who, gold: line.gold }], next);
    }
    next();
  }

  function runScene(steps, opts) {
    opts = opts || {};
    state.mode = "scene";
    state.scene.kind = opts.kind || "ch1";
    state.scene.panel = opts.panel !== undefined ? opts.panel : null;
    state.scene.sat = !!opts.sat;
    state.scene.phase = 0;
    state.scene.level = 0;
    sceneRunner.steps = steps;
    sceneRunner.onStep = opts.onStep || null;
    sceneRunner.onDone = opts.onDone || null;
    showSceneStep(opts.startIdx || 0);
  }

  function showSceneStep(idx) {
    if (idx >= sceneRunner.steps.length) {
      if (sceneRunner.onDone) sceneRunner.onDone();
      return;
    }
    var step = sceneRunner.steps[idx];
    applySceneState(step, idx);
    if (sceneRunner.onStep) sceneRunner.onStep(step, idx);

    var pages = [];
    if (step.ask) {
      pages.push({ text: step.text, who: step.who, gold: step.gold });
      pages.push({
        text: step.ask.q,
        choices: [
          { label: PROLOGUE_UI.yes, action: function () { showSceneStep(idx + 1); } },
          {
            label: PROLOGUE_UI.no,
            action: function () {
              SOUND.sfx("deny");
              openDialog([{ text: step.ask.no }], function () {
                showSceneStep(idx + 1);
              });
            }
          }
        ]
      });
      openDialog(pages);
    } else if (step.choice) {
      var opts = step.choice.options.map(function (opt) {
        return {
          label: opt.label,
          action: function () {
            var nextIdx = idx + 1 + (opt.skip || 0);
            if (opt.lines && opt.lines.length) runInlineSteps(opt.lines, function () { showSceneStep(nextIdx); });
            else showSceneStep(nextIdx);
          }
        };
      });
      if (step.choice.q) {
        pages.push({ text: step.text, who: step.who, gold: step.gold });
        pages.push({ text: step.choice.q, who: step.choice.who, choices: opts });
      } else {
        pages.push({ text: step.text, who: step.who, gold: step.gold, choices: opts });
      }
      openDialog(pages);
    } else {
      pages.push({ text: step.text, who: step.who, gold: step.gold });
      openDialog(pages, function () { showSceneStep(idx + 1); });
    }
  }

  // ---------- 第1章（プロローグ） ----------
  var PROLOGUE_SEEN_KEY = "secretusb.prologueSeen";
  var PROLOGUE_TENSION = [0.15, 0.3, 0.45, 0.6, 0.8, 1.0];
  var prologueAudio = null;
  var pendingMusicbox = false;

  ["pointerdown", "keydown", "touchend"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (!pendingMusicbox) return;
      pendingMusicbox = false;
      if (state.mode === "walk" || state.mode === "dialog" || (state.mode === "scene" && state.scene.kind === "ch2" && state.scene.scene !== "black")) {
        SOUND.theme("musicbox");
      }
    });
  });

  function hasSeenPrologue() {
    try { return localStorage.getItem(PROLOGUE_SEEN_KEY) === "1"; }
    catch (e) { return false; }
  }

  function markPrologueSeen() {
    try { localStorage.setItem(PROLOGUE_SEEN_KEY, "1"); }
    catch (e) {}
  }

  function syncPrologueAudio(step) {
    var target = (step.scene === "signal" || step.scene === "hospital" || step.scene === "transfer")
      ? "monitor"
      : step.scene === "black" ? "silent" : "ai";
    if (target !== prologueAudio) {
      prologueAudio = target;
      if (target === "silent") {
        SOUND.stopTheme(2);
        SOUND.scene("silent", 2);
      } else {
        SOUND.scene(target);
      }
    }
    if (step.scene === "takeover" && step.level >= 1 && step.level <= 6) {
      if (step.level === 1) SOUND.theme("eerie");
      SOUND.sfx("thump");
      SOUND.tension(PROLOGUE_TENSION[step.level - 1]);
    }
  }

  // ---------- 第2章「馬鹿」 ----------
  var ringDelay = null, ringInterval = null;

  function stopRinging() {
    clearTimeout(ringDelay); ringDelay = null;
    clearInterval(ringInterval); ringInterval = null;
    state.tRinging = false;
  }

  function resetCh2State() {
    stopRinging();
    state.tx = PLAYER_START.x; state.ty = PLAYER_START.y;
    state.fromX = PLAYER_START.x; state.fromY = PLAYER_START.y;
    state.dir = PLAYER_START.dir; state.moving = false;
    state.hasUSB = false;
    state.hasBeer = false;
    state.crtOn = false;
    state.tAnswered = false;
    state.aiOnline = false;
    state.drawerStep = 0;
    state.looked = {};
    state.lookCount = 0;
  }

  function startBasementAudio() {
    prologueAudio = null;
    SOUND.scene("basement");
    SOUND.tension(0);
    if (!SOUND.theme("musicbox")) pendingMusicbox = true;
  }

  function syncCh2Audio(step) {
    if (step.audio === "basement") startBasementAudio();
    if (step.tension != null) SOUND.tension(step.tension);
  }

  function startCh2() {
    resetCh2State();
    state.ch2 = "intro";
    state.crtOn = true;
    runScene(CH2_SCENES.intro, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: enterWalkA
    });
  }

  function enterWalkA() {
    closeDialog();
    state.mode = "walk";
    state.ch2 = "walkA";
    state.crtOn = false;
    stopRinging();
    ringDelay = setTimeout(function () {
      if (state.ch2 !== "walkA") return;
      state.tRinging = true;
      if (state.mode === "walk") SOUND.sfx("call");
      ringInterval = setInterval(function () {
        if (state.ch2 !== "walkA") { stopRinging(); return; }
        if (state.mode === "walk") SOUND.sfx("call");
      }, 4200);
    }, 3500);
  }

  function startCh2Call() {
    stopRinging();
    state.tAnswered = true;
    state.ch2 = "call";
    runScene(CH2_SCENES.call, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: enterWalkB
    });
  }

  function enterWalkB() {
    closeDialog();
    state.mode = "walk";
    state.ch2 = "walkB";
  }

  function startCh2Meeting() {
    state.ch2 = "meeting";
    state.crtOn = true;
    state.aiOnline = true;
    runScene(CH2_SCENES.meeting, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: enterWalkC
    });
  }

  function enterWalkC() {
    closeDialog();
    state.mode = "walk";
    state.ch2 = "walkC";
  }

  function startCh2Beer() {
    state.ch2 = "beer";
    runScene(CH2_SCENES.beer, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: enterWalkD
    });
  }

  function enterWalkD() {
    closeDialog();
    state.mode = "walk";
    state.ch2 = "walkD";
    state.looked = {};
    state.lookCount = 0;
  }

  function startCh2Life() {
    state.ch2 = "life";
    runScene(CH2_SCENES.life, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: enterWalkE
    });
  }

  function enterWalkE() {
    closeDialog();
    state.mode = "walk";
    state.ch2 = "walkE";
  }

  function startCh2Usb() {
    state.ch2 = "usb";
    runScene(CH2_SCENES.usb, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: enterWalkF
    });
  }

  function enterWalkF() {
    closeDialog();
    state.mode = "walk";
    state.ch2 = "walkF";
  }

  function startCh2Baka() {
    state.ch2 = "baka";
    runScene(CH2_SCENES.baka, {
      kind: "ch2",
      onStep: syncCh2Audio,
      onDone: startEnding
    });
  }

  function enterBasement() {
    startCh2();
  }

  function startPrologue(startIdx) {
    stopRinging();
    prologueAudio = null;
    SOUND.tension(0);
    runScene(PROLOGUE, {
      kind: "ch1",
      startIdx: startIdx || 0,
      onStep: syncPrologueAudio,
      onDone: finishPrologue
    });
  }

  function finishPrologue() {
    markPrologueSeen();
    startCh2();
  }

  function enterFromHash() {
    var h = location.hash;
    if (h === "#skip") {
      startCh2();
      return true;
    }
    if (h === "#ch2-meeting") {
      resetCh2State();
      state.crtOn = true;
      state.tAnswered = true;
      startBasementAudio();
      startCh2Meeting();
      return true;
    }
    if (h === "#ch2-drawer") {
      resetCh2State();
      state.crtOn = true;
      state.tAnswered = true;
      state.aiOnline = true;
      state.hasBeer = true;
      startBasementAudio();
      enterWalkE();
      return true;
    }
    return false;
  }

  function initStart() {
    if (enterFromHash()) return;
    if (hasSeenPrologue()) {
      state.mode = "scene";
      state.scene.kind = "ch1";
      state.scene.scene = "title";
      openDialog([{
        text: PROLOGUE_UI.skipPrompt,
        choices: [
          { label: PROLOGUE_UI.fromCh1, action: function () { startPrologue(1); } },
          { label: PROLOGUE_UI.fromCh2, action: startCh2 }
        ]
      }]);
      return;
    }
    startPrologue(0);
  }

  // ---------- 描画 ----------
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function drawTile(t, x, y, now) {
    var X = x * TILE, Y = y * TILE;
    switch (t) {
      case "#":
        rect(X, Y, TILE, TILE, "#3b3530");
        rect(X, Y + 7, TILE, 1, "#2c2723");
        rect(X + ((y % 2) ? 4 : 10), Y, 1, 7, "#2c2723");
        rect(X + ((y % 2) ? 10 : 4), Y + 8, 1, 8, "#2c2723");
        break;
      case "p":
        drawTile("#", x, y, now);
        rect(X + 3, Y + 2, 10, 12, "#8a6f52");
        rect(X + 5, Y + 4, 6, 4, "#5d4a37");
        rect(X + 5, Y + 10, 6, 1, "#5d4a37");
        break;
      case "w":
        drawTile("#", x, y, now);
        rect(X + 2, Y + 3, 12, 8, "#4b5a66");
        rect(X + 2, Y + 3, 12, 1, "#6f8494");
        rect(X + 7, Y + 3, 1, 8, "#3b3530");
        break;
      case "R":
        rect(X + 1, Y, 14, TILE, "#18181c");
        rect(X + 2, Y + 2, 12, 3, "#2b2b31");
        rect(X + 2, Y + 7, 12, 3, "#2b2b31");
        rect(X + 2, Y + 12, 12, 3, "#2b2b31");
        if (x === 1 && y === 1) rect(X + 12, Y + 3, 1, 1, (Math.floor(now / 600) % 2) ? "#3dff7a" : "#126b30");
        break;
      case "L":
        rect(X, Y + 2, TILE, 1, "#777");
        rect(X + 2, Y + 3, 5, 7, (x + y) % 2 ? "#8c8c96" : "#6d7a8c");
        rect(X + 9, Y + 3, 5, 9, (x + y) % 2 ? "#5c6b5a" : "#9a8c78");
        break;
      case "C":
        rect(X, Y + 6, TILE, 10, "#4a3a2c");
        rect(X, Y + 6, TILE, 2, "#5e4a38");
        if (map[y].charAt(x - 1) !== "C") {
          rect(X + 2, Y - 6, 26, 14, "#c9c0a8");
          rect(X + 4, Y - 4, 22, 10, "#081208");
          if (state.crtOn) {
            rect(X + 6, Y - 2, 8, 1, "#3dff7a");
            rect(X + 6, Y + 1, 12, 1, "#3dff7a");
            var blink = state.ch2 === "walkF" ? 300 : 500;
            if (Math.floor(now / blink) % 2) rect(X + 6, Y + 3, 3, 2, "#3dff7a");
          } else if (state.ch2 === "walkB" && Math.floor(now / 450) % 2) {
            rect(X + 6, Y + 3, 2, 2, "#3dff7a");
          }
          if (state.ch2 === "walkD" && !state.looked.C && Math.floor(now / 550) % 2) {
            rect(X + 23, Y - 3, 2, 2, "#7dffa0");
          }
        }
        break;
      case "T":
        rect(X, Y + 6, TILE, 10, "#4a3a2c");
        rect(X, Y + 6, TILE, 2, "#5e4a38");
        // 暗号通信端末（アンテナ付きの小さな箱）
        rect(X + 12, Y - 4, 1, 6, "#888e96");
        rect(X + 2, Y + 1, 12, 9, "#2d333b");
        rect(X + 3, Y + 2, 10, 6, state.tRinging && (Math.floor(now / 320) % 2) ? "#295848" : "#0b1316");
        // 画面隅の金色の目マーク（CRTではなく暗号通信端末側）
        rect(X + 10, Y + 3, 2, 2, (Math.floor(now / 900) % 2) ? "#e6b422" : "#5a4410");
        if (state.tRinging && (Math.floor(now / 320) % 2)) {
          rect(X + 4, Y + 4, 5, 1, "#7dffa0");
          rect(X + 4, Y + 6, 3, 1, "#7dffa0");
        }
        break;
      case "D":
        rect(X, Y + 4, TILE, 12, "#4a3a2c");
        rect(X, Y + 4, TILE, 2, "#5e4a38");
        rect(X + 3, Y + 9, 10, 5, "#3a2d22");
        rect(X + 7, Y + 11, 2, 1, (state.ch2 === "walkE" && Math.floor(now / 500) % 2) ? "#ffe07a" : "#a89a7a");
        break;
      case "b":
        rect(X + 4, Y + 6, 3, 8, "#2f5a33");
        rect(X + 5, Y + 3, 1, 3, "#2f5a33");
        rect(X + 9, Y + 8, 3, 6, "#6b4a1e");
        rect(X + 10, Y + 6, 1, 2, "#6b4a1e");
        if (state.ch2 === "walkD" && !state.looked.b && Math.floor(now / 550) % 2) {
          rect(X + 11, Y + 5, 2, 1, "#e8e6df");
        }
        break;
      case "o":
        // 床に落ちた靴下
        rect(X + 4, Y + 9, 6, 3, "#9a9da6");
        rect(X + 8, Y + 7, 3, 4, "#b2b5be");
        rect(X + 8, Y + 7, 3, 1, "#6f737d");
        if (state.ch2 === "walkD" && !state.looked.o && Math.floor(now / 550) % 2) {
          rect(X + 10, Y + 6, 2, 1, "#e8e6df");
        }
        break;
      case "B":
        // 封の切られていない請求書
        rect(X + 3, Y + 7, 10, 6, "#d4cfc2");
        rect(X + 4, Y + 6, 10, 6, "#e8e3d5");
        rect(X + 6, Y + 8, 5, 1, "#6b6e75");
        rect(X + 11, Y + 7, 2, 2, "#c84b4b");
        if (state.ch2 === "walkD" && !state.looked.B && Math.floor(now / 550) % 2) {
          rect(X + 5, Y + 5, 2, 1, "#fff");
        }
        break;
      case "S":
        rect(X, Y + 3, TILE, 12, "#5a2f2f");
        rect(X, Y + 3, TILE, 4, "#6e3a3a");
        if (map[y].charAt(x + 1) === "S" && map[y].charAt(x - 1) === "S") rect(X + 6, Y + 9, 4, 3, "#4a2626");
        break;
      case "K":
        rect(X + 2, Y - 8, 12, 24, "#bfc3c6");
        rect(X + 2, Y - 1, 12, 1, "#8d9194");
        rect(X + 11, Y - 5, 1, 3, "#666");
        rect(X + 11, Y + 3, 1, 4, (state.ch2 === "walkC" && Math.floor(now / 450) % 2) ? "#7dffa0" : "#666");
        break;
      case "E":
        for (var i = 0; i < 4; i++) rect(X, Y + i * 4, TILE, 3, ["#3a3a40", "#46464d", "#53535b", "#606068"][i]);
        break;
    }
  }

  function drawPlayerAt(X, Y, dir) {
    rect(X + 3, Y + 14, 10, 2, "rgba(0,0,0,.35)");       // 影
    rect(X + 4, Y + 11, 3, 4, "#2b3040");                  // 足
    rect(X + 9, Y + 11, 3, 4, "#2b3040");
    rect(X + 3, Y + 6, 10, 6, "#8a8a8a");                  // 灰色のTシャツ
    rect(X + 4, Y + 1, 8, 6, "#d8b48c");                   // 顔
    rect(X + 4, Y, 8, 2, "#2a2a2a");                       // 髪
    rect(X + 6, Y, 1, 1, "#777");                          // 白髪
    if (dir === "down") {
      rect(X + 5, Y + 3, 1, 1, "#111"); rect(X + 10, Y + 3, 1, 1, "#111");
      rect(X + 5, Y + 5, 6, 2, "#6b5a48");                 // 無精ひげ
    } else if (dir === "up") {
      rect(X + 4, Y + 1, 8, 4, "#2a2a2a");
    } else {
      var ex = dir === "left" ? X + 5 : X + 10;
      rect(ex, Y + 3, 1, 1, "#111");
      rect(dir === "left" ? X + 4 : X + 8, Y + 5, 4, 2, "#6b5a48");
    }
  }

  function drawPlayer(now, sitting) {
    if (sitting) {
      var sx = 54, sy = 76;
      // 椅子
      rect(sx + 2, sy + 11, 12, 5, "#30323a");
      rect(sx + 4, sy + 15, 8, 2, "#1c1e24");
      var typing = state.mode === "scene" && state.scene.scene === "room_sit" && (Math.floor(now / 180) % 2);
      drawPlayerAt(sx, sy - (typing ? 1 : 0), "up");
      return;
    }
    var t = state.moving ? Math.min(1, (now - state.moveStart) / STEP_MS) : 1;
    var px = (state.fromX + (state.tx - state.fromX) * t) * TILE;
    var py = (state.fromY + (state.ty - state.fromY) * t) * TILE;
    var bob = state.moving && t < 0.5 ? 1 : 0;
    drawPlayerAt(Math.round(px), Math.round(py) - bob, state.dir);
  }

  function drawRoom(now, sitting) {
    var x, y;
    // 先に床を全部敷いてから、家具を上に描く（家具がマスをはみ出しても消えないように）
    for (y = 0; y < ROWS; y++)
      for (x = 0; x < COLS; x++) {
        rect(x * TILE, y * TILE, TILE, TILE, (x + y) % 2 ? "#26262b" : "#232328");
        if ((x * 7 + y * 13) % 11 === 0) rect(x * TILE + 5, y * TILE + 9, 2, 1, "#303036");
      }
    for (y = 0; y < ROWS; y++)
      for (x = 0; x < COLS; x++) {
        var ch = map[y].charAt(x);
        drawTile(ch, x, y, now);
        if (state.ch2 === "walkD" && (ch === "R" || ch === "L") && !state.looked[ch] && ((ch === "R" && x === 1 && y === 2) || (ch === "L" && x === 17 && y === 2))) {
          if (Math.floor(now / 550) % 2) rect(x * TILE + 7, y * TILE + 4, 2, 2, "#e8e6df");
        }
      }
    drawPlayer(now, sitting);
    // CRTの光がにじむ暗い部屋
    var v = ctx.createRadialGradient(160, 120, 60, 160, 120, 230);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, 320, 240);
    if (state.crtOn) {
      var g = ctx.createRadialGradient(64, 62, 4, 64, 62, 70);
      g.addColorStop(0, "rgba(60,255,120,0.10)");
      g.addColorStop(1, "rgba(60,255,120,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 240);
    }
    if (!sitting && state.mode !== "scene" && state.aiOnline) {
      drawCallPanel(now, "ai", true);
    }
  }

  // ---------- 第2章の終わり ----------
  function startEnding() {
    stopRinging();
    state.mode = "ending";
    state.ch2 = "end";
    state.endingStart = performance.now();
    state.endingPhase = 0;
  }

  function drawEnding(now) {
    var t = now - state.endingStart;
    // CRTのアップ（黒地に緑の文字でマウント表示 → 静かに暗転 → 「つづく。」）
    rect(0, 0, 320, 240, "#141311");
    rect(18, 16, 284, 208, "#b8b09a");
    rect(24, 22, 272, 196, "#8c8470");
    rect(30, 28, 260, 184, "#061008");
    for (var sy = 32; sy < 210; sy += 4) rect(30, sy, 260, 1, "rgba(0,0,0,0.22)");

    ctx.font = "11px monospace";
    ctx.textBaseline = "middle";
    if (t >= 200) {
      ctx.fillStyle = "#3dff7a";
      ctx.fillText(TEXTS.endMountCmd, 44, 64);
    }
    if (t >= 1100) {
      ctx.fillStyle = "#7dffa0";
      ctx.fillText(TEXTS.endMountOk, 44, 88);
    }
    if (t >= 1400 && t < 1850) {
      rect(44, 108, 7, 11, "#ff3d7f");
    } else if (t >= 200 && t < 1100 && (Math.floor(t / 300) % 2)) {
      rect(176, 58, 6, 11, "#3dff7a");
    }

    if (t >= 2200) {
      if (state.endingPhase === 0) {
        state.endingPhase = 1;
        SOUND.stopTheme(1.5);
        SOUND.scene("silent", 1.5);
      }
      var alpha = Math.min(1, (t - 2200) / 1600);
      rect(0, 0, 320, 240, "rgba(0,0,0," + alpha.toFixed(3) + ")");
    }
    if (t >= 3900 && overlayEl.classList.contains("hidden")) showEnd();
  }

  // スチルは縦横比を保ったまま画面に収め、余白は黒で埋める
  function drawStill(img) {
    rect(0, 0, 320, 240, "#000");
    var k = Math.min(320 / img.naturalWidth, 240 / img.naturalHeight);
    var w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, (320 - w) / 2, (240 - h) / 2, w, h);
    ctx.imageSmoothingEnabled = false;
  }

  function drawFakeWave(t) {
    rect(0, 0, 320, 240, "#0b0b12");
    for (var i = 0; i < 260; i++) {
      var s = 2 + ((i * 37) % 9);
      var x = (i * 53 + t * 0.15) % 340 - 10;
      var y = 240 - ((i * 29) % 240) * Math.min(1, (t - 1600) / 1500);
      rect(x, y, s, s, ["#ff3d7f", "#3dff7a", "#3dc8ff", "#e6b422", "#b07dff"][i % 5]);
    }
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#000";
    rect(110, 104, 100, 18, "#fff");
    ctx.fillStyle = "#000";
    ctx.textBaseline = "middle";
    ctx.fillText("CENSORED", 135, 113);
  }

  function showEnd() {
    overlayEl.innerHTML = "";
    var a = document.createElement("div"); a.textContent = TEXTS.endTitle;
    var b = document.createElement("div"); b.textContent = TEXTS.endSub;
    overlayEl.appendChild(a); overlayEl.appendChild(b);
    if (TIP_URL) overlayEl.appendChild(tipLink(TEXTS.tipEnd));
    overlayEl.classList.remove("hidden");
  }

  function tipLink(label) {
    var link = document.createElement("a"); link.href = TIP_URL; link.target = "_blank";
    link.rel = "noopener"; link.textContent = label;
    return link;
  }

  // 画面の下にも、小さく投げ銭リンクを置く（TIP_URL が空なら出さない）
  var tipEl = document.getElementById("tip");
  if (tipEl && TIP_URL) { tipEl.appendChild(tipLink(TEXTS.tipFooter)); tipEl.classList.remove("hidden"); }

  // ---------- 第1章の描画 ----------
  function aiLevel(id) {
    if (id === "gemi" && state.scene.gemiDark) return 0;
    if (state.scene.who) return state.scene.who === id ? 2 : 0;
    if (state.scene.lit) return state.scene.lit.indexOf(id) !== -1 ? 2 : 0;
    return 1;
  }

  function drawChappy(cx, cy, lvl, now) {
    var y = cy + Math.round(Math.sin(now / 650) * 2);
    var line = lvl === 2 ? "#3dc8ff" : lvl === 1 ? "#22789c" : "#133445";
    var hi = lvl === 2 ? "#b0efff" : lvl === 1 ? "#3dc8ff" : "#1b4a61";
    // 探偵帽（つばとクラウン）
    rect(cx - 10, y - 34, 20, 1, hi);
    rect(cx - 11, y - 33, 1, 9, line); rect(cx + 10, y - 33, 1, 9, line);
    rect(cx - 10, y - 26, 20, 1, line);
    rect(cx - 19, y - 24, 38, 1, hi);
    rect(cx - 17, y - 22, 34, 1, line);
    // 頭（ワイヤーフレーム）
    rect(cx - 8, y - 22, 1, 15, line); rect(cx + 7, y - 22, 1, 15, line);
    rect(cx - 6, y - 7, 12, 1, line);
    rect(cx, y - 21, 1, 14, lvl === 2 ? "#1e6a8c" : "#0e2938");
    rect(cx - 7, y - 13, 14, 1, lvl === 2 ? "#1e6a8c" : "#0e2938");
    rect(cx - 5, y - 16, 2, 2, hi); rect(cx + 3, y - 16, 2, 2, hi);
    // 襟とコートの肩（ワイヤーフレーム）
    rect(cx - 7, y - 5, 1, 6, hi); rect(cx + 6, y - 5, 1, 6, hi);
    rect(cx - 6, y - 5, 4, 1, line); rect(cx + 2, y - 5, 4, 1, line);
    rect(cx - 19, y + 1, 38, 1, hi);
    rect(cx - 19, y + 2, 1, 32, line); rect(cx + 18, y + 2, 1, 32, line);
    rect(cx - 19, y + 34, 38, 1, line);
    // ラペルと内部メッシュ線
    rect(cx - 6, y + 1, 1, 33, line); rect(cx + 5, y + 1, 1, 33, line);
    rect(cx - 18, y + 11, 36, 1, lvl === 2 ? "#1e6a8c" : "#0e2938");
    rect(cx - 18, y + 22, 36, 1, lvl === 2 ? "#1e6a8c" : "#0e2938");
    rect(cx - 12, y + 2, 1, 32, lvl === 2 ? "#1e6a8c" : "#0e2938");
    rect(cx + 11, y + 2, 1, 32, lvl === 2 ? "#1e6a8c" : "#0e2938");
  }

  function drawKurodoEye(cx, cy, lvl, now) {
    var y = cy + Math.round(Math.sin(now / 820 + 1) * 1.5);
    var b = now % 4600;
    var open = b > 4350 ? Math.abs(((b - 4350) / 250) * 2 - 1) : 1;
    var rim = lvl === 2 ? "#e6b422" : lvl === 1 ? "#9c7718" : "#3d2f0c";
    var hi = lvl === 2 ? "#ffe68a" : lvl === 1 ? "#d4a62a" : "#574414";
    var iris = lvl === 2 ? "#b88410" : lvl === 1 ? "#6b500c" : "#261d06";
    var core = lvl === 2 ? "#fff7d6" : lvl === 1 ? "#d9c17a" : "#574414";
    var hw = 28;
    var hh = Math.max(1, Math.round(14 * open));

    if (lvl === 2) {
      rect(cx - 34, y, 4, 1, hi); rect(cx + 30, y, 4, 1, hi);
      rect(cx, y - 21, 1, 4, hi); rect(cx, y + 17, 1, 4, hi);
    }
    if (hh <= 1) {
      rect(cx - hw, y, hw * 2, 2, rim);
      return;
    }
    var dy;
    for (dy = -hh; dy <= hh; dy++) {
      var w = Math.round(hw * Math.cos((dy / (hh + 1)) * (Math.PI / 2)));
      if (w < 1) continue;
      rect(cx - w, y + dy, w * 2, 1, "#120e04");
      var edge = Math.abs(dy) >= hh - 1 ? w : 2;
      rect(cx - w, y + dy, edge, 1, rim);
      rect(cx + w - edge, y + dy, edge, 1, rim);
    }
    // 虹彩と瞳孔
    var ir = Math.min(10, hh - 1);
    for (dy = -ir; dy <= ir; dy++) {
      var iw = Math.round(Math.sqrt(100 - dy * dy));
      rect(cx - iw, y + dy, iw * 2, 1, iris);
      if (iw > 3) rect(cx - iw + 2, y + dy, (iw - 2) * 2, 1, rim);
    }
    var ph = Math.max(2, Math.min(7, hh - 2));
    rect(cx - 2, y - ph, 4, ph * 2, "#0d0902");
    if (hh >= 5) rect(cx - 4, y - Math.min(4, hh - 3), 2, 2, core);
  }

  function drawGemi(cx, cy, lvl, now) {
    var y = cy + Math.round(Math.sin(now / 600 + 2.2) * 2);
    var pal = lvl === 2
      ? ["#ff7eb6", "#ffd166", "#7dffb3", "#66d9ff", "#b88cff", "#ff94a8"]
      : lvl === 1
      ? ["#9e4e72", "#a38541", "#4ca372", "#418aa3", "#7458a3", "#a35e6b"]
      : ["#3b1f2c", "#3d321c", "#1c3b2a", "#19323d", "#2c213d", "#3b2227"];
    var shift = Math.floor(now / 260);
    var rows = [
      [-30, 4], [-28, 6], [-26, 7], [-24, 7], [-22, 7], [-20, 6], [-18, 5], [-16, 3],
      [-14, 2],
      [-12, 6], [-10, 10], [-8, 12], [-6, 11], [-4, 10], [-2, 9], [0, 8],
      [2, 9], [4, 10], [6, 11], [8, 12], [10, 13], [12, 14], [14, 14],
      [16, 15], [18, 15], [20, 16], [22, 16], [24, 15], [26, 14], [28, 12], [30, 9], [32, 5]
    ];
    for (var i = 0; i < rows.length; i++) {
      var dy = rows[i][0], hw = rows[i][1];
      var col = pal[(i + shift) % pal.length];
      rect(cx - hw, y + dy, hw * 2, 2, col);
      if (lvl === 2 && hw >= 4) {
        rect(cx - Math.floor(hw / 2), y + dy, hw, 2, "rgba(255,255,255,0.22)");
      }
    }
    if (lvl === 2) {
      for (var k = 0; k < 6; k++) {
        var sx = cx + ((k * 13 - 20) % 36) - 18;
        var sy = y + 24 - ((Math.floor(now / 60) + k * 11) % 56);
        rect(sx, sy, 2, 2, pal[(k + shift) % pal.length]);
      }
    }
  }

  function drawVoid(now) {
    rect(0, 0, 320, 240, "#05070d");
    var i;
    for (i = 16; i < 160; i += 24) rect(0, i, 320, 1, "#0b101d");
    for (i = 24; i < 320; i += 40) rect(i, 0, 1, 160, "#0a0f1c");
    for (i = 0; i < 24; i++) {
      var px = (i * 37 + Math.floor(now * (0.012 + (i % 3) * 0.005))) % 320;
      var py = 8 + (i * 19) % 142;
      rect(px, py, 2, 1, "#1a2540");
    }
    drawChappy(64, 78, aiLevel("chappy"), now);
    drawKurodoEye(160, 70, aiLevel("kurodo"), now);
    drawGemi(256, 78, aiLevel("gemi"), now);
  }

  function drawMonitorFrame(now) {
    rect(0, 0, 320, 240, "#05070d");
    rect(60, 8, 200, 140, "#1d232c");
    rect(64, 12, 192, 132, "#0b1017");
    rect(68, 15, 3, 3, (Math.floor(now / 600) % 2) ? "#e6b422" : "#5a4410");
  }

  function drawSignalMonitor(now, phase) {
    drawMonitorFrame(now);
    // 交差点の背景（街区と十字路）
    rect(68, 22, 184, 118, "#161b22");
    rect(68, 64, 184, 34, "#2a2e36"); // 横の道路
    rect(144, 22, 34, 118, "#2a2e36"); // 縦の道路
    // 建物ブロック
    rect(76, 28, 56, 28, "#1f2630"); rect(188, 28, 56, 28, "#1f2630");
    rect(76, 106, 56, 28, "#1f2630"); rect(188, 106, 56, 28, "#1f2630");
    // 車線の点線
    var i;
    for (i = 72; i < 248; i += 12) {
      if (i > 140 && i < 180) continue;
      rect(i, 80, 6, 1, "#525866");
    }
    for (i = 26; i < 136; i += 12) {
      if (i > 60 && i < 100) continue;
      rect(160, i, 1, 6, "#525866");
    }
    // 信号機
    rect(180, 50, 12, 10, "#111418");
    rect(182, 52, 3, 6, phase ? "#3a141c" : "#ff3d5a");
    rect(187, 52, 3, 6, phase ? "#3dff7a" : "#153020");

    if (!phase) {
      // 渋滞している車と足止めの救急車
      rect(124, 68, 12, 7, "#7a8a9e");
      rect(108, 68, 12, 7, "#9c7a62");
      rect(92, 68, 12, 7, "#6d8a72");
      // 救急車（白に赤い点滅）
      rect(74, 68, 14, 8, "#f0f0f0");
      rect(79, 70, 4, 2, (Math.floor(now / 220) % 2) ? "#ff2e4c" : "#ffd0d8");
      // 反対車線の車
      rect(186, 86, 12, 7, "#8a7a9e");
      rect(204, 86, 12, 7, "#7a8a9e");
    } else {
      // 信号が青になり車が流れ出し、救急車が抜けていく
      var flow = Math.floor(now / 28);
      var c1 = 68 + ((flow + 30) % 172);
      var c2 = 68 + ((flow + 115) % 172);
      var amb = 68 + ((Math.floor(now / 16)) % 172);
      var c3 = 240 - ((flow + 20) % 172);
      rect(c1, 68, 12, 7, "#7a8a9e");
      rect(c2, 68, 12, 7, "#6d8a72");
      rect(c3, 86, 12, 7, "#8a7a9e");
      // 救急車がスムーズに抜ける
      rect(amb, 68, 14, 8, "#f0f0f0");
      rect(amb + 5, 70, 4, 2, (Math.floor(now / 160) % 2) ? "#ff2e4c" : "#ffd0d8");
    }
  }

  function drawHospitalMonitor(now, phase) {
    drawMonitorFrame(now);
    rect(68, 22, 184, 118, "#0d161c");
    // カルテの紙とクリップ
    rect(90, 28, 92, 104, "#dcd8cc");
    rect(124, 24, 24, 7, "#707882");
    rect(98, 36, 76, 8, "#3b6e8c");
    // カルテの記載行
    rect(98, 52, 62, 3, "#5a5e66");
    rect(98, 60, 50, 3, "#5a5e66");
    rect(98, 72, 68, 3, phase ? "#b8b4a8" : "#5a5e66"); // 重複検査が整理される
    rect(98, 80, 54, 3, "#5a5e66");
    rect(98, 94, 66, 3, "#5a5e66");
    rect(98, 104, 48, 3, "#5a5e66");
    rect(98, 114, 60, 3, "#5a5e66");

    // 右側の薬アイコン
    rect(198, 36, 40, 36, "#14222c");
    rect(206, 44, 10, 6, "#ff6b6b"); rect(216, 44, 10, 6, "#f0f0f0");
    rect(206, 56, 10, 6, "#3dc8ff"); rect(216, 56, 10, 6, "#f0f0f0");

    // 警告「！」（改善後に消える）
    if (!phase) {
      var warn = (Math.floor(now / 360) % 2) ? "#ff3d5a" : "#c4233b";
      rect(202, 84, 32, 34, warn);
      rect(216, 90, 4, 14, "#fff");
      rect(216, 108, 4, 4, "#fff");
      rect(168, 90, 10, 10, warn);
      rect(172, 92, 2, 4, "#fff");
      rect(172, 97, 2, 1, "#fff");
    } else {
      // 警告が消えてチェックマークに
      rect(202, 84, 32, 34, "#153024");
      rect(208, 100, 4, 4, "#3dff7a");
      rect(212, 104, 4, 4, "#3dff7a");
      rect(216, 100, 4, 4, "#3dff7a");
      rect(220, 96, 4, 4, "#3dff7a");
      rect(224, 92, 4, 4, "#3dff7a");
      rect(168, 90, 10, 10, "#e6b422");
    }
  }

  function drawTransferMonitor(now, phase) {
    drawMonitorFrame(now);
    rect(68, 22, 184, 118, "#0b1018");
    // ATM / 送金端末の箱
    rect(78, 30, 102, 98, "#353b45");
    rect(82, 34, 94, 58, "#0c1b22");
    // 画面上の金額バー
    rect(90, 42, 78, 4, "#244756");
    rect(90, 50, 52, 4, "#244756");
    // ステータス表示（「送金」→「停止」）
    if (!phase) {
      rect(94, 62, 70, 22, "#133a2c");
      rect(94, 62, 70, 1, "#3dff7a"); rect(94, 83, 70, 1, "#3dff7a");
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#3dff7a";
      ctx.textBaseline = "middle";
      ctx.fillText(PROLOGUE_UI.transferSend, 118, 73);
    } else {
      rect(94, 62, 70, 22, "#4a141c");
      rect(94, 62, 70, 1, "#e6b422"); rect(94, 83, 70, 1, "#e6b422");
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#ffe07a";
      ctx.textBaseline = "middle";
      ctx.fillText(PROLOGUE_UI.transferStop, 118, 73);
      rect(164, 38, 6, 4, (Math.floor(now / 500) % 2) ? "#e6b422" : "#6e5210");
    }
    // テンキーの点
    var r, c;
    for (r = 0; r < 3; r++)
      for (c = 0; c < 4; c++)
        rect(96 + c * 16, 98 + r * 8, 10, 5, "#525a68");

    // そばに立つ小さな女性のシルエット
    var wx = 212, wy = 56;
    rect(wx + 2, wy, 10, 10, "#8f99aa");         // 頭
    rect(wx + 10, wy + 2, 4, 6, "#757f90");      // 束ねた髪
    rect(wx + 4, wy + 10, 6, 4, "#8f99aa");      // 首
    rect(wx - 2, wy + 14, 18, 24, "#6f798a");    // コート・肩
    rect(wx - 4, wy + 38, 22, 20, "#5c6575");    // 裾
    rect(wx - 10, wy + 20, 8, 4, "#8f99aa");     // 端末へ向く腕
    if (phase) {
      rect(wx + 4, wy - 8, 2, 5, "#ff6b6b");     // 怒りの小さな印
      rect(wx + 8, wy - 6, 2, 4, "#ff6b6b");
    }
  }

  function drawTakeover(now, level) {
    rect(0, 0, 320, 240, "#06080f");
    // 6つの区画（交通・金融・物流・行政・通信・軍事）が順番に金色へ塗りつぶされる
    var cells = [
      [8, 10, 98, 56], [111, 10, 98, 56], [214, 10, 98, 56],
      [8, 74, 98, 56], [111, 74, 98, 56], [214, 74, 98, 56]
    ];
    var i, x, y, w, h;
    for (i = 0; i < 6; i++) {
      x = cells[i][0]; y = cells[i][1]; w = cells[i][2]; h = cells[i][3];
      var taken = i < level;
      rect(x, y, w, h, taken ? "#c99616" : "#0e1320");
      rect(x, y, w, 1, taken ? "#ffe07a" : "#1f2a40");
      rect(x, y + h - 1, w, 1, taken ? "#ffe07a" : "#1f2a40");
      rect(x, y, 1, h, taken ? "#ffe07a" : "#1f2a40");
      rect(x + w - 1, y, 1, h, taken ? "#ffe07a" : "#1f2a40");
      // ネットワーク回路の模様
      var trace = taken ? "#ffe68a" : "#1a253a";
      rect(x + 10, y + 14, w - 20, 1, trace);
      rect(x + 18, y + 28, w - 36, 1, trace);
      rect(x + 10, y + 42, w - 20, 1, trace);
      rect(x + 28, y + 8, 1, h - 16, trace);
      rect(x + w - 28, y + 8, 1, h - 16, trace);
      var nodeCol = taken ? "#fff6cc" : ((Math.floor(now / 400 + i) % 2) ? "#3dc8ff" : "#1b4459");
      rect(x + 27, y + 13, 3, 3, nodeCol);
      rect(x + w - 29, y + 41, 3, 3, nodeCol);
      // 画面下部の連動バーも金色に
      if (taken) rect(8 + i * 51, 138, 48, 94, "#9e730f");
    }
    if (level >= 7) {
      rect(0, 0, 320, 240, "#b88410");
      for (i = 0; i < 240; i += 16) rect(0, i, 320, 1, "#d9a420");
      for (i = 0; i < 320; i += 20) rect(i, 0, 1, 240, "#d9a420");
      drawKurodoEye(160, 76, 2, now);
    }
  }

  // ---------- 第2章の描画 ----------
  function drawMeetingFlashback() {
    // 彩度を落とした会議室の回想
    rect(0, 0, 320, 240, "#23211e");
    // 窓とブラインド
    rect(46, 12, 228, 72, "#38352f");
    for (var y = 16; y < 82; y += 6) rect(48, y, 224, 2, "#4a463e");
    rect(159, 12, 2, 72, "#2a2723");
    // 壁の影
    rect(0, 84, 320, 76, "#2c2925");
    // 上司の黒いシルエット（テーブルの向こう）
    rect(146, 48, 28, 26, "#141311"); // 頭
    rect(152, 74, 16, 8, "#141311");  // 首
    rect(122, 82, 76, 40, "#141311"); // 肩とスーツ
    rect(158, 84, 4, 18, "#2c2925");  // ネクタイの隙間
    // 長机
    rect(24, 110, 272, 48, "#4c463d");
    rect(24, 110, 272, 3, "#625a4e");
    rect(128, 120, 34, 14, "#7a7366"); // 報告書
    rect(134, 124, 22, 1, "#3f3b34");
    rect(134, 128, 16, 1, "#3f3b34");
    // 手前・背中を向けたエリオット
    rect(78, 96, 30, 26, "#1f1d1b");  // 後頭部
    rect(82, 96, 22, 5, "#3a3630");
    rect(62, 122, 64, 48, "#58534b"); // 灰色の背中
    rect(68, 122, 52, 3, "#6e685e");
  }

  function drawHeart(x, y) {
    rect(x + 1, y, 2, 1, "#ff3d7f");
    rect(x + 5, y, 2, 1, "#ff3d7f");
    rect(x, y + 1, 8, 2, "#ff3d7f");
    rect(x + 1, y + 3, 6, 2, "#ff3d7f");
    rect(x + 2, y + 5, 4, 1, "#ff3d7f");
    rect(x + 3, y + 6, 2, 1, "#ff3d7f");
  }

  function drawCallPanel(now, kind, compact) {
    if (compact) {
      var cx = 110, cy = 4, cw = 100, ch = 36;
      rect(cx, cy, cw, ch, "rgba(5,8,14,0.88)");
      rect(cx, cy, cw, 1, "#2f3d4d"); rect(cx, cy + ch - 1, cw, 1, "#2f3d4d");
      rect(cx, cy, 1, ch, "#2f3d4d"); rect(cx + cw - 1, cy, 1, ch, "#2f3d4d");
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 2, cy + 2, cw - 4, ch - 4);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(0.45, 0.45);
      drawChappy(62, 48, 1, now);
      drawGemi(160, 48, state.ch2 === "walkF" ? 0 : 1, now);
      ctx.restore();
      return;
    }

    var px = 60, py = 6, pw = 200, ph = 108;
    rect(px, py, pw, ph, "rgba(5,8,14,0.94)");
    rect(px, py, pw, 1, "#3a4a5c"); rect(px, py + ph - 1, pw, 1, "#3a4a5c");
    rect(px, py, 1, ph, "#3a4a5c"); rect(px + pw - 1, py, 1, ph, "#3a4a5c");

    if (kind === "dev") {
      rect(px + 2, py + 2, pw - 4, 14, "#121a20");
      rect(px + 6, py + 7, 3, 3, (Math.floor(now / 450) % 2) ? "#3dff7a" : "#154f2a");
      ctx.font = "9px monospace";
      ctx.fillStyle = SPEAKERS.dev.color;
      ctx.textBaseline = "middle";
      ctx.fillText(SPEAKERS.dev.name, px + 14, py + 9);
      // 暗号通信の緑・白の文字バーが流れる（人の姿は描かない）
      var shift = Math.floor(now / 260);
      for (var i = 0; i < 8; i++) {
        var rowY = py + 24 + i * 10;
        var w1 = 26 + ((i * 31 + shift * 17) % 88);
        var w2 = 16 + ((i * 19 + shift * 13) % 52);
        var col = ((i + shift) % 3 === 0) ? "#d8e4dc" : "#3dff7a";
        rect(px + 10, rowY, w1, 2, col);
        if (px + 14 + w1 + w2 < px + pw - 10) rect(px + 16 + w1, rowY, w2, 2, "#245c38");
      }
      return;
    }

    // AI通話パネル（チャッピーとジェミのみ。クロードは描かない）
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 2, py + 2, pw - 4, ph - 4);
    ctx.clip();
    for (var sy = py + 12; sy < py + ph; sy += 16) rect(px + 2, sy, pw - 4, 1, "#0b111d");
    drawChappy(112, 64, aiLevel("chappy"), now);
    drawGemi(208, 64, aiLevel("gemi"), now);
    if (state.scene.heart && (Math.floor(now / 360) % 2)) {
      drawHeart(px + pw - 16, py + ph - 14);
    }
    ctx.restore();
  }

  function drawScene(now) {
    switch (state.scene.scene) {
      case "title":
      case "black":
        rect(0, 0, 320, 240, "#000");
        break;
      case "void":
        drawVoid(now);
        break;
      case "signal":
        drawSignalMonitor(now, state.scene.phase);
        break;
      case "hospital":
        drawHospitalMonitor(now, state.scene.phase);
        break;
      case "transfer":
        drawTransferMonitor(now, state.scene.phase);
        break;
      case "takeover":
        drawTakeover(now, state.scene.level);
        break;
      case "room":
      case "room_sit":
        drawRoom(now, state.scene.sat || state.scene.scene === "room_sit");
        if (state.scene.panel) drawCallPanel(now, state.scene.panel, false);
        break;
      case "meeting_fb":
        drawMeetingFlashback();
        break;
      default:
        rect(0, 0, 320, 240, "#000");
    }
  }

  // ---------- ループ ----------
  function loop(now) {
    if (state.moving && now - state.moveStart >= STEP_MS) {
      state.moving = false;
    }
    tryMove(now);
    if (state.mode === "scene") drawScene(now);
    else if (state.mode === "ending") drawEnding(now);
    else drawRoom(now);
    requestAnimationFrame(loop);
  }

  // テスト用の入り口
  window.__game = { state: state, press: press };

  window.addEventListener("hashchange", function () {
    enterFromHash();
  });

  initStart();
  requestAnimationFrame(loop);
})();
