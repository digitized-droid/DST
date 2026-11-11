(() => {
'use strict';

const STORAGE_KEY='descanso-finance-v1';
const THEME_KEY='descanso-finance-theme-v1';
const DENOMINATIONS=[1000,500,200,100,50,20,10,5,1];
const EXPENSE_CATEGORIES=['Food supplies','Packaging','Utilities','Transportation','Maintenance','Cleaning supplies','Staff meals','Office supplies','Other'];
const PAYMENT_METHODS=['GCash','Maya','Bank transfer','Card','Other'];
const REFUND_CHANNELS=['Cash','Online','Grab'];
const EXPENSE_SOURCES=[{value:'cashier',label:'Cashier / petty cash'},{value:'salesFund',label:'Sales fund'},{value:'online',label:'Online / bank funds'},{value:'other',label:'Other source'}];
const REASONS_FOR_LOSS=['Burnt','Spoiled','Expired','Damaged','Dropped / contaminated','Preparation waste','Other'];
const THEMES=Array.isArray(window.DESCANSO_THEMES)?window.DESCANSO_THEMES:[];
const MONO_THEME={id:0,name:'Black & White',collection:'Default',colors:{Header:'#000000',Background:'#FFFFFF',Card:'#FFFFFF','Primary Text':'#111111','Muted Text':'#666666',Accent:'#000000','Accent Text':'#FFFFFF',Border:'#D8D8D8',Soft:'#F2F2F2'}};
const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));
const nowISO=()=>new Date().toISOString();
const localDateISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const makeId=()=>window.crypto?.randomUUID?crypto.randomUUID():`id-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const numeric=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2}).format(numeric(value));
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=value=>{if(!value)return '—';const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'})};
const monthLabel=(year,month)=>new Date(Number(year),Number(month)-1,1).toLocaleDateString('en-PH',{month:'long'});

function blankDenominations(){return Object.fromEntries(DENOMINATIONS.map(n=>[String(n),0]))}
function blankDay(date){return {date,opening:blankDenominations(),closing:blankDenominations(),cashPayments:[],onlinePayments:[],grabOrders:[],refunds:[],expenses:[],discounts:[],losses:[],cashToSalesFund:'',nextOpeningFloat:3000,notes:'',updatedAt:nowISO(),savedAt:null}}
function blankState(){return {days:{},settings:{businessName:'Descanso Comida • Cafe',defaultFloat:3000,updatedAt:nowISO()},inventory:[],restocks:[],pendingDays:{},pendingMeta:false,metaUpdatedAt:nowISO()}}
function normalizeState(raw){
 const base=blankState();
 if(!raw||typeof raw!=='object')return base;
 const result={...base,...raw};
 result.settings={...base.settings,...(raw.settings||{})};
 result.days=raw.days&&typeof raw.days==='object'?raw.days:{};
 result.inventory=Array.isArray(raw.inventory)?raw.inventory:[];
 result.restocks=Array.isArray(raw.restocks)?raw.restocks:[];
 result.pendingDays=raw.pendingDays&&typeof raw.pendingDays==='object'?raw.pendingDays:{};
 result.pendingMeta=!!raw.pendingMeta;
 Object.entries(result.days).forEach(([date,day])=>{result.days[date]={...blankDay(date),...day,date,opening:{...blankDenominations(),...(day.opening||{})},closing:{...blankDenominations(),...(day.closing||{})}};['cashPayments','onlinePayments','grabOrders','refunds','expenses','discounts','losses'].forEach(k=>{if(!Array.isArray(result.days[date][k]))result.days[date][k]=[]})});
 return result;
}
function readLocal(key=STORAGE_KEY){try{return normalizeState(JSON.parse(localStorage.getItem(key)||'null'))}catch{return blankState()}}
let storageKey=STORAGE_KEY,activeUserId=null,state=blankState();
let supa=null,session=null,currentView='overview',currentDate=localDateISO(),currentDay=null,syncing=false,themeId=0;
let orderEditClocks={payments:0,grab:0};
function loadUserState(userId){if(!userId||activeUserId===userId)return;activeUserId=userId;orderEditClocks={payments:0,grab:0};storageKey=`${STORAGE_KEY}:${userId}`;state=readLocal(storageKey);currentDay=null}
function clearActiveUser(){activeUserId=null;orderEditClocks={payments:0,grab:0};storageKey=STORAGE_KEY;state=blankState();currentDay=null}
function saveLocal(){try{localStorage.setItem(storageKey,JSON.stringify(state));return true}catch(error){console.error(error);toast('Your browser storage is full. Please export a backup and remove older unused data.');return false}}
function markDayPending(date,day){day.updatedAt=nowISO();state.days[date]=day;state.pendingDays[date]=day.updatedAt;saveLocal()}
function markMetaPending(){state.metaUpdatedAt=nowISO();state.pendingMeta=true;saveLocal()}
function status(message,good=true){const dotColor=good?'#78916c':'#c28b55';const inline=$('syncStatus');const pill=$('syncPill');if(inline)inline.innerHTML=`<span class="dot" style="background:${dotColor}"></span>${escapeHTML(message)}`;if(pill){pill.querySelector('.dot').style.background=dotColor;$('syncPillText').textContent=message}}
function toast(message){const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2800)}
function themeById(id){return Number(id)===0?MONO_THEME:(THEMES.find(t=>t.id===Number(id))||MONO_THEME)}
function hexRgb(hex){const value=String(hex||'#ffffff').replace('#','');if(!/^[0-9a-f]{6}$/i.test(value))return [255,255,255];return [0,2,4].map(i=>parseInt(value.slice(i,i+2),16))}
function luminance(hex){const rgb=hexRgb(hex).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
function contrastRatio(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05)}
function readableText(hex){return contrastRatio('#171717',hex)>=contrastRatio('#FFFFFF',hex)?'#171717':'#FFFFFF'}
function blendHex(a,b,amount){const aa=hexRgb(a),bb=hexRgb(b);return '#'+aa.map((v,i)=>Math.round(v+(bb[i]-v)*amount).toString(16).padStart(2,'0')).join('')}
function contrastSafeText(preferred,backgrounds,minimum=4.5){if(backgrounds.every(bg=>contrastRatio(preferred,bg)>=minimum))return preferred;const blackScore=Math.min(...backgrounds.map(bg=>contrastRatio('#111111',bg)));const whiteScore=Math.min(...backgrounds.map(bg=>contrastRatio('#FFFFFF',bg)));const direction=blackScore>=whiteScore?'#111111':'#FFFFFF';for(let step=1;step<=100;step++){const candidate=blendHex(preferred,direction,step/100);if(backgrounds.every(bg=>contrastRatio(candidate,bg)>=minimum))return candidate}return direction}
function applyTheme(id,persist=true){
 const theme=themeById(id),c=theme.colors,root=document.documentElement;
 const surfaces=[c.Background,c.Card,c.Soft];const onHeader=contrastSafeText(readableText(c.Header),[c.Header]);const onCard=contrastSafeText(c['Primary Text'],[c.Card]);const onSoft=contrastSafeText(c['Primary Text'],[c.Soft]);const onAccent=contrastSafeText(c['Accent Text'],[c.Accent]);const onBg=readableText(c.Background);const muted=contrastSafeText(c['Muted Text'],surfaces);const accentInk=contrastSafeText(c.Accent,surfaces);const headerMuted=contrastSafeText(c['Muted Text'],[c.Header]);
 const vars={'--theme-header':c.Header,'--theme-bg':c.Background,'--theme-card':c.Card,'--theme-text':c['Primary Text'],'--theme-muted':muted,'--theme-accent':c.Accent,'--theme-accent-text':onAccent,'--theme-accent-ink':accentInk,'--theme-border':c.Border,'--theme-soft':c.Soft,'--theme-on-header':onHeader,'--theme-on-header-muted':headerMuted,'--theme-on-card':onCard,'--theme-on-soft':onSoft,'--theme-on-accent':onAccent};
 Object.entries(vars).forEach(([key,value])=>root.style.setProperty(key,value));root.style.colorScheme=onBg==='#FFFFFF'?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',c.Header);
 const logoPath=theme.id===0?'logos/1.png':`logos/${theme.id}.png`;
 ['loginLogo','loginBrandLogo','brandLogo','footerLogo'].forEach(id=>{const img=$(id);if(img){img.onerror=()=>{img.onerror=null;img.src='logos/1.png'};img.src=logoPath}});
 const select=$('themeSelect');if(select)select.value=String(theme.id);if($('themeName'))$('themeName').textContent=theme.name;if($('themeCollection'))$('themeCollection').textContent=theme.collection;if($('themeNumber'))$('themeNumber').textContent=theme.id===0?'DEFAULT / 51':`${String(theme.id).padStart(2,'0')} / 50`;
 if($('themeSwatches'))$('themeSwatches').innerHTML=[c.Header,c.Background,c.Card,c.Accent,c.Soft].map(color=>`<span style="background:${color}"></span>`).join('');
 if(persist){localStorage.setItem(THEME_KEY,String(theme.id));themeId=theme.id}
}
function setupThemes(){const select=$('themeSelect');select.innerHTML=`<option value="0">00 · Black &amp; White — Default</option>`+THEMES.map(t=>`<option value="${t.id}">${String(t.id).padStart(2,'0')} · ${escapeHTML(t.name)} — ${escapeHTML(t.collection)}</option>`).join('');const legacyTheme=localStorage.getItem('descanso-site-theme-v1');const storedTheme=localStorage.getItem(THEME_KEY);const saved=Number(storedTheme??legacyTheme??0);themeId=saved;applyTheme(saved,false);if(storedTheme===null)localStorage.setItem(THEME_KEY,String(saved));['descanso-site-content-v1','descanso-site-pending-v1','descanso-site-theme-version-v1','descanso-site-theme-v1'].forEach(key=>localStorage.removeItem(key));select.addEventListener('change',()=>applyTheme(select.value,false));$('themeOpen').addEventListener('click',()=>$('themeModal').hidden=false);$('themeClose').addEventListener('click',()=>$('themeModal').hidden=true);$('themeModal').addEventListener('click',e=>{if(e.target===$('themeModal'))$('themeModal').hidden=true});$('applyTheme').addEventListener('click',()=>{$('themeModal').hidden=true;applyTheme(select.value,true);toast('Your theme has been saved on this device.')});$('resetTheme').addEventListener('click',()=>{applyTheme(0,true);toast('Black & White default theme restored.')})}

function visibleRows(day,key){return (day[key]||[]).filter(item=>!item._deletedAt)}
function sumRows(rows,key='amount'){return rows.reduce((total,row)=>total+numeric(row[key]),0)}
function denominationTotal(denoms){return DENOMINATIONS.reduce((total,value)=>total+value*numeric(denoms?.[String(value)]),0)}
function dayMetrics(day){
 const cash=sumRows(visibleRows(day,'cashPayments'));
 const online=sumRows(visibleRows(day,'onlinePayments'));
 const grab=sumRows(visibleRows(day,'grabOrders'));
 const refunds=visibleRows(day,'refunds');
 const cashRefunds=sumRows(refunds.filter(x=>x.channel==='Cash'));
 const onlineRefunds=sumRows(refunds.filter(x=>x.channel==='Online'));
 const grabRefunds=sumRows(refunds.filter(x=>x.channel==='Grab'));
 const refundTotal=cashRefunds+onlineRefunds+grabRefunds;
 const discounts=sumRows(visibleRows(day,'discounts'));
 const expenses=visibleRows(day,'expenses');
 const expensesTotal=sumRows(expenses);
 const pettyCash=sumRows(expenses.filter(x=>x.source==='cashier'));
 const opening=denominationTotal(day.opening);
 const closing=denominationTotal(day.closing);
 const netCash=cash-cashRefunds;
 const netOnline=online-onlineRefunds;
 const grabNet=grab-grabRefunds;
 const netSales=netCash+netOnline;
 const allChannelNetSales=netSales+grabNet;
 const nextFloat=numeric(day.nextOpeningFloat??state.settings.defaultFloat);
 const fundsAfterExpenses=opening+allChannelNetSales-expensesTotal;
 const suggestedSalesFund=Math.max(0,fundsAfterExpenses-nextFloat);
 const expectedDrawerBeforeTransfer=opening+cash-cashRefunds-pettyCash;
 const cashTransfer=numeric(day.cashToSalesFund);
 const expectedClosing=expectedDrawerBeforeTransfer-cashTransfer;
 const cashVariance=closing-expectedClosing;
 const losses=visibleRows(day,'losses');
 const lossValue=losses.reduce((total,row)=>total+numeric(row.qty)*numeric(row.unitCost),0);
 return {cash,online,grab,cashRefunds,onlineRefunds,grabRefunds,refundTotal,discounts,expensesTotal,pettyCash,opening,closing,netCash,netOnline,grabNet,netSales,allChannelNetSales,nextFloat,fundsAfterExpenses,suggestedSalesFund,expectedDrawerBeforeTransfer,expectedClosing,cashTransfer,cashVariance,lossValue,moneyReceived:cash+online+grab,suggestedCashTransfer:Math.max(0,expectedDrawerBeforeTransfer-nextFloat)};
}
function hasRecord(day){if(!day)return false;const m=dayMetrics(day);return !!(day.savedAt||m.opening||m.closing||m.moneyReceived||m.expensesTotal||m.refundTotal||m.discounts||visibleRows(day,'losses').length||String(day.notes||'').trim())||['cashPayments','onlinePayments','grabOrders','refunds','expenses','discounts'].some(k=>visibleRows(day,k).length>0)}
function getDay(date){return state.days[date]||{...blankDay(date),nextOpeningFloat:numeric(state.settings.defaultFloat??3000)}}

function setPageHeading(view){
 const map={overview:['YOUR BUSINESS AT A GLANCE','Daily overview <em>&amp; funds.</em>',"A clear view of today's sales, expenses, and cashier funds."],daily:['DAILY SALES RECORD','Daily <em>sales tracker.</em>','Record opening cash, payments, expenses, stock losses, and closing funds.'],reports:['HISTORY & PERFORMANCE','Reports <em>&amp; data.</em>','Review yearly totals, monthly performance, and individual daily sales trackers.'],inventory:['STOCK & FOOD CONTROL','Available <em>stocks.</em>','Maintain stock availability and review recorded food losses.']};const v=map[view]||map.overview;$('pageEyebrow').textContent=v[0];$('pageTitle').innerHTML=v[1];$('pageDescription').textContent=v[2];
}
function switchView(view){
 if(!['overview','daily','reports','inventory'].includes(view))return;
 if(currentView==='daily'&&view!=='daily')syncDraftFromForm();
 currentView=view;['overview','daily','reports','inventory'].forEach(name=>{$(`${name}View`).hidden=name!==view});
 document.querySelectorAll('.nav-link').forEach(button=>button.classList.toggle('active',button.dataset.view===view));$('nav').classList.remove('open');setPageHeading(view);
 if(view==='overview')renderOverview();if(view==='daily')renderDaily();if(view==='reports')renderReports();if(view==='inventory')renderInventory();
 if(currentView!=='daily'&&Object.keys(state.pendingDays).length&&navigator.onLine)syncPending();
}
function openDaily(date){if(currentView==='daily')syncDraftFromForm();currentDate=date||localDateISO();switchView('daily')}

function renderMetricCard(label,value,note,mark='◌',asNumber=false) {const display=asNumber?numeric(value).toLocaleString('en-PH',{maximumFractionDigits:2}):money(value);return `<article class="metric-card"><span class="metric-label">${escapeHTML(label)}</span><strong>${display}</strong><small>${escapeHTML(note||'')}</small><span class="metric-mark">${mark}</span></article>`}
function renderDenominations(containerId,type,values){
 $(containerId).innerHTML=DENOMINATIONS.map(value=>`<label class="denom-row"><span>₱${value.toLocaleString('en-PH')}</span><input type="number" min="0" step="1" inputmode="numeric" data-denom-type="${type}" data-denom-value="${value}" value="${numeric(values?.[String(value)])}" aria-label="Count of ${value} peso bills or coins"><small id="${type}Subtotal${value}">${money(value*numeric(values?.[String(value)]))}</small></label>`).join('');
}
function selectOptions(options,value){return options.map(option=>{const val=typeof option==='string'?option:option.value;const label=typeof option==='string'?option:option.label;return `<option value="${escapeHTML(val)}" ${String(val)===String(value)?'selected':''}>${escapeHTML(label)}</option>`}).join('')}
function field(label,fieldName,value,type='text',placeholder='',options=null,extraClass=''){
 const val=escapeHTML(value??'');const cls=extraClass?` ${extraClass}`:'';
 if(options)return `<label class="${cls.trim()}">${escapeHTML(label)}<select data-field="${fieldName}">${selectOptions(options,value)}</select></label>`;
 return `<label class="${cls.trim()}">${escapeHTML(label)}<input data-field="${fieldName}" type="${type}" ${type==='number'?'min="0" step="0.01"':''} value="${val}" placeholder="${escapeHTML(placeholder)}"></label>`;
}
function renderEntryRow(key,row,index){
 const remove=`<button type="button" class="row-remove" data-remove-row="${key}" data-id="${escapeHTML(row.id)}">Remove</button>`;
 const top=`<div class="row-topline"><strong>Entry ${index+1}</strong>${remove}</div>`;
 if(key==='cashPayments')return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Order number','orderNo',row.orderNo,'text','e.g. 00125')}${field('Amount (₱)','amount',row.amount,'number','0.00')}${field('Note (optional)','note',row.note,'text','Additional details','', 'row-wide')}</div>`;
 if(key==='onlinePayments')return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Order number','orderNo',row.orderNo,'text','e.g. 00125')}${field('Payment method','method',row.method||'GCash','text','',PAYMENT_METHODS)}${field('Amount (₱)','amount',row.amount,'number','0.00')}${field('Note (optional)','note',row.note,'text','Additional details','', 'row-wide')}</div>`;
 if(key==='grabOrders')return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Grab order number','orderNo',row.orderNo,'text','Grab order number')}${field('Order amount (₱)','amount',row.amount,'number','0.00')}${field('Note (optional)','note',row.note,'text','Additional details','', 'row-wide')}</div>`;
 if(key==='refunds')return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Original order number','orderNo',row.orderNo,'text','Order number')}${field('Refund channel','channel',row.channel||'Cash','text','',REFUND_CHANNELS)}${field('Refund amount (₱)','amount',row.amount,'number','0.00')}${field('Reason','reason',row.reason,'text','Reason for refund','', 'row-wide')}</div>`;
 if(key==='expenses')return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Expense category','category',row.category||'Food supplies','text','',EXPENSE_CATEGORIES)}${field('Paid from','source',row.source||'salesFund','text','',EXPENSE_SOURCES)}${field('Amount (₱)','amount',row.amount,'number','0.00')}${field('Description / receipt note','note',row.note,'text','What was purchased?','', 'row-wide')}</div>`;
 if(key==='discounts')return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Order number','orderNo',row.orderNo,'text','Order number')}${field('Sales channel','channel',row.channel||'Cash','text','',REFUND_CHANNELS)}${field('Discount amount (₱)','amount',row.amount,'number','0.00')}${field('Reason / discount type','reason',row.reason,'text','e.g. Senior / promo','', 'row-wide')}</div>`;
 if(key==='losses'){
  const items=state.inventory.filter(item=>!item._deletedAt).map(item=>({value:item.id,label:`${item.name} · ${currentStock(item.id)} ${item.unit||'pcs'} available`}));
  if(row.itemId&&!items.some(x=>x.value===row.itemId))items.unshift({value:row.itemId,label:row.itemName||'Previously recorded item'});
  if(!items.length)items.push({value:'',label:'Add food items in Inventory first'});
  return `<div class="entry-row" data-id="${escapeHTML(row.id)}">${top}${field('Food / stock item','itemId',row.itemId||'','text','',items)}${field('Quantity lost','qty',row.qty??1,'number','1')}${field('Reason for loss','reason',row.reason||'Burnt','text','',REASONS_FOR_LOSS)}${field('Unit cost (₱)','unitCost',row.unitCost??0,'number','0.00')}${field('Note (optional)','note',row.note,'text','Additional details','', 'row-wide')}</div>`;
 }
 return '';
}
function renderRows(key){
 const container=$(`${key}List`);if(!container)return;const rows=visibleRows(currentDay,key);
 container.innerHTML=rows.length?rows.map((row,index)=>renderEntryRow(key,row,index)).join(''):'<div class="empty-entry">No entries yet. Select “Add” when you have something to record.</div>';
}
function renderDaily(){
 currentDay=getDay(currentDate);$('dstDate').value=currentDate;$('cashToSalesFund').value=currentDay.cashToSalesFund??'';$('nextOpeningFloat').value=currentDay.nextOpeningFloat??state.settings.defaultFloat;$('dayNotes').value=currentDay.notes||'';
 renderDenominations('openingDenominations','opening',currentDay.opening);renderDenominations('closingDenominations','closing',currentDay.closing);
 ['cashPayments','onlinePayments','grabOrders','refunds','expenses','discounts','losses'].forEach(renderRows);
 $('dailySaveHint').textContent=currentDay.savedAt?`Last saved locally ${new Date(currentDay.savedAt).toLocaleString('en-PH')}.`:'Changes are saved locally as you work.';
 renderDailySummary();
}
function readRows(key){
 const container=$(`${key}List`);const previous=currentDay?.[key]||[];const tombstones=previous.filter(item=>item._deletedAt);const rows=[...container.querySelectorAll('.entry-row')].map(node=>{
  const previousRow=previous.find(item=>item.id===node.dataset.id);
  const row={...(previousRow?clone(previousRow):{}),id:node.dataset.id,updatedAt:nowISO()};
  node.querySelectorAll('[data-field]').forEach(input=>{let value=input.value;if(input.type==='number')value=value===''?'':Math.max(0,numeric(value));row[input.dataset.field]=value});
  // Track the last time the order number itself was typed or edited. This is
  // deliberately separate from updatedAt, which also changes when amounts/notes change.
  if(['cashPayments','onlinePayments','grabOrders'].includes(key)){
   const oldOrderNo=String(previousRow?.orderNo??'');
   const newOrderNo=String(row.orderNo??'');
   const sequence=key==='grabOrders'?'grab':'payments';
   if(oldOrderNo!==newOrderNo){
    // A manual edit must always become the newest order-number action,
    // even when imported/cloud timestamps are duplicated or ahead of this device's clock.
    if(newOrderNo.trim())row.orderNoUpdatedAt=nextOrderEditTimestamp(sequence);
    else delete row.orderNoUpdatedAt;
   }else if(newOrderNo.trim()&&!row.orderNoUpdatedAt){
    // Preserve the legacy row's original ordering until it is actually edited.
    row.orderNoUpdatedAt=previousRow?.updatedAt||currentDay?.updatedAt||nowISO();
   }
  }
  if(key==='losses'){const item=state.inventory.find(x=>x.id===row.itemId);if(item){row.itemName=item.name;row.unit=item.unit||'pcs';if(row.unitCost===''||row.unitCost===0)row.unitCost=numeric(item.unitCost)}}
  return row;
 });
 return [...rows,...tombstones];
}
function readDayForm(){
 const opening=blankDenominations(),closing=blankDenominations();
 document.querySelectorAll('[data-denom-type="opening"]').forEach(input=>opening[input.dataset.denomValue]=Math.max(0,Math.floor(numeric(input.value))));
 document.querySelectorAll('[data-denom-type="closing"]').forEach(input=>closing[input.dataset.denomValue]=Math.max(0,Math.floor(numeric(input.value))));
 const previous=currentDay||getDay(currentDate);
 return {...previous,date:currentDate,opening,closing,cashPayments:readRows('cashPayments'),onlinePayments:readRows('onlinePayments'),grabOrders:readRows('grabOrders'),refunds:readRows('refunds'),expenses:readRows('expenses'),discounts:readRows('discounts'),losses:readRows('losses'),cashToSalesFund:$('cashToSalesFund').value===''?'':Math.max(0,numeric($('cashToSalesFund').value)),nextOpeningFloat:Math.max(0,numeric($('nextOpeningFloat').value)),notes:$('dayNotes').value,updatedAt:nowISO()};
}
function syncDraftFromForm(){
 if(currentView!=='daily'||!$('dstDate')?.value)return;
 currentDay=readDayForm();state.days[currentDate]=currentDay;state.pendingDays[currentDate]=currentDay.updatedAt;saveLocal();renderDailySummary();$('dailySaveHint').textContent='Draft saved on this device · Select Save daily DST to sync now.';
}
function updateDenominationSubtotals(){['opening','closing'].forEach(type=>{let total=0;document.querySelectorAll(`[data-denom-type="${type}"]`).forEach(input=>{const value=numeric(input.dataset.denomValue),subtotal=value*Math.max(0,Math.floor(numeric(input.value)));total+=subtotal;const target=$(`${type}Subtotal${value}`);if(target)target.textContent=money(subtotal)});const target=$(type==='opening'?'openingTotal':'closingTotal');if(target)target.textContent=money(total)})}
function renderDailySummary(){
 if(!currentDay)return;const day=currentView==='daily'?readDayForm():currentDay;const m=dayMetrics(day);updateDenominationSubtotals();
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=value};
 set('cashPaymentsTotal',money(m.cash));set('onlinePaymentsTotal',money(m.online));set('grabOrdersTotal',money(m.grab));set('refundsTotal',money(m.refundTotal));set('expensesTotal',money(m.expensesTotal));set('pettyCashTotal',money(m.pettyCash));set('discountsTotal',money(m.discounts));set('lossesTotal',money(m.lossValue));
 set('sumOpening',money(m.opening));set('sumCash',money(m.cash));set('sumOnline',money(m.online));set('sumGrab',money(m.grab));set('sumRefunds','−'+money(m.refundTotal));set('sumDiscounts',money(m.discounts));set('sumExpenses','−'+money(m.expensesTotal));set('sumNetSales',money(m.netSales));set('sumGrabNet',money(m.grabNet));set('sumPettyCash',money(m.pettyCash));set('sumFundsAfterExpenses',money(m.fundsAfterExpenses));set('sumSalesFund',money(m.suggestedSalesFund));
 set('openingTotal',money(m.opening));set('closingTotal',money(m.closing));
 $('cashReconciliation').innerHTML=`<div class="recon-cell"><span>Expected closing cash</span><strong>${money(m.expectedClosing)}</strong><small>Opening + cash − cash refunds − petty cash − cash transfer</small></div><div class="recon-cell"><span>Actual closing count</span><strong>${money(m.closing)}</strong><small>Physical denomination total</small></div><div class="recon-cell ${Math.abs(m.cashVariance)<0.005?'variance-positive':m.cashVariance>0?'variance-positive':'variance-negative'}"><span>Cash difference</span><strong>${money(m.cashVariance)}</strong><small>${Math.abs(m.cashVariance)<0.005?'Balanced':m.cashVariance>0?'Over expected cash':'Short against expected cash'}</small></div><div class="recon-cell"><span>Suggested cash transfer</span><strong>${money(m.suggestedCashTransfer)}</strong><small>Expected drawer less next opening float</small></div><div class="recon-cell"><span>Next opening float</span><strong>${money(m.nextFloat)}</strong><small>Change this for each day if needed</small></div><div class="recon-cell"><span>Suggested sales fund</span><strong>${money(m.suggestedSalesFund)}</strong><small>Opening + net sales + Grab net sales − expenses − next float</small></div>`;
}
function orderTimestampMs(stamp){
 if(typeof stamp==='number'&&Number.isFinite(stamp))return stamp;
 const raw=String(stamp??'').trim();
 if(/^\d{10,13}$/.test(raw))return Number(raw);
 return Date.parse(raw)||0;
}
function orderSequenceKeys(sequence){
 return sequence==='grab'?['grabOrders']:['cashPayments','onlinePayments'];
}
function latestOrderTimestamp(sequence){
 let latest=0;
 const keys=orderSequenceKeys(sequence);
 Object.values(state.days).forEach(day=>keys.forEach(key=>(day?.[key]||[]).forEach(row=>{
  const stamp=row?.orderNoUpdatedAt||row?.updatedAt||day?.updatedAt||day?.savedAt||'';
  latest=Math.max(latest,orderTimestampMs(stamp));
 })));
 return latest;
}
function nextOrderEditTimestamp(sequence){
 // Logical clock: every edit/new suggestion gets a timestamp strictly later
 // than every timestamp already stored for this sequence. This prevents an
 // older row edit from losing to stale/future cloud timestamps or same-ms ties.
 const next=Math.max(Date.now(),latestOrderTimestamp(sequence)+1,(orderEditClocks[sequence]||0)+1);
 orderEditClocks[sequence]=next;
 return new Date(next).toISOString();
}
function nextOrderNumber(sequence){
 const keys=orderSequenceKeys(sequence);
 let latestAt=-1,latestValue=null,latestRaw='';
 // Follow the most recently typed/edited numeric order number, never the largest number.
 // Deleted rows remain in the scan so their numbers are not accidentally reused.
 Object.values(state.days).forEach(day=>keys.forEach(key=>(day?.[key]||[]).forEach(row=>{
  const raw=String(row?.orderNo??'').trim();
  if(!/^\d+$/.test(raw))return;
  const stamp=row?.orderNoUpdatedAt||row?.updatedAt||day?.updatedAt||day?.savedAt||'';
  const parsed=orderTimestampMs(stamp);
  if(parsed>=latestAt){latestAt=parsed;latestRaw=raw;latestValue=BigInt(raw)}
 })));
 return latestValue===null?'':String(latestValue+1n).padStart(latestRaw.length,'0');
}
function createRow(key){
 const templates={cashPayments:{orderNo:'',amount:'',note:''},onlinePayments:{orderNo:'',method:'GCash',amount:'',note:''},grabOrders:{orderNo:'',amount:'',note:''},refunds:{orderNo:'',channel:'Cash',amount:'',reason:''},expenses:{category:'Food supplies',source:'salesFund',amount:'',note:''},discounts:{orderNo:'',channel:'Cash',amount:'',reason:''},losses:{itemId:'',itemName:'',qty:1,unitCost:0,reason:'Burnt',note:''}};
 const sequence=(key==='cashPayments'||key==='onlinePayments')?'payments':key==='grabOrders'?'grab':null;
 if(sequence)templates[key].orderNo=nextOrderNumber(sequence);
 const createdAt=nowISO(),orderNo=templates[key]?.orderNo||'';
 const orderNoUpdatedAt=orderNo&&sequence?nextOrderEditTimestamp(sequence):'';
 return {id:makeId(),updatedAt:createdAt,...(orderNoUpdatedAt?{orderNoUpdatedAt}:{}),...(templates[key]||{})};
}
function addEntry(key){syncDraftFromForm();currentDay[key].push(createRow(key));state.days[currentDate]=currentDay;renderRows(key);syncDraftFromForm();}
function removeEntry(key,id){syncDraftFromForm();const row=currentDay[key].find(item=>item.id===id);if(row){row._deletedAt=nowISO();row.updatedAt=nowISO()}state.days[currentDate]=currentDay;renderRows(key);syncDraftFromForm();}

function currentStock(itemId){
 const item=state.inventory.find(x=>x.id===itemId&&!x._deletedAt);if(!item)return 0;
 const restocked=state.restocks.filter(x=>x.itemId===itemId&&!x._deletedAt).reduce((n,x)=>n+numeric(x.qty),0);
 const lost=Object.values(state.days).reduce((total,day)=>total+visibleRows(day,'losses').filter(x=>x.itemId===itemId).reduce((n,x)=>n+numeric(x.qty),0),0);
 return numeric(item.baseQty)+restocked-lost;
}
function renderOverviewIfVisible(){if(currentView==='overview')renderOverview()}
function renderOverview(){
 const date=$('overviewDate').value||localDateISO();const day=getDay(date);const m=dayMetrics(day);$('todayLabel').textContent=dateLabel(localDateISO());
 $('overviewMetrics').innerHTML=[renderMetricCard('Net sales',m.netSales,'Cash + online − refunds','₱'),renderMetricCard('Money received',m.moneyReceived,'All recorded payment channels','↗'),renderMetricCard('Total expenses',m.expensesTotal,'Including optional petty cash','−'),renderMetricCard('Grab net sales',m.grabNet,'Grab orders less Grab refunds','G')].join('');
 $('overviewCashSummary').innerHTML=`<div class="cash-summary-cell"><span>Opening cash</span><strong>${money(m.opening)}</strong><small>Before business opens</small></div><div class="cash-summary-cell"><span>Closing cash</span><strong>${money(m.closing)}</strong><small>Physical cash count</small></div><div class="cash-summary-cell"><span>Cashier petty cash</span><strong>${money(m.pettyCash)}</strong><small>Expenses from cashier</small></div><div class="cash-summary-cell"><span>Cash difference</span><strong>${money(m.cashVariance)}</strong><small>${Math.abs(m.cashVariance)<0.005?'Balanced against expected cash':m.cashVariance>0?'Cash over expected':'Cash short against expected'}</small></div>`;
 $('overviewDayStatus').textContent=day.savedAt?'Saved DST':hasRecord(day)?'Local draft':'No entries yet';$('overviewSalesFund').textContent=money(m.suggestedSalesFund);
 $('overviewFundDetails').innerHTML=`<div class="mini-stat-row"><span>Funds after expenses</span><strong>${money(m.fundsAfterExpenses)}</strong></div><div class="mini-stat-row"><span>Next opening float</span><strong>${money(m.nextFloat)}</strong></div><div class="mini-stat-row"><span>Suggested cash transfer</span><strong>${money(m.suggestedCashTransfer)}</strong></div>`;
 const recent=Object.values(state.days).filter(hasRecord).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
 $('recentDaysBody').innerHTML=recent.length?recent.map(d=>{const x=dayMetrics(d);return `<tr><td>${dateLabel(d.date)}</td><td>${money(x.moneyReceived)}</td><td>${money(x.expensesTotal)}</td><td><strong>${money(x.netSales)}</strong></td><td>${money(x.grabNet)}</td><td><button class="table-action" data-open-date="${escapeHTML(d.date)}">Open DST →</button></td></tr>`}).join(''):'<tr><td class="empty-table" colspan="6">No daily sales records yet. Start by creating your first DST.</td></tr>';
}
function renderReports(){
 const years=new Set([String(new Date().getFullYear()),...Object.keys(state.days).map(date=>date.slice(0,4))]);const selected=$('reportYear').value||String(new Date().getFullYear());$('reportYear').innerHTML=[...years].sort((a,b)=>Number(b)-Number(a)).map(y=>`<option value="${y}" ${y===selected?'selected':''}>${y}</option>`).join('');
 const year=$('reportYear').value;const days=Object.values(state.days).filter(d=>d.date.startsWith(year)&&hasRecord(d));const total=days.reduce((acc,d)=>{const m=dayMetrics(d);acc.received+=m.moneyReceived;acc.expenses+=m.expensesTotal;acc.net+=m.netSales;acc.grab+=m.grabNet;acc.discounts+=m.discounts;return acc},{received:0,expenses:0,net:0,grab:0,discounts:0});
 $('reportYearLabel').textContent=year;$('yearMetrics').innerHTML=[renderMetricCard('Year net sales',total.net,'Cash + online less refunds','₱'),renderMetricCard('Year expenses',total.expenses,'Recorded business expenses','−'),renderMetricCard('Money received',total.received,'Cash, online, and Grab','↗'),renderMetricCard('Grab net sales',total.grab,'Grab orders less Grab refunds','G')].join('');
 const rows=[];for(let month=1;month<=12;month++){const key=`${year}-${String(month).padStart(2,'0')}`;const monthDays=days.filter(d=>d.date.startsWith(key));const sums=monthDays.reduce((acc,d)=>{const m=dayMetrics(d);acc.received+=m.moneyReceived;acc.expenses+=m.expensesTotal;acc.net+=m.netSales;acc.grab+=m.grabNet;return acc},{received:0,expenses:0,net:0,grab:0});rows.push(`<tr><td><button class="month-button" data-open-month="${key}">${monthLabel(year,month)}</button></td><td>${monthDays.length}</td><td>${money(sums.received)}</td><td>${money(sums.expenses)}</td><td><strong>${money(sums.net)}</strong></td><td>${money(sums.grab)}</td><td><button class="table-action" data-open-month="${key}">View days →</button></td></tr>`)}
 $('monthlyReportBody').innerHTML=rows.join('');$('monthDetailCard').hidden=true;
}
function openMonthDetails(key){
 const [year,month]=key.split('-');const days=Object.values(state.days).filter(d=>d.date.startsWith(key)&&hasRecord(d)).sort((a,b)=>a.date.localeCompare(b.date));$('monthDetailTitle').innerHTML=`${monthLabel(year,month)} <em>${year}</em>`;
 $('monthDaysBody').innerHTML=days.length?days.map(day=>{const m=dayMetrics(day);return `<tr><td>${dateLabel(day.date)}</td><td>${money(m.opening)}</td><td>${money(m.moneyReceived)}</td><td>${money(m.expensesTotal)}</td><td><strong>${money(m.netSales)}</strong></td><td>${money(m.grabNet)}</td><td><button class="table-action" data-open-date="${escapeHTML(day.date)}">Open DST →</button></td></tr>`}).join(''):'<tr><td class="empty-table" colspan="7">There are no saved DST records for this month.</td></tr>';
 $('monthDetailCard').hidden=false;$('monthDetailCard').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderInventory(){
 const items=state.inventory.filter(item=>!item._deletedAt);$('inventoryCount').textContent=`${items.length} item${items.length===1?'':'s'}`;
 const low=items.filter(item=>currentStock(item.id)<=numeric(item.lowStockAt)).length;const qty=items.reduce((total,item)=>total+currentStock(item.id),0);const value=items.reduce((total,item)=>total+currentStock(item.id)*numeric(item.unitCost),0);
 $('inventorySummary').innerHTML=[renderMetricCard('Stock items',items.length,'Active food / stock items','▦',true),renderMetricCard('Low-stock alerts',low,'Items at or below alert level','!',true),renderMetricCard('Estimated stock value',value,'Current quantity × unit cost','₱')].join('');
 $('inventoryBody').innerHTML=items.length?items.map(item=>{const stock=currentStock(item.id),isLow=stock<=numeric(item.lowStockAt);return `<tr data-inventory-row="${escapeHTML(item.id)}"><td><input class="inventory-row-input" data-inv-id="${escapeHTML(item.id)}" data-inv-field="name" value="${escapeHTML(item.name)}" aria-label="Stock item name"></td><td><strong>${stock.toLocaleString('en-PH',{maximumFractionDigits:2})}</strong> <span class="stock-status ${isLow?'low':'good'}">${isLow?'Low stock':'Available'}</span></td><td><input class="inventory-row-input small" data-inv-id="${escapeHTML(item.id)}" data-inv-field="unit" value="${escapeHTML(item.unit||'pcs')}" aria-label="Unit"></td><td><input class="inventory-row-input small" type="number" min="0" step=".01" data-inv-id="${escapeHTML(item.id)}" data-inv-field="unitCost" value="${numeric(item.unitCost)}" aria-label="Unit cost"></td><td><input class="inventory-row-input small" type="number" min="0" step=".01" data-inv-id="${escapeHTML(item.id)}" data-inv-field="lowStockAt" value="${numeric(item.lowStockAt)}" aria-label="Low stock level"></td><td><div class="restock-control"><input type="number" min="0.01" step=".01" placeholder="Qty" data-restock-qty="${escapeHTML(item.id)}" aria-label="Restock quantity"><button type="button" data-restock="${escapeHTML(item.id)}">Add</button></div></td><td><button type="button" class="inventory-delete" data-delete-inventory="${escapeHTML(item.id)}">Remove</button></td></tr>`}).join(''):'<tr><td class="empty-table" colspan="7">Your stock list is empty. Add your first food item above to make it available in the loss tracker.</td></tr>';
}

function csvCell(value){const text=String(value??'');return `"${text.replace(/"/g,'""')}"`}
function downloadFile(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportYearCSV(){const year=$('reportYear').value;const header=['DST Date','Opening Cash','Cash Payments','Online Payments','Grab Orders','Refunds','Discounts','Expenses','Petty Cash','Money Received','Net Sales','Grab Net Sales','Closing Cash','Next Opening Float','Suggested Sales Fund','Notes'];const lines=[header.map(csvCell).join(',')];Object.values(state.days).filter(d=>d.date.startsWith(year)&&hasRecord(d)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(d=>{const m=dayMetrics(d);const row=[d.date,m.opening,m.cash,m.online,m.grab,m.refundTotal,m.discounts,m.expensesTotal,m.pettyCash,m.moneyReceived,m.netSales,m.grabNet,m.closing,m.nextFloat,m.suggestedSalesFund,d.notes||''];lines.push(row.map(csvCell).join(','))});downloadFile(`Descanso-DST-${year}.csv`,lines.join('\r\n'),'text/csv;charset=utf-8');toast(`Exported ${year} report.`)}
function exportBackup(){const backup={format:'descanso-finance-backup',version:1,exportedAt:nowISO(),days:state.days,settings:state.settings,inventory:state.inventory,restocks:state.restocks};downloadFile(`Descanso-DST-Backup-${localDateISO()}.json`,JSON.stringify(backup,null,2),'application/json');$('backupMessage').textContent='A JSON backup of your daily records, settings, and inventory has been downloaded.';}
function stableStringify(value){if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;return JSON.stringify(value)}
function mergeById(localRows=[],remoteRows=[]){
 const map=new Map();
 [...remoteRows,...localRows].forEach(item=>{
  if(!item?.id)return;
  const old=map.get(item.id);
  if(!old){map.set(item.id,clone(item));return}
  const itemIsNewer=new Date(item.updatedAt||item._deletedAt||0).getTime()>=new Date(old.updatedAt||old._deletedAt||0).getTime();
  const merged=clone(itemIsNewer?item:old);
  // Order-number edits have their own timestamp because an amount/note edit
  // must not replace a more recently typed order number during cloud merging.
  if(Object.prototype.hasOwnProperty.call(item,'orderNo')||Object.prototype.hasOwnProperty.call(old,'orderNo')){
   const itemHasOrderStamp=!!item.orderNoUpdatedAt,oldHasOrderStamp=!!old.orderNoUpdatedAt;
   let orderSource=itemIsNewer?item:old;
   if(itemHasOrderStamp||oldHasOrderStamp){
    if(itemHasOrderStamp&&!oldHasOrderStamp)orderSource=item;
    else if(oldHasOrderStamp&&!itemHasOrderStamp)orderSource=old;
    else orderSource=(Date.parse(item.orderNoUpdatedAt)||0)>=(Date.parse(old.orderNoUpdatedAt)||0)?item:old;
   }
   merged.orderNo=orderSource.orderNo??'';
   if(orderSource.orderNoUpdatedAt)merged.orderNoUpdatedAt=orderSource.orderNoUpdatedAt;
   else delete merged.orderNoUpdatedAt;
  }
  map.set(item.id,merged);
 });
 return [...map.values()];
}
function mergeDay(local,remote){if(!local)return clone(remote);if(!remote)return clone(local);const lt=new Date(local.updatedAt||0).getTime(),rt=new Date(remote.updatedAt||0).getTime();const latest=lt>=rt?local:remote;const merged={...clone(lt>=rt?remote:local),...clone(latest)};['cashPayments','onlinePayments','grabOrders','refunds','expenses','discounts','losses'].forEach(key=>merged[key]=mergeById(local[key]||[],remote[key]||[]));merged.updatedAt=lt>=rt?local.updatedAt:remote.updatedAt;merged.savedAt=local.savedAt||remote.savedAt||null;return merged}
function mergeMeta(local,remote){if(!local)return clone(remote);if(!remote)return clone(local);const localTime=new Date(local.updatedAt||0).getTime(),remoteTime=new Date(remote.updatedAt||0).getTime();const latest=localTime>=remoteTime?local:remote;return {settings:clone(latest.settings||{}),inventory:mergeById(local.inventory||[],remote.inventory||[]),restocks:mergeById(local.restocks||[],remote.restocks||[]),updatedAt:latest.updatedAt||nowISO()}}
function metaSnapshot(){return {settings:state.settings,inventory:state.inventory,restocks:state.restocks,updatedAt:state.metaUpdatedAt||nowISO()}}
function applyMeta(meta){if(!meta)return;state.settings={...state.settings,...(meta.settings||{})};state.inventory=Array.isArray(meta.inventory)?meta.inventory:state.inventory;state.restocks=Array.isArray(meta.restocks)?meta.restocks:state.restocks;state.metaUpdatedAt=meta.updatedAt||state.metaUpdatedAt}

async function syncPending(){
 if(!supa||!session||!navigator.onLine){status('Saved on this device · waiting for connection',false);return}
 if(syncing)return;syncing=true;let hadError=false;
 try{
  for(const date of Object.keys(state.pendingDays)){
   const local=state.days[date];if(!local){delete state.pendingDays[date];continue}
   const {data:remote,error:readError}=await supa.from('descanso_finance_days').select('data,updated_at').eq('business_date',date).maybeSingle();
   if(readError){hadError=true;console.warn(readError);continue}
   const remoteDay=remote?.data?{...remote.data,updatedAt:remote.data.updatedAt||remote.updated_at}:null;
   const merged=mergeDay(local,remoteDay);const updated=merged.updatedAt||nowISO();
   const {error}=await supa.from('descanso_finance_days').upsert({owner_id:session.user.id,business_date:date,data:merged,updated_at:updated},{onConflict:'owner_id,business_date'});
   if(error){hadError=true;console.error(error);continue}
   state.days[date]=merged;delete state.pendingDays[date];
  }
  if(state.pendingMeta){
   const {data:remote,error:readError}=await supa.from('descanso_finance_meta').select('data,updated_at').eq('id',1).maybeSingle();
   if(readError){hadError=true;console.warn(readError)}else{
    const remoteMeta=remote?.data?{...remote.data,updatedAt:remote.data.updatedAt||remote.updated_at}:null;const merged=mergeMeta(metaSnapshot(),remoteMeta);const {error}=await supa.from('descanso_finance_meta').upsert({id:1,owner_id:session.user.id,data:merged,updated_at:merged.updatedAt||nowISO()},{onConflict:'id'});
    if(error){hadError=true;console.error(error)}else{applyMeta(merged);state.pendingMeta=false}
   }
  }
  saveLocal();status(hadError?'Some changes are waiting to sync':'All changes synced',!hadError);
  if(!hadError)toast('Your financial records are synced.');
 }catch(error){console.error(error);hadError=true;status('Cloud sync needs attention · local data is safe',false)}
 finally{syncing=false;renderOverviewIfVisible();if(currentView==='reports')renderReports();if(currentView==='inventory')renderInventory()}
}
async function pullCloud(){
 if(!supa||!session||!navigator.onLine||syncing)return;
 syncing=true;let pullError=false;
 try{
  const {data:remoteDays,error}=await supa.from('descanso_finance_days').select('business_date,data,updated_at').order('business_date',{ascending:true});
  if(error)throw error;
  (remoteDays||[]).forEach(row=>{
   const date=row.business_date;const remote={...(row.data||blankDay(date)),date,updatedAt:row.data?.updatedAt||row.updated_at};const local=state.days[date];
   if(local){const merged=mergeDay(local,remote);state.days[date]=merged;if(state.pendingDays[date]||stableStringify(merged)!==stableStringify(remote))state.pendingDays[date]=merged.updatedAt||nowISO()}
   else state.days[date]=remote;
  });
  const {data:metaRow,error:metaError}=await supa.from('descanso_finance_meta').select('data,updated_at').eq('id',1).maybeSingle();
  if(metaError)throw metaError;
  if(metaRow?.data){const remoteMeta={...metaRow.data,updatedAt:metaRow.data.updatedAt||metaRow.updated_at};if(state.pendingMeta){const merged=mergeMeta(metaSnapshot(),remoteMeta);applyMeta(merged)}else applyMeta(remoteMeta)}else if(!state.pendingMeta){state.pendingMeta=true;state.metaUpdatedAt=nowISO()}
  saveLocal();status('Cloud records loaded');
 }catch(error){console.error(error);pullError=true;status('Local mode · cloud setup or connection needs attention',false)}
 finally{syncing=false;renderAll();if(!pullError&&(Object.keys(state.pendingDays).length||state.pendingMeta))syncPending()}
}
async function connectCloud(){
 if(!window.supabase||!window.DESCANSO_SUPABASE_URL||!window.DESCANSO_SUPABASE_PUBLISHABLE_KEY){$('loginMessage').textContent='Cloud sign-in is not configured. Please check config.js and the Supabase setup instructions.';status('Cloud configuration required',false);return}
 supa=window.supabase.createClient(window.DESCANSO_SUPABASE_URL,window.DESCANSO_SUPABASE_PUBLISHABLE_KEY);
 const {data,error}=await supa.auth.getSession();if(error)console.warn(error);session=data?.session||null;
 supa.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(session){loadUserState(session.user.id);showApp();setTimeout(()=>pullCloud(),0)}else{clearActiveUser();showLogin()}});
 if(session){loadUserState(session.user.id);showApp();await pullCloud()}else showLogin();
 supa.channel('descanso-finance-live-sync').on('postgres_changes',{event:'*',schema:'public',table:'descanso_finance_days'},()=>pullCloud()).on('postgres_changes',{event:'*',schema:'public',table:'descanso_finance_meta'},()=>pullCloud()).subscribe();
}
function showLogin(){ $('appShell').hidden=true;$('loginGate').hidden=false;status('Sign in required',false) }
function showApp(){ $('loginGate').hidden=true;$('appShell').hidden=false;$('footerUser').textContent=session?.user?.email||'Authorized user';document.title=`${state.settings.businessName||'Descanso'} | Daily Sales Tracker`;$('todayLabel').textContent=dateLabel(localDateISO());if(!$('overviewDate').value)$('overviewDate').value=localDateISO();if(!$('dstDate').value)$('dstDate').value=currentDate;renderAll();status(navigator.onLine?'Connected · ready to sync':'Offline · local records available',navigator.onLine) }
async function login(event){event?.preventDefault();$('loginMessage').textContent='Signing in…';$('loginButton').disabled=true;if(!supa){$('loginMessage').textContent='Cloud sign-in is unavailable. Check your connection and configuration.';$('loginButton').disabled=false;return}const {data,error}=await supa.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});$('loginButton').disabled=false;if(error){$('loginMessage').textContent='We could not sign you in. Please check your email and password.';return}session=data.session;loadUserState(session.user.id);showApp();$('loginMessage').textContent='';await pullCloud();if(Object.keys(state.pendingDays).length||state.pendingMeta)await syncPending()}
async function logout(){if(supa)await supa.auth.signOut();session=null;clearActiveUser();showLogin();$('adminPassword').value=''}

function renderAll(){if($('appShell').hidden)return;renderOverview();if(currentView==='daily')renderDaily();if(currentView==='reports')renderReports();if(currentView==='inventory')renderInventory()}
async function saveCurrentDay(){if(currentView!=='daily')return;syncDraftFromForm();currentDay=state.days[currentDate];currentDay.savedAt=nowISO();currentDay.updatedAt=nowISO();state.days[currentDate]=currentDay;state.pendingDays[currentDate]=currentDay.updatedAt;saveLocal();$('dailySaveHint').textContent=`Saved locally · ${new Date(currentDay.savedAt).toLocaleString('en-PH')}`;toast('Daily DST saved on this device.');if(navigator.onLine&&session)await syncPending();renderDailySummary();renderOverviewIfVisible()}

function saveSettings(){const name=$('businessName').value.trim()||'Descanso Comida • Cafe';const defaultFloat=Math.max(0,numeric($('defaultFloat').value));state.settings={...state.settings,businessName:name,defaultFloat,updatedAt:nowISO()};markMetaPending();$('settingsModal').hidden=true;document.title=`${name} | Daily Sales Tracker`;if(currentView==='daily'&&currentDay&&!currentDay.savedAt){$('nextOpeningFloat').value=defaultFloat;syncDraftFromForm()}toast('Tracker settings saved.');if(navigator.onLine&&session)syncPending()}
function openSettings(){$('businessName').value=state.settings.businessName||'Descanso Comida • Cafe';$('defaultFloat').value=numeric(state.settings.defaultFloat??3000);$('settingsModal').hidden=false}
function addInventory(event){event.preventDefault();const name=$('inventoryName').value.trim();if(!name)return;state.inventory.push({id:makeId(),name,unit:$('inventoryUnit').value||'pcs',baseQty:Math.max(0,numeric($('inventoryQty').value)),unitCost:Math.max(0,numeric($('inventoryCost').value)),lowStockAt:Math.max(0,numeric($('inventoryLow').value)),updatedAt:nowISO()});markMetaPending();$('addInventoryForm').reset();$('inventoryQty').value='0';$('inventoryCost').value='0';$('inventoryLow').value='5';renderInventory();if(currentView==='daily')renderDaily();toast(`${name} added to the stock list.`);if(navigator.onLine&&session)syncPending()}
function updateInventoryField(input){const item=state.inventory.find(x=>x.id===input.dataset.invId);if(!item)return;const field=input.dataset.invField;item[field]=input.type==='number'?Math.max(0,numeric(input.value)):input.value;item.updatedAt=nowISO();markMetaPending();renderInventorySummaryOnly()}
function renderInventorySummaryOnly(){const items=state.inventory.filter(item=>!item._deletedAt);const low=items.filter(item=>currentStock(item.id)<=numeric(item.lowStockAt)).length;const value=items.reduce((total,item)=>total+currentStock(item.id)*numeric(item.unitCost),0);const qty=items.reduce((total,item)=>total+currentStock(item.id),0);$('inventorySummary').innerHTML=[renderMetricCard('Stock items',items.length,'Active food / stock items','▦',true),renderMetricCard('Low-stock alerts',low,'Items at or below alert level','!',true),renderMetricCard('Estimated stock value',value,`${qty.toLocaleString('en-PH',{maximumFractionDigits:2})} total units · estimated`,'₱')].join('')}
function restockItem(id){const input=document.querySelector(`[data-restock-qty="${CSS.escape(id)}"]`);const qty=numeric(input?.value);if(!qty||qty<=0){toast('Enter a restock quantity greater than zero.');return}state.restocks.push({id:makeId(),itemId:id,qty,date:localDateISO(),updatedAt:nowISO()});markMetaPending();renderInventory();if(currentView==='daily')renderDaily();toast('Stock quantity updated.');if(navigator.onLine&&session)syncPending()}
function deleteInventory(id){const item=state.inventory.find(x=>x.id===id);if(!item)return;item._deletedAt=nowISO();item.updatedAt=nowISO();markMetaPending();renderInventory();if(currentView==='daily')renderDaily();toast('Item removed from the active stock dropdown. Historical losses remain in reports.');if(navigator.onLine&&session)syncPending()}

function mergeBackup(incoming){if(!incoming||typeof incoming!=='object'||!incoming.days)throw new Error('This file is not a valid Descanso DST backup.');Object.entries(incoming.days).forEach(([date,day])=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!day||typeof day!=='object')return;state.days[date]=mergeDay(state.days[date],{...day,date});state.pendingDays[date]=state.days[date].updatedAt||nowISO()});const incomingMeta={settings:incoming.settings||{},inventory:incoming.inventory||[],restocks:incoming.restocks||[],updatedAt:incoming.settings?.updatedAt||incoming.exportedAt||nowISO()};const merged=mergeMeta(metaSnapshot(),incomingMeta);applyMeta(merged);state.pendingMeta=true;state.metaUpdatedAt=nowISO();saveLocal();renderAll();if(navigator.onLine&&session)syncPending()}

/* Event wiring */
$('loginForm').addEventListener('submit',login);
$('logoutButton').addEventListener('click',logout);$('logoutNavButton').addEventListener('click',logout);
$('menuToggle').addEventListener('click',()=>$('nav').classList.toggle('open'));
document.querySelectorAll('.nav-link').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
document.querySelectorAll('.brand[href="#overview"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();switchView('overview')}));
document.querySelectorAll('[data-open-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.openView)));
$('overviewDate').value=localDateISO();$('overviewDate').addEventListener('change',renderOverview);
$('openTodayDST').addEventListener('click',()=>openDaily($('overviewDate').value||localDateISO()));
$('dstDate').addEventListener('change',()=>{syncDraftFromForm();currentDate=$('dstDate').value||localDateISO();renderDaily()});
$('newDST').addEventListener('click',()=>openDaily(localDateISO()));
$('saveDST').addEventListener('click',saveCurrentDay);$('saveDSTBottom').addEventListener('click',saveCurrentDay);
document.querySelectorAll('[data-add-row]').forEach(button=>button.addEventListener('click',()=>addEntry(button.dataset.addRow)));
document.addEventListener('click',event=>{
 const remove=event.target.closest('[data-remove-row]');if(remove){removeEntry(remove.dataset.removeRow,remove.dataset.id);return}
 const openDate=event.target.closest('[data-open-date]');if(openDate){openDaily(openDate.dataset.openDate);return}
 const openMonth=event.target.closest('[data-open-month]');if(openMonth){openMonthDetails(openMonth.dataset.openMonth);return}
 const restock=event.target.closest('[data-restock]');if(restock){restockItem(restock.dataset.restock);return}
 const deleteItem=event.target.closest('[data-delete-inventory]');if(deleteItem){deleteInventory(deleteItem.dataset.deleteInventory);return}
});
document.addEventListener('input',event=>{
 if(event.target.matches('[data-denom-type], [data-field], #cashToSalesFund, #nextOpeningFloat, #dayNotes')){syncDraftFromForm();return}
 if(event.target.matches('[data-inv-id]'))updateInventoryField(event.target);
});
document.addEventListener('change',event=>{if(event.target.matches('[data-field="itemId"]')){const item=state.inventory.find(x=>x.id===event.target.value);const cost=event.target.closest('.entry-row')?.querySelector('[data-field="unitCost"]');if(item&&cost&&(!cost.value||numeric(cost.value)===0))cost.value=numeric(item.unitCost)}if(event.target.matches('[data-denom-type], [data-field]'))syncDraftFromForm();if(event.target.matches('[data-inv-id]')){renderInventory();if(currentView==='daily')renderDaily()}});
$('addInventoryForm').addEventListener('submit',addInventory);
$('reportYear').addEventListener('change',renderReports);
$('closeMonthDetails').addEventListener('click',()=>$('monthDetailCard').hidden=true);
$('exportYearCSV').addEventListener('click',exportYearCSV);
$('exportBackup').addEventListener('click',exportBackup);$('exportBackupSecondary').addEventListener('click',exportBackup);
$('importBackup').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const text=await file.text();mergeBackup(JSON.parse(text));$('backupMessage').textContent='Backup restored and merged. Existing records with the same date were merged by record and transaction ID.';toast('Backup data merged successfully.')}catch(error){$('backupMessage').textContent=error.message||'Could not restore this backup.'}finally{event.target.value=''}});
$('settingsOpen').addEventListener('click',openSettings);$('settingsClose').addEventListener('click',()=>$('settingsModal').hidden=true);$('cancelSettings').addEventListener('click',()=>$('settingsModal').hidden=true);$('settingsModal').addEventListener('click',event=>{if(event.target===$('settingsModal'))$('settingsModal').hidden=true});$('saveSettings').addEventListener('click',saveSettings);
window.addEventListener('online',async()=>{status('Back online · syncing',true);if(session){await pullCloud();if(Object.keys(state.pendingDays).length||state.pendingMeta)await syncPending()}});
window.addEventListener('offline',()=>status('Offline · local records available',false));
window.addEventListener('beforeunload',()=>{if(currentView==='daily')syncDraftFromForm()});

setupThemes();$('todayLabel').textContent=dateLabel(localDateISO());status(navigator.onLine?'Checking sign-in…':'Offline · sign-in required',false);connectCloud().catch(error=>{console.error(error);$('loginMessage').textContent='We could not connect to the sign-in service. Please check your internet connection.';status('Cloud connection unavailable',false)});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
})();
