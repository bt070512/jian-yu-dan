/* 完整回归：旧存档兼容 + 新系统 + 全结局可达性 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = __dirname;

function makeCtx(initialStore) {
  const store = initialStore || {};
  const ctx = {
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  // 模拟浏览器：所有脚本在同一全局作用域按序执行（顶层 const 跨脚本可见）
  const code = ['data.js', 'config.js', 'characters.js', 'events.js', 'events-chars.js', 'engine.js']
    .map(f => `/* ${f} */\n` + fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n;\n');
  const res = vm.runInContext(code + '\n;({DIFFICULTIES,PERSONALITIES,DIALOGUE_STYLES,STORY_TENDENCIES,EVENTS,CHAR_EVENTS,ENDINGS,ACHIEVEMENTS,CHARACTERS})', ctx, { filename: 'bundle.js' });
  return { ctx, store, res };
}

console.log('========== 1. 旧存档兼容验证 ==========');
// 模拟一个「第一轮/第二轮时代」的旧存档：只有基础字段，runs 记录缺后加字段
const oldSave = {
  cycle: 7, totalRuns: 6, luckBonus: 3,
  achievements: ['first_step', 'recite'],
  runs: [
    { cycle: 6, name: '阿芷/阿瑶', ending: '携手仙途', rank: 'S', age: 180,
      realm: '元婴', affection: 72, talents: ['剑心通明'],
      keyEvents: [{ event: '初遇', choice: '让路' }], achievements: ['recite'],
      time: '2025-01-01 10:00:00' },   // 注意：无 affection_sister / playerName
  ],
  seenTalents: ['jianxin'],
};
const { ctx, store, res } = makeCtx({ jianyudan_save_v1: JSON.stringify(oldSave) });
const G = k => res[k];
const meta = ctx.loadMeta();
console.log('  读取旧存档 -> cycle:', meta.cycle, '| totalRuns:', meta.totalRuns, '| luckBonus:', meta.luckBonus);
console.log('  achievements 保留:', meta.achievements.length, '| runs 保留:', meta.runs.length);
console.log('  runs[0].achievements 补齐:', Array.isArray(meta.runs[0].achievements));
console.log('  runs[0] 原有 affection 未被覆盖:', meta.runs[0].affection === 72);
console.log('  normalizeMeta 未丢字段:', !!meta.runs[0].ending);

// 用旧存档开局，验证新字段注入
ctx.Engine.newLife(meta);
const s0 = ctx.Engine.state;
console.log('  新局新字段默认值: affection_sister =', s0.affection_sister,
  '| affection_third =', s0.affection_third, '| playerName =', JSON.stringify(s0.playerName),
  '| difficulty =', s0.difficulty, '| charFlags =', JSON.stringify(s0.charFlags));

console.log('\n========== 2. 配置层默认值验证 ==========');
const cfg = ctx.loadConfig();
console.log('  playerName:', JSON.stringify(cfg.playerName), '| difficulty:', cfg.difficulty);
console.log('  ai.enabled:', cfg.ai.enabled, '| personality:', cfg.ai.personality,
  '| dialogueStyle:', cfg.ai.dialogueStyle, '| tendency:', cfg.ai.tendency);
console.log('  难度档位数:', Object.keys(G('DIFFICULTIES')).length,
  '| 性格:', Object.keys(G('PERSONALITIES')).length,
  '| 风格:', Object.keys(G('DIALOGUE_STYLES')).length,
  '| 倾向:', Object.keys(G('STORY_TENDENCIES')).length);

console.log('\n========== 3. 数据总量 ==========');
console.log('  主事件库 EVENTS:', G('EVENTS').length);
console.log('  角色事件库 CHAR_EVENTS:', G('CHAR_EVENTS').length);
console.log('  合计事件:', G('EVENTS').length + G('CHAR_EVENTS').length);
console.log('  结局总数:', Object.keys(G('ENDINGS')).length);
console.log('  成就总数:', G('ACHIEVEMENTS').length);
console.log('  可攻略角色:', G('CHARACTERS').map(c => c.key + '(' + c.title + ')').join(', '));

console.log('\n========== 4. 全结局池验证 ==========');
const newEndings = ['marry_herb','marry_sister','marry_third',
  'return_mortal_herb','return_mortal_sister','return_mortal_third','return_mortal_alone'];
newEndings.forEach(id => {
  const e = G('ENDINGS')[id];
  console.log(`  ${id}: ${e ? e.name + ' [' + e.rank + ']' : '缺失!'}`);
});

console.log('\n========== 5. 1000 周目随机模拟（去重 / 覆盖率 / 崩溃检查） ==========');
const { Engine, CHAR_EVENTS, EVENTS } = ctx;
const charIds = new Set(CHAR_EVENTS.map(e => e.id));
let dup = 0, errors = 0, totalChar = 0;
const endCount = {}, charHist = {}, stageCount = {};
const flagRe = /charFlags\s*\??\.\w+\s*=|charFlags\[/;

function smart(state, ev) {
  const cs = ev.choices || [];
  if (!cs.length) return null;
  const isRift1 = /_rift_1$/.test(ev.id);
  let best = cs[0], bs = -1e9;
  cs.forEach((c, i) => {
    const src = c.apply ? c.apply.toString() : '';
    const g = c.charaff ? (c.charaff.d || 0) : 0;
    const cb = flagRe.test(src) ? 200 : 0;
    let sc = cb + g * 2 - i * 0.5;
    if (isRift1 && cb > 0) { sc = 500 + i; if (Math.random() < 0.4) sc += 300; }
    if (sc > bs) { bs = sc; best = c; }
  });
  return best;
}

for (let r = 0; r < 1000; r++) {
  try {
    const m = { cycle: r + 1, totalRuns: r, luckBonus: Math.min(6, Math.floor(r / 2)),
      achievements: [], runs: [], seenTalents: [] };
    Engine.newLife(m);
    const s = Engine.state;
    const seen = new Set();
    let guard = 0;
    while (!s.dead && guard++ < 400) {
      const res = Engine.step();
      if (!res) { Engine.judgeEnding('null'); break; }
      if (res.type === 'death') { Engine.judgeEnding('death'); break; }
      if (res.type === 'idle') continue;
      const e = res.event;
      if (!e.repeat) { if (seen.has(e.id)) dup++; seen.add(e.id); }
      if (charIds.has(e.id)) { totalChar++; charHist[e.id] = (charHist[e.id] || 0) + 1; }
      if (e.stage) stageCount[e.stage] = (stageCount[e.stage] || 0) + 1;
      const c = smart(s, e);
      if (c) {
        Engine.apply(c);
        if (c.next) { const nx = Engine.resolveNext(c, s); if (nx) { if (!nx.repeat) { if (seen.has(nx.id)) dup++; seen.add(nx.id); } if (charIds.has(nx.id)) { totalChar++; charHist[nx.id] = (charHist[nx.id] || 0) + 1; } } }
      }
    }
    const id = s.ending ? s.ending.id : (Engine.judgeEnding('test').id);
    endCount[id] = (endCount[id] || 0) + 1;
  } catch (err) { errors++; if (errors < 4) console.log('  [!]', err.message); }
}

console.log('  运行 1000 周目 | 崩溃:', errors, '| 周目内重复违规:', dup);
console.log('  角色事件触发总次数:', totalChar);
console.log('  角色阶段覆盖:', JSON.stringify(stageCount));
const never = CHAR_EVENTS.filter(e => !charHist[e.id]).map(e => e.id);
console.log('  未触发角色事件:', never.length, never.length ? '(' + never.join(',') + ')' : '');
console.log('  结局分布:');
Object.entries(endCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
  console.log(`    ${k}: ${v} (${(v / 10).toFixed(1)}%)`));
