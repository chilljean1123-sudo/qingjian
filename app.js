const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

const DEFAULTS = {
  user:{name:'阿青',persona:'温和、认真，表达自然。'},
  character:{name:'卢恩',avatar:'L',persona:'四十岁地下摇滚乐队主唱。说话松弛、自然、有生活感，不像客服。'},
  api:{url:'',key:'',model:''},
  preset:{system:'请像真实即时聊天一样回复。口语化、自然，不要每次都追问，不要解释你是AI。根据人设、世界书和当前语境回答。',temperature:.9,maxTokens:700,historyTurns:20},
  worldbook:[], regex:[], stickers:[],
  appearance:{accent:'#eea9bb',bg:'#f6f2f5',bubble:'#f6dce4',fontScale:1,wallpaper:''},
  push:{serverUrl:'',vapidPublicKey:''},
  messages:[
    {id:uid(),role:'assistant',content:'到家了没  青大记者',ts:Date.now()-480000},
    {id:uid(),role:'user',content:'刚到  今天跑了一天',ts:Date.now()-420000},
    {id:uid(),role:'assistant',content:'啧  那先歇会儿  叔叔不催你说话',ts:Date.now()-360000}
  ]
};

let state=loadState(), deferredInstallPrompt=null, typingNode=null;

function clone(v){return JSON.parse(JSON.stringify(v))}
function merge(a,b){
  const out=clone(a);
  const walk=(x,y)=>Object.keys(y||{}).forEach(k=>{
    if(y[k]&&typeof y[k]==='object'&&!Array.isArray(y[k])&&x[k]&&typeof x[k]==='object'&&!Array.isArray(x[k])) walk(x[k],y[k]);
    else x[k]=y[k];
  });
  walk(out,b||{}); return out;
}
function loadState(){try{return merge(DEFAULTS,JSON.parse(localStorage.getItem('qingchat_state')||'{}'))}catch{return clone(DEFAULTS)}}
function persist(){localStorage.setItem('qingchat_state',JSON.stringify(state))}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add('hidden'),1800)}
function fmt(ts){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts))}
function fileData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}

function shade(hex,amt){const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return `#${(b|g<<8|r<<16).toString(16).padStart(6,'0')}`}
function applyAppearance(){
  const a=state.appearance, root=document.documentElement;
  root.style.setProperty('--accent',a.accent);root.style.setProperty('--accent-strong',shade(a.accent,-14));root.style.setProperty('--bg',a.bg);root.style.setProperty('--bubble',a.bubble);root.style.setProperty('--font-scale',a.fontScale);
  $('#app').style.backgroundImage=a.wallpaper?`linear-gradient(rgba(246,242,245,.18),rgba(246,242,245,.18)),url(${a.wallpaper})`:'';
}
function renderHeader(){
  $('#activeName').textContent=state.character.name||'角色';
  $('#activeAvatar').textContent=(state.character.avatar||state.character.name?.[0]||'A').slice(0,2);
}
function applyRegex(text,scope){let out=text;for(const r of state.regex){if(!r.pattern||!(r.scope===scope||r.scope==='both'))continue;try{out=out.replace(new RegExp(r.pattern,r.flags||'g'),r.replace||'')}catch{}}return out}
function renderMessages(){
  const list=$('#messageList');list.innerHTML='';
  state.messages.forEach(m=>{
    const row=document.createElement('div');row.className=`message-row ${m.role==='user'?'me':'peer'}`;
    const av=document.createElement('div');av.className='msg-avatar';av.textContent=m.role==='user'?(state.user.name?.[0]||'我'):(state.character.avatar||state.character.name?.[0]||'A');
    const bubble=document.createElement('div');bubble.className='message';
    bubble.innerHTML=m.type==='sticker'?`<img class="sticker" src="${m.content}" alt="sticker"><time>${fmt(m.ts)}</time>`:`${esc(applyRegex(m.content,'display'))}<time>${fmt(m.ts)}</time>`;
    m.role==='user'?row.append(bubble,av):row.append(av,bubble);list.append(row);
  });
  list.scrollTop=list.scrollHeight;
}
function renderStickers(){
  const draw=(root,manage)=>{root.innerHTML='';if(!state.stickers.length){root.innerHTML='<p class="hint">还没有表情包。</p>';return}state.stickers.forEach((s,i)=>{const b=document.createElement('button');b.innerHTML=`<img src="${s.data}" alt="${esc(s.name||'sticker')}">`;b.onclick=()=>manage?(confirm('删除这张表情包？')&&(state.stickers.splice(i,1),persist(),renderStickers())):sendSticker(s.data);root.append(b)})};
  draw($('#stickerGrid'),false);draw($('#stickerManage'),true);
}
function renderWorld(){
  const root=$('#worldEntries');root.innerHTML='';
  state.worldbook.forEach((e,i)=>{const d=document.createElement('div');d.className='entry';d.innerHTML=`<div class="entry-grid"><input data-w="keys" data-i="${i}" placeholder="关键词，逗号分隔" value="${esc(e.keys||'')}"><input data-w="title" data-i="${i}" placeholder="标题" value="${esc(e.title||'')}"></div><textarea data-w="content" data-i="${i}" placeholder="条目内容">${esc(e.content||'')}</textarea><div class="entry-actions"><button class="danger-btn" data-del-world="${i}">删除</button></div>`;root.append(d)});
  $$('[data-w]',root).forEach(el=>el.oninput=()=>{state.worldbook[+el.dataset.i][el.dataset.w]=el.value;persist()});
  $$('[data-del-world]',root).forEach(el=>el.onclick=()=>{state.worldbook.splice(+el.dataset.delWorld,1);persist();renderWorld()});
}
function renderRegex(){
  const root=$('#regexRules');root.innerHTML='';
  state.regex.forEach((r,i)=>{const d=document.createElement('div');d.className='entry';d.innerHTML=`<div class="entry-grid"><select data-r="scope" data-i="${i}"><option value="display" ${r.scope==='display'?'selected':''}>显示前</option><option value="send" ${r.scope==='send'?'selected':''}>发送前</option><option value="both" ${r.scope==='both'?'selected':''}>两者</option></select><input data-r="flags" data-i="${i}" placeholder="flags，如 gi" value="${esc(r.flags||'g')}"></div><input data-r="pattern" data-i="${i}" placeholder="正则表达式" value="${esc(r.pattern||'')}"><input data-r="replace" data-i="${i}" placeholder="替换为" value="${esc(r.replace||'')}"><div class="entry-actions"><button class="danger-btn" data-del-regex="${i}">删除</button></div>`;root.append(d)});
  $$('[data-r]',root).forEach(el=>el.oninput=()=>{state.regex[+el.dataset.i][el.dataset.r]=el.value;persist()});
  $$('[data-del-regex]',root).forEach(el=>el.onclick=()=>{state.regex.splice(+el.dataset.delRegex,1);persist();renderRegex()});
}
function fillSettings(){
  $('#userName').value=state.user.name;$('#userPersona').value=state.user.persona;$('#charName').value=state.character.name;$('#charAvatar').value=state.character.avatar;$('#charPersona').value=state.character.persona;
  $('#apiUrl').value=state.api.url;$('#apiKey').value=state.api.key;$('#modelManual').value=state.api.model;$('#systemPreset').value=state.preset.system;$('#temperature').value=state.preset.temperature;$('#maxTokens').value=state.preset.maxTokens;$('#historyTurns').value=state.preset.historyTurns;
  $('#accentColor').value=state.appearance.accent;$('#bgColor').value=state.appearance.bg;$('#bubbleColor').value=state.appearance.bubble;$('#fontScale').value=state.appearance.fontScale;
  const ps=$('#pushServerUrl'),vk=$('#vapidPublicKey');if(ps)ps.value=state.push.serverUrl||'';if(vk)vk.value=state.push.vapidPublicKey||'';
  renderWorld();renderRegex();renderStickers();
}
function collectSettings(){
  state.user={name:$('#userName').value.trim()||'我',persona:$('#userPersona').value.trim()};
  state.character={name:$('#charName').value.trim()||'角色',avatar:$('#charAvatar').value.trim()||($('#charName').value.trim()[0]||'A'),persona:$('#charPersona').value.trim()};
  state.api={url:$('#apiUrl').value.trim().replace(/\/$/,''),key:$('#apiKey').value.trim(),model:$('#modelSelect').value||$('#modelManual').value.trim()};
  state.preset={system:$('#systemPreset').value.trim(),temperature:+$('#temperature').value||.9,maxTokens:+$('#maxTokens').value||700,historyTurns:+$('#historyTurns').value||20};
  Object.assign(state.appearance,{accent:$('#accentColor').value,bg:$('#bgColor').value,bubble:$('#bubbleColor').value,fontScale:+$('#fontScale').value||1});
  const ps=$('#pushServerUrl'),vk=$('#vapidPublicKey');if(ps&&vk)state.push={serverUrl:ps.value.trim().replace(/\/$/,''),vapidPublicKey:vk.value.trim()};
  persist();applyAppearance();renderHeader();renderMessages();
}

function matchedWorld(){
  const recent=state.messages.slice(-Math.max(6,state.preset.historyTurns)).map(m=>m.content||'').join('\n').toLowerCase();
  return state.worldbook.filter(e=>(e.keys||'').split(/[,，\n]/).map(x=>x.trim().toLowerCase()).filter(Boolean).some(k=>recent.includes(k))).map(e=>`【${e.title||'世界书'}】\n${e.content}`).join('\n\n');
}
function chatMessages(){
  const sys=[state.preset.system,`你的角色：${state.character.name}\n${state.character.persona}`,`与你聊天的用户：${state.user.name}\n${state.user.persona}`,matchedWorld()].filter(Boolean).join('\n\n');
  const history=state.messages.filter(m=>m.type!=='sticker').slice(-state.preset.historyTurns).map(m=>({role:m.role,content:m.content}));
  return [{role:'system',content:sys},...history];
}
async function generateReply(){
  const {url,key,model}=state.api;if(!url||!model)throw new Error('先在设置里填写 API URL 并选择模型');
  const endpoint=url.endsWith('/chat/completions')?url:`${url}/chat/completions`;
  const headers={'Content-Type':'application/json'};if(key)headers.Authorization=`Bearer ${key}`;
  const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({model,messages:chatMessages(),temperature:state.preset.temperature,max_tokens:state.preset.maxTokens})});
  if(!r.ok)throw new Error(`${r.status} ${(await r.text()).slice(0,180)}`);const d=await r.json();return d.choices?.[0]?.message?.content?.trim()||'……';
}
async function loadModels(){
  collectSettings();if(!state.api.url){toast('先填写 API URL');return}
  const url=state.api.url.replace(/\/chat\/completions$/,'');const headers={};if(state.api.key)headers.Authorization=`Bearer ${state.api.key}`;
  $('#apiStatus').textContent='拉取中…';
  try{const r=await fetch(`${url}/models`,{headers});if(!r.ok)throw new Error(`${r.status}`);const d=await r.json(),arr=(d.data||d.models||[]).map(x=>typeof x==='string'?x:x.id).filter(Boolean);const sel=$('#modelSelect');sel.innerHTML='<option value="">选择模型</option>'+arr.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');if(arr.includes(state.api.model))sel.value=state.api.model;$('#apiStatus').textContent=`已拉取 ${arr.length} 个模型`;}catch(e){$('#apiStatus').textContent=`拉取失败：${e.message}`}
}
async function testApi(){
  collectSettings();const {url,key,model}=state.api;if(!url||!model){toast('URL 和模型不能为空');return}const endpoint=url.endsWith('/chat/completions')?url:`${url}/chat/completions`,headers={'Content-Type':'application/json'};if(key)headers.Authorization=`Bearer ${key}`;$('#apiStatus').textContent='测试中…';
  try{const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({model,messages:[{role:'user',content:'只回复 OK'}],max_tokens:12,temperature:0})});if(!r.ok)throw new Error(`${r.status} ${(await r.text()).slice(0,100)}`);$('#apiStatus').textContent='连接正常';}catch(e){$('#apiStatus').textContent=`连接失败：${e.message}`}
}
function showTyping(){removeTyping();const list=$('#messageList'),r=document.createElement('div');r.className='message-row peer';r.innerHTML=`<div class="msg-avatar">${esc(state.character.avatar||'A')}</div><div class="message typing"><i></i><i></i><i></i></div>`;list.append(r);typingNode=r;list.scrollTop=list.scrollHeight}
function removeTyping(){typingNode?.remove();typingNode=null}
async function sendMessage(){
  const input=$('#messageInput');let text=input.value.trim();if(!text)return;text=applyRegex(text,'send');input.value='';autoResize(input);state.messages.push({id:uid(),role:'user',content:text,ts:Date.now()});persist();renderMessages();showTyping();
  try{const reply=await generateReply();removeTyping();state.messages.push({id:uid(),role:'assistant',content:reply,ts:Date.now()});persist();renderMessages();maybeNotify(`${state.character.name} 发来消息`,reply)}catch(e){removeTyping();state.messages.push({id:uid(),role:'assistant',content:`[连接失败] ${e.message}`,ts:Date.now()});persist();renderMessages()}
}
function sendSticker(data){state.messages.push({id:uid(),role:'user',type:'sticker',content:data,ts:Date.now()});persist();renderMessages();$('#stickerTray').classList.add('hidden')}
function addTool(text){state.messages.push({id:uid(),role:'assistant',content:`[工具] ${text}`,ts:Date.now()});persist();renderMessages()}

async function weatherTool(){
  toast('正在获取位置和天气…');const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:10000}));const {latitude,longitude}=pos.coords;
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,wind_speed_10m&timezone=auto`);const d=await r.json(),c=d.current;addTool(`当前位置天气：${c.temperature_2m}°C，体感 ${c.apparent_temperature}°C，风速 ${c.wind_speed_10m} km/h。`);
}
function modal(title,body,ok){$('#modalCard').innerHTML=`<h3>${title}</h3>${body}<div class="modal-actions"><button class="secondary-btn" data-cancel>取消</button><button class="primary-btn" style="width:auto" data-ok>确定</button></div>`;$('#modal').classList.remove('hidden');$('[data-cancel]').onclick=()=>$('#modal').classList.add('hidden');$('[data-ok]').onclick=()=>{ok();$('#modal').classList.add('hidden')}}
function calendarTool(){modal('创建日历事件','<input id="calTitle" placeholder="事件标题"><input id="calDate" type="datetime-local">',()=>{const title=$('#calTitle').value||'青笺事件',dt=$('#calDate').value?new Date($('#calDate').value):new Date(Date.now()+3600000),pad=n=>String(n).padStart(2,'0'),z=d=>`${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`,ics=`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTAMP:${z(new Date())}\nDTSTART:${z(dt)}\nSUMMARY:${title.replace(/\n/g,' ')}\nEND:VEVENT\nEND:VCALENDAR`;download(new Blob([ics],{type:'text/calendar'}),'qingjian-event.ics');addTool(`已生成日历事件：${title}`)})}
function alarmTool(){modal('设置提醒','<input id="alarmText" placeholder="提醒内容"><input id="alarmMinutes" type="number" min="1" value="10">',()=>{const text=$('#alarmText').value||'青笺提醒',mins=Math.max(1,+$('#alarmMinutes').value||10);setTimeout(()=>maybeNotify('提醒',text,true),Math.min(mins*60000,2147483647));addTool(`已设置网页提醒：${mins} 分钟后「${text}」。浏览器若被系统彻底停止，不能保证触发。`)})}
function musicTool(){modal('听歌','<input id="musicQuery" placeholder="歌名 / 歌手">',()=>{const q=$('#musicQuery').value.trim();if(!q)return;window.open(`https://music.apple.com/cn/search?term=${encodeURIComponent(q)}`,'_blank','noopener');addTool(`已打开音乐搜索：${q}`)})}

async function requestNotification(){if(!('Notification'in window)){toast('当前浏览器不支持通知');return}const p=await Notification.requestPermission();toast(p==='granted'?'通知权限已允许':`通知权限：${p}`)}
async function maybeNotify(title,body,force=false){if(!('Notification'in window)||Notification.permission!=='granted'||(!force&&document.visibilityState==='visible'))return;const reg=await navigator.serviceWorker?.ready.catch(()=>null);reg?reg.showNotification(title,{body,icon:'./icon.svg',badge:'./icon.svg',tag:'qingjian-message',renotify:true}):new Notification(title,{body})}
function testNotification(){maybeNotify('青笺测试','系统通知可以正常弹出。',true)}
function b64u(s){const p='='.repeat((4-s.length%4)%4),raw=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function subscribePush(){
  collectSettings();if(!state.push.serverUrl||!state.push.vapidPublicKey){toast('先填写 Push Server URL 和 VAPID Public Key');return}if(!('serviceWorker'in navigator)||!('PushManager'in window)){toast('当前浏览器不支持 Web Push');return}
  const p=await Notification.requestPermission();if(p!=='granted'){toast('通知权限未允许');return}const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(state.push.vapidPublicKey)});const r=await fetch(`${state.push.serverUrl}/subscribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});if(!r.ok)throw new Error(`订阅失败 ${r.status}`);toast('Web Push 已订阅')
}
function injectPushUI(){
  const panel=$('[data-panel="capabilities"] .card');if(!panel||$('#pushServerUrl'))return;const hint=panel.querySelector('.hint'),wrap=document.createElement('div');wrap.className='entry';wrap.innerHTML='<strong>Web Push 后台通知</strong><label>Push Server URL<input id="pushServerUrl" placeholder="https://your-push-server.example.com"></label><label>VAPID Public Key<input id="vapidPublicKey" placeholder="B... public key"></label><button id="subscribePush" class="secondary-btn">订阅后台推送</button>';panel.insertBefore(wrap,hint);$('#subscribePush').onclick=()=>subscribePush().catch(e=>toast(e.message));
}

function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportData(){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`qingjian-backup-${Date.now()}.json`)}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(120,el.scrollHeight)+'px'}
function openSettings(tab){injectPushUI();fillSettings();$('#settingsDrawer').classList.remove('hidden');$('#drawerMask').classList.remove('hidden');$('#settingsDrawer').setAttribute('aria-hidden','false');if(tab){const b=$(`.settings-tab[data-tab="${tab}"]`);b?.click()}}
function closeSettings(){$('#settingsDrawer').classList.add('hidden');$('#drawerMask').classList.add('hidden');$('#settingsDrawer').setAttribute('aria-hidden','true')}
function bind(){
  $('#sendBtn').onclick=sendMessage;$('#messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});$('#messageInput').addEventListener('input',e=>autoResize(e.target));
  $('#openSettings').onclick=()=>openSettings();$('#closeSettings').onclick=closeSettings;$('#drawerMask').onclick=closeSettings;$('#saveSettings').onclick=()=>{collectSettings();closeSettings();toast('已保存')};
  $$('.settings-tab').forEach(b=>b.onclick=()=>{$$('.settings-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.settings-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===b.dataset.tab))});
  $('#addWorldEntry').onclick=()=>{state.worldbook.push({title:'',keys:'',content:''});persist();renderWorld()};$('#addRegexRule').onclick=()=>{state.regex.push({scope:'display',pattern:'',replace:'',flags:'g'});persist();renderRegex()};
  $('#loadModels').onclick=loadModels;$('#testApi').onclick=testApi;$('#stickerBtn').onclick=()=>$('#stickerTray').classList.toggle('hidden');$('#closeStickerTray').onclick=()=>$('#stickerTray').classList.add('hidden');
  $('#stickerImport').onchange=async e=>{for(const f of e.target.files)state.stickers.push({name:f.name,data:await fileData(f)});persist();renderStickers();e.target.value=''};
  $('#wallpaperInput').onchange=async e=>{const f=e.target.files[0];if(f){state.appearance.wallpaper=await fileData(f);persist();applyAppearance()}};
  $('#accentColor').oninput=e=>{state.appearance.accent=e.target.value;applyAppearance()};$('#bgColor').oninput=e=>{state.appearance.bg=e.target.value;applyAppearance()};$('#bubbleColor').oninput=e=>{state.appearance.bubble=e.target.value;applyAppearance()};$('#fontScale').oninput=e=>{state.appearance.fontScale=+e.target.value;applyAppearance()};
  $('#resetAppearance').onclick=()=>{state.appearance=clone(DEFAULTS.appearance);persist();fillSettings();applyAppearance()};$('#requestNotify').onclick=requestNotification;$('#requestLocation').onclick=()=>navigator.geolocation.getCurrentPosition(()=>toast('位置权限已允许'),e=>toast(`位置权限失败：${e.message}`));$('#testNotify').onclick=testNotification;
  $('#installPwa').onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else toast('请使用浏览器的“添加到主屏幕/安装应用”')};
  $('#toolBtn').onclick=()=>$('#toolSheet').classList.remove('hidden');$$('#toolSheet [data-tool]').forEach(b=>b.onclick=async()=>{const t=b.dataset.tool;$('#toolSheet').classList.add('hidden');try{if(t==='weather')await weatherTool();if(t==='calendar')calendarTool();if(t==='alarm')alarmTool();if(t==='music')musicTool()}catch(e){toast(e.message)}});
  $('#exportData').onclick=exportData;$('#importData').onchange=async e=>{try{state=merge(DEFAULTS,JSON.parse(await e.target.files[0].text()));persist();init();toast('导入完成')}catch{toast('导入文件无效')}};$('#clearData').onclick=()=>{if(confirm('清空全部本地数据？')){localStorage.removeItem('qingchat_state');state=clone(DEFAULTS);init()}};
  $('#openProfile').onclick=()=>openSettings('persona');$$('.nav-item').forEach(b=>b.onclick=()=>{$$('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.nav;if(t==='chat')return;openSettings(t==='world'?'worldbook':t==='contacts'?'persona':t==='me'?'data':t)});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e});
}
async function registerSW(){if('serviceWorker'in navigator)try{await navigator.serviceWorker.register('./sw.js')}catch(e){console.warn('SW failed',e)}}
function init(){injectPushUI();applyAppearance();renderHeader();renderMessages();renderStickers();fillSettings()}

bind();init();registerSW();
