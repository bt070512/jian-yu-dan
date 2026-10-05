/* ============================================================
   剑与丹 · 音效系统（audio.js）
   ------------------------------------------------------------
   设计原则：
     · 音效零素材依赖 —— 全部音色由 Web Audio API 实时合成
       （OscillatorNode 振荡器 + GainNode 包络），不加载任何音频文件。
     · 背景音乐（BGM）使用真实 mp3 素材（resources/music/），
       按场景切换曲目；素材缺失时自动降级为合成音垫，绝不阻塞游戏。
     · 浏览器自动播放策略 —— AudioContext / <audio> 必须在用户手势后解锁；
       本模块在首次 pointerdown / keydown 时一次性 resume()，
       并把待播放的 BGM 在解锁瞬间自动接上。
     · 可关闭 —— 读取 GameConfig.loadConfig().sound.enabled（默认 true）。
       音量取 .sound.volume（默认 0.6），BGM 音量取 .sound.musicVolume（默认 0.35）。
   对外 API：
     Sound.play(key)         播放一次音效
     Sound.setEnabled(b)     运行时开关（同时控制音效与 BGM）
     Sound.setVolume(n)      运行时音效音量（0~1）
     Sound.unlock()          手动解锁（通常无需调用）
     Sound.bgm.start()       启动背景音乐（合成垫底，无素材时的兜底）
     Sound.bgm.stop()
     Sound.music.play(scene) 按场景播放真实 BGM：title / game / ending
     Sound.music.stop()      停止 BGM（可带淡出）
     Sound.music.setScene(s) 切换场景曲目（同曲不重头播）
     Sound.music.setVolume(n)
     Sound.music.toggle()    返回切换后的开关状态
   ============================================================ */

window.Sound = (function () {
  'use strict';

  let ctx = null;
  let master = null;
  let unlocked = false;
  let _enabled = true;
  let _volume = 0.6;
  let _musicVolume = 0.35;

  /* ---------- 读取配置（容错：GameConfig 未加载时用默认值） ---------- */
  function readConfig() {
    try {
      if (typeof GameConfig !== 'undefined' && GameConfig && GameConfig.loadConfig) {
        const c = GameConfig.loadConfig();
        if (c && c.sound) {
          if (typeof c.sound.enabled === 'boolean') _enabled = c.sound.enabled;
          if (typeof c.sound.volume === 'number') _volume = Math.max(0, Math.min(1, c.sound.volume));
          if (typeof c.sound.musicVolume === 'number') _musicVolume = Math.max(0, Math.min(1, c.sound.musicVolume));
        }
      }
    } catch (e) { /* 静默降级 */ }
  }

  /* ---------- 惰性创建 AudioContext ---------- */
  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = _volume;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  /* ---------- 解锁（必须在用户手势中调用一次） ---------- */
  function unlock() {
    if (unlocked) return;
    const c = ensureCtx();
    try {
      if (c && c.state === 'suspended') c.resume();
      unlocked = true;
    } catch (e) { /* 静默 */ }
    // 解锁瞬间：把此前被自动播放策略拦下的 BGM 接上
    try { if (_pendingScene && _enabled) music._playNow(_pendingScene); } catch (e) {}
  }

  /* ---------- 基础音元：一个振荡器 + 包络 ----------
     opt = {
       type: 波形 'sine'|'triangle'|'square'|'sawtooth'
       from: 起始频率 Hz   to: 结束频率 Hz（缺省 = from，即不滑音）
       dur:  时长 秒
       gain: 峰值增益（相对 master）
       delay: 延迟启动 秒
       curve: 包络曲线 'exp'（默认）| 'lin'
     }
  ------------------------------------------------------------ */
  function tone(opt) {
    const c = ensureCtx();
    if (!c || !master) return;
    const t0 = c.currentTime + (opt.delay || 0);
    const dur = opt.dur || 0.1;
    const g = c.createGain();
    const o = c.createOscillator();
    o.type = opt.type || 'sine';
    const f0 = opt.from || 440;
    const f1 = (opt.to != null) ? opt.to : f0;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      if (opt.curve === 'lin') o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    }
    const peak = (opt.gain != null ? opt.gain : 0.3);
    // ADSR 简化：快速起音 → 指数衰减
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /* ---------- 和弦（多音同时） ---------- */
  function chord(freqs, opt) {
    opt = opt || {};
    freqs.forEach((f, i) => {
      tone(Object.assign({}, opt, {
        from: f, to: f, type: opt.type || 'sine',
        delay: (opt.delay || 0) + (opt.spread ? i * opt.spread : 0),
      }));
    });
  }

  /* ---------- 音色库 ---------- */
  const RECIPES = {
    // 通用按钮点击：短促 Triangle，轻下降
    click() { tone({ type: 'triangle', from: 880, to: 660, dur: 0.06, gain: 0.18 }); },
    // 选择选项：正弦单音
    choice() { tone({ type: 'sine', from: 520, to: 520, dur: 0.08, gain: 0.2 }); },
    // 属性上升：上行两音
    good() {
      tone({ type: 'sine', from: 660, to: 880, dur: 0.09, gain: 0.2 });
      tone({ type: 'sine', from: 880, to: 990, dur: 0.11, gain: 0.16, delay: 0.06 });
    },
    // 属性下降：下行锯齿
    bad() {
      tone({ type: 'sawtooth', from: 240, to: 165, dur: 0.16, gain: 0.16 });
    },
    // 破境：三和弦渐强
    breakthrough() {
      chord([523.25, 659.25, 783.99], { type: 'sine', dur: 0.4, gain: 0.16, spread: 0.04 });
      tone({ type: 'triangle', from: 783.99, to: 1567.98, dur: 0.5, gain: 0.1, delay: 0.12 });
    },
    // 成婚：五声音阶琶音 C-E-G-A-C
    marry() {
      const seq = [523.25, 659.25, 783.99, 880.0, 1046.5];
      seq.forEach((f, i) => tone({ type: 'sine', from: f, to: f, dur: 0.5, gain: 0.14, delay: i * 0.12 }));
    },
    // 结局：长混响式和弦
    ending() {
      chord([392.0, 523.25, 659.25], { type: 'sine', dur: 1.2, gain: 0.14, spread: 0.02 });
      tone({ type: 'triangle', from: 261.63, to: 261.63, dur: 1.3, gain: 0.08 });
    },
    // 成就：双音跳进
    achievement() {
      tone({ type: 'triangle', from: 784, to: 784, dur: 0.12, gain: 0.18 });
      tone({ type: 'triangle', from: 1046.5, to: 1046.5, dur: 0.18, gain: 0.16, delay: 0.1 });
    },
    // 预警：方波双脉冲
    warn() {
      tone({ type: 'square', from: 440, to: 440, dur: 0.09, gain: 0.12 });
      tone({ type: 'square', from: 440, to: 440, dur: 0.09, gain: 0.12, delay: 0.14 });
    },
    // 寿终：低频下滑
    death() {
      tone({ type: 'sawtooth', from: 330, to: 110, dur: 0.9, gain: 0.16 });
      tone({ type: 'sine', from: 165, to: 82.4, dur: 0.9, gain: 0.1, delay: 0.05 });
    },
  };

  /* ---------- 播放 ---------- */
  function play(key) {
    if (!_enabled) return;
    try {
      readConfigIfStale();
      const r = RECIPES[key];
      if (!r) return;
      const c = ensureCtx();
      if (!c) return;
      if (c.state === 'suspended') { c.resume(); }
      if (master) master.gain.value = _volume;
      r();
    } catch (e) { /* 静默降级：音效失败绝不影响游戏 */ }
  }

  let _cfgRead = false;
  function readConfigIfStale() { if (!_cfgRead) { readConfig(); _cfgRead = true; } }

  /* ============================================================
     背景音乐（BGM）—— 可选的合成垫底方案
     用极简五声音阶循环 + 长音色垫，覆盖"BGM 素材缺口"。
     默认不自动播放；由 UI 在进入游戏时按需 start()。
     ============================================================ */
  const bgm = (function () {
    let timer = null;
    let running = false;
    // 五声音阶（C 宫）：C D E G A
    const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    let idx = 0;

    function tick() {
      if (!running || !_enabled) return;
      try {
        const f = SCALE[idx % SCALE.length];
        tone({ type: 'sine', from: f, to: f, dur: 1.6, gain: 0.035 });
        tone({ type: 'sine', from: f / 2, to: f / 2, dur: 1.8, gain: 0.02 });
      } catch (e) { /* 静默 */ }
      idx++;
      // 随机音序（轻微飘忽，避免机械感）
      if (Math.random() < 0.35) idx += 1;
      timer = setTimeout(tick, 1400 + Math.random() * 600);
    }

    return {
      start() {
        if (running) return;
        if (!_enabled) return;
        running = true;
        idx = 0;
        tick();
      },
      stop() {
        running = false;
        if (timer) { clearTimeout(timer); timer = null; }
      },
      isRunning() { return running; },
    };
  })();

  /* ============================================================
     真实背景音乐（music）—— 基于 mp3 素材的场景 BGM
     素材目录：resources/music/
       title  标题页  → shan-xian-yao.mp3   《仙山谣》国风
       game   游戏中  → shan-jian-gui-ke.mp3 《山涧归客》流行
       ending 结局页  → yun-que-ya-yue.mp3  《云阙雅乐》国风
     行为：
       · 循环播放，曲目切换带淡入淡出（同曲不重头播）
       · 受 sound.enabled 总开关控制；BGM 音量独立（musicVolume）
       · 自动播放受限时记录待播场景，首次手势解锁后自动接上
       · 加载失败（素材缺失 / 解码错误）时自动降级到合成 bgm，绝不报错
     ============================================================ */
  const MUSIC_SRC = {
    title: 'resources/music/shan-xian-yao.mp3',
    game: 'resources/music/shan-jian-gui-ke.mp3',
    ending: 'resources/music/yun-que-ya-yue.mp3',
  };
  const MUSIC_NAME = {
    title: '《仙山谣》',
    game: '《山涧归客》',
    ending: '《云阙雅乐》',
  };

  let _pendingScene = null;   // 解锁前被拦下的目标场景

  const music = (function () {
    let scene = null;         // 当前场景名
    let el = null;            // 当前 <audio> 元素
    let failed = {};          // 记录加载失败的曲目，避免反复重试
    let fadeTimer = null;

    function makeAudio(src) {
      const a = new Audio();
      a.src = src;
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      a.addEventListener('error', () => {
        failed[src] = true;
        // 降级：合成音垫兜底
        try { if (scene && _enabled) bgm.start(); } catch (e) {}
      });
      return a;
    }

    /* 淡入到目标音量 */
    function fadeIn(a, target, ms) {
      const steps = Math.max(8, Math.round(ms / 50));
      let i = 0;
      a.volume = 0;
      const inc = target / steps;
      clearInterval(fadeTimer);
      fadeTimer = setInterval(() => {
        i++;
        try {
          a.volume = Math.min(target, inc * i);
          if (i >= steps) { a.volume = target; clearInterval(fadeTimer); fadeTimer = null; }
        } catch (e) { clearInterval(fadeTimer); fadeTimer = null; }
      }, 50);
    }

    /* 淡出并停止 */
    function fadeOutAndStop(a, ms, onDone) {
      if (!a) { if (onDone) onDone(); return; }
      const steps = Math.max(6, Math.round(ms / 50));
      let i = 0;
      const start = a.volume;
      const dec = start / steps;
      const t = setInterval(() => {
        i++;
        try {
          a.volume = Math.max(0, start - dec * i);
          if (i >= steps) {
            clearInterval(t);
            a.pause();
            try { a.currentTime = 0; } catch (e) {}
            a.volume = 0;
            if (onDone) onDone();
          }
        } catch (e) {
          clearInterval(t);
          if (onDone) onDone();
        }
      }, 50);
    }

    function playNow(sc) {
      if (!_enabled) return;
      const src = MUSIC_SRC[sc];
      if (!src || failed[src]) {
        // 素材不可用 → 合成兜底
        try { bgm.start(); } catch (e) {}
        return;
      }
      // 同曲在播：仅校正音量，不重头播
      if (el && scene === sc && !el.paused) {
        try { el.volume = _musicVolume; } catch (e) {}
        return;
      }
      const next = makeAudio(src);
      const p = next.play();
      if (p && p.catch) {
        p.catch(() => {
          // 自动播放被拦：记录待播场景，等手势解锁
          _pendingScene = sc;
          try { next.pause(); } catch (e) {}
        });
      }
      const old = el;
      el = next;
      scene = sc;
      fadeIn(next, _musicVolume, 700);
      if (old) fadeOutAndStop(old, 500, null);
    }

    return {
      play(sc) {
        _pendingScene = sc;
        if (!unlocked) return;      // 等解锁后自动接上
        playNow(sc);
      },
      stop(withFade) {
        _pendingScene = null;
        const a = el;
        el = null;
        scene = null;
        if (withFade === false) {
          if (a) { try { a.pause(); } catch (e) {} }
        } else {
          fadeOutAndStop(a, 500, null);
        }
        try { bgm.stop(); } catch (e) {}
      },
      /* 切换场景：同曲不重播 */
      setScene(sc) {
        if (scene === sc && el && !el.paused) return;
        this.play(sc);
      },
      setVolume(n) {
        _musicVolume = Math.max(0, Math.min(1, Number(n) || 0));
        try { if (el) el.volume = _musicVolume; } catch (e) {}
      },
      getVolume() { return _musicVolume; },
      current() { return scene; },
      isPlaying() { return !!(el && !el.paused); },
      name() { return MUSIC_NAME[scene] || ''; },
      /* 内部使用（unlock 回调） */
      _playNow: playNow,
    };
  })();

  /* ---------- 事件监听：一次性手势解锁 ---------- */
  function bindUnlock() {
    const handler = () => { unlock(); };
    try {
      window.addEventListener('pointerdown', handler, { once: true });
      window.addEventListener('keydown', handler, { once: true });
      window.addEventListener('touchstart', handler, { once: true });
    } catch (e) { /* 静默 */ }
  }
  bindUnlock();

  return {
    play,
    unlock,
    bgm,
    music,
    setEnabled(b) {
      _enabled = !!b;
      if (!_enabled) {
        bgm.stop();
        music.stop();          // 关闭总开关时一并停掉 BGM
      } else if (_pendingScene) {
        music.play(_pendingScene);   // 重新开启时续上之前的场景
      }
    },
    setVolume(n) {
      _volume = Math.max(0, Math.min(1, Number(n) || 0));
      try { if (master) master.gain.value = _volume; } catch (e) {}
    },
    setMusicVolume(n) { music.setVolume(n); },
    getMusicVolume() { return music.getVolume(); },
    isEnabled() { return _enabled; },
    getVolume() { return _volume; },
    isUnlocked() { return unlocked; },
    /* 供设置变更后刷新内存配置 */
    reloadConfig() { _cfgRead = false; readConfig(); _cfgRead = true; },
  };
})();
