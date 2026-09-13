
const socket=io();
let G=null, me=null, role=window.FF_ROLE||'players', selectedTeam='A', timer=null;
const audio={
 click:'/games/family-feud/audio/click.wav', buzz:'/games/family-feud/audio/buzz.wav',
 tick:'/games/family-feud/audio/tick.wav', win:'/games/family-feud/audio/win.wav',
 wrong:'/games/family-feud/audio/wrong.wav', reveal:'/games/family-feud/audio/reveal.wav',
 suspense:'/games/family-feud/audio/suspense.wav', countdown:'/games/family-feud/audio/countdown.wav'
};
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function sound(k){try{let a=new Audio(audio[k]);a.volume=k==='buzz'?.75:.55;a.currentTime=0;a.play().catch(()=>{});}catch(e){}}
function app(x){document.getElementById('app').innerHTML=x}
function toast(x){const d=document.createElement('div');d.className='toast';d.textContent=x;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
function setCode(c){document.getElementById('codeTop').textContent=c||'—'}
function lobby(){
 if(role==='presenter') return `<section class="panel center"><div class="logo">👨‍👩‍👧‍👦 لعبة العائلة</div><p class="sub">مقدم + شاشة + لاعبين</p><div class="grid"><div><input id="rounds" class="input" type="number" min="1" max="100" value="10" placeholder="عدد الجولات"><button class="btn" onclick="createRoom()">إنشاء غرفة للمقدم</button></div><div><input id="code" class="input" placeholder="كود الغرفة"><button class="btn ghost" onclick="joinPresenter()">دخول كمقدم</button></div></div><p class="muted">بعد الإنشاء افتح الشاشة من رابط الشاشة، وأرسل كود الغرفة للاعبين.</p></section>`;
 if(role==='display') return `<section class="panel center"><div class="logo">📺 شاشة Family Feud</div><p class="sub">أدخل كود الغرفة لعرض اللعبة.</p><input id="code" class="input" placeholder="كود الغرفة"><button class="btn" onclick="joinDisplay()">دخول الشاشة</button></section>`;
 return `<section class="panel center"><div class="logo">🎮 لاعبين</div><p class="sub">أنشئ غرفة جديدة أو انضم لغرفة موجودة.</p><div class="grid"><div><input id="nameNew" class="input" placeholder="اسمك"><div class="row"><button class="btn" onclick="createPlayers('A')">إنشاء — أحمر</button><button class="btn blue" onclick="createPlayers('B')">إنشاء — أزرق</button></div></div><div><input id="code" class="input" placeholder="كود الغرفة"><input id="name" class="input" placeholder="اسمك"><div class="row"><button class="btn" onclick="joinPlayer('A')">الفريق الأحمر</button><button class="btn blue" onclick="joinPlayer('B')">الفريق الأزرق</button></div></div></div></section>`;
}
function render(){
 if(!G){app(lobby());return}
 setCode(G.code);
 if(role==='display') return renderDisplay();
 if(role==='presenter') return renderPresenter();
 return renderPlayer();
}
function team(t){
 return `<div class="panel center"><div class="small">${esc(t.name)}</div><div class="ff-score">${t.score||0}</div><div class="ff-strikes">${[1,2,3].map(n=>`<span class="ff-strike ${t.strikes>=n?'on':''}">${t.strikes>=n?'✕':n}</span>`).join('')}</div><div class="small">${(t.players||[]).map(p=>esc(p.name)).join(' • ')||'لاعبون'}</div></div>`;
}
function answers(){
 return `<div class="ff-answers">${(G.answers||[]).map((a,i)=>a.revealed?
 `<div class="ff-answer stageFlash"><b>${esc(a.text)}</b><span>${a.awardedPoints||a.points} نقطة</span></div>`:
 `<div class="ff-answer hidden">؟</div>`).join('')}</div>`;
}
function renderDisplay(){
 let lock=G.answerLock||G.lock;
 app(`<section class="panel" style="min-height:90vh"><div class="topbar"><div><div class="small">شاشة العرض</div><div class="ff-code">${esc(G.code)}</div></div><div class="pill">${G.currentRound||0} / ${G.rounds||0}</div></div>
 <div class="ff-grid">${G.teams.map(team).join('')}</div>
 <div class="ff-big" style="margin:25px 0">${esc(G.question||'بانتظار بدء السؤال…')}</div>
 ${G.lock?`<div class="notice stageFlash">🔔 ${esc(G.lock.name)} ضغط أولًا — ${G.lock.team==='A'?'الفريق الأحمر':'الفريق الأزرق'}</div>`:''}
 ${G.answerLock?`<div class="notice stageFlash">${G.answerLock.double?'⚡ دبل — ':''}✍️ ${esc(G.answerLock.name)} يجيب الآن <b id="displayTimer">10</b> ث</div>`:''}
 ${answers()}
 ${G.phase==='lobby'?'<div class="notice center">بانتظار بدء اللعبة…</div>':''}</section>`);
 if(G.answerLock) countdown(G.answerLock.until,'displayTimer');
}
function renderPresenter(){
 app(`<section class="panel"><div class="topbar"><div><div class="small">لوحة المقدم</div><div class="ff-code">${esc(G.code)}</div></div><div class="row"><button class="btn ghost" onclick="window.open('/games/family-feud/display.html?code=${encodeURIComponent(G.code)}','_blank')">📺 فتح الشاشة</button></div></div>
 <div class="ff-grid">${G.teams.map(team).join('')}</div><div class="notice">${G.phase==='lobby'?'جاهز؟ ابدأ أول سؤال.':`السؤال ${G.currentRound}: ${esc(G.question)}`}</div>
 ${answers()}
 <div class="row" style="margin-top:18px"><button class="btn" onclick="start()">🎲 ${G.phase==='lobby'?'ابدأ اللعبة':'السؤال التالي'}</button><button class="btn ghost" onclick="changeQ()">🔄 تغيير السؤال</button><button class="btn danger" onclick="strike('A')">Strike 🔴</button><button class="btn danger" onclick="strike('B')">Strike 🔵</button></div>
 <div class="small" style="margin-top:15px">النتائج والتأثيرات تظهر على الشاشة. اللاعبون يرسلون الإجابات من أجهزتهم.</div></section>`);
}
function renderPlayer(){
 const p=G.players?.find(x=>x.id===me), tm=G.teams?.find(t=>t.id===p?.team);
 if(!p){app(lobby());return}
 let body='';
 if(G.phase==='lobby') body=`<div class="notice center">جاهز يا ${esc(p.name)}. بانتظار بدء السؤال.</div>${G.mode!=='presenter'?'<button class="btn" onclick="start()">🎲 ابدأ السؤال</button>':''}`;
 else if(G.answerLock?.id===me) body=`<div class="ff-big">${esc(G.question)}</div><div class="timer" id="tm">10</div><input id="ans" class="input" autofocus placeholder="اكتب إجابتك هنا" onkeydown="if(event.key==='Enter'){event.preventDefault();submit()}"><button class="btn" onclick="submit()">إرسال الإجابة 🚀</button>`;
 else body=`<div class="ff-big">${esc(G.question)}</div><div class="grid"><button class="btn" onclick="ready(false)" ${G.answerLock?'disabled':''}>✍️ جواب كتابي<br><span class="small">10 ثواني</span></button><button class="btn" onclick="ready(true)" ${G.answerLock||tm?.doubleUsed?'disabled':''}>⚡ دبل كتابي<br><span class="small">10 ثواني</span></button></div>${G.teams.some(t=>t.strikes>=3)?'<button class="btn ghost" onclick="nextPlayer()">🔄 السؤال التالي</button>':''}`;
 app(`<section class="panel center"><div class="topbar"><div><div class="small">لاعب</div><div class="ff-code">${esc(G.code)}</div></div></div><h2>${esc(p.name)}</h2><div class="ff-grid">${G.teams.map(team).join('')}</div>${body}</section>`);
 if(G.answerLock?.id===me) countdown(G.answerLock.until,'tm');
}
function countdown(until,id){clearInterval(timer);timer=setInterval(()=>{let n=Math.max(0,Math.ceil((until-Date.now())/1000));let el=document.getElementById(id);if(el)el.textContent=n;if(n<=0)clearInterval(timer)},100)}
function createRoom(){const rounds=Number(document.getElementById('rounds').value)||10;sound('click');socket.emit('room:create',{game:'family',mode:'presenter',rounds})}
function joinPresenter(){const c=document.getElementById('code').value.trim().toUpperCase();socket.emit('room:presenter',{code:c})}
function joinDisplay(){const c=document.getElementById('code').value.trim().toUpperCase();socket.emit('room:display',{code:c})}
function createPlayers(team){const name=document.getElementById('nameNew').value.trim();if(!name)return toast('اكتب اسمك');socket.emit('room:create',{game:'family',mode:'players',name,team,rounds:10})}
function joinPlayer(team){const code=document.getElementById('code').value.trim().toUpperCase(),name=document.getElementById('name').value.trim();if(!code||!name)return toast('أدخل الكود والاسم');socket.emit('room:join',{code,name,team})}
function start(){sound('click');socket.emit('ff:start')}
function changeQ(){sound('click');socket.emit('ff:change')}
function strike(team){sound('wrong');socket.emit('ff:strike',{team})}
function ready(double){sound(double?'buzz':'click');socket.emit('ff:answerReady',{double})}
function submit(){const v=document.getElementById('ans')?.value.trim();if(!v)return;sound('click');socket.emit('ff:submit',{answer:v})}
function nextPlayer(){sound('click');socket.emit('ff:nextPlayer')}
socket.on('room:created',x=>{me=x.playerId||null; if(x.code){G={code:x.code,mode:x.mode,phase:'lobby',players:[],teams:[{id:'A',name:'الفريق الأحمر',score:0,strikes:0,players:[]},{id:'B',name:'الفريق الأزرق',score:0,strikes:0,players:[]}]}; history.replaceState(null,'','?code='+encodeURIComponent(x.code));}})
socket.on('joined',x=>{me=x.playerId;history.replaceState(null,'','?code='+encodeURIComponent(x.code))})
socket.on('display:ok',x=>{history.replaceState(null,'','?code='+encodeURIComponent(x.code))})
socket.on('errorMsg',x=>toast(x));
socket.on('ff:correct',x=>{sound('reveal'); if(x.smart)toast('🧠 تم احتسابها من قبل التصحيح الذكي'); render()});
socket.on('ff:wrong',x=>{sound('wrong');toast('❌ إجابة خاطئة — Strike');render()});
socket.on('state',g=>{if(!g||g.type!=='family')return;G=g;setCode(g.code);render()});
const params=new URLSearchParams(location.search);const initCode=params.get('code');
if(initCode){
 if(role==='display')socket.emit('room:display',{code:initCode});
 else if(role==='presenter')socket.emit('room:presenter',{code:initCode});
 else { const n=params.get('name'); if(n) socket.emit('room:join',{code:initCode,name:n,team:params.get('team')||'A'}); }
}
render();
