/* ============================================================
   剑与丹 · 事件库
   每个事件：{ id, place, title, text, weight, once, req, choices[] }
   choice: { text, hint, apply(s), next, log, unlock }
   s = 玩家状态（可读写：gen/wu/ji/xin/jian/dan/shou/power/age/flags...）
   ============================================================ */

/* ---------- 叙事容器：动态文本生成 ---------- */
const T = {
  // 随机化名字，让每周目不同
  surnames: ['王', '李', '陈', '苏', '谢', '萧', '林', '顾', '沈', '叶', '白', '秦', '姜', '楚'],
  givenM: ['长风', '寒衣', '云深', '不归', '行舟', '听雪', '明烛', '青崖', '无咎', '拾安', '惊蛰', '了尘'],
  givenF: ['清欢', '见微', '若水', '素问', '昭昭', '半夏', '绾绾', '青荷', '照野', '知雪', '扶苏', '南枝'],
  rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  name(gender) {
    const g = gender === 'f' ? this.givenF : this.givenM;
    return this.rand(this.surnames) + this.rand(g);
  },
};

/* ---------- 事件库 ---------- */
const EVENTS = [

  /* ========== 第一幕：凡俗之身 ========== */
  {
    id: 'mortal_life',
    ageBand: 'any',
    place: 'qingshi',
    title: '青石镇的日子',
    weight: 10,
    once: true,
    req: s => s.age <= 16,
    text: s => `青石镇的清晨总带着米粥的味道。你今年${s.age}岁，帮家里劈柴、挑水，偶尔趴在私塾窗外偷听几句诗。

昨夜你又梦见一把剑——它就悬在梦里，剑身刻着看不清的字。醒来时掌心发烫，像握过什么。`,
    choices: [
      {
        text: '去镇口看那位老剑客舞剑',
        hint: '机缘·剑意',
        apply: s => { s.ji += 3; s.jian += 2; s.flags.met_oldsword = true; s.log('你蹲在墙根看了一整个下午。老剑客收剑时看了你一眼：「明天还来？」'); },
      },
      {
        text: '留在家里，跟母亲学认药草',
        hint: '丹心·心性',
        apply: s => { s.dan += 3; s.xin += 2; s.flags.met_herb = true; s.log('母亲教你辨甘草与黄连。你说苦，她笑：「苦过才知甜。」'); },
      },
      {
        text: '把梦里那把剑画下来',
        hint: '悟性',
        apply: s => { s.wu += 4; s.flags.dream_sword = true; s.log('你画了七天，画出的剑越来越像真的。邻居说这张画，看着扎眼睛。'); },
      },
    ],
  },

  {
    id: 'first_choice',
    ageBand: 'youth',
    place: 'qingshi',
    title: '命运叩门',
    weight: 12,
    once: true,
    req: s => s.age >= 14 && s.age <= 20,
    text: s => `镇上来了两个修士。一男一女，衣袂不沾尘。

「天剑宗收徒。」男修士把一块玉牌拍在墙上，「测出灵根，便可入我门下。」
「万丹阁也收。」女修士声音温和，「不测灵根，只问你肯不肯学。」

围观的人挤成一团。你站在人群里，忽然觉得这一刻，决定了往后很多年。`,
    choices: [
      {
        text: '伸手去测灵根，拜入天剑宗',
        hint: '剑道之门',
        apply: s => { s.faction = 'tianjian'; s.jian += 6; s.gen += 3; s.log('玉牌亮起微光。男修士挑眉：「还行。跟我走。」'); },
        unlock: 'first_step',
      },
      {
        text: '走向那位女修士，学丹道',
        hint: '丹道之门',
        apply: s => { s.faction = 'wandan'; s.dan += 6; s.wu += 3; s.log('女修士笑了：「丹修不显锋芒，却最救人。」'); },
        unlock: 'first_step',
      },
      {
        text: '两个都不选，我想自己走走',
        hint: '散修之路·高风险',
        apply: s => { s.flags.rogue = true; s.ji += 6; s.xin += 3; s.log('你转身走了。身后有人骂你蠢。多年后他们才知道，你走的是自己的路。'); },
        unlock: 'first_step',
      },
    ],
  },

  /* ========== 第二幕：入门与修行 ========== */
  {
    id: 'sword_recite',
    ageBand: 'any',
    place: 'jianfeng',
    title: '为什么剑修出招前要吟诗',
    weight: 9,
    once: true,
    req: s => s.faction === 'tianjian' || s.jian >= 8,
    text: s => `剑峰的清晨，你在崖边练剑。师父负手立于身后。

你终于忍不住问：「师父，你说为什么剑修出招前，必须说些什么？」

师父沉默片刻，望向云海：
「在心爱的姑娘面前出剑吟诗，多有风骨，多帅啊。」

他转过身，眼里有一点你看不懂的东西：「我当年，也是这么跟人说的一句话。可惜她没等到。」`,
    choices: [
      {
        text: '「那我以后，也要在心爱的人面前吟诗出剑」',
        hint: '情缘·剑意',
        apply: s => { s.jian += 5; s.flags.oath_poem = true; s.log('师父笑了，笑得有点旧：「好。记住你今天说的话。」'); },
      },
      {
        text: '「剑就是剑，何必多言」',
        hint: '心性·孤高',
        apply: s => { s.xin += 5; s.jian += 3; s.flags.cold_sword = true; s.log('师父摇头：「你这剑，太冷。冷剑伤己。」'); },
      },
      {
        text: '「师父，那个人是谁？」',
        hint: '剧情解锁',
        apply: s => { s.ji += 3; s.wu += 3; s.flags.know_master_past = true; s.log('师父看了你很久：「一个……我抢过婚的人。」他没有再说下去。'); },
      },
    ],
  },

  {
    id: 'jianfeng_test',
    once: true,
    place: 'jianfeng',
    title: '试剑台',
    weight: 8,
    req: s => s.faction === 'tianjian',
    text: s => `每三年一次试剑台。同门弟子登台较技，败者下台，胜者留名。

你的对手是${s.rivalName}，比你早入门两年，剑意凛冽。

台下有人喊：「那个新来的，别丢人！」`,
    choices: [
      {
        text: '拔剑，硬拼',
        hint: '需要剑意',
        apply: s => {
          if (s.jian >= 10) { s.power += 18; s.jian += 4; s.log(`你的剑比想象中快。${s.rivalName}退了半步，剑尖垂地。台下鸦雀无声。`); }
          else { s.power += 6; s.xin += 2; s.log(`你败了，但败得漂亮。${s.rivalName}收剑时说：「你以后会赢的。」`); }
        },
      },
      {
        text: '弃剑，以剑鞘胜之',
        hint: '悟性·高难',
        apply: s => {
          if (s.wu >= 15) { s.power += 26; s.wu += 4; s.flags.sheath_win = true; s.log('你未出剑，以鞘三招胜之。长老在台下站起来了。'); }
          else { s.power += 4; s.xin += 3; s.log('你输了，但没人笑你。有人小声说：「这人不简单。」'); }
        },
      },
      {
        text: '「我认输」',
        hint: '心性·藏拙',
        apply: s => { s.xin += 5; s.ji += 3; s.log('你转身下台。有人嗤笑，有人若有所思。师父在远处点了点头。'); },
      },
    ],
  },

  /* ========== 第三幕：情感线 · 初遇 ========== */
  {
    id: 'meet_her',
    ageBand: 'youth',
    place: 'danxia',
    title: '药香里的相遇',
    weight: 11,
    once: true,
    req: s => s.age >= 18 && !s.flags.met_her,
    text: s => `丹霞谷的药田边，你遇见了一个采药的姑娘。

她蹲在田垄间，衣袖沾了泥，手指却极稳地掐下花茎。她抬头看你，眉头一皱：
「你站我药苗上了。」

——那年她叫${s.herName}。多年后你回想，那一句「站我药苗上了」，是你听过最好的开场白。`,
    choices: [
      {
        text: '慌忙退开，帮她一起采药',
        hint: '好感++',
        apply: s => { s.affection += 12; s.flags.met_her = true; s.log(`${s.herName}看你手忙脚乱，忍不住笑了：「笨手笨脚，药都被你掐死了。」`); },
      },
      {
        text: '「你这药苗，品种不对」',
        hint: '需要丹心·才华线',
        apply: s => {
          s.flags.met_her = true;
          if (s.dan >= 8) { s.affection += 16; s.log(`${s.herName}一愣，随即眼睛亮了：「你懂丹道？」那天你们聊到日暮。`); }
          else { s.affection += 4; s.log(`${s.herName}斜你一眼：「你说得头头是道，种出来的药呢？」你哑口无言，她却笑了。`); }
        },
      },
      {
        text: '沉默地帮她浇了一整片药田',
        hint: '心性·沉默的温柔',
        apply: s => { s.affection += 14; s.xin += 3; s.flags.met_her = true; s.log(`你俩一句话没说，浇完了半亩药田。临走时她递给你一块饼：「明天还来吗？」`); },
      },
    ],
  },

  {
    id: 'her_night',
    ageBand: ['youth', 'prime'],
    place: 'danxia',
    title: '丹霞谷的雨夜',
    weight: 9,
    once: true,
    req: s => s.flags.met_her && s.affection >= 20 && !s.flags.her_secret,
    text: s => `夜半暴雨，丹炉的药被你熬糊了。你蹲在廊下发愁，${s.herName}抱着伞来找你。

「你炼的什么丹？」她问。
「回魂丹。」
她沉默了一下：「给谁？」
「我娘。她病了很多年。」

雨声很大。她忽然把自己的伞塞给你：
「你娘会好起来的。我给你看个好方子。」`,
    choices: [
      {
        text: '认真记下她的方子',
        hint: '丹心·好感++',
        apply: s => { s.dan += 8; s.affection += 15; s.flags.her_secret = true; s.flags.mother_treated = true; s.log(`她写了整整三页纸。你后来才知道，那是她师门的秘方，写着「不可外传」。`); },
      },
      {
        text: '「你为什么对我这么好？」',
        hint: '剧情·心动',
        apply: s => { s.affection += 12; s.xin += 3; s.flags.her_secret = true; s.log(`${s.herName}没答话，把伞往你这边又斜了一点。雨落在她肩上。`); },
      },
      {
        text: '「我自己来，你别管」',
        hint: '心性·推远',
        apply: s => { s.xin += 6; s.affection -= 6; s.log(`她愣了一下，转身走了。走到廊尽头又回头：「药在炉子里，别糊了。」`); },
      },
    ],
  },

  /* ========== 情感线 · 师姐 ========== */
  {
    id: 'senior_sister',
    ageBand: ['youth', 'prime'],
    place: 'jianfeng',
    title: '师姐的剑',
    weight: 7,
    once: true,
    req: s => s.faction === 'tianjian' && s.age >= 19 && !s.flags.has_sister,
    text: s => `天剑宗的师姐${s.sisterName}，是宗门里最冷的人。她从不与人同练，剑出必见血。

这日她却把你叫到后山：
「你剑意里有股执念。执念是好事，也是大凶。」
她把剑递给你：「接。接不住，这辈子别练剑了。」`,
    choices: [
      {
        text: '接住她的剑',
        hint: '剑意·韧性',
        apply: s => {
          s.flags.has_sister = true;
          if (s.jian >= 15) { s.jian += 8; s.power += 20; s.affection += 8; s.log('你接住了，虎口裂开，血滴在剑上。她第一次笑了：「还行。」'); }
          else { s.jian += 4; s.power += 8; s.xin += 4; s.log('你没接住，剑落在地上。她转身走了：「三年后再来。」'); }
        },
      },
      {
        text: '「师姐，你为什么这么在意我？」',
        hint: '剧情·情愫',
        apply: s => { s.flags.has_sister = true; s.affection += 10; s.log(`${s.sisterName}背对着你站了很久：「因为你像以前的一个人。那个人，我救不了。」`); },
      },
      {
        text: '不接，转身离开',
        hint: '心性·独行',
        apply: s => { s.xin += 6; s.flags.has_sister = true; s.log('她看着你的背影，没说话。剑插在原地，插了三年。'); },
      },
    ],
  },

  /* ========== 第四幕：历练与势力冲突 ========== */
  {
    id: 'wolf_pack',
    ageBand: 'any',
    once: true,
    place: 'luori',
    title: '落日原的狼群',
    weight: 8,
    req: s => s.power >= 30,
    text: s => `落日原的荒草比人高。你护送一队药材商穿过北境，入夜时狼群围了上来。

头狼的眼睛在黑暗里亮着。商队的老镖师说：「跑不了了。小伙子，你护着货，我断后。」

你没说话。你只是把手按在了剑柄上。`,
    choices: [
      {
        text: '独自冲入狼群',
        hint: '剑意·勇',
        apply: s => {
          if (s.jian >= 20) { s.power += 25; s.jian += 5; s.ji += 5; s.flags.saved_convoy = true; s.log('你一人一剑，斩了头狼。商队跪了一地，老镖师红着眼：「你叫什么名字？」'); }
          else { s.power += 10; s.shou -= 3; s.log('你杀了三头狼，被咬穿小臂。好在狼群退了。老镖师替你包扎，一句话没说。'); }
        },
      },
      {
        text: '结阵护货，稳中求胜',
        hint: '心性·稳',
        apply: s => { s.power += 14; s.xin += 4; s.flags.saved_convoy = true; s.log('你以剑划地为阵，护住所有人。天亮时狼群散去，货物一件未损。'); },
      },
      {
        text: '弃货，护人先走',
        hint: '丹心·仁',
        apply: s => { s.dan += 5; s.xin += 5; s.ji += 3; s.flags.saved_people = true; s.log('货丢了。你背着受伤的镖师跑了一夜。多年后他成了你的贵人。'); },
      },
    ],
  },

  {
    id: 'ancient_sword',
    ageBand: 'any',
    place: 'luori',
    title: '古剑冢',
    weight: 5,
    once: true,
    req: s => s.power >= 60 && s.ji >= 15,
    text: s => `你在落日原的地裂深处，发现了一座剑冢。

无数残剑插在土里，剑身缠着暗红的锈。最中央有一把断剑，剑柄上刻着半句诗：

「一剑霜寒——」

下面半句被人凿了去。你伸手去握，断剑忽然发出嗡鸣，像是等了你很多年。`,
    choices: [
      {
        text: '握住断剑',
        hint: '机缘·高风险',
        apply: s => {
          if (s.xin >= 20) { s.jian += 15; s.power += 40; s.flags.ancient_sword = true; s.log('断剑认你为主。你听见一个苍老的声音：「后半句，你自己补上。」'); }
          else { s.jian += 5; s.shou -= 10; s.xin -= 2; s.log('断剑的剑意冲入识海，你吐了口血。剑认了你，却也伤了你。'); }
        },
        unlock: 'sword_saint',
      },
      {
        text: '把断剑重新插回去，磕了三个头',
        hint: '心性·敬',
        apply: s => { s.xin += 8; s.ji += 8; s.wu += 4; s.log('你转身要走时，断剑自己震出了土，跟在你脚后。守冢的鬼影朝你鞠了一躬。'); },
      },
      {
        text: '记下诗句，不碰剑',
        hint: '悟性·稳',
        apply: s => { s.wu += 6; s.ji += 4; s.flags.poem_half = true; s.log('你只把那半句诗记在心里。多年后你才明白，后半句要用一生去补。'); },
      },
    ],
  },

  /* ========== 抢婚（核心情感事件） ========== */
  {
    id: 'forced_marriage',
    ageBand: ['youth', 'prime'],
    place: 'liuli',
    title: '她被迫嫁人',
    weight: 20,
    once: true,
    req: s => s.flags.met_her && s.affection >= 35 && s.age >= 22,
    text: s => `消息传来时，你正在闭关。

${s.herName}被家族许给了血海魔宗的一位少主——以联姻换一族平安。婚期定在三日后，琉璃城。

传话的人还说：「她自己答应的。她说，你别来。」

——可你知道她的性子。她说「别来」，就是「你千万要来」。`,
    choices: [
      {
        text: '即刻动身，抢婚',
        hint: '⚔ 核心抉择',
        apply: s => {
          s.flags.raid_wedding = true;
          s.log('你抓了把剑就出了关，连山门都没回。有人拦你，你说：「让开。」');
        },
        next: 'raid_wedding_scene',
      },
      {
        text: '先查清缘由，三日后再定',
        hint: '悟性·稳',
        apply: s => { s.wu += 4; s.flags.raid_wedding_delay = true; s.log('你冷静下来，先去查了她的家族和血海魔宗的底细。你知道了一些不该知道的事。'); },
        next: 'raid_wedding_scene',
      },
      {
        text: '不去。这是她的选择',
        hint: '心性·痛',
        apply: s => { s.xin += 8; s.affection -= 25; s.flags.lost_her = true; s.log('你把自己关在洞里，练了三天剑。第三天夜里，剑折了。'); },
      },
    ],
  },

  {
    id: 'raid_wedding_scene',
    place: 'liuli',
    title: '王从天降',
    weight: 30,
    once: true,
    req: s => s.flags.raid_wedding || s.flags.raid_wedding_delay,
    text: s => `琉璃城的婚堂上，红绸满殿。两家门派的长老坐了一堂，宾客上百。

门被推开时，所有人都回过了头。

你一身风尘，剑未出鞘：
「那个姓王的废物剑修——怎么敢来跟两个门派抢婚？」

话音未落，殿外天色骤暗。你抬手，剑光如白虹贯日。

${s.herName}在堂上站了起来，眼睛红了。她没喊，只是无声地说了两个字：**你快走**。`,
    choices: [
      {
        text: '剑指婚堂，一人战两派',
        hint: '需要剑意·极端勇',
        apply: s => {
          if (s.jian >= 30) {
            s.power += 50; s.jian += 10; s.affection += 30; s.flags.won_raid = true;
            s.log('你的剑快得没了形状。两派长老齐齐退了一步。你伸手：「走。」她的手，比剑还稳。');
          } else {
            s.power += 15; s.shou -= 15; s.affection += 25; s.flags.won_raid = true;
            s.log('你受了重伤，但你还是冲到了她面前。她拽着你撞破窗，跳了下去。血流了一路，她哭着笑：「傻子。」');
          }
        },
        unlock: 'save_her',
      },
      {
        text: '不战，只唤她名字',
        hint: '情感·纯粹',
        apply: s => {
          s.affection += 35; s.xin += 5; s.flags.won_raid = true;
          s.log(`你站在殿中央，把剑放下了。你只喊了一声她的名字。满堂寂静，她提着嫁衣跑向你。两个门派的长老，谁也没拦。`);
        },
        unlock: 'save_her',
      },
      {
        text: '吟出那句诗，再出剑',
        hint: '📜 剑与诗·风骨',
        apply: s => {
          s.power += 45; s.jian += 12; s.affection += 40; s.flags.won_raid = true; s.flags.recite_raid = true;
          s.log('你朗声吟道：「一剑霜寒十四州。」剑随诗出，红绸尽裂。她怔怔看你，忽然笑了——那是她第一次，看你像看一个凡人。');
        },
        unlock: 'save_her', recite: true,
      },
      {
        text: '「我今日带不走你，但我记住了这笔账」',
        hint: '心性·忍',
        apply: s => { s.xin += 10; s.ji += 5; s.flags.raid_revenge = true; s.log('你转身走了。背后是满堂笑声。你把那笑声，一个字一个字刻进了骨头里。'); },
      },
    ],
  },

  /* ========== 复仇 ========== */
  {
    id: 'family_crisis',
    ageBand: ['youth', 'prime'],
    place: 'guoshi',
    title: '家书',
    weight: 12,
    once: true,
    req: s => s.age >= 24 && s.power >= 40,
    text: s => `一封家书追了你三个月，终于递到你手里。

信上只有四行字，是邻家老先生代笔的：
「你爹被人打了，腿断。你娘气得吐血。打人的说是血海魔宗的外门弟子些人，为的是你家那块祖地。」

信末又添了一句：「你娘说，让你别回来。她说，别误了你的仙途。」`,
    choices: [
      {
        text: '立刻回故里',
        hint: '⚔ 冲突升级',
        apply: s => { s.flags.go_home = true; s.log('你连夜赶回青石镇。推开门时，你娘正在给你爹换药，抬头看见你，眼泪就下来了。'); },
        next: 'revenge_scene',
      },
      {
        text: '先传讯给同门，再动身',
        hint: '心性·稳',
        apply: s => { s.ji += 5; s.xin += 4; s.flags.go_home = true; s.flags.with_allies = true; s.log('你把事情捅到了宗门。有几位同门愿意随你走一趟。'); },
        next: 'revenge_scene',
      },
      {
        text: '不回。修仙之人，怎能被俗世牵绊',
        hint: '心性·大凶',
        apply: s => { s.xin -= 15; s.flags.abandon_family = true; s.log('你撕了信。当晚，你的心魔第一次在你识海里说话了。'); },
      },
    ],
  },

  {
    id: 'revenge_scene',
    place: 'guoshi',
    title: '雪耻',
    weight: 30,
    once: true,
    req: s => s.flags.go_home,
    text: s => `血海魔宗的外门弟子些人等在村口，一共七个人。为首的那个，正坐在你家门槛上吃你家的梨。

他看见你，笑了：
「哟，这就是那个修仙的？回来啦？」他把梨核扔向你，「你爹的腿是我打断的。怎么样，你要不要也试试？」

你爹拄着拐杖从屋里出来，喊你：「儿啊，别冲动——」`,
    choices: [
      {
        text: '拔剑，一个不留',
        hint: '需要剑意·杀戮',
        apply: s => {
          if (s.jian >= 35) {
            s.power += 60; s.jian += 8; s.xin -= 5; s.flags.revenge_done = true; s.flags.killed_all = true;
            s.log('七个人，七剑。你收剑时衣上未沾血。你爹在你身后，站了很久，说了句：「……回家吃饭。」');
          } else {
            s.power += 20; s.shou -= 10; s.flags.revenge_done = true;
            s.log('你杀了四个，被围住。是邻居和同门救了你。你躺在血里，望着天，忽然笑了。');
          }
        },
        unlock: 'avenge',
      },
      {
        text: '先护家人离开，再回头清算',
        hint: '丹心·仁·稳',
        apply: s => {
          s.power += 35; s.xin += 6; s.dan += 4; s.flags.revenge_done = true; s.flags.family_safe = true;
          s.log('你把爹娘送到邻村，回来时七个人还在。这一夜之后，村口那棵老槐树下多了一座新坟。');
        },
        unlock: 'avenge',
      },
      {
        text: '跪下来，磕头求他们放过家人',
        hint: '心性·屈辱·后续大剧情',
        apply: s => {
          s.xin += 8; s.flags.kneel = true; s.flags.revenge_done = false;
          s.log('你跪了。膝盖沾了泥。他们大笑而去。你娘抱着你哭。你从那一刻起，再也没笑过。');
        },
      },
      {
        text: '「你敢打我爹？我今儿就让你看看什么叫剑修」',
        hint: '⚔ 吟诗·爆发',
        apply: s => {
          s.power += 55; s.jian += 10; s.flags.revenge_done = true; s.flags.recite_revenge = true; s.xin -= 3;
          s.log('你出剑前，只是念了一句：「慈母手中线，游子身上衣。」然后七颗人头落地。这句诗，他们临死都没听懂。');
        },
        unlock: 'avenge', recite: true,
      },
    ],
  },

  /* ========== 成丹 / 修为事件 ========== */
  {
    id: 'dan_gather',
    ageBand: 'any',
    once: true,
    place: 'danxia',
    title: '炼丹',
    weight: 7,
    req: s => (s.faction === 'wandan' || s.dan >= 6),
    text: s => `丹炉燃了三天三夜。你盯着炉火，汗从额角滑下来。

药性到了临界点，再差一分就要炸炉。你伸手探入炉中——`,
    choices: [
      {
        text: '以心血为引，强行成丹',
        hint: '丹心·高风险',
        apply: s => {
          if (s.dan >= 15) { s.dan += 10; s.power += 22; s.flags.blood_pill = true; s.log('九品「续命丹」成。丹香整谷可闻。你吐出的一口血，是值得的。'); }
          else { s.dan += 4; s.shou -= 6; s.log('丹成了，只是寻常货色。你亏了口血。师父说：「急了大忌。」'); }
        },
      },
      {
        text: '收火，再等一炷香',
        hint: '心性·稳',
        apply: s => { s.dan += 7; s.xin += 4; s.power += 14; s.log('你没有急。丹成时品相极好。师父说：「这才是丹修的样子。」'); },
      },
      {
        text: '把炉子掀了，重新配药',
        hint: '悟性·大改',
        apply: s => { s.wu += 6; s.dan += 5; s.ji += 3; s.log('你重配了方子，炼出一炉从未见过的丹。没人知道那是什么，但闻着就让人心安。'); },
      },
    ],
  },

  {
    id: 'danxia_plague',
    place: 'danxia',
    title: '瘟疫',
    weight: 6,
    once: true,
    req: s => s.dan >= 12,
    text: s => `南疆瘟疫，凡人与低阶修士死了上千。万丹阁的丹炉全开，药还差一味「雪绫花」，只在北境绝壁。

阁主问你：「去，还是不去？去了，你可能会死。」`,
    choices: [
      {
        text: '去北境采雪绫花',
        hint: '丹心·济世',
        apply: s => {
          s.dan += 12; s.xin += 6; s.shou -= 8; s.flags.saved_plague = true;
          s.log('你在绝壁上挂了三天，采回七株。瘟疫止住了。有人给你立了长生牌位。');
        },
      },
      {
        text: '留在阁中，研究替代方子',
        hint: '悟性·巧',
        apply: s => { s.wu += 8; s.dan += 8; s.flags.saved_plague = true; s.log('你以苦参替了雪绫花，药效差些，但救的人更多。阁主说：「你比雪绫花可贵。」'); },
      },
      {
        text: '这不是我的事',
        hint: '心性·冷',
        apply: s => { s.xin += 5; s.ji -= 3; s.log('你转身走了。后来你听说，那场瘟疫死了三千人。其中一个，是你的旧识。'); },
      },
    ],
  },

  /* ========== 南疆拍卖 & 救人 ========== */
  {
    id: 'save_girl',
    ageBand: ['youth', 'prime'],
    once: true,
    place: 'liuli',
    title: '拍卖场的奴隶',
    weight: 6,
    req: s => s.age >= 20,
    text: s => `万宝商会的拍卖会上，压轴的不是法宝，是一个少女。

她被关在灵力笼里，脖颈挂着奴环，眼睛却极亮，直勾勾看着台下的每一个人，像在挑。

主持人喊价：「底价，八百灵石。」

你摸了摸自己的储物袋——里面有七百五十。`,
    choices: [
      {
        text: '倾家荡产，买下她',
        hint: '消耗灵石·剧情',
        apply: s => { s.flags.bought_slave = true; s.affection += 8; s.log('你凑了七百五十，又押了本命剑。她被放出来时，只对你说了一句：「我记你的账。」后来她成了你最锋利的剑。'); },
      },
      {
        text: '劫场，直接抢人',
        hint: '剑意·乱来',
        apply: s => {
          if (s.jian >= 25) { s.power += 30; s.flags.slave_free = true; s.flags.wanted = true; s.log('你一剑劈了灵力笼。全场大乱。你被万宝商会通缉了，但那少女跟着你跑了。'); }
          else { s.shou -= 10; s.flags.wanted = true; s.log('你没抢成，被打了一顿，还被通缉了。少女在笼里看着你，轻轻摇头。'); }
        },
      },
      {
        text: '转身离开',
        hint: '心性·现实',
        apply: s => { s.xin += 4; s.ji -= 2; s.log('你走了。身后传来落槌声。很多年后，你还会梦见那双眼睛。'); },
      },
    ],
  },

  /* ========== 忘川渡 · 神秘 ========== */
  {
    id: 'memory_trade',
    ageBand: ['youth', 'prime'],
    place: 'wangchuan',
    title: '忘川渡',
    weight: 5,
    once: true,
    req: s => s.age >= 25 && (s.flags.know_master_past || s.flags.lost_her || s.flags.kneel || s.affection >= 40 || s.flags.forgot_pain),
    text: s => `渡口雾大。一叶小舟漂在河上，船夫戴着斗笠：

「过河吗？不收钱，只收你一段记忆。」

你问：「什么记忆都行？」
「什么记忆都行。」船夫顿了顿，「不过过得河去的人，多半会后悔。」`,
    choices: [
      {
        text: '渡河（交出最痛的记忆）',
        hint: '剧情·代价',
        apply: s => { s.xin += 8; s.flags.crossed_river = true; s.flags.forgot_pain = true; s.log('你渡了河。上岸时，你忘了自己为什么难过。那种轻松，让你有点害怕。'); },
      },
      {
        text: '渡河（交出最快乐的记忆）',
        hint: '剧情·代价',
        apply: s => { s.ji += 10; s.flags.crossed_river = true; s.flags.forgot_joy = true; s.log('你渡了河。上岸后，你无论如何都想不起来，她笑起来的样子。你站在岸边，愣了很久。'); },
      },
      {
        text: '不上船',
        hint: '心性·守',
        apply: s => { s.xin += 6; s.wu += 3; s.log('你在渡口立了一夜，第二天转身走了。船夫的斗笠下，传来一声叹息。'); },
      },
    ],
  },

  /* ========== 回到过去（核心高概念） ========== */
  {
    id: 'back_to_past',
    ageBand: ['prime', 'elder'],
    place: 'jiuxiao',
    title: '你为什么还要回去',
    weight: 12,
    once: true,
    // 只有真正站到高处、且心中有执念的人，才会被问到这个问题
    req: s => s.power >= 700 && s.age >= 70 && (s.flags.lost_her || s.affection >= 60 || s.flags.abandon_family || s.flags.kneel),
    text: s => `你已跻身天下前列。九霄雷泽之上，有人拦住了你。

那人须发皆白，看着你，忽然开口：
「大人，你已经跻身天下第一了，为何仍要执意回到过去？且不说回去后，你的肉体连一天不到便会消散。」

你望着雷云，很久没有说话。

你想起了${s.herName ? s.herName : '那一年'}，想起了那些你没能护住的人，想起了那句你始终没说完的诗。`,
    choices: [
      {
        text: '「我只是想再看她一眼。」',
        hint: '⏳ 回到过去线',
        apply: s => { s.flags.return_past = true; s.xin += 5; s.log('老者沉默了。雷霆为你开了一条路。你知道自己会死，可你笑得很轻。'); },
        unlock: 'return_past',
      },
      {
        text: '「有些事，我非改不可。」',
        hint: '⏳ 回到过去线·执念',
        apply: s => { s.flags.return_past = true; s.jian += 5; s.log('你一步踏入雷云。天地倒转，你听见自己的骨血在鸣响。'); },
        unlock: 'return_past',
      },
      {
        text: '「算了。已经是这样了。」',
        hint: '心性·放下',
        apply: s => { s.xin += 12; s.wu += 5; s.log('你转身走了。九霄之上，你忽然觉得，雷霆声很好听。'); },
      },
    ],
  },

  /* ========== 天劫 ========== */
  {
    id: 'tribulation',
    ageBand: ['prime', 'elder'],
    place: 'jiuxiao',
    title: '天劫将至',
    weight: 15,
    once: true,
    req: s => s.power >= 600,
    text: s => `你的天劫来了。

九霄雷泽的雷云压得极低，紫电如龙。你站在雷泽中央，衣袂猎猎。

第一道劫雷落下前，你回头看了一眼来路。

${s.herName && s.affection >= 50 ? `${s.herName}站在远处，没有靠近。她知道，这时候靠近，只会害了你。她只是把一只手按在胸口。` : '你来路上，空无一人。'}`,
    choices: [
      {
        text: '以剑迎劫',
        hint: '需要极高剑意',
        apply: s => {
          if (s.jian >= 60 && s.xin >= 30) { s.power += 700; s.flags.tribulation_win = true; s.log('你以剑意斩开了第一道劫雷。天地都静了一瞬。'); }
          else { s.shou -= 30; s.flags.tribulation_hurt = true; s.log('你硬扛了九道劫雷，肉身尽毁。你活了下来，但只活下来一口气。'); }
        },
        unlock: 'sword_saint',
      },
      {
        text: '以丹护身，徐徐渡劫',
        hint: '需要丹心',
        apply: s => {
          if (s.dan >= 40) { s.power += 650; s.flags.tribulation_win = true; s.log('你服下三枚续命丹，硬扛九劫。渡完劫，你的丹心反而更亮了。'); }
          else { s.shou -= 25; s.log('没有足够的丹。你被劫雷劈中，勉强活着。'); }
        },
      },
      {
        text: '放弃渡劫，散尽修为保命',
        hint: '心性·退',
        apply: s => { s.power = Math.floor(s.power * 0.4); s.xin += 15; s.log('你散了三成修为，从雷泽走了出来。有人说你怂，你笑了。活着，才能讲故事。'); },
      },
    ],
  },

  /* ========== 归隐 / 结局触发 ========== */
  {
    id: 'return_home',
    ageBand: ['prime', 'elder'],
    once: true,
    place: 'guoshi',
    title: '故里',
    weight: 9,
    req: s => s.age >= 40 && s.flags.revenge_done,
    text: s => `你回了青石镇。巷子还是老样子，只是墙根的老槐树更粗了。

你推门，门锁着。邻居说，你爹娘三年前就搬走了，去了你小时候常去的那个山村。

你站在门口，忽然很想知道：如果他们当年不让你修仙，你现在会不会正坐在院子里，听他们唠叨。`,
    choices: [
      {
        text: '去山村找他们',
        hint: '情感·团聚',
        apply: s => { s.xin += 10; s.affection += 8; s.flags.family_reunited = true; s.log('你找到他们时，你娘正在晒被子。她看见你，手一抖，被子掉在地上。她骂你：「你还知道回来。」然后哭了。'); },
      },
      {
        text: '留下一封信，转身离开',
        hint: '心性·独',
        apply: s => { s.xin += 6; s.ji += 4; s.log('你在门上留了信，说你好，说你走了。其实你就蹲在巷口，看着他们三个时辰。'); },
      },
      {
        text: '把屋子重新修好',
        hint: '情感·陪伴',
        apply: s => { s.xin += 8; s.affection += 10; s.flags.rebuilt_home = true; if (s.herName) s.log(`你一个人修了七天。第八天，${s.herName}来了，挽起袖子，什么也没问，跟你一起修。`); },
      },
    ],
  },

  {
    id: 'hermit_choice',
    ageBand: ['prime', 'elder'],
    once: true,
    place: 'guoshi',
    title: '山中无岁月',
    weight: 10,
    req: s => s.age >= 120 && s.power >= 400 && s.affection >= 60 && (s.flags.won_raid || s.flags.family_reunited || s.flags.met_her),
    text: s => `${s.herName}坐在屋檐下，看你练剑。看了很久，她忽然问：

「你就打算这么练到死？」

你没停手：「不然呢。」

「我是说，」她看着远处的山，「你要不要，跟我去一个没人找得到的地方？」`,
    choices: [
      {
        text: '「好。」',
        hint: '🏔 归隐结局',
        apply: s => { s.flags.hermit = true; s.affection += 15; s.log('你收了剑。从此山中无岁月，只有院子里的栀子花，一年比一年开得好。'); },
        unlock: 'hermit',
      },
      {
        text: '「再看几年吧。我还有事没了。」',
        hint: '心性·继续',
        apply: s => { s.ji += 5; s.xin += 3; s.affection -= 5; s.log('她点点头，没再说什么。那年冬天，她一个人下了山，再没回来。'); },
      },
    ],
  },

  /* ========== 归凡线（新增）：主动散尽修为，做回凡人 ==========
     解锁条件：修为已至一定境界（power≥500）且身边有人（任一角色好感≥45）
     链式：mortal_return_1（抉择）→ 视选择进入 mortal_return_2（散功仪式）
     结局判定：flags.return_mortal = true 时，judgeEnding 优先给出 return_mortal_* 系列
     兼容性：新事件、新 flag，均不影响旧存档；req 不满足时事件根本不进池。 */
  {
    id: 'mortal_return_1',
    ageBand: ['prime', 'elder'],
    once: true,
    place: 'any',
    title: '一步之遥',
    weight: 8,
    // 修为足够高、且有羁绊之人时才有可能想到「归凡」
    req: s => s.power >= 500 && s.age >= 60 &&
      (Math.max(s.affection || 0, s.affection_sister || 0, s.affection_third || 0) >= 45),
    text: s => {
      const who = (typeof bestCharacter === 'function' && bestCharacter(s))
        ? (s[bestCharacter(s).nameField] || '她') : '她';
      return `你在山口停了脚。

再往前，是九霄之上的路；回头，是人间。

${who}站在你身后，没催你，也没拦你。她只是问了一句：

「你修了这么多年，到底想要什么？」`;
    },
    choices: [
      {
        text: '「我想要的不在云上，在她身边。」',
        hint: '归凡·放弃仙途',
        apply: s => {
          s.flags.want_return_mortal = true;
          const c = (typeof bestCharacter === 'function') ? bestCharacter(s) : null;
          if (c) s.flags.return_mortal_target = c.key;
          s.log('你说完这句话，忽然觉得心里那块一直悬着的石头落了地。');
        },
        cg: 'cg_end_return_alone',
        next: 'mortal_return_2',
      },
      {
        text: '「我想要一个答案，哪怕答不出。」',
        hint: '心性·继续求道',
        apply: s => { s.xin += 8; s.power += 30; s.flags.refused_mortal = true; s.log('她笑了笑，说：那你去吧。我在这儿等你回来——如果你还记得回来的路。'); },
      },
      {
        text: '沉默。你也不知道。',
        hint: '机缘·随缘',
        apply: s => { s.ji += 6; s.xin += 3; s.log('你们站到天黑。最后是你先走了，却分不清是上山，还是下山。'); },
      },
    ],
  },

  {
    id: 'mortal_return_2',
    ageBand: 'any',
    once: true,
    place: 'any',
    title: '散功',
    weight: 10,
    req: s => !!s.flags.want_return_mortal,
    text: s => {
      const c = (typeof bestCharacter === 'function') ? bestCharacter(s) : null;
      const who = c ? (s[c.nameField] || '她') : '她';
      return `散功不是一件容易的事。

你要把丹田里那口温养了百年的气，一点点放干净。放的时候很疼，像把长在自己身上的东西生生拔掉。

${who}握着你的手，手心全是汗。

「疼就松手，」她说，「我数三下。」

你摇头：「不松。松了就前功尽弃了。」`;
    },
    choices: [
      {
        text: '散尽修为，做一个凡人',
        hint: '归凡线结局',
        apply: s => {
          s.flags.return_mortal = true;
          s.power = Math.max(0, Math.floor(s.power * 0.02));
          s.jian = Math.max(0, s.jian - 60);
          s.dan = Math.max(0, s.dan - 40);
          s.shou = Math.max(s.shou, 30);           // 凡人寿数重新起步
          const c = (typeof bestCharacter === 'function') ? bestCharacter(s) : null;
          if (c) s.flags.return_mortal_target = c.key;
          s.log('最后一口暖气散尽时，你眼前黑了一瞬。再睁眼，天还是那个天，山还是那座山——只是你，终于是个凡人了。');
        },
        unlock: 'return_mortal',
      },
      {
        text: '散到一半，反悔了',
        hint: '心性·回头',
        apply: s => {
          s.flags.want_return_mortal = false;
          s.xin -= 6;
          s.power -= 60;
          s.log('你在最后一刻收住了气。她松开手，退后一步，什么也没说。你知道，有些门推开又关上，就再难推第二次了。');
        },
      },
    ],
  },

  /* ========== 通用修炼事件（可重复） ========== */
  {
    id: 'daily_cultivate',
    ageBand: 'any',
    repeat: true,   // 日常事件：周目内可重复触发
    place: 'any',
    title: '闭关',
    weight: 4,
    text: s => `你闭关了三年。

三年里，你只听自己的心跳，和剑在鞘中细微的摩擦声。`,
    choices: [
      {
        text: '专修剑意',
        hint: '剑意++',
        apply: s => { s.jian += 6; s.power += 8 + Math.floor(s.gen / 3); s.age += 3; s.log('出关那天，你的剑快了。你说不清快了多少，只觉得风都慢了。'); },
      },
      {
        text: '专修丹心',
        hint: '丹心++',
        apply: s => { s.dan += 6; s.power += 6 + Math.floor(s.wu / 3); s.age += 3; s.log('你炼出一炉不知名的丹。服下后，血脉里像是过了一阵春风。'); },
      },
      {
        text: '打磨道心',
        hint: '心性++',
        apply: s => { s.xin += 7; s.wu += 3; s.age += 3; s.power += 5; s.log('你什么都没做成。但你心里，第一次安静下来了。'); },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第一批：少年期（12–20 岁）
     覆盖：初见仙途 / 世俗牵绊 / 天赋觉醒，稀有度偏低
     ========================================================= */

  {
    id: 'child_sick',
    ageBand: 'any',
    place: 'qingshi',
    title: '一场大病',
    weight: 8,
    once: true,
    req: s => s.age >= 12 && s.age <= 16,
    text: s => `你病了一场，烧了七天七夜。

郎中说熬不过去就是命。夜里你梦见自己走在一片白雾里，雾中有个背影，像是你，又不像是你。

你想喊，喊不出声。醒来时，枕边一片湿。`,
    choices: [
      {
        text: '咬牙撑过去',
        hint: '根骨·意志',
        apply: s => { s.gen += 4; s.xin += 3; s.shou -= 2; s.log('你撑过来了。郎中说：「这孩子，骨头比看着硬。」'); },
      },
      {
        text: '在梦里追那个背影',
        hint: '悟性·机缘',
        apply: s => { s.wu += 4; s.ji += 2; s.flags.dream_follow = true; s.log('你在雾里跑了很久，最后抓住了一片衣袖的角。醒来时，掌心有一道浅浅的剑痕。'); },
      },
      {
        text: '把梦告诉母亲',
        hint: '心性·亲情',
        apply: s => { s.xin += 4; s.log('母亲听完，沉默很久，摸了摸你的头：「那是你外公。他也是个练剑的。」'); },
      },
    ],
  },

  {
    id: 'village_bully',
    ageBand: 'youth',
    place: 'qingshi',
    title: '镇上的恶少',
    weight: 8,
    once: true,
    req: s => s.age >= 13 && s.age <= 18,
    text: s => `镇东的恶少带着几个人堵住了巷口，抢了你替人挑水挣的两文钱。

他踢翻你的水桶，笑：「小杂种，你那点出息，一辈子也就挑水了。」

你的手，不知什么时候攥紧了。`,
    choices: [
      {
        text: '扑上去，跟他打',
        hint: '心性·血性',
        apply: s => { s.xin += 4; s.jian += 2; s.shou -= 2; s.log('你挨了顿打，也揍了他两拳。回家路上，你忽然不觉得疼了。'); },
      },
      {
        text: '记住他的脸，转身走开',
        hint: '心性·隐忍',
        apply: s => { s.xin += 6; s.wu += 2; s.flags.remember_face = true; s.log('你把那张脸记了很多年。多年后你真见到了他——他已经不认得你了。'); },
      },
      {
        text: '捡起水桶，一言不发',
        hint: '心性·铁',
        apply: s => { s.xin += 5; s.gen += 3; s.log('你挑起水，走得很稳。从那天起，你每天多挑两担水。'); },
      },
    ],
  },

  {
    id: 'old_sword_gift',
    ageBand: ['youth', 'prime'],
    place: 'qingshi',
    title: '老剑客的断剑',
    weight: 6,
    once: true,
    req: s => s.flags.met_oldsword && s.age >= 14 && s.age <= 20,
    text: s => `老剑客要走了。他把你叫到院中，从门后取出一把断了半截的剑。

「这剑跟了我四十年。断的那天，我杀心就没了。」
他把剑横着递过来：
「要不要？不要我就扔井里了。」`,
    choices: [
      {
        text: '跪下，双手接过',
        hint: '剑意·传承',
        apply: s => { s.jian += 6; s.xin += 3; s.flags.old_sword = true; s.log('你接了剑。老剑客转身进屋，背影像是轻了一截。'); },
      },
      {
        text: '「这剑为什么会断？」',
        hint: '悟性·追问',
        apply: s => { s.wu += 5; s.jian += 3; s.flags.old_sword_why = true; s.log('老剑客笑了：「因为我那天没沉住气。记住——剑够快，不如心够稳。」'); },
      },
      {
        text: '「我不要。我要自己打一把新的。」',
        hint: '心性·傲骨',
        apply: s => { s.xin += 6; s.jian += 4; s.log('老剑客愣了一下，随即大笑：「好！这句话，比我那把剑值钱。」'); },
      },
    ],
  },

  {
    id: 'herb_field_save',
    ageBand: ['youth', 'prime'],
    place: 'qingshi',
    title: '救了一个人',
    weight: 7,
    once: true,
    req: s => s.flags.met_herb && s.age >= 14 && s.age <= 20,
    text: s => `你在后山采药，遇见一个倒在山道上的人。他气息微弱，腿上有道很深的伤口，还在渗血。

他腰间挂着半片玉，玉上有云纹——是修士的标记。`,
    choices: [
      {
        text: '用母亲教的草药替他止血',
        hint: '丹心·善',
        apply: s => { s.dan += 5; s.ji += 3; s.flags.saved_cultivator = true; s.log('他醒来后看了你很久，把半片玉塞给你：「来天剑宗，报我的名字。」'); },
      },
      {
        text: '背他下山求医',
        hint: '心性·苦',
        apply: s => { s.xin += 5; s.gen += 2; s.ji += 2; s.flags.saved_cultivator = true; s.log('你背着他走了二十里。他醒来第一句话是：「你叫什么？」'); },
      },
      {
        text: '看看四周，悄悄走开',
        hint: '心性·冷·隐患',
        apply: s => { s.xin -= 3; s.ji -= 2; s.flags.left_cultivator = true; s.log('你走了。走出很远，还能听见山道上的呻吟声。那声音跟了你很多年。'); },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第二批：初入仙门（20–35 岁）
     覆盖：宗门日常 / 术法学习 / 同门关系，稀有度中等
     ========================================================= */

  {
    id: 'outer_disciple',
    ageBand: 'youth',
    place: 'jianfeng',
    title: '外门的第一课',
    weight: 9,
    once: true,
    req: s => s.faction === 'tianjian' && s.age >= 20 && s.age <= 30,
    text: s => `天剑宗外门弟子第一课，不在练剑，而在扫地。

「先扫三年地，再谈剑法。」管事师兄说这话时，眼皮都没抬。

同来的弟子有人当场就把扫帚摔了。`,
    choices: [
      {
        text: '老老实实扫，扫满三年',
        hint: '心性·筑基',
        apply: s => { s.xin += 7; s.gen += 4; s.power += 10; s.log('三年后你放下扫帚。管事师兄第一次正眼看你：「你比他们多懂了一件事。」'); },
      },
      {
        text: '扫地的同时，看别人怎么练剑',
        hint: '悟性·偷学',
        apply: s => { s.wu += 6; s.jian += 5; s.power += 14; s.log('你一边扫一边记。三年下来，你会的剑比很多内门弟子都多。'); },
      },
      {
        text: '「我不是来扫地的」——去找长老',
        hint: '心性·锋芒',
        apply: s => {
          if (s.jian >= 12) { s.jian += 6; s.power += 18; s.log('你一路打到长老院门口。长老看了你三招，说：「行，你不用扫了。」'); }
          else { s.xin += 3; s.shou -= 3; s.log('你被罚跪了三天。第四天，你还是回去扫地了。'); }
        },
      },
    ],
  },

  {
    id: 'sword_style_choice',
    ageBand: 'youth',
    place: 'jianfeng',
    title: '三本剑谱',
    weight: 8,
    once: true,
    req: s => (s.faction === 'tianjian' || s.jian >= 15) && s.age >= 22,
    text: s => `藏经阁的三本剑谱摆在案上：

一本《疾风快剑》，讲快；一本《重渊剑典》，讲沉；一本《无锋》，翻开只有三个字：「无心则锋。」

管事说：「只能挑一本。」`,
    choices: [
      {
        text: '选《疾风快剑》',
        hint: '剑意·快',
        apply: s => { s.jian += 8; s.power += 16; s.flags.style_fast = true; s.log('你的剑从此快得只看得见残影。有人说你像一阵风，也有人说你像个疯子。'); },
      },
      {
        text: '选《重渊剑典》',
        hint: '剑意·沉',
        apply: s => { s.jian += 6; s.xin += 4; s.power += 20; s.flags.style_heavy = true; s.log('你的剑很慢，慢得像山。可没人敢接你的第三剑。'); },
      },
      {
        text: '选《无锋》',
        hint: '悟性·大巧',
        apply: s => {
          if (s.wu >= 18) { s.jian += 10; s.wu += 5; s.xin += 5; s.power += 24; s.flags.style_nofront = true; s.log('你闭关三月，出关时剑上无锋。你忽然懂了——不是剑没锋，是你不必靠锋。'); }
          else { s.xin += 5; s.wu += 3; s.log('你悟不透那三个字。但你把它抄了下来，贴在了床头。'); }
        },
      },
    ],
  },

  {
    id: 'fellow_disciple_betray',
    ageBand: 'youth',
    place: 'jianfeng',
    title: '同门之诈',
    weight: 7,
    once: true,
    req: s => s.faction === 'tianjian' && s.age >= 24,
    text: s => `宗门试炼前夕，你的同门${s.rivalName}找到你，说愿意与你联手，共同猎杀那头三阶妖兽。

他笑得很诚恳：
「你我各取一半。这年头，单打独斗是傻子。」`,
    choices: [
      {
        text: '答应，但留个心眼',
        hint: '心性·智',
        apply: s => {
          if (s.xin >= 20) { s.power += 22; s.xin += 4; s.ji += 4; s.log('试炼中他果然背后动了手。你早有准备，反手一剑逼退了他。他逃了，你独得了整头妖兽。'); }
          else { s.power += 10; s.shou -= 5; s.log('你信了他。背后一刀，你差点没命。后来宗门查了出来，他被逐出师门，你的伤却好不了。'); }
        },
      },
      {
        text: '拒绝，独自进山',
        hint: '心性·孤',
        apply: s => { s.power += 18; s.xin += 5; s.log('你一个人猎了那头妖兽。回来时，他站在山门口，笑得很勉强。'); },
      },
      {
        text: '反手把这事捅给长老',
        hint: '悟性·谋',
        apply: s => { s.wu += 4; s.xin += 3; s.ji += 3; s.log('长老查了他的底细，果然有问题。你被记了一功。他走的那天，回头看了你一眼。'); },
      },
    ],
  },

  {
    id: 'first_kill',
    ageBand: ['youth', 'prime'],
    place: 'any',
    title: '第一次杀人',
    weight: 6,
    once: true,
    req: s => s.power >= 45 && s.age >= 24 && !s.flags.first_kill,
    text: s => `山道上有人劫道。对方是个散修，手里有刀，眼里没光。

他吼着让你把储物袋留下，声音抖得比刀还厉害。

他大概是第一次做这种事。你也是。`,
    choices: [
      {
        text: '出剑',
        hint: '剑意·破戒',
        apply: s => {
          s.flags.first_kill = true;
          s.power += 20; s.jian += 6; s.xin -= 4;
          s.log('剑很快，快得你自己都没反应过来。他倒下时，眼睛还睁着。你在原地站了很久，最后替他合上了眼。');
        },
      },
      {
        text: '打断他的刀，放他走',
        hint: '丹心·仁',
        apply: s => { s.flags.first_kill = false; s.dan += 5; s.xin += 6; s.power += 10; s.log('你一剑削断了他的刀。他跪在地上哭。你扔给他几块灵石，转身走了。'); },
      },
      {
        text: '把储物袋给他',
        hint: '心性·退',
        apply: s => { s.xin += 4; s.ji += 2; s.power += 6; s.log('你把东西给了他。他愣住了，最后没接，跑了。后来你听说，他在别处被人杀了。'); },
      },
    ],
  },

  {
    id: 'sect_mission',
    ageBand: 'youth',
    place: 'any',
    title: '宗门任务',
    weight: 8,
    once: true,
    req: s => s.faction && s.age >= 22 && s.power >= 30,
    text: s => `执事递来一枚任务玉简：

「南疆有妖物作乱，去了三批弟子，回来两批。」

他顿了顿：
「你是第四批。去，还是换一个轻松的？」`,
    choices: [
      {
        text: '接。我去',
        hint: '剑意·历练',
        apply: s => {
          if (s.power >= 60 || s.jian >= 25) { s.power += 35; s.jian += 5; s.ji += 5; s.flags.cleared_demon = true; s.log('妖物是三阶化形蛟。你斩了它，回来时玉简碎成两半——那是任务极难的标记。'); }
          else { s.power += 15; s.shou -= 8; s.log('你死里逃生。蛟没死，但你活着回来了。执事看了你一眼，什么也没说，把玉简收了回去。'); }
        },
      },
      {
        text: '换一个轻松的',
        hint: '心性·实际',
        apply: s => { s.power += 8; s.ji += 3; s.dan += 2; s.log('你接了个看药田的活。三个月里，你把药性摸了个遍。'); },
      },
      {
        text: '「我要最强的那个。」',
        hint: '心性·狂',
        apply: s => {
          s.power += s.power >= 100 ? 55 : 12;
          s.shou -= s.power >= 100 ? 5 : 15;
          s.flags.wanted_hard = true;
          s.log(s.power >= 100 ? '你一人屠了整座妖巢。回来时，山门两侧的弟子自发让开了路。' : '你差点回不来。躺了半年，但你的名字第一次挂上了任务碑。');
        },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第三批：成长与历练（35–60 岁）
     覆盖：势力纠葛 / 秘境 / 道心考验，稀有度中高
     ========================================================= */

  {
    id: 'faction_summon',
    ageBand: ['youth', 'prime'],
    place: 'any',
    title: '各方来邀',
    weight: 7,
    once: true,
    req: s => s.power >= 80 && s.age >= 32,
    text: s => `你的名字传了出去。三封信几乎同时送到：

万宝商会许诺灵石与自由；血海魔宗开出一个你无法拒绝的条件；旧日那个救过的散修，如今也成了一方人物，来信只写了六个字：

「来我这里。有酒。」`,
    choices: [
      {
        text: '赴万宝商会之约',
        hint: '机遇·利',
        apply: s => { s.ji += 8; s.power += 20; s.flags.trade_ally = true; s.log('商会给了你一座铺子。你不擅长做生意，但你认识了很多不该认识的人。'); },
      },
      {
        text: '去看看血海魔宗开的价',
        hint: '心性·试探·风险',
        apply: s => { s.jian += 6; s.xin -= 4; s.ji += 4; s.flags.demon_touch = true; s.log('他们的条件确实动人。你没答应，也没拒绝。走的时候，带走了他们一卷书。'); },
      },
      {
        text: '去那六个字那里',
        hint: '情感·义',
        apply: s => { s.xin += 6; s.power += 24; s.affection += 4; s.flags.reunion_friend = true; s.log('你们喝了一夜。他醉着说：「当年你要是不管我，我早烂在山道上了。」'); },
      },
      {
        text: '一封都不回',
        hint: '心性·孤高',
        apply: s => { s.xin += 8; s.jian += 4; s.power += 12; s.log('你把信烧了，继续练剑。窗外下了雪。'); },
      },
    ],
  },

  {
    id: 'secret_realm',
    ageBand: ['youth', 'prime', 'elder'],
    place: 'any',
    title: '秘境开启',
    weight: 6,
    once: true,
    req: s => s.power >= 100 && s.age >= 35 && s.ji >= 20,
    text: s => `东海上空裂开一道缝。百年一开的「浮光秘境」现世了。

进去的修士有一千多人。秘境的规矩是：只开三十天，出不来的人，永远留在里面。`,
    choices: [
      {
        text: '进。机会难得',
        hint: '机缘·高风险',
        apply: s => {
          if (s.ji >= 30 && s.xin >= 25) { s.power += 70; s.ji += 10; s.dan += 8; s.flags.realm_cleared = true; s.log('你在秘境深处得了一株万年灵芝和半篇剑诀。出来时，一千人只剩三百。'); }
          else { s.power += 30; s.shou -= 12; s.ji += 4; s.log('你在里面迷了路，靠着一口丹气撑到最后一天。带出来的东西不多，但你活着。'); }
        },
      },
      {
        text: '在秘境外守着，捡漏',
        hint: '悟性·谋',
        apply: s => { s.wu += 6; s.ji += 5; s.xin -= 2; s.log('你等了三十天，从出来的重伤者手里换了几样东西。不光彩，但有用。'); },
      },
      {
        text: '不进。命比机缘重要',
        hint: '心性·稳',
        apply: s => { s.xin += 7; s.shou += 5; s.log('你转身回了山。三十天后你听说，进去的人死了七成。你没什么感觉，只是又练了一天剑。'); },
      },
    ],
  },

  {
    id: 'heart_demon_trial',
    ageBand: ['youth', 'prime'],
    place: 'any',
    title: '心魔初现',
    weight: 7,
    once: true,
    req: s => s.xin <= 30 && s.power >= 90,
    text: s => `你在打坐时，忽然听见有人在识海里说话。

那声音是你的，又不像你的：
「你修这个仙，到底图什么？你救过的人，有几个记得你？你爱的人，还在吗？」

你睁开眼，满室寒霜。`,
    choices: [
      {
        text: '直面它，一句一句答',
        hint: '心性·破',
        apply: s => {
          if (s.xin >= 18) { s.xin += 12; s.wu += 5; s.power += 25; s.flags.demon_overcome = true; s.log('你答到最后，那声音自己散了。你出了一身汗，像刚杀完一个人。'); }
          else { s.xin -= 6; s.power += 10; s.flags.demon_whisper = true; s.log('你答不上来。它笑了：「那你就跟着我走吧。」从那以后，它时不时还会来。'); }
        },
      },
      {
        text: '拔剑，斩自己的影子',
        hint: '剑意·硬抗',
        apply: s => { s.jian += 8; s.xin += 4; s.power += 20; s.log('你一剑劈开石室。影子碎了，你的手在抖。它没死，只是退了一步。'); },
      },
      {
        text: '不理它，继续打坐',
        hint: '心性·定',
        apply: s => { s.xin += 9; s.power += 14; s.log('你当它不存在。三天后，它自己没趣地不说话了。'); },
      },
    ],
  },

  {
    id: 'master_past_reveal',
    ageBand: ['youth', 'prime'],
    place: 'jianfeng',
    title: '师父的旧事',
    weight: 6,
    once: true,
    req: s => s.flags.know_master_past && s.age >= 30,
    text: s => `师父的剑冢开了。你进去时，他正对着一座无字的碑坐着。

「她叫阿棠。」他忽然开口，「我抢过她的婚。抢成了。后来她替我挡了一剑，没撑过那年冬天。」

他伸出手，掌心有一道旧疤：
「你说，图什么呢。」`,
    choices: [
      {
        text: '「师父，她的碑为什么无字？」',
        hint: '心性·共情',
        apply: s => { s.xin += 8; s.wu += 4; s.flags.master_trust = true; s.log('「因为她说过，等我把字刻好了，就说明我不再想她了。」他笑了一下，「我一直没刻。」'); },
      },
      {
        text: '「我会替你把字刻上。」',
        hint: '情感·承诺',
        apply: s => { s.xin += 10; s.jian += 5; s.affection += 5; s.log('师父看了你很久，把剑按在你肩上：「你要是敢骗我，我做鬼也不饶你。」'); },
      },
      {
        text: '什么都不说，陪他坐到天亮',
        hint: '心性·沉默',
        apply: s => { s.xin += 9; s.power += 15; s.log('你们一句话没说。天亮时，师父说：「走吧。今天的剑，我教你最后一式。」'); },
      },
    ],
  },

  {
    id: 'mortal_friend_dies',
    ageBand: ['prime', 'elder'],
    place: 'guoshi',
    title: '故人已老',
    weight: 7,
    once: true,
    req: s => s.age >= 45 && s.power >= 120,
    text: s => `你回了一趟青石镇。当年的玩伴老李头，如今躺在床上，牙都掉光了。

他看见你，愣了半天，才认出来：
「是你啊……你怎么，一点都没变。」

他伸出手，攥住你的袖子，力气小得可怜。`,
    choices: [
      {
        text: '留下来，送他最后一程',
        hint: '心性·情',
        apply: s => { s.xin += 10; s.shou -= 2; s.dan += 4; s.flags.saw_friend_die = true; s.log('你守了七天。他走的时候，你在旁边。他的儿子跪下给你磕头，你说不必。你忽然明白，修仙修的不是不老，是看着别人老。'); },
      },
      {
        text: '替他续命，用你的丹',
        hint: '丹心·逆天',
        apply: s => {
          if (s.dan >= 25) { s.dan += 5; s.shou -= 6; s.xin += 12; s.flags.saved_friend = true; s.log('你给他延了十年寿。他多活了十年，你少活六年。你觉得划算。'); }
          else { s.xin += 6; s.log('你手里的丹不够。你眼睁睁看着他走了。那晚你第一次觉得，丹炉里的火，是凉的。'); }
        },
      },
      {
        text: '留下一笔钱，悄悄离开',
        hint: '心性·逃',
        apply: s => { s.xin += 4; s.ji += 3; s.log('你留了钱，没敢等他醒。走到镇口，你回头看了一眼——那扇窗还亮着灯。'); },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第四批：中后期（60–120 岁）
     覆盖：势力大战 / 传承 / 抉择，稀有度偏高
     ========================================================= */

  {
    id: 'sect_war',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '两派大战',
    weight: 7,
    once: true,
    req: s => s.faction && s.power >= 200 && s.age >= 60,
    text: s => `天剑宗与血海魔宗撕破了脸。

山门前集结了三百弟子。执剑长老把剑插在台上：
「今日出山的，有人回不来。怕的，现在退。」

没有人动。风吹过剑林，铮铮一片。`,
    choices: [
      {
        text: '站到最前方',
        hint: '剑意·勇',
        apply: s => {
          if (s.jian >= 45) { s.power += 80; s.jian += 8; s.flags.war_hero = true; s.log('你冲在最前。一战下来，血海魔宗退了三十里。战后，你的名字被刻在了剑峰的功勋碑上。'); }
          else { s.power += 40; s.shou -= 12; s.flags.war_survive = true; s.log('你活了下来，但很多同门没回来。你在阵亡名单上，看到了两个熟悉的名字。'); }
        },
      },
      {
        text: '守在后方，救死扶伤',
        hint: '丹心·济',
        apply: s => { s.dan += 10; s.xin += 6; s.power += 35; s.flags.war_healer = true; s.log('你救回了七十多个重伤弟子。有人说你不算战功，你说：「我救的是人，不是功。」'); },
      },
      {
        text: '趁乱去血海魔宗的老巢',
        hint: '心性·险·奇',
        apply: s => {
          if (s.ji >= 30) { s.power += 90; s.ji += 10; s.flags.stole_treasure = true; s.log('你抄了他们的后路，拿走了三卷禁术和一口血池。这一战，你成了最大的赢家。'); }
          else { s.shou -= 20; s.jian += 5; s.flags.narrow_escape = true; s.log('你差点死在血池边。逃出来时，怀里只有半卷没用的残页。'); }
        },
      },
      {
        text: '那一夜，我退出了',
        hint: '心性·独',
        apply: s => { s.xin += 8; s.ji += 6; s.power += 10; s.log('你走了。山门的钟敲了一整夜。多年后有人问你为什么，你说：「我不想再送人了。」'); },
      },
    ],
  },

  {
    id: 'ancient_inheritance',
    ageBand: ['prime', 'elder'],
    place: 'luori',
    title: '剑冢传承',
    weight: 5,
    once: true,
    req: s => s.flags.ancient_sword && s.power >= 250 && s.age >= 70,
    text: s => `那把断剑开始发烫。

你跟着它的指引，重新回到落日原的剑冢。这一次，剑冢中央站着一个人——不是鬼，是剑意凝成的残影。

他开口，声音像是从很远处传来：
「你补上那半句诗了吗？」`,
    choices: [
      {
        text: '吟出你自己补的下半句',
        hint: '悟性·诗剑',
        apply: s => {
          if (s.wu >= 35) {
            s.jian += 20; s.wu += 8; s.power += 120; s.flags.inheritance_done = true;
            s.log('你朗声吟道：「一剑霜寒十四州，半生风雪一人收。」残影静了很久，深深一揖，化作流光没入断剑。断剑，接上了。');
          } else {
            s.jian += 8; s.power += 40;
            s.log('你补了一句，残影摇头：「不对。再想想。」他散作烟尘，剑冢重归寂静。');
          }
        },
      },
      {
        text: '「我补不上。请您赐教。」',
        hint: '心性·诚',
        apply: s => { s.xin += 10; s.jian += 10; s.wu += 5; s.power += 70; s.log('残影笑了：「肯认不足，已是难得。」他传了你一式，名为「留白」。'); },
      },
      {
        text: '「诗不重要。我只想变强。」',
        hint: '心性·直·风险',
        apply: s => { s.jian += 12; s.power += 60; s.xin -= 6; s.log('残影沉默了很久：「那你拿到的，只是剑，不是道。」断剑重归冰冷。'); },
      },
    ],
  },

  {
    id: 'immortal_offer',
    ageBand: 'elder',
    place: 'any',
    title: '一位前辈的邀请',
    weight: 5,
    once: true,
    req: s => s.power >= 350 && s.age >= 90,
    text: s => `一位你从未见过的老者找到你。他气息深不可测，站在你面前，你却看不清他的脸。

「跟我走。三百年后，你会站到我看不见的地方。」

他顿了顿：
「代价是——你从此再无归途。」`,
    choices: [
      {
        text: '跟他走',
        hint: '机缘·大道',
        apply: s => { s.power += 180; s.ji += 15; s.wu += 10; s.shou -= 10; s.flags.took_dao = true; s.log('你随他走了三年。三年后你回来，山门还在，故人已不在。你站在门口，忽然不知道自己回来做什么。'); },
      },
      {
        text: '「我还有人要护，不能走。」',
        hint: '情感·守',
        apply: s => { s.xin += 12; s.affection += 10; s.power += 50; s.flags.refused_dao = true; s.log('老者叹了口气：「也罢。你的道，本来就不在他处。」他走后，你回头看向山下的村子。'); },
      },
      {
        text: '问他姓名',
        hint: '悟性·疑',
        apply: s => { s.wu += 8; s.ji += 8; s.power += 70; s.log('老者笑了：「问得好。记住——不敢问名字的人，走不远。」他留下三枚丹药，走了。'); },
      },
    ],
  },

  {
    id: 'world_shadow',
    ageBand: 'elder',
    place: 'any',
    title: '天外的裂痕',
    weight: 4,
    once: true,
    req: s => s.power >= 450 && s.age >= 110,
    text: s => `你夜观天象，发现九天之上有一道极细的裂痕，正在缓慢扩大。

观星台上，另一位老修士也在看。他头也不回：
「你也看见了？三千年了，没人敢说。」

「说什么？」
「说我们的天，是补过的。而那块补丁，在松。」`,
    choices: [
      {
        text: '「我去看看。」',
        hint: '机缘·极端·高风险',
        apply: s => {
          if (s.power >= 600 && s.xin >= 40) { s.power += 200; s.ji += 20; s.xin += 10; s.flags.saw_patch = true; s.log('你上去了。裂痕后面是无尽的星空，和一堵正在剥落的墙。你回来了，从此你的剑里，多了一种说不出的东西。'); }
          else { s.shou -= 25; s.power += 60; s.flags.badly_hurt_sky = true; s.log('你还没靠近就被什么推了回来。落地时七窍流血。老修士扶住你：「急什么。你还不够。」'); }
        },
      },
      {
        text: '把这件事记下来，传下去',
        hint: '心性·承',
        apply: s => { s.wu += 10; s.xin += 8; s.power += 60; s.flags.record_patch = true; s.log('你写了一卷《天裂录》，留在了藏经阁最深处。你觉得，总会有人需要它。'); },
      },
      {
        text: '「与我无关。」转身下台',
        hint: '心性·自守',
        apply: s => { s.xin += 6; s.power += 80; s.log('你下台了。可那天晚上，你还是没睡着。'); },
      },
    ],
  },

  {
    id: 'disciple_choice',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '收一个徒弟',
    weight: 6,
    once: true,
    req: s => s.power >= 300 && s.age >= 80,
    text: s => `山门前跪着一个少年。他从很远的地方来，跪了三天三夜，膝盖烂了也不走。

他说：「我要拜你为师。」

你看见他袖子里露出的半截剑鞘——和你当年那把，一模一样。`,
    choices: [
      {
        text: '收下他',
        hint: '传承·缘',
        apply: s => {
          s.flags.has_disciple = true;
          if (s.xin >= 30) { s.power += 60; s.xin += 8; s.wu += 6; s.flags.disciple_good = true; s.log('你收了他。他学得很快，快得让你想起自己。你教他的第一句话是：「剑够快，不如心够稳。」'); }
          else { s.power += 40; s.affection += 6; s.log('你收了他。他学得很慢，但从不叫苦。多年后你才明白，慢有慢的道理。'); }
        },
      },
      {
        text: '「我不收徒，但可以教你三天。」',
        hint: '心性·留白',
        apply: s => { s.xin += 8; s.power += 45; s.flags.three_days = true; s.log('你教了他三天，然后把他赶下山。他跪着磕了三个头。你转过身，没让他看见你的表情。'); },
      },
      {
        text: '「回去吧。这条路上，死的人太多。」',
        hint: '心性·护',
        apply: s => { s.xin += 10; s.shou += 3; s.log('你把他赶走了。第二天清晨，他还在门口，只不过换成了跪着的方向——朝山下。'); },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第五批：晚期与终局前（120 岁+）
     覆盖：长生 / 天劫前夜 / 回首，稀有度最高
     ========================================================= */

  {
    id: 'long_life_lonely',
    ageBand: 'elder',
    place: 'guoshi',
    title: '旧宅的槐树',
    weight: 6,
    once: true,
    req: s => s.age >= 130 && s.power >= 300,
    text: s => `你又回了一次青石镇。这一次，巷子里的房子全拆了，只剩那棵老槐树还立着。

树下坐着个小孩，看见你，问：「爷爷，你找谁？」

你想了想：「找一棵树。」
「树有什么好找的。」
「树下埋过我一把剑。」`,
    choices: [
      {
        text: '把剑挖出来，重新带在身上',
        hint: '心性·拾',
        apply: s => { s.xin += 8; s.jian += 8; s.power += 50; s.flags.dug_sword = true; s.log('剑锈了，但还认你。你把它擦干净。那天起，你的剑上，多了一层旧。'); },
      },
      {
        text: '买下这块地，重新盖一座院子',
        hint: '情感·归',
        apply: s => { s.xin += 10; s.affection += 8; s.dan += 5; s.flags.rebuilt_village = true; s.log('你盖了一座小院，种回了当年的菜。她来的时候，站在门口看了很久，说：「这才是家。」'); },
      },
      {
        text: '把剑留给那个孩子',
        hint: '传承·轻',
        apply: s => { s.xin += 12; s.wu += 6; s.power += 30; s.log('你把剑给了那孩子。他抓着剑，眼睛亮得像当年的你。你转身走了，走得很轻松。'); },
      },
    ],
  },

  {
    id: 'tribulation_eve',
    ageBand: 'elder',
    place: 'jiuxiao',
    title: '天劫前夜',
    weight: 8,
    once: true,
    req: s => s.power >= 500 && s.age >= 140 && !s.flags.tribulation_win,
    text: s => `天劫将至，雷云已经在九霄雷泽上空聚了七天。

这一夜，你独自坐在崖边。身后是你走过的所有路——青石镇的粥香，剑峰的云海，琉璃城的红绸，还有那些再也见不到的人。

你忽然很想问问自己：如果度不过今晚，你后悔吗？`,
    choices: [
      {
        text: '「不后悔。」起身，走向雷泽',
        hint: '心性·决',
        apply: s => { s.xin += 15; s.jian += 10; s.power += 80; s.flags.ready_tribulation = true; s.log('你站起来，一步一个脚印。雷云在你头顶翻涌，像在等你。'); },
      },
      {
        text: '连夜回一趟故里，再见他们一面',
        hint: '情感·念',
        apply: s => { s.affection += 15; s.xin += 8; s.power += 50; s.flags.last_visit = true; s.log('你回去了。见到了该见的人。天亮前你赶回雷泽，衣角还带着家里的烟火气。你觉得，现在死也值了。'); },
      },
      {
        text: '写一封长信，留给后来人',
        hint: '悟性·留',
        apply: s => { s.wu += 10; s.xin += 8; s.power += 60; s.flags.left_letter = true; s.log('你写了整整一夜。信里没写剑诀，只写了几件小事：粥要熬稠，剑要常擦，喜欢的人要早点开口。'); },
      },
    ],
  },

  {
    id: 'final_dawn',
    ageBand: 'elder',
    place: 'any',
    title: '最后一剑',
    weight: 5,
    once: true,
    req: s => s.age >= 180 && s.power >= 600,
    text: s => `你已经很久没有出剑了。

这一日，你独自站在山巅，拔出剑。剑身映出你的脸——你已经不太记得自己年轻时的样子。

你忽然想，如果这一剑是你此生最后一剑，你希望它斩向什么？`,
    choices: [
      {
        text: '斩向天',
        hint: '剑意·极',
        apply: s => { s.jian += 20; s.power += 150; s.xin -= 4; s.flags.last_sword_sky = true; s.log('这一剑冲霄而起，云层被劈开一道口子，久久不合。山下所有人都看见了。'); },
      },
      {
        text: '斩向自己',
        hint: '心性·破执',
        apply: s => { s.xin += 20; s.wu += 12; s.power += 100; s.flags.last_sword_self = true; s.log('剑尖停在身前一寸。你笑了——原来最难斩的，一直是我。'); },
      },
      {
        text: '收剑。不斩了',
        hint: '心性·止',
        apply: s => { s.xin += 16; s.power += 80; s.flags.last_sword_none = true; s.log('你把剑收了回去。风停了，你也停了。你忽然觉得，这样很好。'); },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第六批：可重复的日常（repeat）
     用于兜底，避免事件池枯竭，风格统一、效果温和
     ========================================================= */

  {
    id: 'daily_travel',
    ageBand: 'any',
    repeat: true,
    place: 'any',
    title: '远行',
    weight: 5,
    text: s => `你出门走了一趟。没有目的地，走到哪算哪。

路上你遇见很多普通人，他们一辈子没听过「修仙」两个字，却活得比你从容。`,
    choices: [
      {
        text: '在渡口听人说书',
        hint: '悟性·世情',
        apply: s => { s.wu += 3; s.xin += 2; s.power += 6; s.age += 2; s.log('说书人讲了个剑仙的故事。你听着听着，忽然笑了——那故事里的人物，做的事比你荒唐多了。'); },
      },
      {
        text: '帮一户农家收稻子',
        hint: '丹心·朴',
        apply: s => { s.dan += 3; s.xin += 3; s.power += 5; s.age += 2; s.log('你收了一天稻。农家留你吃饭，你吃得很香。走的时候，大娘塞给你两个煮鸡蛋。'); },
      },
      {
        text: '找个安静的山洞闭关',
        hint: '剑意·专',
        apply: s => { s.jian += 4; s.power += 8; s.age += 3; s.log('你闭关了一段日子。出关时，你的剑意又沉了一分。'); },
      },
    ],
  },

  {
    id: 'daily_sword_clean',
    ageBand: 'any',
    repeat: true,
    place: 'any',
    title: '擦剑',
    weight: 4,
    text: s => `你坐在窗前，慢慢地擦剑。

剑身映出一张脸。你看了很久，才认出那是自己。`,
    choices: [
      {
        text: '擦到剑身发亮',
        hint: '剑意·静',
        apply: s => { s.jian += 4; s.power += 7; s.age += 2; s.log('剑亮得能照见窗外的月亮。你把剑插回鞘里，睡了个好觉。'); },
      },
      {
        text: '想起一些旧事',
        hint: '心性·忆',
        apply: s => { s.xin += 4; s.wu += 2; s.age += 2; s.log('你想起了很多人。有些人还在，有些人已经不在很久了。你没觉得难过，只是有点想说话。'); },
      },
      {
        text: '给剑重新系一根剑穗',
        hint: '情感·温',
        apply: s => { s.xin += 3; s.affection += 2; s.power += 5; s.age += 2; s.log('你系了一根新的剑穗，红色的。你说不清为什么要红色。'); },
      },
    ],
  },

  {
    id: 'daily_pill',
    ageBand: 'any',
    repeat: true,
    place: 'danxia',
    title: '炉边的日子',
    weight: 5,
    text: s => `丹炉里的火稳定地烧着。你守在旁边，一寸一寸地看着药性变化。

这是你最熟悉的时间。`,
    choices: [
      {
        text: '求稳，出一炉好丹',
        hint: '丹心·稳',
        apply: s => { s.dan += 5; s.power += 7; s.age += 2; s.log('丹成，品相极好。你把它收进玉瓶，编号存档。'); },
      },
      {
        text: '试一味新配方',
        hint: '悟性·试',
        apply: s => { s.wu += 4; s.dan += 3; s.power += 5; s.age += 2; s.log('你改了一味药。丹成了，颜色很怪。你自己先尝了一颗，味道像陈年的雨。'); },
      },
      {
        text: '给需要的人多炼几炉',
        hint: '丹心·济',
        apply: s => { s.dan += 4; s.xin += 4; s.ji += 3; s.age += 3; s.log('你把丹分给了山下的病人。他们不知道你的名字，只知道「山上那个好人」。'); },
      },
    ],
  },

  /* =========================================================
     扩充事件库 · 第七批（池容量加固）
     单周目实际触发 ~30–42 个，此批将候选池推至 60+，
     确保任何走位都不会抽空。覆盖各年龄段与属性区间。
     ========================================================= */

  {
    id: 'child_star_gaze',
    ageBand: 'youth',
    place: 'qingshi',
    title: '看星星的孩子',
    weight: 6,
    once: true,
    req: s => s.age >= 12 && s.age <= 15,
    text: s => `夏夜，你躺在屋顶上看星星。

邻居家的老人说，天上一颗星，地上一个人。你问他：「那我的星星在哪？」
他指着最暗的那颗：「喏，就那个。不起眼，但一直都在。」`,
    choices: [
      {
        text: '每晚都来找自己那颗星',
        hint: '悟性·恒',
        apply: s => { s.wu += 4; s.xin += 3; s.log('你看了整整一个夏天。那颗星好像亮了一点。也许是错觉。'); },
      },
      {
        text: '「我以后要让它变亮」',
        hint: '心性·志',
        apply: s => { s.xin += 5; s.jian += 2; s.log('老人笑了：「有志气。不过，天那么高，你得先学会站起来。」'); },
      },
      {
        text: '他觉得老人在哄小孩',
        hint: '心性·实',
        apply: s => { s.xin += 4; s.gen += 3; s.log('你翻了个身睡了。第二天照样挑水劈柴。'); },
      },
    ],
  },

  {
    id: 'child_market',
    ageBand: 'youth',
    place: 'qingshi',
    title: '集市上的仙人',
    weight: 6,
    once: true,
    req: s => s.age >= 12 && s.age <= 16,
    text: s => `赶集那天，镇上来了一队穿白衣的人。

他们买走了所有东西，付的是亮晶晶的石头。有个孩子伸手去摸他们的衣角，被侍卫一脚踹开。

你站在人群里，看得很清楚。`,
    choices: [
      {
        text: '去扶那个被踹的孩子',
        hint: '心性·义',
        apply: s => { s.xin += 5; s.dan += 2; s.log('你把孩子扶起来。他哭得很凶。你拍拍他的背，说没事。'); },
      },
      {
        text: '盯着那些白衣人看',
        hint: '悟性·记',
        apply: s => { s.wu += 4; s.ji += 2; s.flags.seen_cultivators = true; s.log('你把他们的样子记在了心里。你想，总有一天，我也要穿那样的衣服。'); },
      },
      {
        text: '低头走开',
        hint: '心性·避',
        apply: s => { s.xin += 3; s.ji += 2; s.log('你低着头走开了。晚上，你梦见自己变成了那个被踹的孩子。'); },
      },
    ],
  },

  {
    id: 'teen_river',
    ageBand: 'youth',
    place: 'qingshi',
    title: '河边的剑影',
    weight: 6,
    once: true,
    req: s => s.age >= 14 && s.age <= 19,
    text: s => `你路过河滩，看见水里有一道剑影。

抬头，是个衣衫褴褛的年轻人。他对着一根芦苇练剑，已经练了很久，衣领都被汗浸透了。

芦苇叶上，凝着露水。他的剑，一次都没碰到。`,
    choices: [
      {
        text: '站远一点，看他练',
        hint: '悟性·观',
        apply: s => { s.wu += 5; s.jian += 2; s.log('你看了一下午。他始终没碰到那滴水。但你记住了他出剑的样子。'); },
      },
      {
        text: '走过去问他，为什么不换个目标',
        hint: '心性·问',
        apply: s => { s.xin += 4; s.wu += 3; s.flags.met_roguish = true; s.log('他停下来看你：「因为露水不会被吓到。」他顿了顿，「你有点意思。要不要跟我学两招？」'); },
      },
      {
        text: '捡块石头，帮他打掉那片叶子',
        hint: '心性·顽',
        apply: s => { s.jian += 3; s.ji += 2; s.log('石头飞出去，叶子落进水里。他愣了很久，忽然大笑：「对！我怎么没想到——剑要快，石头也要快。」'); },
      },
    ],
  },

  {
    id: 'mortal_famine',
    ageBand: 'youth',
    place: 'qingshi',
    title: '荒年',
    weight: 7,
    once: true,
    req: s => s.age >= 15 && s.age <= 24,
    text: s => `那年大旱，青石镇颗粒无收。

你家也断了粮。母亲把最后半碗米煮给你，说自己吃过了。你没戳穿她——她的嘴唇是干的。`,
    choices: [
      {
        text: '把米分回一半给母亲',
        hint: '心性·孝',
        apply: s => { s.xin += 6; s.gen += 2; s.log('母亲骂了你一顿，然后把米又推了回来。那一碗米，你们推来推去，谁也没多喝一口。'); },
      },
      {
        text: '上山打猎，赌一把',
        hint: '根骨·勇',
        apply: s => {
          if (s.gen >= 10) { s.gen += 4; s.ji += 3; s.shou -= 2; s.log('你猎到一头野猪。镇上分了三天。你成了那年镇上的英雄。'); }
          else { s.shou -= 4; s.xin += 4; s.log('你空手回来，还摔伤了腿。母亲抱着你哭，说：饿死也不许你再上山。'); }
        },
      },
      {
        text: '去地主家做短工',
        hint: '心性·韧',
        apply: s => { s.xin += 5; s.gen += 3; s.log('你干了整整一冬。地主扣了工钱，你没吭声，把省下的口粮背回了家。'); },
      },
    ],
  },

  {
    id: 'youth_duel',
    ageBand: 'youth',
    place: 'any',
    title: '山道上的挑战',
    weight: 7,
    once: true,
    req: s => s.power >= 25 && s.age >= 20 && s.age <= 40,
    text: s => `山道上，一个同辈修士拦住了你。

「听说你剑不错。」他抱剑而立，「比一场？赌一壶酒。」

他眼里没有恶意，只有一种你熟悉的东西——那种非要比个高下的光。`,
    choices: [
      {
        text: '接。三招定输赢',
        hint: '剑意·切磋',
        apply: s => {
          if (s.jian >= 20) { s.jian += 5; s.power += 20; s.ji += 3; s.log('你三招赢了他。他把酒扔给你，笑得比你还开心：「下次再来。」后来你们成了几十年的酒友。'); }
          else { s.power += 10; s.xin += 3; s.log('你输了，但输得心服口服。他教你一招卸力，没收钱。'); }
        },
      },
      {
        text: '「今天我赶路。」绕开他',
        hint: '心性·淡',
        apply: s => { s.xin += 4; s.power += 6; s.log('你走了。他没拦。多年后你才知道，那人后来成了很有名的一位剑修。'); },
      },
      {
        text: '「赌一壶酒不够。赌你的剑。」',
        hint: '心性·狂',
        apply: s => { s.jian += 4; s.xin += 3; s.power += 14; s.log('他愣了，随即笑了：「够狠。行。」打完他输了，把剑解下来。你没要，只说：「记住今天。」'); },
      },
    ],
  },

  {
    id: 'market_dispute',
    ageBand: ['youth', 'prime'],
    place: 'liuli',
    title: '坊市的纠纷',
    weight: 6,
    once: true,
    req: s => s.age >= 22,
    text: s => `坊市里，一个老修士蹲在摊前哭。

他炼了一辈子丹，攒下的灵石被一个骗子卷走了。周围人看着，没人管。

那个骗子正站在街对面，笑得很大声。`,
    choices: [
      {
        text: '替老人拦住那个骗子',
        hint: '心性·义',
        apply: s => {
          if (s.power >= 50) { s.xin += 6; s.ji += 5; s.power += 12; s.flags.helped_old = true; s.log('你出手拦下了骗子，追回了灵石。老人跪下要拜你，你把他扶起来：「下次把钱缝在衣服里。」'); }
          else { s.xin += 4; s.shou -= 3; s.log('你拦了，没拦住，还挨了一下。但老人记住了你。'); }
        },
      },
      {
        text: '给老人几块灵石，转身走',
        hint: '丹心·善',
        apply: s => { s.dan += 4; s.xin += 4; s.log('老人攥着灵石，看着你的背影，一直看到你拐过街角。'); },
      },
      {
        text: '这种事每天都有。不管',
        hint: '心性·冷',
        apply: s => { s.xin -= 2; s.ji += 2; s.log('你走开了。可那哭声，你听着听着，脚步慢了下来。你没回头。'); },
      },
    ],
  },

  {
    id: 'beast_companion',
    ageBand: ['youth', 'prime'],
    place: 'luori',
    title: '一头小兽',
    weight: 7,
    once: true,
    req: s => s.age >= 22 && s.ji >= 15,
    text: s => `荒原上，你发现一头受伤的小兽。它只有巴掌大，通体雪白，后腿被兽夹夹住了。

它看着你，眼睛很亮，不叫，也不躲。

你伸手，它往你掌心里蹭了蹭。`,
    choices: [
      {
        text: '带回去，养着',
        hint: '机缘·伴',
        apply: s => { s.ji += 6; s.xin += 4; s.flags.has_beast = true; s.log('你给它取名「小白」。它跟着你很多年。有人说它是异兽幼崽，你只是觉得，有它在，夜没那么长。'); },
      },
      {
        text: '替它解开兽夹，放它走',
        hint: '丹心·仁',
        apply: s => { s.dan += 5; s.ji += 5; s.log('它跑出几步，又回头看你。你说走吧。它才跑了。三年后的一天，它带着一群同类，出现在你最危急的时候。'); },
      },
      {
        text: '解开夹子，但把它的血取了一点',
        hint: '丹心·利',
        apply: s => { s.dan += 8; s.xin -= 4; s.log('你取了血，炼成一炉好丹。它跑走后，再没回来。你偶尔会想起那双眼睛。'); },
      },
    ],
  },

  {
    id: 'inner_demon_mirror',
    ageBand: ['youth', 'prime'],
    place: 'any',
    title: '照心镜',
    weight: 5,
    once: true,
    req: s => s.power >= 120 && s.age >= 35,
    text: s => `一处古洞中，你找到一面镜子。

镜子里的你，和你一模一样。唯一不同的是——镜中的你，在笑。而你没有。

「照一照？」一个声音说，「照见的是你最不愿承认的那部分。」`,
    choices: [
      {
        text: '照',
        hint: '心性·直面',
        apply: s => {
          if (s.xin >= 30) { s.xin += 12; s.wu += 6; s.power += 30; s.flags.faced_self = true; s.log('镜中的你笑得很温柔。你忽然明白，那不是什么魔，那是你一直不肯原谅的自己。你朝镜子点了点头。'); }
          else { s.xin -= 5; s.power += 15; s.log('你照了，看见了自己藏起来的贪和怕。你砸碎了镜子。碎片里，每一片都还在笑。'); }
        },
      },
      {
        text: '把镜子盖上，不照',
        hint: '心性·避',
        apply: s => { s.xin += 5; s.power += 10; s.log('你用布把镜面盖住了。走的时候，布下面传来一声轻轻的笑。你加快了脚步。'); },
      },
      {
        text: '问它：「你想说什么？」',
        hint: '悟性·通',
        apply: s => { s.wu += 8; s.xin += 6; s.power += 20; s.flags.talked_self = true; s.log('它说了很久，说的是你这辈子最不愿意听的话。你听完，沉默了很久，最后说：「我知道了。谢谢你。」镜子，暗了下去。'); },
      },
    ],
  },

  {
    id: 'sworn_brother',
    ageBand: ['youth', 'prime'],
    place: 'any',
    title: '结拜',
    weight: 6,
    once: true,
    req: s => s.flags.reunion_friend && s.age >= 35,
    text: s => `老友提了两坛酒上山。

「我这辈子没什么大出息，」他给自己倒满，「就交了你这么个朋友。」

他举起碗：
「要不要拜个把子？我知道你们修士不在意这个——但我在意。」`,
    choices: [
      {
        text: '拜',
        hint: '情感·义',
        apply: s => { s.xin += 8; s.affection += 6; s.power += 20; s.flags.sworn = true; s.log('你们对着山磕了头。他笑得像个孩子。多年后他老了、走了，每年那天，你都会带两坛酒上山。'); },
      },
      {
        text: '「我们是朋友，不用这些。」',
        hint: '心性·淡',
        apply: s => { s.xin += 6; s.power += 15; s.log('他愣了愣，随即笑了：「也对。是我想多了。」他喝了三碗，醉得不省人事。'); },
      },
      {
        text: '「你喝了酒再说一遍。」',
        hint: '情感·真',
        apply: s => { s.xin += 7; s.affection += 8; s.power += 18; s.flags.sworn = true; s.log('他真的又说了，一边说一边哭。你听着，眼眶也红了。那天你们喝到天亮。'); },
      },
    ],
  },

  {
    id: 'sect_politics',
    ageBand: ['prime', 'elder'],
    place: 'jianfeng',
    title: '宗门内斗',
    weight: 6,
    once: true,
    req: s => s.faction && s.power >= 150 && s.age >= 50,
    text: s => `长老会要选新的执剑长老。两位候选人都来找过你。

一个说：「我上任，你便是首席弟子。」
另一个说：「我知道你不图这些。我只问你——你希望宗门变成什么样？」

你心里其实有答案。`,
    choices: [
      {
        text: '支持许诺你好处的那位',
        hint: '机遇·利',
        apply: s => { s.ji += 8; s.power += 40; s.flags.politics_ally = true; s.log('他当选了，你也升了。可每次开会，你都觉得坐在旁边的这些人，笑得很假。'); },
      },
      {
        text: '支持那位问你理想的人',
        hint: '心性·道',
        apply: s => { s.xin += 8; s.power += 35; s.wu += 4; s.flags.politics_ideal = true; s.log('他当选了。那天晚上，你们谈了很久。宗门后来真的变了一些——变好了。'); },
      },
      {
        text: '「我不站队。」',
        hint: '心性·独',
        apply: s => { s.xin += 7; s.power += 25; s.log('两个人都有些失望。之后的几年，你过得清静，也过得孤单。'); },
      },
      {
        text: '辞去所有职务，去后山闭关',
        hint: '心性·退',
        apply: s => { s.xin += 6; s.jian += 5; s.power += 45; s.log('你把令牌还了回去。后山的雪很大，你的剑，却比从前快了。'); },
      },
    ],
  },

  {
    id: 'mortal_wedding',
    ageBand: ['youth', 'prime'],
    place: 'qingshi',
    title: '一场凡人的婚礼',
    weight: 5,
    once: true,
    req: s => s.age >= 45 && s.power >= 100,
    text: s => `你路过青石镇时，正赶上有人办喜事。

新郎是当年那个被你从恶少手底下扶起来的孩子。他如今也四十多了，头发白了一半，笑起来眼睛还是弯的。

他认出你，非要拉你上座。`,
    choices: [
      {
        text: '坐下，喝一杯喜酒',
        hint: '情感·人间',
        apply: s => { s.xin += 8; s.affection += 5; s.shou += 2; s.log('你喝了一杯。酒很劣，你却觉得比仙酿好喝。散席时，他塞给你一包喜糖，说沾沾喜气。'); },
      },
      {
        text: '留一份礼，不上桌',
        hint: '心性·淡',
        apply: s => { s.xin += 5; s.ji += 3; s.log('你留了一份厚礼，远远看了会儿就走了。你不知道他有没有看见你。'); },
      },
      {
        text: '「你还记得当年那件事吗？」',
        hint: '心性·忆',
        apply: s => { s.xin += 6; s.wu += 3; s.log('他愣了一下，然后眼睛红了：「记得。那天要不是你，我这辈子就废了。」他给你磕了个头。你拦住他，自己却转过身去。'); },
      },
    ],
  },

  {
    id: 'legacy_scroll',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '一卷旧书',
    weight: 5,
    once: true,
    req: s => s.power >= 160 && s.age >= 55,
    text: s => `你的储物袋深处，摸出一卷发黄的旧书。

你才想起来——那是当年老剑客给你的，你一直没翻过。

书没有书名，第一页上写着一行小字：「写给还没明白的人。」`,
    choices: [
      {
        text: '从头到尾读一遍',
        hint: '悟性·承',
        apply: s => { s.wu += 10; s.jian += 6; s.power += 40; s.flags.read_old_book = true; s.log('书里没有剑诀，写的全是小事：怎么煮粥，怎么道歉，怎么在一个人的时候不害怕。你读完了，好像又看见老剑客坐在门槛上。'); },
      },
      {
        text: '把书传给下一个需要的人',
        hint: '心性·传',
        apply: s => { s.xin += 9; s.wu += 5; s.power += 25; s.log('你把它放在山门口的石头上。第二天，书不见了。你笑了。'); },
      },
      {
        text: '在最后一页补上自己的话',
        hint: '心性·续',
        apply: s => { s.xin += 8; s.wu += 6; s.power += 30; s.log('你写：「我看明白了。虽然晚了三十年。」然后把书收好。'); },
      },
    ],
  },

  {
    id: 'mountain_rain',
    ageBand: 'any',
    place: 'any',
    title: '山雨',
    weight: 5,
    once: true,
    req: s => s.age >= 60,
    text: s => `夜半山雨，你睡不着，披衣出门。

雨打在剑上，声音很密。你站在檐下，看了很久很久。

忽然想起很多年前，也有这样一个雨夜，有人把伞塞给你，自己淋着雨走了。`,
    choices: [
      {
        text: '回屋，给她写一封没打算寄的信',
        hint: '情感·念',
        apply: s => { s.affection += 10; s.xin += 6; s.log('你写了三页，写完又烧了。火光里，你看见自己的手，已经很老了。'); },
      },
      {
        text: '在雨里练一夜剑',
        hint: '剑意·痴',
        apply: s => { s.jian += 8; s.power += 30; s.shou -= 2; s.log('天亮了，雨停了。你的剑上全是水，你的心却是干的。'); },
      },
      {
        text: '坐着，什么都不做',
        hint: '心性·静',
        apply: s => { s.xin += 8; s.power += 15; s.log('你坐到天亮。什么都没想，也什么都想过了。'); },
      },
    ],
  },

  {
    id: 'price_of_power',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '代价',
    weight: 5,
    once: true,
    req: s => s.power >= 400 && s.age >= 90,
    text: s => `你终于站到了很高的地方。

可就在你闭关的这些日子里，山下的村子换了三茬人。你救过的人死了，恨过你的人也死了。连当年骂你的那个恶少，坟头草都长过腰了。

你忽然想问：你拼命往上爬，是为了什么？`,
    choices: [
      {
        text: '「为了不再看着人走。」',
        hint: '心性·悲',
        apply: s => { s.xin += 12; s.power += 60; s.dan += 5; s.log('你想通了这一层，往后的路，走起来轻了。你开始收徒，开始留手，开始学怎么把人留住。'); },
      },
      {
        text: '「强者不需要理由。」',
        hint: '心性·孤',
        apply: s => { s.jian += 10; s.power += 100; s.xin -= 6; s.log('你不再问这种问题。你的剑更快了，你的夜更长了。'); },
      },
      {
        text: '下山，去看看还有谁活着',
        hint: '情感·归',
        apply: s => { s.xin += 10; s.affection += 8; s.power += 40; s.log('你下了山。找到了几个还记得你的人。他们请你吃饭，问你怎么还这么年轻。你说，练的。'); },
      },
    ],
  },

  {
    id: 'juniors_trial',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '后辈请教',
    weight: 6,
    once: true,
    req: s => s.power >= 250 && s.age >= 70,
    text: s => `几个年轻弟子跪在你门前，请你指点。

为首那个说：「前辈，我卡在瓶颈三年了。他们都说我没天赋。」

你看着他，像看见很多年前的自己。`,
    choices: [
      {
        text: '「天赋是什么？能吃吗。」',
        hint: '心性·励',
        apply: s => { s.xin += 8; s.wu += 5; s.power += 30; s.log('你陪他练了三天。第四天，他突破了。他哭着给你磕头，你说：「记住，是你自己练的。」'); },
      },
      {
        text: '把你的剑给他看一遍',
        hint: '传承·示',
        apply: s => { s.power += 35; s.jian += 6; s.xin += 6; s.log('你在他面前出了一招。他看得呆住。你说：「看懂了吗？看不懂就再看十年。」'); },
      },
      {
        text: '「回去吧。这条路不适合你。」',
        hint: '心性·直',
        apply: s => { s.xin += 5; s.power += 20; s.log('他走了，走得很不甘心。十年后你听说，他在别处成了名。他托人带话给你：「谢谢您当年那句话。」'); },
      },
    ],
  },

  {
    id: 'old_enemy',
    ageBand: ['prime', 'elder'],
    place: 'any',
    title: '旧敌重逢',
    weight: 6,
    once: true,
    req: s => s.age >= 80 && s.power >= 300 && (s.flags.demon_touch || s.flags.wanted || s.flags.left_cultivator),
    text: s => `你遇见一个不该遇见的人。

很多年前，你们有过一段结。如今他老了，气息也弱了，站在你面前，手里还攥着当年那把刀。

「我等这一天，等了很久。」他说，声音在抖。`,
    choices: [
      {
        text: '拔剑，了结这段结',
        hint: '剑意·了断',
        apply: s => { s.jian += 8; s.power += 70; s.xin -= 3; s.log('你赢了，理所当然。可你看着他的尸体，忽然觉得，这几十年的仇，好像也没那么重。'); },
      },
      {
        text: '「你走吧。」',
        hint: '心性·放',
        apply: s => { s.xin += 12; s.wu += 6; s.power += 50; s.log('他愣在原地，最后把刀插进地里，转身走了。走出很远，你听见他哭了。'); },
      },
      {
        text: '请他喝一壶酒',
        hint: '心性·化',
        apply: s => { s.xin += 14; s.affection += 5; s.power += 40; s.flags.enemy_reconciled = true; s.log('你们喝了一夜酒，把当年的事一件一件掰开说。天亮时，他叫你一声老友。你嗯了一声。'); },
      },
    ],
  },

  {
    id: 'final_letter',
    ageBand: 'elder',
    place: 'any',
    title: '一封旧信',
    weight: 5,
    once: true,
    req: s => s.age >= 110 && s.power >= 350,
    text: s => `整理旧物时，你翻出一封信。

是很多年前母亲写的，字歪歪扭扭：「儿啊，家里都好，你在外头照顾好自己。别总想着回来。」

信的边角，有一块干掉的水渍。`,
    choices: [
      {
        text: '把信读了三遍',
        hint: '心性·念',
        apply: s => { s.xin += 12; s.affection += 6; s.power += 40; s.log('你读了三遍。第三遍的时候，你哭了。你已经很多年没哭过了。'); },
      },
      {
        text: '去坟前，读给她听',
        hint: '情感·孝',
        apply: s => { s.xin += 10; s.dan += 5; s.power += 35; s.log('你跪在坟前，一句一句读。风把纸吹得哗哗响，像是有人在应。'); },
      },
      {
        text: '把信缝进衣襟里，带着上路',
        hint: '心性·携',
        apply: s => { s.xin += 10; s.jian += 5; s.power += 45; s.flags.carry_letter = true; s.log('你把它缝进胸口的衣襟。往后无论走到哪，她都跟着你。'); },
      },
      {
        text: '把它封进玉匣，埋回老屋的地基下',
        hint: '心性·藏',
        apply: s => { s.xin += 8; s.wu += 5; s.power += 30; s.log('你埋好了，还压了块石头。你想，要是哪天有人挖到它，就当是替你听了一遍。'); },
      },
    ],
  },

  {
    id: 'threshold_choice',
    ageBand: 'elder',
    place: 'any',
    title: '渡与不渡',
    weight: 5,
    once: true,
    req: s => s.power >= 550 && s.age >= 130 && !s.flags.tribulation_win,
    text: s => `你已经站在了渡劫的门槛上。

前面是雷泽，后面是人间。一位老修士问你：「你想好了吗？渡过去，你可能就不再是人了。」

风很大。你的衣角，一直响。`,
    choices: [
      {
        text: '「我还是我。」走向雷泽',
        hint: '心性·决',
        apply: s => { s.xin += 15; s.jian += 10; s.power += 100; s.flags.ready_tribulation = true; s.log('你走向雷泽。走的时候，你回头看了一眼人间——灯火如豆，好看极了。'); },
      },
      {
        text: '「再等等。」转身下山',
        hint: '心性·留',
        apply: s => { s.xin += 10; s.affection += 8; s.power += 60; s.log('你下山了。你不知道自己还会不会再来，但至少今天，你还想做人。'); },
      },
      {
        text: '在门槛上坐了三天三夜',
        hint: '心性·思',
        apply: s => { s.xin += 12; s.wu += 10; s.power += 80; s.log('你想了三天。想完你发现，答案其实早就在心里了——只是你一直不敢承认。'); },
      },
    ],
  },
];

window.GAME_EVENTS = { EVENTS, T };
window.EVENTS = EVENTS; window.T = T;
