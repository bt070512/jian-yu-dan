/* ============================================================
   剑与丹 · 配置层（向后兼容）
   ------------------------------------------------------------
   设计原则（硬性约束）：
   1. 本文件新增的所有内容均为「可选字段 + 默认值」，不修改任何既有字段语义
   2. 旧存档（仅含 cycle/totalRuns/luckBonus/achievements/runs/seenTalents）
      经 normalizeMeta() 后可直接使用，缺失字段补齐默认值，不抛错
   3. 玩家姓名、AI 配置、难度均落在独立的 SAVE_KEY_V2 命名空间，
      与旧 SAVE_KEY ('jianyudan_save_v1') 完全隔离，旧存档读取路径零改动
   ============================================================ */

/* ---------- 存储键 ----------
   注意：SAVE_KEY 由 engine.js 声明（保持原有定义位置不变），
   此处仅声明新增的 CONFIG_KEY，避免同名 const 在多脚本全局作用域下重复声明报错。 */
const CONFIG_KEY = 'jianyudan_config_v1';    // —— 新增：玩家配置（姓名 / AI / 难度）——

/* ---------- 难度档位 ---------- */
/* growth：修为成长系数；threshold：判定阈值系数；luck：抽天赋幸运加成；risk：负面事件权重系数
   —— 第五轮新增（可选，缺省回落到原行为）：
   shouPerYearDelta：每年寿元消耗的增减量（-1 = 每年少耗 1 点，+1 = 每年多耗 1 点）
   healMult：破境回血系数倍率（1.15 = 回血更多，0.80 = 回血更少）
   两者缺省分别为 0 / 1，即完全等同旧版行为，旧配置读取零影响。 */
const DIFFICULTIES = {
  easy:   { key: 'easy',   name: '游历', desc: '成长更快，劫难更轻，适合看故事', growth: 1.35, threshold: 0.85, luck: 2, risk: 0.7, shouPerYearDelta: -1, healMult: 1.15 },
  normal: { key: 'normal', name: '修行', desc: '标准难度，平衡的成长与风险',       growth: 1.00, threshold: 1.00, luck: 0, risk: 1.0, shouPerYearDelta: 0,  healMult: 1.00 },
  hard:   { key: 'hard',   name: '问道', desc: '成长缓慢，劫难更重，结局更难达成', growth: 0.72, threshold: 1.20, luck: -1, risk: 1.4, shouPerYearDelta: 1,  healMult: 0.80 },
};

/* ---------- 角色性格（注入 AI 提示词 / 本地叙事变体） ---------- */
const PERSONALITIES = {
  gentle: { key: 'gentle', name: '温柔', desc: '她说话轻，先想别人，再想自己', tone: '温柔、含蓄、欲言又止' },
  sharp:  { key: 'sharp',  name: '锋利', desc: '她话少，句句带刃，心却比谁都软', tone: '锋利、克制、话里藏刀' },
  wild:   { key: 'wild',   name: '恣意', desc: '她笑的时候像风，不受拘束',     tone: '恣意、张扬、不拘礼数' },
};

/* ---------- 对话风格 ---------- */
const DIALOGUE_STYLES = {
  classical: { key: 'classical', name: '古典', desc: '半文半白，多用意象', prompt: '语言半文半白，讲究意象与留白' },
  plain:     { key: 'plain',     name: '平实', desc: '口语化，贴近日常',   prompt: '语言平实口语化，像身边人说话' },
  poetic:    { key: 'poetic',    name: '诗性', desc: '每一句都想写进诗里', prompt: '语言高度诗化，每句都带隐喻与韵律' },
};

/* ---------- 剧情倾向（影响事件权重） ---------- */
/* weightBias：对特定事件类别的权重倍率 */
const STORY_TENDENCIES = {
  balanced: { key: 'balanced', name: '均衡', desc: '各线并重，随缘而行', weightBias: {}, prompt: '各条线并重，不刻意偏向' },
  romance:  { key: 'romance',  name: '情缘', desc: '情感事件更易触发，好感涨得更快', weightBias: { romance: 2.0 }, affectionBonus: 1.25, prompt: '更侧重人物之间的情感与羁绊' },
  sword:    { key: 'sword',    name: '剑道', desc: '修炼与战斗事件更频繁',           weightBias: { sword: 1.8, combat: 1.5 }, prompt: '更侧重剑道修行与生死搏杀' },
  dan:      { key: 'dan',      name: '丹道', desc: '炼丹与济世事件更频繁',           weightBias: { dan: 1.8 }, prompt: '更侧重炼丹济世与仁心' },
  wander:   { key: 'wander',   name: '游历', desc: '奇遇与见闻事件更频繁',           weightBias: { wander: 1.8, chance: 1.5 }, prompt: '更侧重行走天下的奇遇与见闻' },
};

/* ---------- 默认配置 ---------- */
function defaultConfig() {
  return {
    // 玩家信息
    playerName: '',                 // 空 = 使用默认「无名」
    // 情感偏好：优先攻略哪个角色（影响初次相遇顺序权重，不强制）
    preferCharacter: 'auto',
    // AI 配置
    ai: {
      enabled: false,
      endpoint: '',
      key: '',
      model: 'gpt-4o-mini',
      personality: 'gentle',       // 角色性格
      dialogueStyle: 'classical',  // 对话风格
      tendency: 'balanced',        // 剧情倾向
    },
    difficulty: 'normal',
    // 音效（第五轮新增；缺省 = 开启、音量 0.6）—— 全部音色由 audio.js 实时合成，无素材文件
    sound: {
      enabled: true,
      volume: 0.6,        // 0 ~ 1
    },
    // 版本标记，便于后续迁移
    cfgVersion: 1,
  };
}

/* ---------- 配置读写（与旧存档隔离） ---------- */
function loadConfig() {
  const def = defaultConfig();
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return def;
    const c = JSON.parse(raw);
    // 深合并：任何缺失字段回落到默认值（向后兼容核心）
    const merged = {
      ...def, ...c,
      ai: { ...def.ai, ...(c.ai || {}) },
      sound: { ...def.sound, ...(c.sound || {}) },   // 第五轮：音效配置深合并（旧配置无 sound → 用默认）
    };
    // 合法性兜底
    if (!DIFFICULTIES[merged.difficulty]) merged.difficulty = 'normal';
    if (!PERSONALITIES[merged.ai.personality]) merged.ai.personality = 'gentle';
    if (!DIALOGUE_STYLES[merged.ai.dialogueStyle]) merged.ai.dialogueStyle = 'classical';
    if (!STORY_TENDENCIES[merged.ai.tendency]) merged.ai.tendency = 'balanced';
    if (typeof merged.sound.enabled !== 'boolean') merged.sound.enabled = true;
    if (typeof merged.sound.volume !== 'number' || isNaN(merged.sound.volume)) merged.sound.volume = 0.6;
    merged.sound.volume = Math.max(0, Math.min(1, merged.sound.volume));
    return merged;
  } catch (e) {
    return def;
  }
}

function saveConfig(cfg) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {}
}

function resetConfig() {
  try { localStorage.removeItem(CONFIG_KEY); } catch (e) {}
}

/* ---------- 旧存档规范化（迁移逻辑） ---------- */
/* 任何来源的 meta 数据，经过此函数后保证具备全部字段，且不改变既有值 */
function normalizeMeta(m) {
  const def = {
    cycle: 1, totalRuns: 0, luckBonus: 0,
    achievements: [], runs: [], seenTalents: [],
    onboardDone: false,          // 第五轮新增：新手引导是否已完成（旧存档缺失 → false）
  };
  if (!m || typeof m !== 'object') return def;
  const out = { ...def, ...m };
  out.achievements = Array.isArray(out.achievements) ? out.achievements : [];
  out.runs = Array.isArray(out.runs) ? out.runs : [];
  out.seenTalents = Array.isArray(out.seenTalents) ? out.seenTalents : [];
  out.cycle = typeof out.cycle === 'number' ? out.cycle : 1;
  out.totalRuns = typeof out.totalRuns === 'number' ? out.totalRuns : 0;
  out.luckBonus = typeof out.luckBonus === 'number' ? out.luckBonus : 0;
  out.onboardDone = !!out.onboardDone;
  // 旧存档的 runs 记录可能缺少后加字段（如 endingChars），补齐但不覆盖
  out.runs = out.runs.map(r => ({
    ...r,
    achievements: Array.isArray(r.achievements) ? r.achievements : [],
    keyEvents: Array.isArray(r.keyEvents) ? r.keyEvents : [],
    talents: Array.isArray(r.talents) ? r.talents : [],
  }));
  return out;
}

window.GameConfig = {
  CONFIG_KEY,
  DIFFICULTIES, PERSONALITIES, DIALOGUE_STYLES, STORY_TENDENCIES,
  defaultConfig, loadConfig, saveConfig, resetConfig, normalizeMeta,
};
