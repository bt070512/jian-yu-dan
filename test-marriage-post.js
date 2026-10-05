/* ============================================================
   第九轮专项测试：婚后事件库 / 婚后状态层 / 链式推进 / 冷却去重
   ------------------------------------------------------------
   对应用户需求：
     1. 婚后专属事件 ≥ 30 条（实测 41 条），覆盖 8 大主题
     2. 婚后主线 + 支线可持续推进（状态标记 + next 链式触发）
     3. 去重与冷却机制（usedEvents + usedSeasons + charFlags + cooldown）
     4. 每条事件支持变量影响（好感 / 金钱 / 压力 / 子女）与分支
     5. 沿用既有数据格式与调度方式，不破坏婚前事件逻辑
   同时断言：婚前事件行为完全不变（回归保障）。
   ============================================================ */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = __dirname;

function makeCtx() {
  const store = {};
  const mkEl = t => {
    const el = { tagName: t || 'div', id: '', className: '', textContent: '', innerHTML: '', value: '', checked: false, title: '', dataset: {}, style: {}, children: [], disabled: false, _classes: new Set(),
      classList: { add(c) { el._classes.add(c) }, remove(c) { el._classes.delete(c) }, contains(c) { return el._classes.has(c) }, toggle(c, f) { f ? el._classes.add(c) : el._classes.delete(c) } },
      appendChild(c) { el.children.push(c); return c }, removeChild(c) { el.children = el.children.filter(x => x !== c) },
      querySelector() { return mkEl('div') }, querySelectorAll() { return [] }, closest() { return null }, remove() {}, addEventListener() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 } }, offsetWidth: 1, scrollTop: 0, scrollHeight: 1, onclick: null };
    return el;
  };
  const els = {}; const body = mkEl('body');
  const ctx = {
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, RegExp, Error, isNaN, parseInt, parseFloat,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } },
    setTimeout: f => { try { if (typeof f === 'function') f() } catch (e) {} return 0 }, clearTimeout: () => {}, confirm: () => false,
    document: { querySelector(s) { return els[s] || (els[s] = mkEl('div')) }, querySelectorAll() { return [] }, getElementById(id) { return els['#' + id] || (els['#' + id] = mkEl('div')) }, createElement(t) { return mkEl(t) }, addEventListener() {}, body },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['data.js', 'config.js', 'config-data.js', 'audio.js', 'season.js', 'characters.js', 'events.js', 'events-chars.js', 'engine.js', 'ai.js', 'onboarding.js', 'ui.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}

const ctx = makeCtx();
const E = ctx.Engine, C = ctx.Characters;
const SEASON_EVENTS = ctx.Season.seasonEventsFromConfig();
const POST_EVENTS = SEASON_EVENTS.filter(e => e.post === true);
const PRE_EVENTS = SEASON_EVENTS.filter(e => e.post !== true && e.priority !== 900);

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }
function section(t) { console.log('\n========== ' + t + ' =========='); }

/* 构造一个已婚状态 */
function marriedState(key, opts) {
  E._appliedChoices = null;
  const s = E.newLife({ cycle: 1, luckBonus: 0 });
  const o = opts || {};
  const k = key || 'herb';
  s.spouse_id = k;
  s.marriageLocked = true;
  s.flags.married = true;
  s.flags.married_to = k;
  s.charFlags = s.charFlags || {};
  s.charFlags[k + '_married_ready'] = true;
  s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { [k]: true });
  s.year = o.year || 5;
  s.age = o.age || 30;
  if (o.openDone !== false) s.familyFlags = { post_open_done: true };
  return s;
}

/* ---------------- 1. 事件库规模与结构 ---------------- */
section('1. 婚后事件库规模与结构（需求 1）');
{
  ok('婚后专属事件 ≥ 30 条', POST_EVENTS.length >= 30, `实测 ${POST_EVENTS.length} 条`);
  const tags = {};
  POST_EVENTS.forEach(e => { tags[e.tag || '未分类'] = (tags[e.tag || '未分类'] || 0) + 1; });
  const required = ['日常', '矛盾', '育儿', '经济', '亲戚', '事业', '纪念', '突发'];
  required.forEach(t => ok(`覆盖主题「${t}」`, (tags[t] || 0) > 0, `实际 ${tags[t] || 0} 条`));
  ok('全部带 priority ≥ 300', POST_EVENTS.every(e => e.priority >= 300));
  ok('全部带 stage=post', POST_EVENTS.every(e => e.stage === 'post'));
  ok('全部带 postStage 分组', POST_EVENTS.every(e => !!e.postStage));
  ok('全部有 text 与 choices(≥2)', POST_EVENTS.every(e => e.text && e.choices && e.choices.length >= 2));
  ok('全部 req 编译成功', POST_EVENTS.every(e => typeof e.req === 'function'));
  const stages = {};
  POST_EVENTS.forEach(e => { stages[e.postStage] = (stages[e.postStage] || 0) + 1; });
  ok('postStage 分组 ≥ 6 类', Object.keys(stages).length >= 6, Object.keys(stages).join(' / '));
}

/* ---------------- 2. 变量影响（需求 4） ---------------- */
section('2. 变量影响：好感 / 家财 / 心累 / 子女（需求 4）');
{
  // 家财
  E._appliedChoices = null;
  let s = marriedState('herb');
  ok('getMoney 默认兜底 20', C.getMoney({}) === 20);
  C.addMoney(s, -30);
  ok('addMoney 正确扣减', C.getMoney(s) === -10, `得 ${C.getMoney(s)}`);
  // 心累钳制
  ok('getStress 默认 0', C.getStress({}) === 0);
  C.addStress(s, 150);
  ok('addStress 上钳制到 100', C.getStress(s) === 100, `得 ${C.getStress(s)}`);
  C.addStress(s, -500);
  ok('addStress 下钳制到 0', C.getStress(s) === 0, `得 ${C.getStress(s)}`);

  // 子女
  ok('getKids 默认 []', C.getKids({}).length === 0);
  const kid = C.addKid(s, { name: '测试娃', gender: 'm', trait: '剑' });
  ok('addKid 返回子女对象', !!kid && kid.name === '测试娃');
  ok('kidCount = 1', C.kidCount(s) === 1);
  C.growKids(s, 3);
  ok('growKids 年龄 +3', C.getKids(s)[0].age === 3, `得 ${C.getKids(s)[0].age}`);
  const ks = C.kidStats(s);
  ok('kidStats.maxAge 正确', ks.maxAge === 3);
  ok('kidStats.hasSon 正确', ks.hasSon === true);
  ok('kidStats.byTrait 过滤正确', ks.byTrait('剑').length === 1 && ks.byTrait('丹').length === 0);

  // 婚后剧情标记
  C.setFamilyFlag(s, 'post_x');
  ok('setFamilyFlag / getFamilyFlag', C.getFamilyFlag(s, 'post_x') === true);
  C.setFamilyFlag(s, 'post_x', false);
  ok('setFamilyFlag 可置 false', C.getFamilyFlag(s, 'post_x') === false);

  // 事件 apply 真实改变变量
  const econ = POST_EVENTS.find(e => e.id === 'post_econ_1');
  E._appliedChoices = null;
  s = marriedState('herb');
  const beforeMoney = C.getMoney(s);
  econ.choices[0].apply(s);
  ok('事件 apply 真实改变家财', C.getMoney(s) === beforeMoney + 30, `得 ${C.getMoney(s)}`);

  const strife = POST_EVENTS.find(e => e.id === 'post_strife_1');
  const beforeStress = C.getStress(s);
  strife.choices[1].apply(s);   // 冷战 +18
  ok('事件 apply 真实改变心累', C.getStress(s) === beforeStress + 18, `得 ${C.getStress(s)}`);

  const preg = POST_EVENTS.find(e => e.id === 'post_child_1');
  const beforeAff = C.getAff(s, 'herb');
  preg.choices[0].apply(s);
  ok('事件 apply 真实改变好感', C.getAff(s, 'herb') === beforeAff + 12, `得 ${C.getAff(s, 'herb')}`);
}

/* ---------------- 3. 链式推进（需求 2） ---------------- */
section('3. 主线 + 支线链式推进（需求 2）');
{
  const byId = id => POST_EVENTS.find(e => e.id === id);

  // 所有 next 目标必须存在（防断链）
  const allIds = new Set(SEASON_EVENTS.map(e => e.id));
  const brokenLinks = [];
  POST_EVENTS.forEach(e => e.choices.forEach(c => {
    if (c.next && !allIds.has(c.next)) brokenLinks.push(e.id + ' → ' + c.next);
  }));
  ok('所有 next 目标事件均存在（无断链）', brokenLinks.length === 0, brokenLinks.join(', '));

  // next 目标必须是婚后事件（沿用婚后链，不误入婚前）
  const wrongTarget = [];
  POST_EVENTS.forEach(e => e.choices.forEach(c => {
    if (c.next) { const t = byId(c.next); if (t && !t.post) wrongTarget.push(e.id + ' → ' + c.next); }
  }));
  ok('next 目标均为婚后事件', wrongTarget.length === 0, wrongTarget.join(', '));

  const chains = [];
  POST_EVENTS.forEach(e => e.choices.forEach(c => { if (c.next) chains.push(e.id + '→' + c.next); }));
  ok('存在 ≥ 4 条显式链式分支', chains.length >= 4, `${chains.length} 条：${chains.join(', ')}`);

  // 完整走一遍：矛盾 → 冷战 → 冰释
  E._appliedChoices = null;
  const s = marriedState('herb');
  const e1 = byId('post_strife_1');
  ok('post_strife_1 首个矛盾事件可触发', e1.req(s) === true);
  e1.choices[1].apply(s);                       // 沉默三天 → 置 post_cold_war
  ok('冷战选项置 post_cold_war', C.getFamilyFlag(s, 'post_cold_war') === true);
  ok('冷战选项链向 post_strife_2', e1.choices[1].next === 'post_strife_2');
  const e2 = byId('post_strife_2');
  // post_strife_2 由「心累 ≥ 40」门控：冷战已 +18，此处补足到阈值再断言
  C.addStress(s, 40);
  ok('post_strife_2 前置满足（心累达标后可触发）', e2.req(s) === true);
  ok('post_strife_2 心累不足时不触发', (() => { const t = marriedState('herb'); t.familyFlags.post_strife_1_done = true; t.stress = 10; return e2.req(t) === false; })());
  const e3 = byId('post_reconcile_1');
  ok('post_reconcile_1 前置满足（可触发）', e3.req(s) === true);
  e3.choices[0].apply(s);
  ok('冰释后 post_cold_war 被清除', C.getFamilyFlag(s, 'post_cold_war') === false);
  ok('冰释后 post_reconcile_done 置位', C.getFamilyFlag(s, 'post_reconcile_done') === true);

  // 育儿链：有喜 → 临盆 → 夜啼
  E._appliedChoices = null;
  const s2 = marriedState('herb', { openDone: true });
  const c1 = byId('post_child_1');
  ok('post_child_1 前置满足', c1.req(s2) === true);
  c1.choices[0].apply(s2);
  ok('有喜后置 post_expecting', C.getFamilyFlag(s2, 'post_expecting') === true);
  ok('有喜链向 post_child_2', c1.choices[0].next === 'post_child_2');
  const c2 = byId('post_child_2');
  ok('post_child_2 前置满足', c2.req(s2) === true);
  c2.choices[0].apply(s2);
  ok('临盆后子女 +1', C.kidCount(s2) === 1);
  ok('临盆链向 post_child_3', c2.choices[0].next === 'post_child_3');
  const c3 = byId('post_child_3');
  ok('post_child_3 前置满足', c3.req(s2) === true);
}

/* ---------------- 4. 婚后事件池分层（需求 5：不破坏婚前逻辑） ---------------- */
section('4. 婚后分层：婚前未婚时婚后事件必须出池');
{
  E._appliedChoices = null;
  const single = E.newLife({ cycle: 1, luckBonus: 0 });
  single.age = 30; single.year = 5;
  ok('未婚：isMarried 为 false', C.isMarried(single) === false);
  E.state = single;
  const poolSingle = E.availableEvents();
  ok('未婚：婚后事件全部出池', poolSingle.every(e => e.post !== true), `${poolSingle.filter(e => e.post).length} 条泄漏`);

  E._appliedChoices = null;
  const mar = marriedState('herb');
  E.state = mar;
  const poolMar = E.availableEvents();
  const postInPool = poolMar.filter(e => e.post === true);
  ok('已婚：婚后事件进入候选池', postInPool.length > 0, `池中 ${postInPool.length} 条`);
  ok('已婚：婚前同阶段事件不被误伤', poolMar.some(e => e.post !== true));

  // 婚前事件的 req 不含 isMarried → 已婚时也可能出现（保持原行为）
  const prePoolUnmarried = (() => { E.state = single; return E.availableEvents().filter(e => e.post !== true).length; })();
  ok('婚前事件池在两种状态下均可抽取（原行为保留）', prePoolUnmarried > 0, `未婚池 ${prePoolUnmarried} 条`);
}

/* ---------------- 5. 去重与冷却（需求 3） ---------------- */
section('5. 去重与冷却机制（需求 3）');
{
  E._appliedChoices = null;
  const s = marriedState('herb');
  E.state = s;

  // 冷却判定
  const cdEv = POST_EVENTS.find(e => e.cooldown > 0);
  ok('存在带 cooldown 的事件', !!cdEv, cdEv && cdEv.id);
  ok('冷却函数：未触发时可用', ctx.postCooldownReady(cdEv, s) === true);
  E.markUsed(cdEv);
  ok('markUsed 写入冷却表', !!(s._postCooldown && s._postCooldown[cdEv.id]), JSON.stringify(s._postCooldown || {}));
  ok('冷却期内不可用', ctx.postCooldownReady(cdEv, s) === false);
  s.year += cdEv.cooldown;
  ok('冷却期满后恢复可用', ctx.postCooldownReady(cdEv, s) === true);

  // 冷却事件不出池
  E._appliedChoices = null;
  const s2 = marriedState('herb');
  E.state = s2;
  const repeatEv = POST_EVENTS.filter(e => e.repeat && e.cooldown > 0)[0];
  E.markUsed(repeatEv);
  const pool = E.availableEvents();
  ok('冷却期内的 repeat 事件不在池中', !pool.some(e => e.id === repeatEv.id));

  // 一次性婚后事件：触发后本局永久出池
  E._appliedChoices = null;
  const s3 = marriedState('herb');
  E.state = s3;
  const onceEv = POST_EVENTS.filter(e => e.once)[0];
  E.markUsed(onceEv);
  ok('once 事件触发后写入 usedEvents', s3.usedEvents[onceEv.id] === true);
  ok('once 事件触发后出池', !E.availableEvents().some(e => e.id === onceEv.id));

  // 三层去重结构仍完整
  ok('usedEvents 层存在', typeof s3.usedEvents === 'object');
  ok('usedSeasons 层存在', typeof s3.usedSeasons === 'object');
  ok('charFlags 层存在', typeof s3.charFlags === 'object');

  // 跨周目冷却清空
  E._appliedChoices = null;
  const s4 = E.newLife({ cycle: 2, luckBonus: 0 });
  ok('新周目冷却表清空', !s4._postCooldown || Object.keys(s4._postCooldown).length === 0);
}

/* ---------------- 6. 婚后调度优先级 ---------------- */
section('6. 调度优先级：婚后事件优先于季节，次于主线/婚姻');
{
  E._appliedChoices = null;
  const s = marriedState('herb');
  E.state = s;
  // 排除婚姻事件（marriageLocked 已锁 → 不会出现），构造纯分档场景
  const postEv = POST_EVENTS[0];
  ok('婚后事件 priority ≥ 300', postEv.weight > 0 && postEv.priority >= 300);
  ok('婚后事件 priority < 主线 500', postEv.priority < 500);
  ok('婚后事件 priority > 角色链 100', postEv.priority > 100);
  ok('POST_TIER 常量已导出', !!ctx.POST_TIER);

  // 1000 次抽样：已婚状态下婚后事件命中率应显著
  let hits = 0;
  for (let i = 0; i < 1000; i++) {
    E._appliedChoices = null;
    const st = marriedState('herb', { year: 5 });
    E.state = st;
    const e = E.drawEvent();
    if (e && e.post === true) hits++;
  }
  ok('已婚状态下婚后事件抽取命中率 > 40%', hits > 400, `实测 ${(hits / 10).toFixed(1)}%`);

  // 婚前未婚状态：婚后事件命中率必须为 0
  let leak = 0;
  for (let i = 0; i < 500; i++) {
    E._appliedChoices = null;
    const st = E.newLife({ cycle: 1, luckBonus: 0 });
    st.age = 30; st.year = 5;
    E.state = st;
    const e = E.drawEvent();
    if (e && e.post === true) leak++;
  }
  ok('未婚状态下婚后事件零泄漏', leak === 0, `泄漏 ${leak} 次`);

  // 完整长局仿真：以「触发时刻是否已婚」为准，统计真实泄漏
  //   （第七轮修复后几乎所有局都会结婚，因此必须按时刻判定，不能只看结局）
  let realLeak = 0, legalPost = 0, runs = 0;
  for (let t = 0; t < 30; t++) {
    E._appliedChoices = null;
    const st = E.newLife({ cycle: 1, luckBonus: 0 });
    E.state = st;
    for (let i = 0; i < 200 && !st.dead; i++) {
      const r = E.step();
      if (!r) break;
      if (r.type === 'event' && r.event) {
        if (r.event.post) { if (C.isMarried(st)) legalPost++; else realLeak++; }
        const c = r.event.choices && r.event.choices[0];
        if (c) { try { E.apply(c); } catch (e) { } }
        if (c && c.next) E.resolveNext(c, st);
      }
      if (r.type === 'death') break;
    }
    runs++;
  }
  ok('30 局长仿真：未婚时刻零泄漏（含兜底池）', realLeak === 0, `泄漏 ${realLeak} 次`);
  ok('30 局长仿真：婚后事件正常大量出现', legalPost > 100, `合法 ${legalPost} 次`);
}

/* ---------------- 7. 长期婚后推进仿真（无死循环、事件多样） ---------------- */
section('7. 长期婚后仿真：可持续推进、无单一事件霸屏');
{
  E._appliedChoices = null;
  const s = marriedState('herb', { year: 4, age: 28 });
  E.state = s;
  s.shou = 200;
  const seen = {};
  let steps = 0, postCount = 0;
  for (let i = 0; i < 260 && !s.dead; i++) {
    const res = E.step();
    if (!res) break;
    steps++;
    if (res.type === 'event' && res.event) {
      seen[res.event.id] = (seen[res.event.id] || 0) + 1;
      if (res.event.post) postCount++;
      // 自动做出第一个选择，推进剧情
      const c = res.event.choices && res.event.choices[0];
      if (c) { try { E.apply(c); } catch (e) { } }
      if (c && c.next) { E.resolveNext(c, s); }
    }
    if (res.type === 'death') break;
  }
  ok('婚后仿真能持续推进 ≥ 60 步', steps >= 60, `实际 ${steps} 步`);
  ok('婚后事件实际被触发 ≥ 15 次', postCount >= 15, `实际 ${postCount} 次`);
  const distinct = Object.keys(seen).length;
  ok('事件种类数 ≥ 12（无事件霸屏）', distinct >= 12, `实际 ${distinct} 种`);
  const maxRepeat = Math.max(...Object.values(seen));
  // 重复率断言：单事件出现次数 ≤ 总步数的 12%（含 repeat 日常事件的合理复现）
  ok('单一事件重复率 ≤ 12%', maxRepeat / steps <= 0.12, `最高 ${maxRepeat} 次 / ${steps} 步 = ${(maxRepeat / steps * 100).toFixed(1)}%`);
  // 婚后状态被真实使用
  ok('仿真中家财字段被使用', typeof s.money === 'number');
}

/* ---------------- 8. 旧存档兼容（向后兼容硬约束） ---------------- */
section('8. 旧存档兼容：无婚后字段时不崩溃、行为不变');
{
  E._appliedChoices = null;
  const old = E.newLife({ cycle: 1, luckBonus: 0 });
  // 模拟旧存档：删除所有第九轮字段
  delete old.money; delete old.stress; delete old.kids;
  delete old.familyFlags; delete old._postCooldown;
  ok('无 money 字段 → getMoney 兜底', C.getMoney(old) === 20);
  ok('无 stress 字段 → getStress 兜底', C.getStress(old) === 0);
  ok('无 kids 字段 → getKids 兜底', C.getKids(old).length === 0);
  ok('无 kids 字段 → kidStats 不崩溃', C.kidStats(old).count === 0);
  ok('无 familyFlags → getFamilyFlag 兜底 false', C.getFamilyFlag(old, 'x') === false);
  ok('无 _postCooldown → 冷却判定不崩溃', ctx.postCooldownReady(POST_EVENTS[0], old) === true);
  ok('无已婚标记 → isMarried false', C.isMarried(old) === false);
  E.state = old;
  ok('旧存档 availableEvents 不崩溃', E.availableEvents().length > 0);
  // 旧存档也能正常走 step
  let crashed = false;
  try { for (let i = 0; i < 8; i++) E.step(); } catch (e) { crashed = true; }
  ok('旧存档 step 不崩溃', crashed === false);
}

/* ---------------- 9. 婚前事件零改动回归 ---------------- */
section('9. 婚前事件零改动（需求 5：不破坏原逻辑）');
{
  ok('婚前季节事件数量不变（52 条）', PRE_EVENTS.length === 52, `实际 ${PRE_EVENTS.length}`);
  ok('婚姻事件仍为 3 条 priority=900', SEASON_EVENTS.filter(e => e.priority === 900).length === 3);
  ok('婚前事件无一被误标 post', PRE_EVENTS.every(e => e.post !== true));
  const preReqOk = PRE_EVENTS.every(e => typeof e.req === 'function');
  ok('婚前事件 req 全部编译成功', preReqOk);
  ok('总事件数 = 52 + 3 + 41', SEASON_EVENTS.length === 96, `实际 ${SEASON_EVENTS.length}`);
}

console.log('\n============================================================');
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
if (fail === 0) console.log('✅ 婚后事件库专项全部通过 —— 30+ 事件 / 链式推进 / 冷却去重 / 变量影响 / 旧逻辑不变');
else console.log('❌ 存在失败项，请检查');
console.log('============================================================');
process.exit(fail === 0 ? 0 : 1);
