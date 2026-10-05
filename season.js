/* ============================================================
   剑与丹 · 季节时间系统（第四轮新增）
   ------------------------------------------------------------
   设计目标：把「一年 4 次行动」做成真正的时间系统。
     · 每次行动 = 推进 1 个季节（春 → 夏 → 秋 → 冬）
     · 走完「冬」= 过了一年：age+1、shou-1、清空年度去重池 usedSeasons
     · 事件可绑定 season 字段（'spring'|'summer'|'autumn'|'winter'|'any'/null）
     · 季節事件默认 once_per_year：当年触发过一次后本年度不再出现，跨年可复用
   向后兼容：
     · 本文件只新增全局常量与函数，不修改任何既有字段语义
     · 旧存档无 year/seasonIdx/usedSeasons 字段时，由 engine.newLife 补齐默认值
     · 若本文件未加载（缺失），engine 内部有同等兜底（SEASON 常量回退），
       行为等价于「无季节过滤」——即旧版本行为。
   ============================================================ */

/* ---------- 四季 ---------- */
const SEASONS = [
  { key: 'spring', name: '春', index: 0, desc: '草木初生，药苗返青', color: '#7fb069' },
  { key: 'summer', name: '夏', index: 1, desc: '暑气蒸腾，剑气如火', color: '#c0692b' },
  { key: 'autumn', name: '秋', index: 2, desc: '风起叶落，杀机暗藏', color: '#b08d3f' },
  { key: 'winter', name: '冬', index: 3, desc: '大雪封山，万籁俱寂', color: '#5b8dd6' },
];
const SEASON_BY_KEY = Object.fromEntries(SEASONS.map(s => [s.key, s]));
const SEASON_KEYS = SEASONS.map(s => s.key);

/* 当前季节对象（由 state.season / seasonIdx 决定） */
function seasonOf(s) {
  if (!s) return SEASONS[0];
  const idx = (typeof s.seasonIdx === 'number' && s.seasonIdx >= 0)
    ? s.seasonIdx % 4
    : (SEASON_KEYS.indexOf(s.season) >= 0 ? SEASON_KEYS.indexOf(s.season) : 0);
  return SEASONS[idx];
}

/* 季节显示名（如「春」/「盛夏」等） */
function seasonName(s) {
  const se = seasonOf(s);
  return se ? se.name : '春';
}

/* 年份显示（第 N 年，从 1 开始） */
function yearOf(s) {
  return (s && typeof s.year === 'number') ? s.year : 1;
}

/* ---------- 季节文案（idle / 过渡叙述） ---------- */
const SEASON_IDLE_TEXT = {
  spring: '这一年春天，什么都没有发生。药田返青，你比去年又长了一岁。',
  summer: '盛夏无风。你只是在院子里坐了整整一季，蝉声把日子磨得很薄。',
  autumn: '秋风起了，落叶扫过门槛。这一季，你什么也没做。',
  winter: '大雪封了山路。你守着炉火，把这一冬熬成了炭灰。',
};

/* 事件是否属于当前季节（season 为 any/null/undefined 视为全年） */
function seasonMatches(event, s) {
  if (!event) return true;
  const es = event.season;
  if (es == null || es === 'any' || es === '') return true;
  const se = seasonOf(s);
  return es === se.key;
}

/* 该事件是否为「按年复用」事件（默认行为） */
function isSeasonalOncePerYear(event, cfg) {
  if (!event) return false;
  if (event.repeat) return false;
  // 显式声明优先
  if (event.once_per_year === true) return true;
  if (event.once_per_year === false) return false;
  const mode = cfg?.dedup?.seasonEventPolicy?.mode;
  if (mode === 'once') return false;
  if (mode === 'repeat') return false;
  // 默认 once_per_year：带 season 的非 repeat 事件
  return event.season != null && event.season !== 'any' && event.season !== '';
}

/* ---------- 事件编译：把配置 JSON 里的事件还原为可执行事件 ----------
   配置里的 text / req / apply 是字符串（便于人类编辑），此处编译为函数。
   支持两种写法：
     · 直接字符串：当作返回该字符串的 text
     · "s => `...`" 形式：作为表达式求值（沙箱内可用 s / Characters / realmOf / Math 等）
   编译失败时降级（保留原值），并在控制台告警，绝不使游戏崩溃。
------------------------------------------------------------------------ */
function compileExpr(src, kind) {
  if (typeof src === 'function') return src;
  if (src == null) return undefined;
  if (typeof src !== 'string') return src;
  const trimmed = src.trim();
  // 第七轮：把 Characters.isRefused 注入沙箱，供季节事件 req 使用
  //   （如 `&& !isRefused(s,'herb')`）。未使用该参数的既有表达式不受影响。
  const _isRefused = (typeof Characters !== 'undefined' && Characters.isRefused)
    ? Characters.isRefused
    : function () { return false; };
  try {
    // 形如 "s => ..." / "function(s){...}" / 普通表达式
    if (/^(async\s+)?(\(|function\b|[A-Za-z_$][\w$]*\s*=>)/.test(trimmed)) {
      // eslint-disable-next-line no-new-func
      return new Function('s', 'Characters', 'realmOf', 'Math', 'rand', 'isRefused', `return (${trimmed});`)(src, Characters, typeof realmOf !== 'undefined' ? realmOf : null, Math, Math.random, _isRefused);
    }
    if (kind === 'text') {
      return function () { return trimmed; };
    }
    // eslint-disable-next-line no-new-func
    return new Function('s', 'Characters', 'realmOf', 'Math', 'rand', 'isRefused', `return (${trimmed});`)(src, Characters, typeof realmOf !== 'undefined' ? realmOf : null, Math, Math.random, _isRefused);
  } catch (e) {
    console.warn('[season] 事件表达式编译失败，已降级：', kind, trimmed.slice(0, 60), e.message);
    if (kind === 'text') return function () { return trimmed; };
    return undefined;
  }
}

/* 把一条配置事件（JSON 形态）编译为引擎可用事件 */
function compileEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const e = {
    id: raw.id,
    place: raw.place == null ? 'any' : raw.place,
    title: raw.title || '(无名事件)',
    weight: typeof raw.weight === 'number' ? raw.weight : 1,
    priority: typeof raw.priority === 'number' ? raw.priority : 0,
    season: raw.season == null ? null : raw.season,
    stage: raw.stage || null,
    stageGroup: raw.stageGroup || null,
    charLine: raw.charLine || null,
    once: !!raw.once,
    repeat: !!raw.repeat,
    once_per_year: raw.once_per_year,
    usedFlag: raw.usedFlag || raw.used_flag || null,
    affRange: raw.affRange || null,
    cg: raw.cg || null,
    // —— 第九轮新增（婚后事件专用，全部为可选；缺失时行为与旧版完全一致）——
    //   post: true        标记为「婚后专属事件」，仅当已婚后才进入候选池
    //   cooldown: N       触发后 N 年内不再出现（0/缺省 = 无冷却）
    //   postStage: '...'  婚后阶段分组（婚后·磨合 / 婚后·常态 / 婚后·中年 / 婚后·暮年），
    //                     用于 UI 提示与批量调度，不参与过滤本身
    //   tag: '...'        主题标签（日常 / 矛盾 / 育儿 / 经济 / 亲戚 / 事业 / 纪念 / 突发）
    post: !!raw.post,
    postStage: raw.postStage || null,
    tag: raw.tag || null,
    cooldown: typeof raw.cooldown === 'number' ? raw.cooldown : 0,
  };
  e.req = compileExpr(raw.req, 'req');
  e.text = compileExpr(raw.text, 'text');
  e.choices = Array.isArray(raw.choices) ? raw.choices.map(compileChoice) : [];
  return e;
}

function compileChoice(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const c = {
    text: raw.text || '(选择)',
    hint: raw.hint || '',
    next: raw.next || null,
    cg: raw.cg || null,
    recite: !!raw.recite,
    unlock: raw.unlock || null,
    charaff: raw.charaff || null,
    isMarriageAccept: !!raw.isMarriageAccept,
    result: raw.result || null,
  };
  const fn = compileExpr(raw.apply, 'apply');
  c.apply = fn || function () {};
  return c;
}

/* 把配置里的一组事件数组编译（跳过坏项，保持健壮） */
function compileEvents(list) {
  if (!Array.isArray(list)) return [];
  return list.map(compileEvent).filter(Boolean);
}

/* 取赛季事件配置（挂到 window.GAME_CONFIG.seasons，缺省为空数组） */
function seasonEventsFromConfig() {
  if (typeof GAME_CONFIG === 'undefined' || !GAME_CONFIG) return [];
  const raw = GAME_CONFIG.seasonEvents || GAME_CONFIG['season-events'] || [];
  return compileEvents(raw);
}

window.Season = {
  SEASONS, SEASON_BY_KEY, SEASON_KEYS, SEASON_IDLE_TEXT,
  seasonOf, seasonName, yearOf, seasonMatches, isSeasonalOncePerYear,
  compileExpr, compileEvent, compileChoice, compileEvents, seasonEventsFromConfig,
};
