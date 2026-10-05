/* ============================================================
   剑与丹 · AI 叙事模块
   目的：让每一次周目的故事、事件、文风都不同
   策略：
     1) 本地程序化生成（默认，永不离线）——变体词库 + 组合式改写
     2) 可选接入外部大模型 API（用户填 Key 后启用），生成独有剧情
   ============================================================ */

const AI = {
  cfg: { enabled: false, endpoint: '', key: '', model: 'gpt-4o-mini' },

  /* 与 config.js（GameConfig）双向同步：
     - 优先从 GameConfig 读取（新设置面板写入的命名空间 jianyudan_config_v1）
     - 回落兼容旧的独立键 jianyudan_ai（老用户配置不丢） */
  syncConfig(cfg) {
    const c = cfg || (typeof GameConfig !== 'undefined' ? GameConfig.loadConfig() : null);
    if (c && c.ai) {
      Object.assign(this.cfg, {
        enabled: !!c.ai.enabled,
        endpoint: c.ai.endpoint || '',
        key: c.ai.key || '',
        model: c.ai.model || 'gpt-4o-mini',
        personality: c.ai.personality || 'gentle',
        style: c.ai.dialogueStyle || 'classical',
        tendency: c.ai.tendency || 'balanced',
      });
    }
  },

  loadCfg() {
    // 旧键兼容
    try {
      const c = JSON.parse(localStorage.getItem('jianyudan_ai') || '{}');
      Object.assign(this.cfg, c);
    } catch (e) {}
    // 新配置优先
    this.syncConfig();
  },
  saveCfg() {
    try { localStorage.setItem('jianyudan_ai', JSON.stringify(this.cfg)); } catch (e) {}
  },

  /* 依据性格 / 对话风格生成 system prompt 片段 */
  personaPrompt() {
    const p = (typeof PERSONALITIES !== 'undefined' && PERSONALITIES[this.cfg.personality]) || null;
    const st = (typeof DIALOGUE_STYLES !== 'undefined' && DIALOGUE_STYLES[this.cfg.style]) || null;
    let s = '你是一位仙侠小说家，专门为文字修仙游戏生成简短、有诗意、带情感张力的剧情。只输出正文，不超过150字。';
    if (st && st.prompt) s += `文风要求：${st.prompt}。`;
    if (p && p.tone) s += `叙事气质：${p.tone}。`;
    return s;
  },

  /* ---------- 变体词库：让同一事件的措辞每周目不同 ---------- */
  vault: {
    weather: ['晨雾未散', '日头正烈', '细雨如丝', '霜气初凝', '月色清冷', '风里带尘', '云低压城', '春寒料峭', '秋阳薄暖', '雪落无痕'],
    mood:    ['你心里忽然很静', '你莫名烦躁', '你想起了一件很久以前的事', '你觉得有什么要发生了', '你听见自己心跳的声音', '你莫名有些想笑', '你不太确定这是不是对的'],
    time:    ['三日之后', '七天后', '来年开春', '入秋那晚', '又是一个雨夜', '不知过了多久', '整整一个月后', '岁末将尽时'],
    placeX:  ['山道拐角', '旧城墙下', '长亭外', '溪畔石上', '破庙里', '酒肆二楼', '崖边', '渡口'],
  },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  /* ---------- 本地润色：给事件文本加上随机情境前缀 ---------- */
  enhance(event, state) {
    const w = this.pick(this.vault.weather);
    const m = this.pick(this.vault.mood);
    const roll = Math.random();
    let prefix = '';
    if (roll < 0.35) prefix = `${w}。`;
    else if (roll < 0.6) prefix = `${w}，${m}。`;
    else if (roll < 0.8) prefix = `${m}。`;
    return prefix;
  },

  /* ---------- 结局文本本地重写 ---------- */
  endingFlavor(ending, state) {
    const extras = {
      immortal_ascend: [
        '飞升那一刻，九洲的剑同时出鞘，为你送行。',
        '你踏云而上，脚下是你走了半生的人间。',
      ],
      sword_god: ['天下再无人敢称剑修。', '你的名字成了一句传说，也成了一句忌惮。'],
      returned_past: ['你化作飞灰时，风里飘着一句没说完的诗。', '你回去了，但那一天，谁都没能留住。'],
      happy_ending: ['有人说，后来在南山见过你们，一人一剑，走得极慢。'],
      hermit_life: ['山中的栀子花，一年比一年开得好。'],
      avenged: ['你报了仇，却没有想象中的痛快。'],
      lonely_sword: ['你的剑冢无人祭扫，风过时，铮铮作响。'],
      demon_path: ['你终于成了自己最恨的那种人。'],
      dan_master: ['九洲每一间药铺里，都有你留下的方子。'],
    };
    const pool = extras[ending.id] || [];
    return pool.length ? this.pick(pool) : '';
  },

  /* ---------- 生成本周目唯一标识的"故事基调" ---------- */
  storyTone(state) {
    const tones = ['宿命', '执念', '温柔', '锋利', '苍凉', '少年意气', '孤勇', '遗憾'];
    if (!state.flags.__tone) {
      Object.defineProperty(state.flags, '__tone', { value: this.pick(tones), enumerable: false });
    }
    return state.flags.__tone;
  },

  /* ---------- 可选：调用外部大模型生成剧情 ---------- */
  async generate(prompt) {
    if (!this.cfg.enabled || !this.cfg.endpoint || !this.cfg.key) return null;
    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.cfg.key}` },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: this.personaPrompt() },
            { role: 'user', content: prompt },
          ],
          temperature: 1.1,
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      const txt = data?.choices?.[0]?.message?.content;
      return txt ? txt.trim() : null;
    } catch (e) {
      console.warn('AI 生成失败，回退到本地叙事', e);
      return null;
    }
  },

  /* ---------- 综合：为一个事件生成最终文本 ---------- */
  async textFor(event, state) {
    let base = typeof event.text === 'function' ? event.text(state) : event.text;
    // 主角姓名注入：把文案里的「你」在开场（playerName 非空）时保留，姓名已在引擎日志中体现
    const prefix = this.enhance(event, state);
    const tone = this.storyTone(state);
    // 角色台词（charLine + charLineText）：用于角色线事件，让角色"开口"
    let line = '';
    if (event.charLine && event.charLineText) {
      const nm = state[event.charLine === 'herb' ? 'herName'
        : event.charLine === 'sister' ? 'sisterName' : 'herName2'];
      if (nm) line = `\n\n「${event.charLineText}」——${nm}`;
    }

    // 若开启了 AI，尝试生成全局基调句
    if (this.cfg.enabled) {
      const tend = (typeof STORY_TENDENCIES !== 'undefined' && STORY_TENDENCIES[this.cfg.tendency]) || null;
      const tendHint = tend && tend.prompt ? `剧情倾向：${tend.prompt}。` : '';
      const aiTxt = await this.generate(
        `${tendHint}背景：一个普通人在修仙。本周目基调「${tone}」。事件标题：${event.title}。当前事件内容：${base.slice(0, 120)}。请补写一句 30 字以内的情境描写，烘托氛围，不要重复事件内容。`
      );
      if (aiTxt) return `${prefix}${base}${line}\n\n${aiTxt}`;
    }
    return prefix + base + line;
  },
};

AI.loadCfg();
window.AI = AI;
