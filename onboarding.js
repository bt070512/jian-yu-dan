/* ============================================================
   剑与丹 · 新手引导（onboarding.js）
   ------------------------------------------------------------
   设计原则：
     · 仅在「首次游玩」触发 —— shouldStart 判定：
         !meta.onboardDone && (meta.totalRuns || 0) === 0
       老玩家（已完成过任意一周目 / 已看过引导）永不重弹。
     · 纯 DOM 实现，无任何素材依赖；三步气泡 + 遮罩高亮目标元素。
     · 全程可「跳过」；任何一步异常都不阻塞游戏流程。
     · 完成 / 跳过后写 meta.onboardDone = true 持久化。
   对外 API：
     Onboarding.maybeStart()   由 UI.enterGame 调用，自行判断是否需展示
     Onboarding.start()        强制开始
     Onboarding.finish(skipped) 结束并持久化
   ============================================================ */

window.Onboarding = (function () {
  'use strict';

  let active = false;
  let maskEl = null;
  let tipEl = null;

  /* 三步引导内容。target 为目标元素选择器（不存在则整屏居中显示）。 */
  const STEPS = [
    {
      target: '#btn-act',
      title: '向前一步',
      text: '点击这里推进时间。每点一次，走过一个季节——春、夏、秋、冬，走完冬天你就长一岁。',
    },
    {
      target: '#choice-area',
      title: '做出选择',
      text: '遇到事件后，这里会出现若干选项。不同的选择会改变修为、心性、机缘，以及几位姑娘对你的好感。',
    },
    {
      target: '.panel-stats',
      title: '看清两件事',
      text: '左上角是属性与「寿元」。寿元是你的总寿命，每年消耗、破境回补，归零即寿终——所以别只顾着赶路，也要留意还剩多少年。',
    },
  ];

  let stepIdx = 0;

  function ensureMeta() {
    try {
      const m = (typeof loadMeta === 'function') ? loadMeta() : null;
      return m || {};
    } catch (e) { return {}; }
  }

  /* 是否应当展示：首次游玩且未完成过引导 */
  function shouldStart() {
    const m = ensureMeta();
    if (m.onboardDone) return false;
    if ((m.totalRuns || 0) > 0) return false;    // 老玩家不重弹
    return true;
  }

  function maybeStart() {
    try {
      if (shouldStart()) start();
    } catch (e) { /* 静默：引导失败不影响游戏 */ }
  }

  function buildDom() {
    removeDom();
    maskEl = document.createElement('div');
    maskEl.className = 'onboard-mask';
    tipEl = document.createElement('div');
    tipEl.className = 'onboard-tip';
    document.body.appendChild(maskEl);
    document.body.appendChild(tipEl);
  }

  function removeDom() {
    try {
      if (maskEl) { maskEl.remove(); maskEl = null; }
      if (tipEl) { tipEl.remove(); tipEl = null; }
    } catch (e) {}
  }

  function highlight(target) {
    // 清除旧高亮
    document.querySelectorAll('.onboard-hl').forEach(el => el.classList.remove('onboard-hl'));
    if (!target) return null;
    const el = document.querySelector(target);
    if (!el) return null;
    el.classList.add('onboard-hl');
    return el;
  }

  function render() {
    const step = STEPS[stepIdx];
    if (!step) { finish(false); return; }
    const target = highlight(step.target);

    tipEl.innerHTML = `
      <div class="onboard-body">
        <div class="onboard-title">${step.title}</div>
        <div class="onboard-text">${step.text}</div>
        <div class="onboard-foot">
          <span class="onboard-dots">${STEPS.map((_, i) => `<i class="${i === stepIdx ? 'on' : ''}"></i>`).join('')}</span>
          <span class="onboard-btns">
            <button class="onboard-btn ghost" data-act="skip">跳过</button>
            <button class="onboard-btn" data-act="next">${stepIdx === STEPS.length - 1 ? '开始' : '下一步'}</button>
          </span>
        </div>
      </div>`;

    // 定位：跟随目标元素
    try {
      if (target) {
        const r = target.getBoundingClientRect();
        const tipW = Math.min(340, window.innerWidth - 32);
        let left = r.left + r.width / 2 - tipW / 2;
        left = Math.max(16, Math.min(left, window.innerWidth - tipW - 16));
        let top = r.bottom + 14;
        let placeAbove = false;
        if (top + 200 > window.innerHeight) { top = r.top - 14; placeAbove = true; }
        tipEl.style.width = tipW + 'px';
        tipEl.style.left = left + 'px';
        tipEl.style.top = top + 'px';
        tipEl.classList.toggle('above', placeAbove);
      } else {
        tipEl.style.width = Math.min(360, window.innerWidth - 32) + 'px';
        tipEl.style.left = '50%';
        tipEl.style.top = '50%';
        tipEl.classList.add('center');
      }
    } catch (e) {}

    // 绑定按钮
    tipEl.querySelectorAll('.onboard-btn').forEach(b => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        if (window.Sound) Sound.play('click');
        if (b.dataset.act === 'skip') finish(true);
        else next();
      };
    });
  }

  function next() {
    stepIdx++;
    if (stepIdx >= STEPS.length) { finish(false); return; }
    render();
  }

  function start() {
    if (active) return;
    active = true;
    stepIdx = 0;
    buildDom();
    // 遮罩点击不穿透（点击遮罩 = 下一步，降低新手困惑）
    maskEl.addEventListener('click', () => next());
    render();
  }

  function finish(skipped) {
    active = false;
    document.querySelectorAll('.onboard-hl').forEach(el => el.classList.remove('onboard-hl'));
    removeDom();
    // 持久化（onboardDone = true）
    try {
      if (typeof loadMeta === 'function' && typeof saveMeta === 'function') {
        const m = loadMeta();
        m.onboardDone = true;
        saveMeta(m);
      }
    } catch (e) {}
  }

  // 窗口尺寸变化时重新定位
  try {
    window.addEventListener('resize', () => { if (active) render(); });
  } catch (e) {}

  return { maybeStart, start, finish, shouldStart, isActive: () => active };
})();
