function ensureHomeState(){
  state.user.networkName ??= state.user.name || '阿青';
  state.user.signature ??= '愛と死は永遠に一致する。';
  state.user.avatar ??= '';
  state.memory ??= {longTerm:'',core:''};
  state.imageApi ??= {provider:'openai',url:'',key:'',model:''};
  state.ttsApi ??= {url:'',key:'',model:''};
  state.favorites ??= [];
  state.character.networkName ??= state.character.name || '';
  state.character.remark ??= '';
  state.character.signature ??= '';
  state.character.avatarImage ??= '';
  state.character.boundWorld ??= '';
  persist();
}

function renderHome(){
  ensureHomeState();
  const name=$('#homeUserName'), sig=$('#homeSignature'), av=$('#homeUserAvatar');
  if(name) name.textContent=state.user.networkName||state.user.name||'ユーザー';
  if(sig) sig.textContent=state.user.signature||'まだ署名はありません';
  if(av){av.innerHTML=state.user.avatar?`<img src="${state.user.avatar}" alt="avatar">`:esc((state.user.networkName||state.user.name||'U').slice(0,1));}
  const cName=$('#homeCharName'), cAv=$('#homeCharAvatar'), cText=$('#homeCharPreview'), cTime=$('#homeCharTime');
  if(cName)cName.textContent=state.character.remark||state.character.networkName||state.character.name||'キャラクター';
  if(cAv)cAv.innerHTML=state.character.avatarImage?`<img src="${state.character.avatarImage}" alt="avatar">`:esc((state.character.avatar||state.character.name?.[0]||'A').slice(0,2));
  const last=[...state.messages].reverse().find(m=>m.role==='assistant');
  if(cText)cText.textContent=last?.content||'新しいメッセージはありません';
  if(cTime)cTime.textContent=last?fmt(last.ts):'';
  $$('.face-dot').forEach((el,i)=>{if(i===0&&state.character.avatarImage){el.innerHTML=`<img src="${state.character.avatarImage}" alt="avatar">`}else el.textContent=i===0?(state.character.avatar||state.character.name?.[0]||'A'):[state.user.networkName?.[0]||'U','＋'][i-1]||'·'});
}

function openChatFromHome(){
  $('#homeScreen').classList.add('hidden');
  $('#chatScreen').classList.remove('hidden');
  $('#homeBottomNav').classList.add('hidden');
  renderMessages();
}
function closeChatToHome(){
  $('#chatScreen').classList.add('hidden');
  $('#homeScreen').classList.remove('hidden');
  $('#homeBottomNav').classList.remove('hidden');
  closeFeaturePage();renderHome();
}

function editHomeProfile(){
  ensureHomeState();
  $('#modalCard').innerHTML=`
    <h3>プロフィール</h3>
    <div class="profile-editor-avatar" id="profileAvatarPreview">${state.user.avatar?`<img src="${state.user.avatar}" alt="avatar">`:esc((state.user.networkName||state.user.name||'U').slice(0,1))}</div>
    <label class="profile-upload">写真を選択<input id="profileAvatarInput" type="file" accept="image/*"></label>
    <input id="profileNetworkName" placeholder="表示名" value="${esc(state.user.networkName||'')}">
    <textarea id="profileSignature" rows="3" placeholder="署名">${esc(state.user.signature||'')}</textarea>
    <div class="modal-actions"><button class="secondary-btn" data-home-cancel>キャンセル</button><button class="primary-btn" style="width:auto" data-home-save>保存</button></div>`;
  $('#modal').classList.remove('hidden');
  let pendingAvatar=state.user.avatar||'';
  $('#profileAvatarInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;pendingAvatar=await fileData(f);$('#profileAvatarPreview').innerHTML=`<img src="${pendingAvatar}" alt="avatar">`};
  $('[data-home-cancel]').onclick=()=>$('#modal').classList.add('hidden');
  $('[data-home-save]').onclick=()=>{state.user.networkName=$('#profileNetworkName').value.trim()||state.user.name||'ユーザー';state.user.signature=$('#profileSignature').value.trim();state.user.avatar=pendingAvatar;persist();$('#modal').classList.add('hidden');renderHome()};
}

function editMemory(){
  ensureHomeState();
  $('#modalCard').innerHTML=`<h3>メモリ</h3><div class="memory-grid"><textarea id="longMemory" placeholder="長期メモリ">${esc(state.memory.longTerm||'')}</textarea><textarea id="coreMemory" placeholder="コアメモリ">${esc(state.memory.core||'')}</textarea></div><div class="modal-actions"><button class="secondary-btn" data-memory-cancel>キャンセル</button><button class="primary-btn" style="width:auto" data-memory-save>保存</button></div>`;
  $('#modal').classList.remove('hidden');
  $('[data-memory-cancel]').onclick=()=>$('#modal').classList.add('hidden');
  $('[data-memory-save]').onclick=()=>{state.memory.longTerm=$('#longMemory').value;state.memory.core=$('#coreMemory').value;persist();$('#modal').classList.add('hidden');toast('保存しました')};
}

function ensureFeaturePage(){
  if($('#featurePage'))return $('#featurePage');
  const page=document.createElement('section');page.id='featurePage';page.className='feature-page hidden';$('#app').append(page);return page;
}
function closeFeaturePage(){const p=$('#featurePage');if(p)p.classList.add('hidden')}
function openFeaturePage(html){const p=ensureFeaturePage();p.innerHTML=html;p.classList.remove('hidden');$('#homeScreen').classList.add('hidden');$('#homeBottomNav').classList.add('hidden');return p}
function featureBack(){closeFeaturePage();$('#homeScreen').classList.remove('hidden');$('#homeBottomNav').classList.remove('hidden');renderHome()}

function favoriteType(m){if(m.type==='sticker')return'image';if(m.type==='voice')return'voice';return'text'}
function addFavoriteMessage(message){
  ensureHomeState();if(!message)return;
  const exists=state.favorites.some(f=>f.messageId===message.id);
  if(exists){toast('すでにお気に入りです');return}
  state.favorites.unshift({id:uid(),messageId:message.id,type:favoriteType(message),role:message.role,content:message.content,ts:message.ts,savedAt:Date.now()});persist();toast('お気に入りに追加しました');
}
function bindFavoriteGesture(){
  const list=$('#messageList');if(!list||list.dataset.favoriteBound)return;list.dataset.favoriteBound='1';let timer=null,start=null;
  list.addEventListener('pointerdown',e=>{const row=e.target.closest('.message-row');if(!row)return;start={row,x:e.clientX,y:e.clientY};timer=setTimeout(()=>{const rows=$$('.message-row',list).filter(r=>!r.querySelector('.typing'));const idx=rows.indexOf(row);if(idx>=0)addFavoriteMessage(state.messages[idx]);timer=null},650)});
  list.addEventListener('pointermove',e=>{if(start&&(Math.abs(e.clientX-start.x)>10||Math.abs(e.clientY-start.y)>10)){clearTimeout(timer);timer=null}});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>list.addEventListener(ev,()=>{clearTimeout(timer);timer=null;start=null}));
  list.addEventListener('contextmenu',e=>{const row=e.target.closest('.message-row');if(!row)return;e.preventDefault();const rows=$$('.message-row',list).filter(r=>!r.querySelector('.typing'));const idx=rows.indexOf(row);if(idx>=0)addFavoriteMessage(state.messages[idx])});
}

function openFavorites(){
  ensureHomeState();const counts={image:0,text:0,voice:0};state.favorites.forEach(f=>counts[f.type]=(counts[f.type]||0)+1);
  const body=state.favorites.length?state.favorites.map(f=>`<article class="favorite-item" data-fav-id="${f.id}">${f.type==='image'?`<img src="${f.content}" alt="favorite">`:`<p>${esc(f.content)}</p>`}<div><span>${f.role==='user'?'You':esc(state.character.name||'Char')}</span><time>${fmt(f.ts)}</time></div><button class="favorite-remove" aria-label="remove">×</button></article>`).join(''):`<div class="favorite-empty"><span class="bookmark-icon"></span><h3>まだお気に入りはありません</h3><p>チャットで文字・音声・画像を長押しすると、ここに保存されます。</p></div>`;
  const p=openFeaturePage(`<header class="feature-head"><button class="feature-back" data-back>‹</button><h1>Favorites</h1><span class="feature-count">${state.favorites.length}</span></header><section class="favorites-summary"><small>LINK Collection</small><h2>心に残った瞬間をここへ</h2><p>文字、音声、画像をまとめて保存して、いつでも見返せます。</p><div class="favorite-stats"><div><b>${counts.image}</b><span>Image</span></div><div><b>${counts.text}</b><span>Text</span></div><div><b>${counts.voice}</b><span>Voice</span></div></div></section><nav class="favorite-tabs"><button class="active" data-ft="all">すべて</button><button data-ft="image">画像</button><button data-ft="text">文字</button><button data-ft="voice">音声</button></nav><section class="favorite-list">${body}</section>`);
  $('[data-back]',p).onclick=featureBack;
  $$('.favorite-tabs button',p).forEach(b=>b.onclick=()=>{$$('.favorite-tabs button',p).forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.ft;$$('.favorite-item',p).forEach(it=>{const f=state.favorites.find(x=>x.id===it.dataset.favId);it.style.display=t==='all'||f?.type===t?'block':'none'})});
  $$('.favorite-remove',p).forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.closest('.favorite-item').dataset.favId;state.favorites=state.favorites.filter(f=>f.id!==id);persist();openFavorites()});
}

function openCharacterEditor(){
  ensureHomeState();const c=state.character;const p=openFeaturePage(`<header class="feature-head"><button class="feature-back" data-back>‹</button><h1>Add</h1><div class="feature-actions"><span>⌯</span><span>＋</span></div></header><section class="char-editor-card"><div class="char-avatar-block"><div class="char-avatar-preview" id="charAvatarPreview">${c.avatarImage?`<img src="${c.avatarImage}" alt="avatar">`:'<span></span>'}</div><label class="char-upload">画像を読み込む<input id="charAvatarFile" type="file" accept="image/*"></label></div><div class="char-fields"><label>アバター URL<input id="charAvatarUrl" placeholder="https://..." value="${esc(c.avatarImage?.startsWith('http')?c.avatarImage:'')}"></label><div class="char-grid"><label>名前<input id="charEditName" placeholder="本名" value="${esc(c.name||'')}"></label><label>ネット名<input id="charNetworkName" value="${esc(c.networkName||'')}"></label></div><label>備考<input id="charRemark" placeholder="備考名" value="${esc(c.remark||'')}"></label></div></section><label class="page-field">個性署名<input id="charSignature" placeholder="Link 上の個性署名" value="${esc(c.signature||'')}"></label><label class="page-field">キャラクター資料<textarea id="charPersonaPage" rows="9">${esc(c.persona||'')}</textarea></label><label class="page-field">ユーザーアカウント<select><option>${esc(state.user.networkName||state.user.name||'User')} · ID 1008600001</option></select></label><label class="page-field">ローカル世界書<select id="charWorldBind"><option value="">選択しない</option>${state.worldbook.map(w=>`<option value="${esc(w.title||'')}" ${c.boundWorld===(w.title||'')?'selected':''}>${esc(w.title||'世界書')}</option>`).join('')}</select></label><div class="feature-savebar"><button data-back2>キャンセル</button><button class="dark" data-save-char>保存</button></div>`);
  $('[data-back]',p).onclick=featureBack;$('[data-back2]',p).onclick=featureBack;
  let pending=c.avatarImage||'';$('#charAvatarFile',p).onchange=async e=>{const f=e.target.files?.[0];if(!f)return;pending=await fileData(f);$('#charAvatarPreview',p).innerHTML=`<img src="${pending}" alt="avatar">`};$('#charAvatarUrl',p).oninput=e=>{if(e.target.value.trim()){pending=e.target.value.trim();$('#charAvatarPreview',p).innerHTML=`<img src="${esc(pending)}" alt="avatar">`}};
  $('[data-save-char]',p).onclick=()=>{c.name=$('#charEditName',p).value.trim()||'キャラクター';c.networkName=$('#charNetworkName',p).value.trim()||c.name;c.remark=$('#charRemark',p).value.trim();c.signature=$('#charSignature',p).value.trim();c.persona=$('#charPersonaPage',p).value;c.avatarImage=pending;c.boundWorld=$('#charWorldBind',p).value;c.avatar=(c.name[0]||'A');persist();renderHeader();renderHome();featureBack();toast('保存しました')};
}

function apiProviderCard(){const enabled=!!(state.api.url&&state.api.model);return `<article class="provider-card" data-edit-provider><div class="provider-logo"><span></span></div><div class="provider-copy"><h3>OpenAI</h3><p>${state.api.model?`1 model selected`:'モデル未選択'}</p></div><b class="provider-status ${enabled?'on':''}">${enabled?'Enabled':'Disabled'}</b></article>`}
function openApiHub(tab='api'){
  ensureHomeState();const titles={api:'API',tts:'TTS',image:'Image'};const p=openFeaturePage(`<header class="feature-head"><button class="feature-back" data-back>‹</button><h1>${titles[tab]}</h1><div class="feature-actions"><span>⌘</span><span>☷</span>${tab==='api'?'<span data-new-provider>＋</span>':''}</div></header><main class="api-page" id="apiPageBody"></main><nav class="api-bottom"><button data-api-tab="api" class="${tab==='api'?'active':''}"><span class="api-i"></span><b>API</b></button><button data-api-tab="tts" class="${tab==='tts'?'active':''}"><span class="tts-i"></span><b>TTS</b></button><button data-api-tab="image" class="${tab==='image'?'active':''}"><span class="image-i"></span><b>Image</b></button></nav>`);
  $('[data-back]',p).onclick=featureBack;$$('[data-api-tab]',p).forEach(b=>b.onclick=()=>openApiHub(b.dataset.apiTab));if($('[data-new-provider]',p))$('[data-new-provider]',p).onclick=openProviderEditor;
  const body=$('#apiPageBody',p);
  if(tab==='api'){body.innerHTML=apiProviderCard();$('[data-edit-provider]',body).onclick=openProviderEditor}
  if(tab==='tts'){body.innerHTML=`<section class="api-empty-card"><h2>TTS</h2><p>音声 API の設定</p><button data-tts-config>設定する</button></section>`;$('[data-tts-config]',body).onclick=openTtsEditor}
  if(tab==='image'){body.innerHTML=`<section class="image-provider-shell"><div class="provider-tabs"><button class="active">OPENAI</button><button>NOVELAI</button><button>POLLINATIONS</button></div><article class="image-provider-card"><div class="image-hero">OpenAI <b>${state.imageApi.url?'Connected':'Not connected'}</b></div><small>OPENAI IMAGES</small><h2>OpenAI</h2><p>OpenAI 互換の画像生成 API に接続</p><button data-image-config>設定モジュール</button></article></section>`;$('[data-image-config]',body).onclick=openImageEditor}
}

function openProviderEditor(){
  ensureHomeState();$('#modalCard').innerHTML=`<div class="provider-modal"><small>PROVIDER MOODBOARD</small><h2>OpenAI</h2><p>起動時にローカル保存済みモデルを使用</p><div class="provider-switch">● <b>プロバイダーを有効化</b></div><label>プロバイダー名<input value="OpenAI" disabled></label><label>API Url<input id="providerUrl" value="${esc(state.api.url||'')}"></label><label>API パス<input id="providerPath" value="/chat/completions"></label><label>API Key<input id="providerKey" type="password" value="${esc(state.api.key||'')}"></label><label>モデル<input id="providerModel" value="${esc(state.api.model||'')}"></label><div class="provider-modal-actions"><button data-delete-provider>削除</button><button data-cancel-provider>キャンセル</button><button class="dark" data-save-provider>保存</button></div></div>`;$('#modal').classList.remove('hidden');$('[data-cancel-provider]').onclick=()=>$('#modal').classList.add('hidden');$('[data-delete-provider]').onclick=()=>{state.api={url:'',key:'',model:''};persist();$('#modal').classList.add('hidden');openApiHub('api')};$('[data-save-provider]').onclick=()=>{state.api.url=$('#providerUrl').value.trim().replace(/\/$/,'');state.api.key=$('#providerKey').value.trim();state.api.model=$('#providerModel').value.trim();persist();$('#modal').classList.add('hidden');openApiHub('api');toast('保存しました')};
}
function openTtsEditor(){ensureHomeState();$('#modalCard').innerHTML=`<h3>TTS API</h3><input id="ttsUrl" placeholder="API URL" value="${esc(state.ttsApi.url||'')}"><input id="ttsKey" type="password" placeholder="API Key" value="${esc(state.ttsApi.key||'')}"><input id="ttsModel" placeholder="Model" value="${esc(state.ttsApi.model||'')}"><div class="modal-actions"><button class="secondary-btn" data-tts-cancel>キャンセル</button><button class="primary-btn" style="width:auto" data-tts-save>保存</button></div>`;$('#modal').classList.remove('hidden');$('[data-tts-cancel]').onclick=()=>$('#modal').classList.add('hidden');$('[data-tts-save]').onclick=()=>{state.ttsApi={url:$('#ttsUrl').value.trim(),key:$('#ttsKey').value.trim(),model:$('#ttsModel').value.trim()};persist();$('#modal').classList.add('hidden');openApiHub('tts')}}
function openImageEditor(){ensureHomeState();$('#modalCard').innerHTML=`<h3>Image API</h3><input id="imgUrl" placeholder="API URL" value="${esc(state.imageApi.url||'')}"><input id="imgKey" type="password" placeholder="API Key" value="${esc(state.imageApi.key||'')}"><input id="imgModel" placeholder="Model" value="${esc(state.imageApi.model||'')}"><div class="modal-actions"><button class="secondary-btn" data-img-cancel>キャンセル</button><button class="primary-btn" style="width:auto" data-img-save>保存</button></div>`;$('#modal').classList.remove('hidden');$('[data-img-cancel]').onclick=()=>$('#modal').classList.add('hidden');$('[data-img-save]').onclick=()=>{state.imageApi={provider:'openai',url:$('#imgUrl').value.trim(),key:$('#imgKey').value.trim(),model:$('#imgModel').value.trim()};persist();$('#modal').classList.add('hidden');openApiHub('image')}}

function handleHomeFeature(feature){if(feature==='data')openSettings('capabilities');if(feature==='stickers')openSettings('stickers');if(feature==='appearance')openSettings('appearance');if(feature==='world')openSettings('worldbook');if(feature==='memory')editMemory()}

function bindHome(){
  ensureHomeState();renderHome();bindFavoriteGesture();
  $('#homeEdit').onclick=openFavorites;
  $('#homeAdd').onclick=openCharacterEditor;
  $('#homeMore').onclick=()=>openApiHub('api');
  $('#homeProfileCard').onclick=editHomeProfile;
  $('#homeAccountRow').onclick=()=>openApiHub('api');
  $('#homeChatPreview').onclick=openChatFromHome;
  $('#backHome').onclick=closeChatToHome;
  $$('.settings-home-row').forEach(b=>b.onclick=()=>handleHomeFeature(b.dataset.feature));
  $$('.chat-tab').forEach(b=>b.onclick=()=>{$$('.chat-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
  $$('.home-nav-item').forEach(b=>b.onclick=()=>{$$('.home-nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.homeNav!=='home')toast('この機能は次の段階で接続します')});
  $('#homeSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$$('.settings-home-row').forEach(r=>r.style.display=!q||r.textContent.toLowerCase().includes(q)?'grid':'none')});
  const oldSave=$('#saveSettings').onclick;$('#saveSettings').onclick=()=>{oldSave?.();renderHome()};
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(bindHome,0));
