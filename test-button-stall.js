/* ============================================================
   第八轮专项测试：选项按钮「跳转失效 / 卡死」回归
   ------------------------------------------------------------
   BUG 复现路径（用户报告："事件无法正常跳转到下一个，按键失效"）：
     1. 玩家点击某个无 next 的独立事件选项 → choose() 入口把本轮按钮
        全部置为 disabled + choice-used；
     2. choose() 走完属性结算后应重建「向前一步」按钮，
        但旧守卫 `!querySelector('button')` 只判断"是否存在按钮"——
        被 disabled 的按钮骗过 → 既不重建按钮，也没有新选项 → 彻底卡死。
   本测试用一个「状态化 DOM 桩」（真实记录 innerHTML 与按钮 disabled 态），
   模拟连续点击，断言：任何一次点击之后，choice-area 必须存在**可用**按钮。
   ============================================================ */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = 'D:/低质小游戏/剑与丹';

/* ---------- 状态化 DOM 桩 ---------- */
function makeButton(text) {
  const b = {
    tagName: 'BUTTON', _text: text || '', innerHTML: text || '', disabled: false, onclick: null, style: {}, dataset: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); return on; },
    },
    get className() { return [...this.classList._s].join(' '); },
    set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get textContent() { return this._text; },
    get outerHTML() { return `<button class="${this.className}"${this.disabled ? ' disabled' : ''}>${this._text}</button>`; },
    appendChild() { }, remove() { }, addEventListener() { }, focus() { },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 30 }; },
    offsetWidth: 100,
  };
  return b;
}

/* 解析一段 innerHTML 里的 <button>，生成按钮对象 + 文本 */
function parseButtons(html) {
  const out = [];
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const text = inner.replace(/<[^>]+>/g, '').trim();
    const b = makeButton(text);
    if (/\bdisabled\b/.test(attrs)) b.disabled = true;
    const cls = /class="([^"]*)"/.exec(attrs);
    if (cls) b.className = cls[1];
    out.push(b);
  }
  return out;
}

function makeArea() {
  const area = {
    _html: '',
    _buttons: [],
    style: {}, dataset: {}, textContent: '', disabled: false, scrollTop: 0, scrollHeight: 0, offsetWidth: 100,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); },
    },
    appendChild(child) {
      this._buttons.push(child);
      this._html += (child.outerHTML || `<button>${child.textContent}</button>`);
      return child;
    },
    removeChild(c) { this._buttons = this._buttons.filter(x => x !== c); },
    remove() { }, addEventListener() { }, focus() { },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 30 }; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this._buttons = parseButtons(this._html); },
    querySelector(sel) {
      if (sel === '.choices') return this;          // 简化：.choices 即本容器
      if (sel === 'button') return this._buttons[0] || null;
      return null;
    },
    querySelectorAll(sel) {
      if (!sel || sel === 'button') return this._buttons.slice();
      return [];
    },
  };
  return area;
}

const els = {};
const area = makeArea();
els['#choice-area'] = area;
els['#screen-game'] = {
  classList: { _s: new Set(['active']), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); } },
};
const store = {};
const sb = {
  console, Math, JSON, Object, Array, Date, Set, Map, Number, String, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } },
  setTimeout: f => { try { if (typeof f === 'function') f() } catch (e) { } return 0 }, clearTimeout: () => { },
  document: {
    querySelector(s) { return els[s] || (els[s] = makeArea()); },
    querySelectorAll() { return []; },
    getElementById(id) { return els['#' + id] || (els['#' + id] = makeArea()); },
    createElement(t) { return t === 'button' ? makeButton('') : makeArea(); },
    addEventListener() { }, body: makeArea(),
  },
  confirm: () => true,
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
['data.js', 'config.js', 'config-data.js', 'audio.js', 'season.js', 'characters.js', 'events.js', 'events-chars.js', 'engine.js', 'ai.js', 'onboarding.js', 'ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), sb, { filename: f }));

const E = sb.Engine, U = sb.UI;
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (e ? '  → ' + e : '')); } };

const usable = () => area.querySelectorAll('button').filter(b => !b.disabled);

console.log('========== 1. renderActButton 产出可用按钮 ==========');

(async () => {
U.startRun(); U.enterGame();
area.innerHTML = '';
U.renderActButton();
ok('renderActButton 后有可用按钮', usable().length >= 1, JSON.stringify(usable().map(b => b.textContent)));
ok('按钮文本为「向前一步」', usable().some(b => /向前一步/.test(b.textContent)));

console.log('\n========== 2. 核心 BUG：点击选项后必须恢复可用按钮 ==========');
{
  // 构造一个无 next 的独立事件，直接走 choose()
  U.startRun(); U.enterGame();
  const ev = {
    id: 'test_standalone', title: '测试事件', priority: 0,
    choices: [
      { text: '选项A', apply: s => { s.xin += 5; } },
      { text: '选项B', apply: s => { s.wu += 5; } },
    ],
  };
  U.curEvent = ev;
  U.renderChoices(ev);
  ok('渲染出 2 个选项且均可点', usable().length === 2, String(usable().length));

  // 模拟点击第一个选项（真调 choose）
  const before = usable().length;
  await U.choose(ev, ev.choices[0]);
  const after = usable().length;
  ok('点击后仍存在可用按钮（不得卡死）', after >= 1, `点击前 ${before} → 点击后 ${after}`);
  ok('点击后按钮为「向前一步」', usable().some(b => /向前一步/.test(b.textContent)),
     JSON.stringify(usable().map(b => b.textContent)));
}

console.log('\n========== 3. 连续 N 次「行动 → 点选项」不得卡死 ==========');
{
  U.startRun(); U.enterGame();
  let stall = 0, rounds = 0, noChoiceRounds = 0;
  for (let i = 0; i < 120; i++) {
    rounds++;
    const us = usable();
    if (!us.length) { stall++; if (stall > 3) break; continue; }
    const actBtn = us.find(b => /向前一步/.test(b.textContent));
    if (actBtn) {
      // 推进一回合
      await U.act();
      continue;
    }
    // 选项按钮
    noChoiceRounds++;
    const target = us[0];
    const ev = U.curEvent;
    const choice = ev && ev.choices ? ev.choices.find(c => (c.text || '').trim() === (target.textContent || '').trim()) : null;
    if (choice) await U.choose(ev, choice);
    else { // 找不到就退化为直接点按钮（按钮 onclick 未绑定，跳过）
      break;
    }
    if (E.state && E.state.dead) break;
  }
  ok('120 轮无卡死', stall === 0, 'stall=' + stall);
  ok('实际经历了选项点击', noChoiceRounds > 0, 'choiceRounds=' + noChoiceRounds);
  ok('引擎状态推进正常', E.state.step > 0, 'step=' + E.state.step);
}

console.log('\n========== 4. 边界：choice.next 指向缺失事件时也要兜底 ==========');
{
  U.startRun(); U.enterGame();
  const ev = {
    id: 'test_next_missing', title: '链式事件', priority: 0,
    choices: [{ text: '下一步', next: '不存在的id', apply: s => { s.xin += 1; } }],
  };
  U.curEvent = ev;
  U.renderChoices(ev);
  let crashed = null;
  try { await U.choose(ev, ev.choices[0]); } catch (e) { crashed = e.message; }
  ok('next 缺失时不抛错', !crashed, crashed);
  ok('next 缺失后仍有可用按钮（兜底成功）', usable().length >= 1, String(usable().length));
}

console.log(`\n============================================`);
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
if (fail === 0) console.log('✅ 按钮跳转/卡死回归全部通过');
else console.log('❌ 存在未通过项');
process.exit(fail ? 1 : 0);
})();
