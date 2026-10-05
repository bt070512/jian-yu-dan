/* ============================================================
   第九轮 · 婚后系统浏览器集成测试（jsdom 真实 DOM + 真实点击）
   ------------------------------------------------------------
   目的：验证「婚后事件库」在真实 index.html 环境下：
     1. 婚后状态行（家财 / 心累 / 子女）能正确渲染
     2. 婚后事件能真实出现并被点击，不卡死
     3. 链式 next 事件能接续渲染
     4. 婚后长期点击 60 轮无「按键失效」
   运行：node test-post-marriage-ui.js（需 jsdom）
   ============================================================ */
const fs = require('fs'), path = require('path');
const dir = __dirname;
const NM = 'C:/Users/wdmxr/.workbuddy/binaries/node/workspace/node_modules';
const { JSDOM } = require(path.join(NM, 'jsdom'));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

(async () => {
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      // localStorage 桩
      const store = {};
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] }, clear: () => { } },
        writable: true,
      });
    },
  });
  const { window } = dom;
  const doc = window.document;

  // 手动加载脚本（file:// 下 jsdom 的 resources 对本地相对路径支持不稳，显式注入更可控）
  const scripts = ['data.js', 'config.js', 'config-data.js', 'audio.js', 'season.js', 'characters.js', 'events.js', 'events-chars.js', 'engine.js', 'ai.js', 'onboarding.js', 'ui.js'];
  for (const f of scripts) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    const el = doc.createElement('script');
    el.textContent = code;
    doc.body.appendChild(el);
  }
  // 触发 DOMContentLoaded 以初始化 UI
  doc.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  const UI = window.UI, E = window.Engine, C = window.Characters;
  ok('全局 UI / Engine / Characters 已就绪', !!UI && !!E && !!C);

  console.log('\n========== 1. 婚后状态行渲染 ==========');
  // 构造一个已婚状态并渲染
  E._appliedChoices = null;
  const s = E.newLife({ cycle: 1, luckBonus: 0 });
  s.spouse_id = 'herb'; s.marriageLocked = true; s.flags.married = true; s.flags.married_to = 'herb';
  s.charFlags.herb_married_ready = true; s.charFlags.marriedDone = { herb: true };
  s.charFlags.herb_met = true;
  s.year = 6; s.age = 32;
  s.familyFlags = { post_open_done: true };
  s.money = 77; s.stress = 65;
  C.addKid(s, { name: '阿宝', gender: 'm', trait: '剑' });
  C.getKids(s)[0].age = 6;
  E.state = s;
  UI.renderStats();
  const fam = doc.querySelector('#family-row');
  ok('婚后状态行已渲染内容', fam && fam.innerHTML.length > 0, fam ? fam.innerHTML.slice(0, 80) : 'null');
  ok('家财正确显示 77 两', fam && /77\s*两/.test(fam.textContent), fam && fam.textContent);
  ok('心累正确显示 65', fam && /65/.test(fam.textContent));
  ok('子女正确显示阿宝', fam && /阿宝/.test(fam.textContent));
  ok('高心累触发样式 fam-stress', fam && /fam-stress/.test(fam.innerHTML));

  // 未婚时应为空
  E._appliedChoices = null;
  const single = E.newLife({ cycle: 1, luckBonus: 0 });
  single.age = 25; single.year = 3;
  E.state = single;
  UI.renderStats();
  const fam2 = doc.querySelector('#family-row');
  ok('未婚时婚后状态行为空', !fam2 || fam2.innerHTML === '', fam2 && fam2.innerHTML.slice(0, 40));

  console.log('\n========== 2. 婚后事件真实点击流程 ==========');
  E._appliedChoices = null;
  const s2 = E.newLife({ cycle: 1, luckBonus: 0 });
  s2.spouse_id = 'herb'; s2.marriageLocked = true; s2.flags.married = true; s2.flags.married_to = 'herb';
  s2.charFlags.herb_married_ready = true; s2.charFlags.marriedDone = { herb: true };
  s2.charFlags.herb_met = true; s2.affection = 92;
  s2.year = 6; s2.age = 32; s2.shou = 200;
  s2.familyFlags = { post_open_done: true };
  E.state = s2;
  UI.state = s2;
  UI.showScreen('screen-game');
  UI.renderStats();
  UI.renderActButton();
  doc.querySelector('#screen-game').classList.add('active');

  // 直接驱动「向前一步」按钮，确认婚后事件出现并被渲染
  let gotPost = false, sawFamily = false, stalls = 0, clicks = 0, postIds = {}, ended = false;
  const actArea = doc.querySelector('#choice-area');
  for (let i = 0; i < 80; i++) {
    // 游戏已结算（进入结局页）→ 正常终止，不算卡死
    if (s2.dead) { ended = true; break; }
    // 找到当前可用按钮（行动按钮 或 选项按钮）
    const usable = [...actArea.querySelectorAll('button')].filter(b => !b.disabled);
    if (!usable.length) { stalls++; break; }
    usable[0].click();
    await new Promise(r => setTimeout(r, 0));
    const ev = UI.curEvent;
    if (ev && ev.post) { gotPost = true; postIds[ev.id] = (postIds[ev.id] || 0) + 1; }
    if (ev && ev.post) {
      const fam = doc.querySelector('#family-row');
      if (fam && /家财/.test(fam.innerHTML)) sawFamily = true;
    }
    // 若是选项界面（curEvent 有 choices），点第一个选项推进
    if (ev && ev.choices && ev.choices.length) {
      const chBtns = [...actArea.querySelectorAll('button')].filter(b => !b.disabled);
      if (chBtns.length) { chBtns[0].click(); clicks++; await new Promise(r => setTimeout(r, 0)); }
    }
    // 防卡死：若按钮全 disabled 且未结算，则视为卡死
    if (!s2.dead) {
      const after = [...actArea.querySelectorAll('button')].filter(b => !b.disabled);
      if (!after.length) { stalls++; break; }
    }
  }
  ok('婚后事件在真实 DOM 中被触发', gotPost);
  ok('婚后事件种类多样（≥ 8 种）', Object.keys(postIds).length >= 8, `实际 ${Object.keys(postIds).length} 种`);
  ok('婚后状态下状态行含「家财」', sawFamily);
  ok('80 轮真实点击无卡死（结算终止不算）', stalls === 0, `卡死 ${stalls} 次；已结算=${ended}`);
  ok('真实点击次数 > 20', clicks > 20, `实际 ${clicks} 次`);

  console.log('\n========== 3. 玩家可见变量变化 ==========');
  {
    E._appliedChoices = null;
    const s3 = E.newLife({ cycle: 1, luckBonus: 0 });
    s3.spouse_id = 'herb'; s3.marriageLocked = true; s3.flags.married = true;
    s3.year = 6; s3.age = 32; s3.familyFlags = { post_open_done: true };
    E.state = s3; UI.state = s3;
    const econ = window.Season.seasonEventsFromConfig().find(e => e.id === 'post_econ_1');
    const bm = C.getMoney(s3), bs = C.getStress(s3);
    econ.choices[0].apply(s3);
    ok('点击后家财变化', C.getMoney(s3) !== bm, `${bm} → ${C.getMoney(s3)}`);
    ok('事件可写入心累', typeof C.getStress(s3) === 'number');

    // 育儿链真实落地
    const preg = window.Season.seasonEventsFromConfig().find(e => e.id === 'post_child_1');
    preg.choices[0].apply(s3);
    const birth = window.Season.seasonEventsFromConfig().find(e => e.id === 'post_child_2');
    birth.choices[0].apply(s3);
    ok('育儿链真实生成子女', C.kidCount(s3) === 1, `子女数 ${C.kidCount(s3)}`);
    UI.renderStats();
    ok('UI 显示新生儿姓名', /👶/.test(doc.querySelector('#family-row').innerHTML));
  }

  console.log('\n============================================================');
  console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
  if (fail === 0) console.log('✅ 婚后系统浏览器集成测试全部通过');
  else console.log('❌ 存在失败项');
  console.log('============================================================');
  process.exit(fail === 0 ? 0 : 1);
})();
