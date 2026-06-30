// ============================================================
// 🤖 ربات تلگرام هوش مصنوعی - Cloudflare Workers
// پشتیبانی از OpenAI و Anthropic + تحلیل عکس و فایل
// ============================================================
// تنظیم در داشبورد:
// ۱. Create Worker → Paste این کد → Save and Deploy
// ۲. Settings → Variables (روی Encrypt بزنید):
//    TELEGRAM_BOT_TOKEN  - توکن ربات (اجباری)
//    API_KEY             - کلید API (اجباری)
//    BASE_URL            - آدرس API (اجباری)
// ۳. KV → بسازید KV_STORE و Bind کنید
// ۴. برید به آدرس Worker و Webhook رو ست کنید
// ۵. برید تو تلگرام پیام بدید

// =================== TELEGRAM ===================
async function tgT(){var c=await getCfg();if(c.telegramToken)return c.telegramToken;return typeof TELEGRAM_BOT_TOKEN!=='undefined'?TELEGRAM_BOT_TOKEN:''}
async function tgA(){return'https://api.telegram.org/bot'+(await tgT())}
async function tgS(id,t,op){return(await fetch(await tgA()+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:id,text:t,parse_mode:'Markdown',disable_web_page_preview:true,...op})})).json()}
async function tgAc(id,a){await fetch(await tgA()+'/sendChatAction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:id,action:a||'typing'})})}
async function tgE(id,mid,t){try{await fetch(await tgA()+'/editMessageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:id,message_id:mid,text:t,parse_mode:'Markdown',disable_web_page_preview:true})})}catch{}}
function isC(t){return t&&t.startsWith('/')}

// =================== FILE DOWNLOAD ===================
async function tgFile(fid){var r=await(await fetch(await tgA()+'/getFile?file_id='+fid)).json();return r.ok?r.result:null}
async function tgDL(fp){var r=await fetch('https://api.telegram.org/file/bot'+await tgT()+'/'+fp);var b=await r.arrayBuffer();var e=(fp.split('.').pop()||'bin').toLowerCase();var mt={'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','gif':'image/gif','webp':'image/webp','pdf':'application/pdf','txt':'text/plain'}[e]||'application/octet-stream';var s='';new Uint8Array(b).forEach(function(c){s+=String.fromCharCode(c)});return{b64:btoa(s),mime:mt,ext:e,name:fp.split('/').pop()||'file'}}

// =================== STORE ===================
const MAX=50,TTL=86400;const mm={}
function kv(){return typeof KV_STORE!=='undefined'?KV_STORE:null}
async function kg(k,i){const x=kv();if(x){try{return await x.get(k,'json')}catch{}}const d=(i?mm.m||(mm.m={}):mm.h||(mm.h={}))[k];return d?JSON.parse(d):null}
async function kp(k,v,t,i){const x=kv(),o=t?{expirationTtl:t}:{},j=JSON.stringify(v);if(x)await x.put(k,j,o);else(i?mm.m||(mm.m={}):mm.h||(mm.h={}))[k]=j}
async function kd(k){const x=kv();if(x)await x.delete(k);else delete(mm.h||(mm.h={}))[k]}
async function gh(i){return(await kg('c:'+i+':h'))||[]}
async function sh(i,m){await kp('c:'+i+':h',m.slice(-MAX),TTL)}
async function ah(i,r,c){const h=await gh(i);h.push({role:r,content:c});await sh(i,h);return h}
async function ch(i){await kd('c:'+i+':h')}
async function gm(i){return(await kg('c:'+i+':m',1))||{}}
async function sm(i,m_){await kp('c:'+i+':m',m_,TTL*7,1)}

// =================== CONFIG FROM KV (تنظیمات ذخیره شده در مرورگر) ===================
let _cfgCache=null
async function getCfg(){if(_cfgCache)return _cfgCache;var c=await kg('_config');if(c)_cfgCache=c;return c||{}}
async function saveCfg(data){_cfgCache=data;await kp('_config',data)}
async function gmsgs(i){const me=await gm(i),h=await gh(i),sp=me.systemPrompt||'شما یک دستیار هوشمند و مفید هستید. به زبان فارسی پاسخ دهید.',t=await at(),ms=[]
  if(t==='openai'){ms.push({role:'system',content:sp});for(const m of h)ms.push({role:m.role==='assistant'?'assistant':'user',content:m.content});return{msgs:ms,model:me.model||'gemini-3-pro'}}
  else{for(const m of h)if(m.role!=='system')ms.push({role:m.role==='assistant'?'assistant':'user',content:m.content});return{system:sp,msgs:ms,model:me.model||'claude-opus-4-8'}}}

// =================== API ROUTER (اول KV config، بعد env vars) ===================
async function akey(){var c=await getCfg();if(c.apiKey)return c.apiKey;if(typeof API_KEY!=='undefined'&&API_KEY)return API_KEY;if(typeof ANTHROPIC_API_KEY!=='undefined'&&ANTHROPIC_API_KEY)return ANTHROPIC_API_KEY;return''}
async function base(){var c=await getCfg();if(c.baseUrl)return c.baseUrl.replace(/\/+$/,'');if(typeof BASE_URL!=='undefined'&&BASE_URL)return BASE_URL.replace(/\/+$/,'');if(typeof ANTHROPIC_BASE_URL!=='undefined'&&ANTHROPIC_BASE_URL)return ANTHROPIC_BASE_URL.replace(/\/+$/,'');return'https://api.anthropic.com'}
async function at(){var c=await getCfg()
  if(typeof API_TYPE!=='undefined'&&API_TYPE)return API_TYPE.toLowerCase()==='openai'?'openai':'anthropic'
  return await detectApiType()}
async function detectApiType(){var k=await akey(),b=await base();if(!k||!b)return'openai'
  // اول OpenAI رو امتحان کن
  try{var r1=await fetch(b+'/v1/models',{headers:{'Authorization':'Bearer '+k}})
    if(r1.ok){var d1=await r1.json();if(d1&&d1.data&&Array.isArray(d1.data))return'openai'}}catch{}
  // OpenAI جواب نداد → Anthropic رو امتحان کن
  try{var r2=await fetch(b+'/v1/models',{headers:{'x-api-key':k,'anthropic-version':'2023-06-01'}})
    if(r2.ok){var d2=await r2.json();if(d2&&d2.data&&Array.isArray(d2.data))return'anthropic'}}catch{}
  // هیچکدوم تشخیص داده نشد → پیش‌فرض OpenAI
  return'openai'}

// =================== API CALLS ===================
async function apim(){var t=await at(),b=await base(),k=await akey(),ms
  if(t==='openai'){var r=await fetch(b+'/v1/models',{headers:{'Authorization':'Bearer '+k}});if(r.ok){var d=await r.json();if(d.data)ms=d.data}}
  if(!ms){var r2=await fetch(b+'/v1/models',{headers:{'x-api-key':k,'anthropic-version':'2023-06-01'}});if(r2.ok){var d2=await r2.json();if(d2.data)ms=d2.data}}
  if(!ms&&t!=='openai'){var r3=await fetch(b+'/v1/models',{headers:{'Authorization':'Bearer '+k}});if(r3.ok){var d3=await r3.json();if(d3.data)ms=d3.data}}
  if(!ms&&t==='openai'){var r4=await fetch(b+'/v1/models',{headers:{'x-api-key':k,'anthropic-version':'2023-06-01'}});if(r4.ok){var d4=await r4.json();if(d4.data)ms=d4.data}}
  if(!ms)throw new Error('دریافت لیست مدل‌ها ممکن نشد')
  return ms.filter(function(m){return m.id})}
async function aistream(s,m,model,oc){var t=await at(),k=await akey(),b=await base(),err=null
  if(t==='openai'){try{return await oaiStr(b,k,m,model,oc)}catch(e){err=e}}else{try{return await antStr(b,k,s,m,model,oc)}catch(e){err=e}}
  if(err){if(t==='openai')return await antStr(b,k,s,m,model,oc);else return await oaiStr(b,k,m,model,oc)}}
async function oaiStr(b,k,m,model,oc){const r=await fetch(b+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model,messages:m,stream:true,max_tokens:4096})})
  if(!r.ok)throw new Error('OpenAI Error ('+r.status+'): '+(await r.text()).substring(0,300))
  const rd=r.body.getReader(),dc=new TextDecoder();let buf='',rem=''
  while(true){const{done,value}=await rd.read();if(done)break;buf+=dc.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||''
    for(const l of ls){const t=l.trim();if(!t.startsWith('data:'))continue;const j=t.slice(6).trim();if(j==='[DONE]')continue
      try{const e=JSON.parse(j),c=e.choices?.[0]?.delta?.content||'';if(c)oc(c)}catch{}}}}
async function antStr(b,k,s,m,model,oc){const r=await fetch(b+'/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:4096,system:s,messages:m,stream:true})})
  if(!r.ok)throw new Error('Anthropic Error ('+r.status+'): '+(await r.text()).substring(0,300))
  const rd=r.body.getReader(),dc=new TextDecoder();let buf='',rem=''
  while(true){const{done,value}=await rd.read();if(done)break;buf+=dc.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop()||''
    for(const l of ls){const t=l.trim();if(!t.startsWith('data:'))continue;const j=t.slice(6).trim();if(j==='[DONE]')continue
      try{const e=JSON.parse(j);if(e.type==='content_block_delta'&&e.delta?.text)oc(e.delta.text)}catch{}}}}

// =================== MEDIA HELPERS ===================
function hasMedia(m){return!!(m.photo||(m.document&&m.document.file_id))}
function bestPhoto(p){var b=p[0];for(var i=1;i<p.length;i++)if(p[i].file_size>(b.file_size||0))b=p[i];return b}

// =================== COMMANDS ===================
async function d(){return(await at())==='openai'?'OpenAI':'Anthropic'}
async function cSt(i){const n=await d();await tgS(i,'🤖 *به ربات هوش مصنوعی خوش آمدید!*\n\n🧩 *API:* '+n+'\n📡 *سرور:* `'+base()+'`\n\n🚀 *قابلیت‌ها:*\n• چت با مدل‌های مختلف\n• System Prompt دلخواه\n• تاریخچه هوشمند\n• تحلیل عکس و فایل 📸\n• قابل استفاده در گروه‌ها\n\n📋 *دستورات:*\n/start - شروع\n/help - راهنما\n/models - لیست مدل‌ها\n/model name - تغییر مدل\n/system text - تنظیم System Prompt\n/reset - پاک کردن تاریخچه\n/stats - وضعیت\n\n💡 عکس یا فایل بفرستید تحلیل کنم!')}
async function cH(i){await tgS(i,'📖 *راهنمای کامل*\n\n*دستورات:*\n/start - شروع مجدد\n/help - این راهنما\n/models - لیست مدل‌ها\n/model \\`name\\` - انتخاب مدل\n/system \\`text\\` - تنظیم System Prompt\n/reset - پاک کردن تاریخچه\n/stats - آمار\n\n*تحلیل عکس:* 🖼️ عکس بفرستید\n*تحلیل فایل:* 📄 PDF یا txt بفرستید\n*گروه:* منشن کنید یا "حاجی" بگید\n*نکته:* حداکثر ۵۰ پیام در تاریخچه')}
async function cM(i){await tgAc(i)
  try{const m=await apim();if(!m.length)return tgS(i,'❌ مدلی یافت نشد.');const me=await gm(i),cr=me.model||'پیش‌فرض'
    let t='🧠 *مدل‌های موجود ('+m.length+' عدد)*\n✅ *فعلی:* `'+cr+'`\n\nبرای تغییر: /model \\`name\\`\n\n'
    for(const x of m.slice(0,15))t+=(x.id===cr?'• ✅':'•')+' `'+x.id+'`\n'
    if(m.length>15)t+='\n... و '+(m.length-15)+' مدل دیگر';await tgS(i,t)}catch(e){await tgS(i,'❌ '+e.message.substring(0,300))}}
async function cSM(i,a){if(!a||!a.trim()){const me=await gm(i);return tgS(i,'🔧 مدل فعلی: `'+(me.model||'پیش‌فرض')+'`\nبرای تغییر: /model \\`name\\`')}
  await sm(i,{...(await gm(i)),model:a.trim()});await tgS(i,'✅ مدل به `'+a.trim()+'` تغییر یافت!')}
async function cSy(i,a){if(!a||!a.trim()){const me=await gm(i);return tgS(i,'📝 *System Prompt:*\n```'+(me.systemPrompt||'پیش‌فرض')+'```')}
  await sm(i,{...(await gm(i)),systemPrompt:a.trim()});await tgS(i,'✅ System Prompt تنظیم شد:\n> '+a.trim().substring(0,200))}
async function cR(i){await ch(i);await tgS(i,'🔄 تاریخچه پاک شد! مکالمه جدید شروع می‌شود.')}
async function cSt2(i){const me=await gm(i),h=await gh(i),u=h.filter(m=>m.role==='user').length,a=h.filter(m=>m.role==='assistant').length
  await tgS(i,'📊 *وضعیت*\n\n🧠 مدل: `'+(me.model||'پیش‌فرض')+'`\n💬 کاربر: '+u+'\n🤖 ربات: '+a+'\n📈 مجموع: '+h.length)}
async function hC(i,t){const p=t.split(' '),c=p[0].toLowerCase().split('@')[0],a=p.slice(1).join(' ')
  switch(c){case'/start':case'start':await cSt(i);return 1;case'/help':await cH(i);return 1;case'/models':await cM(i);return 1;case'/model':await cSM(i,a);return 1;case'/system':await cSy(i,a);return 1;case'/reset':await cR(i);return 1;case'/stats':await cSt2(i);return 1;default:return 0}}

// =================== MESSAGES (متن + عکس + فایل) ===================
async function sL(i,t){if(t.length<=4096)return tgS(i,t);let r=t
  while(r.length>0){let p=r.lastIndexOf('\n',4096);if(p<2048)p=r.lastIndexOf(' ',4096);if(p<2048)p=4096;await tgS(i,r.substring(0,p));r=r.substring(p).trim()}}

async function hM(u,b){const m=u.message;if(!m)return 0;const i=m.chat.id
  var isPhoto=!!(m.photo&&m.photo.length>0),isDoc=!!m.document
  var caption=(m.caption||'').replace(new RegExp('@'+b+'\\b','gi'),'').replace(/\s*حاجی\s*/g,' ').trim()
  if(!isPhoto&&!isDoc&&!m.text)return 0
  var txt=''
  if(!isPhoto&&!isDoc&&m.text){txt=m.text.replace(new RegExp('@'+b+'\\b','gi'),'').replace(/\s*حاجی\s*/g,' ').trim();if(!txt)return 0}
  if((isPhoto||isDoc)&&!caption)txt='این فایل رو تحلیل کن و توضیح بده'
  if(caption)txt=caption
  await tgAc(i)
  var md=null
  try{if(isPhoto){var bp=bestPhoto(m.photo);var fi=await tgFile(bp.file_id);if(fi)md=await tgDL(fi.file_path)}
    if(isDoc){var fi2=await tgFile(m.document.file_id);if(fi2){md=await tgDL(fi2.file_path);if(m.document.file_name)md.name=m.document.file_name}}
  }catch(e){console.error('DL error:',e.message)}
  var isOA=await at()==='openai',uc
  if(md&&md.mime.startsWith('image/')){
    uc=isOA?[{type:'text',text:txt},{type:'image_url',image_url:{url:'data:'+md.mime+';base64,'+md.b64,detail:'high'}}]:[{type:'text',text:txt},{type:'image',source:{type:'base64',media_type:md.mime,data:md.b64}}]
    await ah(i,'user',uc)
  }else if(isPhoto&&!md){await ah(i,'user',txt+' [عکس دریافت شد اما امکان دانلود وجود نداشت]')
  }else if(isDoc&&md&&md.ext==='txt'){var tc='';try{var u8=new Uint8Array(atob(md.b64).split('').map(function(c){return c.charCodeAt(0)}));for(var k=0;k<u8.length;k++)tc+=String.fromCharCode(u8[k]);tc=tc.substring(0,5000)}catch(e){tc='[خطا در خواندن فایل]'}
    uc=[{type:'text',text:txt+'\n--- '+md.name+' ---\n'+tc+'\n--- پایان ---'}];await ah(i,'user',uc)
  }else if(isDoc&&md){uc=[{type:'text',text:txt+'\n[فایل: '+md.name+' ('+md.mime+')]'}];await ah(i,'user',uc)
  }else{await ah(i,'user',txt)}
  var meta=await gm(i),history=await gh(i),sp=meta.systemPrompt||'شما یک دستیار هوشمند و مفید هستید. به زبان فارسی پاسخ دهید.',model=meta.model||(isOA?'gemini-3-pro':'claude-opus-4-8')
  var ams;if(isOA){ams=[{role:'system',content:sp}];for(var hi=0;hi<history.length;hi++)ams.push(history[hi])}else{ams=[];for(var hi2=0;hi2<history.length;hi2++)if(history[hi2].role!=='system')ams.push(history[hi2])}
  try{var se=await tgS(i,'⏳ *در حال فکر کردن...*');var mi=se&&se.result?se.result.message_id:null,fu='',la=Date.now()
    await aistream(sp,ams,model,function(ch){
      fu+=ch
      var no=Date.now()
      if(mi&&(no-la)>600){la=no;var d=fu.length>3900?fu.substring(0,3900)+'\n\n_ادامه..._':fu+'\n\n_✍️ در حال نوشتن..._';tgE(i,mi,d)}
    })
    if(!fu)throw new Error('پاسخی دریافت نشد');await ah(i,'assistant',fu)
    if(mi){try{if(fu.length>4096){await tgE(i,mi,'✅ انجام شد.');await sL(i,fu)}else await tgE(i,mi,fu)}catch{await sL(i,fu)}}else await sL(i,fu)
  }catch(e){var h=await gh(i);if(h.length&&h[h.length-1].role==='user'){h.pop();await sh(i,h)}await tgS(i,'❌ خطا:\n'+e.message.substring(0,500))}}

// =================== PROCESS UPDATE ===================
async function pU(u){var c=await getCfg(),bU=c.botUsername||(typeof BOT_USERNAME!=='undefined'?BOT_USERNAME:'');var m=u.message;if(!m)return
  var i=m.chat.id,uid=m.from.id,ty=m.chat.type,isMedia=hasMedia(m)
  var aU=typeof ALLOWED_USERS!=='undefined'?ALLOWED_USERS:''
  if(aU&&!aU.split(',').map(function(x){return x.trim()}).includes(String(uid)))return tgS(i,'⛔ شما دسترسی ندارید.')
  if(ty!=='private'){var t=m.text||m.caption||'';var mn=new RegExp('@'+bU+'\\b','i');var rp=m.reply_to_message&&m.reply_to_message.from&&m.reply_to_message.from.is_bot;var hj=t.includes('حاجی')
    if(!mn.test(t)&&!rp&&!isC(t)&&!isMedia&&!hj)return}
  if(m.text&&isC(m.text)){try{if(await hC(i,m.text))return}catch(ce){await tgS(i,'❌ خطا:\n'+ce.message.substring(0,300));return}}
  await hM(u,bU)}

// =================== SETUP PAGES ===================
function sH(w,s,c){if(!c)c={};return'<!DOCTYPE html>'+
'<html lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">'+
'<title>تنظیم ربات</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;margin:0}'+
'.c{background:rgba(255,255,255,.05);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:40px;max-width:640px;width:100%}'+
'h1{font-size:28px;margin-bottom:4px}.sub{color:#999;font-size:14px;margin-bottom:24px}'+
'.card{background:rgba(255,255,255,.05);border-radius:16px;padding:20px;margin-bottom:16px}'+
'.card h3{font-size:16px;margin-bottom:12px}'+
'label{display:block;font-size:14px;margin:10px 0 4px;color:#ccc}input,select{width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#e0e0e0;font-size:14px;box-sizing:border-box;direction:ltr;text-align:left}input:focus{outline:none;border-color:#667eea}'+
'.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;margin:2px}'+
'.ok{background:rgba(34,197,94,.15);color:#22c55e}.no{background:rgba(239,68,68,.15);color:#ef4444}'+
'.box{background:rgba(0,0,0,.3);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;word-break:break-all;margin:8px 0}'+
'.btn{display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;'+
'border:none;padding:12px 28px;border-radius:12px;font-size:15px;cursor:pointer;text-decoration:none}'+
'.btn:hover{opacity:.85}.btn:disabled{opacity:.4;cursor:not-allowed}'+
'.btn2{background:rgba(255,255,255,.1);color:#e0e0e0;margin-right:8px}'+
'#r{display:none;margin-top:12px;padding:16px;border-radius:12px;font-family:monospace;white-space:pre-wrap}'+
'.sc{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3)}'+
'.er{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3)}'+
'.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}'+
'code{background:rgba(255,255,255,.1);padding:2px 6px;border-radius:4px}</style></head>'+
'<body><div class="c"><h1><span>🤖</span> ربات هوش مصنوعی</h1>'+
'<p class="sub">مدیریت ربات تلگرام هوش مصنوعی</p>'+
'<div class="card"><h3>📡 وضعیت سرویس‌ها</h3>'+
'<span class="badge '+(s.t?'ok':'no')+'">'+(s.t?'✅ TELEGRAM_BOT_TOKEN':'❌ TELEGRAM_BOT_TOKEN')+'</span>'+
'<span class="badge '+(s.k?'ok':'no')+'">'+(s.k?'✅ KV_STORE':'❌ KV_STORE')+'</span>'+
(s.u?'<span class="badge ok">@'+s.u+'</span>':'')+
'</div>'+
'<div class="card"><h3>⚙️ تنظیمات API</h3>'+
'<label>🤖 Telegram Bot Token</label><input id="tgToken" value="'+(c.telegramToken||'')+'" placeholder="123456:ABC-DEF...">'+
'<label>🔑 API Key</label><input id="apiKey" value="'+(c.apiKey||'')+'" placeholder="sk-...">'+
'<label>🌐 Base URL</label><input id="baseUrl" value="'+(c.baseUrl||'')+'" placeholder="https://api.anthropic.com">'+
'<label>🤖 Bot Username</label><input id="botUsername" value="'+(c.botUsername||'')+'" placeholder="my_bot (بدون @)">'+
'<div class="row"><button class="btn" onclick="sv()">💾 ذخیره تنظیمات</button><button class="btn btn2" onclick="ts()">🧪 تست اتصال</button></div>'+
'<div id="r"></div></div>'+
'<div class="card"><h3>🔗 Webhook</h3><div class="box">'+w+'</div>'+
'<button class="btn" onclick="sw()">🔄 تنظیم Webhook</button></div>'+
'<script>'+
'async function sv(){var g=document.getElementById("tgToken"),b=document.getElementById("apiKey"),u=document.getElementById("baseUrl"),n=document.getElementById("botUsername"),r=document.getElementById("r");'+
'r.style.display="none";'+
'try{var res=await fetch("/save-config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telegramToken:g.value,apiKey:b.value,baseUrl:u.value,botUsername:n.value})});var j=await res.json();'+
'r.style.display="block";r.className=j.ok?"sc":"er";r.textContent=j.ok?"✅ تنظیمات ذخیره شد!":"❌ خطا: "+(j.error||"")}'+
'catch(e){r.style.display="block";r.className="er";r.textContent="❌ "+e.message}}'+
'async function ts(){var r=document.getElementById("r");r.style.display="block";r.className="";r.textContent="⏳ در حال تست...";'+
'try{var res=await fetch("/test-api");var j=await res.json();r.className=j.ok?"sc":"er";r.textContent=j.ok?"✅ اتصال برقرار است!":"❌ "+(j.error||"")}'+
'catch(e){r.className="er";r.textContent="❌ "+e.message}}'+
'async function sw(){var b=document.querySelector(".card:last-child .btn"),r=document.getElementById("r");'+
'b.disabled=1;b.textContent="⏳...";r.style.display="none";'+
'try{var d=await(await fetch("/sw")).json();r.style.display="block";'+
'if(d.ok){r.className="sc";r.textContent="✅ Webhook تنظیم شد! ربات آماده است."}'+
'else{r.className="er";r.textContent="❌ "+(d.description||JSON.stringify(d))}}'+
'catch(e){r.style.display="block";r.className="er";r.textContent="❌ "+e.message}'+
'b.disabled=0;b.textContent="🔄 تنظیم Webhook"}'+
'</script></body></html>'}

// =================== EXPORT DEFAULT ===================
export default{
  async fetch(req,env){
    globalThis.TELEGRAM_BOT_TOKEN=env.TELEGRAM_BOT_TOKEN||''
    globalThis.API_KEY=env.API_KEY||''
    globalThis.BASE_URL=env.BASE_URL||''
    globalThis.API_TYPE=env.API_TYPE||''
    globalThis.BOT_USERNAME=env.BOT_USERNAME||''
    globalThis.ALLOWED_USERS=env.ALLOWED_USERS||''
    globalThis.KV_STORE=env.KV_STORE
    globalThis.ANTHROPIC_API_KEY=env.API_KEY||env.ANTHROPIC_API_KEY||''
    globalThis.ANTHROPIC_BASE_URL=env.BASE_URL||env.ANTHROPIC_BASE_URL||''
    _cfgCache=null

    const url=new URL(req.url)

    // ===== POST: save config به KV =====
    if(req.method==='POST'&&url.pathname==='/save-config'){
      try{var body=await req.json();var data={}
        if(body.telegramToken!==undefined)data.telegramToken=body.telegramToken
        if(body.apiKey!==undefined)data.apiKey=body.apiKey
        if(body.baseUrl!==undefined)data.baseUrl=body.baseUrl
        if(body.botUsername!==undefined)data.botUsername=body.botUsername
        for(var k in data){if(!data[k])delete data[k]}
        await saveCfg(data)
        _cfgCache=null
        return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}})
      }catch(e){return new Response(JSON.stringify({ok:false,error:e.message}),{headers:{'Content-Type':'application/json'}})}
    }

    // ===== GET: test-api =====
    if(req.method==='GET'&&url.pathname==='/test-api'){
      try{var tk=await akey(),tb=await base(),tt=await at()
        if(!tk)return new Response(JSON.stringify({ok:false,error:'API Key تنظیم نشده'}),{headers:{'Content-Type':'application/json'}})
        var models=await apim()
        return new Response(JSON.stringify({ok:true,type:tt,baseUrl:tb,models:models.length}),{headers:{'Content-Type':'application/json'}})
      }catch(e){return new Response(JSON.stringify({ok:false,error:e.message.substring(0,200)}),{headers:{'Content-Type':'application/json'}})}
    }

    // ===== GET: صفحات مرورگر =====
    if(req.method==='GET'){
      if(url.pathname==='/setup'||url.pathname==='/'){
        var w=url.origin+'/'
        var cfg=await getCfg()
        var hasToken=!!(cfg.telegramToken||env.TELEGRAM_BOT_TOKEN)
        return new Response(sH(w,{t:hasToken,k:!!env.KV_STORE,u:cfg.botUsername||env.BOT_USERNAME||''},cfg),{headers:{'Content-Type':'text/html;charset=utf-8'}})
      }
      if(url.pathname==='/status'){
        var cfg2=await getCfg()
        var hasTk=!!(cfg2.telegramToken||env.TELEGRAM_BOT_TOKEN)
        return new Response(JSON.stringify({telegramToken:hasTk,kv:!!env.KV_STORE,apiType:await at(),baseUrl:cfg2.baseUrl||env.BASE_URL||(await base()),configFromKV:!!cfg2.apiKey},null,2),{headers:{'Content-Type':'application/json'}})
      }
      if(url.pathname==='/sw'){
        var tok=await tgT()
        if(!tok) return new Response(JSON.stringify({ok:0,description:'TELEGRAM_BOT_TOKEN تنظیم نشده'}),{headers:{'Content-Type':'application/json'}})
        var w2=url.origin+'/'
        await fetch('https://api.telegram.org/bot'+tok+'/deleteWebhook')
        var r=await fetch('https://api.telegram.org/bot'+tok+'/setWebhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:w2,allowed_updates:['message','callback_query'],drop_pending_updates:true})})
        return new Response(JSON.stringify(await r.json()),{headers:{'Content-Type':'application/json'}})
      }
      return new Response('Not Found',{status:404})
    }

    // ===== POST: Webhook از تلگرام =====
    try{var u=await req.json();await pU(u);return new Response('OK',{status:200})}
    catch(e){return new Response('OK',{status:200})}
  },
  async scheduled(env){globalThis.KV_STORE=env.KV_STORE}
}