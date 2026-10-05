/* 角色事件接入验证：跑 N 周目，检查 c_* 事件可触发、好感字段正确、周目内不重复 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = __dirname;
const ctx = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map,
  localStorage: (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
  }; })(),
  window: {},
  document: undefined,
};
ctx.window = ctx;
vm.createContext(ctx);

['data.js', 'config.js', 'characters.js', 'events.js', 'events-chars.js', 'engine.js']
  .forEach(f => {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  });

const { Engine, CHAR_EVENTS } = ctx;
const charIds = new Set(CHAR_EVENTS.map(e => e.id));

let dupViolation = 0;
let charTriggerCount = 0;
const triggerHist = {};
const stageCover = {};
const affEnd = { affection: 0, affection_sister: 0, affection_third: 0 };

function smart(state, ev) {
  // 策略：模拟「会犯错、也会弥补」的玩家。
  // - 绝大多数事件：选带 charaff 正收益最大的选项
  // - 误会冲突（rift_1）阶段：有 60% 概率故意选「会引发冲突」的选项（设置 conflict/alone 类 flag），
  //   以验证「误会 → 和解」链式剧情确实可达。
  const choices = ev.choices || [];
  if (!choices.length) return null;
  const flagRe = /charFlags\s*\??\.\w+\s*=|charFlags\[/;
  const isRift1 = /_rift_1$/.test(ev.id);
  let best = choices[0], bestScore = -1e9;
  choices.forEach((c, i) => {
    const src = c.apply ? c.apply.toString() : '';
    const gain = c.charaff ? (c.charaff.d || 0) : 0;
    const chainBonus = flagRe.test(src) ? 200 : 0;
    let score = chainBonus + gain * 2 - i * 0.5;
    if (isRift1) {
      // 冲突节点：把「设置 conflict/alone flag」的选项视为可接受（模拟走错路）
      if (chainBonus > 0) score = 500 + i;   // 优先但按顺序，保留随机性
      if (Math.random() < 0.4) score += 300; // 40% 概率仍走正收益选项
    }
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best;
}

const RUNS = 400;
for (let r = 0; r < RUNS; r++) {
  // 第七轮：每局重置选项幂等令牌池（否则事件单例的 choice 对象跨周目被误吞）
  Engine._appliedChoices = null;
  const meta = Engine && ctx.loadMeta ? ctx.loadMeta() : { cycle: r + 1, luckBonus: 0 };
  meta.cycle = r + 1;
  meta.luckBonus = Math.min(6, Math.floor(r / 2));
  Engine.newLife(meta);
  const s = Engine.state;
  const seen = new Set();

  let guard = 0;
  while (!s.dead && guard++ < 400) {
    const res = Engine.step();
    if (!res) break;
    if (res.type === 'death') { break; }
    if (res.type === 'idle') { continue; }
    const e = res.event;
    if (!e.repeat) {
      if (seen.has(e.id)) {
        dupViolation++;
        if (dupViolation < 6) console.log('  [重复]', e.id, 'age', s.age);
      }
      seen.add(e.id);
    }
    if (charIds.has(e.id)) {
      charTriggerCount++;
      triggerHist[e.id] = (triggerHist[e.id] || 0) + 1;
      if (e.stage) stageCover[e.stage] = (stageCover[e.stage] || 0) + 1;
    }
    s._lastEvent = e;
    // 执行选项
    const c = smart(s, e);
    if (c) {
      Engine.apply(c);
      let next = e;
      let depth = 0;
      while (c && c.next && depth++ < 5) {
        const nx = Engine.resolveNext(c, s);
        if (!nx) break;
        if (charIds.has(nx.id)) { charTriggerCount++; triggerHist[nx.id] = (triggerHist[nx.id] || 0) + 1; }
        if (!nx.repeat) { if (seen.has(nx.id)) dupViolation++; seen.add(nx.id); }
        if (nx.apply) { try { nx.apply(s); } catch (err) {} }
        break;
      }
    }
  }
  affEnd.affection += s.affection || 0;
  affEnd.affection_sister += s.affection_sister || 0;
  affEnd.affection_third += s.affection_third || 0;
}

console.log('=== 角色事件接入验证 ===');
console.log('周目数:', RUNS);
console.log('角色事件触发总次数:', charTriggerCount);
console.log('周目内重复违规:', dupViolation);
console.log('阶段覆盖:', JSON.stringify(stageCover));
console.log('平均终局好感: A=', (affEnd.affection / RUNS).toFixed(1),
  ' B=', (affEnd.affection_sister / RUNS).toFixed(1),
  ' C=', (affEnd.affection_third / RUNS).toFixed(1));
const never = CHAR_EVENTS.filter(e => !triggerHist[e.id]).map(e => e.id);
console.log('从未触发的事件数:', never.length, '/', CHAR_EVENTS.length);
if (never.length && never.length < 40) console.log('  未触发:', never.join(', '));
const top = Object.entries(triggerHist).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('触发 TOP10:', top.map(([k, v]) => k + ':' + v).join(', '));

/* ============ 第七轮新增断言：决裂 / 婚姻拒绝 API ============ */
let _pass = 0, _fail = 0;
const _ok = (n, c, e) => { if (c) { _pass++; } else { _fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };
const C = ctx.Characters;

_ok('周目内重复违规为 0', dupViolation === 0, 'dup=' + dupViolation);
_ok('全部 30 条角色事件至少触发一次', never.length === 0, '未触发 ' + never.length);
_ok('五阶段全覆盖（meet/crush/bond/rift/reconcile）',
  ['meet', 'crush', 'bond', 'rift', 'reconcile'].every(k => (stageCover[k] || 0) > 0),
  JSON.stringify(stageCover));
_ok('三角色平均终局好感均 > 70',
  affEnd.affection / RUNS > 70 && affEnd.affection_sister / RUNS > 70 && affEnd.affection_third / RUNS > 70,
  `A=${(affEnd.affection / RUNS).toFixed(1)} B=${(affEnd.affection_sister / RUNS).toFixed(1)} C=${(affEnd.affection_third / RUNS).toFixed(1)}`);
_ok('Characters.setRefused / isRefused 已导出', typeof C.setRefused === 'function' && typeof C.isRefused === 'function');
_ok('Characters.rejectMarriage / isMarriageRejected 已导出', typeof C.rejectMarriage === 'function' && typeof C.isMarriageRejected === 'function');
_ok('Characters.stageLabel 已导出', typeof C.stageLabel === 'function');
{
  const st = Engine.newLife({ cycle: 9999, luckBonus: 0 });
  C.setRefused(st, 'third');
  _ok('setRefused 后 isRefused=true', C.isRefused(st, 'third') === true);
  _ok('setRefused 后 stageLabel=已撇清', C.stageLabel(st, 'third') === '已撇清');
  const b = C.getAff(st, 'third');
  C.addAff(st, 'third', 50);
  _ok('决裂后正好感增益冻结', C.getAff(st, 'third') === b);
  C.rejectMarriage(st, 'sister');
  _ok('rejectMarriage 后 isMarriageRejected=true', C.isMarriageRejected(st, 'sister') === true);
  _ok('rejectMarriage 后 canMarry=false', C.canMarry(st, 'sister') === false);
}
console.log('第七轮专项断言：通过 ' + _pass + ' 项，失败 ' + _fail + ' 项');
if (_fail) process.exitCode = 1;
