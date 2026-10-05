/* ============================================================
   剑与丹 · UI 逻辑
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const UI = {
  meta: null,
  curEvent: null,
  busy: false,

  init() {
    this.meta = loadMeta();
    $('#cycle-num').textContent = this.meta.cycle || 1;
    $('#ach-count').textContent = `${(this.meta.achievements || []).length}/${ACHIEVEMENTS.length}`;
    $('#run-count').textContent = (this.meta.runs || []).length;

    $('#btn-start').onclick = () => this.startRun();
    $('#btn-ach').onclick = () => this.showAchievements();
    $('#btn-ach2').onclick = () => this.showAchievements();
    $('#btn-history').onclick = () => this.showHistory();
    $('#btn-end-history').onclick = () => this.showHistory();
    $('#btn-menu').onclick = () => this.showHistory();
    $('#btn-again').onclick = () => this.startRun();
    $('#btn-talent-ok').onclick = () => this.enterGame();
    $('#btn-ach-close').onclick = () => this.showScreen('screen-title');
    $('#btn-history-close').onclick = () => this.showScreen('screen-title');
    // 设置面板
    if ($('#btn-settings')) $('#btn-settings').onclick = () => this.showSettings();
    if ($('#btn-cfg-save')) $('#btn-cfg-save').onclick = () => this.saveSettings();
    if ($('#btn-cfg-reset')) $('#btn-cfg-reset').onclick = () => this.resetSettings();
    if ($('#btn-cfg-close')) $('#btn-cfg-close').onclick = () => this.showScreen('screen-title');
    if ($('#btn-cfg-reset')) this.fillSettings();   // 预填一次

    // 第十一轮：音量滑条实时预览（拖动即生效，无需保存）
    // 注：加 addEventListener 存在性判断，兼容最小 DOM stub / 老浏览器
    const bindInput = (sel, fn) => {
      const el = $(sel);
      if (el && typeof el.addEventListener === 'function') el.addEventListener('input', fn);
      return el;
    };
    const mv = bindInput('#cfg-music-vol', () => {
      if (window.Sound && Sound.setMusicVolume) Sound.setMusicVolume(Number($('#cfg-music-vol').value) || 0);
    });
    const sv = bindInput('#cfg-sound-vol', () => {
      if (window.Sound) Sound.setVolume(Number($('#cfg-sound-vol').value) || 0);
    });
    const so = bindInput('#cfg-sound-on', () => {
      if (window.Sound) Sound.setEnabled(so.checked);
      if ($('#cfg-music-name') && Sound.music) $('#cfg-music-name').textContent = Sound.music.name() || '—';
    });
    // change 事件（复选框用 change 更准确）
    const so2 = $('#cfg-sound-on');
    if (so2 && typeof so2.addEventListener === 'function') {
      so2.addEventListener('change', () => {
        if (window.Sound) Sound.setEnabled(so2.checked);
        if ($('#cfg-music-name') && Sound.music) $('#cfg-music-name').textContent = Sound.music.name() || '—';
      });
    }

    $('#btn-reset').onclick = () => {
      if (confirm('确定要清空所有轮回记录与成就吗？此操作不可撤销。')) {
        resetMeta();
        this.meta = loadMeta();
        $('#cycle-num').textContent = this.meta.cycle || 1;
        $('#ach-count').textContent = `0/${ACHIEVEMENTS.length}`;
        $('#run-count').textContent = 0;
        this.showHistory();
      }
    };

    // 第五轮 O1：全局按钮点击音效（事件委托，一处生效于所有按钮；
    //   #btn-act / 选项按钮由 act()/choose() 自行播放更贴切的音色，这里跳过以免叠音）
    document.addEventListener('click', (ev) => {
      const b = ev.target && ev.target.closest && ev.target.closest('button');
      if (!b) return;
      if (b.id === 'btn-act' || b.classList.contains('choice-btn')) return;
      if (window.Sound) Sound.play('click');
    });
  },

  /* ---------- 设置面板 ---------- */
  showSettings() {
    this.fillSettings();
    this.showScreen('screen-settings');
  },
  fillSettings() {
    if (typeof GameConfig === 'undefined') return;
    const c = GameConfig.loadConfig();
    const fillSel = (sel, opts, cur) => {
      if (!sel) return;
      sel.innerHTML = opts.map(o => `<option value="${o.k}">${o.n}</option>`).join('');
      sel.value = cur;
    };
    $('#cfg-name').value = c.playerName || '';
    fillSel($('#cfg-diff'), Object.values(DIFFICULTIES).map(d => ({ k: d.key, n: d.name })), c.difficulty);
    fillSel($('#cfg-tendency'), Object.values(STORY_TENDENCIES).map(t => ({ k: t.key, n: t.name })), c.ai.tendency);
    fillSel($('#cfg-personality'), Object.values(PERSONALITIES).map(p => ({ k: p.key, n: p.name })), c.ai.personality);
    fillSel($('#cfg-style'), Object.values(DIALOGUE_STYLES).map(p => ({ k: p.key, n: p.name })), c.ai.dialogueStyle);
    $('#cfg-ai-on').checked = !!c.ai.enabled;
    $('#cfg-endpoint').value = c.ai.endpoint || '';
    $('#cfg-key').value = c.ai.key || '';
    $('#cfg-model').value = c.ai.model || '';
    // 第五轮 O10：音效开关与音量
    if ($('#cfg-sound-on')) $('#cfg-sound-on').checked = (c.sound ? c.sound.enabled !== false : true);
    if ($('#cfg-sound-vol')) $('#cfg-sound-vol').value = (c.sound && typeof c.sound.volume === 'number') ? c.sound.volume : 0.6;
    // 第十一轮：BGM 音量
    if ($('#cfg-music-vol')) $('#cfg-music-vol').value = (c.sound && typeof c.sound.musicVolume === 'number') ? c.sound.musicVolume : 0.35;
    if ($('#cfg-music-name') && window.Sound && Sound.music) {
      $('#cfg-music-name').textContent = Sound.music.name() || '—';
    }
  },
  saveSettings() {
    if (typeof GameConfig === 'undefined') return;
    const c = GameConfig.loadConfig();
    c.playerName = ($('#cfg-name').value || '').trim().slice(0, 12);
    c.difficulty = $('#cfg-diff').value;
    c.ai.tendency = $('#cfg-tendency').value;
    c.ai.personality = $('#cfg-personality').value;
    c.ai.dialogueStyle = $('#cfg-style').value;
    c.ai.enabled = $('#cfg-ai-on').checked;
    c.ai.endpoint = $('#cfg-endpoint').value.trim();
    c.ai.key = $('#cfg-key').value.trim();
    c.ai.model = $('#cfg-model').value.trim();
    // 第五轮 O10：音效配置
    c.sound = c.sound || { enabled: true, volume: 0.6 };
    if ($('#cfg-sound-on')) c.sound.enabled = $('#cfg-sound-on').checked;
    if ($('#cfg-sound-vol')) c.sound.volume = Math.max(0, Math.min(1, Number($('#cfg-sound-vol').value) || 0));
    // 第十一轮：BGM 音量
    if ($('#cfg-music-vol')) c.sound.musicVolume = Math.max(0, Math.min(1, Number($('#cfg-music-vol').value) || 0));
    GameConfig.saveConfig(c);
    if (typeof AI !== 'undefined' && AI.syncConfig) AI.syncConfig(c);   // 同步到 AI 模块
    if (window.Sound) {                                                 // 同步到音效模块
      Sound.setEnabled(c.sound.enabled);
      Sound.setVolume(c.sound.volume);
      if (Sound.setMusicVolume) Sound.setMusicVolume(c.sound.musicVolume);
      Sound.reloadConfig();
    }
    this.showScreen('screen-title');
  },
  resetSettings() {
    if (typeof GameConfig === 'undefined') return;
    GameConfig.resetConfig();
    this.fillSettings();
  },

  showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#' + id).classList.add('active');
    // 第十一轮：按界面驱动 BGM（标题页 / 游戏中 / 结局页 各一曲）
    try {
      if (window.Sound && Sound.music) {
        if (id === 'screen-game') Sound.music.setScene('game');
        else if (id === 'screen-end') Sound.music.setScene('ending');
        else if (id === 'screen-title') Sound.music.setScene('title');
        // 其余弹层（成就/记录/设置/抽卡）保持当前曲目不断
        if ($('#cfg-music-name')) $('#cfg-music-name').textContent = Sound.music.name() || '—';
      }
    } catch (e) { /* 静默降级 */ }
  },

  /* ---------- 开新局 ---------- */
  startRun() {
    this.meta = loadMeta();
    const s = Engine.newLife({ cycle: this.meta.cycle || 1, luckBonus: this.meta.luckBonus || 0 });
    this.renderTalents(s.talents);
    this.showScreen('screen-talent');
  },

  renderTalents(talents) {
    const box = $('#talent-cards');
    box.innerHTML = '';
    talents.forEach(t => {
      const effText = Object.keys(t.eff).map(k => {
        const v = t.eff[k];
        return `${ATTRS[k] ? ATTRS[k].name : k}${v > 0 ? '+' : ''}${v}`;
      }).join('　');
      const div = document.createElement('div');
      div.className = `talent-card r${t.rarity}`;
      div.innerHTML = `
        <div class="tc-rarity">${'★'.repeat(t.rarity)}</div>
        <div class="tc-name">${t.name}</div>
        <div class="tc-desc">${t.desc}</div>
        <div class="tc-eff">${effText || '——'}</div>`;
      box.appendChild(div);
    });
  },

  /* ---------- 进入游戏 ---------- */
  enterGame() {
    this.showScreen('screen-game');
    $('#log').innerHTML = '';
    // 第五轮：重置每局 UI 追踪状态（破境/寿元预警的基线）
    this._lastRenderedRealm = null;
    this._lastShouWarn = 0;
    this._barMap = {};
    this.renderLogs();
    this.renderStats();
    this.renderActButton();
    this.curEvent = null;
    // 新手引导（onboarding.js 存在时触发；老玩家自动跳过）
    if (window.Onboarding && Onboarding.maybeStart) Onboarding.maybeStart();
  },

  /* ---------- 渲染属性面板 ---------- */
  renderStats() {
    const s = Engine.state; if (!s) return;
    // 第六轮修复：渲染前兜底钳制六维属性到 [0,100]。
    //   作用：修正历史存档/异常路径可能残留的越界值（曾出现心性 151），
    //   保证 UI 永远显示合法数值。幂等，不影响合法数据。
    if (Engine && typeof Engine.clampAttrs === 'function') Engine.clampAttrs(s);
    const r = realmOf(s.power);

    // 破境检测：与上一次渲染的境界对比（第五轮 O3）
    if (this._lastRenderedRealm != null && r.index > this._lastRenderedRealm) {
      this.playBreakthroughFX(r);
      if (window.Sound) Sound.play('breakthrough');
    }
    this._lastRenderedRealm = r.index;

    $('#realm-badge').textContent = r.name;
    // 第五轮 O7：境界进度（当前修为 / 下一境界需求）
    this.renderRealmProgress(r, s.power);
    const who = s.playerName ? s.playerName : (this.meta.cycle > 1 ? `第${s.cycle}世` : '无名');
    $('#stat-name').textContent = who;
    $('#stat-age').textContent = s.age;
    const pl = PLACES[s.place] || PLACES.qingshi;
    $('#stat-place').textContent = `${pl.name} · ${pl.region}`;

    // 季节 / 年份徽章（第四轮新增；缺 season.js 时静默跳过）
    const seBox = $('#stat-season');
    if (seBox) {
      if (typeof Season !== 'undefined') {
        const se = Season.seasonOf(s);
        const yr = Season.yearOf(s);
        const act = (s.actionsThisYear || 0);
        seBox.innerHTML = `<span class="season-badge season-${se.key}">${se.name}</span>`
          + `<span class="season-year">第 ${yr} 年 · 本年第 ${act} 次行动</span>`;
      } else if (s.season) {
        seBox.innerHTML = `<span class="season-badge">${s.season}</span>`;
      } else {
        seBox.innerHTML = '';
      }
    }

    const fac = s.faction ? FACTIONS[s.faction] : null;
    const fb = $('#faction-badge');
    if (fac) { fb.textContent = fac.name + ' · ' + fac.align; fb.style.color = fac.color; fb.style.display = ''; }
    else fb.style.display = 'none';

    // 属性条：以 100 为满
    const order = ['gen','wu','ji','xin','jian','dan'];
    const colors = { gen:'#8a6d2a', wu:'#5b8dd6', ji:'#8b6fb5', xin:'#5f8f5a', jian:'#b9424a', dan:'#2f9e6b' };
    const bars = $('#bars');
    bars.innerHTML = '';
    this._barMap = {};   // 第五轮 O2：缓存属性条 DOM，供飘字/闪动定位
    order.forEach(k => {
      const v = Math.max(0, Math.min(100, s[k] || 0));
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.title = ATTRS[k].desc || '';          // 第五轮 O7：悬停释义
      // 第五轮 O7：点击弹出释义卡（移动端无 hover，点击更通用）
      row.style.cursor = 'pointer';
      row.onclick = () => this.explainAttr(k, s);
      row.innerHTML = `
        <div class="bar-top"><span>${ATTRS[k].icon} ${ATTRS[k].name}</span><b>${s[k]}</b></div>
        <div class="bar-track"><div class="bar-fill" style="width:${v}%;background:${colors[k]}"></div></div>`;
      bars.appendChild(row);
      this._barMap[k] = row;
    });
    // 寿元单列（第五轮 O4：告急三档预警）
    const shouRow = document.createElement('div');
    shouRow.className = 'bar-row';
    const sv = Math.max(0, Math.min(100, (s.shou / 200) * 100));
    const warnLv = this.shouWarnLevel(s.shou);
    if (warnLv) shouRow.classList.add('shou-' + warnLv);
    shouRow.title = '寿元：你剩余的年岁。每年过冬消耗，破境可回补。归零即寿终。';
    shouRow.innerHTML = `
      <div class="bar-top"><span>⏳ 寿元${warnLv ? ' ' + ({caution:'▲',danger:'▲▲',critical:'▲▲▲'}[warnLv]) : ''}</span><b>${Math.max(0,s.shou)}</b></div>
      <div class="bar-track"><div class="bar-fill" style="width:${sv}%;background:${warnLv === 'critical' ? '#b9424a' : (warnLv === 'danger' ? '#c06a2a' : '#b08d3f')}"></div></div>`;
    bars.appendChild(shouRow);
    this._barMap.shou = shouRow;
    // 预警音效：仅在等级「变差」时响一次（避免每步都响）
    const rank = { caution: 1, danger: 2, critical: 3 };
    const cur = rank[warnLv] || 0;
    if (cur > (this._lastShouWarn || 0)) { if (window.Sound) Sound.play('warn'); }
    this._lastShouWarn = cur;

    // 情感：三角色（角色 B/C 的字段为可选，旧存档缺失时按 0 处理，不显示未触及的角色）
    const ar = $('#affect-row');
    let affHtml = '';
    if (typeof CHARACTERS !== 'undefined') {
      CHARACTERS.forEach(ch => {
        const name = s[ch.nameField];
        const val = (ch.legacy ? s.affection : s[ch.affField]) || 0;
        const touched = ch.legacy
          ? (s.flags.met_her || val > 0)
          : (val > 0 || (s.charFlags && s.charFlags[ch.key + '_met']));
        if (!name || !touched) return;
        const isBest = s.aff_best === ch.key;
        // 第七轮：已决裂的角色显示「已撇清」，好感不再以心心呈现（但其数值仍保留，
        //   以便玩家理解"关系已成定局"，且不破坏旧存档字段）。
        const refused = !!(window.Characters && Characters.isRefused && Characters.isRefused(s, ch.key));
        if (refused) {
          affHtml += `<div class="aff-line aff-refused"${isBest ? ' style="font-weight:600"' : ''}><span>♡ ${name}</span><span>已撇清</span></div>`;
          return;
        }
        const hearts = Math.max(0, Math.min(5, Math.round(val / 15)));
        affHtml += `<div class="aff-line"${isBest ? ' style="font-weight:600"' : ''}><span>♡ ${name}${isBest ? ' ✦' : ''}</span><span>${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)} ${val}</span></div>`;
      });
    } else if (s.herName && (s.flags.met_her || s.affection > 0)) {
      const hearts = Math.max(0, Math.min(5, Math.round(s.affection / 15)));
      affHtml = `<div class="aff-line"><span>♡ ${s.herName} 好感</span><span>${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)} ${s.affection}</span></div>`;
    }
    ar.innerHTML = affHtml;

    // 婚后状态行（第九轮新增）：仅已婚时显示，展示 家财 / 心累 / 子女
    //   全部数据走 Characters 访问器，旧存档无字段时自动按默认值显示，
    //   未婚（isMarried 为 false）时不渲染，保证婚前 UI 与旧版完全一致。
    const fam = $('#family-row');
    if (fam) {
      const C = window.Characters;
      if (C && C.isMarried && C.isMarried(s)) {
        const money = C.getMoney(s);
        const stress = C.getStress(s);
        const kids = C.getKids(s);
        const kdBrief = kids.length
          ? kids.map(k => `${k.name}(${k.age})`).join('、')
          : '尚无';
        const stressTxt = stress >= 85 ? '濒临崩溃' : (stress >= 60 ? '积压' : (stress >= 30 ? '微澜' : '安宁'));
        fam.innerHTML =
          `<div class="fam-line"><span>💰 家财</span><span>${money} 两</span></div>`
          + `<div class="fam-line${stress >= 60 ? ' fam-stress' : ''}"><span>🌀 心累</span><span>${stress} · ${stressTxt}</span></div>`
          + `<div class="fam-line"><span>👶 子女</span><span>${kdBrief}</span></div>`;
      } else {
        fam.innerHTML = '';
      }
    }
  },

  /* ---------- 第五轮 O4：寿元告急档位 ----------
     以「软上限」为基准的比例分三档：35% / 18% / 8%。返回 '' 表示安全。 */
  SHOU_WARN: { caution: 0.35, danger: 0.18, critical: 0.08 },
  shouWarnLevel(shou) {
    const bal = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.balance) || {};
    const startShou = bal.startShou != null ? bal.startShou : 60;
    const softCap = startShou * (bal.shouCapMultiplier || 1.8);
    const ratio = softCap > 0 ? (shou / softCap) : 1;
    if (ratio <= this.SHOU_WARN.critical) return 'critical';
    if (ratio <= this.SHOU_WARN.danger) return 'danger';
    if (ratio <= this.SHOU_WARN.caution) return 'caution';
    return '';
  },

  /* ---------- 第五轮 O7：境界进度条 ---------- */
  renderRealmProgress(realm, power) {
    const box = $('#realm-progress');
    if (!box) return;
    const next = (typeof REALMS !== 'undefined') ? REALMS[realm.index + 1] : null;
    if (!next) {
      box.innerHTML = '<div class="rp-label">已臻 <b>圆满</b></div>';
      return;
    }
    const lo = realm.need || 0;
    const hi = next.need || 1;
    const pct = Math.max(0, Math.min(100, ((power - lo) / Math.max(1, hi - lo)) * 100));
    box.innerHTML = `
      <div class="rp-label">修为 <b>${power}</b> / 下一境「${next.name}」需 ${hi}</div>
      <div class="rp-track"><div class="rp-fill" style="width:${pct}%"></div></div>`;
  },

  /* ---------- 第五轮 O7：属性释义卡 ---------- */
  explainAttr(key, s) {
    const a = ATTRS[key];
    if (!a) return;
    if (window.Sound) Sound.play('click');
    const layer = document.getElementById('attr-explain');
    if (layer) layer.remove();
    const box = document.createElement('div');
    box.id = 'attr-explain';
    box.className = 'attr-explain';
    box.innerHTML = `
      <div class="ae-card">
        <div class="ae-title">${a.icon} ${a.name} <span class="ae-val">当前 ${s[key] || 0}</span></div>
        <div class="ae-desc">${a.desc || ''}</div>
        <div class="ae-hint">${this.ATTR_HINT[key] || ''}</div>
      </div>`;
    box.onclick = () => box.remove();
    document.body.appendChild(box);
    setTimeout(() => { if (box.parentNode) box.remove(); }, 6000);
  },
  ATTR_HINT: {
    gen: '根骨决定修炼根基，影响修为增长速度。',
    wu:  '悟性是领悟剑意与丹理的天赋，与根骨一同决定成长速度。',
    ji:  '机缘影响奇遇、秘宝与贵人的出现概率。',
    xin: '心性影响心魔试炼、抉择走向与部分结局达成。',
    jian:'剑意是剑道修为，影响战斗类事件成败与剑修结局。',
    dan: '丹心是炼丹造诣，影响丹道事件与济世类结局。',
  },

  /* ---------- 第五轮 O3：破境全屏光效 ---------- */
  playBreakthroughFX(realm) {    const layer = $('#cg-layer') || document.body;
    const fx = document.createElement('div');
    fx.className = 'fx-breakthrough';
    fx.innerHTML = `<div class="bt-ring"></div><div class="bt-text">破境 · ${realm.name}</div>`;
    layer.appendChild(fx);
    setTimeout(() => { fx.classList.add('fade'); setTimeout(() => fx.remove(), 600); }, 1100);
  },

  /* ---------- 第五轮 O2：数值变化飘字 + 属性条闪动 ---------- */
  floatDelta(key, delta, anchorRow) {
    const row = anchorRow || (this._barMap && this._barMap[key]);
    if (!row) return;
    const up = delta > 0;
    const tag = document.createElement('span');
    tag.className = 'float-delta ' + (up ? 'up' : 'down');
    tag.textContent = (up ? '+' : '') + delta;
    row.style.position = 'relative';
    row.appendChild(tag);
    setTimeout(() => tag.remove(), 900);
    row.classList.remove('bar-flash-up', 'bar-flash-down');
    void row.offsetWidth;                       // 重置动画
    row.classList.add(up ? 'bar-flash-up' : 'bar-flash-down');
    setTimeout(() => row.classList.remove('bar-flash-up', 'bar-flash-down'), 650);
  },


  /* ---------- 渲染日志 ---------- */
  renderLogs() {
    const s = Engine.state; if (!s) return;
    const el = $('#log');
    el.innerHTML = '';
    s.logs.forEach(l => el.appendChild(this.mkEntry(l.text, l.type)));
    this.scrollLog();
  },
  mkEntry(text, type) {
    const d = document.createElement('div');
    d.className = 'entry ' + (type || 'narr');
    d.textContent = text;
    return d;
  },
  pushLog(text, type) {
    const el = $('#log');
    el.appendChild(this.mkEntry(text, type));
    this.scrollLog();
  },
  scrollLog() { const el = $('#log'); el.scrollTop = el.scrollHeight; },

  /* ---------- 行动按钮 ---------- */
  renderActButton() {
    const area = $('#choice-area');
    area.innerHTML = `<button class="btn btn-primary btn-big" id="btn-act">向前一步</button>`;
    $('#btn-act').onclick = () => this.act();
  },

  /* ---------- 一次行动 ---------- */
  async act() {
    if (this.busy) return;
    this.busy = true;
    if (window.Sound) Sound.play('click');
    const res = Engine.step();
    this.renderStats();

    if (!res || res.type === 'death') {
      if (window.Sound) Sound.play('death');
      this.finish('寿元耗尽');
      this.busy = false;
      return;
    }
    if (res.type === 'idle') {
      this.pushLog('这一年，什么都没有发生。你只是又老了一岁。', 'narr');
      // 第五轮修复：idle 分支此前不检查结局 —— 若已满足结局条件将永远无法触发。
      // 现补上 checkEnding，且保证无论结果如何按钮区都有可用按钮（不再出现"无按钮"卡死）。
      if (this.checkEnding()) { this.busy = false; return; }
      this.renderActButton();
      this.busy = false;
      return;
    }

    const e = res.event;
    // 情境前缀（AI / 本地）
    const prefix = await AI.textFor(e, Engine.state);
    this.pushLog(e.title, e.priority === 900 ? 'title marry' : (e.priority >= 500 ? 'title important' : 'title'));
    this.pushLog(prefix, 'narr');
    if (e.priority === 900 && window.Sound) Sound.play('marry');
    // 事件级 CG（本轮补齐：此前仅 choice 级与链式 nx.cg 会展示，事件自带 cg 被漏掉）
    if (e.cg) this.showCG(e.cg);
    this.curEvent = e;
    this.renderChoices(e);
    this.busy = false;
  },

  renderChoices(event) {
    const area = $('#choice-area');
    area.innerHTML = '<div class="choices"></div>';
    const box = area.querySelector('.choices');
    const isMarry = event.priority === 900;
    // 第六轮修复：为本次事件分配一个"行动序号令牌"。
    //   选项按钮被点击时校验令牌是否仍等于当前值 —— 过期（已被消费）的按钮点击直接忽略。
    //   这样即便移动端连点/合成 click 在 busy 释放后再次触发同一按钮，也不会二次结算。
    this._choiceToken = (this._choiceToken || 0) + 1;
    const token = this._choiceToken;
    event.choices.forEach((c, i) => {
      const b = document.createElement('button');
      // 第七轮（选项平权）：婚姻事件的三类分支不再以高亮/弱化暗示倾向。
      //   统一挂 'choice-marry' 仅用于左侧 2px 细色条区分语义：
      //     isMarriageAccept === true  → marry-yes（同意）
      //     isMarriageAccept === false → marry-no（拒绝）
      //     其余（暂缓/其他）           → marry-postpone
      b.className = 'choice-btn';
      if (isMarry) {
        b.classList.add('choice-marry');
        if (c.isMarriageAccept === true) b.classList.add('marry-yes');
        else if (c.isMarriageAccept === false) b.classList.add('marry-no');
        else b.classList.add('marry-postpone');
      }
      b.innerHTML = `<span>${c.text}</span><span class="choice-hint">${c.hint || ''}</span>`;
      b.onclick = () => {
        // 令牌过期 = 本次事件已被消费，直接丢弃这次点击
        if (this._choiceToken !== token) return;
        this.choose(event, c);
      };
      box.appendChild(b);
    });
  },

  async choose(event, choice) {
    if (this.busy) return;
    this.busy = true;
    // 第六轮修复（防连点重复叠加）：进入即作废令牌并禁用全部选项按钮。
    //   仅在首次进入时有效；后续重复点击因令牌已变/按钮已 disabled 而被拦下。
    this._choiceToken = (this._choiceToken || 0) + 1;
    const area = $('#choice-area');
    if (area) {
      area.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.add('choice-used'); });
    }
    if (window.Sound) Sound.play('choice');
    this.pushLog('› ' + choice.text, 'choice');
    // Engine.apply 自身带幂等令牌（claimChoice），是防重复的最后一道防线
    const diff = Engine.apply(choice);
    // 显示属性变化
    const txt = diff.map(d => {
      let name;
      if (ATTRS[d.k]) name = ATTRS[d.k].name;
      else if (d.k === 'power') name = '修为';
      else if (d.k === 'affection') name = '好感';
      else if (d.k === 'affection_sister') name = (Engine.state.sisterName || '师姐') + '好感';
      else if (d.k === 'affection_third') name = (Engine.state.herName2 || '她') + '好感';
      else name = d.k;
      return `${name}${d.d > 0 ? '+' : ''}${d.d}`;
    }).join('　');

    this.renderStats();
    // 第五轮 O2：逐项飘字 + 属性条闪动 + 正负音效
    if (diff && diff.length) {
      diff.forEach(d => {
        const row = (this._barMap && this._barMap[d.k]) || null;
        this.floatDelta(d.k, d.d, row);
      });
      const allUp = diff.every(d => d.d > 0);
      const allDown = diff.every(d => d.d < 0);
      if (window.Sound) {
        if (allUp) Sound.play('good');
        else if (allDown) Sound.play('bad');
      }
    }
    // 选项 CG（若该选项触发了 CG 展示）
    if (choice.cg) this.showCG(choice.cg);

    // 若选项有 next，进入后续事件（去重标记统一由 Engine.resolveNext 完成）
    if (choice.next) {
      const nx = Engine.resolveNext(choice, Engine.state);
      if (nx && nx.choices && nx.choices.length) {
        const txt2 = await AI.textFor(nx, Engine.state);
        if (txt) this.pushLog(txt, 'diff');
        this.pushLog(nx.title, 'title');
        this.pushLog(txt2, 'narr');
        if (nx.cg) this.showCG(nx.cg);
        this.curEvent = nx;
        this.renderChoices(nx);
        this.busy = false;
        return;
      }
      // nx 缺失或无选项 —— 不再穿透渲染空区域，改为兜底重建行动按钮
    }

    if (txt) {
      const allBad = diff.every(d => d.d < 0);
      this.pushLog(txt, 'diff' + (allBad ? ' bad' : ''));
    }
    // 结局触发检查
    if (this.checkEnding()) { this.busy = false; return; }
    // 第五轮修复 + 第八轮加固：无论前面走哪条路径，未结算时一定保证有「可用」按钮，
    //   杜绝"无按钮/按钮失效"卡死。
    //   第八轮 BUG：原判断只看 `querySelector('button')` 是否存在 —— 而 choose() 入口
    //   已把本轮的选项按钮全部 disabled + choice-used，于是"存在但不可点"的按钮骗过了
    //   这个守卫，导致既没有新选项、也没有「向前一步」，玩家彻底卡死。
    //   现在改为：只要当前区域**没有可点击的按钮**，就清空并重建行动按钮。
    if ($('#screen-game').classList.contains('active')) {
      const anyUsable = [...$('#choice-area').querySelectorAll('button')].some(b => !b.disabled);
      if (!anyUsable) this.renderActButton();
    }
    this.busy = false;
  },

  /* ---------- CG 展示 ---------- */
  /* CG 资源按约定路径 resources/cg/<id>.png 加载；
     同一节点多张图按 <id>_1.png <id>_2.png ... 随机切换；
     文件缺失时自动降级为占位图（水墨风纯 CSS 卡片），不阻塞游戏流程。
     去重：本周目内同一 CG id 只展示一次（s.cgSeenThisRun）。 */
  showCG(cgId) {
    const s = Engine.state;
    if (!s || !cgId) return;
    if (s.cgSeenThisRun) {
      if (s.cgSeenThisRun[cgId]) return;
      s.cgSeenThisRun[cgId] = true;
    }
    const layer = $('#cg-layer');
    if (!layer) return;
    const n = 3;                                  // 每个节点最多预留 3 张备选
    const idx = 1 + Math.floor(Math.random() * n);
    const cands = [`resources/cg/${cgId}_${idx}.png`, `resources/cg/${cgId}.png`];
    const card = document.createElement('div');
    card.className = 'cg-card';
    card.innerHTML = `
      <div class="cg-placeholder">
        <div class="cg-ph-ink"></div>
        <div class="cg-ph-label">CG · ${cgId}</div>
        <div class="cg-ph-note">（占位图：将美术资源放入 resources/cg/${cgId}_1.png 等即可自动替换）</div>
      </div>`;
    const img = document.createElement('img');
    img.className = 'cg-img';
    img.style.display = 'none';
    img.alt = cgId;
    let ci = 0;
    img.onload = () => { img.style.display = ''; card.querySelector('.cg-placeholder').style.display = 'none'; };
    img.onerror = () => { ci++; if (ci < cands.length) img.src = cands[ci]; };
    img.src = cands[0];
    card.appendChild(img);
    card.onclick = () => card.remove();
    layer.appendChild(card);
    // 6 秒后自动淡出
    setTimeout(() => { card.classList.add('fade'); setTimeout(() => card.remove(), 800); }, 6000);
  },

  /* ---------- 结局检查 ---------- */
  checkEnding() {
    const s = Engine.state;
    const cf = s.charFlags || {};
    // 主动归隐 / 回到过去 / 渡劫成功 / 归凡 / 成婚 且年岁够
    const force = (s.flags.hermit && s.age >= 80) ||
                  (s.flags.return_past && s.step >= 3) ||
                  (s.flags.tribulation_win && s.power >= 1200) ||
                  (s.flags.return_mortal && s.age >= 40) ||
                  ((cf.herb_married_ready || cf.sister_married_ready || cf.third_married_ready) && s.age >= 40) ||
                  (s.age >= 200 && s.power >= 400);
    if (force) { this.finish('天命已至'); return true; }
    // 步数上限：maxSteps 为 null（第四轮已移除）时的保险丝——
    //   仅作为「寿元收支一旦配错」的兜底，正常玩法永远碰不到。
    //   上限值由 GAME_CONFIG.balance.hardStepCap 控制（默认 300）。
    const capCfg = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG && GAME_CONFIG.balance) || {};
    const HARD_STEP_CAP = capCfg.hardStepCap || 300;
    const cap = (typeof s.maxSteps === 'number' && s.maxSteps > 0) ? s.maxSteps : HARD_STEP_CAP;
    if (s.step >= cap) { this.finish('寿元将尽'); return true; }
    return false;
  },

  /* ---------- 结算 ---------- */
  async finish(reason) {
    const s = Engine.state;
    const ending = Engine.judgeEnding(reason);
    const flavor = AI.endingFlavor(ending, s);
    if (window.Sound) Sound.play('ending');
    const meta = Engine.settle();

    this.showScreen('screen-end');
    // 结局 CG（若存在对应资源则展示；缺失时静默跳过，不阻塞结算）
    const endCgMap = {
      marry_herb: 'cg_end_marry_herb',
      marry_sister: 'cg_end_marry_sister',
      marry_third: 'cg_end_marry_third',
      return_mortal_herb: 'cg_end_marry_herb',
      return_mortal_sister: 'cg_end_marry_sister',
      return_mortal_third: 'cg_end_marry_third',
      return_mortal_alone: 'cg_end_return_alone',
    };
    const endCg = endCgMap[ending.id];
    const endCgBox = $('#end-cg');
    if (endCgBox) {
      endCgBox.innerHTML = '';
      if (endCg) {
        const im = document.createElement('img');
        im.className = 'end-cg-img';
        im.src = `resources/cg/${endCg}_1.png`;
        im.alt = ending.name;
        im.onerror = () => { im.remove(); };
        endCgBox.appendChild(im);
      }
    }
    const rank = $('#end-rank');
    rank.textContent = ending.rank;
    rank.className = 'end-rank ' + ending.rank[0];
    $('#end-name').textContent = ending.name;
    $('#end-desc').textContent = ending.desc + (flavor ? ' ' + flavor : '');

    const r = realmOf(s.power);
    const stats = [
      ['活到', s.age + ' 岁'],
      ['境界', r.name],
      ['修为', s.power],
      ['剑意', s.jian],
      ['丹心', s.dan],
      ['心性', s.xin],
      ['机缘', s.ji],
      ['悟性', s.wu],
    ];
    if (s.herName && s.affection > 0) stats.push([s.herName + ' 好感', s.affection]);
    if (s.sisterName && s.affection_sister > 0) stats.push([s.sisterName + ' 好感', s.affection_sister]);
    if (s.herName2 && s.affection_third > 0) stats.push([s.herName2 + ' 好感', s.affection_third]);
    $('#end-stats').innerHTML = stats.map(([k, v]) => `<div class="end-stat">${k} <b>${v}</b></div>`).join('');

    const ach = [...s.achievementsThisRun].map(id => {
      const a = ACHIEVEMENTS.find(x => x.id === id);
      return a ? `<span class="tag">${a.icon} ${a.name}</span>` : '';
    }).join('');
    $('#end-ach').innerHTML = ach;

    // 第五轮 O11：成就解锁音效 + 庆祝粒子
    if (s.achievementsThisRun && s.achievementsThisRun.size > 0) {
      if (window.Sound) Sound.play('achievement');
      this.celebrate(s.achievementsThisRun.size);
    }

    this.meta = meta;
    $('#cycle-num').textContent = meta.cycle;
    $('#ach-count').textContent = `${(meta.achievements || []).length}/${ACHIEVEMENTS.length}`;
    $('#run-count').textContent = (meta.runs || []).length;
  },

  /* ---------- 第五轮 O11：结局庆祝（纯 CSS 粒子） ---------- */
  celebrate(count) {
    const n = Math.min(60, 20 + count * 8);
    const layer = document.createElement('div');
    layer.className = 'celebrate-layer';
    let html = '';
    for (let i = 0; i < n; i++) {
      const l = Math.random() * 100, d = Math.random() * 1.2, dur = 1.6 + Math.random() * 1.4;
      html += `<span style="left:${l}%;animation-delay:${d}s;animation-duration:${dur}s">✦</span>`;
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 5000);
  },

  /* ---------- 成就页 ---------- */
  showAchievements() {
    const m = loadMeta();
    const got = m.achievements || [];
    $('#ach-grid').innerHTML = ACHIEVEMENTS.map(a => `
      <div class="ach-item ${got.includes(a.id) ? 'on' : ''}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>`).join('');
    this.showScreen('screen-ach');
  },

  /* ---------- 周目记录页 ---------- */
  showHistory() {
    const m = loadMeta();
    const runs = m.runs || [];
    const box = $('#history-list');
    if (!runs.length) {
      box.innerHTML = '<div class="empty-hint">还没有完成任何一世。<br>去写第一个故事吧。</div>';
    } else {
      box.innerHTML = runs.map(r => {
        const evs = (r.keyEvents || []).slice(-8).map(e =>
          `<span class="ev">${e.event}：${e.choice}</span>`).join('');
        const tags = (r.achievements || []).map(id => {
          const a = ACHIEVEMENTS.find(x => x.id === id);
          return a ? `<span class="tag">${a.icon} ${a.name}</span>` : '';
        }).join('');
        return `<div class="hist-item">
          <div class="hist-head">
            <span class="hist-cycle">第 ${r.cycle} 世 · ${r.time}</span>
            <span><span class="hist-end">${r.ending}</span><span class="hist-rank">${r.rank}</span></span>
          </div>
          <div class="hist-meta">
            <span>享年 ${r.age} 岁</span>
            <span>境界 ${r.realm}</span>
            <span>天赋 ${(r.talents || []).join('、')}</span>
          </div>
          <div class="hist-events">${evs || '<span class="ev">平淡的一生</span>'}</div>
          ${tags ? `<div class="hist-tags">${tags}</div>` : ''}
        </div>`;
      }).join('');
    }
    this.showScreen('screen-history');
  },
};

document.addEventListener('DOMContentLoaded', () => UI.init());
window.UI = UI;
