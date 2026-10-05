/* ============================================================
   剑与丹 · 配置数据内联（第四轮新增）
   ------------------------------------------------------------
   为什么内联而不 fetch？
     游戏是纯静态页面，很多玩家直接双击 index.html 以 file:// 打开。
     此时浏览器会以 CORS 策略拦截 fetch('config/*.json')，
     导致配置读取失败。因此这里把三份 JSON 的内容内联到
     window.GAME_CONFIG，保证离线双击也能读到配置。

   config/*.json 仍是「人类可读 + 可编辑」的权威交付物：
     修改 JSON 后，把内容同步到本文件对应的字段即可生效
     （或改完跑一次 config/build-config.js 自动生成，如启用）。

   读取顺序：
     1) window.GAME_CONFIG（本文件）
     2) 缺省时 engine / season.js 内部有等价默认值兜底
   ============================================================ */

const GAME_CONFIG = {

  /* ---------- 婚姻结局规则（对应 config/marriage-rules.json） ---------- */
  marriage: {
    enabled: true,
    thresholds: { marriageAffection: 90, legacyReadyAffection: 85, postponeRetryYears: 3 },
    trigger: {
      requireAffectionAtLeast: 100,
      requireFlag: '{char}_married_ready',
      requireNotLocked: true,
      requireNotDone: true,
      requireMet: true,
      priority: 900,
      season: null,
      fixedSeason: null,
      weight: 20,
      once: true,
    },
    branch: {
      acceptFlag: 'isMarriageAccept',
      acceptSets: { spouse_id: '{char}', marriageLocked: true },
      rejectLeavesLockedUntouched: true,
      firstAgreeWins: true,
    },
    lock: {
      spouseField: 'spouse_id',
      lockField: 'marriageLocked',
      doneField: 'marriageDone',
      resetOnNewLife: true,
    },
    validation: {
      multiCharAt100: { policy: 'first_agree_wins' },
      duplicateTrigger: { policy: 'block' },
      invalidSpouse: { policy: 'ignore' },
    },
  },

  /* ---------- 婚后生活系统（第九轮新增，对应 config/post-marriage.json） ----------
     设计目标：婚后不再是「立刻结算结局」，而是一段可继续游玩的旅程。
     本节点仅提供调度参数与初始值；具体事件全部写在 seasonEvents 里（post: true）。
     全部字段均为可选，缺失时 engine / characters 内部有等价默认值兜底。 */
  postMarriage: {
    enabled: true,
    // 婚后事件的 priority（高于季节 0、角色链 100，低于主线 500/婚姻 900）
    tiers: { crisis: 340, bonding: 320, daily: 300 },
    // 婚后事件触发后的默认冷却（年）；单条事件可用 cooldown 覆盖
    defaultCooldownYears: 2,
    // 初始家财（两）与心累
    startMoney: 20,
    startStress: 0,
    // 心累阈值：超过后矛盾类事件权重提升（引擎侧未强制，供事件 req 使用）
    stressBands: { calm: 30, tense: 60, breaking: 85 },
    // 每年过冬时，婚后事件池是否保持「每年至少一次婚后事件」的保底
    guaranteeOnePerYear: true,
  },

  /* ---------- 去重规则（对应 config/dedup-rules.json） ---------- */
  dedup: {
    seasonEventPolicy: { mode: 'once_per_year' },
    layers: [
      { name: 'usedEvents', scope: 'run', field: 's.usedEvents', clearedBy: 'newLife' },
      { name: 'usedSeasons', scope: 'year', field: 's.usedSeasons', clearedBy: 'seasonRollover' },
      { name: 'charFlags', scope: 'run', field: 's.charFlags', clearedBy: 'newLife' },
    ],
    priorityTiers: { tiers: [
      { priority: 900, name: 'marriage' },
      { priority: 500, name: 'mainStory' },
      { priority: 100, name: 'character' },
      { priority: 0, name: 'seasonal' },
      { priority: -100, name: 'daily' },
    ] },
    fallback: { levels: ['generalPool', 'repeatPool', 'idle'] },
    validation: {
      duplicateId: { policy: 'block' },
      seasonCoverage: { policy: 'warn', minPerSeason: 12 },
      emptyChoices: { policy: 'block' },
    },
  },

  /* ---------- 数值配平（对应 config/balance.json） ---------- */
  /* 这一节专门负责「一局能玩多久 / 能修到什么境界」，是全局节奏的总开关。
     改动这里即可整体调整游戏时长，无需碰引擎代码。
     时间模型：1 年 = 4 次行动 = 4 步（春→夏→秋→冬）。
     —— 修复记录：此前 `life/4` 的无上限回血导致寿元净增数千点、游戏永不结束；
        现改为「起始寿元 + 每年消耗 + 破境按比例递减回血」三者配平。 ---------- */
  balance: {
    enabled: true,
    // 起始寿元（实际还会叠加天赋加成，均值约 +10）
    startShou: 60,
    // 起始年龄
    startAge: 12,
    // 每年（走完冬）消耗的寿元
    //   注意：寿元还有「天赋加成」与「部分事件的 +寿元」两个隐性来源（约 +10~30/局），
    //   所以实际可活年数 ≈ (起始寿元 + 隐性加成) / shouPerYear。
    //   实测：4 时单局 100~240 步、终局年龄 60~80 岁，节奏最稳（100~260 命中率 100%）。
    shouPerYear: 4,
    // 修为成长倍率（1 = 每步 floor(base*(1+realmIdx*0.22)*growth/4)，约 +1）
    //   调大 → 境界推进更快、能修到更高境界、单局更长。
    //   实测：1.5 时终局境界覆盖炼虚→仙人共 5 档，分布最均衡。
    growthMultiplier: 1.5,
    // 破境回血：按当前寿元的百分比回血，且随境界递减
    //   healRatio = max(minHealRatio, baseHealRatio − realmIndex × healDecayPerRealm)
    breakthroughHeal: {
      baseHealRatio: 0.25,
      healDecayPerRealm: 0.019,
      minHealRatio: 0.08,
      flatMin: 3,
    },
    // 寿元软上限倍率：破境回血后寿元最多回到「起始寿元 × 此倍率」（默认 1.8 = 108）
    //   1.0 = 破境完全不延寿（纯消耗，时长固定 60 年左右）
    //   1.8 = 温和延寿（推荐，既有破境正反馈又不会无限续命）
    //   3.0+ = 强力延寿（高境界可长期续命，慎用，可能又回到「死不掉」）
    shouCapMultiplier: 1.8,
    // 硬保险丝：即使数值配错，也不会出现无限循环
    hardStepCap: 300,
    // 目标是单局落在 [targetMinSteps, targetMaxSteps] 之间
    targetMinSteps: 120,
    targetMaxSteps: 200,
    // 年龄段亲和（第五轮 O9）：用于事件抽取加权，修正「高龄段事件供给不足」
    //   事件标 ageBand（'youth' 12-39 / 'prime' 40-99 / 'elder' 100+ / 'any' 全年龄，或数组）
    //   boost  = 当前年龄命中该档时的权重倍率
    //   penalty= 未命中时的权重倍率（仍可出现，只是概率降低；设为 1 则完全不变）
    //   未标注 ageBand 的事件恒返回 1，行为与旧版一致。
    ageBand: {
      boost: 2.5,
      penalty: 0.35,
    },
  },
};

/* ---------- 季节事件 + 婚姻事件（对应 config/season-events.json） ---------- */
/* 说明：此处以「数据对象」形式内联，text/req/apply 保留字符串形态，
   由 season.js 的 compileEvents() 在运行时编译为函数。
   若只想改事件文案，直接改下面的字符串即可，无需碰引擎代码。 */
GAME_CONFIG.seasonEvents = [
  /* ============ 春 · spring（13 条） ============ */

  {
    id: 'se_spring_herb_1', season: 'spring', stage: 'meet', stageGroup: '初识·春季',
    title: '春汛·药苗', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '0-25', usedFlag: 'se_spring_herb_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.herb_met',
    text: 's => `春汛过后，丹霞谷的药苗被水泡了一半。\n\n${s.herName}蹲在泥里，一株一株地扶。她抬头看你一眼，没说话，但把手里多余的一把小铲推了过来。`',
    choices: [
      { text: '脱了鞋下田，陪她把药苗扶完', hint: '好感 +10 · 丹心+2', charaff: { key: 'herb', d: 10 },
        apply: "s => { Characters.addAff(s, 'herb', 10); s.dan += 2; s.log('泥水冰凉。她递给你一块干布擦手，说：「下次别下水。」语气像是在怪你，又不像。'); }" },
      { text: '用丹术调一剂「稳根散」救药苗', hint: '好感 +14（需丹心≥12）', charaff: { key: 'herb', d: 14 },
        apply: "s => { if (s.dan >= 12) { Characters.addAff(s, 'herb', 14); s.dan += 3; s.log('你调了三炉才成。她看着那层薄薄的白霜落在苗根上，眼睛亮了：「你这一手，比我师父强。」'); } else { Characters.addAff(s, 'herb', 5); s.log('你调的散太稀了。她叹了口气，接过去重调：「看好了。」'); } }" },
      { text: '只在岸边帮她递工具', hint: '好感 +4', charaff: { key: 'herb', d: 4 },
        apply: "s => { Characters.addAff(s, 'herb', 4); s.log('你递了一下午的工具。她没说谢，但收工的时候，把最后一块饼留给了你。'); }" },
    ],
  },

  {
    id: 'se_spring_sister_1', season: 'spring', stage: 'meet', stageGroup: '初识·春季',
    title: '春试·剑鸣', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '0-25', usedFlag: 'se_spring_sister_1',
    req: 's => s.age >= 16 && s.jian >= 8 && s.charFlags && s.charFlags.sister_met',
    text: 's => `天剑宗春日小试。你抽到的对手，是她。\n\n${s.sisterName}站在场中，剑未出鞘。场边有人小声说：「和她过招，三招之内输，算是赢。」\n\n她看你一眼：「出剑。」`',
    choices: [
      { text: '倾尽全力，接满十招', hint: '好感 +12 · 剑意+5', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.jian += 5; s.log('第十一招，你的剑脱手了。她收剑，看了你一眼：「手不错，心太急。」你捡剑的时候，听见她补了一句：「再来。」'); }" },
      { text: '只守不攻，把她的剑路全记下', hint: '好感 +9 · 悟性+5', charaff: { key: 'sister', d: 9 },
        apply: "s => { Characters.addAff(s, 'sister', 9); s.wu += 5; s.log('你守了四十七招。最后她停手：「你在学法，不是拆招。」你没否认。她握着剑柄的手，松了一下。'); }" },
      { text: '出剑时喊了一句杜诗', hint: '好感 +14 · 吟诗', charaff: { key: 'sister', d: 14 }, recite: true,
        apply: "s => { Characters.addAff(s, 'sister', 14); s.log('「十年磨一剑，霜刃未曾试。」你念完，她愣了一瞬。剑交错的刹那，她压低声音：「……这句，别在别人面前念。」'); }" },
    ],
  },

  {
    id: 'se_spring_third_1', season: 'spring', stage: 'meet', stageGroup: '初识·春季',
    title: '春猎·银铃', weight: 7, priority: 0, once_per_year: true, place: 'xuehai',
    affRange: '0-25', usedFlag: 'se_spring_third_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.third_met',
    text: 's => `血海春猎，猎的不是兽，是「不肯低头的人」。\n\n你在一片新绿里撞见${s.herName2}。她腰间挂着银铃，蹲在一头受伤的小鹿旁边，正用刀尖挑出鹿蹄里的荆刺。\n\n她看见你，先笑了：「你要告发我吗？」`',
    choices: [
      { text: '蹲下，帮她按住小鹿', hint: '好感 +12 · 心性+3', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.xin += 3; s.log('小鹿蹬了你一蹄子。她笑出了声，是那种真的笑：「疼不疼？」——后来你才知道，她很少这么笑。'); }" },
      { text: '「血海的人也救鹿？」', hint: '好感 +6 或 +16', charaff: { key: 'third', d: 16 },
        apply: "s => { if (s.ji >= 10) { Characters.addAff(s, 'third', 16); s.log('她收了笑：「血海的人，也是人。」她把鹿放了，转身时裙角扫过草尖：「记住你这句话。」'); } else { Characters.addAff(s, 'third', 6); s.log('她抬眼看你，眼神凉了一下：「你也是这么看我的？」'); } }" },
      { text: '装作没看见，绕路走开', hint: '好感 +2', charaff: { key: 'third', d: 2 },
        apply: "s => { Characters.addAff(s, 'third', 2); s.log('你走开的时候，听见身后银铃响了一声。后来你想，那一响，也许是她在等你回头。'); }" },
    ],
  },

  {
    id: 'se_spring_herb_2', season: 'spring', stage: 'crush', stageGroup: '熟悉·春季',
    title: '春分·晒药', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '20-50', usedFlag: 'se_spring_herb_2',
    req: "s => Characters.getAff(s, 'herb') >= 20 && Characters.getAff(s, 'herb') < 70 && !isRefused(s, 'herb')",
    text: 's => `春分这天，日头最好。${s.herName}把一整年的药材都搬出来晒。\n\n她递给你一个竹匾：「你翻这边。」你们隔着一排药架，谁也不说话，只有药材翻动的窸窣声。`',
    choices: [
      { text: '在竹匾里偷偷摆了一个「心」', hint: '好感 +13', charaff: { key: 'herb', d: 13 },
        apply: "s => { Characters.addAff(s, 'herb', 13); s.log('她翻到那一匾的时候顿住了。半天，她假装没看见，却把那个「心」留到了最后才收。'); }" },
      { text: '认出她晒错了一味药，替她挑出来', hint: '好感 +11 · 丹心+3', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.dan += 3; s.log('「这味是断肠草。」你说。她凑过来看，鼻尖差点碰到你的手背，然后退开半步，声音低下去：「……还好有你在。」'); }" },
      { text: '只顾着晒药，一句话没说', hint: '好感 +6 · 丹心+2', charaff: { key: 'herb', d: 6 },
        apply: "s => { Characters.addAff(s, 'herb', 6); s.dan += 2; s.log('你把该做的都做了。傍晚她收完药，站在门口看你走远，没叫你。'); }" },
    ],
  },

  {
    id: 'se_spring_sister_2', season: 'spring', stage: 'crush', stageGroup: '熟悉·春季',
    title: '春夜·听雨', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '20-50', usedFlag: 'se_spring_sister_2',
    req: "s => Characters.getAff(s, 'sister') >= 20 && Characters.getAff(s, 'sister') < 70 && !isRefused(s, 'sister')",
    text: 's => `春夜落雨，剑庐漏得厉害。\n\n${s.sisterName}在檐下擦剑，雨水顺着瓦当，在她脚边砸出一排小坑。她没让你进去，也没让你走。`',
    choices: [
      { text: '把自己的外袍搭在漏雨的那道梁上', hint: '好感 +12 · 心性+3', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.xin += 3; s.log('她看着那件袍子被雨水泡透，什么也没说。第二天，袍子被洗得干干净净，叠在剑庐门口。'); }" },
      { text: '陪她听了一夜的雨', hint: '好感 +14', charaff: { key: 'sister', d: 14 },
        apply: "s => { Characters.addAff(s, 'sister', 14); s.log('天快亮的时候，她说：「我小时候最怕下雨。」然后她自己愣住了，像是说漏了什么。'); }" },
      { text: '问她剑上刻的是什么', hint: '好感 +8', charaff: { key: 'sister', d: 8 },
        apply: "s => { Characters.addAff(s, 'sister', 8); s.log('她低头看了很久：「一个死人的名字。」雨声很大，你听见自己说：「那你一定很想他。」她没答。'); }" },
    ],
  },

  {
    id: 'se_spring_third_2', season: 'spring', stage: 'crush', stageGroup: '熟悉·春季',
    title: '春信·纸鸢', weight: 7, priority: 0, once_per_year: true, place: 'xuehai',
    affRange: '20-50', usedFlag: 'se_spring_third_2',
    req: "s => Characters.getAff(s, 'third') >= 20 && Characters.getAff(s, 'third') < 70 && !isRefused(s, 'third')",
    text: 's => `${s.herName2}塞给你一只纸鸢，颜料还没干。\n\n「放上去。」她说，「放上去我就信你一件事。」\n\n纸鸢是一只歪歪扭扭的黄鹂。`',
    choices: [
      { text: '跑到最高的山脊上，把它放起来', hint: '好感 +15 · 心性+3', charaff: { key: 'third', d: 15 },
        apply: "s => { Characters.addAff(s, 'third', 15); s.xin += 3; s.log('风大，你跑了三里地。纸鸢升起来的时候，她在下面看着，抬手挡了一下太阳——你不知道她是不是在擦眼睛。'); }" },
      { text: '「这画的是黄鹂？我以为是鸡。」', hint: '好感 +10（逗她）', charaff: { key: 'third', d: 10 },
        apply: "s => { Characters.addAff(s, 'third', 10); s.log('她追着你打了半条街，笑得像个十几岁的姑娘。追不上，她叉着腰站在路中间喘气，说：「你等着。」'); }" },
      { text: '问纸鸢为什么是黄鹂', hint: '好感 +13', charaff: { key: 'third', d: 13 },
        apply: "s => { Characters.addAff(s, 'third', 13); s.log('「我娘以前窗台上有一只。」她说得很轻，「后来连鸟笼一起烧了。」风把线拉得很紧，她没再说下去。'); }" },
    ],
  },

  {
    id: 'se_spring_herb_3', season: 'spring', stage: 'bond', stageGroup: '暧昧·春季',
    title: '春山·同采', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '45-80', usedFlag: 'se_spring_herb_3',
    req: "s => Characters.getAff(s, 'herb') >= 45 && Characters.getAff(s, 'herb') < 100 && !isRefused(s, 'herb')",
    text: 's => `上春山采一味只在惊蛰后七天开花的花。\n\n${s.herName}走在前面，脚下比你还稳。走了半天，她忽然回头：「你要是一直跟着我，是不是就没打算走？」`',
    choices: [
      { text: '「是。」', hint: '好感 +18 · 心性+4', charaff: { key: 'herb', d: 18 },
        apply: "s => { Characters.addAff(s, 'herb', 18); s.xin += 4; s.log('她红了耳朵，加快脚步走出十几步，又在前面停下来等了你一次。'); }" },
      { text: '「看花开了没有。」（岔开）', hint: '好感 +9', charaff: { key: 'herb', d: 9 },
        apply: "s => { Characters.addAff(s, 'herb', 9); s.log('「还没。」她说，声音低了一点，继续往前走。那朵花那天开得格外晚。'); }" },
      { text: '默默把最难走的那段路，先替她踩实', hint: '好感 +16 · 丹心+4', charaff: { key: 'herb', d: 16 },
        apply: "s => { Characters.addAff(s, 'herb', 16); s.dan += 4; s.log('她在你踩出的脚印里走，走了很久才说：「你这个人……很麻烦。」可她一直没换路。'); }" },
    ],
  },

  {
    id: 'se_spring_sister_3', season: 'spring', stage: 'bond', stageGroup: '暧昧·春季',
    title: '春剑·并肩', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '45-80', usedFlag: 'se_spring_sister_3',
    req: "s => Characters.getAff(s, 'sister') >= 45 && Characters.getAff(s, 'sister') < 100 && !isRefused(s, 'sister')",
    text: 's => `剑宗后山的春笋地里，窜出一头护崽的野彘。\n\n${s.sisterName}没有拔剑。她只是挡在你身前，抬起手，等野彘自己退。\n\n退走之后，她才说：「剑不是用来杀这种畜生的。」`',
    choices: [
      { text: '「那用来杀什么？」', hint: '好感 +14 · 剑意+4', charaff: { key: 'sister', d: 14 },
        apply: "s => { Characters.addAff(s, 'sister', 14); s.jian += 4; s.log('她想了很久：「用来……护住比方说什么。」她看了你一眼，把「比方说」后面的话咽了回去。'); }" },
      { text: '「刚才你挡在我前面了。」', hint: '好感 +17', charaff: { key: 'sister', d: 17 },
        apply: "s => { Characters.addAff(s, 'sister', 17); s.log('「站队里，挡的是前面的人，不是你。」她说得很快。但那天回去的路上，她一直走在你外侧。'); }" },
      { text: '把春笋挖回去，夜里煮成一锅', hint: '好感 +12 · 心性+3', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.xin += 3; s.log('笋汤很淡。她喝了两碗，把碗底的笋都留给你，自己盛了第三碗汤。'); }" },
    ],
  },

  {
    id: 'se_spring_third_3', season: 'spring', stage: 'bond', stageGroup: '暧昧·春季',
    title: '春池·落水', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '45-80', usedFlag: 'se_spring_third_3',
    req: "s => Characters.getAff(s, 'third') >= 45 && Characters.getAff(s, 'third') < 100 && !isRefused(s, 'third')",
    text: 's => `血海后山有一口活水泉，早春最凉。\n\n${s.herName2}说要看看泉底的石纹，脱了外衣就下去了。过了一炷香，水面没了动静。`',
    choices: [
      { text: '跳下去', hint: '好感 +20 · 心性+5', charaff: { key: 'third', d: 20 },
        apply: "s => { Characters.addAff(s, 'third', 20); s.xin += 5; s.log('你抓住她的时候，她正在水下睁着眼睛看你。上岸后她咳了半天，说：「我就知道你会下来。」——原来她一直在等。'); }" },
      { text: '在岸上喊她的名字', hint: '好感 +10', charaff: { key: 'third', d: 10 },
        apply: "s => { Characters.addAff(s, 'third', 10); s.log('她浮上来，头发贴着额角，笑得有点失望：「你喊得挺响。」那天她自己爬了上来。'); }" },
      { text: '折了根长竹竿伸下去', hint: '好感 +13 · 悟性+3', charaff: { key: 'third', d: 13 },
        apply: "s => { Characters.addAff(s, 'third', 13); s.wu += 3; s.log('她抓住竹竿，也没用力，就那么漂着看你。最后你说「上来」，她才上来。她说：「你比我聪明，也比我怕。」'); }" },
    ],
  },

  {
    id: 'se_spring_herb_4', season: 'spring', stage: 'reconcile', stageGroup: '确定·春季',
    title: '春归·门前', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '80-100', usedFlag: 'se_spring_herb_4',
    req: "s => Characters.getAff(s, 'herb') >= 80 && !isRefused(s, 'herb')",
    text: 's => `春天回来的时候，你已经走了很远。\n\n丹霞谷的门口，${s.herName}在等。她手里拎着一小包晒好的药，看见你，第一句话是：「你又瘦了。」`',
    choices: [
      { text: '接过药，说「我回来了」', hint: '好感 +10 · 心性+4', charaff: { key: 'herb', d: 10 },
        apply: "s => { Characters.addAff(s, 'herb', 10); s.xin += 4; s.log('「嗯。」她说，「回来了就好。」她没有问你去哪了——她知道你会回来。'); }" },
      { text: '把路上采的那株罕见药递给她', hint: '好感 +12 · 丹心+4', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.dan += 4; s.log('她捏着那株药的根须，看了很久，忽然笑了：「十年了，头一回有人给我带药回来。」'); }" },
    ],
  },

  {
    id: 'se_spring_sister_4', season: 'spring', stage: 'reconcile', stageGroup: '确定·春季',
    title: '春枝·新芽', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '80-100', usedFlag: 'se_spring_sister_4',
    req: "s => Characters.getAff(s, 'sister') >= 80 && !isRefused(s, 'sister')",
    text: 's => `剑庐后面，那把她插了三年的剑，抽出了一根新枝。\n\n${s.sisterName}站在那儿看了很久，回头问你：「你说，剑会不会也想活着？」`',
    choices: [
      { text: '「会。就像你一样。」', hint: '好感 +12 · 心性+4', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.xin += 4; s.log('她没说话，但伸手碰了碰那片新芽。你以为她要拔剑，她只是碰了碰。'); }" },
      { text: '把剑拔出来，重新插到向阳的地方', hint: '好感 +11 · 剑意+4', charaff: { key: 'sister', d: 11 },
        apply: "s => { Characters.addAff(s, 'sister', 11); s.jian += 4; s.log('「向阳，长得快。」你说。她站在你身后，很久，才说：「嗯。谢谢你。」'); }" },
    ],
  },

  {
    id: 'se_spring_third_4', season: 'spring', stage: 'reconcile', stageGroup: '确定·春季',
    title: '春约·旧诺', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '80-100', usedFlag: 'se_spring_third_4',
    req: "s => Characters.getAff(s, 'third') >= 80 && !isRefused(s, 'third')",
    text: 's => `${s.herName2}在血海渡口等你，手里还是那只歪黄鹂——当年的那一只，已经补过三回了。\n\n「我把它留着。」她说，「你猜为什么？」`',
    choices: [
      { text: '「因为我说过会回来。」', hint: '好感 +12 · 心性+4', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.xin += 4; s.log('她把纸鸢塞进你怀里，转身就走，走了几步又回头：「这次别放丢了。」'); }" },
      { text: '「因为你自己舍不得。」', hint: '好感 +13', charaff: { key: 'third', d: 13 },
        apply: "s => { Characters.addAff(s, 'third', 13); s.log('她愣了一下，笑骂：「你这人……」后面的半句，被江风吃掉了。'); }" },
    ],
  },

  {
    id: 'se_spring_any_1', season: 'spring', stage: 'any', stageGroup: '通用·春季',
    title: '春耕·挑水', weight: 3, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-100', usedFlag: 'se_spring_any_1',
    req: 's => true',
    text: 's => `青石镇的春耕，需要人手。\n\n你挑了两桶水，从镇口走到田尾，肩膀磨出了印子。\n\n这个春天很普通，普通得让你想起自己本来是个什么人。`',
    choices: [
      { text: '踏踏实实挑完一天水', hint: '心性 +4 · 悟性 +2',
        apply: "s => { s.xin += 4; s.wu += 2; s.log('傍晚你坐在田埂上，看见星星一颗一颗亮起来。你忽然觉得，修仙也没什么了不起。'); }" },
      { text: '趁挑水的间隙，在田边练了三十遍剑', hint: '剑意 +4',
        apply: "s => { s.jian += 4; s.wu += 1; s.log('水挑得慢了些，被管事骂了一句。可你的剑，比昨天快了一点。'); }" },
      { text: '帮隔壁的阿婆把院子也扫了', hint: '机缘 +3 · 心性 +2',
        apply: "s => { s.ji += 3; s.xin += 2; s.log('阿婆塞给你两个煮鸡蛋，说：「好人会有好报的。」你笑着收下了。'); }" },
    ],
  },

  /* ============ 夏 · summer（13 条） ============ */

  {
    id: 'se_summer_herb_1', season: 'summer', stage: 'meet', stageGroup: '初识·夏季',
    title: '暑天·解暑汤', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '0-25', usedFlag: 'se_summer_herb_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.herb_met',
    text: 's => `六月流火。丹霞谷的丹炉比天气更热。\n\n${s.herName}守着一炉丹，额角的汗一直没停。她看见你，第一句是：「别进来，热。」`',
    choices: [
      { text: '转身去井里打水，熬了一锅酸梅汤', hint: '好感 +11 · 丹心+2', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.dan += 2; s.log('她喝了一整碗，才想起来问：「你从哪弄的梅子？」你说路上捡的。她说：「骗人。」但没拆穿。'); }" },
      { text: '接替她看火候，让她去歇一炷香', hint: '好感 +13（需丹心≥10）', charaff: { key: 'herb', d: 13 },
        apply: "s => { if (s.dan >= 10) { Characters.addAff(s, 'herb', 13); s.log('你烧了半炷香，火候稳得出奇。她回来看了看炉子，又看了看你：「……你什么时候学会的？」'); } else { Characters.addAff(s, 'herb', 4); s.log('火候被你烧坏了。她默默把丹倒掉，什么也没说。你比她还难受。'); } }" },
      { text: '在门口等她收工', hint: '好感 +6', charaff: { key: 'herb', d: 6 },
        apply: "s => { Characters.addAff(s, 'herb', 6); s.log('你等了两个时辰。她出来看见你，愣了一下：「你还没走？」——语气里有一点点，只有一点点的高兴。'); }" },
    ],
  },

  {
    id: 'se_summer_sister_1', season: 'summer', stage: 'meet', stageGroup: '初识·夏季',
    title: '夏练·三伏', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '0-25', usedFlag: 'se_summer_sister_1',
    req: 's => s.age >= 16 && s.jian >= 8 && s.charFlags && s.charFlags.sister_met',
    text: 's => `天剑宗的三伏练剑，午时不许停。\n\n场上倒下了大半。${s.sisterName}站得最直。她看见你快撑不住，只说了一句：「再撑一炷香。」`',
    choices: [
      { text: '咬着牙撑完', hint: '好感 +12 · 剑意+5 · 心性+2', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.jian += 5; s.xin += 2; s.log('你撑到了鼓声停。她走过你身边时，低声说：「今天的你，配得上这把剑。」'); }" },
      { text: '「你为什么能撑住？」', hint: '好感 +9 · 悟性+4', charaff: { key: 'sister', d: 9 },
        apply: "s => { Characters.addAff(s, 'sister', 9); s.wu += 4; s.log('「因为我知道倒下去会更疼。」她说。你后来想了很久这句话。'); }" },
      { text: '偷偷用真气给自己降温', hint: '好感 +4', charaff: { key: 'sister', d: 4 },
        apply: "s => { Characters.addAff(s, 'sister', 4); s.log('她瞥了你一眼，什么都没说。散了之后，她淡淡地补了一句：「三伏是练心的，不是练剑的。」'); }" },
    ],
  },

  {
    id: 'se_summer_third_1', season: 'summer', stage: 'meet', stageGroup: '初识·夏季',
    title: '夏雨·躲檐', weight: 7, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-25', usedFlag: 'se_summer_third_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.third_met',
    text: 's => `骤雨来得没有征兆。你和一个穿红衣的姑娘，挤在同一个屋檐下。\n\n雨很大。她靠着墙，手里转着一把短刀：「你说，雨什么时候停？」`',
    choices: [
      { text: '「等它想停的时候。」', hint: '好感 +12', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.log('她笑了：「这话像我们血海的人说的。」雨停的时候，她先走了，三步之外回头看了你一眼。'); }" },
      { text: '把伞递给她，自己淋雨走', hint: '好感 +15 · 心性+3', charaff: { key: 'third', d: 15 },
        apply: "s => { Characters.addAff(s, 'third', 15); s.xin += 3; s.log('她举着伞，站在原地看着你走远。第二次见面的时候，那把伞还在她手里。'); }" },
      { text: '和她一起等雨停，闲聊几句', hint: '好感 +8 · 悟性+2', charaff: { key: 'third', d: 8 },
        apply: "s => { Characters.addAff(s, 'third', 8); s.wu += 2; s.log('你们聊了血海外的天，聊了别人的雨。她说得不多，但一直在听。'); }" },
    ],
  },

  {
    id: 'se_summer_herb_2', season: 'summer', stage: 'crush', stageGroup: '熟悉·夏季',
    title: '夏夜·萤火', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '20-50', usedFlag: 'se_summer_herb_2',
    req: "s => Characters.getAff(s, 'herb') >= 20 && Characters.getAff(s, 'herb') < 70 && !isRefused(s, 'herb')",
    text: 's => `夏夜的药谷，萤火一片。\n\n${s.herName}坐在石阶上，看萤火落在药圃里。她说：「小时候我娘说，萤火是舍不得走的人。」`',
    choices: [
      { text: '捉一只放进她手心', hint: '好感 +14', charaff: { key: 'herb', d: 14 },
        apply: "s => { Characters.addAff(s, 'herb', 14); s.log('萤火在她掌心亮了又灭。她盯着看了很久，合拢手指，又慢慢张开——她没舍得捏住它。'); }" },
      { text: '「那你娘，是不是也舍不得你。」', hint: '好感 +12 · 心性+3', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.xin += 3; s.log('她把脸转过去，很久没说话。再开口时声音有一点哑：「你这个人，怎么什么都猜得到。」'); }" },
      { text: '安静陪着她，什么都没说', hint: '好感 +10', charaff: { key: 'herb', d: 10 },
        apply: "s => { Characters.addAff(s, 'herb', 10); s.log('那一夜你们一句话都没说。萤火绕着你们，飞了整整一炷香。'); }" },
    ],
  },

  {
    id: 'se_summer_sister_2', season: 'summer', stage: 'crush', stageGroup: '熟悉·夏季',
    title: '暑夜·蝉声', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '20-50', usedFlag: 'se_summer_sister_2',
    req: "s => Characters.getAff(s, 'sister') >= 20 && Characters.getAff(s, 'sister') < 70 && !isRefused(s, 'sister')",
    text: 's => `三伏的夜，蝉叫得人心烦。\n\n${s.sisterName}坐在剑庐外，难得地没有擦剑。她说：「你听。」你说听什么。她说：「蝉。」`',
    choices: [
      { text: '「蝉有什么好听的。」', hint: '好感 +8', charaff: { key: 'sister', d: 8 },
        apply: "s => { Characters.addAff(s, 'sister', 8); s.log('「它叫一个夏天，就死了。」她说，「你说它图什么。」她看你一眼，把问题留下了。'); }" },
      { text: '「它在拼命活着。」', hint: '好感 +13 · 心性+3', charaff: { key: 'sister', d: 13 },
        apply: "s => { Characters.addAff(s, 'sister', 13); s.xin += 3; s.log('她怔了一下，忽然轻声笑：「……嗯。拼命活着。」那晚她第一次，在你面前笑出声。'); }" },
      { text: '陪她听，直到蝉声停', hint: '好感 +15', charaff: { key: 'sister', d: 15 },
        apply: "s => { Characters.addAff(s, 'sister', 15); s.log('天亮了。她站起来，拍了拍衣服：「走了。」走出去几步，她停下来等你。'); }" },
    ],
  },

  {
    id: 'se_summer_third_2', season: 'summer', stage: 'crush', stageGroup: '熟悉·夏季',
    title: '夏市·花灯', weight: 7, priority: 0, once_per_year: true, place: 'any',
    affRange: '20-50', usedFlag: 'se_summer_third_2',
    req: "s => Characters.getAff(s, 'third') >= 20 && Characters.getAff(s, 'third') < 70 && !isRefused(s, 'third')",
    text: 's => `夏夜市集，人挤人。\n\n${s.herName2}戴着斗笠，混在人群里，手里捏着一只空花灯。她看见你，皱眉：「你怎么阴魂不散。」`',
    choices: [
      { text: '买一支笔，在她的灯上画一只黄鹂', hint: '好感 +16', charaff: { key: 'third', d: 16 },
        apply: "s => { Characters.addAff(s, 'third', 16); s.log('她盯着那只歪黄鹂，半天憋出一句：「……画得真丑。」可放灯的时候，她把它放得最高。'); }" },
      { text: '「血海的人，也来逛灯市？」', hint: '好感 +9', charaff: { key: 'third', d: 9 },
        apply: "s => { Characters.addAff(s, 'third', 9); s.log('「我来看别人过日子。」她说，「看看别人的夜，是不是也这么黑。」'); }" },
      { text: '替她挡住人群，护着她走到河边', hint: '好感 +14 · 心性+2', charaff: { key: 'third', d: 14 },
        apply: "s => { Characters.addAff(s, 'third', 14); s.xin += 2; s.log('你的后背被人撞了很多下。她在你身后，走得很慢，慢到你不忍心回头催。'); }" },
    ],
  },

  {
    id: 'se_summer_herb_3', season: 'summer', stage: 'bond', stageGroup: '暧昧·夏季',
    title: '夏炉·守丹', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '45-80', usedFlag: 'se_summer_herb_3',
    req: "s => Characters.getAff(s, 'herb') >= 45 && Characters.getAff(s, 'herb') < 100 && !isRefused(s, 'herb')",
    text: 's => `这一炉「九转还魂丹」要守七天七夜，中途不能停火。\n\n${s.herName}守了三天，眼睛已经红了。她说：「你回去吧，我一个人可以。」`',
    choices: [
      { text: '「我陪你守。」', hint: '好感 +18 · 丹心+5', charaff: { key: 'herb', d: 18 },
        apply: "s => { Characters.addAff(s, 'herb', 18); s.dan += 5; s.log('后四天，你们轮流打盹。第七天丹成时，她靠在你肩上睡着了，睫毛上还沾着炉灰。'); }" },
      { text: '替她守一夜，让她去睡', hint: '好感 +15 · 丹心+3', charaff: { key: 'herb', d: 15 },
        apply: "s => { Characters.addAff(s, 'herb', 15); s.dan += 3; s.log('第二天她醒来，看见炉火稳着，什么都没说，只是把最厚的那件外衫披到了你肩上。'); }" },
      { text: '回房休息（她一个人守）', hint: '好感 +3', charaff: { key: 'herb', d: 3 },
        apply: "s => { Characters.addAff(s, 'herb', 3); s.log('你走后，她一个人在炉边坐到了天亮。丹成了，她也没叫醒你。'); }" },
    ],
  },

  {
    id: 'se_summer_sister_3', season: 'summer', stage: 'bond', stageGroup: '暧昧·夏季',
    title: '夏瀑·寒潭', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '45-80', usedFlag: 'se_summer_sister_3',
    req: "s => Characters.getAff(s, 'sister') >= 45 && Characters.getAff(s, 'sister') < 100 && !isRefused(s, 'sister')",
    text: 's => `三伏天里，后山有一挂瀑布，底下是寒潭。\n\n${s.sisterName}说：「下去。」你说这水能冻死人。她说：「对。所以要下。」`',
    choices: [
      { text: '咬牙跳下去', hint: '好感 +17 · 剑意+5 · 心性+3', charaff: { key: 'sister', d: 17 },
        apply: "s => { Characters.addAff(s, 'sister', 17); s.jian += 5; s.xin += 3; s.log('你在潭里冻得发抖。她站在岸上看了一会儿，也跳下来了——她说：「一个人冻没意思。」'); }" },
      { text: '「你先下。」', hint: '好感 +10', charaff: { key: 'sister', d: 10 },
        apply: "s => { Characters.addAff(s, 'sister', 10); s.log('她盯着你看了两息，转身下了水。你在岸上站了很久，最后还是跟着下去了。'); }" },
      { text: '在潭边替她温着酒', hint: '好感 +13 · 心性+3', charaff: { key: 'sister', d: 13 },
        apply: "s => { Characters.addAff(s, 'sister', 13); s.xin += 3; s.log('她上来，接过温好的酒，喝了一口，忽然说：「你比我想的，要懂事一点。」'); }" },
    ],
  },

  {
    id: 'se_summer_third_3', season: 'summer', stage: 'bond', stageGroup: '暧昧·夏季',
    title: '夏猎·放生', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '45-80', usedFlag: 'se_summer_third_3',
    req: "s => Characters.getAff(s, 'third') >= 45 && Characters.getAff(s, 'third') < 100 && !isRefused(s, 'third')",
    text: 's => `血海夏猎，猎场里关着一头白鹿，是宗主要她亲手杀的。\n\n${s.herName2}提着刀，站了很久。她说：「我要是放了它，爹会打断我的腿。」`',
    choices: [
      { text: '「那就放。腿断了，我背你。」', hint: '好感 +20 · 心性+5', charaff: { key: 'third', d: 20 },
        apply: "s => { Characters.addAff(s, 'third', 20); s.xin += 5; s.log('她看了你很久，然后笑了，把刀扔在地上，走过去解开了鹿的绳子。白鹿跑进林子里的时候，她一直没回头。'); }" },
      { text: '「先杀，再放。」（替她动手）', hint: '好感 +12', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.log('你替她完成了仪式。她看着地上的血，很久才说：「谢谢你。但这不是我要的。」'); }" },
      { text: '「那是你的事。」（不介入）', hint: '好感 +4', charaff: { key: 'third', d: 4 },
        apply: "s => { Characters.addAff(s, 'third', 4); s.log('她笑了一下，很凉：「对，是我的事。」后来那头鹿，她杀了。'); }" },
    ],
  },

  {
    id: 'se_summer_herb_4', season: 'summer', stage: 'reconcile', stageGroup: '确定·夏季',
    title: '夏荫·午睡', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '80-100', usedFlag: 'se_summer_herb_4',
    req: "s => Characters.getAff(s, 'herb') >= 80 && !isRefused(s, 'herb')",
    text: 's => `正午的药圃，蝉声很密。\n\n${s.herName}靠在老树下睡着了，草帽歪在一边。她睡得很沉，像是攒了很多年的困。`',
    choices: [
      { text: '替她把草帽扶正，坐在旁边守着', hint: '好感 +11 · 心性+4', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.xin += 4; s.log('她醒来的时候，第一句话是：「你一直在？」你说嗯。她转过脸去，很久才转回来。'); }" },
      { text: '去采一把草药，编成一个花环放在她手边', hint: '好感 +12 · 丹心+3', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.dan += 3; s.log('她醒来捡起花环，笑了：「药是救命的，你拿去编这个。」——可她把花环戴了好几天。'); }" },
    ],
  },

  {
    id: 'se_summer_sister_4', season: 'summer', stage: 'reconcile', stageGroup: '确定·夏季',
    title: '夏夜·同剑', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '80-100', usedFlag: 'se_summer_sister_4',
    req: "s => Characters.getAff(s, 'sister') >= 80 && !isRefused(s, 'sister')",
    text: 's => `${s.sisterName}把她的剑，递到你手里。\n\n「试试。」她说，「这把剑认人。它认不认你，你自己知道。」`',
    choices: [
      { text: '握剑，起势，舞了一式「归雁」', hint: '好感 +13 · 剑意+5', charaff: { key: 'sister', d: 13 },
        apply: "s => { Characters.addAff(s, 'sister', 13); s.jian += 5; s.log('剑很沉。你舞完，她在你身后站了很久，才说：「它认你了。」——你不知道她说的，是剑，还是她自己。'); }" },
      { text: '把剑还给她：「你的剑，该你自己握着。」', hint: '好感 +11 · 心性+4', charaff: { key: 'sister', d: 11 },
        apply: "s => { Characters.addAff(s, 'sister', 11); s.xin += 4; s.log('她接过剑，指尖和你碰了一下。她说：「嗯。你说得对。」那晚她握剑的姿势，比平时松。'); }" },
    ],
  },

  {
    id: 'se_summer_third_4', season: 'summer', stage: 'reconcile', stageGroup: '确定·夏季',
    title: '夏池·共浴（避）', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '80-100', usedFlag: 'se_summer_third_4',
    req: "s => Characters.getAff(s, 'third') >= 80 && !isRefused(s, 'third')",
    text: 's => `血海后山那口活水泉，夏夜里泛着白气。\n\n${s.herName2}坐在泉边洗头发，看见你来，没躲，也没让你走：「过来。帮我把头发绞干。」`',
    choices: [
      { text: '走过去，替她绞干长发', hint: '好感 +14 · 心性+4', charaff: { key: 'third', d: 14 },
        apply: "s => { Characters.addAff(s, 'third', 14); s.xin += 4; s.log('她的头发很长，一直绞到月过中天。她一句话没说，但你感觉到，她的手，一直没松。'); }" },
      { text: '「不方便。」转身要走', hint: '好感 +2', charaff: { key: 'third', d: 2 },
        apply: "s => { Characters.addAff(s, 'third', 2); s.log('她在你身后笑了一声：「你倒是个正经人。」那声笑，听着有点空。'); }" },
    ],
  },

  {
    id: 'se_summer_any_1', season: 'summer', stage: 'any', stageGroup: '通用·夏季',
    title: '暑热·茶棚', weight: 3, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-100', usedFlag: 'se_summer_any_1',
    req: 's => true',
    text: 's => `官道边的茶棚，三文钱一碗粗茶。\n\n棚里坐着一个说书的老人，正讲「三百年前那位剑仙，一剑劈开云海」的事。\n\n茶很苦，蝉很吵。`',
    choices: [
      { text: '听完这段书再走', hint: '悟性 +4 · 机缘 +2',
        apply: "s => { s.wu += 4; s.ji += 2; s.log('说书的最后一句是：「那位剑仙，年轻时也只是个挑水的。」你喝完茶，把这句话记住了。'); }" },
      { text: '给老人留一块碎银', hint: '心性 +4',
        apply: "s => { s.xin += 4; s.log('老人抬头看了你一眼：「后生，你眉间有剑气，也有尘气。」你笑了笑，走了。'); }" },
      { text: '在茶棚外练了一炷香的剑', hint: '剑意 +4 · 心性 +1',
        apply: "s => { s.jian += 4; s.xin += 1; s.log('过路的人都看你。你不在意。剑练到最后一遍的时候，蝉声好像停了。'); }" },
    ],
  },

  /* ============ 秋 · autumn（13 条） ============ */

  {
    id: 'se_autumn_herb_1', season: 'autumn', stage: 'meet', stageGroup: '初识·秋季',
    title: '秋收·采药', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '0-25', usedFlag: 'se_autumn_herb_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.herb_met',
    text: 's => `秋天是采药最好的时候。\n\n${s.herName}背着药篓，往人少的地方走。她说：「跟着我，别踩坑。」走了半天，她回头看你还在不在。`',
    choices: [
      { text: '跟得很紧，还替她探路', hint: '好感 +11 · 丹心+2 · 心性+2', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.dan += 2; s.xin += 2; s.log('你踩出的路，她走得比平时快。到山顶时她说：「今天收货比去年多。」'); }" },
      { text: '在山腰发现一株她找了很久的药', hint: '好感 +15 · 机缘+3', charaff: { key: 'herb', d: 15 },
        apply: "s => { Characters.addAff(s, 'herb', 15); s.ji += 3; s.log('她蹲在那株药前面，看了很久，忽然抬头冲你笑：「你这眼睛，比我的还好使。」'); }" },
      { text: '走散了，各采各的', hint: '好感 +3', charaff: { key: 'herb', d: 3 },
        apply: "s => { Characters.addAff(s, 'herb', 3); s.log('下山的时候你们在山脚碰上。她看了你一眼：「还以为你丢了。」'); }" },
    ],
  },

  {
    id: 'se_autumn_sister_1', season: 'autumn', stage: 'meet', stageGroup: '初识·秋季',
    title: '秋猎·剑林', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '0-25', usedFlag: 'se_autumn_sister_1',
    req: 's => s.age >= 16 && s.jian >= 8 && s.charFlags && s.charFlags.sister_met',
    text: 's => `剑宗的秋猎，猎的是「剑意」——林子里插着三百根木桩，桩上系着铃。\n\n${s.sisterName}已经挑落了十一只。她停下，把剑递给你看：「到你了。」`',
    choices: [
      { text: '尽力去挑，挑落几只算几只', hint: '好感 +12 · 剑意+5', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.jian += 5; s.log('你挑落了四只。她点点头：「够了。」她说的是「够了」，不是「只有四只」。'); }" },
      { text: '不动，只站在树下看她挑完剩下的', hint: '好感 +10 · 悟性+4', charaff: { key: 'sister', d: 10 },
        apply: "s => { Characters.addAff(s, 'sister', 10); s.wu += 4; s.log('你看了整整一个下午。她挑完最后一只，回头说：「看会了？」你点头。她把剑收起来。'); }" },
      { text: '问她为什么铃响了还要挑第二下', hint: '好感 +13', charaff: { key: 'sister', d: 13 },
        apply: "s => { Characters.addAff(s, 'sister', 13); s.log('她愣了一下，很久才说：「因为第一下，是我手抖。」——她第一次，承认自己手会抖。'); }" },
    ],
  },

  {
    id: 'se_autumn_third_1', season: 'autumn', stage: 'meet', stageGroup: '初识·秋季',
    title: '秋叶·红衣', weight: 7, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-25', usedFlag: 'se_autumn_third_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.third_met',
    text: 's => `满山红叶的时候，你在山道上又遇见她。\n\n${s.herName2}坐在路边的石头上，手里捏着一片叶子，看了很久。她说：「都红了。都不肯留。」`',
    choices: [
      { text: '坐在她旁边，一起看叶子落完', hint: '好感 +13 · 心性+3', charaff: { key: 'third', d: 13 },
        apply: "s => { Characters.addAff(s, 'third', 13); s.xin += 3; s.log('叶子落了一整个傍晚。她最后把手里那片，塞进了你的衣襟里：「拿着。」'); }" },
      { text: '「明年还会绿的。」', hint: '好感 +11', charaff: { key: 'third', d: 11 },
        apply: "s => { Characters.addAff(s, 'third', 11); s.log('「明年这棵树还是这棵树，明年我就不是我了。」她说。你没接话。她说：「你倒是会挑好听的讲。」'); }" },
      { text: '把红叶都收起来，替她夹进书里', hint: '好感 +15', charaff: { key: 'third', d: 15 },
        apply: "s => { Characters.addAff(s, 'third', 15); s.log('她看着你把叶子一页一页夹好，忽然说：「你这个人，为什么总做这种事。」你说不知道。'); }" },
    ],
  },

  {
    id: 'se_autumn_herb_2', season: 'autumn', stage: 'crush', stageGroup: '熟悉·秋季',
    title: '秋雨·伞下', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '20-50', usedFlag: 'se_autumn_herb_2',
    req: "s => Characters.getAff(s, 'herb') >= 20 && Characters.getAff(s, 'herb') < 70 && !isRefused(s, 'herb')",
    text: 's => `秋天的第一场雨，下在药谷收药的日子。\n\n${s.herName}抱着一摞药席往屋里跑，回头喊你：「快！」雨来得比她的话快。`',
    choices: [
      { text: '把伞塞给她，自己抱药席', hint: '好感 +14 · 心性+3', charaff: { key: 'herb', d: 14 },
        apply: "s => { Characters.addAff(s, 'herb', 14); s.xin += 3; s.log('药席保住了，你湿透了。她举着伞站在你旁边，一路都没往自己那边偏。'); }" },
      { text: '拉她一起躲进屋檐下', hint: '好感 +13', charaff: { key: 'herb', d: 13 },
        apply: "s => { Characters.addAff(s, 'herb', 13); s.log('屋檐很窄，你们挤在一起。雨声把两个人说话的声音，都盖得刚刚好。'); }" },
      { text: '先把药席抢救进屋，再回来接她', hint: '好感 +12 · 丹心+3', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.dan += 3; s.log('你回来的时候，她还在雨里，但看见你跑回来，她的表情松了一下。'); }" },
    ],
  },

  {
    id: 'se_autumn_sister_2', season: 'autumn', stage: 'crush', stageGroup: '熟悉·秋季',
    title: '秋夜·磨剑', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '20-50', usedFlag: 'se_autumn_sister_2',
    req: "s => Characters.getAff(s, 'sister') >= 20 && Characters.getAff(s, 'sister') < 70 && !isRefused(s, 'sister')",
    text: 's => `秋夜，剑庐里只有磨剑的声音。\n\n${s.sisterName}把磨石推给你：「试试。」你说你磨不好。她说：「我知道。所以我教你。」`',
    choices: [
      { text: '认真学，磨到深夜', hint: '好感 +15 · 剑意+5', charaff: { key: 'sister', d: 15 },
        apply: "s => { Characters.addAff(s, 'sister', 15); s.jian += 5; s.log('你磨坏了三块磨石。最后一遍，她站在你身后，手把手替你压住角度——她的手很凉。'); }" },
      { text: '问她这把剑的来历', hint: '好感 +11', charaff: { key: 'sister', d: 11 },
        apply: "s => { Characters.addAff(s, 'sister', 11); s.log('「前主人的。」她说，「他不磨剑，他磨我。」后面的话她没说完，磨石上的水痕，湿了很久。'); }" },
      { text: '把磨好的剑递还给她', hint: '好感 +9 · 心性+2', charaff: { key: 'sister', d: 9 },
        apply: "s => { Characters.addAff(s, 'sister', 9); s.xin += 2; s.log('她接过剑，看了刀口一眼，说了两个字：「还行。」——你说不清为什么，但你觉得这是夸奖。'); }" },
    ],
  },

  {
    id: 'se_autumn_third_2', season: 'autumn', stage: 'crush', stageGroup: '熟悉·秋季',
    title: '秋祭·河灯', weight: 7, priority: 0, once_per_year: true, place: 'any',
    affRange: '20-50', usedFlag: 'se_autumn_third_2',
    req: "s => Characters.getAff(s, 'third') >= 20 && Characters.getAff(s, 'third') < 70 && !isRefused(s, 'third')",
    text: 's => `秋祭这一夜，河里放满了灯。\n\n${s.herName2}也放了一盏——很小的那一种。她说：「我不给死人放，我给活人放。」`',
    choices: [
      { text: '「给谁？」', hint: '好感 +12 · 心性+2', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.xin += 2; s.log('「给我自己。」她说，「祝我明年还活着。」灯漂远了。她一直看着，直到看不见。'); }" },
      { text: '也放一盏，放在她旁边', hint: '好感 +16', charaff: { key: 'third', d: 16 },
        apply: "s => { Characters.addAff(s, 'third', 16); s.log('两盏灯并排漂着。她盯着看了很久，忽然说：「你的灯小，跟我的是一对。」说完自己愣了。'); }" },
      { text: '替她在灯上写了字', hint: '好感 +14', charaff: { key: 'third', d: 14 },
        apply: "s => { Characters.addAff(s, 'third', 14); s.log('你写了「平安」两个字。她把灯举起来看了半天，说：「我识的字不多。」可她把那两个字记了一辈子。'); }" },
    ],
  },

  {
    id: 'se_autumn_herb_3', season: 'autumn', stage: 'bond', stageGroup: '暧昧·秋季',
    title: '秋霜·护药', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '45-80', usedFlag: 'se_autumn_herb_3',
    req: "s => Characters.getAff(s, 'herb') >= 45 && Characters.getAff(s, 'herb') < 100 && !isRefused(s, 'herb')",
    text: 's => `第一场秋霜要来了。药圃里那几味最娇贵的药，熬不过霜。\n\n${s.herName}把所有的稻草都搬了出来，一个人盖到半夜。她的手，冻裂了口。`',
    choices: [
      { text: '把自己的外袍扯了，替药棚挡风', hint: '好感 +18 · 心性+4', charaff: { key: 'herb', d: 18 },
        apply: "s => { Characters.addAff(s, 'herb', 18); s.xin += 4; s.log('第二天药棚塌了半边，药却活着。她捧着你的袍子，一句话说得很小声：「你把命给我了。」'); }" },
      { text: '连夜用丹火炼了几枚暖玉，埋在药根旁', hint: '好感 +17 · 丹心+5', charaff: { key: 'herb', d: 17 },
        apply: "s => { Characters.addAff(s, 'herb', 17); s.dan += 5; s.log('暖玉烫手。她把手贴在土上试温度的时候，忽然抬头看你，眼睛亮得不像话。'); }" },
      { text: '陪她盖到天亮', hint: '好感 +15 · 心性+3', charaff: { key: 'herb', d: 15 },
        apply: "s => { Characters.addAff(s, 'herb', 15); s.xin += 3; s.log('天亮时你们并肩坐在田埂上。她说：「你说，我要是有一天不种药了，去干什么？」'); }" },
    ],
  },

  {
    id: 'se_autumn_sister_3', season: 'autumn', stage: 'bond', stageGroup: '暧昧·秋季',
    title: '秋斗·留手', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '45-80', usedFlag: 'se_autumn_sister_3',
    req: "s => Characters.getAff(s, 'sister') >= 45 && Characters.getAff(s, 'sister') < 100 && !isRefused(s, 'sister')",
    text: 's => `宗门秋试，你要和她对剑。\n\n${s.sisterName}站在对面，剑指你心口。她的剑，从来没有人接得住第三下。\n\n她说：「不许留手。」`',
    choices: [
      { text: '全力出剑', hint: '好感 +17 · 剑意+6', charaff: { key: 'sister', d: 17 },
        apply: "s => { Characters.addAff(s, 'sister', 17); s.jian += 6; s.log('你尽了全力，还是被挑落了剑。她收剑的时候手很稳，可你看见，她退后的那半步，是她自己让的。'); }" },
      { text: '留手，让她赢', hint: '好感 +8', charaff: { key: 'sister', d: 8 },
        apply: "s => { Characters.addAff(s, 'sister', 8); s.log('她赢了，却生气了：「你留手，是看不起我。」那是她第一次，当着这么多人的面，对你说重话。'); }" },
      { text: '在最后一下，硬接她的剑', hint: '好感 +19 · 剑意+4（受伤）', charaff: { key: 'sister', d: 19 },
        apply: "s => { Characters.addAff(s, 'sister', 19); s.jian += 4; s.shou -= 3; s.log('你硬接了。剑很沉，你的虎口裂了。她扔了剑跑过来，抓住你的手：「你疯了！」——她的声音在抖。'); }" },
    ],
  },

  {
    id: 'se_autumn_third_3', season: 'autumn', stage: 'bond', stageGroup: '暧昧·秋季',
    title: '秋杀·抗命', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '45-80', usedFlag: 'se_autumn_third_3',
    req: "s => Characters.getAff(s, 'third') >= 45 && Characters.getAff(s, 'third') < 100 && !isRefused(s, 'third')",
    text: 's => `血海宗主要她去灭一个村。理由很充分：「那个村子藏了剑宗的探子。」\n\n${s.herName2}站在院中，刀在鞘里，站了一整夜。`',
    choices: [
      { text: '「那个村子，我陪你去看。」', hint: '好感 +20 · 心性+5', charaff: { key: 'third', d: 20 },
        apply: "s => { Characters.addAff(s, 'third', 20); s.xin += 5; s.log('你们去了，查了一夜，什么也没查到。她回来后，把刀鞘解下来，第一次没带进宗主的堂。'); }" },
      { text: '「不去，会死。」', hint: '好感 +10', charaff: { key: 'third', d: 10 },
        apply: "s => { Characters.addAff(s, 'third', 10); s.log('她笑了一下：「我知道。」她去了。回来的时候，刀上有血。她没看你。'); }" },
      { text: '「你自己决定。我等你。」', hint: '好感 +15 · 心性+3', charaff: { key: 'third', d: 15 },
        apply: "s => { Characters.addAff(s, 'third', 15); s.xin += 3; s.log('她站到天亮，然后走进了宗主的堂，把刀解了。那年她挨了三十鞭。她说：「有人等我，我不能死。」'); }" },
    ],
  },

  {
    id: 'se_autumn_herb_4', season: 'autumn', stage: 'reconcile', stageGroup: '确定·秋季',
    title: '秋实·共收', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '80-100', usedFlag: 'se_autumn_herb_4',
    req: "s => Characters.getAff(s, 'herb') >= 80 && !isRefused(s, 'herb')",
    text: 's => `药圃大收。${s.herName}把最大的一筐，推到你的门口。\n\n「这是我的。」她说，「给你分一半——不是还你的，是……我想给你。」`',
    choices: [
      { text: '收下，说「那我也把我的分你一半」', hint: '好感 +12 · 心性+4', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.xin += 4; s.log('「你有什么好分的。」她笑，然后认真起来，「有的。你把你自己分我一半，就够了。」'); }" },
      { text: '挑出最好的那几味，留在她家', hint: '好感 +11 · 丹心+4', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.dan += 4; s.log('她发现的时候，你已经走了。第二天她把那几味药晒好，装进两个小袋，一袋自己留，一袋放在你门口。'); }" },
    ],
  },

  {
    id: 'se_autumn_sister_4', season: 'autumn', stage: 'reconcile', stageGroup: '确定·秋季',
    title: '秋誓·剑名', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '80-100', usedFlag: 'se_autumn_sister_4',
    req: "s => Characters.getAff(s, 'sister') >= 80 && !isRefused(s, 'sister')",
    text: 's => `${s.sisterName}在剑庐刻字。你凑近看，剑柄上刻着两个字。\n\n她没遮。她说：「你认得吗。」`',
    choices: [
      { text: '「认得。那是我的名字。」', hint: '好感 +13 · 心性+5', charaff: { key: 'sister', d: 13 },
        apply: "s => { Characters.addAff(s, 'sister', 13); s.xin += 5; s.log('「刻错了就刻错了。」她说得很平。可她的手，抖了一下。'); }" },
      { text: '从她手里接过刻刀，在下面补刻自己的', hint: '好感 +14 · 剑意+3', charaff: { key: 'sister', d: 14 },
        apply: "s => { Characters.addAff(s, 'sister', 14); s.jian += 3; s.log('两个字挨着，笔画有点挤。她说：「丑。」但那天晚上，她把剑抱在怀里睡的。'); }" },
    ],
  },

  {
    id: 'se_autumn_third_4', season: 'autumn', stage: 'reconcile', stageGroup: '确定·秋季',
    title: '秋途·同行', weight: 8, priority: 100, once_per_year: true, place: 'any',
    affRange: '80-100', usedFlag: 'se_autumn_third_4',
    req: "s => Characters.getAff(s, 'third') >= 80 && !isRefused(s, 'third')",
    text: 's => `你要远行。${s.herName2}把你送到渡口。\n\n她什么都没带，只带了一把没开刃的短刀。「送我。」她说，「路上说不定用得上。」`',
    choices: [
      { text: '「血海少主，送一个路人？」', hint: '好感 +11', charaff: { key: 'third', d: 11 },
        apply: "s => { Characters.addAff(s, 'third', 11); s.log('「谁说我送的是路人。」她说完就沉默了，一路沉默到渡口。'); }" },
      { text: '把自己的剑穗，系在她刀上', hint: '好感 +14 · 心性+4', charaff: { key: 'third', d: 14 },
        apply: "s => { Characters.addAff(s, 'third', 14); s.xin += 4; s.log('她把刀抽出来看了很久，又慢慢收回去，说：「这东西，我戴一辈子。」'); }" },
    ],
  },

  {
    id: 'se_autumn_any_1', season: 'autumn', stage: 'any', stageGroup: '通用·秋季',
    title: '秋市·论剑', weight: 3, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-100', usedFlag: 'se_autumn_any_1',
    req: 's => true',
    text: 's => `秋市热闹，擂台边围了半条街。\n\n一个散修在台上喊：「谁上来？赢了这柄剑归谁。」\n\n是一柄旧剑，锈迹斑斑。`',
    choices: [
      { text: '上台，正正经经打一场', hint: '剑意 +5 · 机缘 +2',
        apply: "s => { s.jian += 5; s.ji += 2; s.log('你赢了。那柄剑拿在手里，比看上去轻。剑上刻着一行小字，你没看懂。'); }" },
      { text: '站着看，不动', hint: '悟性 +4',
        apply: "s => { s.wu += 4; s.log('你看了十几场，看懂了每个人出剑时，心里的那点怕。这比赢，学到了更多。'); }" },
      { text: '买下那柄旧剑', hint: '机缘 +4 · 剑意 +2',
        apply: "s => { s.ji += 4; s.jian += 2; s.log('散修是个爽快人。他说这剑是从一个死人手里捡的。你把剑擦干净，剑身上，慢慢显出一朵梅。'); }" },
    ],
  },

  /* ============ 冬 · winter（13 条） ============ */

  {
    id: 'se_winter_herb_1', season: 'winter', stage: 'meet', stageGroup: '初识·冬季',
    title: '初雪·手炉', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '0-25', usedFlag: 'se_winter_herb_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.herb_met',
    text: 's => `第一场雪落下来的时候，${s.herName}的丹房冷得像冰窖。\n\n她搓着手，呵出的气都是白的。她看了一眼你的手炉，又移开视线。`',
    choices: [
      { text: '把手炉塞给她', hint: '好感 +13 · 心性+3', charaff: { key: 'herb', d: 13 },
        apply: "s => { Characters.addAff(s, 'herb', 13); s.xin += 3; s.log('她抱着手炉不说话。过了一会儿，她把它推回来：「两个人，一起用。」——她的手，和你的手，隔着一个手炉。'); }" },
      { text: '替她把丹房的炭盆生旺', hint: '好感 +11 · 丹心+2', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.dan += 2; s.log('炭火旺起来，屋子暖了。她说：「你烧的炭，比我的耐。」这话她说得很认真。'); }" },
      { text: '「冷就多穿点。」', hint: '好感 +5', charaff: { key: 'herb', d: 5 },
        apply: "s => { Characters.addAff(s, 'herb', 5); s.log('她瞪你一眼：「要你教。」那天她生了半天的火，才把丹房烧热。'); }" },
    ],
  },

  {
    id: 'se_winter_sister_1', season: 'winter', stage: 'meet', stageGroup: '初识·冬季',
    title: '雪中·立剑', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '0-25', usedFlag: 'se_winter_sister_1',
    req: 's => s.age >= 16 && s.jian >= 8 && s.charFlags && s.charFlags.sister_met',
    text: 's => `大雪。${s.sisterName}在雪里站桩，站了三个时辰。\n\n雪积到膝盖。她说：「今天站桩，站到雪停。」`',
    choices: [
      { text: '在她旁边，一起站', hint: '好感 +14 · 剑意+4 · 心性+3', charaff: { key: 'sister', d: 14 },
        apply: "s => { Characters.addAff(s, 'sister', 14); s.jian += 4; s.xin += 3; s.log('雪停了，你们都成了雪人。她转头看你，呼出一口白气：「你站得比我直。」'); }" },
      { text: '给她送一件斗篷', hint: '好感 +11 · 心性+2', charaff: { key: 'sister', d: 11 },
        apply: "s => { Characters.addAff(s, 'sister', 11); s.xin += 2; s.log('「站桩不能穿。」她没接。过了一会儿又补了一句：「……先放着。」'); }" },
      { text: '在屋檐下等她', hint: '好感 +7', charaff: { key: 'sister', d: 7 },
        apply: "s => { Characters.addAff(s, 'sister', 7); s.log('她站完，走过来，看了一眼你冻红的手：「等这么久，做什么。」'); }" },
    ],
  },

  {
    id: 'se_winter_third_1', season: 'winter', stage: 'meet', stageGroup: '初识·冬季',
    title: '雪夜·酒', weight: 7, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-25', usedFlag: 'se_winter_third_1',
    req: 's => s.age >= 16 && s.charFlags && s.charFlags.third_met',
    text: 's => `雪夜，酒肆里只剩下两个人。\n\n${s.herName2}坐在角落，面前一坛酒，没怎么动。她看见你，抬了抬下巴：「坐。」`',
    choices: [
      { text: '坐下，陪她喝', hint: '好感 +13 · 心性+2', charaff: { key: 'third', d: 13 },
        apply: "s => { Characters.addAff(s, 'third', 13); s.xin += 2; s.log('你喝到第三碗，她忽然说：「血海里，没人跟我喝过酒。」她说得很随便，你听得很重。'); }" },
      { text: '「一个人喝，容易醉。」', hint: '好感 +11', charaff: { key: 'third', d: 11 },
        apply: "s => { Characters.addAff(s, 'third', 11); s.log('「醉了才好。」她说，「醒着的时候，我都得是少主。」'); }" },
      { text: '替她添了一炉炭', hint: '好感 +12 · 心性+3', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.xin += 3; s.log('炭火旺了，她的脸被照红。她说：「你这人，不说话的时候，还挺好。」'); }" },
    ],
  },

  {
    id: 'se_winter_herb_2', season: 'winter', stage: 'crush', stageGroup: '熟悉·冬季',
    title: '冬至·饺子', weight: 7, priority: 0, once_per_year: true, place: 'danxia',
    affRange: '20-50', usedFlag: 'se_winter_herb_2',
    req: "s => Characters.getAff(s, 'herb') >= 20 && Characters.getAff(s, 'herb') < 70 && !isRefused(s, 'herb')",
    text: 's => `冬至。${s.herName}在包饺子，一个人包了一大簸箕。\n\n她说：「药谷就我一个人。」她说得很快，像是在赶什么。`',
    choices: [
      { text: '洗了手，坐在她对面一起包', hint: '好感 +14 · 心性+3', charaff: { key: 'herb', d: 14 },
        apply: "s => { Characters.addAff(s, 'herb', 14); s.xin += 3; s.log('你包的饺子歪歪扭扭。她笑：「像你。」——你不知道她说的像什么，但她说得开心。'); }" },
      { text: '「以后冬至我都来。」', hint: '好感 +16', charaff: { key: 'herb', d: 16 },
        apply: "s => { Characters.addAff(s, 'herb', 16); s.log('她包饺子的手停了。半天，她说：「说话算话。」你说算话。她低下头，继续包，包得比刚才快。'); }" },
      { text: '把饺子都煮了，端到她面前', hint: '好感 +12', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.log('她一口气吃了三大碗。吃完才想起来问：「你吃了吗？」'); }" },
    ],
  },

  {
    id: 'se_winter_sister_2', season: 'winter', stage: 'crush', stageGroup: '熟悉·冬季',
    title: '雪夜·旧伤', weight: 7, priority: 0, once_per_year: true, place: 'tianjian',
    affRange: '20-50', usedFlag: 'se_winter_sister_2',
    req: "s => Characters.getAff(s, 'sister') >= 20 && Characters.getAff(s, 'sister') < 70 && !isRefused(s, 'sister')",
    text: 's => `雪夜。剑庐里，${s.sisterName}一个人在换药。\n\n她的左肩有一道旧伤，从背一直裂到腰。她没避你，也没解释。`',
    choices: [
      { text: '走过去，接过药布，替她换完', hint: '好感 +18 · 心性+4', charaff: { key: 'sister', d: 18 },
        apply: "s => { Characters.addAff(s, 'sister', 18); s.xin += 4; s.log('伤口比看上去深。你换了很久。全程她一句话没说，只有最后一次，她的手抓住了你的手腕。'); }" },
      { text: '坐到门口，背过身去等', hint: '好感 +10 · 心性+2', charaff: { key: 'sister', d: 10 },
        apply: "s => { Characters.addAff(s, 'sister', 10); s.xin += 2; s.log('她换完药，走到门口：「你可以转过来了。」她的眼里，有一点你没见过的东西。'); }" },
      { text: '「谁伤的？」', hint: '好感 +12', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.log('「我自己。」她说，「那一剑，我躲得太慢了，因为我不想躲。」雪很大，她没再说了。'); }" },
    ],
  },

  {
    id: 'se_winter_third_2', season: 'winter', stage: 'crush', stageGroup: '熟悉·冬季',
    title: '冻湖·冰下', weight: 7, priority: 0, once_per_year: true, place: 'xuehai',
    affRange: '20-50', usedFlag: 'se_winter_third_2',
    req: "s => Characters.getAff(s, 'third') >= 20 && Characters.getAff(s, 'third') < 70 && !isRefused(s, 'third')",
    text: 's => `血海后山的湖，冻得能走人。\n\n${s.herName2}站在冰面上，往下看。冰层下有一尾鱼，冻在里面，还睁着眼。`',
    choices: [
      { text: '砸开一个洞', hint: '好感 +13 · 机缘+3', charaff: { key: 'third', d: 13 },
        apply: "s => { Characters.addAff(s, 'third', 13); s.ji += 3; s.log('鱼游走了。她把手伸进冰水里试了试，说：「真冷。」然后把湿手，贴在了你脖子上。'); }" },
      { text: '「救不了，别看了。」', hint: '好感 +8', charaff: { key: 'third', d: 8 },
        apply: "s => { Characters.addAff(s, 'third', 8); s.log('「我知道救不了。」她说，「我就是想看看。」她站了很久才走。'); }" },
      { text: '用真气把洞口四周的冰化了一小片', hint: '好感 +15 · 悟性+3', charaff: { key: 'third', d: 15 },
        apply: "s => { Characters.addAff(s, 'third', 15); s.wu += 3; s.log('鱼得了半尺活水。她看着，忽然哈哈大笑，笑到最后，声音有点变调。'); }" },
    ],
  },

  {
    id: 'se_winter_herb_3', season: 'winter', stage: 'bond', stageGroup: '暧昧·冬季',
    title: '寒夜·同炉', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '45-80', usedFlag: 'se_winter_herb_3',
    req: "s => Characters.getAff(s, 'herb') >= 45 && Characters.getAff(s, 'herb') < 100 && !isRefused(s, 'herb')",
    text: 's => `丹炉熄了三日。屋里冷得厉害。\n\n${s.herName}裹着被子坐在炉边，拍了拍旁边的位置：「冷。」她只说了一个字。`',
    choices: [
      { text: '坐过去，隔着半尺，一起烤火', hint: '好感 +18 · 心性+4', charaff: { key: 'herb', d: 18 },
        apply: "s => { Characters.addAff(s, 'herb', 18); s.xin += 4; s.log('火不大，烤了很久。天亮时你说「我该走了」，她说：「嗯。」可她的手，抓着被角，一直没松。'); }" },
      { text: '去把炉子重新点起来', hint: '好感 +15 · 丹心+4', charaff: { key: 'herb', d: 15 },
        apply: "s => { Characters.addAff(s, 'herb', 15); s.dan += 4; s.log('你花了一夜把炉修好。第二天她看着炉火说：「以后这炉子，你别让它熄。」'); }" },
      { text: '把自己的被子也搬过来', hint: '好感 +16 · 心性+3', charaff: { key: 'herb', d: 16 },
        apply: "s => { Characters.addAff(s, 'herb', 16); s.xin += 3; s.log('两床被子搭在一起，屋里暖了一点。她笑了，笑得没头没尾：「你这个人真笨。」'); }" },
    ],
  },

  {
    id: 'se_winter_sister_3', season: 'winter', stage: 'bond', stageGroup: '暧昧·冬季',
    title: '雪岭·相依', weight: 8, priority: 100, once_per_year: true, place: 'any',
    affRange: '45-80', usedFlag: 'se_winter_sister_3',
    req: "s => Characters.getAff(s, 'sister') >= 45 && Characters.getAff(s, 'sister') < 100 && !isRefused(s, 'sister')",
    text: 's => `一同押镖过雪岭。风雪太大，你们躲进了山坳的石洞。\n\n洞里只有一处背风的角落。${s.sisterName}没说话，先坐了进去。`',
    choices: [
      { text: '在洞口生火，替她挡风', hint: '好感 +18 · 心性+4', charaff: { key: 'sister', d: 18 },
        apply: "s => { Characters.addAff(s, 'sister', 18); s.xin += 4; s.log('你守了一夜的火。天快亮的时候，你发现身上多了件斗篷，她还睡在里侧，背对着你。'); }" },
      { text: '坐到她旁边，一半身子在风里', hint: '好感 +17 · 心性+3', charaff: { key: 'sister', d: 17 },
        apply: "s => { Characters.addAff(s, 'sister', 17); s.xin += 3; s.log('她往旁边挪了半寸，只挪了半寸。这个半寸，让你的左肩，暖和了一整夜。'); }" },
      { text: '「你睡，我看着。」', hint: '好感 +14', charaff: { key: 'sister', d: 14 },
        apply: "s => { Characters.addAff(s, 'sister', 14); s.log('「我从不睡觉。」她说。可后半夜，你听见她呼吸很轻，很匀。你什么都没提。'); }" },
    ],
  },

  {
    id: 'se_winter_third_3', season: 'winter', stage: 'bond', stageGroup: '暧昧·冬季',
    title: '岁末·刀誓', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '45-80', usedFlag: 'se_winter_third_3',
    req: "s => Characters.getAff(s, 'third') >= 45 && Characters.getAff(s, 'third') < 100 && !isRefused(s, 'third')",
    text: 's => `岁末，血海祭刀。按规矩，要杀一个人祭。\n\n${s.herName2}被推到台前。她看着你，什么也没说——那是她第一次，用那种眼神看你。`',
    choices: [
      { text: '站上台，替她挡下这一刀', hint: '好感 +20 · 心性+5（受伤）', charaff: { key: 'third', d: 20 },
        apply: "s => { Characters.addAff(s, 'third', 20); s.xin += 5; s.shou -= 4; s.log('你替她挨了。血溅在她脸上。她抱住你的时候，手在抖，嘴里一直说：「傻子。傻子。」'); }" },
      { text: '把祭品换成一头牲畜', hint: '好感 +15 · 悟性+3', charaff: { key: 'third', d: 15 },
        apply: "s => { Characters.addAff(s, 'third', 15); s.wu += 3; s.log('你使了个障眼法。宗主没看出来。她事后问你：「为什么帮我。」你说：「不为什么。」'); }" },
      { text: '冲上台，把她拉走', hint: '好感 +17 · 心性+4', charaff: { key: 'third', d: 17 },
        apply: "s => { Characters.addAff(s, 'third', 17); s.xin += 4; s.log('你拉着她跑出三里地。停下的时候，她甩开你的手，笑了：「你知不知道你在干什么。」然后又抓住你的手，没放。'); }" },
    ],
  },

  {
    id: 'se_winter_herb_4', season: 'winter', stage: 'reconcile', stageGroup: '确定·冬季',
    title: '雪夜·灯下', weight: 8, priority: 100, once_per_year: true, place: 'danxia',
    affRange: '80-100', usedFlag: 'se_winter_herb_4',
    req: "s => Characters.getAff(s, 'herb') >= 80 && !isRefused(s, 'herb')",
    text: 's => `岁末的雪，落了一夜。\n\n${s.herName}在灯下缝一件衣服。针脚很密，像是用了很多年才学会的耐心。\n\n她说：「你别看我。」`',
    choices: [
      { text: '坐在灯下，看她缝完', hint: '好感 +12 · 心性+4', charaff: { key: 'herb', d: 12 },
        apply: "s => { Characters.addAff(s, 'herb', 12); s.xin += 4; s.log('衣服缝好了，是给你的。她塞给你就跑。你穿上的时候才发觉，尺寸刚刚好。'); }" },
      { text: '「给我的？」', hint: '好感 +11', charaff: { key: 'herb', d: 11 },
        apply: "s => { Characters.addAff(s, 'herb', 11); s.log('「不是。」她说完，自己先笑了。灯芯爆了一下，谁也不说话了。'); }" },
    ],
  },

  {
    id: 'se_winter_sister_4', season: 'winter', stage: 'reconcile', stageGroup: '确定·冬季',
    title: '岁末·同守', weight: 8, priority: 100, once_per_year: true, place: 'tianjian',
    affRange: '80-100', usedFlag: 'se_winter_sister_4',
    req: "s => Characters.getAff(s, 'sister') >= 80 && !isRefused(s, 'sister')",
    text: 's => `除夕。剑宗的人都下山了。\n\n${s.sisterName}在剑庐煮了一锅面，很淡。她说：「守岁吧。」——她从不守岁。`',
    choices: [
      { text: '陪她守到天亮', hint: '好感 +13 · 心性+4', charaff: { key: 'sister', d: 13 },
        apply: "s => { Characters.addAff(s, 'sister', 13); s.xin += 4; s.log('新年第一缕光进来的时候，她说：「这是我二十年来，第一次守岁。」她顿了顿：「第一次有人陪。」'); }" },
      { text: '把面吃完，说「明年还来」', hint: '好感 +12', charaff: { key: 'sister', d: 12 },
        apply: "s => { Characters.addAff(s, 'sister', 12); s.log('她低头收碗，很久，说：「面煮得太淡了。」——她没说明年的事。可第二年的除夕，她煮了两碗。'); }" },
    ],
  },

  {
    id: 'se_winter_third_4', season: 'winter', stage: 'reconcile', stageGroup: '确定·冬季',
    title: '雪嫁·红衣', weight: 8, priority: 100, once_per_year: true, place: 'xuehai',
    affRange: '80-100', usedFlag: 'se_winter_third_4',
    req: "s => Characters.getAff(s, 'third') >= 80 && !isRefused(s, 'third')",
    text: 's => `雪最大的一天，${s.herName2}穿了一身红衣，站在血海门口。\n\n她说：「我们血海的人，冬天最难看。红衣服，压得住雪。」\n\n她手里，还是那只补过三回的黄鹂。`',
    choices: [
      { text: '走过去，牵起她的手', hint: '好感 +14 · 心性+5', charaff: { key: 'third', d: 14 },
        apply: "s => { Characters.addAff(s, 'third', 14); s.xin += 5; s.log('她的手很凉。她任你牵着，走了十几步，忽然说：「世人都说血海是黑的。」你说：「今天不是。」'); }" },
      { text: '「穿红的，是给人看的。」', hint: '好感 +12', charaff: { key: 'third', d: 12 },
        apply: "s => { Characters.addAff(s, 'third', 12); s.log('「是给你看的。」她说得很直白。雪落在她肩上，红得刺眼。'); }" },
    ],
  },

  {
    id: 'se_winter_any_1', season: 'winter', stage: 'any', stageGroup: '通用·冬季',
    title: '岁末·归途', weight: 3, priority: 0, once_per_year: true, place: 'any',
    affRange: '0-100', usedFlag: 'se_winter_any_1',
    req: 's => true',
    text: 's => `岁末的官道，一个人也没有。\n\n你走了很远，回头看，来路上只有你一个人的脚印。\n\n这一年快过去了。`',
    choices: [
      { text: '继续往前走', hint: '心性 +4',
        apply: "s => { s.xin += 4; s.log('你往前走了很多天。走到最后一天的时候，你看见远处的山，像是有人在等你。'); }" },
      { text: '在路边生一堆火，守到天亮', hint: '心性 +2 · 悟性 +3',
        apply: "s => { s.xin += 2; s.wu += 3; s.log('你想了很多事。有些想通了，有些，你打算留着明年再想。'); }" },
      { text: '折返，回青石镇看看', hint: '机缘 +3 · 心性 +2',
        apply: "s => { s.ji += 3; s.xin += 2; s.log('青石镇的老屋还在。门口坐着个孩子，正拿木剑比划。你看了他很久。'); }" },
    ],
  },

  /* ============ 婚姻 · 任意季节（3 条） ============ */

  {
    id: 'c_herb_marry_100', season: null, fixedSeason: null, stage: 'reconcile', stageGroup: '婚姻·药谷姑娘',
    title: '❦ 姻缘 · 药谷花开', weight: 20, priority: 900, once: true, once_per_year: false, place: 'danxia',
    affRange: '90', charLine: 'herb', usedFlag: 'marry_herb',
    req: "s => Characters.getAff(s, 'herb') >= 90 && s.charFlags && s.charFlags.herb_married_ready && !(s.charFlags.marriageDone && s.charFlags.marriageDone.herb) && !s.marriageLocked && !(s.flags && s.flags.go_home === true && s.flags.revenge_done !== true)",
    text: 's => `丹霞谷的药圃，这一季开满了花。\n\n${s.herName}站在花里，没有采药。她手里拿着一个小小的药囊——是你第一次上丹霞山时，丢在这里的那个。\n\n她说：「我想了很久。这世上我想留的东西不多，你是其中一个。」\n\n她看着你，眼睛很亮：「你……愿意吗？」`',
    choices: [
      { text: '「愿意。」', hint: '❦ 结为夫妻 · 婚姻结局', isMarriageAccept: true, cg: 'cg_end_marry_herb', result: 'marry_herb', charaff: { key: 'herb', d: 0 },
        apply: "s => { s.spouse_id = 'herb'; s.marriageLocked = true; s.charFlags = s.charFlags || {}; s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { herb: true }); s.flags.married = true; s.flags.married_to = 'herb'; s.log('她笑了，把药囊塞进你手里：「拿着。这次的药，是甜的。」——这一世的丹霞谷，从此有两个人种药。'); }" },
      { text: '「我心里有别人。」', hint: '婚姻不成立 · 好感 -5（永久关闭此缘）', isMarriageAccept: false, result: 'reject', charaff: { key: 'herb', d: -5 },
        apply: "s => { s.charFlags = s.charFlags || {}; s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { herb: true }); Characters.addAff(s, 'herb', -5); Characters.rejectMarriage(s, 'herb'); s.log('她愣了愣，把药囊慢慢收了回去，笑了一下：「这样啊。那……祝你。」她转身走进花里，没再回头。'); }" },
      { text: '「让我想想。」', hint: '婚姻未定 · 好感 +2（数年后可再续）', isMarriageAccept: false, result: 'postpone', charaff: { key: 'herb', d: 2 },
        apply: "s => { s.charFlags = s.charFlags || {}; s.flags = s.flags || {}; s.flags.marry_pending_herb = true; s.marryPendingAt = s.marryPendingAt || {}; s.marryPendingAt.herb = { year: (s.year || 1), aff: Characters.getAff(s, 'herb') }; Characters.addAff(s, 'herb', 2); s.log('她点点头，把药囊放在石桌上：「不急。药囊先放我这。你想好了，随时来取。」'); }" },
    ],
  },

  {
    id: 'c_sister_marry_100', season: null, fixedSeason: null, stage: 'reconcile', stageGroup: '婚姻·剑宗师姐',
    title: '❦ 姻缘 · 双剑并立', weight: 20, priority: 900, once: true, once_per_year: false, place: 'tianjian',
    affRange: '90', charLine: 'sister', usedFlag: 'marry_sister',
    req: "s => Characters.getAff(s, 'sister') >= 90 && s.charFlags && s.charFlags.sister_married_ready && !(s.charFlags.marriageDone && s.charFlags.marriageDone.sister) && !s.marriageLocked && !(s.flags && s.flags.go_home === true && s.flags.revenge_done !== true)",
    text: 's => `天剑宗后山，剑庐的门，第一次开着。\n\n${s.sisterName}把自己的剑，插在门前的雪地里。她说：「这剑，是我这辈子唯一护住的东西。」\n\n她抬起眼，第一次没有躲开你的目光：「现在我不想只护它一个。」\n\n「你说，我算什么？」`',
    choices: [
      { text: '「你算我的。」', hint: '❦ 结为夫妻 · 婚姻结局', isMarriageAccept: true, cg: 'cg_end_marry_sister', result: 'marry_sister', charaff: { key: 'sister', d: 0 },
        apply: "s => { s.spouse_id = 'sister'; s.marriageLocked = true; s.charFlags = s.charFlags || {}; s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { sister: true }); s.flags.married = true; s.flags.married_to = 'sister'; s.log('她看了你很久，然后走过去，把自己的剑拔出来，插回鞘里。她说：「那从今天起，我的剑，姓你的姓。」'); }" },
      { text: '「我们是同门。」', hint: '婚姻不成立 · 好感 -6（永久关闭此缘）', isMarriageAccept: false, result: 'reject', charaff: { key: 'sister', d: -6 },
        apply: "s => { s.charFlags = s.charFlags || {}; s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { sister: true }); Characters.addAff(s, 'sister', -6); Characters.rejectMarriage(s, 'sister'); s.log('她点点头，把剑收了回去。她说：「对。同门。」从那以后，她再也没有在你面前，说过一句多余的话。'); }" },
      { text: '「我得先了结一桩事。」', hint: '婚姻未定 · 好感 +2（数年后可再续）', isMarriageAccept: false, result: 'postpone', charaff: { key: 'sister', d: 2 },
        apply: "s => { s.charFlags = s.charFlags || {}; s.flags = s.flags || {}; s.flags.marry_pending_sister = true; s.marryPendingAt = s.marryPendingAt || {}; s.marryPendingAt.sister = { year: (s.year || 1), aff: Characters.getAff(s, 'sister') }; Characters.addAff(s, 'sister', 2); s.log('「了结完，回来。」她说，「剑我给你留着。」'); }" },
    ],
  },

  {
    id: 'c_third_marry_100', season: null, fixedSeason: null, stage: 'reconcile', stageGroup: '婚姻·血海修罗',
    title: '❦ 姻缘 · 落叶归根', weight: 20, priority: 900, once: true, once_per_year: false, place: 'xuehai',
    affRange: '90', charLine: 'third', usedFlag: 'marry_third',
    req: "s => Characters.getAff(s, 'third') >= 90 && s.charFlags && s.charFlags.third_married_ready && !(s.charFlags.marriageDone && s.charFlags.marriageDone.third) && !s.marriageLocked && !(s.flags && s.flags.go_home === true && s.flags.revenge_done !== true)",
    text: 's => `血海渡口。${s.herName2}把那半幅黄鹂画，铺在石头上。\n\n「我爹问我，要血海还是要你。」她笑了一下，笑得很难看，「我说，我都要。」\n\n她站起来，走到你面前，把另外半幅塞给你：「凑齐了。这画我画了十一年。」\n\n「你要是点头，我就烧了血海的旗。」`',
    choices: [
      { text: '「点。」', hint: '❦ 结为夫妻 · 婚姻结局', isMarriageAccept: true, cg: 'cg_end_marry_third', result: 'marry_third', charaff: { key: 'third', d: 0 },
        apply: "s => { s.spouse_id = 'third'; s.marriageLocked = true; s.charFlags = s.charFlags || {}; s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { third: true }); s.flags.married = true; s.flags.married_to = 'third'; s.log('她第二天真的烧了旗。半幅画在你怀里，另半幅，她缝在了自己的袖口。她说：「落叶归根。我的根，在这儿。」'); }" },
      { text: '「你回血海去吧。」', hint: '婚姻不成立 · 好感 -6（永久关闭此缘）', isMarriageAccept: false, result: 'reject', charaff: { key: 'third', d: -6 },
        apply: "s => { s.charFlags = s.charFlags || {}; s.charFlags.marriageDone = Object.assign({}, s.charFlags.marriageDone || {}, { third: true }); Characters.addAff(s, 'third', -6); Characters.rejectMarriage(s, 'third'); s.log('她慢慢把画收回去，收得很仔细，很慢。她说：「好。」她把那幅画，又撕了一次。'); }" },
      { text: '「血海是你爹的命。」', hint: '婚姻未定 · 好感 +2（数年后可再续）', isMarriageAccept: false, result: 'postpone', charaff: { key: 'third', d: 2 },
        apply: "s => { s.charFlags = s.charFlags || {}; s.flags = s.flags || {}; s.flags.marry_pending_third = true; s.marryPendingAt = s.marryPendingAt || {}; s.marryPendingAt.third = { year: (s.year || 1), aff: Characters.getAff(s, 'third') }; Characters.addAff(s, 'third', 2); s.log('她看了你很久，然后把画收进怀里：「你说得对。我再想想。」'); }" },
    ],
  },

  /* ============================================================
     婚后事件库（第九轮新增 · 38 条）
     ------------------------------------------------------------
     接入方式：
       · 与季节事件同属 GAME_CONFIG.seasonEvents，由 season.js 的
         compileEvents() 统一编译 → engine.seasonEvents() → allEvents()。
       · 新增可选字段 post / postStage / tag / cooldown，全部向后兼容：
         未标注 post 的既有事件行为完全不变。
       · post: true      → 仅已婚（spouse_id 或 flags.married）后进入候选池
       · priority: 300+  → 高于季节(0)/角色链(100)，低于主线(500)/婚姻(900)
       · cooldown: N     → 触发后 N 年内不再出现（默认取 postMarriage.defaultCooldownYears）
       · 变量影响：money（家财）/ stress（心累）/ kids（子女）/ 好感 / 心性
       · 链式推进：choice.next 指向下一条事件 id，实现「主线 + 支线」持续延伸
     主题分布：A 开局 3 · B 日常 6 · C 矛盾 7 · D 育儿 7
               E 经济 5 · F 亲戚 4 · G 事业 4 · H 纪念/突发 4
     ============================================================ */

  /* ============ A · 婚后开局（主线起手，一次性） ============ */

  {
    id: 'post_open_1', season: null, stage: 'post', post: true, postStage: '婚后·开端', tag: '日常',
    title: '❦ 婚后 · 新家', weight: 30, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_open_done',
    req: "s => Characters.isMarried(s) && !Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `成婚后第一个清晨，你在陌生的屋子里醒来。\n\n${Characters.spouseName(s)}起得比你早，正在灶前忙活。她回头看你一眼，眼里有种很少见的东西——像是终于敢放松下来。\n\n「这个家，以后怎么办，你想过没有？」`",
    choices: [
      { text: '「一起过。」你把她手里的柴接过去', hint: '好感 +5 · 家财 +5 · 心累 -5', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addMoney(s, 5); Characters.addStress(s, -5); Characters.setFamilyFlag(s, 'post_open_done'); Characters.setFamilyFlag(s, 'post_shared_house'); s.log('她没说话，但把早饭多做了一份。你说以后的日子会很长，她嗯了一声。'); }" },
      { text: '「先把家底盘一盘。」', hint: '家财 +12 · 心累 +3', charaff: { key: 'spouse', d: 2 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 2); Characters.addMoney(s, 12); Characters.addStress(s, 3); Characters.setFamilyFlag(s, 'post_open_done'); Characters.setFamilyFlag(s, 'post_thrifty'); s.log('你翻出两人所有的家当，算了半天。她靠在门边看你算账，忽然笑了：「你算得这么认真，像是要跟我过一辈子。」'); }" },
      { text: '「以后你说了算。」', hint: '好感 +8 · 心累 -8', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, -8); Characters.setFamilyFlag(s, 'post_open_done'); Characters.setFamilyFlag(s, 'post_her_rule'); s.log('她愣了一下，随即板起脸：「那你可别后悔。」——后来你发现，她管得确实比你好。'); }" },
    ],
  },

  {
    id: 'post_open_2', season: null, stage: 'post', post: true, postStage: '婚后·开端', tag: '亲戚',
    title: '婚后 · 拜见师门', weight: 22, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_meet_sect',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done') && !Characters.getFamilyFlag(s, 'post_meet_sect')",
    text: "s => `成了家的人，总要回一趟师门。\n\n长老师兄们围着你打量，眼神里满是探询。最后大师兄拍拍你的肩：「成了家，剑还利索吗？」\n\n${Characters.spouseName(s)}站在你身后替你提剑，一声没吭。`",
    choices: [
      { text: '当场与大师兄过了三十招，剑势不减', hint: '好感 +6 · 剑意 +4', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); s.jian += 4; Characters.setFamilyFlag(s, 'post_meet_sect'); s.log('三十招后你收剑。她眼睛亮了一下，那眼神跟当年看你在试剑台上出剑时一模一样。'); }" },
      { text: '「利索不利索，回家了才知道。」', hint: '好感 +9 · 心性 +3', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); s.xin += 3; Characters.setFamilyFlag(s, 'post_meet_sect'); s.log('满堂哄笑。她的耳根红了一下，转身先去牵马。'); }" },
      { text: '把话头岔开，只谈家事', hint: '家财 +6 · 好感 +3', charaff: { key: 'spouse', d: 3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 3); Characters.addMoney(s, 6); Characters.setFamilyFlag(s, 'post_meet_sect'); s.log('你聊起铺子里的药材走势，师兄们听得一头雾水。她在一旁偷偷掐了你一把。'); }" },
    ],
  },

  {
    id: 'post_open_3', season: null, stage: 'post', post: true, postStage: '婚后·开端', tag: '日常',
    title: '婚后 · 分房与共枕', weight: 20, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_night_1',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done') && !Characters.getFamilyFlag(s, 'post_night_1')",
    text: "s => `新家里只有一间能住人的屋子。\n\n夜里，${Characters.spouseName(s)}抱着被子在门口站了很久，没进来，也没走。\n\n烛火跳动，谁也不看谁。`",
    choices: [
      { text: '把自己卷到最里侧，给她留大半张床', hint: '好感 +10 · 心累 -6', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 10); Characters.addStress(s, -6); Characters.setFamilyFlag(s, 'post_night_1'); s.log('她躺下的时候离你还有一尺。半夜你醒来，发现那一尺没有了。'); }" },
      { text: '「外面冷，进来吧。」', hint: '好感 +12 · 心累 -8', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); Characters.addStress(s, -8); Characters.setFamilyFlag(s, 'post_night_1'); s.log('她把被子放下，吹了灯，很久才说：「我从前一个人睡了二十年。」你握住她的手。'); }" },
      { text: '起身在院子里坐到天亮', hint: '好感 -4 · 心性 +4', charaff: { key: 'spouse', d: -4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -4); s.xin += 4; Characters.addStress(s, 4); Characters.setFamilyFlag(s, 'post_night_1'); s.log('天亮时你回屋，她已经把地扫了，被子叠得整整齐齐，像没人睡过。'); }" },
    ],
  },

  /* ============ B · 日常琐事（可重复 + 冷却） ============ */

  {
    id: 'post_daily_cook', season: null, stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 灶前', weight: 14, priority: 300, repeat: true, once_per_year: false, cooldown: 4, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `晚饭时灶上出了岔子。\n\n${Characters.spouseName(s)}挽着袖子站在锅前，眉头拧成一团。她说：「你去做别的。」但你闻到了一股糊味。`",
    choices: [
      { text: '不动声色地接过来，重新做一份', hint: '好感 +4 · 心累 -3', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 4); Characters.addStress(s, -3); s.log('你把糊的那锅倒了，重新起火。她站在旁边看你颠勺，末了说：「明天我来，我学。」'); }" },
      { text: '「火太大了，我教你。」', hint: '好感 +3 · 心性 +2', charaff: { key: 'spouse', d: 3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 3); s.xin += 2; s.log('你们挤在灶台前，你手把手教她控火。这顿饭做得比平时慢一半，却比平时香。'); }" },
      { text: '照旧吃，什么都不说', hint: '好感 +1 · 心累 +2', charaff: { key: 'spouse', d: 1 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 1); Characters.addStress(s, 2); s.log('一顿糊饭下肚。她没抬头，第二天默默买回一本菜谱。'); }" },
    ],
  },

  {
    id: 'post_daily_laundry', season: 'spring', stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 春衣', weight: 12, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `春日里换季，院子里晾满了一竿子衣裳。\n\n你注意到自己的每一件袍子，袖口都被细细补过——针脚很密，一看就花了不少时辰。`",
    choices: [
      { text: '把她那件旧衣也拿去补了', hint: '好感 +5 · 心累 -2', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addStress(s, -2); s.log('你笨手笨脚缝了半晌，针扎了手。她抢过去看，看完没说话，把袖子挽起来给你看：「扎这儿才不疼。」'); }" },
      { text: '从集市上给她买一件新的', hint: '好感 +7 · 家财 -8', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); Characters.addMoney(s, -8); s.log('她嘴上说浪费，晚上却把新衣试了三回，对着水面照了又照。'); }" },
      { text: '默默把晾衣竿加固了一下', hint: '好感 +3 · 心累 -3', charaff: { key: 'spouse', d: 3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 3); Characters.addStress(s, -3); s.log('竿子不再晃了。她收衣服的时候停了一下，回头看了看你。'); }" },
    ],
  },

  {
    id: 'post_daily_letter', season: 'autumn', stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 家书', weight: 12, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `秋雁南飞，镇上来了送信的驿使。\n\n你收到一封没有落款的短笺，纸上只有四个字：「剑归何处。」\n\n${Characters.spouseName(s)}站在你身后，看到了那四个字。`",
    choices: [
      { text: '当着她的面把信烧了', hint: '好感 +8 · 心累 -3', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, -3); s.log('火光里她看着那四个字化成灰，很久才说：「你不用为我烧的。」你说：「我是为自己烧的。」'); }" },
      { text: '把信收好，坦白告诉她来历', hint: '好感 +6 · 心性 +3', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); s.xin += 3; s.log('你一五一十说完。她点点头：「写这四个字的人，胆子倒不小。」她笑了一下，笑得挺好看。'); }" },
      { text: '什么也没说，把信揣进怀里', hint: '好感 -5 · 心累 +6', charaff: { key: 'spouse', d: -5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -5); Characters.addStress(s, 6); s.log('她转身回了屋。那晚的灯，亮得比平时久。'); }" },
    ],
  },

  {
    id: 'post_daily_well', season: 'summer', stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 井水', weight: 12, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `盛夏午后，井里的水凉得刺骨。\n\n你打了一桶水上来，正看见${Characters.spouseName(s)}坐在廊下，用手里的团扇扇着一碗凉茶——茶是给你留的。`",
    choices: [
      { text: '先让她喝', hint: '好感 +5 · 心累 -2', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addStress(s, -2); s.log('她推辞了一下还是喝了。喝完把碗递回给你：「剩下的归你。」碗沿还带着她唇边的凉意。'); }" },
      { text: '把瓜浸在井里，晚上一起吃', hint: '好感 +6 · 家财 -3', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); Characters.addMoney(s, -3); s.log('晚上你们分着吃那半个瓜。她说小时候家里买不起瓜，你说明年多种两个。'); }" },
      { text: '打满两缸水，省得她再跑', hint: '好感 +4 · 心累 -4', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 4); Characters.addStress(s, -4); s.log('两缸水够用半个月。她站在门口看你挑水，从日头正中看到日头偏西。'); }" },
    ],
  },

  {
    id: 'post_daily_sword', season: null, stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 双剑', weight: 13, priority: 300, repeat: true, once_per_year: false, cooldown: 6, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `天没亮，院子里传来剑风。\n\n${Characters.spouseName(s)}一个人在练剑，招式比当年慢了半分，却稳了许多。她见你出来，把剑递过来一半：「要不要？」`",
    choices: [
      { text: '接剑，与她对练一场', hint: '好感 +6 · 剑意 +3', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); s.jian += 3; s.log('你们拆了一百来招，天都亮了。收剑时她喘着气笑：「不赖。」'); }" },
      { text: '在一旁看，给她递水', hint: '好感 +4 · 心累 -3', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 4); Characters.addStress(s, -3); s.log('她练了整整一个时辰。你什么也没做，她收剑的时候说：「你在，我练得踏实。」'); }" },
      { text: '「别练了，身体要紧。」', hint: '好感 +2 · 心累 +3', charaff: { key: 'spouse', d: 2 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 2); Characters.addStress(s, 3); s.log('她收了剑，没说什么。第二天照样早起，只是把练剑的地方挪到了后院。'); }" },
    ],
  },

  {
    id: 'post_daily_market', season: null, stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 同逛集市', weight: 13, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done')",
    text: "s => `镇集开市，人挤人。\n\n${Characters.spouseName(s)}走在你前面半步，眼睛在摊子上转，却什么都只问价不买。你注意到她在一个卖银簪的摊前站了一会儿。`",
    choices: [
      { text: '悄悄把簪子买下来，晚上给她', hint: '好感 +9 · 家财 -10', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addMoney(s, -10); s.log('她拆开纸包的时候手抖了一下。她说：「我又不是小姑娘了。」然后把簪子戴上，一晚上没摘。'); }" },
      { text: '陪她把每个摊子都逛一遍', hint: '好感 +6 · 心累 -3', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); Characters.addStress(s, -3); s.log('你们逛到收市。她只买了一把菜刀，说是家里那把卷刃了。'); }" },
      { text: '「快点，我还有事。」', hint: '好感 -6 · 心累 +8', charaff: { key: 'spouse', d: -6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -6); Characters.addStress(s, 8); s.log('她立刻加快了步子，什么都没再问。回家的路上，你们隔着三步远。'); }" },
    ],
  },

  /* ============ C · 夫妻互动与矛盾（stress 驱动，链式） ============ */

  {
    id: 'post_strife_1', season: null, stage: 'post', post: true, postStage: '婚后·磨合', tag: '矛盾',
    title: '婚后 · 第一次争吵', weight: 24, priority: 340, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_strife_1_done',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_open_done') && !Characters.getFamilyFlag(s, 'post_strife_1_done')",
    text: "s => `成婚第十日，你们为了一件小事吵了起来——\n\n是柴火、是账目、是她说你要多穿一件，你嫌她啰嗦。总之，话说重了。\n\n${Characters.spouseName(s)}转身进了屋，把门轻轻带上了。那一声「轻」，比摔门还重。`",
    choices: [
      { text: '当晚就去敲门，把话说开', hint: '好感 +8 · 心累 -10', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, -10); Characters.setFamilyFlag(s, 'post_strife_1_done'); Characters.setFamilyFlag(s, 'post_repair_good'); s.log('门开了。她红着眼问你：「你是不是后悔了？」你说没有。她信了。'); }" },
      { text: '沉默三天，各过各的', hint: '好感 -6 · 心累 +18 · → 冷战', next: 'post_strife_2', charaff: { key: 'spouse', d: -6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -6); Characters.addStress(s, 18); Characters.setFamilyFlag(s, 'post_strife_1_done'); Characters.setFamilyFlag(s, 'post_cold_war'); s.log('三天里你们照常吃饭，谁也没先开口。屋里的空气结了一层霜。'); }" },
      { text: '第二天一早，做一顿她爱吃的', hint: '好感 +5 · 心累 -3', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addStress(s, 3); Characters.setFamilyFlag(s, 'post_strife_1_done'); s.log('她看着那碗面，忽然就哭了。你们谁也没提前一晚的事。'); }" },
    ],
  },

  {
    id: 'post_strife_2', season: null, stage: 'post', post: true, postStage: '婚后·磨合', tag: '矛盾',
    title: '婚后 · 心里的刺', weight: 18, priority: 340, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_strife_1_done') && Characters.getStress(s) >= 40",
    text: "s => `夜里${Characters.spouseName(s)}忽然问你：「你有没有一个，到现在都忘不掉的人？」\n\n她问得很轻，像怕吵醒什么。你们之间的心累，已经积得不轻了。`",
    choices: [
      { text: '「有过。现在是你。」', hint: '好感 +10 · 心累 -12', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 10); Characters.addStress(s, -12); s.log('她想了想，说：「那你以后别忘了今天的话。」说完把头埋进被子里，不理你了。'); }" },
      { text: '「没有，别胡思乱想。」', hint: '好感 +2 · 心累 +6', charaff: { key: 'spouse', d: 2 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 2); Characters.addStress(s, 6); s.log('她哦了一声，翻过身去。你知道她没信。'); }" },
      { text: '反问：「你有吗？」', hint: '好感 -3 · 心累 +10', charaff: { key: 'spouse', d: -3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -3); Characters.addStress(s, 10); s.log('她沉默了很久，说：「有。今天起，没有了。」你听不出这是好话还是坏话。'); }" },
    ],
  },

  {
    id: 'post_strife_3', season: null, stage: 'post', post: true, postStage: '婚后·磨合', tag: '矛盾',
    title: '婚后 · 心魔夜话', weight: 16, priority: 360, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_strife_3_done',
    req: "s => Characters.isMarried(s) && Characters.getStress(s) >= 75 && !Characters.getFamilyFlag(s, 'post_strife_3_done')",
    text: "s => `心累到了极点的那晚，你在睡梦里拔了剑。\n\n剑光劈开了枕边的一角。你惊醒时，${Characters.spouseName(s)}坐在床边，手里端着灯，脸上没有惊，只有累。\n\n她说：「你从什么时候开始，连睡着了都不安稳。」`",
    choices: [
      { text: '把心魔的事，原原本本告诉她', hint: '好感 +12 · 心累 -30 · 心性 +5', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); Characters.addStress(s, -30); s.xin += 5; Characters.setFamilyFlag(s, 'post_strife_3_done'); Characters.setFamilyFlag(s, 'post_told_truth'); s.log('她听完，把灯放下，说：「以后它来，你叫我。」那一夜，你睡了成婚以来最安稳的一觉。'); }" },
      { text: '「不关你的事。」收剑出门', hint: '好感 -12 · 心累 +10', charaff: { key: 'spouse', d: -12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -12); Characters.addStress(s, 10); Characters.setFamilyFlag(s, 'post_strife_3_done'); Characters.setFamilyFlag(s, 'post_estrange'); s.log('你在屋外站到天亮。回屋时灯还亮着，她一直坐着。'); }" },
      { text: '握住她的手，什么都没说', hint: '好感 +7 · 心累 -18', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); Characters.addStress(s, -18); Characters.setFamilyFlag(s, 'post_strife_3_done'); s.log('她的手很凉，一直没抽走。天亮时她说：「你手劲挺大。」你才发现自己握了一夜。'); }" },
    ],
  },

  {
    id: 'post_reconcile_1', season: null, stage: 'post', post: true, postStage: '婚后·和解', tag: '矛盾',
    title: '婚后 · 冰释', weight: 20, priority: 340, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_reconcile_done',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_cold_war') && !Characters.getFamilyFlag(s, 'post_reconcile_done')",
    text: "s => `冷战持续了很久。这天${Characters.spouseName(s)}把一件洗好的袍子放在你案头，转身要走。\n\n袍子上，那道你从前划破的口子，被补得几乎看不出来——针脚比从前更密。`",
    choices: [
      { text: '拉住她的袖子', hint: '好感 +14 · 心累 -25', charaff: { key: 'spouse', d: 14 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 14); Characters.addStress(s, -25); Characters.setFamilyFlag(s, 'post_reconcile_done'); Characters.setFamilyFlag(s, 'post_cold_war', false); s.log('她没回头，肩膀却抖了一下。你说对不起。她说：「我知道了。」然后回手也拉住了你。'); }" },
      { text: '把袍子穿上去见她', hint: '好感 +10 · 心累 -15', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 10); Characters.addStress(s, -15); Characters.setFamilyFlag(s, 'post_reconcile_done'); Characters.setFamilyFlag(s, 'post_cold_war', false); s.log('她看见你穿着那件袍子走出来，先是愣，然后转过头去。你看见她耳朵红了。'); }" },
      { text: '把袍子叠好，放回原处', hint: '心累 +10', charaff: { key: 'spouse', d: 0 },
        apply: "s => { Characters.addStress(s, 10); Characters.setFamilyFlag(s, 'post_reconcile_done'); s.log('第二天那件袍子不见了。你找了很久，最后在她的箱底看到它，叠得整整齐齐。'); }" },
    ],
  },

  {
    id: 'post_love_1', season: null, stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 雨夜同伞', weight: 14, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getStress(s) < 70",
    text: "s => `傍晚下雨，你从外头回来，路上碰见撑着伞来接你的${Characters.spouseName(s)}。\n\n伞不大。她往你这边偏了偏，自己半边肩膀都湿了。`",
    choices: [
      { text: '把伞推回她那边，自己淋一半', hint: '好感 +7 · 心累 -5', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); Characters.addStress(s, -5); s.log('你们互相推了两个来回，最后各淋了半边。到家时两人都笑了。'); }" },
      { text: '接过伞，把她整个人圈进来', hint: '好感 +9 · 心累 -6', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addStress(s, -6); s.log('她僵了一下，随即很自然地靠过来。雨打在伞面上，噼里啪啦的，像在替你们说话。'); }" },
      { text: '加快脚步先回家', hint: '好感 -3', charaff: { key: 'spouse', d: -3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -3); Characters.addStress(s, 3); s.log('你回头时，她还站在原地的雨里，伞撑着，不知道该不该跟上来。'); }" },
    ],
  },

  {
    id: 'post_love_2', season: null, stage: 'post', post: true, postStage: '婚后·常态', tag: '日常',
    title: '婚后 · 她生病了', weight: 18, priority: 340, repeat: true, once_per_year: false, cooldown: 6, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s)",
    text: "s => `${Characters.spouseName(s)}病了。不是什么大病，但她这个人，平日里再疼也不吭声，这次却躺了一整天。\n\n你摸她额头，滚烫。`",
    choices: [
      { text: '亲自煎药，守一整夜', hint: '好感 +11 · 家财 -6 · 心累 -8', charaff: { key: 'spouse', d: 11 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 11); Characters.addMoney(s, -6); Characters.addStress(s, -8); s.log('药很苦。她皱着眉喝了，说：「你煎的比我煎的还难喝。」说完自己笑了。'); }" },
      { text: '请镇上最好的郎中', hint: '好感 +8 · 家财 -18', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addMoney(s, -18); s.log('郎中开的药很贵，但见效快。她第二天就能下地，第一件事是问你花了多少钱，你没敢说实话。'); }" },
      { text: '让她自己捱过去，说修仙之人不怕', hint: '好感 -9 · 心累 +12', charaff: { key: 'spouse', d: -9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -9); Characters.addStress(s, 12); s.log('她闭上眼，说：「嗯，不怕。」后来你才发现，她自己爬起来烧了水。'); }" },
    ],
  },

  /* ============ D · 育儿成长（链式：怀孕 → 出生 → 成长 → 择路） ============ */

  {
    id: 'post_child_1', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 有喜', weight: 26, priority: 340, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_child_1_done',
    req: "s => Characters.isMarried(s) && Characters.kidCount(s) === 0 && (s.year || 1) >= 3 && !Characters.getFamilyFlag(s, 'post_child_1_done') && Characters.getStress(s) < 70",
    text: "s => `这年春天，${Characters.spouseName(s)}忽然变得很奇怪——闻不得油烟，见着酸的就眼睛发亮。\n\n镇上懂医的老婆婆诊过之后，笑着对你拱了拱手。\n\n你愣在原地，半天没说出话。`",
    choices: [
      { text: '把她扶到椅子上，问她想吃什么', hint: '好感 +12 · 心累 -10 · → 临盆', next: 'post_child_2', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); Characters.addStress(s, -10); Characters.setFamilyFlag(s, 'post_child_1_done'); Characters.setFamilyFlag(s, 'post_expecting'); s.log('她说想吃酸的。你跑遍了半个镇子。回来时她靠在椅子上睡着了，手护在肚子上。'); }" },
      { text: '一时说不出话，只是笑', hint: '好感 +9 · 心累 -6 · → 临盆', next: 'post_child_2', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addStress(s, -6); Characters.setFamilyFlag(s, 'post_child_1_done'); Characters.setFamilyFlag(s, 'post_expecting'); s.log('她看你傻笑，自己也笑了，说：「瞧你那点出息。」'); }" },
      { text: '「现在是不是太早了点？」', hint: '好感 -8 · 心累 +12 · → 临盆', next: 'post_child_2', charaff: { key: 'spouse', d: -8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -8); Characters.addStress(s, 12); Characters.setFamilyFlag(s, 'post_child_1_done'); Characters.setFamilyFlag(s, 'post_expecting'); s.log('她脸上的笑慢慢收了。她说：「是早了。你若不愿意，我再想想办法。」——你赶紧说不是这个意思，但她已经转过身去了。'); }" },
    ],
  },

  {
    id: 'post_child_2', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 临盆', weight: 30, priority: 380, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_child_2_done',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_expecting') && !Characters.getFamilyFlag(s, 'post_child_2_done')",
    text: "s => `那一夜，屋里灯火通明。\n\n产婆进进出出，热水一盆一盆地端。${Characters.spouseName(s)}咬着布巾，一声不吭，只有指节捏得发白。\n\n你守在门外，听见自己的心跳，比当年渡劫时还响。`",
    choices: [
      { text: '冲进去，握住她的手', hint: '好感 +14 · 心累 +5（得子）· → 夜啼', next: 'post_child_3', charaff: { key: 'spouse', d: 14 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 14); Characters.addStress(s, 5); Characters.setFamilyFlag(s, 'post_child_2_done'); const k = Characters.addKid(s); s.log('孩子哭出声的那一瞬，她攥着你的手松开了。她看着你，笑了笑。是个孩子，叫' + k.name + '。'); }" },
      { text: '去丹房调一剂保产丹', hint: '好感 +10 · 丹心 +5（得子）· → 夜啼', next: 'post_child_3', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 10); s.dan += 5; Characters.setFamilyFlag(s, 'post_child_2_done'); const k = Characters.addKid(s); s.log('你三炉成一丸，产婆喂下之后，她的脸色好了许多。天快亮时，孩子落地了，叫' + k.name + '。'); }" },
      { text: '在门外跪着，什么也做不了', hint: '好感 +7 · 心累 +12（得子）· → 夜啼', next: 'post_child_3', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); Characters.addStress(s, 12); Characters.setFamilyFlag(s, 'post_child_2_done'); const k = Characters.addKid(s); s.log('你跪了一夜。天亮时产婆把孩子抱出来，说母女平安。你腿都麻了，站不起来，只是一直点头。孩子叫' + k.name + '。'); }" },
    ],
  },

  {
    id: 'post_child_3', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 夜啼', weight: 20, priority: 300, repeat: true, once_per_year: false, cooldown: 4, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.kidStats(s).maxAge <= 6 && Characters.kidCount(s) > 0",
    text: "s => `夜深了，孩子又哭起来。\n\n${Characters.spouseName(s)}白天忙了一天，眼下青黑一片，却还是先你一步坐起身来。`",
    choices: [
      { text: '「你睡，我来。」把孩子抱走', hint: '好感 +8 · 心累 -8', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, -8); s.log('你抱着孩子在院里走了半宿。天亮时他睡了，你在椅子上也睡着了。她给你盖了件衣服。'); }" },
      { text: '两人一起哄', hint: '好感 +6 · 心累 -4', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); Characters.addStress(s, -4); s.log('一个拍一个摇，孩子倒是不哭了，你们俩对着打了个哈欠，都笑了。'); }" },
      { text: '翻个身继续睡', hint: '好感 -7 · 心累 +10', charaff: { key: 'spouse', d: -7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -7); Characters.addStress(s, 10); s.log('你听见她一个人抱着孩子在屋里来回走，走了一整夜。第二天吃饭时，她没跟你说话。'); }" },
    ],
  },

  {
    id: 'post_child_4', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 开蒙', weight: 18, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_child_4_done',
    req: "s => Characters.isMarried(s) && Characters.kidStats(s).maxAge >= 5 && !Characters.getFamilyFlag(s, 'post_child_4_done')",
    text: "s => `孩子五岁了，该开蒙了。\n\n${Characters.spouseName(s)}把三样东西摆在桌上：一本字帖、一柄小木剑、一只药炉。\n\n她说：「你替他挑一个吧。」`",
    choices: [
      { text: '选那柄木剑', hint: '好感 +5 · 孩子走剑道 · 家财 -5', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addMoney(s, -5); Characters.setFamilyFlag(s, 'post_child_4_done'); Characters.setFamilyFlag(s, 'post_kid_sword'); const ks = Characters.getKids(s); if (ks[0]) ks[0].trait = '剑'; s.log('孩子握起木剑，架势有模有样。她看了很久，说：「像你。」'); }" },
      { text: '选药炉', hint: '好感 +5 · 孩子走丹道 · 家财 -5', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addMoney(s, -5); Characters.setFamilyFlag(s, 'post_child_4_done'); Characters.setFamilyFlag(s, 'post_kid_dan'); const ks = Characters.getKids(s); if (ks[0]) ks[0].trait = '丹'; s.log('孩子把药炉翻来覆去地看。她笑了：「这也像我。」'); }" },
      { text: '「让他自己挑。」', hint: '好感 +8 · 心性 +4 · 孩子自选', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); s.xin += 4; Characters.setFamilyFlag(s, 'post_child_4_done'); s.log('孩子看了半天，先摸字帖，又摸木剑，最后把三样都抱进怀里。她笑骂：「贪心。」'); }" },
    ],
  },

  {
    id: 'post_child_5', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 孩子受欺负了', weight: 20, priority: 340, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.kidStats(s).maxAge >= 6 && Characters.kidStats(s).maxAge <= 16",
    text: "s => `孩子回来的时候，脸上带着伤，什么也不肯说。\n\n夜里你听见他在被子里偷偷哭。${Characters.spouseName(s)}坐在床边，看着你。`",
    choices: [
      { text: '教他一身本事，让他自己讨回来', hint: '好感 +6 · 孩子成长 +5', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); Characters.setFamilyFlag(s, 'post_kid_taught'); const ks = Characters.getKids(s); if (ks[0]) ks[0].age = Math.min(30, (ks[0].age||0) + 1); s.log('你陪他练了三个月。再开学时，那几个孩子见了他都绕道走。他很得意，你却没夸他。'); }" },
      { text: '去那户人家讲道理', hint: '好感 +4 · 家财 -5 · 心累 +6', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 4); Characters.addMoney(s, -5); Characters.addStress(s, 6); s.log('对方的爹娘嘴上赔了不是，眼里却没什么诚意。回来的路上，孩子牵着你的手，攥得很紧。'); }" },
      { text: '抱着他，问他疼不疼', hint: '好感 +9 · 心累 -5', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addStress(s, -5); s.log('孩子在你怀里放声哭了。她说：「你比我懂事。」你们一家三口，在灯下坐了很久。'); }" },
    ],
  },

  {
    id: 'post_child_6', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 孩子远行', weight: 18, priority: 340, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_child_6_done',
    req: "s => Characters.isMarried(s) && Characters.kidStats(s).maxAge >= 15 && !Characters.getFamilyFlag(s, 'post_child_6_done')",
    text: "s => `孩子十六岁了。这天他背着包袱，站在门口。\n\n「爹，我想出去看看。」\n\n${Characters.spouseName(s)}站在你身后，手一直按在门框上。`",
    choices: [
      { text: '「去吧。记住回家的路。」', hint: '好感 +7 · 心性 +5 · 孩子独立', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); s.xin += 5; Characters.setFamilyFlag(s, 'post_child_6_done'); Characters.setFamilyFlag(s, 'post_kid_away'); s.log('孩子走的时候没回头。她在门槛上坐了一下午。你说他会回来的，她说是，她知道。'); }" },
      { text: '把自己的剑给他', hint: '好感 +9 · 孩子走剑道 · 心累 +5', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addStress(s, 5); Characters.setFamilyFlag(s, 'post_child_6_done'); Characters.setFamilyFlag(s, 'post_kid_away'); const ks = Characters.getKids(s); if (ks[0]) ks[0].trait = '剑'; s.log('孩子捧着剑，跪下磕了三个头。她转过身去，肩膀一直在抖。'); }" },
      { text: '「再等两年。」', hint: '好感 +3 · 心累 +8 · 孩子留下', charaff: { key: 'spouse', d: 3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 3); Characters.addStress(s, 8); Characters.setFamilyFlag(s, 'post_child_6_done'); Characters.setFamilyFlag(s, 'post_kid_stay'); s.log('孩子把包袱放下了，但那天之后，他很少再跟你说话。'); }" },
    ],
  },

  {
    id: 'post_child_7', season: null, stage: 'post', post: true, postStage: '婚后·育儿', tag: '育儿',
    title: '婚后 · 承欢膝下', weight: 16, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.kidCount(s) > 0 && Characters.kidStats(s).maxAge >= 3 && Characters.getStress(s) < 60",
    text: "s => `院子里的老树下，孩子蹲在地上画画。\n\n${Characters.spouseName(s)}坐在旁边择菜，时不时抬头看他一眼，眼角有细纹了。`",
    choices: [
      { text: '蹲下去，看孩子画的是什么', hint: '好感 +9 · 心累 -10', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addStress(s, -10); s.log('画上是一家三口，两个大人中间站着个歪歪扭扭的小人。你说画得真像，孩子很高兴。她没说话，只是笑。'); }" },
      { text: '从背后抱住她', hint: '好感 +11 · 心累 -12', charaff: { key: 'spouse', d: 11 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 11); Characters.addStress(s, -12); s.log('她吓了一跳，压着声音骂你孩子还在。但她没挣开，靠了你很久。'); }" },
      { text: '坐着看他们，一句话不说', hint: '好感 +5 · 心累 -6', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addStress(s, -6); s.log('这样的日子，你从前想都不敢想。夕阳把三个人的影子拉得很长。'); }" },
    ],
  },

  /* ============ E · 家庭经济（money 驱动，链式） ============ */

  {
    id: 'post_econ_1', season: null, stage: 'post', post: true, postStage: '婚后·营生', tag: '经济',
    title: '婚后 · 家用', weight: 22, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_econ_1_done',
    req: "s => Characters.isMarried(s) && !Characters.getFamilyFlag(s, 'post_econ_1_done')",
    text: "s => `柴米油盐，样样要钱。\n\n${Characters.spouseName(s)}把一个布包放在桌上，里头是她攒了多年的积蓄。她说：「拿去用。」`",
    choices: [
      { text: '收下，说以后加倍还她', hint: '好感 +6 · 家财 +30 · 心累 +3', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); Characters.addMoney(s, 30); Characters.addStress(s, 3); Characters.setFamilyFlag(s, 'post_econ_1_done'); s.log('她把包推过来，说：「还什么还。你现在是我的。」'); }" },
      { text: '推回去，说养家是我的事', hint: '好感 +9 · 心累 -4', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addStress(s, -4); Characters.setFamilyFlag(s, 'post_econ_1_done'); s.log('她看了你一会儿，把包收了回去，说：「那我留着，给以后的孩子。」'); }" },
      { text: '收下，但记成账，一笔一笔算清楚', hint: '家财 +30 · 好感 -4 · 心累 +8', charaff: { key: 'spouse', d: -4 },
        apply: "s => { Characters.addMoney(s, 30); Characters.addAff(s, Characters.spouseOf(s), -4); Characters.addStress(s, 8); Characters.setFamilyFlag(s, 'post_econ_1_done'); s.log('你把数目写在了纸上。她的脸色变了一下，说：「你这个人。」'); }" },
    ],
  },

  {
    id: 'post_econ_2', season: null, stage: 'post', post: true, postStage: '婚后·营生', tag: '经济',
    title: '婚后 · 营生', weight: 18, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_econ_2_done',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_econ_1_done') && !Characters.getFamilyFlag(s, 'post_econ_2_done')",
    text: "s => `${Characters.spouseName(s)}提议盘一间铺子。\n\n「你会炼丹，我会算账。咱们开个丹铺，怎么样？」她把一张写满字的纸铺在你面前。`",
    choices: [
      { text: '盘下铺子，做正经营生', hint: '家财 -40 · 铺子开张 · 好感 +8', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addMoney(s, -40); Characters.addAff(s, Characters.spouseOf(s), 8); Characters.setFamilyFlag(s, 'post_econ_2_done'); Characters.setFamilyFlag(s, 'post_shop'); s.log('铺子开张那天，她写了块匾，四个字：「剑丹同辉」。她写得不好看，但你很喜欢。'); }" },
      { text: '不冒险，稳稳过日子', hint: '家财 +10 · 好感 +3', charaff: { key: 'spouse', d: 3 },
        apply: "s => { Characters.addMoney(s, 10); Characters.addAff(s, Characters.spouseOf(s), 3); Characters.setFamilyFlag(s, 'post_econ_2_done'); s.log('她把纸收了，说：「也好。」但你看见她晚上又拿出来看了两遍。'); }" },
      { text: '把钱拿去接济镇上穷人', hint: '家财 -25 · 心性 +8 · 好感 +5', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addMoney(s, -25); s.xin += 8; Characters.addAff(s, Characters.spouseOf(s), 5); Characters.setFamilyFlag(s, 'post_econ_2_done'); Characters.setFamilyFlag(s, 'post_kind'); s.log('她跟着你一家一家地送。最后一户出来时，她说：「我没看错人。」'); }" },
    ],
  },

  {
    id: 'post_econ_3', season: null, stage: 'post', post: true, postStage: '婚后·营生', tag: '经济',
    title: '婚后 · 铺子分红', weight: 18, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getFamilyFlag(s, 'post_shop')",
    text: "s => `岁末，铺子盘账。\n\n${Characters.spouseName(s)}念着账本，眉头时松时紧。这一年，丹铺的生意起起落落。`",
    choices: [
      { text: '把分红全交给她保管', hint: '好感 +7 · 家财 +20', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); Characters.addMoney(s, 20); s.log('她把银钱锁进一个旧木匣，说：「这些留着，给孩子的。」'); }" },
      { text: '拿一部分扩充铺子', hint: '家财 +35 · 心累 +4', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addMoney(s, 35); Characters.addStress(s, 4); Characters.addAff(s, Characters.spouseOf(s), 4); s.log('新铺面比原来大一倍。她站在空荡荡的屋子里，说：「有点吓人。」'); }" },
      { text: '替她买一整套账房用具', hint: '家财 -12 · 好感 +10', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addMoney(s, -12); Characters.addAff(s, Characters.spouseOf(s), 10); s.log('她把算盘拨来拨去，像得了新玩具。夜里还在灯下打算盘，被你催了三回才肯睡。'); }" },
    ],
  },

  {
    id: 'post_econ_4', season: null, stage: 'post', post: true, postStage: '婚后·营生', tag: '经济',
    title: '婚后 · 拮据', weight: 20, priority: 340, repeat: true, once_per_year: false, cooldown: 6, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getMoney(s) < 10",
    text: "s => `家里快要断炊了。\n\n${Characters.spouseName(s)}把米缸底刮了又刮，最后端出一碗稀得能照见人影的粥，全推给了你。\n\n她说自己吃过了。`",
    choices: [
      { text: '把粥推回去一半，说自己不饿', hint: '好感 +10 · 心累 -5', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 10); Characters.addStress(s, -5); s.log('你们推让了半天，最后一人一半。她喝到一半，眼泪掉进了碗里。'); }" },
      { text: '去接一桩危险的活计换钱', hint: '家财 +45 · 心累 +15 · 剑意 +3', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addMoney(s, 45); Characters.addStress(s, 15); s.jian += 3; Characters.addAff(s, Characters.spouseOf(s), 5); s.log('你三天没回家。第四天你带着一袋米和一身的伤推门进来，她扑过来打你，打了两下就哭了。'); }" },
      { text: '去师门借', hint: '家财 +30 · 心累 +8 · 好感 +2', charaff: { key: 'spouse', d: 2 },
        apply: "s => { Characters.addMoney(s, 30); Characters.addStress(s, 8); Characters.addAff(s, Characters.spouseOf(s), 2); s.log('师兄借了你钱，什么都没问。回家路上你走得很慢。'); }" },
    ],
  },

  {
    id: 'post_econ_5', season: null, stage: 'post', post: true, postStage: '婚后·营生', tag: '经济',
    title: '婚后 · 富足', weight: 14, priority: 300, repeat: true, once_per_year: false, cooldown: 5, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getMoney(s) >= 120",
    text: "s => `这几年光景好，家里宽裕了不少。\n\n${Characters.spouseName(s)}却还是改不了旧习惯——剩饭不舍得倒，衣裳破了还要补。`",
    choices: [
      { text: '由着她，说这样踏实', hint: '好感 +8 · 心累 -5', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, -5); s.log('她把补好的衣裳叠进箱子，说：「日子再宽，也不能忘了紧的时候。」'); }" },
      { text: '把钱拿去修桥铺路', hint: '家财 -60 · 心性 +10 · 好感 +9', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addMoney(s, -60); s.xin += 10; Characters.addAff(s, Characters.spouseOf(s), 9); Characters.setFamilyFlag(s, 'post_kind'); s.log('桥修好了，镇口立了块碑，碑上没有你的名字。她说：「有名字才叫善事？」'); }" },
      { text: '大摆宴席，宴请乡邻', hint: '家财 -40 · 好感 +6 · 心累 -8', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addMoney(s, -40); Characters.addAff(s, Characters.spouseOf(s), 6); Characters.addStress(s, -8); s.log('席开三天，热闹得很。她忙前忙后，脸都笑酸了，说：「这钱花得值。」'); }" },
    ],
  },

  /* ============ F · 亲戚往来 ============ */

  {
    id: 'post_kin_1', season: null, stage: 'post', post: true, postStage: '婚后·人情', tag: '亲戚',
    title: '婚后 · 婆家来人', weight: 18, priority: 320, repeat: true, once_per_year: false, cooldown: 6, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s)",
    text: "s => `门外来了一群亲戚，自称是你岳家的长辈。\n\n为首的老者坐下就开始挑剔：屋子太小，礼数不周，还说${Characters.spouseName(s)}「嫁得不值」。\n\n她站在一旁，脸涨得通红。`",
    choices: [
      { text: '当场把话挡回去，护住她', hint: '好感 +12 · 心累 +5', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); Characters.addStress(s, 5); s.log('你把茶杯放下，说的每个字都不客气。亲戚们走了。夜里她靠在你肩上，说：「从小到大，没人这么护过我。」'); }" },
      { text: '笑脸相迎，破财消灾', hint: '家财 -25 · 好感 +4 · 心累 +6', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addMoney(s, -25); Characters.addAff(s, Characters.spouseOf(s), 4); Characters.addStress(s, 6); s.log('亲戚们拿了东西笑着走了。她看着空了一半的库房，说：「你不该惯着他们。」'); }" },
      { text: '借口有事，避而不见', hint: '好感 -5 · 心累 +12', charaff: { key: 'spouse', d: -5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -5); Characters.addStress(s, 12); s.log('你回来时亲戚已经走了。她一个人在收拾茶具，没看你。'); }" },
    ],
  },

  {
    id: 'post_kin_2', season: null, stage: 'post', post: true, postStage: '婚后·人情', tag: '亲戚',
    title: '婚后 · 娘家来信', weight: 16, priority: 320, repeat: true, once_per_year: false, cooldown: 6, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s)",
    text: "s => `信上说，岳母病重，想见女儿最后一面。\n\n${Characters.spouseName(s)}捏着信，指节泛白。她看向你，欲言又止。`",
    choices: [
      { text: '立刻收拾行李，陪她回去', hint: '好感 +13 · 家财 -20 · 心累 -6', charaff: { key: 'spouse', d: 13 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 13); Characters.addMoney(s, -20); Characters.addStress(s, -6); s.log('星夜兼程。赶到时岳母还有气。她扑到床前叫娘，回头看了你一眼——那一眼里有半辈子的谢。'); }" },
      { text: '「你一个人回去吧，家中走不开。」', hint: '好感 -12 · 心累 +18', charaff: { key: 'spouse', d: -12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -12); Characters.addStress(s, 18); s.log('她一个人走了。回来那天，她没说岳母走的时候是什么样子，也没让你问。'); }" },
      { text: '备厚礼，请名医同去', hint: '家财 -35 · 好感 +9', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addMoney(s, -35); Characters.addAff(s, Characters.spouseOf(s), 9); s.log('名医尽了力，岳母多撑了半年。这半年，她隔三日就回去一趟，你每次都送她到镇口。'); }" },
    ],
  },

  {
    id: 'post_kin_3', season: null, stage: 'post', post: true, postStage: '婚后·人情', tag: '亲戚',
    title: '婚后 · 故人来访', weight: 15, priority: 320, repeat: true, once_per_year: false, cooldown: 7, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && Characters.getAff(s, Characters.spouseOf(s) || 'herb') >= 85",
    text: "s => `一位旧友上门。他看你的眼神里带着旧日的情分，说起从前的事，意有所指。\n\n${Characters.spouseName(s)}端茶进来，恰好听见了这一句。`",
    choices: [
      { text: '当着她的面，把话说清楚', hint: '好感 +11 · 心累 -6', charaff: { key: 'spouse', d: 11 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 11); Characters.addStress(s, -6); s.log('你把话说尽了。旧友走时叹了口气。她给你续了杯茶，说：「茶凉了。」——语气很平常，但你知道，她心里那块石头落了地。'); }" },
      { text: '送客到门外，私下再多说两句', hint: '好感 -8 · 心累 +14', charaff: { key: 'spouse', d: -8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -8); Characters.addStress(s, 14); s.log('你在门外站了一炷香。回屋时，她已经睡了，背对着你。'); }" },
      { text: '留旧友住下，坦坦荡荡', hint: '好感 +6 · 心性 +4', charaff: { key: 'spouse', d: 6 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 6); s.xin += 4; s.log('你安排得妥帖，什么闲话都没有。走的时候旧友说：「你过得比我好。」她替你把门关上，笑了。'); }" },
    ],
  },

  {
    id: 'post_kin_4', season: null, stage: 'post', post: true, postStage: '婚后·人情', tag: '亲戚',
    title: '婚后 · 师门小辈', weight: 15, priority: 300, repeat: true, once_per_year: false, cooldown: 6, place: 'any',
    req: "s => Characters.isMarried(s)",
    text: "s => `师门送来一个十几岁的孩子，说是让你带一带。\n\n孩子很勤快，做饭洗衣样样抢着干，${Characters.spouseName(s)}反倒有些手足无措。`",
    choices: [
      { text: '认真教他剑法', hint: '好感 +5 · 剑意 +4 · 心累 +3', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); s.jian += 4; Characters.addStress(s, 3); s.log('孩子进步很快。她每天多做一个人的饭，嘴上嫌麻烦，饭却越做越丰盛。'); }" },
      { text: '让妻子照拂他日常', hint: '好感 +2 · 心累 +10', charaff: { key: 'spouse', d: 2 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 2); Characters.addStress(s, 10); s.log('她什么都没说，只是那阵子话更少了。直到有一天你听见她在厨房里跟孩子说笑，才放下心。'); }" },
      { text: '回绝师门，说家中不便', hint: '好感 +4 · 心性 +3', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 4); s.xin += 3; s.log('她听说你回绝了，愣了一下，说：「其实家里住得下。」你说你知道。'); }" },
    ],
  },

  /* ============ G · 事业与家庭冲突 ============ */

  {
    id: 'post_career_1', season: null, stage: 'post', post: true, postStage: '婚后·抉择', tag: '事业',
    title: '婚后 · 闭关之请', weight: 20, priority: 340, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_career_1_done',
    req: "s => Characters.isMarried(s) && !Characters.getFamilyFlag(s, 'post_career_1_done')",
    text: "s => `你参到一处关隘，若能闭关三年，修为必有大进。\n\n可三年，对一个家来说，很长。\n\n${Characters.spouseName(s)}正在灯下补衣，听完你的话，针停了。`",
    choices: [
      { text: '闭关三年', hint: '修为 +40 · 好感 -8 · 心累 +18', charaff: { key: 'spouse', d: -8 },
        apply: "s => { s.power += 40; Characters.addAff(s, Characters.spouseOf(s), -8); Characters.addStress(s, 18); Characters.setFamilyFlag(s, 'post_career_1_done'); Characters.setFamilyFlag(s, 'post_secluded'); s.log('出关那天，她站在门口，瘦了许多。她替你接过衣服，说：「回来了。」好像你只走了一天。'); }" },
      { text: '不闭了，陪她过日子', hint: '好感 +12 · 心累 -12 · 修为 +5', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); Characters.addStress(s, -12); s.power += 5; Characters.setFamilyFlag(s, 'post_career_1_done'); Characters.setFamilyFlag(s, 'post_chose_family'); s.log('她把针放下，说：「你会后悔的。」你说不会。三年后你才明白，你确实没后悔。'); }" },
      { text: '带她一同闭关，双修参悟', hint: '好感 +9 · 修为 +25 · 心累 -5', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); s.power += 25; Characters.addStress(s, -5); Characters.setFamilyFlag(s, 'post_career_1_done'); Characters.setFamilyFlag(s, 'post_dual_cultivate'); s.log('三年里你们除了参悟就是彼此。出关时她的修为也精进不少，说：「原来两个人快得多。」'); }" },
    ],
  },

  {
    id: 'post_career_2', season: null, stage: 'post', post: true, postStage: '婚后·抉择', tag: '事业',
    title: '婚后 · 出仕之邀', weight: 17, priority: 340, repeat: true, once_per_year: false, cooldown: 8, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && s.power >= 150",
    text: "s => `有仙门来请，许你一个执事之位，风光得很——只是要常驻外山，一年到头回不了几次家。\n\n${Characters.spouseName(s)}把请柬接过去，替你看了很久。`",
    choices: [
      { text: '应下，赴任外山', hint: '修为 +20 · 家财 +50 · 好感 -10 · 心累 +15', charaff: { key: 'spouse', d: -10 },
        apply: "s => { s.power += 20; Characters.addMoney(s, 50); Characters.addAff(s, Characters.spouseOf(s), -10); Characters.addStress(s, 15); Characters.setFamilyFlag(s, 'post_away'); s.log('你上任那天，她送了三里地。此后家里的信，越来越短。'); }" },
      { text: '谢绝，留在镇上', hint: '好感 +8 · 心累 -6', charaff: { key: 'spouse', d: 8 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, -6); s.log('你把请柬烧了。她问：「可惜吗？」你说：「可惜。」她说：「那你还烧。」你说：「我愿意。」'); }" },
      { text: '举家迁往外山', hint: '家财 -30 · 好感 +5 · 心累 +5', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addMoney(s, -30); Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addStress(s, 5); s.log('搬家那天累得够呛。新家安顿好之后，她在院子里站了一会儿，说：「这儿的月亮，跟家里一样。」'); }" },
    ],
  },

  {
    id: 'post_career_3', season: null, stage: 'post', post: true, postStage: '婚后·抉择', tag: '事业',
    title: '婚后 · 仇家寻上门', weight: 22, priority: 360, repeat: true, once_per_year: false, cooldown: 8, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && s.jian >= 30",
    text: "s => `旧仇家找上门来，指名要你出去。\n\n他们站在院门外，把话说得很难听。${Characters.spouseName(s)}握住了你的手，很用力。`",
    choices: [
      { text: '孤身出门，把事情了了', hint: '剑意 +6 · 心累 +20 · 好感 +5', charaff: { key: 'spouse', d: 5 },
        apply: "s => { s.jian += 6; Characters.addStress(s, 20); Characters.addAff(s, Characters.spouseOf(s), 5); s.log('你回来时浑身是血，但都是别人的。她一句话没说，先烧了热水。'); }" },
      { text: '带她一起出去，并肩退敌', hint: '好感 +12 · 剑意 +4 · 心累 +8', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); s.jian += 4; Characters.addStress(s, 8); s.log('两口剑，退了三拨人。收剑时她喘着气冲你笑：「还行吗？」你说：「还行。」'); }" },
      { text: '闭门不出，任他们叫骂', hint: '心累 +25 · 好感 -6', charaff: { key: 'spouse', d: -6 },
        apply: "s => { Characters.addStress(s, 25); Characters.addAff(s, Characters.spouseOf(s), -6); s.log('骂了一整天，走了。她说：「躲得了一时。」你没接话。'); }" },
    ],
  },

  {
    id: 'post_career_4', season: null, stage: 'post', post: true, postStage: '婚后·抉择', tag: '事业',
    title: '婚后 · 归隐之念', weight: 16, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_career_4_done',
    req: "s => Characters.isMarried(s) && s.age >= 45 && !Characters.getFamilyFlag(s, 'post_career_4_done')",
    text: "s => `修行多年，你忽然有些倦了。\n\n这天你站在院子里看山，${Characters.spouseName(s)}走过来，也看了一会儿。她说：「你想走了？」`",
    choices: [
      { text: '「找个小地方，我们住下。」', hint: '好感 +13 · 心累 -20 · 心性 +6', charaff: { key: 'spouse', d: 13 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 13); Characters.addStress(s, -20); s.xin += 6; Characters.setFamilyFlag(s, 'post_career_4_done'); Characters.setFamilyFlag(s, 'post_retire_plan'); s.log('你们选了个背山面水的小村子。她说：「我早就想好了，就等你开口。」'); }" },
      { text: '「再走走看。」', hint: '修为 +15 · 心累 +6', charaff: { key: 'spouse', d: 3 },
        apply: "s => { s.power += 15; Characters.addStress(s, 6); Characters.addAff(s, Characters.spouseOf(s), 3); Characters.setFamilyFlag(s, 'post_career_4_done'); s.log('她点点头，说：「好。你走到哪儿，我跟到哪儿。」'); }" },
      { text: '「你若有想去的地方，我们便去。」', hint: '好感 +11 · 心累 -15', charaff: { key: 'spouse', d: 11 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 11); Characters.addStress(s, -15); Characters.setFamilyFlag(s, 'post_career_4_done'); s.log('她想了想，说想回丹霞谷看看。你说好。她笑得像个初识的少女。'); }" },
    ],
  },

  /* ============ H · 纪念日 & 突发事件 ============ */

  {
    id: 'post_anniv_1', season: null, stage: 'post', post: true, postStage: '婚后·纪念', tag: '纪念',
    title: '婚后 · 周年', weight: 18, priority: 320, repeat: true, once_per_year: true, cooldown: 4, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && (s.year || 1) - (Characters.getFamilyFlag(s, '__wedYear') || (s.year || 1)) >= 1",
    text: "s => `今天是个特别的日子。\n\n${Characters.spouseName(s)}似乎忘了，照常一大早起来扫地、煮饭。你在门口站了站，忽然想给她一个惊喜。`",
    choices: [
      { text: '做一桌她爱吃的菜', hint: '好感 +9 · 家财 -10 · 心累 -8', charaff: { key: 'spouse', d: 9 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addMoney(s, -10); Characters.addStress(s, -8); s.log('她进门看见满桌菜，愣在门口。坐下之后她一直低着头，吃到一半才说：「我记得的。」'); }" },
      { text: '带她去当年初遇的地方', hint: '好感 +12 · 心累 -12', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); Characters.addStress(s, -12); s.log('旧地景色未改。她站在当年站过的地方，忽然说：「那时候我看你一眼，就觉得完了。」'); }" },
      { text: '什么都没做，平常过一天', hint: '好感 -3 · 心累 +8', charaff: { key: 'spouse', d: -3 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -3); Characters.addStress(s, 8); s.log('睡下之后，她背对着你，很久才说：「今天是什么日子，你还记得吗？」'); }" },
    ],
  },

  {
    id: 'post_anniv_2', season: null, stage: 'post', post: true, postStage: '婚后·纪念', tag: '纪念',
    title: '婚后 · 白头之约', weight: 14, priority: 340, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_anniv_2_done',
    req: "s => Characters.isMarried(s) && s.age >= 55 && !Characters.getFamilyFlag(s, 'post_anniv_2_done')",
    text: "s => `镜前，${Characters.spouseName(s)}拨开鬓角，露出几根白发。\n\n她说：「你看，我老了。」语气很平静，但眼睛没看镜子。`",
    choices: [
      { text: '替她把那几根白发掩好，说很好看', hint: '好感 +13 · 心累 -15', charaff: { key: 'spouse', d: 13 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 13); Characters.addStress(s, -15); Characters.setFamilyFlag(s, 'post_anniv_2_done'); s.log('她看着镜子里的你，很久，说：「你也老了。」你们对着镜子笑了笑。'); }" },
      { text: '「一起老，挺好。」', hint: '好感 +11 · 心累 -12 · 心性 +4', charaff: { key: 'spouse', d: 11 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 11); Characters.addStress(s, -12); s.xin += 4; Characters.setFamilyFlag(s, 'post_anniv_2_done'); s.log('她靠过来靠在你肩上，说：「下辈子还找你好不好？」你说好，说了三遍。'); }" },
      { text: '去寻驻颜的丹方', hint: '家财 -40 · 丹心 +6 · 好感 +4', charaff: { key: 'spouse', d: 4 },
        apply: "s => { Characters.addMoney(s, -40); s.dan += 6; Characters.addAff(s, Characters.spouseOf(s), 4); Characters.setFamilyFlag(s, 'post_anniv_2_done'); s.log('你炼了三个月，成丹两枚。她吃了，却没看出什么变化。她说：「留着吧，药哪有那么好。」'); }" },
    ],
  },

  {
    id: 'post_crisis_1', season: null, stage: 'post', post: true, postStage: '婚后·突发', tag: '突发',
    title: '婚后 · 天灾', weight: 16, priority: 360, repeat: true, once_per_year: false, cooldown: 10, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s)",
    text: "s => `那年大水，青石镇淹了半条街。\n\n夜里水漫进院子，${Characters.spouseName(s)}抱着家里最要紧的东西，站在齐膝的水里等你。`",
    choices: [
      { text: '先背她出去，再回来搬东西', hint: '好感 +13 · 家财 -25 · 心累 +5', charaff: { key: 'spouse', d: 13 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 13); Characters.addMoney(s, -25); Characters.addStress(s, 5); s.log('你背着她趟过街道。她趴在你背上，把那个包袱举得高高的——里头是你们成婚那年的婚书。'); }" },
      { text: '留在屋里抢救家当', hint: '家财 -8 · 好感 -6 · 心累 +15', charaff: { key: 'spouse', d: -6 },
        apply: "s => { Characters.addMoney(s, -8); Characters.addAff(s, Characters.spouseOf(s), -6); Characters.addStress(s, 15); s.log('东西保住了大半，她一直站在水里的那块高台上，从夜里站到水退。'); }" },
      { text: '组织乡邻一起筑坝', hint: '心性 +10 · 好感 +9 · 家财 -15', charaff: { key: 'spouse', d: 9 },
        apply: "s => { s.xin += 10; Characters.addAff(s, Characters.spouseOf(s), 9); Characters.addMoney(s, -15); s.log('忙了三天三夜，坝筑成了。她端着一碗姜汤挨个送。有人说你娶了个好媳妇，你说：「我知道。」'); }" },
    ],
  },

  {
    id: 'post_crisis_2', season: null, stage: 'post', post: true, postStage: '婚后·突发', tag: '突发',
    title: '婚后 · 她受重伤', weight: 18, priority: 380, repeat: true, once_per_year: false, cooldown: 10, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s) && s.jian >= 20",
    text: "s => `她是为护你，才挨的那一下。\n\n${Characters.spouseName(s)}躺在床上，气息微弱。郎中说，能不能过这一关，要看三天。\n\n你握着她的手，手一直没暖过来。`",
    choices: [
      { text: '散尽家财，求遍名医灵药', hint: '家财 -60 · 好感 +15 · 心累 +10', charaff: { key: 'spouse', d: 15 },
        apply: "s => { Characters.addMoney(s, -60); Characters.addAff(s, Characters.spouseOf(s), 15); Characters.addStress(s, 10); s.log('第九天，她的手指动了一下。睁开眼第一句话是：「花了不少钱吧。」你笑了，眼泪掉在她手上。'); }" },
      { text: '以自己的寿元为引，替她续命', hint: '寿元 -15 · 好感 +18 · 修为 -10', charaff: { key: 'spouse', d: 18 },
        apply: "s => { s.shou -= 15; s.power = Math.max(0, s.power - 10); Characters.addAff(s, Characters.spouseOf(s), 18); s.log('她醒来后很快察觉了不对劲。她逼问你，你没答。她那晚哭了一整夜，第二天开始，寸步不离地跟着你。'); }" },
      { text: '以丹术硬撑，赌三天', hint: '丹心 +8 · 好感 +8 · 心累 +25', charaff: { key: 'spouse', d: 8 },
        apply: "s => { s.dan += 8; Characters.addAff(s, Characters.spouseOf(s), 8); Characters.addStress(s, 25); s.log('三天三夜你没合眼。第四天清晨，她醒了。你眼前一黑，倒在她床边。'); }" },
    ],
  },

  {
    id: 'post_crisis_3', season: null, stage: 'post', post: true, postStage: '婚后·突发', tag: '突发',
    title: '婚后 · 孩子长大了', weight: 15, priority: 320, once: true, once_per_year: false, place: 'any',
    affRange: '85-100', usedFlag: 'post_crisis_3_done',
    req: "s => Characters.isMarried(s) && Characters.kidStats(s).maxAge >= 20 && !Characters.getFamilyFlag(s, 'post_crisis_3_done')",
    text: "s => `孩子已过弱冠，站得比你还高。\n\n这天他带着一个人回来，说：「爹，娘，我要成亲了。」\n\n${Characters.spouseName(s)}看着那个年轻人，忽然转过身去，好一会儿才回头。`",
    choices: [
      { text: '张罗一场热闹的婚事', hint: '家财 -50 · 好感 +10 · 心累 -12', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addMoney(s, -50); Characters.addAff(s, Characters.spouseOf(s), 10); Characters.addStress(s, -12); Characters.setFamilyFlag(s, 'post_crisis_3_done'); Characters.setFamilyFlag(s, 'post_kid_married'); s.log('喜宴办得风风光光。她那天穿了你买的那支银簪，忙前忙后，笑得比新郎还开心。'); }" },
      { text: '把家传的剑或丹炉传给孩子', hint: '好感 +12 · 心性 +6 · 心累 -10', charaff: { key: 'spouse', d: 12 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 12); s.xin += 6; Characters.addStress(s, -10); Characters.setFamilyFlag(s, 'post_crisis_3_done'); Characters.setFamilyFlag(s, 'post_kid_married'); s.log('孩子跪下接过去。她站在旁边，看着这一幕，眼睛一直是亮的。'); }" },
      { text: '什么都没准备，只说「好」', hint: '好感 -4 · 心累 +10', charaff: { key: 'spouse', d: -4 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), -4); Characters.addStress(s, 10); Characters.setFamilyFlag(s, 'post_crisis_3_done'); s.log('婚事简单。她私底下把嫁妆补了。你说不用，她说：「你不管，我管。」'); }" },
    ],
  },

  {
    id: 'post_crisis_4', season: 'winter', stage: 'post', post: true, postStage: '婚后·突发', tag: '纪念',
    title: '婚后 · 围炉', weight: 14, priority: 300, repeat: true, once_per_year: true, cooldown: 4, place: 'any',
    affRange: '85-100',
    req: "s => Characters.isMarried(s)",
    text: "s => `大雪封山，一家子围着炉子。\n\n${Characters.spouseName(s)}在纳鞋底，孩子在旁边打瞌睡。炉火烧得噼啪响。`",
    choices: [
      { text: '把她的脚拢到自己怀里暖着', hint: '好感 +10 · 心累 -10', charaff: { key: 'spouse', d: 10 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 10); Characters.addStress(s, -10); s.log('她骂你不正经，脚却没抽回去。孩子在一旁偷笑。'); }" },
      { text: '讲一个年轻时的故事给孩子听', hint: '好感 +7 · 心累 -8', charaff: { key: 'spouse', d: 7 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 7); Characters.addStress(s, -8); s.log('你讲到一半，她插嘴纠正了三个细节。孩子听得入神，问然后呢。你们对视一眼，都笑了。'); }" },
      { text: '添一炉炭，安静地坐着', hint: '好感 +5 · 心累 -12', charaff: { key: 'spouse', d: 5 },
        apply: "s => { Characters.addAff(s, Characters.spouseOf(s), 5); Characters.addStress(s, -12); s.log('炭火很旺。这一夜，谁都没提外面的事。你忽然希望这一冬可以再长一点。'); }" },
    ],
  },

];

window.GAME_CONFIG = GAME_CONFIG;
