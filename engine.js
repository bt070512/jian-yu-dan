/* ============================================================
   剑与丹 · 游戏引擎
   状态 / 事件抽取 / 结局判定 / 多周目 / 成就 / 存档
   ============================================================ */

const SAVE_KEY = 'jianyudan_save_v1';

/* ---------- 事件池（主事件库 + 角色情感事件库 + 季节事件库） ---------- */
/* 兼容性：若某个库未加载，自动跳过；全部缺失时回落 EVENTS，行为不变 */
let _seasonEventCache = null;      // 季节事件编译缓存（配置不变则只编译一次）
function seasonEvents() {
  if (_seasonEventCache) return _seasonEventCache;
  try {
    if (typeof seasonEventsFromConfig === 'function') {
      _seasonEventCache = seasonEventsFromConfig();
    } else if (typeof Season !== 'undefined' && Season.seasonEventsFromConfig) {
      _seasonEventCache = Season.seasonEventsFromConfig();
    } else {
      _seasonEventCache = [];
    }
  } catch (e) {
    console.warn('[engine] 季节事件编译失败，已忽略：', e.message);
    _seasonEventCache = [];
  }
  return _seasonEventCache;
}

function allEvents() {
  const chars = (typeof CHAR_EVENTS !== 'undefined' && Array.isArray(CHAR_EVENTS)) ? CHAR_EVENTS : [];
  const seas = seasonEvents();
  let list = EVENTS.slice();
  if (chars.length) list = list.concat(chars);
  if (seas.length) list = list.concat(seas);
  return list.length ? list : EVENTS;
}

/* ---------- 配置读取（带兜底，缺文件也能跑） ---------- */
function cfgMarriage() {
  if (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.marriage) return GAME_CONFIG.marriage;
  return { thresholds: { marriageAffection: 100 } };
}
function cfgDedup() {
  if (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.dedup) return GAME_CONFIG.dedup;
  return { seasonEventPolicy: { mode: 'once_per_year' } };
}

/* 婚后生活配置（第九轮）；缺失时返回等价默认值，行为与「无婚后系统」一致 */
function cfgPost() {
  const def = {
    enabled: true,
    defaultCooldownYears: 2,
    startMoney: 20,
    startStress: 0,
  };
  const p = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.postMarriage) || null;
  return p ? Object.assign({}, def, p) : def;
}

/* ---------- 数值配平配置（游戏时长 / 境界节奏的总开关），缺失时用等价默认值兜底 ---------- */
function cfgBalance() {
  const def = {
    startShou: 60, startAge: 12, shouPerYear: 4, growthMultiplier: 1.5,
    breakthroughHeal: { baseHealRatio: 0.25, healDecayPerRealm: 0.019, minHealRatio: 0.08, flatMin: 3 },
    shouCapMultiplier: 1.8,
    hardStepCap: 300, targetMinSteps: 120, targetMaxSteps: 200,
  };
  const b = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.balance) || null;
  if (!b) return def;
  return Object.assign({}, def, b, {
    breakthroughHeal: Object.assign({}, def.breakthroughHeal, b.breakthroughHeal || {}),
  });
}
function curSeasonKey(s) {
  if (typeof Season !== 'undefined' && Season.seasonOf) return Season.seasonOf(s).key;
  const keys = ['spring', 'summer', 'autumn', 'winter'];
  return keys[(s && s.seasonIdx) || 0];
}
function isSeasonalOncePerYear(e) {
  if (typeof Season !== 'undefined' && Season.isSeasonalOncePerYear) {
    return Season.isSeasonalOncePerYear(e, GAME_CONFIG);
  }
  if (!e || e.repeat) return false;
  if (e.once_per_year === true) return true;
  if (e.once_per_year === false) return false;
  return e.season != null && e.season !== 'any' && e.season !== '';
}

/* ---------- 优先级分档：剧情链事件加权（第四轮新增） ----------
   问题：角色线的 bond → rift → reconcile → final 是一条「一次性」链式剧情，
   必须逐环命中才能推进。但这些事件的 weight 通常低于季节/主线事件，
   在加权随机中会被「饿死」，导致婚姻结局实际不可达。
   方案：把角色线「后期阶段」事件提升到 character 档（priority 100），
   使其优先于季节事件被抽取；同时把季节/通用事件的 weight 归一化，
   避免它们被挤到几乎不出现。
   注意：只提升 priority，不改任何事件数值语义；季节事件仍在下一档正常登场。 */
// 第七轮修复（婚姻线可达性）：原仅 {bond, rift, reconcile} 享有 priority 100，
//   导致 meet / crush 阶段事件退化为 priority 0，与季节/日常事件同档竞争，
//   被 `usedSeasons` 挤掉后整条角色链在早期就断掉（实测 sister: met 83.7% → crush 27.3%）。
//   现把 meet / crush 纳入「角色链」档（priority 60）：
//     · 60 > 季节(0) > 日常(−100)，保证链不会因竞争被饿死；
//     · 60 < 羁绊/误会/和解(100)，保证链一旦成型仍以后期剧情为先。
//   两条档位各司其职，既恢复可达性，又保留早期事件的多样性。
const CHAIN_STAGES = { bond: 1, rift: 1, reconcile: 1 };
const CHAIN_EARLY_STAGES = { meet: 1, crush: 1 };
function eventPriority(e) {
  if (!e) return 0;
  if (typeof e.priority === 'number' && e.priority !== 0) return e.priority;
  const id = e.id || '';
  // 角色线后期阶段（羁绊/误会/和解）→ character 档，保证剧情链可达
  if (/^c_/.test(id) && CHAIN_STAGES[e.stage]) return 100;
  // 角色线早期阶段（相遇/心动）→ 次高档，避免被季节/日常事件挤出池子
  if (/^c_/.test(id) && CHAIN_EARLY_STAGES[e.stage]) return 60;
  return 0;
}

/* 第九轮（婚后事件）：婚后专属事件的优先级分档。
   婚后事件全部显式带 priority: 300（介于 mainStory 500 与 character 100 之间），
   保证在已婚状态下优先于季节/日常事件登场，但不会压过主线（家书/复仇/渡劫）。
   priority 显式写在事件数据里，此常量仅用于文档化与测试断言。 */
const POST_TIER = { bonding: 320, daily: 300, crisis: 340 };

/* ---------- 第九轮：婚后事件冷却 ---------- */
/* 冷却语义：事件触发后写入 s._postCooldown[id] = 当前年 + cooldown，
   在「当前年 < 解冻年」期间该事件不出池。跨周目由 newLife 重建 state 自动清空。
   兼容性：旧存档无 _postCooldown 字段 → 读取处兜底为空对象 → 无冷却，行为不变。 */
function postCooldownReady(e, s) {
  if (!e || !e.cooldown || e.cooldown <= 0) return true;
  const cd = s && s._postCooldown;
  if (!cd || !cd[e.id]) return true;
  const curYear = (s && typeof s.year === 'number') ? s.year : 1;
  return curYear >= cd[e.id];
}
function setPostCooldown(e, s) {
  if (!e || !e.cooldown || e.cooldown <= 0 || !s) return;
  if (!s._postCooldown || typeof s._postCooldown !== 'object') s._postCooldown = {};
  const curYear = (typeof s.year === 'number') ? s.year : 1;
  s._postCooldown[e.id] = curYear + e.cooldown;
}


/* 季节匹配（无 season.js 时回落为「全部匹配」） */
function seasonMatchesSafe(e, s) {
  if (typeof Season !== 'undefined' && Season.seasonMatches) return Season.seasonMatches(e, s);
  return true;
}

/* 按 weight 加权随机挑一个事件 */
function pickWeighted(list) {
  if (!list || !list.length) return null;
  let total = 0;
  list.forEach(e => total += (e.weight || 1));
  let r = Math.random() * total;
  for (const e of list) { r -= (e.weight || 1); if (r <= 0) return e; }
  return list[list.length - 1];
}


/* ---------- 剧情倾向：事件权重倍率 ---------- */
/* 依据事件 id / 地点 / 内容推断类别，施加 STORY_TENDENCIES 的权重偏好。
   默认 balanced 时倍率为 1，行为与旧版完全一致。 */
function tendencyMultiplier(e) {
  if (typeof STORY_TENDENCIES === 'undefined' || typeof loadConfig !== 'function') return 1;
  let cfg;
  try { cfg = loadConfig(); } catch (err) { return 1; }
  const tend = STORY_TENDENCIES[cfg?.ai?.tendency];
  if (!tend || !tend.weightBias) return 1;
  const id = e.id || '';
  let cls = null;
  if (/^c_/.test(id)) cls = 'romance';                       // 角色情感事件
  else if (/dan|pill|herb|plague|alchemy/.test(id)) cls = 'dan';
  else if (/sword|jian|tribulation|blade|duel/.test(id)) cls = 'sword';
  else if (/wolf|war|beast|revenge|kill|market|ancient/.test(id)) cls = 'combat';
  else if (/travel|wander|mortal|memory|dream|star|way/.test(id)) cls = 'wander';
  else if (/chance|secret|realm|inherit/.test(id)) cls = 'chance';
  const bias = cls ? tend.weightBias[cls] : undefined;
  return bias || 1;
}

/* ---------- 第五轮 O9：年龄段亲和倍率 ----------
   事件可选字段 ageBand（字符串或数组），取值：
     'youth' 12–39 / 'prime' 40–99 / 'elder' 100+ / 'any' 全年龄
   规则（向后兼容优先）：
     · 未标注 ageBand           → 返回 1.0（与旧版行为完全一致，零影响）
     · 标注 'any'               → 返回 1.0
     · 当前年龄命中 ageBand     → 返回 AGE_BOOST（提高命中，避免老年段只剩少数事件）
     · 当前年龄未命中           → 返回 AGE_PENALTY（仍可出现，只是概率降低）
   倍数可在 GAME_CONFIG.balance.ageBand 中配置；缺省 2.5 / 0.35。 */
function ageBandOf(age) {
  if (age < 40) return 'youth';
  if (age < 100) return 'prime';
  return 'elder';
}
function ageAffinity(e, age) {
  const band = e && e.ageBand;
  if (!band) return 1;
  if (band === 'any') return 1;
  const bands = Array.isArray(band) ? band : [band];
  if (bands.indexOf('any') >= 0) return 1;
  const cfg = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.balance && GAME_CONFIG.balance.ageBand) || {};
  const boost = cfg.boost != null ? cfg.boost : 2.5;
  const penalty = cfg.penalty != null ? cfg.penalty : 0.35;
  const cur = ageBandOf(typeof age === 'number' ? age : 12);
  return bands.indexOf(cur) >= 0 ? boost : penalty;
}

const Engine = {
  state: null,
  run: {},        // 本局临时数据

  /* ---------- 初始化 / 创建新周目 ---------- */
  newLife(meta) {
    const bonus = meta.luckBonus || 0;
    // 第七轮修复：重置选项幂等令牌池。
    //   claimChoice 的 WeakSet 按「choice 对象身份」去重；而事件对象是模块级单例，
    //   其 choices 是固定引用 —— 若不清空，新周目会误把上一周目已应用过的选项当作重复而吞掉，
    //   导致「所有选项都无效、好感恒为 0」的假象（多周目统计与连玩时会真实发生）。
    this._appliedChoices = new WeakSet();
    const cfg = (typeof loadConfig === 'function') ? loadConfig() : null;
    const diff = (typeof DIFFICULTIES !== 'undefined' && cfg && DIFFICULTIES[cfg.difficulty]) || null;
    const talents = rollTalents(3, bonus + (diff ? diff.luck : 0));
    const bal0 = cfgBalance();
    const s = {
      // 基础属性
      gen: 5, wu: 5, ji: 5, xin: 5, jian: 0, dan: 0,
      shou: bal0.startShou != null ? bal0.startShou : 60,
      age: bal0.startAge != null ? bal0.startAge : 12,
      power: 0,
      // 天赋加成
      talents: talents,
      // 剧情
      faction: null, affection: 0, place: 'qingshi',
      flags: {},
      herName: null, sisterName: null, rivalName: null,
      // —— 新增（可选字段，全部带默认值；旧存档无这些字段时不影响） ——
      playerName: (cfg && cfg.playerName) ? cfg.playerName : '',   // 玩家自定姓名，空 = 无名
      herName2: null,                    // 角色 C 姓名
      affection_sister: 0,               // 角色 B 好感
      affection_third: 0,                // 角色 C 好感
      aff_best: null,                    // 当前好感最高角色 key
      charFlags: {},                     // 角色线专属剧情标记（与主线 flags 隔离）
      cgSeenThisRun: {},                 // 本周目已看 CG（用于节点去重展示）
      marriageDone: {},                  // —— 第四轮：已走完婚姻流程的角色（防重复触发）——
      // —— 第七轮新增（全部可选字段，旧存档缺失时读取处兜底）——
      marriageRejected: {},              // 被明确拒绝婚姻的角色（永久关闭其婚姻线）
      marryPendingAt: {},                // 暂缓婚姻的记录 { key: {year, aff} }，用于 N 年后重试
      // —— 第九轮新增：婚后生活状态（全部为可选字段 + 默认值，旧存档缺失时读取处兜底）——
      //   设计目标：让"婚后"成为一个可被玩家感知、可累积、可影响走向的持续状态层。
      //   所有字段均为纯增量，不影响婚前任何逻辑；未被本局使用时恒为默认值。
      money: (function(){ const p = cfgPost(); return (p.startMoney != null ? p.startMoney : 20); })(),   // 家财：婚后日常收支的通用货币（单位「两」）
      stress: (function(){ const p = cfgPost(); return (p.startStress != null ? p.startStress : 0); })(), // 心累：家庭矛盾的累积压力（0..100，越高越易生事端）
      kids: [],                          // 子女列表 [{ name, age, gender, trait, born }]
      familyFlags: {},                   // 婚后剧情标记（与角色线 charFlags 隔离，避免互相污染）
      _postCooldown: {},                 // 婚后事件冷却表 { eventId: 剩余可触发的起始年 }
      difficulty: diff ? diff.key : 'normal',
      // 周目
      cycle: meta.cycle || 1,
      logs: [],
      history: [],   // 每回合的记录
      eventLog: [],  // 特殊事件记录
      usedEvents: {},
      achievementsThisRun: new Set(),
      reciteCount: 0,
      step: 0,
      maxSteps: null,      // —— 第四轮：去掉步数上限，仅凭寿元决定结束 ——
      dead: false,
      ending: null,
      // —— 第四轮新增：季节时间系统（全部为可选字段 + 默认值，旧存档无则自动补） ——
      year: 1,             // 第 N 年（从 1 开始）
      seasonIdx: 0,        // 0 春 / 1 夏 / 2 秋 / 3 冬
      season: 'spring',    // 当前季节 key
      actionsThisYear: 0,  // 本年度已用行动数（0..3）
      usedSeasons: {},     // 年度去重池（走完冬清空 → 季节事件跨年可复用）
      // —— 第四轮新增：婚姻系统（唯一配偶 + 全局锁） ——
      spouse_id: null,     // 唯一配偶字段（'herb'|'sister'|'third'|null）
      marriageLocked: false, // 全局锁：一旦确定配偶，其余角色婚姻事件不再触发
    };

    // 应用天赋
    talents.forEach(t => {
      Object.keys(t.eff).forEach(k => {
        if (s[k] !== undefined) s[k] += t.eff[k];
      });
    });

    // 随机人名（角色 C 姓名亦随机，但沿用同一命名库）
    s.herName = T.name('f');
    s.sisterName = T.name('f');
    s.rivalName = T.name('m');
    s.herName2 = T.name('f');

    // 让事件里的 s.log(text) 可用
    s.log = (text, type = 'narr') => {
      s.logs.push({ text, type, t: s.step });
      if (s.logs.length > 400) s.logs.shift();
    };

    this.state = s;
    this.log(`——第 ${s.cycle} 周目 ——`, 'sys');
    const who = s.playerName ? s.playerName : '你';
    this.log(s.playerName
      ? `${s.playerName}出生在青石镇，是一个普通得不能再普通的人。`
      : `你出生在青石镇，是一个普通得不能再普通的人。`, 'narr');
    let shown = false;
    if (talents.length) {
      const names = talents.map(t => `【${t.name}】`).join(' ');
      this.log(`先天禀赋：${names}`, 'talent');
      shown = true;
    }
    if (!shown) this.log('你没有什么特别的天赋。真的。', 'narr');
    return s;
  },

  /* ---------- 日志 ---------- */
  log(text, type = 'narr') {
    if (!this.state) return;
    this.state.logs.push({ text, type, t: this.state.step });
    if (this.state.logs.length > 400) this.state.logs.shift();
  },

  /* ---------- 属性变化 ---------- */
  /* 第六轮修复（防连点重复叠加）：
     本函数是「选项效果落地」的唯一入口，必须能抵御同一选项被重复调用。
     两层保护：
       ① 幂等令牌 —— 每个选项实例只会被成功应用一次（见 claimChoice）。
       ② 属性钳制 —— gen/wu/ji/xin/jian/dan 统一钳在 [0,100]，
          与好感一致；即使历史存档已被污染（如心性 151），reload 后也会被拉回上限。 */
  apply(choice) {
    const s = this.state;
    // 幂等：同一选项实例重复调用直接丢弃（返回空 diff）
    if (choice && !this.claimChoice(choice)) return [];
    const before = { ...s };
    try { choice.apply(s); } catch (e) { console.error(e); }
    // 属性上限钳制：六维属性与好感一律限制在 [0,100]
    this.clampAttrs(s);
    // 剧情倾向·情缘：好感增长加成（在 apply 之后统一放大，兼容所有既有选项）
    if (typeof STORY_TENDENCIES !== 'undefined' && typeof loadConfig === 'function') {
      const cfg = loadConfig();
      const tend = STORY_TENDENCIES[cfg?.ai?.tendency];
      if (tend && tend.affectionBonus && tend.affectionBonus !== 1) {
        ['affection', 'affection_sister', 'affection_third'].forEach(k => {
          const delta = (s[k] || 0) - (before[k] || 0);
          if (delta > 0) s[k] = Math.min(100, (before[k] || 0) + Math.round(delta * tend.affectionBonus));
        });
      }
    }
    // 记录变化（新增三个好感字段一并纳入 diff 展示）
    const diff = [];
    ['gen','wu','ji','xin','jian','dan','shou','power',
     'affection','affection_sister','affection_third'].forEach(k => {
      const d = (s[k] || 0) - (before[k] || 0);
      if (d !== 0) diff.push({ k, d });
    });
    // 吟诗计数
    if (choice.recite) s.reciteCount++;
    // 成就解锁
    if (choice.unlock) this.unlock(choice.unlock);
    s.eventLog.push({ event: this.run.currentTitle, choice: choice.text, diff, step: s.step });
    return diff;
  },

  /* ---------- 选项幂等令牌（第六轮修复） ---------- */
  /* 用途：确保「同一个选项实例」在一次周目内只会被应用一次。
     根因背景：移动端连点 / touchend 合成 click 会在 UI busy 释放后重复触发同一选项，
     导致属性被叠加（曾出现心性 151、日志刷屏）。
     实现：用 WeakSet 记录已应用过的 choice 对象 —— 不写进存档、不占用序列化空间、
     对象被回收时自动清理。跨周目/重开时 newRun 会重建 choice 对象，因此不受影响。
     兼容性：若调用方传入的 choice 为对象（所有既有事件均如此），行为完全向后兼容；
     传入非对象时（理论不存在）不做拦截，返回 true 以避免误伤。 */
  claimChoice(choice) {
    if (!choice || typeof choice !== 'object') return true;
    if (!this._appliedChoices) this._appliedChoices = new WeakSet();
    if (this._appliedChoices.has(choice)) return false;
    this._appliedChoices.add(choice);
    return true;
  },

  /* ---------- 属性钳制（第六轮修复） ---------- */
  /* 把六维属性（gen/wu/ji/xin/jian/dan）与三个好感统一限制在 [0,100]。
     幂等、就地生效；被 apply() 与 UI.renderStats() 共用，
     既防未来越界，也能把历史异常数据拉回合法区间。 */
  clampAttrs(s) {
    const st = s || this.state;
    if (!st) return st;
    ['gen','wu','ji','xin','jian','dan',
     'affection','affection_sister','affection_third'].forEach(k => {
      if (typeof st[k] === 'number') st[k] = Math.max(0, Math.min(100, st[k]));
    });
    return st;
  },

  /* ---------- 成就 ---------- */
  unlock(id) {
    const s = this.state;
    if (s.achievementsThisRun.has(id)) return;
    s.achievementsThisRun.add(id);
    const meta = loadMeta();
    if (!meta.achievements.includes(id)) {
      meta.achievements.push(id);
      saveMeta(meta);
    }
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (a) this.log(`🏆 成就解锁：${a.icon} ${a.name} —— ${a.desc}`, 'achieve');
  },

  /* ---------- 可抽事件 ---------- */
  /* 去重规则（三层）：
     1) 周目永久去重：非 repeat 且「非按年复用」的事件触发后写入 s.usedEvents
     2) 年度去重：带 season 的事件默认 once_per_year，触发后写入 s.usedSeasons，
        走完冬（跨年）时清空 → 季节性事件跨年可复用
     3) 事件内自锁：由事件自身用 charFlags 控制（如 *_met / *_final / marriageDone）
     兼容原有 e.req / e.place / e.weight 过滤逻辑，未做任何语义改动。 */
  availableEvents() {
    const s = this.state;
    const cur = curSeasonKey(s);
    const married = (typeof Characters !== 'undefined' && Characters.isMarried)
      ? Characters.isMarried(s)
      : !!(s.spouse_id || (s.flags && s.flags.married));
    return allEvents().filter(e => {
      // ① 周目永久去重：非 repeat、非按年复用的事件触发过即出池
      if (!e.repeat && !isSeasonalOncePerYear(e) && s.usedEvents[e.id]) return false;
      // ② 年度去重：按年复用的季节事件，本年度触发过即出池（跨年自动恢复）
      if (isSeasonalOncePerYear(e) && s.usedSeasons && s.usedSeasons[e.id]) return false;
      // ③ 季节过滤：绑定了具体季节的事件，只在对应季节出现
      //    （婚姻事件 season=null，视为全年，永不被过滤）
      const es = e.season;
      if (es != null && es !== 'any' && es !== '' && es !== cur) return false;
      if (e.req && !e.req(s)) return false;
      // ③.5 角色线决裂（第七轮）：已决裂角色的 c_* 事件永久出池
      //      （req 层已显式排除，这里作为引擎层兜底，未来新增事件自动生效）
      if (e.charLine && typeof Characters !== 'undefined'
          && Characters.isRefused && Characters.isRefused(s, e.charLine)) return false;
      // ③.6 婚后分层（第九轮）：婚后专属事件只在已婚时出现；
      //      婚前专属的阶段事件在已婚且已进入「婚后常态」后不再抢占池子。
      //      兼容性：未标注 post 的事件（全部婚前事件）行为完全不变。
      if (e.post === true && !married) return false;
      // ③.7 婚后事件冷却（第九轮）：触发过的事件在冷却期内不出池
      if (e.post === true && !postCooldownReady(e, s)) return false;
      if (e.place !== 'any' && e.place && e.place !== s.place) {
        // 事件地点不匹配时，若该事件是核心剧情（weight>=8）仍允许（营造"事情找上门"）
        if (e.weight < 8) return false;
      }
      return true;
    });
  },

  /* ---------- 婚姻事件是否可触发（好感达标 + 成婚节点 + 未锁定 + 复仇了结） ---------- */
  eligibleMarriageEvents() {
    const s = this.state;
    if (!s || s.marriageLocked) return [];
    // 需求2（第七轮）：家书已到、血仇未了 → 暂缓一切婚姻（情感线不得压过主线）。
    //   从未触发家书（go_home 假）→ 不受限，保证只走情感线的玩家仍能结婚。
    if (s.flags && s.flags.go_home === true && s.flags.revenge_done !== true) return [];
    const need = cfgMarriage()?.thresholds?.marriageAffection || 100;
    const cdYears = cfgMarriage()?.thresholds?.postponeRetryYears ?? 3;
    return seasonEvents().filter(e => {
      if (e.priority !== 900 || !e.usedFlag || !/^marry_/.test(e.usedFlag)) return false;
      const key = e.charLine;
      if (!key) return false;
      if (typeof Characters === 'undefined') return false;
      if (!(s.charFlags && s.charFlags[key + '_married_ready'])) return false;
      if (s.charFlags.marriageDone && s.charFlags.marriageDone[key]) return false;
      // 需求3（第七轮）：被明确拒绝过 → 永久关闭该角色婚姻（双保险）
      if (Characters.isMarriageRejected && Characters.isMarriageRejected(s, key)) return false;
      // 需求3（第七轮）：曾「暂缓」→ 需冷却期满才可再次触发（兑现路径）
      const pend = s.marryPendingAt && s.marryPendingAt[key];
      if (pend) {
        const since = (s.year || 1) - (pend.year || 0);
        if (since < cdYears) return false;   // 冷却未到
      }
      if (Characters.getAff(s, key) < need) return false;
      if (e.req && !e.req(s)) return false;
      return true;
    });
  },

  /* ---------- 抽取下一个事件（优先级分档 + 加权随机） ---------- */
  /* priority 分档：婚姻 900 → 必然优先；核心剧情 500；角色事件 100；季节 0。
     先取最高 priority 档，再在该档内按 weight × 剧情倾向倍率加权随机。 */
  drawEvent() {
    // 婚姻事件最高优先：好感 100 + 成婚节点 + 未锁定 → 必然优先登场
    const marry = this.eligibleMarriageEvents();
    if (marry.length) {
      // 若多位角色同时达标，按「好感更高者优先；并列按 A>B>C」保证确定性
      if (typeof Characters !== 'undefined') {
        marry.sort((a, b) => {
          const da = Characters.getAff(this.state, a.charLine) - Characters.getAff(this.state, b.charLine);
          if (da !== 0) return -da;
          const idx = k => ({ herb: 0, sister: 1, third: 2 }[k] ?? 9);
          return idx(a.charLine) - idx(b.charLine);
        });
      }
      return marry[0];
    }

    const pool = this.availableEvents();
    if (!pool.length) return null;
    // 优先级分档：取最高 priority 的一档（角色线剧情链 → 100，季节事件 → 0）
    let maxPri = -Infinity;
    for (const e of pool) { const p = eventPriority(e); if (p > maxPri) maxPri = p; }
    const tier = pool.filter(e => eventPriority(e) === maxPri);
    // 档内加权随机（weight 越高越可能；再叠加剧情倾向倍率 × 年龄段亲和倍率）
    let total = 0;
    const weights = tier.map(e => (e.weight || 1) * tendencyMultiplier(e) * ageAffinity(e, this.state.age));
    weights.forEach(w => total += w);
    let r = Math.random() * total;
    for (let i = 0; i < tier.length; i++) {
      r -= weights[i];
      if (r <= 0) return tier[i];
    }
    return tier[tier.length - 1];
  },

  /* ---------- 候选池耗尽时的三级兜底 ---------- */
  fallbackEvent() {
    const s = this.state;
    // 第七轮：决裂角色的 c_* 不得被兜底池重新捞回
    const notRefused = (e) => !(e.charLine && typeof Characters !== 'undefined'
      && Characters.isRefused && Characters.isRefused(s, e.charLine));
    // 第九轮（重要兜底修复）：兜底池必须与 availableEvents 应用同一套婚后门控，
    //   否则婚后事件会绕过 post 过滤，在未婚状态被 fallback 捞出来（实测 60 局泄漏 5511 次）。
    //   条件：post 事件 → 必须已婚 且 冷却期满。
    const married = (typeof Characters !== 'undefined' && Characters.isMarried)
      ? Characters.isMarried(s)
      : !!(s.spouse_id || (s.flags && s.flags.married));
    const postOk = (e) => (e.post !== true) || (married && postCooldownReady(e, s));
    // 一级：通用池（place='any' 且未被周目永久去重）
    const general = allEvents().filter(e =>
      e.place === 'any' && !e.repeat &&
      !(!isSeasonalOncePerYear(e) && s.usedEvents[e.id]) &&
      !(isSeasonalOncePerYear(e) && s.usedSeasons && s.usedSeasons[e.id]) &&
      (!e.req || e.req(s)) &&
      notRefused(e) && postOk(e) &&
      seasonMatchesSafe(e, s)
    );
    if (general.length) return pickWeighted(general);
    // 二级：可重复池（repeat:true）
    const repeats = allEvents().filter(e => e.repeat && (!e.req || e.req(s)) && notRefused(e) && postOk(e) && seasonMatchesSafe(e, s));
    if (repeats.length) return pickWeighted(repeats);
    // 三级：idle（由 UI 给出「岁月流转」叙述）
    return null;
  },

  /* ---------- 执行一次"行动"（= 推进一个季节） ---------- */
  /* 时间模型（第四轮）：
       每次行动推进 1 个季节：春→夏→秋→冬，走完冬即过一年。
       过冬结算：age+1、shou-1、usedSeasons 清空、seasonIdx 归零、year+1。
     修为增长按「每行动 = 1/4 年」折算（/4），避免年度成长速度膨胀 4 倍。
     向后兼容：若 season.js 未加载，本函数按 seasonIdx 自行推导，行为等价。 */
  step() {
    const s = this.state;
    if (s.dead) return null;
    s.step++;

    // ---- 季节推进 ----
    const seasonKeys = (typeof Season !== 'undefined' && Season.SEASON_KEYS) || ['spring', 'summer', 'autumn', 'winter'];
    if (typeof s.seasonIdx !== 'number' || s.seasonIdx < 0 || s.seasonIdx > 3) {
      const i = seasonKeys.indexOf(s.season);
      s.seasonIdx = i >= 0 ? i : 0;
    }
    s.season = seasonKeys[s.seasonIdx];

    // 修为增长速率 —— 由 cfgBalance().growthMultiplier 统一控制（默认 1.9）
    const bal = cfgBalance();
    // 第五轮 O8：难度档位（缺省 = 原行为；shouPerYearDelta 默认 0，healMult 默认 1）
    const diffCfg = (typeof DIFFICULTIES !== 'undefined' && DIFFICULTIES[s.difficulty]) ? DIFFICULTIES[s.difficulty] : null;
    const realmIdx = realmOf(s.power).index;
    const base = (s.gen + s.wu) / 12 + s.jian / 16 + s.dan / 20;
    const dGrowth = diffCfg ? diffCfg.growth : 1;
    const growth = Math.max(1, Math.floor(base * (1 + realmIdx * 0.22) * dGrowth / 4 * (bal.growthMultiplier || 1)));
    s.power += growth;
    // 境界突破：寿元按「当前值的一定比例」回血，比例随境界递减（破境延寿，不重置寿命）
    //   —— 修复历程（三次）：
    //     ① 原 `s.shou += Math.floor(newRealm.life / 4)`：life 是总寿元量级
    //        （元婴 600 / 化神 1200 / 仙人 9999），累加后寿元净增数千点 → 永远死不掉。
    //     ② 改为「补足到该境界上限」：上限阶梯太陡（元婴 150 → 化神 300 → 炼虚 500），
    //        突破节奏匀速而跃升幅度过大，寿元跌到 59 又弹回 147 → 仍在续命。
    //     ③ 最终方案（本处）：按比例回血，比例随境界递减（炼气 25% → 渡劫 8%），
    //        参数全部落在 cfgBalance().breakthroughHeal 中，可配置、可调参。
    //        安全阀：寿元软上限 = 起始寿元 × shouCapMultiplier（默认 1.8）——
    //        既保留「破境延寿」正反馈，又保证寿元池有限、游戏必然寿终，不会无限续命。
    //     ④ 第五轮 O8：新增难度倍率 healMult（游历 ×1.15 / 修行 ×1.00 / 问道 ×0.80），
    //        缺省 1 时与旧版完全一致。
    const newRealm = realmOf(s.power);
    if (newRealm.index > (s._lastRealm == null ? 0 : s._lastRealm)) {
      const bh = bal.breakthroughHeal || {};
      const ratio = Math.max(bh.minHealRatio || 0.08, (bh.baseHealRatio || 0.25) - newRealm.index * (bh.healDecayPerRealm || 0.019));
      const healMult = (diffCfg && typeof diffCfg.healMult === 'number') ? diffCfg.healMult : 1;
      const heal = Math.max(bh.flatMin || 3, Math.floor(s.shou * ratio * healMult));
      const startShou = bal.startShou != null ? bal.startShou : 60;
      const softCap = Math.floor(startShou * (bal.shouCapMultiplier || 1.8));
      s.shou = Math.min(softCap, s.shou + heal);
      s._lastRealm = newRealm.index;
    }

    // ---- 时间推进（走完冬才过一年） ----
    s.actionsThisYear = (s.actionsThisYear || 0) + 1;
    const wasWinter = s.seasonIdx === 3;
    if (wasWinter) {
      // 过冬结算：一年结束
      s.age += 1;
      // 第五轮 O8：难度对年耗的影响（游历 -1 = 年耗更少，问道 +1 = 年耗更多）；缺省 0
      const shouDelta = (diffCfg && typeof diffCfg.shouPerYearDelta === 'number') ? diffCfg.shouPerYearDelta : 0;
      s.shou -= ((bal.shouPerYear || 1) + shouDelta);
      s.year = (s.year || 1) + 1;
      s.seasonIdx = 0;
      s.season = seasonKeys[0];
      s.actionsThisYear = 0;
      s.usedSeasons = {};     // 年度去重池清空 → 季节事件跨年可复用
      // 第九轮：子女随年成长（旧存档无 kids → no-op，安全）
      if (typeof Characters !== 'undefined' && Characters.growKids) Characters.growKids(s, 1);
    } else {
      s.seasonIdx += 1;
      s.season = seasonKeys[s.seasonIdx];
    }

    // 寿元耗尽
    if (s.shou <= 0) return { type: 'death' };

    // 抽事件
    let e = this.drawEvent();
    // 池空兜底：三级兜底（通用池 → repeat 池 → idle）
    if (!e) e = this.fallbackEvent();
    if (!e) return { type: 'idle' };
    this.markUsed(e);
    // 移动地点
    if (e.place !== 'any' && e.place) s.place = e.place;
    this.run.currentTitle = e.title;
    return { type: 'event', event: e };
  },

  /* ---------- 事件去重标记（统一入口） ---------- */
  /* 任何途径让一个事件登场（正常抽取 / choice.next 链式跳转），都必须调用它。
     分派规则：
       · repeat 事件不占位（可无限重复）
       · 按年复用的季节事件 → 写 s.usedSeasons（走完冬清空）
       · 其余非 repeat 事件 → 写 s.usedEvents（周目内永久） */
  markUsed(event) {
    const s = this.state;
    if (!s || !event) return;
    // 第九轮：婚后事件冷却登记（无论是否 repeat 都要登记，冷却与去重正交）
    if (event.post === true) setPostCooldown(event, s);
    if (event.repeat) return;                         // 日常事件不占位
    if (isSeasonalOncePerYear(event)) {
      if (!s.usedSeasons) s.usedSeasons = {};
      s.usedSeasons[event.id] = true;                 // 年度去重（跨年可复用）
      return;
    }
    s.usedEvents[event.id] = true;                    // 周目永久去重
  },

  /* ---------- 解析 choice.next 链式事件 ---------- */
  /* 返回下一个事件的引用，并同步完成去重标记；调用方无需再手动标记。 */
  resolveNext(choice, state) {
    if (!choice || !choice.next) return null;
    const s = state || this.state;
    const nx = allEvents().find(x => x.id === choice.next);
    if (!nx) return null;
    this.markUsed(nx);
    if (nx.place !== 'any' && nx.place) s.place = nx.place;
    this.run.currentTitle = nx.title;
    return nx;
  },

  /* ---------- 结局判定 ---------- */
  /* 优先级（自高到低）：
     0) 归凡线 return_mortal_*  —— 玩家主动散功，覆盖一切（这是"放弃"的明确意志）
     1) 婚姻线 marry_*          —— 与某角色修成正果（*_married_ready + 好感≥85）
        注：婚姻线低于"登顶"类（飞升/剑仙/回到过去）——若两线同时满足，取登顶线；
            未登顶者婚姻线优先于 happy_ending。
     2) 原有主线：飞升 > 剑仙 > 回到过去 > 归隐 > 剑丹同辉 > 携手 > 魔道 > 复仇 > 孤剑 > 丹王 > 早逝 > 凡俗
     所有新判定均基于可选 flag / 好感字段，旧存档缺失时对应条件恒为 false，行为与旧版一致。 */
  judgeEnding(reason) {
    const s = this.state;
    const p = s.power, j = s.jian, d = s.dan, aff = s.affection;
    // 三角色好感取最高，用于婚姻线判定
    const affMap = {
      herb: s.affection || 0,
      sister: s.affection_sister || 0,
      third: s.affection_third || 0,
    };
    const bestKey = Object.keys(affMap).reduce((a, b) => (affMap[b] > affMap[a] ? b : a), 'herb');
    const bestAff = affMap[bestKey];
    const cf = s.charFlags || {};
    let id;

    // ---- 优先级 0：归凡线（主动散功，覆盖一切） ----
    if (s.flags.return_mortal) {
      const tgt = s.flags.return_mortal_target;
      if (tgt === 'herb' || tgt === 'sister' || tgt === 'third') {
        // 指定了归凡对象：若该对象已到成婚节点或被追求过，走对应结局
        id = 'return_mortal_' + tgt;
      } else if (bestAff >= 45) {
        id = 'return_mortal_' + bestKey;
      } else {
        id = 'return_mortal_alone';
      }
    }
    // ---- 优先级 1 及原有主线 ----
    else if (s.flags.tribulation_win && p >= 1200 && aff >= 50) id = 'immortal_ascend';
    else if (s.flags.tribulation_win && p >= 1200) id = 'sword_god';
    else if (s.flags.return_past && p >= 500) id = 'returned_past';
    // 婚姻线（仅次于登顶线）：以【唯一配偶字段 spouse_id】为准；
    //   有 spouse_id → 直接进对应婚姻结局；
    //   无 spouse_id 时保留旧逻辑回退（*_married_ready + 好感≥85），保证旧存档行为不变。
    else if (s.spouse_id && (s.spouse_id === 'herb' || s.spouse_id === 'sister' || s.spouse_id === 'third')) {
      id = 'marry_' + s.spouse_id;
    }
    else if (cf[bestKey + '_married_ready'] && bestAff >= 85) id = 'marry_' + bestKey;
    else if (s.flags.hermit) id = 'hermit_life';
    else if (j >= 80 && d >= 80) id = 'dual_immortal';
    else if (s.flags.won_raid && aff >= 50 && p >= 300) id = 'happy_ending';
    else if (s.flags.abandon_family || s.xin <= 0) id = 'demon_path';
    else if (s.flags.revenge_done && aff < 40) id = 'avenged';
    else if (d >= 60) id = 'dan_master';
    // ---- 自然寿终（寿元耗尽 / 寿元将尽）的分类 ----
    //   修复：原顺序为 `j>=70 && aff<30 → lonely_sword` → `age<50 → young_death`
    //   → `p<60 → ordinary_death`，导致「自然活到 50~70 岁寿终」被误判为 young_death（早逝），
    //   其余全部落到 lonely_sword 兜底 —— 玩家看到的就是「反复循环早逝」。
    //   现按「修为成就 → 有无道侣 → 年龄」重新分层：
    else if (reason === '寿元耗尽' || reason === '寿元将尽') {
      // 自然寿终：先看修为成就，再看道侣，最后按年龄分「早逝 / 长寿」
      if (s.age < 30) id = 'young_death';                 // 未及而立 → 早逝
      else if (p < 60) id = 'ordinary_death';             // 修为低微 → 凡人之死
      else if (aff >= 40 && p >= 150) id = 'happy_ending'; // 有道侣且修为不俗 → 携手仙途
      else if (j >= 70) id = 'lonely_sword';              // 剑意极高却无道侣 → 孤剑终老
      else id = 'lonely_sword';                           // 其余寿终 → 孤剑终老
    }
    else if (s.age < 30) id = 'young_death';
    else if (p < 60) id = 'ordinary_death';
    else if (aff >= 40 && p >= 150) id = 'happy_ending';
    else id = 'lonely_sword';

    s.ending = ENDINGS[id] || ENDINGS.lonely_sword;
    s.ending.id = id;
    s.dead = true;

    // 结局相关成就
    if (id === 'immortal_ascend') this.unlock('immortal');
    if (id === 'sword_god') this.unlock('sword_saint');
    if (id === 'dan_master') this.unlock('pill_master');
    if (id === 'young_death') this.unlock('die_young');
    if (id === 'demon_path') this.unlock('heart_demon');
    if (id === 'hermit_life') this.unlock('hermit');
    if (id === 'lonely_sword') this.unlock('lonely');
    // 新增结局成就
    if (id === 'marry_herb') this.unlock('marry_herb');
    if (id === 'marry_sister') this.unlock('marry_sister');
    if (id === 'marry_third') this.unlock('marry_third');
    if (/^return_mortal/.test(id)) this.unlock('return_mortal');
    if (j >= 80 && d >= 80) this.unlock('dan_jian');
    if (s.reciteCount >= 5) this.unlock('poet');

    return s.ending;
  },

  /* ---------- 结算并写入元存档 ---------- */
  settle() {
    const s = this.state;
    const meta = loadMeta();
    meta.cycle = (meta.cycle || 1) + 1;
    meta.totalRuns = (meta.totalRuns || 0) + 1;
    meta.luckBonus = Math.min(6, Math.floor(meta.totalRuns / 2));

    // 记录本周目特殊事件
    const record = {
      cycle: s.cycle,
      name: `${s.herName}/${s.sisterName}`,
      playerName: s.playerName || '',
      ending: s.ending ? s.ending.name : '未知',
      rank: s.ending ? s.ending.rank : '-',
      age: s.age,
      realm: realmOf(s.power).name,
      affection: s.affection,
      affection_sister: s.affection_sister || 0,
      affection_third: s.affection_third || 0,
      talents: s.talents.map(t => t.name),
      keyEvents: s.eventLog.filter(e => e.diff.length > 0 || true).slice(-12),
      achievements: [...s.achievementsThisRun],
      time: new Date().toLocaleString('zh-CN'),
    };
    meta.runs = meta.runs || [];
    meta.runs.unshift(record);
    if (meta.runs.length > 50) meta.runs.length = 50;

    // 成就：十世轮回
    if (meta.totalRuns >= 10 && !meta.achievements.includes('ten_lives')) {
      meta.achievements.push('ten_lives');
    }
    // 成就：抽中所有传说天赋
    const legend = TALENTS.filter(t => t.rarity >= 5).map(t => t.id);
    meta.seenTalents = meta.seenTalents || [];
    s.talents.forEach(t => { if (!meta.seenTalents.includes(t.id)) meta.seenTalents.push(t.id); });
    if (legend.every(id => meta.seenTalents.includes(id)) && !meta.achievements.includes('all_talents')) {
      meta.achievements.push('all_talents');
    }

    saveMeta(meta);
    return meta;
  },
};

/* ---------- 元存档（跨周目） ---------- */
function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const m = JSON.parse(raw);
      // 统一走规范化迁移：旧存档缺失字段自动补齐，既有值保持不变
      if (typeof normalizeMeta === 'function') return normalizeMeta(m);
      m.achievements = m.achievements || [];
      m.runs = m.runs || [];
      m.seenTalents = m.seenTalents || [];
      return m;
    }
  } catch (e) {}
  return { cycle: 1, totalRuns: 0, luckBonus: 0, achievements: [], runs: [], seenTalents: [] };
}
function saveMeta(m) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(m)); } catch (e) {}
}
function resetMeta() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

window.Engine = Engine;
window.loadMeta = loadMeta;
window.saveMeta = saveMeta;
window.resetMeta = resetMeta;
// 暴露数据常量，供 engine 内部与测试使用
window.EVENTS = EVENTS;
// 暴露事件优先级判定（供测试与调试）——第七轮新增，仅读取、无副作用
window.eventPriority = eventPriority;
// 第九轮：暴露婚后事件的冷却判定与分档（供测试与调试，仅读取、无副作用）
window.postCooldownReady = postCooldownReady;
window.POST_TIER = POST_TIER;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.ENDINGS = ENDINGS;
window.TALENTS = TALENTS;
window.realmOf = realmOf;
window.rollTalents = rollTalents;
