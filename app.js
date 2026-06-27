/* IG 限動排版工作室 — 前端邏輯 */
'use strict';

const STYLES = [
  { id:'polaroid', ico:'🖼️', nm:'拍立得白框', ds:'手寫字·暖色' },
  { id:'magazine', ico:'📰', nm:'簡約雜誌',   ds:'明體·留白' },
  { id:'film',     ico:'🎞️', nm:'底片膠卷',   ds:'顆粒·日期戳' },
  { id:'er',       ico:'🩺', nm:'急診數據風', ds:'HUD·蜻藍' },
  { id:'minimal',  ico:'⬜', nm:'極簡白底',   ds:'乾淨·IG感' },
  { id:'bold',     ico:'🅱️', nm:'粗體標語',   ds:'滿版·大字' },
  { id:'gradient', ico:'🌈', nm:'漸層卡',     ds:'繽紛·圓角' },
  { id:'dark',     ico:'🌑', nm:'質感暗黑',   ds:'黑金·襯線' },
  { id:'scrapbook',ico:'📒', nm:'手帳拼貼',   ds:'紙膠帶·手寫' },
  { id:'cover',    ico:'🗞️', nm:'雜誌封面',   ds:'滿版·刊頭' },
  { id:'neon',     ico:'💟', nm:'霓虹夜間',   ds:'發光·暗夜' },
  { id:'japan',    ico:'🍵', nm:'日系清新',   ds:'淡雅·留白' },
];
const LAYOUTS = [
  { id:'single',  ico:'▭', nm:'單張滿版', n:1 },
  { id:'split2',  ico:'⬓', nm:'雙圖上下', n:2 },
  { id:'split2v', ico:'◫', nm:'雙圖左右', n:2 },
  { id:'grid3',   ico:'◰', nm:'3 格拼貼', n:3 },
  { id:'strip3',  ico:'≣', nm:'三橫條',   n:3 },
  { id:'grid4',   ico:'⊞', nm:'4 格拼貼', n:4 },
  { id:'grid6',   ico:'⊟', nm:'6 格',     n:6 },
  { id:'grid9',   ico:'▦', nm:'9 格',     n:9 },
  { id:'scatter2',ico:'🃏', nm:'散落 2 張', n:2 },
  { id:'scatter3',ico:'🎴', nm:'散落 3 張', n:3 },
  { id:'scatter4',ico:'🗂️', nm:'散落 4 張', n:4 },
  { id:'mix3',    ico:'◤', nm:'大小錯落',  n:3 },
  { id:'diag2',   ico:'◣', nm:'斜切雙圖',  n:2 },
];
const layoutN = id => (LAYOUTS.find(l=>l.id===id)||{}).n || 1;

let uid = 1;
const state = {
  photos: [],   // {id, dataUrl, w, h, time(ms|null)}
  frames: [],   // {id, style, layout, slots:[photoId|null], title, caption, tag, dateOn}
  cur: 0,
};

const $ = s => document.querySelector(s);
const esc = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function newFrame(){
  return { id:uid++, style:'polaroid', layout:'single', slots:[null], title:'今日早餐', caption:'值班前的第一杯', tag:'#早餐', dateOn:true };
}
const curFrame = () => state.frames[state.cur];

/* ---------- 上傳 + EXIF 轉正 ---------- */
const imgFiles = fl => [...fl].filter(f => /image\//.test(f.type) || /\.(hei[cf]|jpe?g|png)$/i.test(f.name));

async function fileToPhoto(f){
  let time = null;
  try{ const ex = await exifr.parse(f, ['DateTimeOriginal','CreateDate']); time = ex && (ex.DateTimeOriginal||ex.CreateDate); if(time) time = +new Date(time); }catch(e){}
  let blob = f;
  if(/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)){
    setStatus(`轉換 HEIC：${f.name}…`);
    blob = await heic2any({ blob:f, toType:'image/jpeg', quality:0.92 });
    if(Array.isArray(blob)) blob = blob[0];
  }
  const up = await normalizeUpright(blob);
  const p = { id:uid++, dataUrl:up.dataUrl, w:up.w, h:up.h, time };
  state.photos.push(p);
  return p;
}

async function handleFiles(fileList){
  const files = imgFiles(fileList); if(!files.length) return;
  setStatus(`處理 ${files.length} 張…`);
  for(const f of files){ try{ await fileToPhoto(f); }catch(err){ console.error('photo fail',f.name,err); setStatus('⚠️ 有照片處理失敗：'+f.name);} }
  sortByTime(true); renderTray(); setStatus(`已載入 ${state.photos.length} 張`);
}

// 點格子的＋ 或 拖曳照片到格子 → 從該格起算填入
async function addFilesToSlot(fileList, startIdx){
  const files = imgFiles(fileList); if(!files.length) return;
  const f = curFrame(), n = layoutN(f.layout);
  setStatus(`處理 ${files.length} 張…`);
  let idx = startIdx;
  for(const file of files){
    try{ const p = await fileToPhoto(file); if(idx<n){ f.slots[idx]=p.id; idx++; } }
    catch(err){ console.error(err); setStatus('⚠️ 處理失敗：'+file.name); }
  }
  sortByTime(true); render(); setStatus('已加入照片 ✅');
}

// 用 createImageBitmap 套用 EXIF 方向 → 轉正、縮到長邊≤1600 → JPEG dataURL
async function normalizeUpright(blob){
  let bmp;
  try{ bmp = await createImageBitmap(blob, { imageOrientation:'from-image' }); }
  catch(e){ bmp = await createImageBitmap(blob); }
  const max = 1600, scale = Math.min(1, max/Math.max(bmp.width,bmp.height));
  const w = Math.round(bmp.width*scale), h = Math.round(bmp.height*scale);
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').drawImage(bmp,0,0,w,h);
  bmp.close && bmp.close();
  return { dataUrl:c.toDataURL('image/jpeg',0.92), w, h };
}

function sortByTime(silent){
  const haveTime = state.photos.filter(p=>p.time).length;
  state.photos.sort((a,b)=>(a.time||Infinity)-(b.time||Infinity));
  if(!silent) setStatus(haveTime ? `已依拍攝時間排序（${haveTime}/${state.photos.length} 張有時間）` : '這些照片沒有拍攝時間資訊');
}

/* ---------- 照片匣 ---------- */
function renderTray(){
  $('#photoCount').textContent = state.photos.length + ' 張';
  const fr = curFrame();
  $('#tray').innerHTML = state.photos.map(p=>{
    const slotIdx = fr ? fr.slots.indexOf(p.id) : -1;
    const t = p.time ? new Date(p.time).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}) : '';
    return `<div class="thumb ${slotIdx>=0?'assigned':''}" data-id="${p.id}">
      <img src="${p.dataUrl}">
      ${slotIdx>=0?`<span class="badge">${slotIdx+1}</span>`:''}
      <button class="rm" data-rm="${p.id}">×</button>
      ${t?`<span class="time">${t}</span>`:''}
    </div>`;
  }).join('');
}

/* ---------- 卡片 ---------- */
function renderCards(){
  $('#styleCards').innerHTML = STYLES.map(s=>{
    const a = curFrame() && curFrame().style===s.id ? 'active':'';
    return `<div class="card ${a}" data-style="${s.id}"><div class="ico">${s.ico}</div><div class="nm">${s.nm}</div><div class="ds">${s.ds}</div></div>`;
  }).join('');
  $('#layoutCards').innerHTML = LAYOUTS.map(l=>{
    const a = curFrame() && curFrame().layout===l.id ? 'active':'';
    return `<div class="card ${a}" data-layout="${l.id}"><div class="ico">${l.ico}</div><div class="nm">${l.nm}</div><div class="ds">${l.n} 張</div></div>`;
  }).join('');
}

/* ---------- 分頁 ---------- */
function renderFrames(){
  $('#frames').innerHTML = state.frames.map((f,i)=>
    `<div class="frame-tab ${i===state.cur?'active':''}" data-fi="${i}">第 ${i+1} 頁 <span class="x" data-del="${i}">✕</span></div>`
  ).join('');
}
function syncTexts(){
  const f=curFrame(); if(!f) return;
  $('#txtTitle').value=f.title; $('#txtCaption').value=f.caption; $('#txtTag').value=f.tag; $('#txtDateOn').checked=f.dateOn;
}

/* ---------- 渲染舞台 ---------- */
function dateStr(style){
  const d=new Date();
  const Y=d.getFullYear(), M=String(d.getMonth()+1).padStart(2,'0'), D=String(d.getDate()).padStart(2,'0');
  const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
  if(style==='magazine') return `${M} · ${D}`;
  if(style==='film') return `${Y}.${M}.${D}`;
  if(style==='er') return `${Y}-${M}-${D} ${hh}:${mm}`;
  return `${Y} / ${M} / ${D}`;
}
function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

function slotsHTML(f){
  const n=layoutN(f.layout); let h='';
  for(let i=0;i<n;i++){
    const pid=f.slots[i]; const p=pid&&state.photos.find(x=>x.id===pid);
    h += p ? `<div class="slot"><img src="${p.dataUrl}"></div>` : `<div class="slot empty"></div>`;
  }
  return `<div class="photo-area">${h}</div>`;
}
function styleInner(f){
  const pa = slotsHTML(f), date = f.dateOn ? dateStr(f.style) : '';
  const T=esc(f.title), C=esc(f.caption), G=esc(f.tag);
  if(f.style==='polaroid') return `<span class="tape"></span>
    <div class="card-paper">${pa}${T?`<div class="p-hand">${T}</div>`:''}</div>
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='magazine') return `<div class="m-frame"></div>
    <div class="m-kicker">Morning Ritual</div><div class="m-issue">N O . 0 1</div>
    ${pa}<div class="m-rule"></div>
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C.replace(/\n/g,'<br>')}</div>`:''}
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='film') return `<div class="f-strip f-left"></div><div class="f-strip f-right"></div>
    ${pa}<div class="f-grain"></div><div class="f-vig"></div>
    <div class="s-frameno">▶ 01</div>${date?`<div class="s-date">${date}</div>`:''}
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='er') return `<div class="scan"></div>
    <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>
    ${T?`<div class="s-title">${T}</div>`:''}<div class="er-sub">MORNING · INTAKE LOG</div>
    ${pa}
    <div class="vitals">
      <div class="vit"><div class="k">TIME</div><div class="v">${nowHM()}</div></div>
      <div class="vit"><div class="k">SpO₂</div><div class="v">98%</div></div>
      <div class="vit"><div class="k">HR</div><div class="v">72</div></div>
    </div>
    ${C?`<div class="s-caption">${C}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='minimal') return `${pa}<div class="ln"></div>
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='bold') return `${pa}<div class="b-shade"></div>
    ${T?`<div class="s-title" data-t="${T}">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='gradient') return `${G?`<div class="s-tag">${G}</div>`:''}
    <div class="g-card">${pa}</div>
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}${date?`<div class="s-date">${date}</div>`:''}`;
  if(f.style==='dark') return `${pa}<div class="d-line"></div>
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='scrapbook') return `<span class="tape t1"></span><span class="tape t2"></span>
    ${T?`<div class="s-title">${T}</div>`:''}${pa}
    ${C?`<div class="s-caption">${C}</div>`:''}${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='cover') return `${pa}<div class="c-shade"></div>
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  if(f.style==='neon') return `${pa}<div class="n-glow"></div>
    ${T?`<div class="s-title">${T}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}
    ${C?`<div class="s-caption">${C}</div>`:''}${date?`<div class="s-date">${date}</div>`:''}`;
  if(f.style==='japan') return `<div class="j-line"></div>${pa}
    ${T?`<div class="s-title">${T}</div>`:''}${C?`<div class="s-caption">${C}</div>`:''}
    ${date?`<div class="s-date">${date}</div>`:''}${G?`<div class="s-tag">${G}</div>`:''}`;
  return pa;
}
function buildStage(el, f){
  el.className = `stage style-${f.style} layout-${f.layout}`;
  el.innerHTML = styleInner(f);
}
// 在預覽舞台的每個格子疊一個透明真檔案輸入（點它就原生開相簿）
function addSlotInputs(el){
  el.querySelectorAll('.photo-area > .slot').forEach((slot,idx)=>{
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='image/*'; inp.multiple=true; inp.className='slot-input'; inp.dataset.slot=idx;
    slot.appendChild(inp);
  });
}
function paintStage(){ buildStage($('#stage'), curFrame()); addSlotInputs($('#stage')); }
function render(){
  const f=curFrame(); if(!f) return;
  paintStage();
  renderCards(); renderTray(); syncTexts();
}

/* ---------- 自動排版 ---------- */
function autoFill(){
  if(!state.photos.length){ setStatus('先上傳照片'); return; }
  sortByTime(true);
  const f=curFrame(); const per=layoutN(f.layout);
  const ids=state.photos.map(p=>p.id);
  // 把所有照片依目前頁的版面切成多頁
  const pages=[]; for(let i=0;i<ids.length;i+=per) pages.push(ids.slice(i,i+per));
  state.frames = pages.map((grp,idx)=>({
    id:uid++, style:f.style, layout:f.layout,
    slots:Array.from({length:per},(_,k)=>grp[k]||null),
    title:f.title, caption:f.caption, tag:f.tag, dateOn:f.dateOn,
  }));
  if(!state.frames.length) state.frames=[newFrame()];
  state.cur=0; renderFrames(); render();
  setStatus(`自動排版完成：${state.frames.length} 頁（每頁 ${per} 張）`);
}

/* ---------- 匯出 ---------- */
async function exportFrame(f, idx){
  await document.fonts.ready;
  const rs=$('#renderStage'); buildStage(rs, f);
  await new Promise(r=>setTimeout(r,120));
  const url = await htmlToImage.toJpeg(rs, { width:1080, height:1920, pixelRatio:1, quality:0.95, backgroundColor:'#000' });
  const a=document.createElement('a'); a.href=url; a.download=`story_${String(idx+1).padStart(2,'0')}.jpg`; a.click();
}
async function exportCurrent(){ setStatus('匯出中…'); try{ await exportFrame(curFrame(), state.cur); setStatus('✅ 已下載這一頁'); }catch(e){ console.error(e); setStatus('⚠️ 匯出失敗，看 console'); } }
async function exportAll(){ setStatus('匯出全部中…'); try{ for(let i=0;i<state.frames.length;i++){ await exportFrame(state.frames[i], i); await new Promise(r=>setTimeout(r,250)); } setStatus(`✅ 已下載 ${state.frames.length} 頁`); }catch(e){ console.error(e); setStatus('⚠️ 匯出失敗'); } }

/* ---------- 事件 ---------- */
function setStatus(s){ $('#status').textContent=s; }
function fitPreview(){
  const wrap=$('.stage-wrap'); if(!wrap) return;
  const avail=wrap.clientWidth-24; const pv=Math.min(.5, Math.max(.18, avail/1080));
  document.documentElement.style.setProperty('--pv', pv.toFixed(3));
}

function bind(){
  const dz=$('#dropzone'), fi=$('#fileInput');
  fi.addEventListener('change', e=>handleFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));
  dz.addEventListener('drop', e=>handleFiles(e.dataTransfer.files));

  $('#tray').addEventListener('click', e=>{
    const rm=e.target.closest('[data-rm]');
    if(rm){ const id=+rm.dataset.rm; state.photos=state.photos.filter(p=>p.id!==id); state.frames.forEach(f=>f.slots=f.slots.map(s=>s===id?null:s)); render(); return; }
    const th=e.target.closest('.thumb'); if(!th) return;
    const id=+th.dataset.id, f=curFrame(); const at=f.slots.indexOf(id);
    if(at>=0){ f.slots[at]=null; }
    else { const empty=f.slots.indexOf(null); if(empty>=0) f.slots[empty]=id; else f.slots[f.slots.length-1]=id; }
    render();
  });
  $('#clearBtn').addEventListener('click', ()=>{ state.photos=[]; state.frames.forEach(f=>f.slots=f.slots.map(()=>null)); render(); setStatus('已清空照片'); });
  $('#sortTimeBtn').addEventListener('click', ()=>{ sortByTime(false); renderTray(); });

  $('#styleCards').addEventListener('click', e=>{ const c=e.target.closest('[data-style]'); if(!c)return; curFrame().style=c.dataset.style; render(); });
  $('#layoutCards').addEventListener('click', e=>{
    const c=e.target.closest('[data-layout]'); if(!c)return; const f=curFrame();
    f.layout=c.dataset.layout; const n=layoutN(f.layout);
    const old=f.slots.filter(Boolean); f.slots=Array.from({length:n},(_,i)=>old[i]||null); render();
  });

  $('#txtTitle').addEventListener('input', e=>{curFrame().title=e.target.value; paintStage();});
  $('#txtCaption').addEventListener('input', e=>{curFrame().caption=e.target.value; paintStage();});
  $('#txtTag').addEventListener('input', e=>{curFrame().tag=e.target.value; paintStage();});
  $('#txtDateOn').addEventListener('change', e=>{curFrame().dateOn=e.target.checked; paintStage();});

  $('#frames').addEventListener('click', e=>{
    const del=e.target.closest('[data-del]');
    if(del){ const i=+del.dataset.del; if(state.frames.length>1){ state.frames.splice(i,1); state.cur=Math.max(0,state.cur-(i<=state.cur?1:0)); renderFrames(); render(); } return; }
    const t=e.target.closest('[data-fi]'); if(t){ state.cur=+t.dataset.fi; renderFrames(); render(); }
  });
  $('#addFrameBtn').addEventListener('click', ()=>{ const f=curFrame(); const nf=newFrame(); nf.style=f.style; nf.layout=f.layout; nf.slots=Array(layoutN(f.layout)).fill(null); state.frames.push(nf); state.cur=state.frames.length-1; renderFrames(); render(); });
  $('#autoFillBtn').addEventListener('click', autoFill);
  $('#exportBtn').addEventListener('click', exportCurrent);
  $('#exportAllBtn').addEventListener('click', exportAll);

  // 點格子＝點到疊在上面的真檔案輸入 → iOS 原生跳「照片圖庫/拍照/選擇檔案」(change 事件委派)
  const slotIndex = el => { const s=el.closest('.slot'); return s? [...s.parentElement.querySelectorAll(':scope > .slot')].indexOf(s) : -1; };
  $('#stage').addEventListener('change', e=>{
    const inp=e.target.closest('.slot-input'); if(!inp) return;
    if(inp.files.length) addFilesToSlot(inp.files, +inp.dataset.slot);
    inp.value='';
  });
  // 從 Photos / Finder 拖照片到格子
  $('#stage').addEventListener('dragover', e=>{ if(e.target.closest('.slot')){ e.preventDefault(); $('#stage').classList.add('dropping'); } });
  $('#stage').addEventListener('dragleave', ()=>$('#stage').classList.remove('dropping'));
  $('#stage').addEventListener('drop', e=>{ e.preventDefault(); $('#stage').classList.remove('dropping'); const i=slotIndex(e.target); if(i>=0 && e.dataTransfer.files.length) addFilesToSlot(e.dataTransfer.files, i); });

  window.addEventListener('resize', fitPreview);
}

function init(){
  state.frames=[newFrame()];
  bind(); renderFrames(); render(); fitPreview();
  setStatus('上傳照片開始吧 👋');
}
document.addEventListener('DOMContentLoaded', init);
