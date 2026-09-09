function ensureHomeState(){
  state.user.networkName ??= state.user.name || '阿青';
  state.user.signature ??= '愛と死は永遠に一致する。';
  state.user.avatar ??= '';
  state.memory ??= {longTerm:'',core:''};
  state.imageApi ??= {url:'',key:'',model:''};
  persist();
}

function renderHome(){
  ensureHomeState();
  const name=$('#homeUserName'), sig=$('#homeSignature'), av=$('#homeUserAvatar');
  if(name) name.textContent=state.user.networkName||state.user.name||'ユーザー';
  if(sig) sig.textContent=state.user.signature||'まだ署名はありません';
  if(av){
    av.innerHTML=state.user.avatar?`<img src="${state.user.avatar}" alt="avatar">`:esc((state.user.networkName||state.user.name||'U').slice(0,1));
  }
  const cName=$('#homeCharName'), cAv=$('#homeCharAvatar'), cText=$('#homeCharPreview'), cTime=$('#homeCharTime');
  if(cName)cName.textContent=state.character.name||'キャラクター';
  if(cAv)cAv.textContent=(state.character.avatar||state.character.name?.[0]||'A').slice(0,2);
  const last=[...state.messages].reverse().find(m=>m.role==='assistant');
  if(cText)cText.textContent=last?.content||'新しいメッセージはありません';
  if(cTime)cTime.textContent=last?fmt(last.ts):'';
  $$('.face-dot').forEach((el,i)=>{el.textContent=i===0?(state.character.avatar||state.character.name?.[0]||'A'):[state.user.networkName?.[0]||'U','＋'][i-1]||'·'});
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
  renderHome();
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
  $('#modalCard').innerHTML=`
    <h3>メモリ</h3>
    <div class="memory-grid">
      <textarea id="longMemory" placeholder="長期メモリ">${esc(state.memory.longTerm||'')}</textarea>
      <textarea id="coreMemory" placeholder="コアメモリ">${esc(state.memory.core||'')}</textarea>
    </div>
    <div class="modal-actions"><button class="secondary-btn" data-memory-cancel>キャンセル</button><button class="primary-btn" style="width:auto" data-memory-save>保存</button></div>`;
  $('#modal').classList.remove('hidden');
  $('[data-memory-cancel]').onclick=()=>$('#modal').classList.add('hidden');
  $('[data-memory-save]').onclick=()=>{state.memory.longTerm=$('#longMemory').value;state.memory.core=$('#coreMemory').value;persist();$('#modal').classList.add('hidden');toast('保存しました')};
}

function injectImageApiSettings(){
  ensureHomeState();
  const panel=$('[data-panel="api"]');
  if(!panel||$('#imageApiUrl'))return;
  const card=document.createElement('div');card.className='card';card.innerHTML=`
    <h3>画像生成 API</h3>
    <label>API URL<input id="imageApiUrl" placeholder="https://..." value="${esc(state.imageApi.url||'')}"></label>
    <label>API Key<input id="imageApiKey" type="password" placeholder="sk-..." value="${esc(state.imageApi.key||'')}"></label>
    <label>モデル<input id="imageApiModel" placeholder="image-model" value="${esc(state.imageApi.model||'')}"></label>`;
  panel.append(card);
  ['Url','Key','Model'].forEach(k=>{const el=$(`#imageApi${k}`);el.oninput=()=>{state.imageApi[k.toLowerCase()]=el.value.trim();persist()}});
}

function handleHomeFeature(feature){
  if(feature==='data')openSettings('capabilities');
  if(feature==='stickers')openSettings('stickers');
  if(feature==='appearance')openSettings('appearance');
  if(feature==='world')openSettings('worldbook');
  if(feature==='memory')editMemory();
}

function bindHome(){
  ensureHomeState();injectImageApiSettings();renderHome();
  $('#homeEdit').onclick=editHomeProfile;
  $('#homeAdd').onclick=()=>openSettings('persona');
  $('#homeMore').onclick=()=>{injectImageApiSettings();openSettings('api')};
  $('#homeProfileCard').onclick=e=>{if(e.target.closest('#homeEdit'))return;editHomeProfile()};
  $('#homeAccountRow').onclick=()=>openSettings('api');
  $('#homeChatPreview').onclick=openChatFromHome;
  $('#backHome').onclick=closeChatToHome;
  $$('.settings-home-row').forEach(b=>b.onclick=()=>handleHomeFeature(b.dataset.feature));
  $$('.chat-tab').forEach(b=>b.onclick=()=>{$$('.chat-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
  $$('.home-nav-item').forEach(b=>b.onclick=()=>{$$('.home-nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.homeNav!=='home')toast('この機能は次の段階で接続します')});
  $('#homeSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$$('.settings-home-row').forEach(r=>r.style.display=!q||r.textContent.toLowerCase().includes(q)?'grid':'none')});
  const oldSave=$('#saveSettings').onclick;$('#saveSettings').onclick=()=>{oldSave?.();renderHome()};
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(bindHome,0));
