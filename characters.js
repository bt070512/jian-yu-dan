/* ============================================================
   剑与丹 · 可攻略角色定义
   ------------------------------------------------------------
   兼容性设计：
   - 角色 A（药谷姑娘）= 现有 herName + affection，字段完全沿用，零改动
   - 角色 B（师姐）     = 现有 sisterName，好感度用可选字段 affection_sister（默认 0）
   - 角色 C（新角色·魔宗少主/商会女掌柜）= 新增 herName2 + affection_third（默认 0）
   所有新增字段均通过 Engine.getAff(s, charId) 统一读写，
   旧存档无这些字段时自动按 0 处理，不影响任何既有逻辑。
   ============================================================ */

/* ---------- 角色列表 ----------
   key：内部标识
   nameField：该角色姓名存放的状态字段
   affField：该角色好感度存放的状态字段（含默认值语义）
   baseAff：既有 affection 字段名（角色 A 复用旧字段）
*/
const CHARACTERS = [
  {
    key: 'herb',
    code: 'A',
    nameField: 'herName',
    affField: 'affection',          // —— 现有字段，保持不变 ——
    legacy: true,
    title: '药谷姑娘',
    faction: 'wandan',
    desc: '丹霞谷的药修。话不多，手很稳，笑起来像晒过太阳的草。',
    personality: 'gentle',
    color: '#7fb069',
    // 五阶段解锁阈值（好感度）
    stageGate: { meet: 0, crush: 20, bond: 45, rift: 70, reconcile: 85 },
  },
  {
    key: 'sister',
    code: 'B',
    nameField: 'sisterName',
    affField: 'affection_sister',   // —— 新增可选字段，默认 0 ——
    legacy: false,
    title: '剑宗师姐',
    faction: 'tianjian',
    desc: '天剑宗最冷的剑。她从不与人同练，剑出必见血。',
    personality: 'sharp',
    color: '#5b8dd6',
    stageGate: { meet: 0, crush: 20, bond: 45, rift: 70, reconcile: 85 },
  },
  {
    key: 'third',
    code: 'C',
    nameField: 'herName2',
    affField: 'affection_third',    // —— 新增可选字段，默认 0 ——
    legacy: false,
    title: '血海修罗',
    faction: 'xuehai',
    desc: '血海魔宗的少主。她生在血里，却总在问「为什么非要这样」。',
    personality: 'wild',
    color: '#c0392b',
    stageGate: { meet: 0, crush: 20, bond: 45, rift: 70, reconcile: 85 },
  },
];

const CHAR_BY_KEY = Object.fromEntries(CHARACTERS.map(c => [c.key, c]));

/* ---------- 五阶段定义 ---------- */
const STAGES = {
  meet:      { key: 'meet',      name: '初识',   order: 1, min: 0 },
  crush:     { key: 'crush',     name: '暧昧',   order: 2, min: 20 },
  bond:      { key: 'bond',      name: '羁绊',   order: 3, min: 45 },
  rift:      { key: 'rift',      name: '误会',   order: 4, min: 70 },
  reconcile: { key: 'reconcile', name: '和解',   order: 5, min: 85 },
};

/* ---------- 好感度统一读写（兼容旧存档） ---------- */
function getAff(s, charKey) {
  const c = CHAR_BY_KEY[charKey];
  if (!c) return 0;
  const v = s?.[c.affField];
  return typeof v === 'number' ? v : 0;   // 旧存档缺字段 → 0
}

function addAff(s, charKey, delta) {
  const c = CHAR_BY_KEY[charKey];
  if (!c || !s) return;
  // 第七轮：决裂后好感冻结 —— 忽略一切正增益（负增益仍允许，供剧情使用）。
  //   旧存档无 *_refused 标记 → isRefused 恒 false → 行为与旧版完全一致。
  if (delta > 0 && isRefused(s, charKey)) return 0;
  const cur = getAff(s, charKey);
  const next = Math.max(0, Math.min(100, cur + delta));
  s[c.affField] = next;
  // 同步维护"最高好感角色"，供结局判定使用（新字段，旧存档自动补）
  const best = bestCharacter(s);
  s.aff_best = best ? best.key : null;
  return next - cur;
}

function setAff(s, charKey, value) {
  const c = CHAR_BY_KEY[charKey];
  if (!c || !s) return;
  s[c.affField] = Math.max(0, Math.min(100, value));
}

/* 找出好感度最高的角色（并列时按 角色A > B > C 顺序，保证确定性） */
function bestCharacter(s) {
  let best = null, bestV = -1;
  for (const c of CHARACTERS) {
    const v = getAff(s, c.key);
    if (v > bestV) { bestV = v; best = c; }
  }
  return bestV > 0 ? best : null;
}

/* 某角色当前所处阶段（依据好感度） */
function stageOf(s, charKey) {
  const v = getAff(s, charKey);
  let st = STAGES.meet;
  for (const k of ['meet', 'crush', 'bond', 'rift', 'reconcile']) {
    if (v >= STAGES[k].min) st = STAGES[k];
  }
  return st;
}

/* ---------- 决裂 / 婚姻拒绝（第七轮新增，全部为可选字段 + 默认值） ---------- */
/* 设计说明：
     · 「决裂」= 玩家在角色事件里明确推开/拒绝/转身离开 → 该角色线整体关闭
       （后续 c_* 事件、季节好感事件、婚姻事件均不再触发，好感冻结）。
     · 「拒绝婚姻」= 在婚姻事件里选「拒绝」→ 仅永久关闭该角色的婚姻线，
       角色日常线不受影响。
   两者语义分离，分别写 charFlags.<key>_refused 与 marriageRejected[key]。
   旧存档缺失这些字段 → 一律返回 false，行为与旧版一致。 */

/* 该角色线是否已决裂（永久关闭） */
function isRefused(s, charKey) {
  if (!s || !CHAR_BY_KEY[charKey]) return false;
  const cf = s.charFlags || {};
  if (cf[charKey + '_refused']) return true;
  // 兼容：被拒绝婚姻的角色的角色线也不再推进（避免"拒绝了还继续暧昧"）
  if (s.marriageRejected && s.marriageRejected[charKey]) return true;
  return false;
}

/* 置位决裂标记（永久关闭该角色线） */
function setRefused(s, charKey) {
  if (!s || !CHAR_BY_KEY[charKey]) return false;
  s.charFlags = s.charFlags || {};
  s.charFlags[charKey + '_refused'] = true;
  return true;
}

/* 该角色的婚姻线是否已被明确拒绝（永久关闭其婚姻） */
function isMarriageRejected(s, charKey) {
  return !!(s && s.marriageRejected && s.marriageRejected[charKey]);
}

/* 拒绝婚姻：永久关闭该角色婚姻线（同时写 marriageDone 双保险） */
function rejectMarriage(s, charKey) {
  if (!s || !CHAR_BY_KEY[charKey]) return false;
  if (!s.marriageRejected || typeof s.marriageRejected !== 'object') s.marriageRejected = {};
  s.marriageRejected[charKey] = true;
  markMarriageDone(s, charKey);
  return true;
}

/* 阶段显示名：决裂后不再显示好感阶段，改为「已撇清」 */
function stageLabel(s, charKey) {
  if (isRefused(s, charKey)) return '已撇清';
  return stageOf(s, charKey).name;
}

/* ---------- 婚姻系统（第四轮新增，全部为可选字段 + 默认值） ---------- */

/* 读取唯一配偶（非法值视为无配偶） */
function spouseOf(s) {
  const v = s?.spouse_id;
  return (v === 'herb' || v === 'sister' || v === 'third') ? v : null;
}

/* 是否已锁定配偶（单周目唯一配偶限制） */
function isMarriageLocked(s) {
  return !!(s && (s.marriageLocked || spouseOf(s)));
}

/* 锁定配偶：写入唯一配偶字段 + 全局锁 + 已走完标记 */
function lockMarriage(s, charKey) {
  if (!s || !CHAR_BY_KEY[charKey]) return false;
  s.spouse_id = charKey;
  s.marriageLocked = true;
  markMarriageDone(s, charKey);
  return true;
}

/* 标记某角色的婚姻事件已走完（同意/拒绝/暂缓均写入，防止重复触发） */
function markMarriageDone(s, charKey) {
  if (!s || !CHAR_BY_KEY[charKey]) return;
  if (!s.marriageDone || typeof s.marriageDone !== 'object') s.marriageDone = {};
  s.marriageDone[charKey] = true;
  // 同时镜像到 charFlags.marriageDone，兼容事件 req 中直接读 charFlags 的写法
  if (s.charFlags && typeof s.charFlags === 'object') {
    s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { [charKey]: true });
  }
}

/* 某角色婚姻事件今日是否可触发 */
function canMarry(s, charKey, need) {
  const threshold = typeof need === 'number' ? need : 100;
  if (!s || !CHAR_BY_KEY[charKey]) return false;
  if (isRefused(s, charKey)) return false;            // 已决裂 → 不可婚
  if (isMarriageRejected(s, charKey)) return false;   // 已拒绝 → 不可婚
  if (isMarriageLocked(s)) return false;
  if (s.marriageDone && s.marriageDone[charKey]) return false;
  if (!(s.charFlags && s.charFlags[charKey + '_married_ready'])) return false;
  return getAff(s, charKey) >= threshold;
}

/* ---------- 婚后生活状态（第九轮新增，全部为可选字段 + 默认值） ----------
   设计目标：把「婚后」从「一个结局判定」变成「一段可继续游玩的旅程」。
   所有读写都走这里，保证旧存档（无这些字段）行为与旧版完全一致。
   字段语义：
     · money      家财（两）：可正可负，负值表示欠债；上限不钳制但建议 event 内自控。
     · stress     心累（0..100）：家庭矛盾累积值；越高越容易触发矛盾事件。
     · kids       子女数组 [{ name, age, gender, trait, born }]
     · familyFlags 婚后剧情标记（与 charFlags 隔离）
     · _postCooldown 婚后事件冷却表 { eventId: 解冻年份 } */

/* 是否已婚（唯一判定入口；旧存档无字段 → false） */
function isMarried(s) {
  if (!s) return false;
  return !!(spouseOf(s) || (s.flags && s.flags.married));
}

/* 配偶显示名（已婚且姓名存在时返回；否则返回 ''） */
function spouseName(s) {
  const k = spouseOf(s);
  if (!k) return '';
  const c = CHAR_BY_KEY[k];
  return (c && s[c.nameField]) || '';
}

/* 读取家财（旧存档 → 默认 20） */
function getMoney(s) {
  const v = s && s.money;
  return typeof v === 'number' ? v : 20;
}

/* 增减家财（返回实际变化量） */
function addMoney(s, d) {
  if (!s || typeof d !== 'number') return 0;
  const before = getMoney(s);
  s.money = before + d;
  return s.money - before;
}

/* 读取心累（旧存档 → 默认 0），钳制 [0,100] */
function getStress(s) {
  const v = s && s.stress;
  return typeof v === 'number' ? Math.max(0, Math.min(100, v)) : 0;
}

/* 增减心累，自动钳制 [0,100]（返回实际变化量） */
function addStress(s, d) {
  if (!s || typeof d !== 'number') return 0;
  const before = getStress(s);
  s.stress = Math.max(0, Math.min(100, before + d));
  return s.stress - before;
}

/* 子女列表（旧存档 → []） */
function getKids(s) {
  return (s && Array.isArray(s.kids)) ? s.kids : [];
}

/* 子女数量 */
function kidCount(s) {
  return getKids(s).length;
}

/* 生育一个子女：自动命名、年龄 0、随机性别与天赋倾向
   trait 可选：'剑' | '丹' | '文' | '商' | '侠'（缺省随机） */
function addKid(s, opts) {
  if (!s) return null;
  if (!Array.isArray(s.kids)) s.kids = [];
  const o = opts || {};
  const gender = o.gender === 'm' || o.gender === 'f' ? o.gender : (Math.random() < 0.5 ? 'm' : 'f');
  const traits = ['剑', '丹', '文', '商', '侠'];
  const trait = o.trait || traits[Math.floor(Math.random() * traits.length)];
  const kid = {
    name: o.name || (typeof T !== 'undefined' && T.name ? T.name(gender) : '无名'),
    age: 0,
    gender,
    trait,
    born: (s.year || 1),
  };
  s.kids.push(kid);
  return kid;
}

/* 子女整体成长一岁（由过冬结算调用；空列表为 no-op，旧存档安全） */
function growKids(s, n) {
  const step = typeof n === 'number' ? n : 1;
  getKids(s).forEach(k => { k.age = (k.age || 0) + step; });
  return s ? s.kids : [];
}

/* 子女属性汇总（供事件 req 使用，避免各处手写 reduce） */
function kidStats(s) {
  const list = getKids(s);
  return {
    count: list.length,
    maxAge: list.reduce((m, k) => Math.max(m, k.age || 0), 0),
    hasSon: list.some(k => k.gender === 'm'),
    hasDaughter: list.some(k => k.gender === 'f'),
    byTrait: (t) => list.filter(k => k.trait === t),
  };
}

/* 婚后剧情标记读写 */
function setFamilyFlag(s, key, val) {
  if (!s) return false;
  if (!s.familyFlags || typeof s.familyFlags !== 'object') s.familyFlags = {};
  s.familyFlags[key] = (val === undefined) ? true : val;
  return true;
}
function getFamilyFlag(s, key) {
  return !!(s && s.familyFlags && s.familyFlags[key]);
}

window.Characters = {
  CHARACTERS, CHAR_BY_KEY, STAGES,
  getAff, addAff, setAff, bestCharacter, stageOf,
  spouseOf, isMarriageLocked, lockMarriage, markMarriageDone, canMarry,
  // 第七轮新增
  isRefused, setRefused, isMarriageRejected, rejectMarriage, stageLabel,
  // 第九轮新增：婚后生活状态
  isMarried, spouseName,
  getMoney, addMoney, getStress, addStress,
  getKids, kidCount, addKid, growKids, kidStats,
  setFamilyFlag, getFamilyFlag,
};
