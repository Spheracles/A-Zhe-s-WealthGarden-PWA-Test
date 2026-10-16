'use strict';
(() => {
  const STORE = 'azhe-wealth-garden-v1';
  const CATEGORIES = ['生活', '學習', '工作', '投資', '交通', '健康', '其他'];
  const KINDS = ['income', 'expense', 'transfer'];
  const state = { version: 1, records: [], pains: [] };
  let canSave = true;
  let toastTimer;
  const el = (id) => document.getElementById(id);
  const money = (n) => 'NT$ ' + new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(n);
  const currentDate = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  };
  const currentMonth = () => currentDate().slice(0,7);
  const sum = (items, key) => items.reduce((s,item) => s + Number(item[key] || 0), 0);
  const text = (tag, className, value) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    n.textContent = String(value);
    return n;
  };
  const empty = (value) => text('div', 'empty', value);
  const trimString = (v,max) => typeof v === 'string' ? v.trim().slice(0,max) : '';
  const validDate = (s) => {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y,m,d] = s.split('-').map(Number);
    const date = new Date(Date.UTC(y,m-1,d));
    return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d && y>=1900 && y<=2100;
  };
  const num = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  function validRecord(r) {
    return r && typeof r === 'object' && !Array.isArray(r)
      && typeof r.id === 'string' && r.id.length>0 && r.id.length<=80
      && typeof r.name === 'string' && r.name.trim().length>0 && r.name.length<=80
      && num(r.amount,0.01,999999999) && KINDS.includes(r.kind) && CATEGORIES.includes(r.category)
      && validDate(r.date) && num(r.hours,0,100000) && Number.isInteger(r.energy) && r.energy>=1 && r.energy<=5
      && typeof r.note === 'string' && r.note.length<=300;
  }
  function validPain(p) {
    return p && typeof p === 'object' && !Array.isArray(p)
      && typeof p.id==='string' && p.id.length>0 && p.id.length<=80
      && typeof p.issue==='string' && p.issue.trim().length>0 && p.issue.length<=800
      && typeof p.suggestion==='string' && p.suggestion.length<=1200 && validDate(p.date);
  }
  function validateData(v) {
    return !!(v && typeof v === 'object' && !Array.isArray(v)
      && v.version === 1 && Array.isArray(v.records) && Array.isArray(v.pains)
      && v.records.length<=5000 && v.pains.length<=2000
      && v.records.every(validRecord) && v.pains.every(validPain)
      && new Set(v.records.map(r=>r.id)).size===v.records.length
      && new Set(v.pains.map(p=>p.id)).size===v.pains.length);
  }
  function notify(message) {
    const t = el('toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {t.hidden = true;}, 3500);
  }
  function persist() {
    if (!canSave) return false;
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
      return true;
    } catch (e) {
      canSave = false;
      el('storage-status').textContent = '⚠ 無法保存';
      el('storage-status').classList.add('warning');
      notify('本機空間無法寫入，請先匯出備份！');
      return false;
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!validateData(parsed)) throw new Error('格式不符合版本 1');
      state.records = parsed.records;
      state.pains = parsed.pains;
    } catch(e) {
      // Never overwrite data that might be recoverable, e.g. after a future schema upgrade.
      canSave = false;
      el('storage-status').textContent = '⚠ 請檢查資料';
      el('storage-status').classList.add('warning');
      notify('無法讀取舊資料，已暫停覆寫儲存。');
    }
  }
  function newId() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function openTab(name) {
    if (!['garden','log','pain','analytics'].includes(name)) return;
    document.querySelectorAll('.screen').forEach(s => {s.hidden = s.id !== 'tab-' + name;});
    document.querySelectorAll('.nav-button').forEach(button => {
      const active = button.dataset.tab === name;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    window.scrollTo({top:0,behavior:'instant'});
  }
  function card(item, showDelete) {
    const isRecord = Object.hasOwn(item,'amount');
    const container = document.createElement('article');
    container.className = 'entry';
    const content = text('div','entry-content','');
    content.append(text('div','entry-title',isRecord ? item.name : '💡 '+item.issue));
    if (isRecord) {
      const typeLabel = { income:'收入',expense:'支出',transfer:'資金移轉' }[item.kind];
      content.append(text('div','entry-meta',`${item.date} · ${typeLabel} · ${item.category} · ${item.hours} 小時 · 心力 ${item.energy}/5`));
      if (item.note) content.append(text('div','entry-meta',item.note));
    } else {
      content.append(text('div','entry-meta',item.date));
      content.append(text('p','idea-suggestion',item.suggestion));
    }
    container.append(content);
    const actions = text('div','entry-actions','');
    if (isRecord) actions.append(text('div','entry-amount '+item.kind,`${item.kind==='income'?'+':item.kind==='expense'?'−':'↔ '}${money(item.amount)}`));
    if (showDelete) {
      const button = text('button','small-delete','刪除');
      button.type='button';
      button.setAttribute('aria-label','刪除'+(isRecord?item.name:item.issue));
      button.addEventListener('click',() => {
        if (!window.confirm('確定要刪除這筆紀錄嗎？此動作無法復原。')) return;
        const list = isRecord ? state.records : state.pains;
        const index = list.findIndex(x=>x.id===item.id);
        if (index!==-1) { list.splice(index,1); if(persist()) {render();notify('紀錄已刪除');} else render(); }
      });
      actions.append(button);
    }
    container.append(actions);
    return container;
  }
  function renderList(node, items, placeholder, showDelete) {
    node.replaceChildren();
    if (!items.length) {node.append(empty(placeholder));return;}
    items.forEach(item=>node.append(card(item,showDelete)));
  }
  function render() {
    const month = currentMonth();
    const subset = state.records.filter(r=>r.date.startsWith(month));
    const income = sum(subset.filter(r=>r.kind==='income'),'amount');
    const expense = sum(subset.filter(r=>r.kind==='expense'),'amount');
    const hours = sum(subset,'hours');
    el('month-name').textContent = month.replace('-', ' 年 ')+' 月';
    el('month-income').textContent = money(income);
    el('month-expense').textContent = money(expense);
    el('month-net').textContent = money(income-expense);
    el('month-hours').textContent = Number(hours.toFixed(2)).toString()+' 小時';
    const ordered = [...state.records].sort((a,b)=>b.date.localeCompare(a.date));
    renderList(el('recent-list'),ordered.slice(0,3),'花園還沒開始記錄。到「記帳轉化」種下第一筆吧。',false);
    renderList(el('record-list'),ordered,'目前沒有紀錄，新增一筆試試看 🌱',true);
    renderList(el('pain-list'),[...state.pains].reverse(),'還沒有靈感種子，寫下第一個想改善的困難吧。',true);
    el('record-count').textContent=state.records.length+' 筆';
    el('pain-count').textContent=state.pains.length+' 筆';
    const bar=el('category-list');bar.replaceChildren();
    const expenses=subset.filter(r=>r.kind==='expense');
    if (!expenses.length) bar.append(empty('本月尚無支出紀錄。'));
    else {
      CATEGORIES.map(c=>({category:c,value:sum(expenses.filter(r=>r.category===c),'amount')}))
        .filter(v=>v.value>0).sort((a,b)=>b.value-a.value).forEach(v=>{
          const wrap=text('div','','');const top=text('div','bar-top','');
          top.append(text('span','',v.category),text('span','',`${money(v.value)} · ${(v.value/expense*100).toFixed(1)}%`));
          const track=text('div','bar-track',''); const fill=text('div','bar-fill','');
          fill.style.width=(v.value/expense*100)+'%';track.append(fill);wrap.append(top,track);bar.append(wrap);
        });
    }
    el('average-energy').textContent=subset.length?(sum(subset,'energy')/subset.length).toFixed(1)+' / 5':'尚無紀錄';
  }
  function makeSuggestion(issue) {
    let idea='先訪問 3 位遇過相同問題的人，找出最痛的環節，再製作一份簡單檢查表或流程範本。';
    if (/報價|價格|客戶|接案|訂單/.test(issue)) idea='把重複的需求整理成標準報價表或需求訪談表，找 2 位客戶試用並記錄省下多少時間。';
    else if (/時間|重複|加班|效率|整理|行政/.test(issue)) idea='畫出目前流程，挑選最耗時的一步製作自動化範本或操作清單，連續測試 1 週。';
    else if (/學習|教學|不懂|資訊|知識/.test(issue)) idea='整理一頁新手入門指南，邀請 3 位使用者閱讀並找出他們仍不理解的地方。';
    return '【可驗證的假設】別人可能也有類似的困難。\n【最小實驗】'+idea+'\n【觀察指標】記錄花費時間、收到的回饋與是否有人願意付費。';
  }
  function recordSubmit(event) {
    event.preventDefault();
    const record={ id:newId(),name:trimString(el('record-name').value,80), amount:Number(el('record-amount').value),
      date:el('record-date').value,kind:el('record-kind').value,category:el('record-category').value,
      hours:el('record-hours').value===''?0:Number(el('record-hours').value),energy:Number(el('record-energy').value),note:trimString(el('record-note').value,300) };
    if (!validRecord(record)) {notify('欄位有誤，請確認金額、日期及時間');return;}
    if (state.records.length>=5000) {notify('紀錄已達上限，請先備份並整理資料');return;}
    state.records.push(record);
    const saved=persist();render();
    if (saved) { el('record-form').reset(); el('record-date').value=currentDate();notify('已保存一筆花園紀錄 🌱'); }
  }
  function painSubmit(event) {
    event.preventDefault();
    const issue=trimString(el('pain-input').value,800);
    if (!issue) {notify('請先描述遇到的困難');return;}
    if (state.pains.length>=2000) {notify('種子庫已滿，請先備份資料');return;}
    state.pains.push({id:newId(),issue,suggestion:makeSuggestion(issue),date:currentDate()});
    const saved=persist();render();
    if(saved){el('pain-form').reset();notify('已建立一份行動靈感 ✨');}
  }
  function download(name,contents,mime) {
    const blob=new Blob(['\uFEFF',contents],{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function exportJSON() {
    download(`wealth-garden-backup-${currentDate()}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');
    notify('已準備完整 JSON 備份，請確認下載成功');
  }
  function csvCell(v){
    // Prevent spreadsheet formula execution when user-supplied text starts with =, +, -, @, or leading control/space.
    const raw=String(v);
    const safe=/^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? '\''+raw : raw;
    return '"'+safe.replaceAll('\"','\"\"')+'"';
  }
  function exportCSV() {
    const heads=['日期','名稱','金流類型','用途分類','金額','時間（小時）','心力等級','備註'];
    const lines=[heads,...state.records.map(r=>[r.date,r.name,{income:'收入',expense:'支出',transfer:'資金移轉'}[r.kind],r.category,r.amount,r.hours,r.energy,r.note])]
      .map(row=>row.map(v=>csvCell(v)).join(','));
    download(`wealth-garden-records-${currentDate()}.csv`,lines.join('\r\n'),'text/csv;charset=utf-8');
    notify('已準備 CSV 明細，請確認下載成功');
  }
  async function importJSON(event) {
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(file.size>2*1024*1024){notify('檔案超過 2MB，無法匯入');return;}
    let obj;
    try{obj=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}
    catch(e){notify('檔案不是有效的 JSON 格式');return;}
    if(!validateData(obj)){notify('備份格式或內容不符合版本 1，未匯入');return;}
    if(!canSave){notify('目前儲存不可用，為保護資料暫停匯入');return;}
    if(!window.confirm(`匯入將覆蓋目前 ${state.records.length} 筆記帳和 ${state.pains.length} 筆靈感。建議先匯出備份。確定要繼續？`))return;
    try {
      localStorage.setItem(STORE,JSON.stringify(obj));
      state.records=obj.records;state.pains=obj.pains;
      render();notify('備份已還原，請檢查資料');
    }catch(e){notify('寫入失敗，舊資料未更動');}
  }
  function resetAll() {
    if(!canSave){notify('儲存不可用，暫停清除');return;}
    if(!window.confirm('確定清除全部資料？請先匯出 JSON 備份。')) return;
    if(!window.confirm('最後確認：所有記帳與痛點紀錄都將被刪除，且無法復原。'))return;
    try{localStorage.removeItem(STORE);state.records=[];state.pains=[];render();notify('本機資料已清除');}
    catch(e){notify('清除失敗，請稍後再試');}
  }
  function init() {
    el('record-date').value=currentDate();load();render();
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.go)));
    el('record-form').addEventListener('submit',recordSubmit);
    el('pain-form').addEventListener('submit',painSubmit);
    el('export-json').addEventListener('click',exportJSON);
    el('export-csv').addEventListener('click',exportCSV);
    el('import-json').addEventListener('change',importJSON);
    el('reset-data').addEventListener('click',resetAll);
    window.addEventListener('storage',(event)=>{
      if(event.key===STORE && canSave) {
        const raw=event.newValue;
        try{
          const obj=raw?JSON.parse(raw):{version:1,records:[],pains:[]};
          if(!validateData(obj))return;
          state.records=obj.records;state.pains=obj.pains;render();
          notify('已更新同瀏覽器其他分頁的變更');
        }catch(e) { /* Preserve current data until a valid update arrives. */ }
      }
    });
    if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{ /* HTTPS installation requires a supported browser. */ });
    }
  }
  init();
})();
