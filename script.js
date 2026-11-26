/* ============ CONFIGURAÇÃO ============ */
const CHAVES = {
  apifootball: 'b639d12cebd5e46d8e51f470d2ae2cbd',   // placar ao vivo (api-football.com)
  gnews: ''                                          // opcional: notícias com imagem (gnews.io)
};
const ATUALIZAR_PLACAR_SEG = 60;   // intervalo do placar (plano gratuito: 100 consultas/dia)
const FEEDS = [ // feeds RSS usados quando não há chave GNews (ajuste se algum mudar)
  {name:'ge', url:'https://ge.globo.com/rss/ge/futebol/'},
  {name:'ESPN Brasil', url:'https://www.espn.com.br/espn/rss/futebol/news'},
  {name:'Gazeta Esportiva', url:'https://www.gazetaesportiva.com/futebol/feed/'},
  {name:'Trivela', url:'https://trivela.com.br/feed/'}
];
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const MERCADO = ['contrata','contratação','reforço','negocia','proposta','acerto','empréstimo','renovação','renova','multa rescisória','rescisão','mercado da bola','transferência','assina','anunciado','sondagem','milhões','janela'];
const GRANDES = ['flamengo','palmeiras','corinthians','são paulo','santos','grêmio','internacional','atlético-mg','cruzeiro','botafogo','fluminense','vasco','seleção','neymar','real madrid','barcelona','manchester','liverpool','psg','bayern','messi','cristiano','mbappé','vini jr','vinicius','endrick','ancelotti'];
const DESTAQUES = ['final','decisão','título','campeão','libertadores','copa do mundo','champions','clássico','demite','demitido','técnico'];

/* ============ UTILIDADES ============ */
const $ = s => document.querySelector(s);
const store = {get:k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const chave = n => store.get(n) || CHAVES[n] || '';
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const strip = h => String(h||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const ago = d => { const m=Math.max(1,Math.round((Date.now()-d)/6e4)); return m<60?`há ${m} min`:m<1440?`há ${Math.round(m/60)} h`:`há ${Math.round(m/1440)} d`; };
const norm = s => String(s).toLowerCase();

/* ============ NOTÍCIAS ============ */
let NEWS = [], DEMO_NEWS = false, FILTER = 'todas', QUERY = '';

async function fetchGNews(key){
  const u = `https://gnews.io/api/v4/search?q=${encodeURIComponent('futebol OR "mercado da bola"')}&lang=pt&max=50&sortby=publishedAt&apikey=${key}`;
  const j = await (await fetch(u)).json();
  return (j.articles||[]).map(a=>({title:a.title,desc:a.description,url:a.url,img:a.image,date:new Date(a.publishedAt),src:a.source?.name||'GNews'}));
}
async function fetchFeed(f){
  const j = await (await fetch(RSS2JSON+encodeURIComponent(f.url))).json();
  return (j.items||[]).map(i=>{
    const html = (i.content||'')+(i.description||'');
    const m = html.match(/<img[^>]+src=["']([^"']+)/i);
    return {title:strip(i.title),desc:strip(i.description).slice(0,220),url:i.link,
      img:i.thumbnail||i.enclosure?.link||(m&&m[1])||'',date:new Date(String(i.pubDate).replace(' ','T')+'Z'),src:f.name};
  });
}
function demoNews(){
  const t=[['Flamengo negocia contratação de zagueiro europeu por R$ 80 milhões','Proposta já foi enviada e o jogador aceitou os termos do contrato.',1],
  ['Palmeiras vence clássico e entra na briga pelo título do Brasileirão','Equipe confirma boa fase na reta final da competição.',3],
  ['Real Madrid sonda reforço brasileiro para a próxima janela','Clube espanhol acompanha o atacante há meses.',2],
  ['Seleção Brasileira divulga lista de convocados para a data FIFA','Técnico fez mudanças no meio-campo.',5],
  ['Corinthians renova com goleiro até 2029 e aumenta multa rescisória','Acordo foi anunciado nesta manhã.',6],
  ['São Paulo demite técnico após sequência de derrotas','Diretoria já busca substituto no mercado.',8],
  ['Libertadores: final terá árbitro estrangeiro e VAR reforçado','Conmebol divulgou a escala oficial.',10],
  ['Santos acerta empréstimo de meia e reforça elenco para a final','Jogador chega por uma temporada.',12],
  ['Champions League: Liverpool e PSG fazem jogo decisivo na quarta','Confronto define a liderança do grupo.',14]];
  return t.map(x=>({title:x[0],desc:x[1],url:'#',img:'',date:new Date(Date.now()-x[2]*36e5),src:'Demonstração'}));
}
function score(a){
  const txt = norm(a.title+' '+a.desc);
  let s = 0, mercado = false;
  MERCADO.forEach(k=>{ if(txt.includes(k)){ s+=4; mercado=true; }});
  GRANDES.forEach(k=>{ if(txt.includes(k)) s+=3; });
  DESTAQUES.forEach(k=>{ if(txt.includes(k)) s+=2; });
  if(a.img) s+=3;
  s += Math.max(0, 12 - (Date.now()-a.date)/36e5/2); // frescor: perde 1 ponto a cada 2 h
  a.score = s; a.mercado = mercado; return a;
}
async function loadNews(){
  let items = [];
  const key = chave('gnews');
  if(key){ try{ items = await fetchGNews(key); }catch(e){} }
  if(items.length < 5){
    const r = await Promise.allSettled(FEEDS.map(fetchFeed));
    r.forEach(x=>{ if(x.status==='fulfilled') items = items.concat(x.value); });
  }
  items = items.filter(a=>a.title && !isNaN(a.date));
  DEMO_NEWS = !items.length;
  if(DEMO_NEWS) items = demoNews();
  const seen = new Set();
  NEWS = items.filter(a=>{ const k=norm(a.title).slice(0,50); if(seen.has(k)) return false; seen.add(k); return true; }).map(score).sort((a,b)=>b.score-a.score);
  renderChips(); renderNews(); updateNotice();
}
function imgTag(a,cls){
  const ini = esc((a.src||'?')[0]);
  if(!a.img) return `<div class="${cls} ph">${ini}</div>`;
  return `<img class="${cls}" src="${esc(a.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;${cls} ph&quot;>${ini}</div>'">`;
}
function renderNews(){
  const el = $('#news');
  let list = NEWS.filter(a=>(FILTER==='todas'||(FILTER==='mercado'?a.mercado:a.src===FILTER)) && (!QUERY || norm(a.title+a.desc).includes(QUERY)));
  if(!list.length){ el.innerHTML='<p class="meta">Nenhuma notícia encontrada para este filtro.</p>'; return; }
  const [top,...rest] = list;
  const mk = NEWS.filter(a=>a.mercado).slice(0,6);
  const used = new Set([top]);
  let html = `<a class="hero" href="${esc(top.url)}" target="_blank" rel="noopener">${imgTag(top,'img')}
    <div class="t"><span class="tag">Em destaque</span>${top.mercado?'<span class="tag m">Mercado</span>':''}
    <h2>${esc(top.title)}</h2><p>${esc(top.desc)}</p><div class="meta">${esc(top.src)} · ${ago(top.date)}</div></div></a>`;
  if(FILTER==='todas' && !QUERY && mk.length){
    mk.forEach(a=>used.add(a));
    html += `<div class="sec"><h2>Mercado da bola: as mais relevantes</h2></div><ol class="rank">` +
      mk.map((a,i)=>`<li><b>${i+1}</b><a href="${esc(a.url)}" target="_blank" rel="noopener"><h3>${esc(a.title)}</h3><span class="meta">${esc(a.src)} · ${ago(a.date)}</span></a>${imgTag(a,'th')}</li>`).join('') + `</ol>`;
  }
  const others = rest.filter(a=>!used.has(a));
  if(others.length){
    html += `<div class="sec"><h2>Mais notícias</h2><span class="meta">ordenadas por relevância</span></div><div class="grid">` +
      others.slice(0,30).map(a=>`<a class="card" href="${esc(a.url)}" target="_blank" rel="noopener">${imgTag(a,'img')}<div class="b">
        <div>${a.mercado?'<span class="tag m">Mercado</span>':''}</div><h3>${esc(a.title)}</h3><p>${esc(a.desc)}</p><span class="meta">${esc(a.src)} · ${ago(a.date)}</span></div></a>`).join('') + `</div>`;
  }
  el.innerHTML = html;
}
function renderChips(){
  const srcs = [...new Set(NEWS.map(a=>a.src))].slice(0,6);
  const opts = [['todas','Todas'],['mercado','Mercado da bola'],...srcs.map(s=>[s,s])];
  $('#chips').innerHTML = opts.map(o=>`<button class="chip" data-f="${esc(o[0])}" aria-pressed="${FILTER===o[0]}">${esc(o[1])}</button>`).join('');
}
$('#chips').addEventListener('click',e=>{ const b=e.target.closest('.chip'); if(!b) return; FILTER=b.dataset.f; renderChips(); renderNews(); });
$('#q').addEventListener('input',e=>{ QUERY=norm(e.target.value.trim()); renderNews(); });

/* ============ PLACAR AO VIVO ============ */
let LIVE = [], PREV = {}, DEMO_LIVE = false, LIVE_ERR = '', demoState = null;

async function fetchLive(key){
  const r = await fetch('https://v3.football.api-sports.io/fixtures?live=all',{headers:{'x-apisports-key':key}});
  const j = await r.json();
  if(j.errors && !Array.isArray(j.errors) && Object.keys(j.errors).length) throw new Error(Object.values(j.errors).join(' '));
  return (j.response||[]).map(x=>({id:x.fixture.id,liga:`${x.league.name} · ${x.league.country}`,
    min:x.fixture.status.short==='HT'?'Intervalo':(x.fixture.status.elapsed?x.fixture.status.elapsed+"'":x.fixture.status.long),
    h:{n:x.teams.home.name,l:x.teams.home.logo,g:x.goals.home??0},a:{n:x.teams.away.name,l:x.teams.away.logo,g:x.goals.away??0}}));
}
function demoLive(){
  if(!demoState) demoState=[['Brasileirão · Brasil','Flamengo','Palmeiras',34],['Brasileirão · Brasil','Corinthians','Santos',12],
    ['Libertadores · América do Sul','River Plate','Fluminense',67],['Premier League · Inglaterra','Arsenal','Chelsea',78]]
    .map((x,i)=>({id:i,liga:x[0],m:x[3],h:{n:x[1],l:'',g:0},a:{n:x[2],l:'',g:0}}));
  demoState.forEach(g=>{ g.m=Math.min(90,g.m+1); if(Math.random()<.06) (Math.random()<.5?g.h:g.a).g++; g.min=g.m+"'"; });
  return demoState;
}
async function loadLive(){
  const key = chave('apifootball'); let data;
  if(key){ try{ data = await fetchLive(key); DEMO_LIVE=false; LIVE_ERR=''; }catch(e){ console.warn('API-Football:',e); LIVE_ERR = String(e.message||e).slice(0,160); } }
  if(!data){ DEMO_LIVE=true; data = demoLive(); }
  LIVE = data; renderLive(); updateNotice();
}
function renderLive(){
  const el = $('#live');
  $('#liveInfo').textContent = DEMO_LIVE ? 'Modo demonstração' : `${LIVE.length} jogo(s) · atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  if(!LIVE.length){ el.innerHTML='<p class="vazio">Nenhum jogo acontecendo agora.</p>'; return; }
  const by = {}; LIVE.forEach(g=>(by[g.liga]=by[g.liga]||[]).push(g));
  el.innerHTML = Object.entries(by).map(([lg,gs])=>`<div class="lg">${esc(lg)}</div>`+gs.map(g=>{
    const gol = PREV[g.id]!==undefined && PREV[g.id] !== g.h.g+'-'+g.a.g;
    const logo = t => t.l?`<img src="${esc(t.l)}" alt="" loading="lazy">`:'';
    return `<div class="jogo ${gol?'gol':''}"><span class="t">${logo(g.h)}${esc(g.h.n)}</span><span class="s">${g.h.g}</span>
      <span class="t">${logo(g.a)}${esc(g.a.n)}</span><span class="s">${g.a.g}</span><span class="min">${esc(g.min)}</span></div>`;
  }).join('')).join('');
  LIVE.forEach(g=>PREV[g.id]=g.h.g+'-'+g.a.g);
}
function updateNotice(){
  const msgs=[]; if(DEMO_NEWS) msgs.push('Notícias em demonstração: nenhuma fonte respondeu. Verifique a conexão ou configure uma chave GNews.');
  if(DEMO_LIVE) msgs.push(LIVE_ERR ? 'Placar em demonstração: a API-Football retornou erro (' + LIVE_ERR + ').' : 'Placar em demonstração: informe sua chave da API-Football no arquivo script.js para ver jogos reais.');
  const n=$('#notice'); n.hidden=!msgs.length; n.textContent=msgs.join(' ');
}
let liveTimer;
function startLive(){
  clearInterval(liveTimer); loadLive();
  liveTimer = setInterval(()=>{ if(!document.hidden) loadLive(); }, (chave('apifootball') ? ATUALIZAR_PLACAR_SEG : 4) * 1000);
}

/* ============ MODO NOITE ============ */
const btnTema = $('#tema');
function aplicarTema(t){
  document.documentElement.dataset.tema = t;
  btnTema.querySelector('.lbl').textContent = t==='dark' ? 'NIGHTMODE' : 'DAYMODE';
  btnTema.setAttribute('aria-checked', t==='dark');
}
aplicarTema(document.documentElement.dataset.tema || 'light');
btnTema.onclick = ()=>{ const t = document.documentElement.dataset.tema==='dark' ? 'light' : 'dark'; store.set('tema',t); aplicarTema(t); };

/* ============ INÍCIO ============ */
loadNews();
startLive();
setInterval(loadNews, 30*60*1000); // renova notícias a cada 30 min
