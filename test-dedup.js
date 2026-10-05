/* 重复检测：验证「同一周目内，非 repeat 事件绝不重复触发」 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = __dirname;
const sb = {
  localStorage: (() => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => m[k] = v, removeItem: k => delete m[k] }; })(),
  console, Math, Date, JSON, Set,
};
sb.window = sb; vm.createContext(sb);
['data.js', 'events.js', 'engine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sb, { filename: f }));
const { Engine, EVENTS } = sb;

// 有策略的玩家（倾向推进主线 / 提升属性）
function smart(e, s) {
  let best = e.choices[0], bs = -999;
  e.choices.forEach(c => {
    let sc = Math.random() * 3;
    const t = c.text + (c.hint || '');
    if (/剑意|剑道|⚔|吟诗|风骨/.test(t)) sc += s.jian < 60 ? 6 : 1;
    if (/丹心|济世|炼丹/.test(t)) sc += s.dan < 60 ? 5 : 1;
    if (/心性|稳|守|定/.test(t)) sc += s.xin < 40 ? 4 : 1;
    if (/好感|情感|她|道侣|心动|义|念/.test(t)) sc += 5;
    if (/抢婚|核心|归隐|渡劫|爆发|传承|秘境/.test(t)) sc += 3;
    if (/回到过去|再看她一眼|非改不可/.test(t)) sc += (s.power >= 700 ? 2 : -20);
    if (/算了|放下/.test(t)) sc += (s.power < 700 ? 4 : 0);
    if (sc > bs) { bs = sc; best = c; }
  });
  return best;
}

const RUNS = Number(process.argv[2] || 300);
let dupViolations = [];   // 非 repeat 事件在同一周目重复
let perRunStats = [];
let poolStarvation = 0;   // 事件池枯竭（返回 idle 或只剩兜底）次数
let eventHitCount = {};

for (let run = 0; run < RUNS; run++) {
  const meta = sb.loadMeta();
  const s = Engine.newLife({ cycle: meta.cycle, luckBonus: meta.luckBonus });
  const seen = new Set();
  let guard = 0, idleCount = 0, eventCount = 0;
  const order = [];

  while (!s.dead && guard++ < 500) {
    const res = Engine.step();
    if (res.type === 'death') { Engine.judgeEnding('寿元耗尽'); break; }
    if (res.type === 'idle') { idleCount++; continue; }

    const e = res.event;
    eventCount++;
    eventHitCount[e.id] = (eventHitCount[e.id] || 0) + 1;
    order.push(e.id);

    // 核心校验：非 repeat 事件不得重复
    if (!e.repeat) {
      if (seen.has(e.id)) dupViolations.push({ run, id: e.id, order: order.slice() });
      seen.add(e.id);
    }

    const c = smart(e, s);
    Engine.apply(c);
    // 处理 next 链（走引擎统一方法，与 UI 行为一致）
    let nx = Engine.resolveNext(c, s), depth = 0;
    while (nx && depth++ < 5) {
      if (!nx.repeat && seen.has(nx.id)) dupViolations.push({ run, id: nx.id, chain: true });
      seen.add(nx.id);
      eventHitCount[nx.id] = (eventHitCount[nx.id] || 0) + 1;
      const c2 = smart(nx, s);
      Engine.apply(c2);
      nx = Engine.resolveNext(c2, s);
    }

    if (c.unlock) Engine.unlock(c.unlock);

    const force = (s.flags.hermit && s.age >= 80) ||
                  (s.flags.return_past && s.step >= 3) ||
                  (s.flags.tribulation_win && s.power >= 1200) ||
                  (s.age >= 200 && s.power >= 400);
    if (force || s.step >= s.maxSteps) { Engine.judgeEnding('天命已至'); break; }
  }
  if (!s.dead) Engine.judgeEnding('强制结束');
  if (idleCount > 0) poolStarvation++;
  perRunStats.push({ events: eventCount, idle: idleCount, steps: s.step, age: s.age, ending: s.ending ? s.ending.name : '?' });
  Engine.settle();
}

// 汇总
console.log(`\n===== 重复检测报告（${RUNS} 周目）=====`);
console.log(`\n【核心结论】非 repeat 事件重复触发次数：${dupViolations.length}`);
if (dupViolations.length) {
  dupViolations.slice(0, 5).forEach(v => console.log(`  ✗ 第${v.run}周目 「${v.id}」重复（链式:${!!v.chain}）`));
} else {
  console.log('  ✓ 全部周目内，非 repeat 事件均未重复触发');
}

const avgEvents = (perRunStats.reduce((a, p) => a + p.events, 0) / RUNS).toFixed(1);
const avgIdle = (perRunStats.reduce((a, p) => a + p.idle, 0) / RUNS).toFixed(2);
const maxEvents = Math.max(...perRunStats.map(p => p.events));
const avgAge = (perRunStats.reduce((a, p) => a + p.age, 0) / RUNS).toFixed(0);
console.log(`\n【单周目事件量】平均 ${avgEvents} 个 / 最多 ${maxEvents} 个`);
console.log(`【事件池枯竭】${poolStarvation} / ${RUNS} 周目出现过 idle（均值 ${avgIdle} 次）`);
console.log(`【平均寿命】${avgAge} 岁`);
const onceCount = EVENTS.filter(e => !e.repeat).length;
const repeatCount = EVENTS.filter(e => e.repeat).length;
console.log(`【候选池容量】一次性事件 ${onceCount} 个 + 可重复事件 ${repeatCount} 个；单周目最多触发 ${maxEvents} 个`);
console.log(`【容量余量】一次性事件富余 ${onceCount - maxEvents} 个（越充裕越不可能抽空）`);

// 覆盖度：哪些事件从未被抽到
const never = EVENTS.filter(e => !eventHitCount[e.id]).map(e => e.id);
console.log(`\n【事件覆盖】${EVENTS.length - never.length} / ${EVENTS.length} 个被触发`);
if (never.length) console.log(`  未触发：${never.join(', ')}`);

// 高频事件（说明权重合理）
const top = Object.entries(eventHitCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`\n【触发最多】${top.map(([k, v]) => `${k}(${v})`).join(', ')}`);

// 各年龄段候选池容量：对每个年龄抽样，统计该年龄下可用的一次性事件数
const bands = [
  ['少年 12-20', 12, 20], ['入道 20-35', 20, 35], ['成长 35-60', 35, 60],
  ['中后 60-120', 60, 120], ['晚期 120-200', 120, 200],
];
console.log('\n【各年龄段候选池容量（可用一次性事件数）】');
bands.forEach(([label, lo, hi]) => {
  let sum = 0, n = 0;
  for (let age = lo; age <= hi; age += Math.max(1, Math.floor((hi - lo) / 5))) {
    // 构造一个"属性充沛"的虚拟状态，只按年龄/flag 过滤（假设所有前置 flag 已具备）
    const st = {
      age, power: 400, gen: 30, wu: 30, ji: 30, xin: 30, jian: 40, dan: 40,
      shou: 100, affection: 60, faction: 'tianjian', place: 'any',
      flags: {
        met_oldsword: 1, met_herb: 1, dream_sword: 1, met_her: 1, her_secret: 1,
        know_master_past: 1, has_sister: 1, ancient_sword: 1, go_home: 1,
        revenge_done: 1, won_raid: 1, kneel: 1, lost_her: 1, reunion_friend: 1,
        demon_touch: 1, left_cultivator: 1, saved_cultivator: 1, abandon_family: 1,
        family_reunited: 1, has_beast: 1, sworn: 1, hurt: 0,
      },
      usedEvents: {},
    };
    const avail = EVENTS.filter(e => !e.repeat && (!e.req || e.req(st)) && !st.usedEvents[e.id]).length;
    sum += avail; n++;
  }
  console.log(`  ${label.padEnd(14)} 平均可用 ${(sum / n).toFixed(0)} 个事件`);
});

process.exit(dupViolations.length ? 1 : 0);
