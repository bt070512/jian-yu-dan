/* ============================================================
   第十一轮 · BGM UI 集成测试（jsdom）
   用真实 index.html + 真实 click 验证：场景切换驱动 BGM、设置面板联动
   运行：node test-bgm-ui.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  ({ JSDOM } = require('C:/Users/wdmxr/.workbuddy/binaries/node/workspace/node_modules/jsdom'));
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n【' + t + '】'); }

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: undefined,   // 不加载外链，脚本由本地注入
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(win) {
    // 环境桩：Audio / AudioContext（在脚本执行前装好）
    win.HTMLMediaElement.prototype.play = function () {
      this._playing = true;
      return Promise.resolve();
    };
    win.HTMLMediaElement.prototype.pause = function () { this._playing = false; };
    win.AudioContext = function () {
      return {
        currentTime: 0, state: 'running', destination: {},
        resume() { this.state = 'running'; },
        createGain() {
          return {
            gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
            connect() {},
          };
        },
        createOscillator() {
          return {
            type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
            connect() {}, start() {}, stop() {},
          };
        },
      };
    };
  },
});
const { window } = dom;

/* ---------- 按 index.html 顺序注入脚本 ---------- */
const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
console.log('注入脚本:', scripts.join(', '));
scripts.forEach(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('  跳过缺失:', f); return; }
  const code = fs.readFileSync(p, 'utf8');
  const el = window.document.createElement('script');
  el.textContent = code;
  window.document.body.appendChild(el);
});

const { Sound, UI, GameConfig } = window;

/* ---------- ① 脚本加载与 API ---------- */
section('① 脚本加载与 API');
ok('Sound 已定义', !!Sound);
ok('Sound.music 已定义', !!(Sound && Sound.music));
ok('Sound.music.setScene 可调用', typeof Sound.music.setScene === 'function');
ok('Sound.setMusicVolume 可调用', typeof Sound.setMusicVolume === 'function');

/* ---------- ② UI 初始化 ---------- */
section('② UI 初始化（含音乐控件绑定）');
try { UI.init(); ok('UI.init() 无异常', true); }
catch (e) { ok('UI.init() 无异常', false, e.message); }

/* ---------- ③ 场景切换驱动 BGM ---------- */
section('③ 场景切换驱动 BGM');
// 浏览器自动播放策略：无手势时 unlocked 恒为 false，BGM 会等待解锁。
// 这里模拟一次用户手势解锁，与真实浏览器首次点击等价。
Sound.unlock();
window.dispatchEvent(new window.Event('pointerdown'));
ok('手势解锁后 isUnlocked = true', Sound.isUnlocked() === true);

function scene() { return Sound.music.current(); }
function activate(id) {
  UI.showScreen(id);
}
// 解锁后 BGM 会接上 _pendingScene；显式进入标题页开始
activate('screen-title');
ok("标题页 → 场景 'title'", scene() === 'title', '实际 ' + scene());

activate('screen-game');
ok("游戏页 → 场景 'game'", scene() === 'game', '实际 ' + scene());

activate('screen-end');
ok("结局页 → 场景 'ending'", scene() === 'ending', '实际 ' + scene());

activate('screen-title');
ok("回到标题页 → 场景 'title'", scene() === 'title', '实际 ' + scene());

// 弹层不打断当前曲目
activate('screen-game');
const before = scene();
UI.showScreen('screen-ach');
ok('成就弹层不切换曲目', scene() === before, `${before} → ${scene()}`);
UI.showScreen('screen-history');
ok('记录弹层不切换曲目', scene() === before, `${before} → ${scene()}`);
UI.showScreen('screen-settings');
ok('设置弹层不切换曲目', scene() === before, `${before} → ${scene()}`);

/* ---------- ④ 设置面板联动 ---------- */
section('④ 设置面板联动');
UI.showSettings();
const musicVol = window.document.getElementById('cfg-music-vol');
const soundVol = window.document.getElementById('cfg-sound-vol');
const soundOn = window.document.getElementById('cfg-sound-on');
const musicName = window.document.getElementById('cfg-music-name');

ok('音乐音量滑条存在', !!musicVol);
ok('音效音量滑条存在', !!soundVol);
ok('总开关存在', !!soundOn);
ok('曲目显示元素存在', !!musicName);
ok('滑条预填 0.35', musicVol && Math.abs(Number(musicVol.value) - 0.35) < 0.001, musicVol && musicVol.value);
ok('曲目名已渲染', musicName && musicName.textContent.length > 0, musicName && musicName.textContent);

// 拖动音乐音量滑条 → 实时生效
if (musicVol) {
  musicVol.value = '0.8';
  musicVol.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('拖动滑条实时改音乐音量', Math.abs(Sound.getMusicVolume() - 0.8) < 0.001, String(Sound.getMusicVolume()));
}

// 取消勾选总开关 → BGM 停止
if (soundOn) {
  soundOn.checked = false;
  soundOn.dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('取消勾选后 Sound 关闭', Sound.isEnabled() === false);
  soundOn.checked = true;
  soundOn.dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('重新勾选后 Sound 开启', Sound.isEnabled() === true);
}

/* ---------- ⑤ 保存设置持久化 ---------- */
section('⑤ 保存设置持久化');
UI.showSettings();
if (musicVol) { musicVol.value = '0.55'; }
const saveBtn = window.document.getElementById('btn-cfg-save');
if (saveBtn) { saveBtn.click(); }
const saved = GameConfig.loadConfig();
ok('musicVolume 已保存为 0.55', Math.abs((saved.sound.musicVolume || 0) - 0.55) < 0.001, String(saved.sound.musicVolume));
ok('音效开关字段保留', typeof saved.sound.enabled === 'boolean');
ok('音效音量字段保留', typeof saved.sound.volume === 'number');

/* ---------- ⑥ 无素材时的降级 ---------- */
section('⑥ 容错与降级');
ok('failed 曲目不会抛错（setScene 可安全调用）', (() => {
  try { Sound.music.setScene('nonexistent'); return true; } catch (e) { return false; }
})());
ok('stop() 可安全调用', (() => {
  try { Sound.music.stop(); return true; } catch (e) { return false; }
})());
ok('setVolume 越界被裁剪', (() => {
  Sound.setMusicVolume(99); const v = Sound.getMusicVolume();
  return v === 1;
})());

/* ---------- 结果 ---------- */
console.log('\n' + '='.repeat(52));
console.log(`  BGM UI 集成测试：${pass} 通过 / ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
