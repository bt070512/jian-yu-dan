/* ============================================================
   剑与丹 · 可攻略角色情感事件（五阶段 × 三角色）
   ------------------------------------------------------------
   统一字段格式（与 events.js 完全一致）：
     { id, place, title, weight, once, req, text(s), choices[] }
     choice: { text, hint, apply(s), next?, log?, unlock?, recite?, cg? }
   新增可选字段（向后兼容，缺省即忽略）：
     - cg: 'CG-ID'          → 触发该节点的 CG 展示
     - charaff: { key, d }  → 声明该选项的角色好感增减（供 UI 高亮 / 测试校验）
     - stage: 'meet|crush|bond|rift|reconcile'
     - chan: 'herb|sister|third'
   好感统一通过 Characters.addAff(s, charKey, d) 写入，
   A 角色落到既有 affection 字段，B/C 落到新增可选字段。
   ID 命名规则：沿用现有 snake_case，角色线加前缀 c_{角色}_{阶段}_{序号}
   ============================================================ */

const CT = {
  // 阶段门槛（与 characters.js STAGES 一致，此处仅用于 req 可读性）
  meet: 0, crush: 20, bond: 45, rift: 70, reconcile: 85,
};
const TC_CRUSH_SAFE = 20;   // 「暧昧」尚未开启的安全上限，用于初识阶段第二事件的门槛

/* 便捷断言：某角色好感是否在区间内 */
const _aff = (key) => (s) => Characters.getAff(s, key);
/* 生成"好感达标"条件 */
const _affGE = (key, n) => (s) => Characters.getAff(s, key) >= n;
/* 生成"角色线已开启"条件（该角色已登场） */
const _met = (key) => (s) => !!s.charFlags?.[key + '_met'];
/* 第七轮：该角色线未决裂（未决裂才可触发任何该角色事件） */
const _notRefused = (key) => (s) => !(s.charFlags && s.charFlags[key + '_refused']);

const CHAR_EVENTS = [

  /* ==========================================================
     角色 A · 药谷姑娘（herName）—— 依赖现有 affection，零改动
     ========================================================== */

  /* ---- 阶段一 · 初识 ---- */
  {
    id: 'c_herb_meet_1',
    ageBand: 'youth',
    place: 'danxia',
    title: '药田边的人',
    weight: 11,
    once: true,
    charLine: 'herb',
    stage: 'meet',
    req: s => s.age >= 18 && !s.charFlags?.herb_met && _notRefused('herb')(s),
    text: s => `丹霞谷的药田边，你遇见一个蹲在田垄间采药的姑娘。

她衣袖沾了泥，手指却极稳地掐下花茎。她抬头看你，眉头一皱：
「你站我药苗上了。」

——那年她叫${s.herName}。多年后你回想，这一句「站我药苗上了」，是你听过最好的开场白。`,
    choices: [
      {
        text: '慌忙退开，帮她一起采药',
        hint: '好感 +12',
        charaff: { key: 'herb', d: 12 },
        apply: s => { Characters.addAff(s, 'herb', 12); s.charFlags.herb_met = true; s.log(`${s.herName}看你手忙脚乱，忍不住笑了：「笨手笨脚，药都被你掐死了。」`); },
        cg: 'cg_herb_meet',
      },
      {
        text: '「你这药苗，品种不对」',
        hint: '好感 +4 或 +16（需丹心≥8）',
        charaff: { key: 'herb', d: 16 },
        apply: s => {
          s.charFlags.herb_met = true;
          if (s.dan >= 8) { Characters.addAff(s, 'herb', 16); s.log(`${s.herName}一愣，随即眼睛亮了：「你懂丹道？」那天你们聊到日暮。`); }
          else { Characters.addAff(s, 'herb', 4); s.log(`${s.herName}斜你一眼：「你说得头头是道，种出来的药呢？」你哑口无言，她却笑了。`); }
        },
        cg: 'cg_herb_meet',
      },
      {
        text: '沉默地帮她浇了一整片药田',
        hint: '好感 +14 · 心性+3',
        charaff: { key: 'herb', d: 14 },
        apply: s => { Characters.addAff(s, 'herb', 14); s.xin += 3; s.charFlags.herb_met = true; s.log(`你俩一句话没说，浇完了半亩药田。临走时她递给你一块饼：「明天还来吗？」`); },
        cg: 'cg_herb_meet',
      },
    ],
  },

  {
    id: 'c_herb_meet_2',
    ageBand: ['youth', 'prime'],
    place: 'danxia',
    title: '第二次上山',
    weight: 9,
    once: true,
    charLine: 'herb',
    stage: 'meet',
    req: s => _met('herb')(s) && Characters.getAff(s, 'herb') < TC_CRUSH_SAFE && _notRefused('herb')(s),
    text: s => `你真的又去了。

${s.herName}在晒药，看见你，头也没抬：
「我以为你昨天是客气。」

可她转身的时候，把最干净的那个石凳，踢到了你脚边。`,
    // 注：TC_CRUSH_SAFE 在下方定义（避免前置引用问题，用函数形式）
    choices: [
      {
        text: '坐下，帮她翻晒药材',
        hint: '好感 +10',
        charaff: { key: 'herb', d: 10 },
        apply: s => { Characters.addAff(s, 'herb', 10); s.dan += 2; s.log('你翻了半天的药。她偶尔抬头看你一眼，又低下去。'); },
      },
      {
        text: '「我不是客气。我想学丹道。」',
        hint: '好感 +8 · 丹心+4',
        charaff: { key: 'herb', d: 8 },
        apply: s => { Characters.addAff(s, 'herb', 8); s.dan += 4; s.wu += 2; s.log(`${s.herName}终于抬头，认真地看了你很久：「教你，可以。但你得先答应我一件事——别把药当工具。」`); },
      },
      {
        text: '带一包自己配的丹，请她指教',
        hint: '好感 +12（需丹心≥10）',
        charaff: { key: 'herb', d: 12 },
        apply: s => {
          if (s.dan >= 10) { Characters.addAff(s, 'herb', 12); s.log('她拆开你的丹，闻了闻，眉头一挑：「火候差半分，但用心了。」她第一次，正眼看了你。'); }
          else { Characters.addAff(s, 'herb', 5); s.log('她拆开丹，沉默了一会儿：「……你是真不懂。」但她还是把你的丹收好了。'); }
        },
      },
    ],
  },

  /* ---- 阶段二 · 暧昧 ---- */
  {
    id: 'c_herb_crush_1',
    ageBand: ['youth', 'prime'],
    place: 'danxia',
    title: '雨夜撑伞的人',
    weight: 10,
    once: true,
    charLine: 'herb',
    stage: 'crush',
    req: s => Characters.getAff(s, 'herb') >= 20 && !s.charFlags?.herb_crush && _notRefused('herb')(s),
    text: s => `夜半暴雨，你炼的药糊了。你蹲在廊下发愁，${s.herName}抱着伞来找你。

「你炼的什么丹？」她问。
「回魂丹。」
她沉默了一下：「给谁？」
「我娘。她病了很多年。」

雨声很大。她忽然把伞塞给你：
「你娘会好起来的。我给你看个好方子。」`,
    choices: [
      {
        text: '认真记下她的方子',
        hint: '好感 +15 · 丹心+8 · 羁绊flag',
        charaff: { key: 'herb', d: 15 },
        apply: s => { Characters.addAff(s, 'herb', 15); s.dan += 8; s.charFlags.herb_crush = true; s.log(`她写了整整三页纸。你后来才知道，那是她师门的秘方，写着「不可外传」。`); },
        cg: 'cg_herb_rain',
      },
      {
        text: '「你为什么对我这么好？」',
        hint: '好感 +12 · 心性+3',
        charaff: { key: 'herb', d: 12 },
        apply: s => { Characters.addAff(s, 'herb', 12); s.xin += 3; s.charFlags.herb_crush = true; s.log(`${s.herName}没答话，把伞往你这边又斜了一点。雨落在她肩上。`); },
        cg: 'cg_herb_rain',
      },
      {
        text: '「我自己来，你别管」',
        hint: '好感 −6 · 心性+6（推开线 · 断此缘）',
        charaff: { key: 'herb', d: -6 },
        // 第七轮：推开 = 真决裂 —— 关闭整条药谷线（不再改 advance flag，改 setRefused）
        apply: s => { Characters.addAff(s, 'herb', -6); s.xin += 6; Characters.setRefused(s, 'herb'); s.log(`她愣了一下，转身走了。走到廊尽头又回头：「药在炉子里，别糊了。」——她没再回来过。`); },
      },
    ],
  },

  {
    id: 'c_herb_crush_2',
    ageBand: ['youth', 'prime'],
    place: 'danxia',
    title: '她教你认药',
    weight: 9,
    once: true,
    charLine: 'herb',
    stage: 'crush',
    req: s => _affGE('herb', 28)(s) && !s.charFlags?.herb_crush2 && _notRefused('herb')(s),
    text: s => `她带你上了后山，说要教你认一种药。

「这味药叫『待雪』。」她指给你看，「花开的时候下雪，雪化的时候结果。错过一天，就要等三年。」

她顿了顿：
「认药和认人一样。错过了，也难。」`,
    choices: [
      {
        text: '「那我一天都不错过。」',
        hint: '好感 +14 · 剑意+2',
        charaff: { key: 'herb', d: 14 },
        apply: s => { Characters.addAff(s, 'herb', 14); s.charFlags.herb_crush2 = true; s.log('她没接话，只是蹲下去，替你拨开了一丛挡路的草。'); },
      },
      {
        text: '认真把「待雪」的药性记下来',
        hint: '好感 +8 · 丹心+6 · 悟性+3',
        charaff: { key: 'herb', d: 8 },
        apply: s => { Characters.addAff(s, 'herb', 8); s.dan += 6; s.wu += 3; s.charFlags.herb_crush2 = true; s.log('你记了满满一页。她看着你写，忽然说：「你写字的样子，跟你说话不一样。」'); },
      },
      {
        text: '「你教我的，是不是不只认药？」',
        hint: '好感 +16（需心性≥18）',
        charaff: { key: 'herb', d: 16 },
        apply: s => {
          s.charFlags.herb_crush2 = true;
          if (s.xin >= 18) { Characters.addAff(s, 'herb', 16); s.log('她的脸红了，很快别过去：「……你听懂了就别说出来。」'); }
          else { Characters.addAff(s, 'herb', 6); s.log('她板起脸：「你想多了。」可下山的时候，她走得很慢。'); }
        },
      },
    ],
  },

  /* ---- 阶段三 · 羁绊加深 ---- */
  {
    id: 'c_herb_bond_1',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'danxia',
    title: '守炉七日',
    weight: 10,
    once: true,
    charLine: 'herb',
    stage: 'bond',
    req: s => _affGE('herb', 45)(s) && !s.charFlags?.herb_bond && _notRefused('herb')(s),
    text: s => `${s.herName}病倒了。她炼了太多丹，把心血都熬干了。

七日七夜，你守在她炉边，一边替她续火，一边照方子给她煎药。方子上缺一味，你翻遍整座山谷，在山崖上找到了。

第八天清晨，她睁开眼，看见的是你。`,
    choices: [
      {
        text: '「醒了就好。」把药递给她',
        hint: '好感 +18 · 丹心+6',
        charaff: { key: 'herb', d: 18 },
        apply: s => { Characters.addAff(s, 'herb', 18); s.dan += 6; s.charFlags.herb_bond = true; s.log('她接过药，喝了一口，忽然说：「这药不对。」你慌了，她却笑了：「太甜了。」'); },
      },
      {
        text: '什么也不说，替她把被角掖好',
        hint: '好感 +16 · 心性+6',
        charaff: { key: 'herb', d: 16 },
        apply: s => { Characters.addAff(s, 'herb', 16); s.xin += 6; s.charFlags.herb_bond = true; s.log('你掖好被角，转身要走，袖口被她拉住了。她闭着眼，说：「再坐会儿。」'); },
      },
      {
        text: '「以后不许再这样熬了。」',
        hint: '好感 +14 · 冲突伏笔',
        charaff: { key: 'herb', d: 14 },
        apply: s => { Characters.addAff(s, 'herb', 14); s.charFlags.herb_bond = true; s.charFlags.herb_control = true; s.log('她愣了一下，眼神暗了一瞬：「你管我。」但她没抽回手。（这为后来的争执埋下了根。）'); },
        cg: 'cg_herb_bond',
      },
    ],
  },

  {
    id: 'c_herb_bond_2',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'danxia',
    title: '一枚药坠',
    weight: 9,
    once: true,
    charLine: 'herb',
    stage: 'bond',
    req: s => _affGE('herb', 52)(s) && !s.charFlags?.herb_bond2 && _notRefused('herb')(s),
    text: s => `她递给你一枚小小的药坠，通体碧色，里面封着一枚未开的「待雪」花苞。

「戴着。它能挡一次毒。」

她别过脸去：
「别问为什么。我炼多了，放着浪费。」`,
    choices: [
      {
        text: '收下，说「我记住了」',
        hint: '好感 +15 · 羁绊道具',
        charaff: { key: 'herb', d: 15 },
        apply: s => { Characters.addAff(s, 'herb', 15); s.charFlags.herb_bond2 = true; s.charFlags.herb_pendant = true; s.log('你把药坠贴身戴好。此后无论走到哪，胸口都有一点凉。'); },
        cg: 'cg_herb_pendant',
      },
      {
        text: '「那你也得收我一个东西。」',
        hint: '好感 +18（需剑意≥20）',
        charaff: { key: 'herb', d: 18 },
        apply: s => {
          s.charFlags.herb_bond2 = true;
          if (s.jian >= 20) { Characters.addAff(s, 'herb', 18); s.log('你解下剑穗，红色的，递给她。她攥了很久，最后说：「我收着。你可不许死。」'); }
          else { Characters.addAff(s, 'herb', 8); s.log('你摸遍全身，什么也没拿得出手。她笑了：「算了吧。」可她把药坠又攥紧了一点。'); }
        },
      },
      {
        text: '「你炼多了？这花苞是三年前封的。」',
        hint: '好感 +12 · 悟性+5',
        charaff: { key: 'herb', d: 12 },
        apply: s => { Characters.addAff(s, 'herb', 12); s.wu += 5; s.charFlags.herb_bond2 = true; s.log('她猛地抬头：「你……」话没说完，脸就红了，转身跑了。药坠还在你手里。'); },
      },
    ],
  },

  /* ---- 阶段四 · 误会冲突 ---- */
  {
    id: 'c_herb_rift_1',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'danxia',
    title: '两种药，两条命',
    weight: 10,
    once: true,
    charLine: 'herb',
    stage: 'rift',
    req: s => _affGE('herb', 70)(s) && !s.charFlags?.herb_rift && _notRefused('herb')(s),
    text: s => `疫情又来。你和她只剩一副药的量。

一边是三百个凡人，一边是你重伤的同门。

她说：「救同门。剩下的药引，我再去采。」
你说：「先救凡人。同门有修为，撑得住。」

她盯着你，很久没说话。`,
    choices: [
      {
        text: '听她的，先救同门',
        hint: '好感 +8 · 心性+4 · 丹心+6',
        charaff: { key: 'herb', d: 8 },
        apply: s => { Characters.addAff(s, 'herb', 8); s.xin += 4; s.dan += 6; s.charFlags.herb_rift = true; s.log('你们保下了同门。三百个凡人里，死了七十个。她一句话没说，把那七十个名字抄了一遍。'); },
      },
      {
        text: '坚持先救凡人',
        hint: '好感 −12 · 丹心+12 · 误会深化',
        charaff: { key: 'herb', d: -12 },
        apply: s => { Characters.addAff(s, 'herb', -12); s.dan += 12; s.xin -= 3; s.charFlags.herb_rift = true; s.charFlags.herb_conflict = true; s.log('她拗不过你。凡人是救下了，同门却废了经脉。她把剩下的丹全都锁进了柜子，钥匙收走。她说：「你从来不听我的。」'); },
        cg: 'cg_herb_conflict',
      },
      {
        text: '不选。把药一分为二，谁的命都赌一半',
        hint: '好感 +4 · 心性+8 · 高风险',
        charaff: { key: 'herb', d: 4 },
        apply: s => {
          s.charFlags.herb_rift = true;
          if (s.xin >= 30) { Characters.addAff(s, 'herb', 16); s.charFlags.herb_split = true; s.log('你把药劈成两半。两边都没死绝，也都没全活。她看着你，忽然说：「你比我以为的……要难懂。」'); }
          else { Characters.addAff(s, 'herb', 4); s.log('你赌输了。凡人和同门都死了几个。她没怪你，可从那以后，她熬药的时候，不让你在旁边看。'); }
        },
      },
    ],
  },

  {
    id: 'c_herb_rift_2',
    ageBand: ['prime', 'elder'],
    place: 'danxia',
    title: '她走了',
    weight: 9,
    once: true,
    charLine: 'herb',
    stage: 'rift',
    req: s => _affGE('herb', 70)(s) && !s.charFlags?.herb_left && _notRefused('herb')(s),
    text: s => `你推开药庐的门，炉子是冷的。

桌上留了一张字条，是她的字：
「我回师门一趟。你别找。」

旁边压着那枚药坠——你送的那根红剑穗，不见了。`,
    choices: [
      {
        text: '追。往她师门的方向',
        hint: '好感 +10 · 和解前置',
        charaff: { key: 'herb', d: 10 },
        apply: s => { Characters.addAff(s, 'herb', 10); s.charFlags.herb_left = true; s.charFlags.herb_chase = true; s.log('你追了三天，在渡口追上了她。她背着药箱，看见你，脚步停了。'); },
      },
      {
        text: '不追。让她静一静',
        hint: '好感 −8 · 心性+6 · 冷战线',
        charaff: { key: 'herb', d: -8 },
        apply: s => { Characters.addAff(s, 'herb', -8); s.xin += 6; s.charFlags.herb_left = true; s.log('你坐在空药庐里，坐到天亮。炉子你重新生了一次火，烧到第三天，没人回来。'); },
      },
      {
        text: '先把药庐收拾好，再等',
        hint: '好感 +6 · 丹心+5',
        charaff: { key: 'herb', d: 6 },
        apply: s => { Characters.addAff(s, 'herb', 6); s.dan += 5; s.charFlags.herb_left = true; s.log('你把药庐擦得干干净净，药材按她的习惯排列。你想，她回来的时候，得认得出来这是她的地方。'); },
      },
    ],
  },

  /* ---- 阶段五 · 和解 ---- */
  {
    id: 'c_herb_reconcile_1',
    ageBand: ['prime', 'elder'],
    place: 'danxia',
    title: '渡口的话',
    weight: 10,
    once: true,
    charLine: 'herb',
    stage: 'reconcile',
    req: s => _affGE('herb', 78)(s) && !!s.charFlags?.herb_left && !s.charFlags?.herb_recon && _notRefused('herb')(s),
    text: s => `渡口的风很大。她背对着你，药箱放在脚边。

「你知道吗，」她忽然开口，「那天我不是气你选了凡人。」

她转过身：
「我是气你——不跟我商量。你把我当外人。」`,
    choices: [
      {
        text: '「对不起。是我错了。」',
        hint: '好感 +20 · 心性+8',
        charaff: { key: 'herb', d: 20 },
        apply: s => { Characters.addAff(s, 'herb', 20); s.xin += 8; s.charFlags.herb_recon = true; s.charFlags.herb_rift = false; s.log('她愣了一下，眼圈红了：「你以前从来不认错。」她把药箱递给你：「拿着。我们回去。」'); },
        cg: 'cg_herb_reconcile',
      },
      {
        text: '「往后每一步，我都跟你商量。」',
        hint: '好感 +22 · 誓言 · 婚姻前置',
        charaff: { key: 'herb', d: 22 },
        apply: s => { Characters.addAff(s, 'herb', 22); s.xin += 6; s.charFlags.herb_recon = true; s.charFlags.herb_rift = false; s.charFlags.herb_vow = true; s.log('你说完这句，她哭了。哭完，她擦了擦脸，说：「好。那你别忘。」'); },
        cg: 'cg_herb_reconcile',
      },
      {
        text: '不说话，接过她的药箱',
        hint: '好感 +16 · 心性+10',
        charaff: { key: 'herb', d: 16 },
        apply: s => { Characters.addAff(s, 'herb', 16); s.xin += 10; s.charFlags.herb_recon = true; s.charFlags.herb_rift = false; s.log('你接过药箱，她跟在你身后。一路无话，可她的步子，跟得很紧。'); },
      },
    ],
  },

  {
    id: 'c_herb_reconcile_2',
    ageBand: ['prime', 'elder'],
    place: 'danxia',
    title: '待雪花开',
    weight: 11,
    once: true,
    charLine: 'herb',
    stage: 'reconcile',
    req: s => _affGE('herb', 85)(s) && !!s.charFlags?.herb_recon && !s.charFlags?.herb_final && _notRefused('herb')(s),
    text: s => `后山的「待雪」开花了，就在今夜。

她拉着你上山，一路没说话。走到花前，她停下。

「三年一次。」她说，「我守这株花守了九年。」

风起了，花上落下第一片雪。`,
    choices: [
      {
        text: '「这次，我陪你一起看。」',
        hint: '好感 +20 · 婚姻前置',
        charaff: { key: 'herb', d: 20 },
        apply: s => { Characters.addAff(s, 'herb', 20); s.charFlags.herb_final = true; s.charFlags.herb_married_ready = true; s.log('你们在花前站了一夜。天亮时，花结果了。她把果子摘下来，分了一半给你。'); if (s.flags && s.flags.go_home && s.flags.revenge_done !== true) s.log('（你心里还压着一封家书。婚事，怕是要往后放放了。）'); },
        cg: 'cg_herb_blossom',
      },
      {
        text: '「九年……你等的是什么？」',
        hint: '好感 +16 · 悟性+6',
        charaff: { key: 'herb', d: 16 },
        apply: s => { Characters.addAff(s, 'herb', 16); s.wu += 6; s.charFlags.herb_final = true; s.log('她看着花，很久才说：「等一个，会跟我一起等到天亮的人。」'); },
      },
      {
        text: '把外袍解下来，披在她肩上',
        hint: '好感 +18 · 心性+6',
        charaff: { key: 'herb', d: 18 },
        apply: s => { Characters.addAff(s, 'herb', 18); s.xin += 6; s.charFlags.herb_final = true; s.charFlags.herb_married_ready = true; s.log('她没躲。雪落在你肩上，她往你这边靠了半步。'); if (s.flags && s.flags.go_home && s.flags.revenge_done !== true) s.log('（你心里还压着一封家书。婚事，怕是要往后放放了。）'); },
        cg: 'cg_herb_blossom',
      },
    ],
  },

  /* ==========================================================
     角色 B · 剑宗师姐（sisterName）
     好感 → affection_sister（新增可选字段）
     ========================================================== */

  /* ---- 阶段一 · 初识 ---- */
  {
    id: 'c_sister_meet_1',
    ageBand: 'youth',
    place: 'jianfeng',
    title: '师姐的剑',
    weight: 10,
    once: true,
    charLine: 'sister',
    stage: 'meet',
    req: s => s.age >= 18 && (s.faction === 'tianjian' || s.jian >= 10) && !s.charFlags?.sister_met && _notRefused('sister')(s),
    text: s => `天剑宗的师姐${s.sisterName}，是宗门里最冷的人。她从不与人同练，剑出必见血。

这日她却把你叫到后山：
「你剑意里有股执念。执念是好事，也是大凶。」
她把剑递给你：「接。接不住，这辈子别练剑了。」`,
    choices: [
      {
        text: '接住她的剑',
        hint: '好感 +8 或 +16（需剑意≥15）',
        charaff: { key: 'sister', d: 16 },
        apply: s => {
          s.charFlags.sister_met = true;
          if (s.jian >= 15) { Characters.addAff(s, 'sister', 16); s.jian += 8; s.power += 20; s.log('你接住了，虎口裂开，血滴在剑上。她第一次笑了：「还行。」'); }
          else { Characters.addAff(s, 'sister', 8); s.jian += 4; s.power += 8; s.xin += 4; s.log('你没接住，剑落在地上。她转身走了：「三年后再来。」'); }
        },
        cg: 'cg_sister_meet',
      },
      {
        text: '「师姐，你为什么这么在意我？」',
        hint: '好感 +10 · 剧情',
        charaff: { key: 'sister', d: 10 },
        apply: s => { Characters.addAff(s, 'sister', 10); s.charFlags.sister_met = true; s.log(`${s.sisterName}背对着你站了很久：「因为你像以前的一个人。那个人，我救不了。」`); },
        cg: 'cg_sister_meet',
      },
      {
        text: '不接，转身离开',
        hint: '好感 +4 · 心性+6（转身离开 · 断此缘）',
        charaff: { key: 'sister', d: 4 },
        // 第七轮：初识即转身离开 = 决裂，关闭整条剑宗线
        apply: s => { Characters.addAff(s, 'sister', 4); s.xin += 6; s.charFlags.sister_met = true; Characters.setRefused(s, 'sister'); s.log('她看着你的背影，没说话。剑插在原地，插了三年。'); },
      },
    ],
  },

  {
    id: 'c_sister_meet_2',
    ageBand: ['youth', 'prime'],
    place: 'jianfeng',
    title: '后山的第三年',
    weight: 8,
    once: true,
    charLine: 'sister',
    stage: 'meet',
    req: s => _met('sister')(s) && Characters.getAff(s, 'sister') < 20 && _notRefused('sister')(s),
    text: s => `你再去后山时，那把我没能接住的剑还插在石头上。

${s.sisterName}坐在旁边的石阶上擦另一把剑，头也不抬：
「三年没到。来做什么。」`,
    choices: [
      {
        text: '「来告诉你，我现在能接住了。」',
        hint: '好感 +10 · 剑意+5（需剑意≥20）',
        charaff: { key: 'sister', d: 10 },
        apply: s => {
          if (s.jian >= 20) { Characters.addAff(s, 'sister', 10); s.jian += 5; s.log('她终于抬头。你拔起那把剑，稳稳的。她看了很久，说：「……不错。」这两个字，她大概很少说。'); }
          else { Characters.addAff(s, 'sister', 4); s.log('你拔剑，手还是抖了。她把剑夺回去：「回去练。」可你走的时候，听见她轻轻叹了口气。'); }
        },
      },
      {
        text: '默默坐在她旁边，一起擦剑',
        hint: '好感 +12 · 心性+4',
        charaff: { key: 'sister', d: 12 },
        apply: s => { Characters.addAff(s, 'sister', 12); s.xin += 4; s.log('你俩一句话没说，擦了半天的剑。临走时她把自己的剑油塞给你：「你的剑，锈了。」'); },
      },
      {
        text: '「那个人是谁？你救不了的那位。」',
        hint: '好感 +8 · 剧情解锁',
        charaff: { key: 'sister', d: 8 },
        apply: s => { Characters.addAff(s, 'sister', 8); s.charFlags.sister_past = true; s.log('她擦剑的手停了：「是我师妹。」她没再说下去，但那天，她没赶你走。'); },
      },
    ],
  },

  /* ---- 阶段二 · 暧昧 ---- */
  {
    id: 'c_sister_crush_1',
    ageBand: ['youth', 'prime'],
    place: 'jianfeng',
    title: '雪夜同剑',
    weight: 10,
    once: true,
    charLine: 'sister',
    stage: 'crush',
    req: s => _affGE('sister', 20)(s) && !s.charFlags?.sister_crush && _notRefused('sister')(s),
    text: s => `山上下雪了，是这一年的第一场。

你在崖边练剑，她不知什么时候站在了后面。
「你出剑的时候，」她忽然开口，「在想什么？」

你回头。雪落在她肩上，她没拍掉。`,
    choices: [
      {
        text: '「在想你刚才说的话。」',
        hint: '好感 +14 · 暧昧flag',
        charaff: { key: 'sister', d: 14 },
        apply: s => { Characters.addAff(s, 'sister', 14); s.charFlags.sister_crush = true; s.log('她愣了一下，别过脸去：「练剑分心，是大忌。」可她的耳朵，红了。'); },
        cg: 'cg_sister_snow',
      },
      {
        text: '「在想怎么才能追上你。」',
        hint: '好感 +16 · 剑意+4',
        charaff: { key: 'sister', d: 16 },
        apply: s => { Characters.addAff(s, 'sister', 16); s.jian += 4; s.charFlags.sister_crush = true; s.log('她沉默了很久：「追不上的。你别追。」可她说完这句，往你这边挪了一步。'); },
        cg: 'cg_sister_snow',
      },
      {
        text: '「在想剑。只想了剑。」',
        hint: '好感 +6 · 剑意+6',
        charaff: { key: 'sister', d: 6 },
        apply: s => { Characters.addAff(s, 'sister', 6); s.jian += 6; s.charFlags.sister_crush = true; s.log('她点了点头：「好。」转身走了。走出很远，你听见她自言自语：「……好什么。」'); },
      },
    ],
  },

  {
    id: 'c_sister_crush_2',
    ageBand: ['youth', 'prime'],
    place: 'jianfeng',
    title: '她替你挡的一剑',
    weight: 10,
    once: true,
    charLine: 'sister',
    stage: 'crush',
    req: s => _affGE('sister', 30)(s) && !s.charFlags?.sister_crush2 && _notRefused('sister')(s),
    text: s => `山门外来了个寻仇的散修，冲着你的后心一剑。

你听见破风声的同一刻，也听见了另一声脆响——那是剑锋撞在剑上的声音。

${s.sisterName}挡在你身前，小臂上划开一道，血渗进了雪里。

「看什么，」她皱着眉，「还不补剑。」`,
    choices: [
      {
        text: '补剑，杀了他，然后替她包扎',
        hint: '好感 +18 · 剑意+6',
        charaff: { key: 'sister', d: 18 },
        apply: s => { Characters.addAff(s, 'sister', 18); s.jian += 6; s.power += 20; s.charFlags.sister_crush2 = true; s.log('你一剑要了那人的命，回头撕下衣摆替她缠伤。她任你缠，一句话没说，但他的手指在抖。'); },
        cg: 'cg_sister_shield',
      },
      {
        text: '先护她退，不管那人',
        hint: '好感 +20 · 心性+6',
        charaff: { key: 'sister', d: 20 },
        apply: s => { Characters.addAff(s, 'sister', 20); s.xin += 6; s.charFlags.sister_crush2 = true; s.log('你架着她退开，那散修跑了。她气了：「你放跑他做什么！」你没答。你想的是，她胳膊还在流血。'); },
        cg: 'cg_sister_shield',
      },
      {
        text: '「谁要你替我挡。」',
        hint: '好感 −4 · 心性+8 · 口是心非线',
        charaff: { key: 'sister', d: -4 },
        apply: s => { Characters.addAff(s, 'sister', -4); s.xin += 8; s.charFlags.sister_crush2 = true; s.log('她动作一顿，随即瞪你：「你再说一遍。」你把话咽了回去。那天她没和你说话，可晚饭时，她多盛了一碗，放在你面前。'); },
      },
    ],
  },

  /* ---- 阶段三 · 羁绊加深 ---- */
  {
    id: 'c_sister_bond_1',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'jianfeng',
    title: '她讲了师妹的事',
    weight: 10,
    once: true,
    charLine: 'sister',
    stage: 'bond',
    req: s => _affGE('sister', 45)(s) && !s.charFlags?.sister_bond && _notRefused('sister')(s),
    text: s => `她带你去了剑冢最深处，那里立着一个小碑，碑上无字。

「我师妹。」她说，「她替我去杀一个人，回来的时候，只剩半截剑。」

她蹲下来，擦碑上的灰：
「我这些年不敢收徒，也不敢亲近人。我怕。」`,
    choices: [
      {
        text: '「那我替你记着。」',
        hint: '好感 +18 · 心性+8',
        charaff: { key: 'sister', d: 18 },
        apply: s => { Characters.addAff(s, 'sister', 18); s.xin += 8; s.charFlags.sister_bond = true; s.log('她抬头看你，眼里有你从没见过的东西：「你要是也死了，我怎么办。」'); },
        cg: 'cg_sister_tomb',
      },
      {
        text: '「碑上为什么不刻字？」',
        hint: '好感 +14 · 悟性+6',
        charaff: { key: 'sister', d: 14 },
        apply: s => { Characters.addAff(s, 'sister', 14); s.wu += 6; s.charFlags.sister_bond = true; s.log('「刻不上。」她说，「一抬手，我就想起来她笑的样子，写不下去。」你替她，在碑角刻下两个字：「故剑」。'); },
      },
      {
        text: '什么也不说，陪她擦完那块碑',
        hint: '好感 +16 · 心性+10',
        charaff: { key: 'sister', d: 16 },
        apply: s => { Characters.addAff(s, 'sister', 16); s.xin += 10; s.charFlags.sister_bond = true; s.log('你们擦了很久。擦完，她说了句：「她的剑穗是红的。跟你送的不一样。」你没问她怎么知道你送过剑穗。'); },
      },
    ],
  },

  {
    id: 'c_sister_bond_2',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'jianfeng',
    title: '剑穗',
    weight: 9,
    once: true,
    charLine: 'sister',
    stage: 'bond',
    req: s => _affGE('sister', 55)(s) && !s.charFlags?.sister_bond2 && _notRefused('sister')(s),
    text: s => `你的剑穗磨断了。

第二天，你的剑上多了一根新的——还是红色，编法很笨，绳头没藏好。

${s.sisterName}从你身边走过，目不斜视：「捡的。」`,
    choices: [
      {
        text: '「谢了。」然后当着她的面系上',
        hint: '好感 +16',
        charaff: { key: 'sister', d: 16 },
        apply: s => { Characters.addAff(s, 'sister', 16); s.charFlags.sister_bond2 = true; s.log('她脚步顿了一下：「谁说是给你的。」但她没让你解下来。'); },
      },
      {
        text: '「编得真丑。我教你。」',
        hint: '好感 +18（需心性≥22）',
        charaff: { key: 'sister', d: 18 },
        apply: s => {
          s.charFlags.sister_bond2 = true;
          if (s.xin >= 22) { Characters.addAff(s, 'sister', 18); s.log('你俩坐在崖边编了一下午剑穗。她的手指很利落，编出来还是丑的。你笑，她踹了你一脚。'); }
          else { Characters.addAff(s, 'sister', 8); s.log('她瞪你一眼，把剑穗从你剑上解走了：「不要就算了。」第二天，它又回来了。'); }
        },
      },
      {
        text: '装作没发现',
        hint: '好感 +10 · 心性+4',
        charaff: { key: 'sister', d: 10 },
        apply: s => { Characters.addAff(s, 'sister', 10); s.charFlags.sister_bond2 = true; s.log('你什么也没说。可你练剑的时候，总不自觉地，握着剑柄的那只手，绕开了剑穗。'); },
      },
    ],
  },

  /* ---- 阶段四 · 误会冲突 ---- */
  {
    id: 'c_sister_rift_1',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'jianfeng',
    title: '她要杀的人',
    weight: 10,
    once: true,
    charLine: 'sister',
    stage: 'rift',
    req: s => _affGE('sister', 70)(s) && !s.charFlags?.sister_rift && _notRefused('sister')(s),
    text: s => `她查到了当年害死师妹的那个人——就在血海魔宗。

「我去。」她说，「你别跟。」

她递给你一枚令牌：
「这本是给师妹的。现在给你。你替我，守好这个山门。」`,
    choices: [
      {
        text: '「我跟你一起去。」',
        hint: '好感 +12 · 剑意+6 · 冲突线',
        charaff: { key: 'sister', d: 12 },
        apply: s => { Characters.addAff(s, 'sister', 12); s.jian += 6; s.charFlags.sister_rift = true; s.log('「你会死。」她说。「那也得去。」你答。她盯着你看了很久，最后说：「行。但你别挡在我前面。」'); },
      },
      {
        text: '接下令牌，让她一个人去',
        hint: '好感 −10 · 心性+6（推她涉险 · 断此缘）',
        charaff: { key: 'sister', d: -10 },
        // 第七轮：把危险推给她 = 决裂，关闭整条剑宗线
        apply: s => { Characters.addAff(s, 'sister', -10); s.xin += 6; s.charFlags.sister_rift = true; s.charFlags.sister_alone = true; Characters.setRefused(s, 'sister'); s.log('她走了。你握着令牌站在山门口，站了一夜。她回来的时候，身上全是血，看见你，只说了一句：「令牌收好了？」——然后再没来找过你。'); },
      },
      {
        text: '「你去可以。但你把碑上的字给我刻好。」',
        hint: '好感 +8 · 情感牵制',
        charaff: { key: 'sister', d: 8 },
        apply: s => { Characters.addAff(s, 'sister', 8); s.charFlags.sister_rift = true; s.log('她一愣，随即笑了，笑得有点难看：「你这是……拿她栓我？」她深吸一口气：「好。我一定回来刻。」'); },
      },
    ],
  },

  {
    id: 'c_sister_rift_2',
    ageBand: ['prime', 'elder'],
    place: 'jianfeng',
    title: '回来之后',
    weight: 9,
    once: true,
    charLine: 'sister',
    stage: 'rift',
    req: s => _affGE('sister', 70)(s) && !s.charFlags?.sister_back && _notRefused('sister')(s),
    text: s => `她回来了。带着一身伤，和那人的头。

可她没理你。

第三天，你在她门口看见她——她在擦那块无字的碑，一个字都没刻。`,
    choices: [
      {
        text: '走进去，拿过她的刀，替她刻',
        hint: '好感 +14 · 和解前置',
        charaff: { key: 'sister', d: 14 },
        apply: s => { Characters.addAff(s, 'sister', 14); s.charFlags.sister_back = true; s.log('她没拦你。你刻了三笔，手一抖，刻歪了。她忽然笑了，笑完就哭了。'); },
      },
      {
        text: '「你怪我没去，是不是。」',
        hint: '好感 +6 · 心性+6',
        charaff: { key: 'sister', d: 6 },
        apply: s => { Characters.addAff(s, 'sister', 6); s.xin += 6; s.charFlags.sister_back = true; s.log('她擦碑的手停了：「不怪。是我让你别去的。」她顿了顿，「可我回来的时候，山门口没人。」'); },
      },
      {
        text: '在她身后站到天亮',
        hint: '好感 +12 · 心性+8',
        charaff: { key: 'sister', d: 12 },
        apply: s => { Characters.addAff(s, 'sister', 12); s.xin += 8; s.charFlags.sister_back = true; s.log('天快亮时，她终于开口：「你站那么远做什么。过来。」'); },
      },
    ],
  },

  /* ---- 阶段五 · 和解 ---- */
  {
    id: 'c_sister_reconcile_1',
    ageBand: ['prime', 'elder'],
    place: 'jianfeng',
    title: '碑上有字了',
    weight: 11,
    once: true,
    charLine: 'sister',
    stage: 'reconcile',
    req: s => _affGE('sister', 78)(s) && !!s.charFlags?.sister_back && !s.charFlags?.sister_recon && _notRefused('sister')(s),
    text: s => `她把你叫到剑冢。

那块碑上，如今刻了两行字——是她的笔迹：
「故剑。此心。」

她站在碑前，背对着你：
「我想了很多年。她走了以后，我以为这辈子不会再有。」`,
    choices: [
      {
        text: '「现在有了。」',
        hint: '好感 +22 · 心性+8 · 婚姻前置',
        charaff: { key: 'sister', d: 22 },
        apply: s => { Characters.addAff(s, 'sister', 22); s.xin += 8; s.charFlags.sister_recon = true; s.charFlags.sister_rift = false; s.charFlags.sister_vow = true; s.log('她转过身，眼睛有点红：「你确定？我这个人，不好相处。」你说：「我知道。」她笑了，是那种很旧、很轻的笑。'); },
        cg: 'cg_sister_reconcile',
      },
      {
        text: '「那两行字，我可以续一句吗？」',
        hint: '好感 +20 · 悟性+6',
        charaff: { key: 'sister', d: 20 },
        apply: s => { Characters.addAff(s, 'sister', 20); s.wu += 6; s.charFlags.sister_recon = true; s.charFlags.sister_rift = false; s.log('她递给你刀。你在两句下面，添了三个字。她看了很久，把刀收了，什么也没说，但走的时候，牵住了你的袖子。'); },
        cg: 'cg_sister_reconcile',
      },
      {
        text: '「碑是给她的。我们的事，另说。」',
        hint: '好感 +16 · 心性+10',
        charaff: { key: 'sister', d: 16 },
        apply: s => { Characters.addAff(s, 'sister', 16); s.xin += 10; s.charFlags.sister_recon = true; s.charFlags.sister_rift = false; s.log('她愣了一下，随即点头：「你说得对。」她朝碑鞠了一躬，然后转身朝你伸手：「走吧。回去。」'); },
      },
    ],
  },

  {
    id: 'c_sister_reconcile_2',
    ageBand: ['prime', 'elder'],
    place: 'jianfeng',
    title: '剑峰的第二把剑',
    weight: 11,
    once: true,
    charLine: 'sister',
    stage: 'reconcile',
    req: s => _affGE('sister', 85)(s) && !!s.charFlags?.sister_recon && !s.charFlags?.sister_final && _notRefused('sister')(s),
    text: s => `剑峰顶上，历代剑修的本命剑插成一片剑林。

她带你上去，走到最空的一处。
「这里。」她说，「我留了十年。」

她把剑插下，示意你也插。`,
    choices: [
      {
        text: '把自己的剑，插在她旁边',
        hint: '好感 +20 · 婚姻前置',
        charaff: { key: 'sister', d: 20 },
        apply: s => { Characters.addAff(s, 'sister', 20); s.charFlags.sister_final = true; s.charFlags.sister_married_ready = true; s.log('两把剑，并排立在风里。她看了很久，说：「行了。走吧。」转身时，她先伸出了手。'); if (s.flags && s.flags.go_home && s.flags.revenge_done !== true) s.log('（你心里还压着一封家书。婚事，怕是要往后放放了。）'); },
        cg: 'cg_sister_swordforest',
      },
      {
        text: '「你的剑旁边，我不想只是插一把剑。」',
        hint: '好感 +22（需剑意≥40）',
        charaff: { key: 'sister', d: 22 },
        apply: s => {
          s.charFlags.sister_final = true;
          if (s.jian >= 40) { Characters.addAff(s, 'sister', 22); s.charFlags.sister_married_ready = true; s.log('她盯着你，很久：「那你想怎样。」你说：「娶你。」她背过身去，肩膀抖了一下，然后说：「……剑先插上。」'); if (s.flags && s.flags.go_home && s.flags.revenge_done !== true) s.log('（你心里还压着一封家书。婚事，怕是要往后放放了。）'); }
          else { Characters.addAff(s, 'sister', 10); s.log('她看了你一眼：「话别说太满。你的剑，还差得远。」但她笑了。'); }
        },
      },
      {
        text: '「留了十年，是等我吗？」',
        hint: '好感 +18 · 心性+6',
        charaff: { key: 'sister', d: 18 },
        apply: s => { Characters.addAff(s, 'sister', 18); s.xin += 6; s.charFlags.sister_final = true; s.log('「不是。」她说得很快。然后顿了顿，「……本来是留给师妹的。现在改主意了。」'); },
      },
    ],
  },

  /* ==========================================================
     角色 C · 血海修罗（herName2）—— 新增角色
     好感 → affection_third（新增可选字段）
     ========================================================== */

  /* ---- 阶段一 · 初识 ---- */
  {
    id: 'c_third_meet_1',
    ageBand: 'youth',
    place: 'liuli',
    title: '血里的花',
    weight: 9,
    once: true,
    charLine: 'third',
    stage: 'meet',
    req: s => s.age >= 20 && s.power >= 40 && !s.charFlags?.third_met && _notRefused('third')(s),
    text: s => `你在乱葬岗边上，看见一个穿赤衣的姑娘。

她蹲在一堆焦土前，把一朵不知名的小花，插在土里。

她察觉到你，站起来，手按在刀上。她的眼睛是红的——不是哭的，是血海魔宗的天生瞳色。
「你看见什么了？」

你说：「看见一个埋花的人。」`,
    choices: [
      {
        text: '「看见一个埋花的人。」',
        hint: '好感 +14 · 剧情',
        charaff: { key: 'third', d: 14 },
        apply: s => { Characters.addAff(s, 'third', 14); s.charFlags.third_met = true; s.log(`她愣住了，手从刀上放了下来。她叫${s.herName2}。她说：「你这话，我没听过。」`); },
        cg: 'cg_third_meet',
      },
      {
        text: '「血海魔宗的人。」',
        hint: '好感 +6 · 但被记住',
        charaff: { key: 'third', d: 6 },
        apply: s => { Characters.addAff(s, 'third', 6); s.charFlags.third_met = true; s.log('她笑了，笑得很凉：「对。那你还不跑？」你没跑。她盯着你看了很久，转身走了。'); },
      },
      {
        text: '走过去，把花扶正',
        hint: '好感 +16 · 丹心+4',
        charaff: { key: 'third', d: 16 },
        apply: s => { Characters.addAff(s, 'third', 16); s.dan += 4; s.charFlags.third_met = true; s.log('你弯腰把花扶正了，还压了块石头挡风。她站在旁边看你做这些，一句话没说。走的时候，她回头看了你一眼。'); },
        cg: 'cg_third_meet',
      },
    ],
  },

  {
    id: 'c_third_meet_2',
    ageBand: ['youth', 'prime'],
    place: 'liuli',
    title: '第二次见她',
    weight: 8,
    once: true,
    charLine: 'third',
    stage: 'meet',
    req: s => _met('third')(s) && Characters.getAff(s, 'third') < 20 && _notRefused('third')(s),
    text: s => `坊市里，你又撞见她。

她一身赤衣，站在卖糖的画摊前，看一幅画了很久。画上是一只黄鹂。

摊主不敢收她的钱。她掏出灵石，放在摊上就走了。
——你注意到，她拿走的是那只黄鹂。`,
    choices: [
      {
        text: '「喜欢黄鹂？」',
        hint: '好感 +12',
        charaff: { key: 'third', d: 12 },
        apply: s => { Characters.addAff(s, 'third', 12); s.log('她把画往身后一藏：「关你什么事。」可那幅画，后来一直挂在她住的洞里。'); },
      },
      {
        text: '买下旁边那幅，送给她',
        hint: '好感 +10 · 机缘+3',
        charaff: { key: 'third', d: 10 },
        apply: s => { Characters.addAff(s, 'third', 10); s.ji += 3; s.log('你买了另一幅，是一只孤雁。她看了看，没收，只说：「画得不好。」但第三天，那只孤雁出现在了黄鹂旁边。'); },
      },
      {
        text: '装作不认识，走过去',
        hint: '好感 +4 · 心性+4',
        charaff: { key: 'third', d: 4 },
        apply: s => { Characters.addAff(s, 'third', 4); s.xin += 4; s.log('你走过去了。走出十几步，听见身后她轻轻「哼」了一声。'); },
      },
    ],
  },

  /* ---- 阶段二 · 暧昧 ---- */
  {
    id: 'c_third_crush_1',
    ageBand: ['youth', 'prime'],
    place: 'wangchuan',
    title: '忘川边上的人',
    weight: 9,
    once: true,
    charLine: 'third',
    stage: 'crush',
    req: s => _affGE('third', 20)(s) && !s.charFlags?.third_crush && _notRefused('third')(s),
    text: s => `你路过忘川渡，看见她一个人坐在河边。

她脱下鞋，把脚浸在河水里——那水能洗掉记忆，她却像不怕。

「你坐这儿做什么。」她没回头，「我小时候，是被扔在这条河里的。」`,
    choices: [
      {
        text: '坐在她旁边，也把脚伸进去',
        hint: '好感 +16 · 心性+4',
        charaff: { key: 'third', d: 16 },
        apply: s => { Characters.addAff(s, 'third', 16); s.xin += 4; s.charFlags.third_crush = true; s.log('河水很凉。她转头看你：「你会忘东西的。」你说：「那我记得你，就够了。」她没说话，但把脚往你那边靠了靠。'); },
        cg: 'cg_third_river',
      },
      {
        text: '把她拉上岸',
        hint: '好感 +12 · 心性+6',
        charaff: { key: 'third', d: 12 },
        apply: s => { Characters.addAff(s, 'third', 12); s.xin += 6; s.charFlags.third_crush = true; s.log('她被你拽上岸，瞪你：「你干嘛。」你说：「这水不干净。」她愣了一下，忽然低声说：「……第一次有人这么说。」'); },
        cg: 'cg_third_river',
      },
      {
        text: '「那你怎么还记得小时候的事？」',
        hint: '好感 +14 · 悟性+5',
        charaff: { key: 'third', d: 14 },
        apply: s => { Characters.addAff(s, 'third', 14); s.wu += 5; s.charFlags.third_crush = true; s.log('她怔住了。很久，她说：「因为我没敢忘。我怕忘了，就真的什么都不是了。」'); },
      },
    ],
  },

  {
    id: 'c_third_crush_2',
    ageBand: ['youth', 'prime'],
    place: 'luori',
    title: '她送你的一刀',
    weight: 9,
    once: true,
    charLine: 'third',
    stage: 'crush',
    req: s => _affGE('third', 30)(s) && !s.charFlags?.third_crush2 && _notRefused('third')(s),
    text: s => `落日原上，她拦住你，递过来一把短刀。

「血海里，新人要立威，就得杀个人。」她说，「我爹让我杀你。」

她把刀塞进你手里：
「你要是想活，现在就得先杀了我。」`,
    choices: [
      {
        text: '把刀插回她腰间：「我不杀你。你也不许死。」',
        hint: '好感 +20 · 心性+8',
        charaff: { key: 'third', d: 20 },
        apply: s => { Characters.addAff(s, 'third', 20); s.xin += 8; s.charFlags.third_crush2 = true; s.log('她盯着你，眼睛有点红：「你会害死我。」你说：「那我陪你死。」她忽然笑了，把刀收了：「行。那我回去，就说你跑了。」'); },
        cg: 'cg_third_blade',
      },
      {
        text: '拔剑，但不是对她——冲血海的方向',
        hint: '好感 +18 · 剑意+6',
        charaff: { key: 'third', d: 18 },
        apply: s => { Characters.addAff(s, 'third', 18); s.jian += 6; s.power += 20; s.charFlags.third_crush2 = true; s.log('你转身就朝血海山门走。她拽住你：「你疯了！」你说：「我去跟你爹说。」她说：「你会死的。」你说：「那也得说。」'); },
        cg: 'cg_third_blade',
      },
      {
        text: '「你杀我吧。我不还手。」',
        hint: '好感 +16 · 心性+10 · 风险',
        charaff: { key: 'third', d: 16 },
        apply: s => { Characters.addAff(s, 'third', 16); s.xin += 10; s.shou -= 2; s.charFlags.third_crush2 = true; s.log('她把刀举起来，举了很久，最后扔在地上：「你真是个傻子。」她蹲下来哭了。你没见过她哭。'); },
      },
    ],
  },

  /* ---- 阶段三 · 羁绊加深 ---- */
  {
    id: 'c_third_bond_1',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'xuehai',
    title: '血池',
    weight: 9,
    once: true,
    charLine: 'third',
    stage: 'bond',
    req: s => _affGE('third', 45)(s) && !s.charFlags?.third_bond && _notRefused('third')(s),
    text: s => {
      const nm = s.herName2;
      return `她带你去了血海魔宗的地宫深处。那里有一池血水，池边刻满了名字。

「这是我杀的。」她说，「一共一百三十七个。」

她指着最下面一个名字，很小：
「这是第一个。那年我七岁。我爹逼我杀的。」`;
    },
    choices: [
      {
        text: '「那不怪你。」',
        hint: '好感 +18 · 心性+8',
        charaff: { key: 'third', d: 18 },
        apply: s => { Characters.addAff(s, 'third', 18); s.xin += 8; s.charFlags.third_bond = true; s.log('她摇头：「我恨的不是我爹。我恨的是——我杀的时候，竟然不觉得害怕。」你握住了她的手。她没抽开。'); },
        cg: 'cg_third_pool',
      },
      {
        text: '把那第一个名字，用剑划掉',
        hint: '好感 +20 · 剑意+6',
        charaff: { key: 'third', d: 20 },
        apply: s => { Characters.addAff(s, 'third', 20); s.jian += 6; s.charFlags.third_bond = true; s.log('剑刃划过石壁。她看着那道划痕，忽然说：「你为什么……对我这么好。」你说：「因为你值得。」'); },
        cg: 'cg_third_pool',
      },
      {
        text: '「一百三十七个。记住他们，然后别再杀了。」',
        hint: '好感 +16 · 丹心+6',
        charaff: { key: 'third', d: 16 },
        apply: s => { Characters.addAff(s, 'third', 16); s.dan += 6; s.charFlags.third_bond = true; s.log('她看了很久那些名字，然后说：「好。听你的。」她说完自己愣了一下——她这辈子，从没跟谁说过「听你的」。'); },
      },
    ],
  },

  {
    id: 'c_third_bond_2',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'luori',
    title: '她学写字',
    weight: 8,
    once: true,
    charLine: 'third',
    stage: 'bond',
    req: s => _affGE('third', 55)(s) && !s.charFlags?.third_bond2 && _notRefused('third')(s),
    text: s => `她蹲在地上，用刀尖划着土，一笔一划，很慢。

「写字。」她说得理直气壮，「血海里没人教。」

地上的字歪歪扭扭，是「云」——你的名字里，头一个字。`,
    choices: [
      {
        text: '蹲下来，握着她的手，一笔一笔教',
        hint: '好感 +18 · 心性+6',
        charaff: { key: 'third', d: 18 },
        apply: s => { Characters.addAff(s, 'third', 18); s.xin += 6; s.charFlags.third_bond2 = true; s.log('她的手指很凉，握刀握惯了，握笔很僵。你说慢一点，她就慢一点。最后那个「云」字，写得还是歪的，但她说：「这个好。」'); },
        cg: 'cg_third_write',
      },
      {
        text: '「你写我的名字做什么。」',
        hint: '好感 +14 · 剧情',
        charaff: { key: 'third', d: 14 },
        apply: s => { Characters.addAff(s, 'third', 14); s.charFlags.third_bond2 = true; s.log('她脸一红，一脚把地上的字抹了：「练手。练手不行吗。」可第二天，那片土上，又写满了那个字。'); },
      },
      {
        text: '把你的名字，一个字一个字写给她看',
        hint: '好感 +16 · 悟性+4',
        charaff: { key: 'third', d: 16 },
        apply: s => { Characters.addAff(s, 'third', 16); s.wu += 4; s.charFlags.third_bond2 = true; s.log('你写了三遍。她看着看着，忽然说：「我也想有个名字。」你说：「我有。给你一半。」'); },
      },
    ],
  },

  /* ---- 阶段四 · 误会冲突 ---- */
  {
    id: 'c_third_rift_1',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'xuehai',
    title: '她父亲的条件',
    weight: 9,
    once: true,
    charLine: 'third',
    stage: 'rift',
    req: s => _affGE('third', 70)(s) && !s.charFlags?.third_rift && _notRefused('third')(s),
    text: s => `血海魔宗宗主召你入殿。

「你要我女儿，」他坐在血玉座上，「拿东西换。」

他伸出三根手指：
「第一，杀了你师父。第二，废了你自己的剑意。第三，替血海，屠一座天剑宗的分坛。三样，选一样。」`,
    choices: [
      {
        text: '「一样都不选。我带她走。」',
        hint: '好感 +12 · 剑意+8 · 冲突线',
        charaff: { key: 'third', d: 12 },
        apply: s => { Characters.addAff(s, 'third', 12); s.jian += 8; s.power += 20; s.charFlags.third_rift = true; s.charFlags.third_father_fight = true; s.log('你一掌劈了殿门。整个血海都惊动了。她冲进来拽你：「你傻啊，那是送死！」你说：「死也得走。」'); },
      },
      {
        text: '「废剑意。」',
        hint: '好感 +20 · 剑意重创 · 心性+8',
        charaff: { key: 'third', d: 20 },
        apply: s => { Characters.addAff(s, 'third', 20); s.jian = Math.floor(s.jian / 2); s.power = Math.floor(s.power * 0.7); s.xin += 8; s.charFlags.third_rift = true; s.charFlags.third_sacrifice = true; s.log('你抬手，自己废了一半剑意。她扑过来，跪在地上哭：「你为什么要这样。」你说：「因为你值。」'); },
        cg: 'cg_third_conflict',
      },
      {
        text: '「我选第三样。」（假意应下）',
        hint: '好感 −14 · 心性+6（决裂线 · 断此缘）',
        charaff: { key: 'third', d: -14 },
        // 第七轮：假意应下 = 决裂，关闭整条血海线
        apply: s => { Characters.addAff(s, 'third', -14); s.xin += 6; s.charFlags.third_rift = true; s.charFlags.third_fake = true; Characters.setRefused(s, 'third'); s.log('她冲进来，听见你说那句话。她愣在原地，没哭，只是转身走了。她想，你终于还是选了血海。'); },
      },
    ],
  },

  {
    id: 'c_third_rift_2',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '她坐上了宗主之位',
    weight: 8,
    once: true,
    charLine: 'third',
    stage: 'rift',
    req: s => _affGE('third', 70)(s) && !s.charFlags?.third_ascend_throne && _notRefused('third')(s),
    text: s => `血海魔宗换了主人。

她杀了她爹，坐上了那张血玉座。

外面都在传：新人宗主比她爹更狠，三个月里，屠了两个不服的堂口。

你去见她。她坐在座上，一身血衣，看见你，只说了一句：
「你来做什么。」`,
    choices: [
      {
        text: '「我来兑现我说过的话。」',
        hint: '好感 +18 · 和解前置',
        charaff: { key: 'third', d: 18 },
        apply: s => { Characters.addAff(s, 'third', 18); s.charFlags.third_ascend_throne = true; s.log('她从座上走下来，一步一步，走到你面前：「你要是骗我，我今天就杀了你。」你说：「好。」'); },
      },
      {
        text: '「这位置，你坐得开心吗。」',
        hint: '好感 +10 · 心性+6',
        charaff: { key: 'third', d: 10 },
        apply: s => { Characters.addAff(s, 'third', 10); s.xin += 6; s.charFlags.third_ascend_throne = true; s.log('她笑了：「不开心。」她顿了顿，「但我坐上了，就能不杀人。除了那两个。」'); },
      },
      {
        text: '转身就走，让她做她的宗主',
        hint: '好感 −16 · 决裂深化 · 断此缘',
        charaff: { key: 'third', d: -16 },
        // 第七轮：转身就走 = 决裂，关闭整条血海线
        apply: s => { Characters.addAff(s, 'third', -16); s.charFlags.third_ascend_throne = true; s.charFlags.third_broken = true; Characters.setRefused(s, 'third'); s.log('你走了。身后她没有留你。可那天夜里，血海的地宫，有人把池边「云」那个字，又划了一遍。'); },
      },
    ],
  },

  /* ---- 阶段五 · 和解 ---- */
  {
    id: 'c_third_reconcile_1',
    ageBand: ['prime', 'elder'],
    place: 'xuehai',
    title: '血池干了',
    weight: 10,
    once: true,
    charLine: 'third',
    stage: 'reconcile',
    req: s => _affGE('third', 78)(s) && !!s.charFlags?.third_ascend_throne && !s.charFlags?.third_recon && _notRefused('third')(s),
    text: s => `她把地宫的血池填了，填上土，种了花。

「你说过的，」她站在土前，「记住那些人，然后别再杀了。」

她转过头：
「我去查过了。一百三十七个里，有一个还活着。我把他送回去了。」`,
    choices: [
      {
        text: '「你做得比我好。」',
        hint: '好感 +22 · 心性+8 · 婚姻前置',
        charaff: { key: 'third', d: 22 },
        apply: s => { Characters.addAff(s, 'third', 22); s.xin += 8; s.charFlags.third_recon = true; s.charFlags.third_rift = false; s.charFlags.third_vow = true; s.log('她愣了一下，忽然别过脸去：「你别夸我。我一听好话，就想杀人。」可你看见，她的耳朵红了。'); },
        cg: 'cg_third_reconcile',
      },
      {
        text: '把第一朵花，悄悄种在她名字旁边',
        hint: '好感 +20 · 情感',
        charaff: { key: 'third', d: 20 },
        apply: s => { Characters.addAff(s, 'third', 20); s.charFlags.third_recon = true; s.charFlags.third_rift = false; s.log('你在花丛最边上，种了一朵小的。她后来发现了，蹲在那儿看了半天，没舍得拔。'); },
        cg: 'cg_third_reconcile',
      },
      {
        text: '「这些年，你一个人是怎么过来的。」',
        hint: '好感 +18 · 心性+10',
        charaff: { key: 'third', d: 18 },
        apply: s => { Characters.addAff(s, 'third', 18); s.xin += 10; s.charFlags.third_recon = true; s.charFlags.third_rift = false; s.log('她沉默了很久，然后说：「就这么过来的。」她顿了顿，「现在你问了，我就不算一个人了，对吧。」'); },
      },
    ],
  },

  {
    id: 'c_third_reconcile_2',
    ageBand: ['prime', 'elder'],
    place: 'luori',
    title: '落日原的婚礼',
    weight: 11,
    once: true,
    charLine: 'third',
    stage: 'reconcile',
    req: s => _affGE('third', 85)(s) && !!s.charFlags?.third_recon && !s.charFlags?.third_final && _notRefused('third')(s),
    text: s => `落日原上，落日如血。

她一身红衣（她只有红衣），站在荒草里，手里捏着那幅黄鹂。
「血海不许成亲。」她说，「所以我把血海，改成别的了。」

她把黄鹂画举起来，对着落日：
「现在可以了。」`,
    choices: [
      {
        text: '「那今天就是我们的日子。」',
        hint: '好感 +22 · 婚姻前置',
        charaff: { key: 'third', d: 22 },
        apply: s => { Characters.addAff(s, 'third', 22); s.charFlags.third_final = true; s.charFlags.third_married_ready = true; s.log('她把黄鹂画撕了——两半，一半塞给你。「这个，算信物。」她说，「你要是不认，我就把它贴满九洲。」'); if (s.flags && s.flags.go_home && s.flags.revenge_done !== true) s.log('（你心里还压着一封家书。婚事，怕是要往后放放了。）'); },
        cg: 'cg_third_wedding',
      },
      {
        text: '「血海改成什么了？」',
        hint: '好感 +18 · 悟性+6',
        charaff: { key: 'third', d: 18 },
        apply: s => { Characters.addAff(s, 'third', 18); s.wu += 6; s.charFlags.third_final = true; s.log('「叫『落叶』。」她说得很快，「落叶归根的落叶。」你笑了。她也笑了，那双血色的眼睛，第一次看着像落日。'); },
        cg: 'cg_third_wedding',
      },
      {
        text: '把那半幅画，折好收进怀里',
        hint: '好感 +20 · 心性+6',
        charaff: { key: 'third', d: 20 },
        apply: s => { Characters.addAff(s, 'third', 20); s.xin += 6; s.charFlags.third_final = true; s.charFlags.third_married_ready = true; s.log('你收好画，朝她伸出手。她犹豫了一下，把手放上来——那只握惯了刀的手，这次很轻。'); if (s.flags && s.flags.go_home && s.flags.revenge_done !== true) s.log('（你心里还压着一封家书。婚事，怕是要往后放放了。）'); },
        cg: 'cg_third_wedding',
      },
    ],
  },
];

window.CHAR_EVENTS = CHAR_EVENTS;
