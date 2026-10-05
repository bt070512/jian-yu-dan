/* 模拟浏览器启动：按 index.html 顺序加载全部脚本（含 ai.js / ui.js），
   提供最小 DOM stub，验证 UI.init / startRun / act 全链路不报错 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const DIR='D:/低质小游戏/剑与丹';
const store={};
const els={};
function mkEl(id){ return { id, textContent:'', innerHTML:'', value:'', checked:false, style:{},
  classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, contains(c){return this._s.has(c)}, toggle(c,f){ if(f===undefined){this._s.has(c)?this._s.delete(c):this._s.add(c)}else{f?this._s.add(c):this._s.delete(c)} } },
  appendChild(){}, querySelector(){return mkEl('q')}, querySelectorAll(){return []}, closest(){return null},
  onclick:null, remove(){}, scrollTop:0, scrollHeight:0, dataset:{}, offsetWidth:0,
  getBoundingClientRect(){return {left:0,top:0,width:100,height:30,bottom:30}}, title:'', alt:'',
  set src(v){this._src=v}, get src(){return this._src} }; }
const sb={ console, Math, JSON, Object, Array, Date, Set, Map, Number, String, Boolean, RegExp, Error, isNaN,
  localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},
  setTimeout:(f)=>0, clearTimeout:()=>{},
  document:{
    querySelector(s){ return els[s] || (els[s]=mkEl(s)); },
    querySelectorAll(){ return []; },
    createElement(t){ return mkEl(t); },
    addEventListener(){},
    body:mkEl('body'),
  },
  confirm:()=>false,
};
sb.window=sb; sb.globalThis=sb;
sb.document.querySelectorAll=sb.document.querySelectorAll.bind(sb.document);
vm.createContext(sb);
const FILES=['data.js','config.js','config-data.js','audio.js','season.js','characters.js','events.js','events-chars.js','engine.js','ai.js','onboarding.js','ui.js'];
let errs=[];
for(const f of FILES){
  try{ vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),sb,{filename:f}); }
  catch(e){ errs.push(f+': '+e.message); }
}
if(errs.length){ console.log('❌ 加载失败:'); errs.forEach(e=>console.log('   ',e)); process.exit(1); }
console.log('✓ 全部 '+FILES.length+' 个脚本加载成功');

// Sound 模块存在性（Web Audio 缺失时应静默降级，不抛错）
try{ sb.Sound.play('click'); console.log('✓ Sound.play() 无 AudioContext 时静默降级'); }
catch(e){ console.log('✗ Sound 抛错:',e.message); process.exit(1); }

// UI.init
try{ sb.UI.init(); console.log('✓ UI.init() 成功'); }catch(e){ console.log('✗ UI.init 失败:',e.message); process.exit(1); }

// startRun + enterGame
try{
  sb.UI.startRun();
  const s=sb.Engine.state;
  console.log('✓ UI.startRun() 成功 | season='+s.season+' year='+s.year+' maxSteps='+s.maxSteps);
  sb.UI.enterGame();
  console.log('✓ UI.enterGame() 成功');
}catch(e){ console.log('✗ startRun/enterGame 失败:',e.message,'\n',e.stack.split('\n')[1]); process.exit(1); }

// act() 多次（含 AI 关闭路径）
(async()=>{
  try{
    for(let i=0;i<20;i++){ await sb.UI.act(); if(sb.Engine.state.dead) break; }
    const s=sb.Engine.state;
    console.log('✓ UI.act() × 20 成功 | season='+s.season+' year='+s.year+' age='+s.age+' step='+s.step);
    console.log('✓ renderStats 季节徽章 HTML 长度:', (els['#stat-season']?els['#stat-season'].innerHTML.length:0));
  }catch(e){ console.log('✗ UI.act 失败:',e.message,'\n',e.stack.split('\n').slice(1,3).join('\n')); process.exit(1); }
  console.log('\n🎉 浏览器启动链路全部通过');
})();
