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
// فقط یک ربات فعال: توکن از تنظیمات پنل (KV) خوانده می‌شود؛ اگر نبود از متغیر محیطی.
async function tgT(){var c=await getCfg();if(c.telegramToken)return c.telegramToken;return typeof TELEGRAM_BOT_TOKEN!=='undefined'?TELEGRAM_BOT_TOKEN:''}
async function tgA(){return'https://api.telegram.org/bot'+(await tgT())}
async function tgS(id,t,op){var bd={chat_id:id,text:t,parse_mode:'Markdown',disable_web_page_preview:true,...op}
  var j=await(await fetch(await tgA()+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bd)})).json()
  if(j&&j.ok)return j
  // اگر Markdown نامعتبر بود، بدون فرمت دوباره بفرست تا پیام حتماً برسد
  delete bd.parse_mode
  return(await fetch(await tgA()+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bd)})).json()}
async function tgAc(id,a){await fetch(await tgA()+'/sendChatAction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:id,action:a||'typing'})})}
async function tgE(id,mid,t,op){var bd={chat_id:id,message_id:mid,text:t,parse_mode:'Markdown',disable_web_page_preview:true,...(op||{})}
  try{var j=await(await fetch(await tgA()+'/editMessageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bd)})).json()
    if(j&&j.ok)return true
    // Markdown نامعتبر → بدون فرمت دوباره امتحان کن
    delete bd.parse_mode
    j=await(await fetch(await tgA()+'/editMessageText',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bd)})).json()
    return!!(j&&j.ok)}catch{return false}}
// پاسخ به کلیک دکمهٔ شیشه‌ای (toast کوتاه بالای چت)
async function tgCb(id,txt){try{await fetch(await tgA()+'/answerCallbackQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callback_query_id:id,...(txt?{text:txt}:{})})})}catch{}}
function isC(t){return t&&t.startsWith('/')}

// =================== FILE DOWNLOAD ===================
async function tgFile(fid){var r=await(await fetch(await tgA()+'/getFile?file_id='+fid)).json();return r.ok?r.result:null}
async function tgDL(fp){var r=await fetch('https://api.telegram.org/file/bot'+await tgT()+'/'+fp);var b=await r.arrayBuffer();var e=(fp.split('.').pop()||'bin').toLowerCase();var mt={'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','gif':'image/gif','webp':'image/webp','pdf':'application/pdf','txt':'text/plain'}[e]||'application/octet-stream';var s='';new Uint8Array(b).forEach(function(c){s+=String.fromCharCode(c)});return{b64:btoa(s),mime:mt,ext:e,name:fp.split('/').pop()||'file',size:b.byteLength}}
// ---- کمک‌کننده‌های فایل: رمزگشایی درست UTF-8 + تشخیص فایل متنی/کد ----
const MAXFILECHARS=50000
const TEXTEXT=['txt','md','markdown','csv','tsv','json','jsonl','ndjson','xml','yaml','yml','html','htm','css','scss','less','js','mjs','cjs','ts','tsx','jsx','py','java','c','cc','cpp','h','hpp','cs','go','rs','rb','php','sql','sh','bash','zsh','bat','ps1','ini','conf','cfg','toml','log','env','tex','r','kt','kts','swift','dart','vue','svelte','pl','lua','scala','gradle','properties','srt','vtt','gitignore','dockerfile','makefile','asm','m','vb','fs','clj','ex','exs','erl','hs','jl','nim','zig','proto','graphql','gql','rst','org','tsv']
function b64ToBytes(b64){var bin=atob(b64);var u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
function b64ToText(b64){try{return new TextDecoder('utf-8',{fatal:false}).decode(b64ToBytes(b64))}catch(e){return''}}
function isTextFile(md){if(!md)return false;if(md.mime&&(md.mime.indexOf('text/')===0||md.mime==='application/json'||md.mime==='application/xml'||md.mime==='application/javascript'))return true;var n=(md.name||'').toLowerCase();if(TEXTEXT.indexOf(md.ext)>=0)return true;if(n==='dockerfile'||n==='makefile'||n==='.gitignore'||n==='.env')return true;return false}

// =================== STORE ===================
const MAX=1000,TTL=86400,KVMAX=20*1024*1024;const mm={}
function kv(){return typeof KV_STORE!=='undefined'?KV_STORE:null}
async function kg(k,i){const x=kv();if(x){try{return await x.get(k,'json')}catch{}}const d=(i?mm.m||(mm.m={}):mm.h||(mm.h={}))[k];return d?JSON.parse(d):null}
async function kp(k,v,t,i){const x=kv(),o=t?{expirationTtl:t}:{},j=JSON.stringify(v);if(x)await x.put(k,j,o);else(i?mm.m||(mm.m={}):mm.h||(mm.h={}))[k]=j}
async function kd(k){const x=kv();if(x)await x.delete(k);else delete(mm.h||(mm.h={}))[k]}
async function gh(i){return(await kg('c:'+i+':h'))||[]}
async function sh(i,m){var arr=m.slice(-MAX)
  // مدیا (عکس/فایل) به صورت base64 داخل تاریخچه ذخیره می‌شود و می‌تواند بزرگ باشد.
  // Cloudflare KV سقف ~۲۵MB برای هر مقدار دارد؛ قدیمی‌ترین پیام‌ها را حذف کن تا زیر بودجه بماند.
  while(arr.length>1&&JSON.stringify(arr).length>KVMAX)arr=arr.slice(1)
  try{await kp('c:'+i+':h',arr,TTL)}
  catch(e){// اگر باز هم بزرگ بود، به شدت کوچک کن؛ یک نوشتن ناموفق نباید ربات را بی‌صدا از کار بیندازد
    try{await kp('c:'+i+':h',arr.slice(-8),TTL)}catch(_){}}}
async function ah(i,r,c){const h=await gh(i);h.push({role:r,content:c});await sh(i,h);return h}
async function ch(i){await kd('c:'+i+':h')}
async function gm(i){return(await kg('c:'+i+':m',1))||{}}
async function sm(i,m_){await kp('c:'+i+':m',m_,TTL*7,1)}
// ===== حالت پاسخ‌دهی: instant (سریع) یا think (تفکر عمیق) =====
async function getMode(i){var me=await gm(i);if(me.mode)return me.mode;var c=await getCfg();return c.defaultMode||'instant'}
function modeCfg(mode){if(mode==='think')return{
    sp:'\n\nمهم: قبل از پاسخ نهایی، مسئله را گام‌به‌گام و عمیق تحلیل کن. ابتدا بخش «🤔 تحلیل:» را با استدلال مرحله‌به‌مرحله بنویس، سپس بخش «✅ پاسخ:» را با نتیجهٔ نهایی و دقیق ارائه بده.',
    mx:8192,ph:'🧠 *در حال تفکر عمیق...*'}
  return{sp:'\n\nمهم: مستقیم، کوتاه و سریع پاسخ بده؛ از توضیح اضافی و مقدمه‌چینی پرهیز کن.',mx:2048,ph:'⚡ *در حال پاسخ...*'}}

// =================== CONFIG FROM KV (تنظیمات ذخیره شده در مرورگر) ===================
let _cfgCache=null
async function getCfg(){if(_cfgCache)return _cfgCache;var c=await kg('_config');if(c)_cfgCache=c;return c||{}}
async function saveCfg(data){_cfgCache=data;_atCache=null;await kp('_config',data)}
async function gmsgs(i){const me=await gm(i),h=await gh(i),sp=me.systemPrompt||'شما یک دستیار هوشمند و مفید هستید. به زبان فارسی پاسخ دهید.',t=await at(),ms=[]
  if(t==='openai'){ms.push({role:'system',content:sp});for(const m of h)ms.push({role:m.role==='assistant'?'assistant':'user',content:m.content});return{msgs:ms,model:me.model||'gemini-3-pro'}}
  else{for(const m of h)if(m.role!=='system')ms.push({role:m.role==='assistant'?'assistant':'user',content:m.content});return{system:sp,msgs:ms,model:me.model||'claude-sonnet-4-6-20250528'}}}

// =================== API ROUTER (اول KV config، بعد env vars) ===================
async function akey(){var c=await getCfg();if(c.apiKey)return c.apiKey;if(typeof API_KEY!=='undefined'&&API_KEY)return API_KEY;if(typeof ANTHROPIC_API_KEY!=='undefined'&&ANTHROPIC_API_KEY)return ANTHROPIC_API_KEY;return''}
// آدرس را نرمال می‌کند: حذف اسلش‌های انتهایی و /v1 اضافه (کاربر گاهی آدرس را با /v1 پیست می‌کند)
function normBase(u){if(!u)return'';return u.trim().replace(/\/+$/,'').replace(/\/v1$/i,'')}
async function base(){var c=await getCfg();if(c.baseUrl)return normBase(c.baseUrl);if(typeof BASE_URL!=='undefined'&&BASE_URL)return normBase(BASE_URL);if(typeof ANTHROPIC_BASE_URL!=='undefined'&&ANTHROPIC_BASE_URL)return normBase(ANTHROPIC_BASE_URL);return'https://api.anthropic.com'}
let _atCache=null
// تشخیص نوع API فقط از روی config/env/آدرس — قطعی و بدون probe شبکه‌ای که ممکن بود اشتباه تشخیص دهد
async function at(){if(_atCache)return _atCache
  var c=await getCfg()
  if(c.apiType){_atCache=c.apiType.toLowerCase()==='openai'?'openai':'anthropic';return _atCache}
  if(typeof API_TYPE!=='undefined'&&API_TYPE){_atCache=API_TYPE.toLowerCase()==='openai'?'openai':'anthropic';return _atCache}
  var b=(await base()).toLowerCase()
  if(b.includes('anthropic')||b.includes('claude')){_atCache='anthropic';return _atCache}
  // پلتفرم‌های غیررسمی تقریباً همیشه OpenAI-compatible هستند؛ اگر نبود، fallback خودش به anthropic برمی‌گردد
  _atCache='openai';return _atCache}

// =================== API CALLS ===================
async function apim(){var t=await at(),b=await base(),k=await akey(),ms
  if(t==='openai'){var r=await fetch(b+'/v1/models',{headers:{'Authorization':'Bearer '+k}});if(r.ok){var d=await r.json();if(d.data)ms=d.data}}
  if(!ms){var r2=await fetch(b+'/v1/models',{headers:{'x-api-key':k,'anthropic-version':'2023-06-01'}});if(r2.ok){var d2=await r2.json();if(d2.data)ms=d2.data}}
  if(!ms&&t!=='openai'){var r3=await fetch(b+'/v1/models',{headers:{'Authorization':'Bearer '+k}});if(r3.ok){var d3=await r3.json();if(d3.data)ms=d3.data}}
  if(!ms&&t==='openai'){var r4=await fetch(b+'/v1/models',{headers:{'x-api-key':k,'anthropic-version':'2023-06-01'}});if(r4.ok){var d4=await r4.json();if(d4.data)ms=d4.data}}
  if(!ms)throw new Error('دریافت لیست مدل‌ها ممکن نشد')
  return ms.filter(function(m){return m.id})}
// تبدیل محتوای پیام بین دو فرمت (بلوک عکس و فایل PDF: OpenAI ↔ Anthropic)
function convContent(c,to){if(typeof c==='string'||!Array.isArray(c))return c
  return c.map(function(p){if(!p||typeof p!=='object')return p
    if(to==='anthropic'){
      if(p.type==='image_url'&&p.image_url&&p.image_url.url){var mm=/^data:([^;]+);base64,(.*)$/.exec(p.image_url.url);if(mm)return{type:'image',source:{type:'base64',media_type:mm[1],data:mm[2]}}}
      if(p.type==='file'&&p.file&&p.file.file_data){var fm=/^data:([^;]+);base64,(.*)$/.exec(p.file.file_data);if(fm)return{type:'document',source:{type:'base64',media_type:fm[1],data:fm[2]}}}
      if(p.type==='document')return{type:'document',source:p.source}
      return p}
    // to==='openai'
    if(p.type==='image'&&p.source&&p.source.type==='base64')return{type:'image_url',image_url:{url:'data:'+p.source.media_type+';base64,'+p.source.data,detail:'high'}}
    if(p.type==='document'&&p.source&&p.source.type==='base64')return{type:'file',file:{filename:p._name||'file.pdf',file_data:'data:'+p.source.media_type+';base64,'+p.source.data}}
    return p})}
// آرایهٔ پیام را به شکل درستِ هر فرمت می‌سازد؛ Anthropic نباید role:system داشته باشد، OpenAI باید system جدا در ابتدا داشته باشد
function toAnthMsgs(m){return m.filter(function(x){return x.role!=='system'}).map(function(x){return{role:x.role,content:convContent(x.content,'anthropic')}})}
function toOpenAIMsgs(sp,m){var out=[{role:'system',content:sp}];for(var i=0;i<m.length;i++){if(m[i].role==='system')continue;out.push({role:m[i].role,content:convContent(m[i].content,'openai')})}return out}
// اگر پلتفرم استریم نداد و یک JSON کامل برگرداند، محتوا را از آن بیرون بکش
function parseNonStream(raw,type){try{var o=JSON.parse(raw)
  if(type==='openai'){var c=o.choices&&o.choices[0]&&(o.choices[0].message||o.choices[0].delta||{}).content;if(typeof c==='string')return c;if(Array.isArray(c))return c.map(function(x){return x.text||x.content||''}).join('')}
  else{if(Array.isArray(o.content))return o.content.map(function(x){return x.text||''}).join('');if(typeof o.content==='string')return o.content}
}catch(e){}return''}
// oc اکنون متنِ «تجمعی» می‌گیرد (نه دلتا) تا اگر fallback دوباره استریم کند، متن دوتایی نشود
async function aistream(s,m,model,oc,mx){var t=await at(),k=await akey(),b=await base(),r=''
  if(t==='openai'){try{r=await oaiStr(b,k,toOpenAIMsgs(s,m),model,oc,mx)}catch(e){r=await antStr(b,k,s,toAnthMsgs(m),model,oc,mx)}}
  else{try{r=await antStr(b,k,s,toAnthMsgs(m),model,oc,mx)}catch(e){r=await oaiStr(b,k,toOpenAIMsgs(s,m),model,oc,mx)}}
  // پاسخ خالی بدون خطا (فرمت اشتباه ولی status=200) → یکبار فرمت دیگر را امتحان کن
  if(!r||!r.trim()){if(t==='openai'){try{r=await antStr(b,k,s,toAnthMsgs(m),model,oc,mx)}catch(e){}}else{try{r=await oaiStr(b,k,toOpenAIMsgs(s,m),model,oc,mx)}catch(e){}}}
  return r}
async function oaiStr(b,k,m,model,oc,mx){const r=await fetch(b+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},body:JSON.stringify({model,messages:m,stream:true,max_tokens:mx||4096})})
  if(!r.ok)throw new Error('OpenAI Error ('+r.status+'): '+(await r.text()).substring(0,300))
  const rd=r.body.getReader(),dc=new TextDecoder();let buf='',full='',raw='',any=false
  while(true){const{done,value}=await rd.read();if(done)break;const chunk=dc.decode(value,{stream:true});raw+=chunk;buf+=chunk;const ls=buf.split('\n');buf=ls.pop()||''
    for(const l of ls){const t=l.trim();if(!t.startsWith('data:'))continue;const j=t.slice(6).trim();if(j==='[DONE]')continue
      try{const e=JSON.parse(j),c=e.choices?.[0]?.delta?.content||'';if(c){full+=c;any=true;oc(full)}}catch{}}}
  if(!any){const p=parseNonStream(raw,'openai');if(p){full=p;oc(full)}}
  return full}
async function antStr(b,k,s,m,model,oc,mx){const r=await fetch(b+'/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:mx||4096,system:s,messages:m,stream:true})})
  if(!r.ok)throw new Error('Anthropic Error ('+r.status+'): '+(await r.text()).substring(0,300))
  const rd=r.body.getReader(),dc=new TextDecoder();let buf='',full='',raw='',any=false
  while(true){const{done,value}=await rd.read();if(done)break;const chunk=dc.decode(value,{stream:true});raw+=chunk;buf+=chunk;const ls=buf.split('\n');buf=ls.pop()||''
    for(const l of ls){const t=l.trim();if(!t.startsWith('data:'))continue;const j=t.slice(6).trim();if(j==='[DONE]')continue
      try{const e=JSON.parse(j);if(e.type==='content_block_delta'&&e.delta?.text){full+=e.delta.text;any=true;oc(full)}}catch{}}}
  if(!any){const p=parseNonStream(raw,'anthropic');if(p){full=p;oc(full)}}
  return full}

// =================== MEDIA HELPERS ===================
const VIDEXT=['mp4','mov','avi','mkv','webm','flv','wmv','m4v','3gp','mpeg','mpg','ogv']
function docExt(m){return((m.document&&m.document.file_name||'').split('.').pop()||'').toLowerCase()}
function isVidDoc(m){return!!(m.document&&(((m.document.mime_type||'').indexOf('video/')===0)||VIDEXT.indexOf(docExt(m))>=0))}
function isGifDoc(m){return!!(m.document&&(((m.document.mime_type||'').toLowerCase()==='image/gif')||docExt(m)==='gif'))}
function isVideoMsg(m){return!!(m.video||m.video_note||m.animation)||isVidDoc(m)}
// ویدئو و GIF پشتیبانی نمی‌شوند؛ به عنوان مدیای قابل‌پردازش حساب نمی‌شوند تا در گروه‌ها اسپم نکنند
function isUnsupportedMedia(m){return isVideoMsg(m)||isGifDoc(m)}
function hasMedia(m){if(isUnsupportedMedia(m))return false;return!!(m.photo||(m.document&&m.document.file_id))}
function bestPhoto(p){var b=p[0];for(var i=1;i<p.length;i++)if(p[i].file_size>(b.file_size||0))b=p[i];return b}

// =================== INLINE KEYBOARDS ===================
function kbMain(){return{inline_keyboard:[
  [{text:'⚡ حالت سریع',callback_data:'m:instant'},{text:'🧠 تفکر عمیق',callback_data:'m:think'}],
  [{text:'🧩 مدل‌ها',callback_data:'menu:models'},{text:'📊 وضعیت',callback_data:'menu:stats'}],
  [{text:'🔄 مکالمه جدید',callback_data:'reset:1'},{text:'📖 راهنما',callback_data:'menu:help'}]]}}
function kbRegen(){return{inline_keyboard:[[{text:'🔄 پاسخ مجدد',callback_data:'regen:1'}]]}}
function kbBack(){return{inline_keyboard:[[{text:'🔙 بازگشت',callback_data:'menu:main'}]]}}
async function kbMode(i){var cur=await getMode(i);return{inline_keyboard:[
  [{text:(cur==='instant'?'✅ ':'')+'⚡ سریع',callback_data:'m:instant'},{text:(cur==='think'?'✅ ':'')+'🧠 تفکر عمیق',callback_data:'m:think'}]]}}
// لیست مدل‌ها به‌صورت دکمه؛ callback_data سقف ۶۴ بایت دارد، مدل‌های خیلی بلند رد می‌شوند
async function mdlKb(i){var m=await apim(),me=await gm(i),cr=me.model||'',rows=[]
  for(var xi=0;xi<m.length&&rows.length<15;xi++){var id=m[xi].id,cb='mdl:'+id;if(cb.length>60)continue
    rows.push([{text:(id===cr?'✅ ':'')+id,callback_data:cb}])}
  rows.push([{text:'🔙 بازگشت',callback_data:'menu:main'}])
  return{inline_keyboard:rows}}

// =================== COMMANDS ===================
async function d(){return(await at())==='openai'?'OpenAI':'Anthropic'}
async function stTxt(){const n=await d();return'🤖 *به ربات هوش مصنوعی خوش آمدید!*\n\n🧩 *API:* '+n+'\n📡 *سرور:* `'+(await base())+'`\n\n🚀 *قابلیت‌ها:*\n• چت با مدل‌های مختلف\n• System Prompt دلخواه\n• تاریخچه هوشمند (۱۰۰۰ پیام)\n• تحلیل عکس و فایل (PDF، متن، کد) 📸📄\n• قابل استفاده در گروه‌ها\n\n📋 *دستورات:*\n/start - شروع\n/help - راهنما\n/models - لیست مدل‌ها\n/model name - تغییر مدل\n/system text - تنظیم System Prompt\n/mode - حالت پاسخ (⚡ سریع / 🧠 عمیق)\n/reset - پاک کردن تاریخچه\n/stats - وضعیت\n\n💡 عکس یا فایل بفرستید تحلیل کنم!'}
function hlpTxt(){return'📖 *راهنمای کامل*\n\n*دستورات:*\n/start - شروع مجدد\n/help - این راهنما\n/models - لیست مدل‌ها\n/model \\`name\\` - انتخاب مدل\n/system \\`text\\` - تنظیم System Prompt\n/mode \\`instant|think\\` - حالت پاسخ (⚡ سریع / 🧠 تفکر عمیق)\n/reset - پاک کردن تاریخچه\n/stats - آمار\n\n*تحلیل عکس:* 🖼️ عکس بفرستید\n*تحلیل فایل:* 📄 PDF، متن یا کد بفرستید (txt, md, csv, json, py, js و ...)\n*گروه:* منشن کنید یا "حاجی" بگید\n*نکته:* حداکثر ۱۰۰۰ پیام در تاریخچه'}
async function statsTxt(i){const me=await gm(i),h=await gh(i),u=h.filter(m=>m.role==='user').length,a=h.filter(m=>m.role==='assistant').length,mode=await getMode(i)
  return'📊 *وضعیت*\n\n🧠 مدل: `'+(me.model||'پیش‌فرض')+'`\n🎚️ حالت: '+(mode==='think'?'🧠 Deep Think':'⚡ Instant')+'\n💬 کاربر: '+u+'\n🤖 ربات: '+a+'\n📈 مجموع: '+h.length+'/'+MAX}
async function cSt(i){await tgS(i,await stTxt(),{reply_markup:kbMain()})}
async function cH(i){await tgS(i,hlpTxt())}
async function cM(i){await tgAc(i)
  try{var kb=await mdlKb(i),me=await gm(i)
    await tgS(i,'🧩 *انتخاب مدل*\n✅ فعلی: `'+(me.model||'پیش‌فرض')+'`\n\nبرای تغییر، روی مدل بزنید:',{reply_markup:kb})}catch(e){await tgS(i,'❌ '+e.message.substring(0,300))}}
async function cSM(i,a){if(!a||!a.trim()){const me=await gm(i);return tgS(i,'🔧 مدل فعلی: `'+(me.model||'پیش‌فرض')+'`\nبرای تغییر: /model \\`name\\`')}
  await sm(i,{...(await gm(i)),model:a.trim()});await tgS(i,'✅ مدل به `'+a.trim()+'` تغییر یافت!')}
async function cSy(i,a){if(!a||!a.trim()){const me=await gm(i);return tgS(i,'📝 *System Prompt:*\n```'+(me.systemPrompt||'پیش‌فرض')+'```')}
  await sm(i,{...(await gm(i)),systemPrompt:a.trim()});await tgS(i,'✅ System Prompt تنظیم شد:\n> '+a.trim().substring(0,200))}
async function cR(i){await ch(i);await tgS(i,'🔄 تاریخچه پاک شد! مکالمه جدید شروع می‌شود.')}
async function cMode(i,a){var cur=await getMode(i);var v=(a||'').trim().toLowerCase()
  if(v==='instant'||v==='fast'||v==='سریع'||v==='⚡'){await sm(i,{...(await gm(i)),mode:'instant'});return tgS(i,'⚡ حالت *Instant* فعال شد. پاسخ‌ها سریع و کوتاه خواهند بود.')}
  if(v==='think'||v==='deep'||v==='deepthink'||v==='عمیق'||v==='🧠'){await sm(i,{...(await gm(i)),mode:'think'});return tgS(i,'🧠 حالت *Deep Think* فعال شد. ربات قبل از پاسخ، عمیق فکر می‌کند.')}
  await tgS(i,'🎚️ *حالت پاسخ‌دهی*\n\nفعلی: '+(cur==='think'?'🧠 Deep Think':'⚡ Instant')+'\n\nبرای تغییر روی دکمه بزنید:',{reply_markup:await kbMode(i)})}
async function cSt2(i){await tgS(i,await statsTxt(i))}
async function hC(i,t){const p=t.split(' '),c=p[0].toLowerCase().split('@')[0],a=p.slice(1).join(' ')
  switch(c){case'/start':case'start':await cSt(i);return 1;case'/help':await cH(i);return 1;case'/models':await cM(i);return 1;case'/model':await cSM(i,a);return 1;case'/system':await cSy(i,a);return 1;case'/mode':await cMode(i,a);return 1;case'/reset':await cR(i);return 1;case'/stats':await cSt2(i);return 1;default:return 0}}

// =================== MESSAGES (متن + عکس + فایل) ===================
async function sL(i,t){if(t.length<=4096)return tgS(i,t);let r=t
  while(r.length>0){let p=r.lastIndexOf('\n',4096);if(p<2048)p=r.lastIndexOf(' ',4096);if(p<2048)p=4096;await tgS(i,r.substring(0,p));r=r.substring(p).trim()}}

function escRx(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
async function hM(u,b,tw){const m=u.message;if(!m)return 0;const i=m.chat.id
  // ویدئو و GIF پشتیبانی نمی‌شوند — چه ویدئو/گیف تلگرام، چه فایل؛ صریحاً رد می‌کنیم و به مدل پاس نمی‌دهیم
  if(isUnsupportedMedia(m)){await tgS(i,'🎬 *تحلیل ویدئو و GIF پشتیبانی نمی‌شود.*\n\nبه‌جای آن می‌توانید بفرستید:\n• 📸 اسکرین‌شات از صحنه‌های اصلی\n• 📝 متن یا دیالوگ\n• ✍️ خلاصه‌ای از اتفاقات\n\nتا دقیق برایتان تحلیل کنم.');return 1}
  var isPhoto=!!(m.photo&&m.photo.length>0),isDoc=!!m.document
  var twRx=tw?new RegExp('\\s*'+escRx(tw)+'\\s*','g'):null
  function clean(s){s=s.replace(new RegExp('@'+b+'\\b','gi'),'');if(twRx)s=s.replace(twRx,' ');return s.trim()}
  var caption=clean(m.caption||'')
  if(!isPhoto&&!isDoc&&!m.text)return 0
  var txt=''
  if(!isPhoto&&!isDoc&&m.text){txt=clean(m.text);if(!txt)return 0}
  if((isPhoto||isDoc)&&!caption)txt='این فایل رو تحلیل کن و توضیح بده'
  if(caption)txt=caption
  await tgAc(i)
  var md=null
  try{if(isPhoto){var bp=bestPhoto(m.photo);var fi=await tgFile(bp.file_id);if(fi)md=await tgDL(fi.file_path)}
    if(isDoc){var fi2=await tgFile(m.document.file_id);if(fi2){md=await tgDL(fi2.file_path);if(m.document.file_name){md.name=m.document.file_name;md.ext=(md.name.split('.').pop()||md.ext).toLowerCase()}if(m.document.mime_type)md.mime=m.document.mime_type}}
  }catch(e){console.error('DL error:',e.message)}
  var isOA=await at()==='openai',uc
  if(md&&md.mime.startsWith('image/')){
    uc=isOA?[{type:'text',text:txt},{type:'image_url',image_url:{url:'data:'+md.mime+';base64,'+md.b64,detail:'high'}}]:[{type:'text',text:txt},{type:'image',source:{type:'base64',media_type:md.mime,data:md.b64}}]
    await ah(i,'user',uc)
  }else if(isPhoto&&!md){await ah(i,'user',txt+' [عکس دریافت شد اما امکان دانلود وجود نداشت]')
  }else if(isDoc&&md&&isTextFile(md)){
    // فایل متنی/کد: محتوا را با رمزگشایی درست UTF-8 می‌خوانیم و به مدل می‌دهیم
    var tc=b64ToText(md.b64);if(!tc)tc='[محتوای فایل قابل خواندن نبود]'
    var trimmed=tc.length>MAXFILECHARS?tc.substring(0,MAXFILECHARS)+'\n\n[... فایل طولانی بود و بریده شد ...]':tc
    uc=[{type:'text',text:txt+'\n\n📄 محتوای فایل «'+md.name+'»:\n```\n'+trimmed+'\n```'}];await ah(i,'user',uc)
  }else if(isDoc&&md&&(md.ext==='pdf'||md.mime==='application/pdf')){
    // PDF: به‌صورت بومی به مدل داده می‌شود (بلوک document انتروپیک؛ در fallback به فرمت OpenAI تبدیل می‌شود)
    uc=isOA
      ?[{type:'text',text:txt},{type:'file',file:{filename:md.name||'file.pdf',file_data:'data:application/pdf;base64,'+md.b64}}]
      :[{type:'text',text:txt},{type:'document',source:{type:'base64',media_type:'application/pdf',data:md.b64},_name:md.name||'file.pdf'}]
    await ah(i,'user',uc)
  }else if(isDoc&&md){uc=[{type:'text',text:txt+'\n[فایل «'+md.name+'» ('+md.mime+') دریافت شد؛ این نوع فایل قابل تحلیل مستقیم نیست.]'}];await ah(i,'user',uc)
  }else if(isDoc&&!md){await ah(i,'user',txt+' [فایل دریافت شد اما امکان دانلود وجود نداشت]')
  }else{await ah(i,'user',txt)}
  await runAI(i)}

// فراخوانی مدل روی تاریخچهٔ فعلی و ارسال پاسخ (هم برای پیام جدید، هم «🔄 پاسخ مجدد»)
async function runAI(i){var isOA=await at()==='openai'
  var meta=await gm(i),history=await gh(i),sp=meta.systemPrompt||'شما یک دستیار هوشمند و مفید هستید. به زبان فارسی پاسخ دهید.',model=meta.model||(isOA?'gemini-3-pro':'claude-sonnet-4-6-20250528')
  var mode=await getMode(i),mm2=modeCfg(mode),fsp=sp+mm2.sp,mx=mm2.mx,ph=mm2.ph
  var ams=[];for(var hi=0;hi<history.length;hi++)if(history[hi].role!=='system')ams.push(history[hi])
  try{var se=await tgS(i,ph);var mi=se&&se.result?se.result.message_id:null,fu='',la=Date.now()
    fu=await aistream(fsp,ams,model,function(cum){
      var no=Date.now()
      if(mi&&(no-la)>1200){la=no;var d=cum.length>3900?cum.substring(0,3900)+'\n\n_ادامه..._':cum+'\n\n_✍️ در حال نوشتن..._';tgE(i,mi,d)}
    },mx)
    if(!fu)throw new Error('پاسخی دریافت نشد');await ah(i,'assistant',fu)
    if(mi){if(fu.length>4096){await tgE(i,mi,'✅ انجام شد.');await sL(i,fu)}else{if(!await tgE(i,mi,fu,{reply_markup:kbRegen()}))await sL(i,fu)}}else await sL(i,fu)
  }catch(e){var h=await gh(i);if(h.length&&h[h.length-1].role==='user'){h.pop();await sh(i,h)}await tgS(i,'❌ خطا:\n'+e.message.substring(0,500))}}

// پاسخ مجدد: آخرین جواب ربات حذف و با همان پیام کاربر دوباره تولید می‌شود
async function regen(i){var h=await gh(i)
  if(!h.length)return tgS(i,'📭 تاریخچه‌ای برای تولید مجدد نیست.')
  if(h[h.length-1].role==='assistant'){h.pop();await sh(i,h)}
  await runAI(i)}

// آیا این پیام در گروه، این ربات را مخاطب قرار داده؟ (منشن یوزرنیم، ریپلای به همین ربات، کلمهٔ فراخوانی، یا دستور مربوط به این ربات)
function addressedToBot(m,bU,tw){var t=m.text||m.caption||''
  // منشن: فقط وقتی یوزرنیم ربات تنظیم شده باشد
  if(bU){if(new RegExp('@'+escRx(bU)+'\\b','i').test(t))return true}
  // ریپلای: فقط اگر روی پیام «همین» ربات باشد (نه هر باتی)
  var rf=m.reply_to_message&&m.reply_to_message.from
  if(rf&&rf.is_bot){if(bU&&rf.username){if(rf.username.toLowerCase()===bU.toLowerCase())return true}else return true}
  // کلمهٔ فراخوانی: با مرز کلمه (فاصله/علامت/ابتدا و انتها) تا داخل کلمات دیگر فعال نشود
  if(tw&&new RegExp('(^|[^A-Za-z0-9\\u0600-\\u06FF])'+escRx(tw)+'([^A-Za-z0-9\\u0600-\\u06FF]|$)').test(t))return true
  // دستور: بدون @ برای همه؛ با @ فقط اگر مخصوص همین ربات باشد
  if(isC(t)){var first=t.split(/\s+/)[0],parts=first.split('@');if(parts.length<2)return true;if(bU&&parts[1].toLowerCase()===bU.toLowerCase())return true}
  return false}
// =================== CALLBACK QUERY (دکمه‌های شیشه‌ای) ===================
async function hCb(q){var i=q.message&&q.message.chat?q.message.chat.id:null,mid=q.message?q.message.message_id:null,dt=q.data||''
  if(!i){await tgCb(q.id);return}
  var aU=typeof ALLOWED_USERS!=='undefined'?ALLOWED_USERS:''
  if(aU&&!aU.split(',').map(function(x){return x.trim()}).includes(String(q.from&&q.from.id))){await tgCb(q.id,'⛔ دسترسی ندارید');return}
  try{
    if(dt==='m:instant'||dt==='m:think'){var md=dt==='m:think'?'think':'instant'
      await sm(i,{...(await gm(i)),mode:md});await tgCb(q.id,md==='think'?'🧠 تفکر عمیق فعال شد':'⚡ حالت سریع فعال شد')
      if(mid)await tgE(i,mid,'🎚️ *حالت پاسخ‌دهی*\n\nفعلی: '+(md==='think'?'🧠 Deep Think':'⚡ Instant'),{reply_markup:await kbMode(i)})
      return}
    if(dt.indexOf('mdl:')===0){var mo=dt.slice(4)
      await sm(i,{...(await gm(i)),model:mo});await tgCb(q.id,'✅ مدل: '+mo)
      if(mid)await tgE(i,mid,'🧩 *انتخاب مدل*\n✅ فعلی: `'+mo+'`\n\nبرای تغییر، روی مدل بزنید:',{reply_markup:await mdlKb(i)})
      return}
    if(dt==='menu:models'){await tgCb(q.id)
      try{var kb=await mdlKb(i),me=await gm(i)
        if(mid)await tgE(i,mid,'🧩 *انتخاب مدل*\n✅ فعلی: `'+(me.model||'پیش‌فرض')+'`\n\nبرای تغییر، روی مدل بزنید:',{reply_markup:kb})}
      catch(e){await tgS(i,'❌ '+e.message.substring(0,200))}
      return}
    if(dt==='menu:stats'){await tgCb(q.id);if(mid)await tgE(i,mid,await statsTxt(i),{reply_markup:kbBack()});return}
    if(dt==='menu:help'){await tgCb(q.id);if(mid)await tgE(i,mid,hlpTxt(),{reply_markup:kbBack()});return}
    if(dt==='menu:main'){await tgCb(q.id);if(mid)await tgE(i,mid,await stTxt(),{reply_markup:kbMain()});return}
    if(dt==='reset:1'){await ch(i);await tgCb(q.id,'🔄 تاریخچه پاک شد');await tgS(i,'🔄 تاریخچه پاک شد! مکالمه جدید شروع می‌شود.');return}
    if(dt==='regen:1'){await tgCb(q.id,'🔄 در حال تولید مجدد...');await regen(i);return}
    await tgCb(q.id)
  }catch(e){await tgCb(q.id,'❌ خطا')}}
// =================== PROCESS UPDATE ===================
async function pU(u){if(u.callback_query)return hCb(u.callback_query)
  var c=await getCfg(),bU=(c.botUsername||(typeof BOT_USERNAME!=='undefined'?BOT_USERNAME:'')||'').replace(/^@/,'').trim();var tw=(c.triggerWord||'حاجی').trim();var m=u.message;if(!m)return
  var i=m.chat.id,uid=m.from.id,ty=m.chat.type
  var aU=typeof ALLOWED_USERS!=='undefined'?ALLOWED_USERS:''
  if(aU&&!aU.split(',').map(function(x){return x.trim()}).includes(String(uid)))return tgS(i,'⛔ شما دسترسی ندارید.')
  // در گروه‌ها فقط وقتی ربات مخاطب قرار گرفته پاسخ بده — عکس/ویدئو/فایل هم بدون منشن پاسخ نمی‌گیرند
  if(ty!=='private'){if(!addressedToBot(m,bU,tw))return}
  if(m.text&&isC(m.text)){try{if(await hC(i,m.text))return}catch(ce){await tgS(i,'❌ خطا:\n'+ce.message.substring(0,300));return}}
  await hM(u,bU,tw)}

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
'<label>🌐 Base URL</label><input id="baseUrl" value="'+(c.baseUrl||'')+'" placeholder="https://api.anthropic.com یا آدرس پلتفرم غیررسمی">'+
'<label>🔌 نوع API</label><select id="apiType">'+
'<option value=""'+(!c.apiType?' selected':'')+'>خودکار (تشخیص از روی آدرس)</option>'+
'<option value="openai"'+(c.apiType==='openai'?' selected':'')+'>OpenAI-compatible (اکثر پلتفرم‌های غیررسمی)</option>'+
'<option value="anthropic"'+(c.apiType==='anthropic'?' selected':'')+'>Anthropic (Claude)</option>'+
'</select>'+
'<label>🎚️ حالت پیش‌فرض پاسخ</label><select id="defaultMode">'+
'<option value="instant"'+(c.defaultMode!=='think'?' selected':'')+'>⚡ Instant (سریع و کوتاه)</option>'+
'<option value="think"'+(c.defaultMode==='think'?' selected':'')+'>🧠 Deep Think (تفکر عمیق)</option>'+
'</select>'+
'<label>🤖 Bot Username</label><input id="botUsername" value="'+(c.botUsername||'')+'" placeholder="my_bot (بدون @)">'+
'<label>🗣️ کلمه فراخوانی در گروه</label><input id="triggerWord" value="'+(c.triggerWord||'')+'" placeholder="حاجی (پیش‌فرض)">'+
'<div class="row"><button class="btn" onclick="sv()">💾 ذخیره تنظیمات</button><button class="btn btn2" onclick="ts()">🧪 تست اتصال</button></div>'+
'<div id="r"></div></div>'+
'<div class="card"><h3>🔗 Webhook</h3><div class="box">'+w+'</div>'+
'<div class="row"><button class="btn" onclick="sw()">🔄 تنظیم Webhook</button><button class="btn btn2" onclick="wi()">🔍 بررسی وضعیت Webhook</button></div></div>'+
'<script>'+
'async function sv(){var g=document.getElementById("tgToken"),b=document.getElementById("apiKey"),u=document.getElementById("baseUrl"),n=document.getElementById("botUsername"),tw=document.getElementById("triggerWord"),ap=document.getElementById("apiType"),dm=document.getElementById("defaultMode"),r=document.getElementById("r");'+
'r.style.display="none";'+
'try{var res=await fetch("/save-config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telegramToken:g.value,apiKey:b.value,baseUrl:u.value,botUsername:n.value,triggerWord:tw.value,apiType:ap.value,defaultMode:dm.value})});var j=await res.json();'+
'r.style.display="block";r.className=j.ok?"sc":"er";'+
'r.textContent=j.ok?("✅ تنظیمات ذخیره شد!"+(j.webhook?(j.webhook.ok?"\\n✅ ربات فعال شد (Webhook ست شد)":"\\n⚠️ Webhook ست نشد: "+(j.webhook.description||"")):"")):"❌ خطا: "+(j.error||"")}'+
'catch(e){r.style.display="block";r.className="er";r.textContent="❌ "+e.message}}'+
'async function ts(){var r=document.getElementById("r");r.style.display="block";r.className="";r.textContent="⏳ در حال تست...";'+
'try{var res=await fetch("/test-api");var j=await res.json();r.className=j.ok?"sc":"er";r.textContent=j.ok?"✅ اتصال برقرار است!":"❌ "+(j.error||"")}'+
'catch(e){r.className="er";r.textContent="❌ "+e.message}}'+
'async function sw(){var b=document.querySelector(".card:last-child .btn"),r=document.getElementById("r");'+
'b.disabled=1;b.textContent="⏳...";r.style.display="none";'+
'try{var d=await(await fetch("/sw")).json();r.style.display="block";'+
'if(d.ok){r.className="sc";r.textContent="✅ Webhook تنظیم شد! ربات آماده است.\\n"+(d.webhookUrl||"")}'+
'else{r.className="er";r.textContent="❌ "+(d.description||JSON.stringify(d))}}'+
'catch(e){r.style.display="block";r.className="er";r.textContent="❌ "+e.message}'+
'b.disabled=0;b.textContent="🔄 تنظیم Webhook"}'+
'async function wi(){var r=document.getElementById("r");r.style.display="block";r.className="";r.textContent="⏳ در حال بررسی...";'+
'try{var d=await(await fetch("/whinfo")).json();'+
'if(d.error){r.className="er";r.textContent="❌ "+d.error;return}'+
'var ok=d.tokenValid&&d.matches&&!d.lastError;r.className=ok?"sc":"er";'+
'r.textContent=(d.tokenValid?"✅ توکن معتبر: "+d.bot:"❌ "+d.bot)+"\\n"+'+
'(d.matches?"✅ Webhook درست ست شده":"⚠️ Webhook فعلی: "+(d.currentUrl||"ست نشده")+"\\nباید باشد: "+d.expected+"\\n→ دکمهٔ «تنظیم Webhook» را بزنید")+"\\n"+'+
'"📥 در صف: "+(d.pending!=null?d.pending:"?")+(d.lastError?"\\n❌ خطای اخیر تلگرام: "+d.lastError:"")}'+
'catch(e){r.className="er";r.textContent="❌ "+e.message}}'+
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
    _cfgCache=null;_atCache=null

    const url=new URL(req.url)

    // ===== POST: save config به KV =====
    if(req.method==='POST'&&url.pathname==='/save-config'){
      try{var prevCfg=await getCfg(),prevTok=prevCfg.telegramToken||''
        var body=await req.json();var data={}
        if(body.telegramToken!==undefined)data.telegramToken=body.telegramToken
        if(body.apiKey!==undefined)data.apiKey=body.apiKey
        if(body.baseUrl!==undefined)data.baseUrl=body.baseUrl
        if(body.botUsername!==undefined)data.botUsername=body.botUsername
        if(body.triggerWord!==undefined)data.triggerWord=body.triggerWord
        if(body.apiType!==undefined)data.apiType=body.apiType
        if(body.defaultMode!==undefined)data.defaultMode=body.defaultMode
        for(var k in data){if(!data[k])delete data[k]}
        await saveCfg(data)
        _cfgCache=null
        // مدیریت خودکار وب‌هوک: وب‌هوک ربات قبلی را حذف کن تا فقط ربات جدید کار کند، سپس وب‌هوک ربات جدید را ست کن
        var newTok=data.telegramToken||'',wh=null
        try{
          if(prevTok&&prevTok!==newTok)await fetch('https://api.telegram.org/bot'+prevTok+'/deleteWebhook?drop_pending_updates=true')
          if(newTok){var wurl=url.origin+'/'
            await fetch('https://api.telegram.org/bot'+newTok+'/deleteWebhook')
            var wr=await fetch('https://api.telegram.org/bot'+newTok+'/setWebhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:wurl,allowed_updates:['message','callback_query'],drop_pending_updates:true})})
            wh=await wr.json()}
        }catch(e){}
        return new Response(JSON.stringify({ok:true,webhook:wh}),{headers:{'Content-Type':'application/json'}})
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
        var jr=await r.json();jr.webhookUrl=w2
        return new Response(JSON.stringify(jr),{headers:{'Content-Type':'application/json'}})
      }
      // تشخیص وضعیت: getMe (توکن معتبر؟) + getWebhookInfo (وب‌هوک کجا ست شده و خطای تحویل)
      if(url.pathname==='/whinfo'){
        var tk2=await tgT()
        if(!tk2) return new Response(JSON.stringify({ok:false,error:'توکن تلگرام تنظیم نشده'}),{headers:{'Content-Type':'application/json'}})
        var exp=url.origin+'/',out={expected:exp}
        try{var me=await(await fetch('https://api.telegram.org/bot'+tk2+'/getMe')).json();out.bot=me.ok?('@'+(me.result.username||'')):('توکن نامعتبر: '+(me.description||''));out.tokenValid=!!me.ok}catch(e){out.bot='خطا در اتصال';out.tokenValid=false}
        try{var wi=await(await fetch('https://api.telegram.org/bot'+tk2+'/getWebhookInfo')).json();if(wi.ok){var cur=wi.result.url||'';out.currentUrl=cur||'(ست نشده)';out.pending=wi.result.pending_update_count;out.lastError=wi.result.last_error_message||'';out.matches=!!cur&&cur.replace(/%3A/gi,':')===exp.replace(/%3A/gi,':')}}catch(e){out.currentUrl='خطا'}
        return new Response(JSON.stringify(out),{headers:{'Content-Type':'application/json'}})
      }
      return new Response('Not Found',{status:404})
    }

    // ===== POST: Webhook از تلگرام =====
    // پاسخ همیشه با توکنِ فعلیِ پنل ارسال می‌شود. چون موقع تغییر توکن، وب‌هوک ربات قبلی حذف می‌شود،
    // فقط رباتِ واردشده در پنل آپدیت می‌فرستد و کار می‌کند.
    try{var u=await req.json();await pU(u);return new Response('OK',{status:200})}
    catch(e){return new Response('OK',{status:200})}
  },
  async scheduled(env){globalThis.KV_STORE=env.KV_STORE}
}