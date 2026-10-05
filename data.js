/* ============================================================
   剑与丹 · 修仙人生重开模拟器
   数据层：属性 / 境界 / 势力 / 地点 / 天赋 / 成就 / 结局
   ============================================================ */

/* ---------- 属性定义 ---------- */
const ATTRS = {
  gen:  { name: '根骨', desc: '修炼速度与突破上限的根基', icon: '⛰' },
  wu:   { name: '悟性', desc: '领悟剑意、参透丹理的能力', icon: '✧' },
  ji:   { name: '机缘', desc: '遭遇奇遇与贵人的气运',     icon: '☯' },
  xin:  { name: '心性', desc: '道心稳固，抵御心魔与情劫', icon: '❖' },
  jian: { name: '剑意', desc: '剑修之魂，出剑时的锋芒',     icon: '⚔' },
  dan:  { name: '丹心', desc: '丹修之基，济世与自愈之能',   icon: '❀' },
  shou: { name: '寿元', desc: '剩余可活之年岁',             icon: '⏳' },
};

/* ---------- 境界 ---------- */
const REALMS = [
  { name: '凡俗之身', need: 0,    life: 0,   tag: '未入仙门' },
  { name: '炼气期',   need: 10,   life: 40,  tag: '初窥门径' },
  { name: '筑基期',   need: 35,   life: 120, tag: '夯实道基' },
  { name: '金丹期',   need: 80,   life: 300, tag: '结成金丹' },
  { name: '元婴期',   need: 150,  life: 600, tag: '元婴出窍' },
  { name: '化神期',   need: 260,  life: 1200,tag: '神游太虚' },
  { name: '炼虚期',   need: 400,  life: 2000,tag: '虚实之间' },
  { name: '大乘期',   need: 600,  life: 3500,tag: '大道将成' },
  { name: '渡劫期',   need: 850,  life: 5000,tag: '天劫在望' },
  { name: '仙人之境', need: 1200, life: 9999,tag: '飞升登仙' },
];

/* ---------- 势力 ---------- */
const FACTIONS = {
  tianjian: {
    name: '天剑宗', type: '剑道', align: '正道',
    desc: '天下剑修之首，山门立于剑峰绝顶，弟子皆佩剑。宗规森严，重剑心。',
    color: '#5b8dd6',
  },
  wandan: {
    name: '万丹阁', type: '丹道', align: '中立',
    desc: '九洲丹修汇聚之所，阁中丹炉终年不熄。以济世为名，亦以利相交。',
    color: '#7fb069',
  },
  xuehai: {
    name: '血海魔宗', type: '魔道', align: '魔道',
    desc: '以血炼剑、以魂养丹。行事狠戾，却自有其道。门人皆着赤衣。',
    color: '#c0392b',
  },
  wanbao: {
    name: '万宝商会', type: '商道', align: '中立',
    desc: '横跨九洲的修士商行，掌灵材流通。有钱能使鬼推磨，亦能通仙途。',
    color: '#c9a227',
  },
  luoxia: {
    name: '落霞剑冢', type: '剑道', align: '隐世',
    desc: '埋剑之地，历代剑修残剑葬于此。有守冢人不问世事，唯待有缘。',
    color: '#9b7fb5',
  },
  qingyun: {
    name: '青云书院', type: '儒道', align: '正道',
    desc: '凡人亦可入的书院，以文载道，以礼御剑。出过数位以诗证道的剑仙。',
    color: '#4a90a4',
  },
};

/* ---------- 地点 ---------- */
const PLACES = {
  qingshi: {
    name: '青石镇', region: '中州',
    desc: '一个寻常的凡人小镇，青石铺路，炊烟袅袅。你的故事从这里开始。',
    events: ['mortal_life', 'first_choice'],
  },
  jianfeng: {
    name: '剑峰', region: '天剑宗',
    desc: '万仞孤峰，云海翻涌。峰顶插满历代剑修的本命剑，风过时铮铮作鸣。',
    events: ['sword_recite', 'jianfeng_test'],
  },
  danxia: {
    name: '丹霞谷', region: '万丹阁',
    desc: '终年弥漫药香的山谷，丹炉林立。谷中有一条永不结冰的暖泉。',
    events: ['dan_gather', 'danxia_plague'],
  },
  luori: {
    name: '落日原', region: '北境',
    desc: '一望无际的荒原，落日如血。据说地下埋葬着一场远古剑战。',
    events: ['wolf_pack', 'ancient_sword'],
  },
  liuli: {
    name: '琉璃城', region: '南疆',
    desc: '商贾云集的富庶之城，万宝商会总舵所在。城中最贵的一件拍品曾卖出三千灵石。',
    events: ['auction', 'save_girl'],
  },
  wangchuan: {
    name: '忘川渡', region: '幽冥',
    desc: '阴阳交界之处，一叶扁舟横渡。传闻船夫从不收钱，只收记忆。',
    events: ['cross_river', 'memory_trade'],
  },
  jiuxiao: {
    name: '九霄雷泽', region: '天外',
    desc: '雷云永聚之域，渡劫者皆来此地。雷霆之下，无数剑修化尘。',
    events: ['tribulation', 'thunder_body'],
  },
  guoshi: {
    name: '故里旧巷', region: '中州',
    desc: '你出生长大的巷子。多年后归来，墙根的老槐树还在，门却锁了。',
    events: ['return_home', 'family_reunion'],
  },
};

/* ---------- 天赋（开局抽取） ---------- */
const TALENTS = [
  { id: 'jianxin',  name: '剑心通明',  rarity: 4, desc: '生而有剑心，悟剑意事半功倍', eff: { jian: 12, wu: 5 }, weight: 4 },
  { id: 'danhuang', name: '药王转世',  rarity: 4, desc: '闻药即识，丹道天赋异禀',     eff: { dan: 12, wu: 5 }, weight: 4 },
  { id: 'tianti',   name: '天赐灵根',  rarity: 5, desc: '万年难遇的灵根，修炼一日千里', eff: { gen: 15 }, weight: 1 },
  { id: 'qiyun',    name: '福缘深厚',  rarity: 4, desc: '天生自带机缘，走到哪都有奇遇', eff: { ji: 12 }, weight: 4 },
  { id: 'daoxin',   name: '道心坚固',  rarity: 3, desc: '心如止水，情劫不入',         eff: { xin: 10 }, weight: 8 },
  { id: 'shuangxiu',name: '剑丹双绝',  rarity: 5, desc: '剑与丹皆通，此乃世上罕有的路', eff: { jian: 8, dan: 8 }, weight: 1 },
  { id: 'pinkun',   name: '寒门苦修',  rarity: 2, desc: '出身贫寒，却磨出铁一般的意志', eff: { xin: 6, shou: 20 }, weight: 10 },
  { id: 'shiren',   name: '诗心剑骨',  rarity: 4, desc: '出口成章，出剑必吟诗',       eff: { wu: 8, jian: 6 }, weight: 5 },
  { id: 'pingshan', name: '平平无奇',  rarity: 1, desc: '你真的只是个普通人……真的吗？', eff: {}, weight: 14 },
  { id: 'bingxin',  name: '冰心玉骨',  rarity: 3, desc: '容貌清绝，情缘自来',         eff: { ji: 5, xin: 5 }, weight: 7 },
  { id: 'zhuanshi', name: '前世残念',  rarity: 5, desc: '你似乎，曾经活过一次',       eff: { wu: 10, ji: 5 }, weight: 2 },
  { id: 'jianmo',   name: '剑魔之血',  rarity: 4, desc: '血脉中藏着暴戾的剑意',       eff: { jian: 14, xin: -5 }, weight: 3 },
];

/* ---------- 成就 ---------- */
const ACHIEVEMENTS = [
  { id: 'first_step',  name: '初入仙途',    desc: '第一次踏入修仙之门',           icon: '🚪' },
  { id: 'recite',      name: '剑与诗',      desc: '在心爱之人面前吟诗出剑',       icon: '📜' },
  { id: 'save_her',    name: '抢婚',        desc: '于万人之前抢回你的道侣',       icon: '💍' },
  { id: 'avenge',      name: '雪耻',        desc: '为家人之仇，斩尽仇敌',         icon: '🗡' },
  { id: 'pill_master', name: '丹道宗师',    desc: '炼出九品丹药',                 icon: '⚗' },
  { id: 'sword_saint', name: '剑仙',        desc: '以剑意达到仙人之境',           icon: '⚔' },
  { id: 'immortal',    name: '飞升',        desc: '渡劫成功，白日飞升',           icon: '☁' },
  { id: 'die_young',   name: '夭折',        desc: '寿元未过半百便身死',           icon: '🥀' },
  { id: 'heart_demon', name: '心魔噬心',    desc: '道心破碎，堕入魔道',           icon: '😈' },
  { id: 'return_past', name: '回到过去',    desc: '以残躯逆流而上，重回那一日',   icon: '⏳' },
  { id: 'hermit',      name: '归隐',        desc: '功成名就，携她归隐山林',       icon: '🏔' },
  { id: 'lonely',      name: '孤剑独行',    desc: '一生无人相伴，剑是唯一的道',   icon: '🌙' },
  { id: 'ten_lives',   name: '十世轮回',    desc: '完成十次周目',                 icon: '♾' },
  { id: 'all_talents', name: '天命之人',    desc: '抽中过所有传说级天赋',         icon: '✨' },
  { id: 'poet',        name: '诗剑双绝',    desc: '一次周目中吟诗出剑超过五次',   icon: '🍶' },
  { id: 'dan_jian',    name: '剑丹同辉',    desc: '剑意与丹心皆达八十以上',       icon: '☯' },
  { id: 'return_mortal', name: '归凡',      desc: '散尽一身修为，做回凡人',       icon: '🪷' },
  { id: 'marry_herb',  name: '药庐余生',    desc: '与药谷姑娘修成正果',           icon: '🌿' },
  { id: 'marry_sister',name: '剑峰并肩',    desc: '与剑宗师姐修成正果',           icon: '🗡' },
  { id: 'marry_third', name: '落日成婚',    desc: '与血海修罗修成正果',           icon: '🌅' },
];

/* ---------- 结局表 ----------
   优先级（judgeEnding 中的判定顺序，越靠前优先）：
   1. 归凡线（return_mortal_*）—— 主动放弃仙途，与所爱之人做回凡人。最高优先：
      这是玩家在【归凡线】事件链中「明确选择放弃」的结果，必须覆盖其它判定。
   2. 婚姻线（marry_*）—— 与某位角色修成正果。高于普通情感结局（happy_ending），
      低于飞升/剑仙等"登顶"结局：走婚姻线者多已偏离纯粹的修行极致。
   3. 原有 12 结局（飞升 > 回到过去 > 剑仙 > 归隐 > 剑丹同辉 > 携手 > 魔道 > 复仇 > 孤剑 > 丹王 > 早逝 > 凡俗）

   冲突取舍：若玩家同时满足婚姻线与飞升线，取飞升线（登顶优先）——除非玩家在
   归凡线事件中主动选择归凡，则归凡线覆盖一切。 */
const ENDINGS = {
  immortal_ascend: { name: '白日飞升', rank: 'SSS', desc: '你踏破虚空，剑光冲霄。回首人间，那一袭青衫还在山巅等你。飞升之日，你留下一句话：「剑与丹，皆为你。」', cond: '渡劫成功且道侣健在', color: '#f1c40f' },
  sword_god:       { name: '剑仙独尊', rank: 'SS',  desc: '天下第一剑，非你莫属。你立于九霄之上，却无人可与之论剑。高处不胜寒。', cond: '剑意极高但孤独终老', color: '#5b8dd6' },
  dual_immortal:   { name: '剑丹同辉', rank: 'SS',  desc: '你以剑证道，以丹济世。九洲传颂你的名字，而你说，不过是想护住想护的人。', cond: '剑意与丹心俱高', color: '#7fb069' },
  returned_past:   { name: '回到过去', rank: 'SSS', desc: '你终于回去了。可你连一天都撑不到，肉体便会消散。你只是想在化为飞灰前，再看她一眼。', cond: '触发回到过去线', color: '#9b7fb5' },
  happy_ending:    { name: '携手仙途', rank: 'S',   desc: '你与她共证长生。从此山高水长，一人一剑，成双成对。', cond: '道侣健在且修为不俗', color: '#e84393' },
  avenged:         { name: '血仇得报', rank: 'S',   desc: '你替家人报了仇。仇人的血染红你的剑，你却只觉空落——他们回不来了。', cond: '复仇成功', color: '#c0392b' },
  lonely_sword:    { name: '孤剑终老', rank: 'A',   desc: '一生未娶，一生未败。你的剑道无人能及，可你的墓前，从来没人为你上一炷香。', cond: '无道侣且寿终', color: '#7f8c8d' },
  dan_master:      { name: '一代丹王', rank: 'A',   desc: '你不多言，却在九洲每一间药铺里都留下了名字。你救过的人，比你记得的还多。', cond: '丹心极高', color: '#27ae60' },
  ordinary_death:  { name: '凡人之死', rank: 'C',   desc: '你终究没能走远。仙途于你，只是一场做过就醒的梦。', cond: '修为低微而亡', color: '#95a5a6' },
  young_death:     { name: '早逝',       rank: 'D',   desc: '你还没看清仙途的模样，便已倒下。或许下次，你会走得更远。', cond: '过早死亡', color: '#bdc3c7' },
  demon_path:      { name: '堕入魔道',   rank: 'B',   desc: '心魔吞噬了你。你成了自己曾经最恨的那种人，以血养剑，以魂炼丹。', cond: '道心破碎', color: '#8e44ad' },
  hermit_life:     { name: '归隐山林',   rank: 'A',   desc: '你不再问仙途。于山中结庐，晨钟暮鼓。她说，这样也好。', cond: '主动归隐', color: '#16a085' },

  /* ===== 新增：婚姻结局（三角色各一，由对应角色的 reconcile_2 设 *_married_ready 后，在寿终/主动成婚时判定） ===== */
  marry_herb: {
    name: '药庐余生', rank: 'S',
    desc: '你没有登上九霄，也没有留下传说。你只是把药庐的门重新漆了一遍，在檐下添了一张摇椅。她说，往后的每一个春天，药圃里的花都由你浇水。你答应得很轻，却守了很多年。',
    cond: '与药谷姑娘修成正果（herb_married_ready 且好感 ≥85）',
    color: '#7fb069',
  },
  marry_sister: {
    name: '剑峰并肩', rank: 'S',
    desc: '剑峰最高处，两把剑插在一处，风再大也不倒。她说，论剑的人多，并肩的人少。你替她把鬓角的雪拂掉，说：那便并肩到剑钝为止。',
    cond: '与剑宗师姐修成正果（sister_married_ready 且好感 ≥85）',
    color: '#5b8dd6',
  },
  marry_third: {
    name: '落日成婚', rank: 'S',
    desc: '落日原上，血海修罗卸了甲，披了红。万人之上，她只朝你一人伸手。你说，从今往后，你不再是修罗，我也不是剑客，只是两个想一起看落日的人。',
    cond: '与血海修罗修成正果（third_married_ready 且好感 ≥85）',
    color: '#c0392b',
  },

  /* ===== 新增：归凡线系列（主动放弃仙途，做回凡人） ===== */
  return_mortal_herb: {
    name: '归凡·药香不散', rank: 'A',
    desc: '你散尽了修为。剑埋了，丹炉灭了。你在青石镇开了间小药铺，门前挂着一串晒干的草药。有人问你为何不修仙，你笑着摇头：修过的。只是后来发现，替她把药煎好了，比飞升更实在。',
    cond: '归凡线：散尽修为，与药谷姑娘共度凡生',
    color: '#16a085',
  },
  return_mortal_sister: {
    name: '归凡·剑埋青山', rank: 'A',
    desc: '你把剑埋进了后山。她替你立了块无字碑——不是给死人的，是给"剑客"那个身份的。你们成了山下的寻常夫妻，赶集、种田、吵架、和好。偶尔落雪的夜里，她会用木剑比划两下，你在旁边笑。',
    cond: '归凡线：散尽修为，与剑宗师姐共度凡生',
    color: '#16a085',
  },
  return_mortal_third: {
    name: '归凡·落日不落', rank: 'A',
    desc: '血海修罗的 throne 空了，你的剑也钝了。你们去了一个没人认识的地方，她说想看落日，你就陪她看了一辈子。最后一缕光沉下去的时候，她握紧你的手：这一世，够了。',
    cond: '归凡线：散尽修为，与血海修罗共度凡生',
    color: '#16a085',
  },
  return_mortal_alone: {
    name: '归凡·孤身入尘', rank: 'B',
    desc: '你散尽了修为，一个人走回山下。没有人等你，也没有人送。你在市井里活了很久，久到没人再记得你曾是个剑客。偶尔有孩子问起你腰间那道疤，你说，是年轻时不小心划的。',
    cond: '归凡线：散尽修为，独自做回凡人',
    color: '#7f8c8d',
  },
};

/* ---------- 境界计算 ---------- */
function realmOf(power) {
  let idx = 0;
  for (let i = 0; i < REALMS.length; i++) {
    if (power >= REALMS[i].need) idx = i;
  }
  return { index: idx, ...REALMS[idx] };
}

/* ---------- 抽天赋（带权重，受周目加成） ---------- */
function rollTalents(count, luckBonus = 0) {
  const pool = [];
  TALENTS.forEach(t => {
    const w = t.weight + (t.rarity >= 4 ? luckBonus : 0);
    for (let i = 0; i < w; i++) pool.push(t);
  });
  const picked = [];
  const used = new Set();
  let guard = 0;
  while (picked.length < count && guard++ < 500) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(t.id)) continue;
    used.add(t.id);
    picked.push(t);
  }
  return picked;
}

window.GAME_DATA = { ATTRS, REALMS, FACTIONS, PLACES, TALENTS, ACHIEVEMENTS, ENDINGS, realmOf, rollTalents };
// 同时暴露为全局常量（供 engine.js / 测试脚本直接引用）
window.ATTRS = ATTRS; window.REALMS = REALMS; window.FACTIONS = FACTIONS; window.PLACES = PLACES;
window.TALENTS = TALENTS; window.ACHIEVEMENTS = ACHIEVEMENTS; window.ENDINGS = ENDINGS;
window.realmOf = realmOf; window.rollTalents = rollTalents;
