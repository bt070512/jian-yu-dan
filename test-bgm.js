/* ============================================================
   第十一轮 · 背景音乐（BGM）测试
   覆盖：配置兼容 / 素材就位 / 场景映射 / 开关联动 / 旧存档兼容
   运行：node test-bgm.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n【' + t + '】'); }

const ROOT = __dirname;
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- ① BGM 素材就位 ---------- */
section('① BGM 素材就位');
const MUSIC_DIR = path.join(ROOT, 'resources', 'music');
ok('resources/music 目录存在', fs.existsSync(MUSIC_DIR));
const musicFiles = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3')) : [];
ok('至少 3 首 mp3 素材', musicFiles.length >= 3, `实际 ${musicFiles.length}`);
const EXPECT = ['shan-xian-yao.mp3', 'shan-jian-gui-ke.mp3', 'yun-que-ya-yue.mp3'];
EXPECT.forEach(f => {
  const p = path.join(MUSIC_DIR, f);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  ok(`素材 ${f} 存在且 > 1MB`, exists && size > 1024 * 1024, `${(size / 1048576).toFixed(1)}MB`);
});

/* ---------- ② audio.js 暴露 music API ---------- */
section('② audio.js 暴露 music API');
const audioSrc = read('audio.js');
['play(sc)', 'stop(', 'setScene(', 'setVolume(', 'getVolume(', 'current(', 'isPlaying(', 'name(']
  .forEach(m => ok(`music 提供 ${m}`, audioSrc.includes(m)));
ok('MUSIC_SRC 场景映射存在', audioSrc.includes('MUSIC_SRC'));
ok('三个场景 title/game/ending 齐全',
  audioSrc.includes('title:') && audioSrc.includes('game:') && audioSrc.includes('ending:'));
ok('引用 resources/music 路径', audioSrc.includes('resources/music/'));
ok('有淡入淡出 fadeIn/fadeOutAndStop', audioSrc.includes('fadeIn') && audioSrc.includes('fadeOutAndStop'));
ok('加载失败降级到 bgm.start()', audioSrc.includes('bgm.start()'));
ok('自动播放被拦时记录待播场景', audioSrc.includes('_pendingScene'));
ok('setEnabled(false) 会停 BGM', /if\s*\(!_enabled\)\s*\{[\s\S]{0,200}music\.stop\(\)/.test(audioSrc));

/* ---------- ③ 配置层兼容 ---------- */
section('③ 配置层兼容（旧存档可读）');
const cfgSrc = read('config.js');
ok('默认配置含 musicVolume', cfgSrc.includes('musicVolume'));
ok('默认 musicVolume = 0.35', /musicVolume:\s*0\.35/.test(cfgSrc));
ok('loadConfig 对 musicVolume 做兜底', /musicVolume[\s\S]{0,200}0\.35/.test(cfgSrc));
ok('musicVolume 做 0~1 裁剪', cfgSrc.includes('Math.max(0, Math.min(1, merged.sound.musicVolume))'));

/* 用真实配置模块做行为验证 */
section('③.5 配置行为（真实执行）');
const sandbox = {
  window: {}, localStorage: (() => {
    const store = {};
    return {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      _store: store,
    };
  })(),
  console,
};
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
try {
  vm.runInContext(cfgSrc, sandbox, { filename: 'config.js' });
} catch (e) {
  console.log('  配置模块执行失败:', e.message);
}
const GC = sandbox.window.GameConfig || sandbox.GameConfig;
ok('GameConfig 已定义', !!GC);
if (GC) {
  // 场景 A：全新用户
  const c1 = GC.loadConfig();
  ok('新用户默认开启音效', c1.sound.enabled === true);
  ok('新用户默认音效音量 0.6', c1.sound.volume === 0.6);
  ok('新用户默认音乐音量 0.35', c1.sound.musicVolume === 0.35);

  // 场景 B：旧存档（无 musicVolume 字段）
  sandbox.localStorage.setItem('jianyudan_config_v1', JSON.stringify({ sound: { enabled: true, volume: 0.8 } }));
  const c2 = GC.loadConfig();
  ok('旧存档读取不报错', !!c2);
  ok('旧存档 musicVolume 回落默认 0.35', c2.sound.musicVolume === 0.35);
  ok('旧存档保留原音效音量 0.8', c2.sound.volume === 0.8);

  // 场景 C：旧存档完全无 sound 字段
  sandbox.localStorage.setItem('jianyudan_config_v1', JSON.stringify({ playerName: '测试' }));
  const c3 = GC.loadConfig();
  ok('无 sound 的极旧存档可读', !!c3 && !!c3.sound);
  ok('极旧存档 musicVolume = 0.35', c3.sound.musicVolume === 0.35);

  // 场景 D：非法值
  sandbox.localStorage.setItem('jianyudan_config_v1', JSON.stringify({ sound: { enabled: true, volume: 0.5, musicVolume: 'abc' } }));
  const c4 = GC.loadConfig();
  ok('非法 musicVolume 回落 0.35', c4.sound.musicVolume === 0.35);

  // 场景 E：越界值
  sandbox.localStorage.setItem('jianyudan_config_v1', JSON.stringify({ sound: { enabled: true, volume: 0.5, musicVolume: 5 } }));
  const c5 = GC.loadConfig();
  ok('越界 musicVolume 裁剪到 1', c5.sound.musicVolume === 1);
}

/* ---------- ④ UI 接入 ---------- */
section('④ UI 接入');
const uiSrc = read('ui.js');
ok('showScreen 里驱动 music.setScene', uiSrc.includes('music.setScene'));
ok("screen-game → 'game'", /screen-game'\)\s*Sound\.music\.setScene\('game'\)/.test(uiSrc));
ok("screen-end → 'ending'", /screen-end'\)\s*Sound\.music\.setScene\('ending'\)/.test(uiSrc));
ok("screen-title → 'title'", /screen-title'\)\s*Sound\.music\.setScene\('title'\)/.test(uiSrc));
ok('saveSettings 同步 musicVolume', uiSrc.includes('setMusicVolume'));
ok('滑条 input 实时生效', uiSrc.includes("addEventListener('input'"));
ok('开关 change 实时生效', uiSrc.includes("addEventListener('change'"));
ok('设置面板显示当前曲目', uiSrc.includes('cfg-music-name'));

/* ---------- ⑤ index.html 控件 ---------- */
section('⑤ index.html 控件');
const html = read('index.html');
ok('音乐音量滑条存在', html.includes('id="cfg-music-vol"'));
ok('曲目显示元素存在', html.includes('id="cfg-music-name"'));
ok('开关文案含背景音乐', html.includes('启用音效与背景音乐'));
ok('标签说明按场景切换', html.includes('按场景自动切换'));
// 脚本引用顺序：audio.js 必须在 ui.js 之前
const iAudio = html.indexOf('audio.js');
const iUi = html.indexOf('ui.js');
ok('audio.js 在 ui.js 之前加载', iAudio > 0 && iUi > 0 && iAudio < iUi);

/* ---------- ⑥ style.css ---------- */
section('⑥ 样式');
const css = read('style.css');
ok('cfg-music-now 样式存在', css.includes('.cfg-music-now'));

/* ---------- ⑦ 既有音效无回归 ---------- */
section('⑦ 既有音效无回归');
['click', 'choice', 'good', 'bad', 'breakthrough', 'marry', 'ending', 'achievement', 'warn', 'death']
  .forEach(k => ok(`音色 ${k} 保留`, audioSrc.includes(k + '(')));
ok('Sound.play 未改动签名', /function play\(key\)/.test(audioSrc));
ok('合成 BGM（bgm）模块保留', audioSrc.includes('const bgm = (function'));
ok('解锁监听保留', audioSrc.includes('bindUnlock'));

/* ---------- 结果 ---------- */
console.log('\n' + '='.repeat(52));
console.log(`  BGM 测试结果：${pass} 通过 / ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
