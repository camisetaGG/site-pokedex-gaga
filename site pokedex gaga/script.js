/* ==========================================================================
   script.js — Aplicação completa: API, roteador, cartas, filtros, coleção,
   tipos, detalhes de Pokémon, efeito holográfico e utilitários.
   ========================================================================== */

/* =========================================================================
   1. METADADOS
   ========================================================================= */

   const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
   const ARTWORK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
   const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
   
   const TYPES = {
     normal:   { pt: 'Normal',   color: '#A8A77A', color2: '#6b6a4a', icon: '⭐' },
     fire:     { pt: 'Fogo',     color: '#EE8130', color2: '#b32d00', icon: '🔥' },
     water:    { pt: 'Água',     color: '#6390F0', color2: '#1d4ed8', icon: '💧' },
     electric: { pt: 'Elétrico', color: '#F7D02C', color2: '#b45309', icon: '⚡' },
     grass:    { pt: 'Planta',   color: '#7AC74C', color2: '#15803d', icon: '🌿' },
     ice:      { pt: 'Gelo',     color: '#96D9D6', color2: '#0e7490', icon: '❄️' },
     fighting: { pt: 'Lutador',  color: '#C22E28', color2: '#7f1d1d', icon: '🥊' },
     poison:   { pt: 'Venenoso', color: '#A33EA1', color2: '#6b21a8', icon: '☠️' },
     ground:   { pt: 'Terra',    color: '#E2BF65', color2: '#a16207', icon: '⛰️' },
     flying:   { pt: 'Voador',   color: '#A98FF3', color2: '#4338ca', icon: '🪶' },
     psychic:  { pt: 'Psíquico', color: '#F95587', color2: '#be185d', icon: '🔮' },
     bug:      { pt: 'Inseto',   color: '#A6B91A', color2: '#4d7c0f', icon: '🐛' },
     rock:     { pt: 'Pedra',    color: '#B6A136', color2: '#78350f', icon: '🪨' },
     ghost:    { pt: 'Fantasma', color: '#735797', color2: '#4c1d95', icon: '👻' },
     dragon:   { pt: 'Dragão',   color: '#6F35FC', color2: '#3730a3', icon: '🐉' },
     dark:     { pt: 'Sombrio',  color: '#705746', color2: '#1f2937', icon: '🌑' },
     steel:    { pt: 'Aço',      color: '#B7B7CE', color2: '#475569', icon: '⚙️' },
     fairy:    { pt: 'Fada',     color: '#D685AD', color2: '#9d174d', icon: '✨' }
   };
   const TYPE_KEYS = Object.keys(TYPES);
   const DARK_TEXT_TYPES = ['electric','ice','steel','fairy','ground','normal','grass'];
   
   const GENERATION_RANGES = {
     1:[1,151], 2:[152,251], 3:[252,386], 4:[387,493], 5:[494,649],
     6:[650,721], 7:[722,809], 8:[810,905], 9:[906,1025]
   };
   
   const STAT_LABELS = {
     'hp':'HP', 'attack':'Attack', 'defense':'Defense',
     'special-attack':'Sp. Attack', 'special-defense':'Sp. Defense', 'speed':'Speed'
   };
   
   /* =========================================================================
      2. UTILITÁRIOS GERAIS
      ========================================================================= */
   
   function $(sel, ctx){ return (ctx||document).querySelector(sel); }
   function $$(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
   
   function el(tag, attrs, children){
     const node = document.createElement(tag);
     if (attrs){
       Object.keys(attrs).forEach(function(key){
         const value = attrs[key];
         if (value === null || value === undefined || value === false) return;
         if (key === 'class') node.className = value;
         else if (key === 'html') node.innerHTML = value;
         else if (key === 'text') node.textContent = value;
         else if (key === 'dataset'){
           Object.keys(value).forEach(function(k){ node.dataset[k] = value[k]; });
         }
         else if (key.startsWith('on') && typeof value === 'function'){
           node.addEventListener(key.slice(2).toLowerCase(), value);
         }
         else node.setAttribute(key, value);
       });
     }
     if (children){
       (Array.isArray(children) ? children : [children]).forEach(function(child){
         if (child === null || child === undefined || child === false) return;
         node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
       });
     }
     return node;
   }
   
   function pad3(id){ return '#' + String(id).padStart(3, '0'); }
   
   function prettyName(name){
     if (!name) return '';
     return String(name).split('-').map(function(part){
       if (part.length <= 2 && /^[a-z]+$/.test(part)) return part.toUpperCase();
       return part.charAt(0).toUpperCase() + part.slice(1);
     }).join(' ');
   }
   
   function debounce(fn, delay){
     let timer = null;
     return function(){
       const args = arguments, ctx = this;
       clearTimeout(timer);
       timer = setTimeout(function(){ fn.apply(ctx, args); }, delay);
     };
   }
   
   function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
   
   function idFromUrl(url){
     if (!url) return null;
     const m = String(url).match(/\/(\d+)\/?$/);
     return m ? Number(m[1]) : null;
   }
   
   async function mapLimit(items, limit, worker){
     const results = new Array(items.length).fill(null);
     let cursor = 0;
     const workers = [];
     const total = Math.min(limit, items.length);
     for (let w = 0; w < total; w++){
       workers.push((async function(){
         while (cursor < items.length){
           const i = cursor++;
           try { results[i] = await worker(items[i], i); }
           catch (err){ results[i] = null; }
         }
       })());
     }
     await Promise.all(workers);
     return results;
   }
   
   function applyTypeVars(node, typeKeys){
     const first = (typeKeys && typeKeys[0]) || 'normal';
     const meta = TYPES[first] || TYPES.normal;
     node.style.setProperty('--tc', meta.color);
     node.style.setProperty('--tc2', meta.color2);
     return node;
   }
   
   function typeBadge(typeKey, small){
     const meta = TYPES[typeKey] || { pt: prettyName(typeKey), color: '#5b7cff', color2: '#b14cff', icon: '❔' };
     const badge = el('span', {
       class: 'type-badge' + (small ? ' type-badge--sm' : '') +
              (DARK_TEXT_TYPES.indexOf(typeKey) === -1 ? ' type-badge--dark' : ''),
       title: meta.pt
     }, [
       el('span', { 'aria-hidden': 'true', text: meta.icon }),
       el('span', { text: meta.pt })
     ]);
     badge.style.setProperty('--tc', meta.color);
     badge.style.setProperty('--tc2', meta.color2);
     return badge;
   }
   
   function statColors(value){
     if (value >= 120) return ['#ff5fa2','#b14cff'];
     if (value >= 90)  return ['#ffcb05','#ff8a00'];
     if (value >= 60)  return ['#3ddc97','#ffcb05'];
     return ['#ff5470','#ff8a00'];
   }
   
   /* =========================================================================
      3. TOASTS
      ========================================================================= */
   
   const Toast = (function(){
     let stack = null;
     function ensureStack(){
       if (stack) return stack;
       stack = el('div', { class: 'toast-stack', 'aria-live': 'polite' });
       document.body.appendChild(stack);
       return stack;
     }
     function show(message, variant, duration){
       const container = ensureStack();
       const icons = { ok:'✅', warn:'⚠️', error:'❌', info:'ℹ️' };
       const node = el('div', { class: 'toast toast--' + (variant||'info'), role: 'status' }, [
         el('span', { 'aria-hidden': 'true', text: icons[variant] || icons.info }),
         el('span', { text: message })
       ]);
       container.appendChild(node);
       setTimeout(function(){
         node.classList.add('is-out');
         setTimeout(function(){ if (node.parentNode) node.parentNode.removeChild(node); }, 320);
       }, duration || 2600);
     }
     return {
       info:  function(m){ show(m, 'info'); },
       ok:    function(m){ show(m, 'ok'); },
       warn:  function(m){ show(m, 'warn'); },
       error: function(m){ show(m, 'error', 3600); }
     };
   })();
   
   /* =========================================================================
      4. FAVORITOS (localStorage)
      ========================================================================= */
   
   const Favorites = (function(){
     const KEY = 'pokedex:collection:v2';
     function read(){
       try {
         const raw = localStorage.getItem(KEY);
         if (!raw) return [];
         const parsed = JSON.parse(raw);
         if (!Array.isArray(parsed)) return [];
         return parsed.map(Number).filter(function(v){ return Number.isFinite(v) && v > 0; });
       } catch (e){ return []; }
     }
     function write(list){
       const unique = Array.from(new Set(list)).sort(function(a,b){ return a-b; });
       try { localStorage.setItem(KEY, JSON.stringify(unique)); }
       catch (e){ Toast.warn('Não foi possível salvar a coleção.'); }
       return unique;
     }
     return {
       all: read,
       has: function(id){ return read().indexOf(Number(id)) !== -1; },
       add: function(id){
         const list = read();
         if (list.indexOf(Number(id)) === -1) list.push(Number(id));
         return write(list);
       },
       remove: function(id){ return write(read().filter(function(i){ return i !== Number(id); })); },
       toggle: function(id){
         const n = Number(id);
         const list = read();
         const i = list.indexOf(n);
         if (i === -1) list.push(n); else list.splice(i, 1);
         return write(list);
       },
       clear: function(){ return write([]); }
     };
   })();
   
   /* =========================================================================
      5. CAMADA DA API
      ========================================================================= */
   
   const PokeAPI = (function(){
     const cache = new Map();
     const INDEX_KEY = 'pokedex:index:v2';
     const MAX_RETRIES = 2;
     const TOTAL_POKEMON = 1025;
   
     async function request(pathOrUrl){
       const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : POKEAPI_BASE + pathOrUrl;
       if (cache.has(url)) return cache.get(url);
       let lastError = null;
       for (let attempt = 0; attempt <= MAX_RETRIES; attempt++){
         try {
           const res = await fetch(url, { headers: { Accept: 'application/json' } });
           if (res.status === 404){
             const err = new Error('Recurso não encontrado.');
             err.code = 'NOT_FOUND';
             throw err;
           }
           if (!res.ok) throw new Error('HTTP ' + res.status);
           const data = await res.json();
           cache.set(url, data);
           return data;
         } catch (err){
           if (err && err.code === 'NOT_FOUND') throw err;
           lastError = err;
           if (attempt < MAX_RETRIES) await sleep(400 * (attempt + 1));
         }
       }
       const e = new Error('Falha ao conectar à PokéAPI.');
       e.code = 'NETWORK';
       e.cause = lastError;
       throw e;
     }
   
     async function getIndex(){
       try {
         const stored = localStorage.getItem(INDEX_KEY);
         if (stored){
           const parsed = JSON.parse(stored);
           if (Array.isArray(parsed) && parsed.length > 900) return parsed;
         }
       } catch (e){}
       const data = await request('/pokemon?limit=' + TOTAL_POKEMON);
       const list = (data.results || []).map(function(item){
         return { id: idFromUrl(item.url), name: item.name };
       }).filter(function(i){ return i.id !== null && i.id <= TOTAL_POKEMON; })
         .sort(function(a,b){ return a.id - b.id; });
       try { localStorage.setItem(INDEX_KEY, JSON.stringify(list)); } catch (e){}
       return list;
     }
   
     const getPokemon = (v) => request('/pokemon/' + String(v).toLowerCase().trim());
     const getSpecies = (v) => request('/pokemon-species/' + String(v).toLowerCase().trim());
     const getEvolutionChain = (v) => request(typeof v === 'string' && v.startsWith('http') ? v : '/evolution-chain/' + v);
     const getType = (v) => request('/type/' + String(v).toLowerCase().trim());
     const getMove = (v) => request(typeof v === 'string' && v.startsWith('http') ? v : '/move/' + String(v).toLowerCase().trim());
     const getAbility = (v) => request(typeof v === 'string' && v.startsWith('http') ? v : '/ability/' + String(v).toLowerCase().trim());
   
     function artworkUrl(id){ return ARTWORK_BASE + id + '.png'; }
   
     function bestArtwork(pokemon){
       if (!pokemon) return '';
       const art = pokemon.sprites && pokemon.sprites.other && pokemon.sprites.other['official-artwork']
         && pokemon.sprites.other['official-artwork'].front_default;
       if (art) return art;
       if (pokemon.sprites && pokemon.sprites.front_default) return pokemon.sprites.front_default;
       return artworkUrl(pokemon.id);
     }
   
     function smallSprite(pokemon){
       if (!pokemon) return '';
       if (pokemon.sprites && pokemon.sprites.front_default) return pokemon.sprites.front_default;
       return SPRITE_BASE + pokemon.id + '.png';
     }
   
     function flavorText(species){
       if (!species || !Array.isArray(species.flavor_text_entries)) return '';
       const langs = ['pt-BR','pt','en','es'];
       for (let i = 0; i < langs.length; i++){
         const entry = species.flavor_text_entries.find(function(item){
           return item.language && item.language.name === langs[i];
         });
         if (entry) return cleanFlavor(entry.flavor_text);
       }
       return '';
     }
     function cleanFlavor(text){
       return String(text).replace(/[\n\r\f\u00ad]/g,' ').replace(/\s+/g,' ').trim();
     }
     function genus(species){
       if (!species || !Array.isArray(species.genera)) return '';
       const e = species.genera.find(function(g){ return g.language && g.language.name === 'en'; }) || species.genera[0];
       return e ? e.genus : '';
     }
     function generationName(species){
       if (!species || !species.generation) return '';
       const map = {
         'generation-i':'Geração I', 'generation-ii':'Geração II', 'generation-iii':'Geração III',
         'generation-iv':'Geração IV', 'generation-v':'Geração V', 'generation-vi':'Geração VI',
         'generation-vii':'Geração VII', 'generation-viii':'Geração VIII', 'generation-ix':'Geração IX'
       };
       return map[species.generation.name] || species.generation.name;
     }
   
     return {
       request, getIndex, getPokemon, getSpecies, getEvolutionChain, getType, getMove, getAbility,
       artworkUrl, bestArtwork, smallSprite, flavorText, genus, generationName, TOTAL_POKEMON,
       clearCache: function(){ cache.clear(); }
     };
   })();
   
   /* =========================================================================
      6. CARD DE POKÉMON (reutilizável)
      ========================================================================= */
   
   function createPokemonCard(pokemon, options){
     const opts = options || {};
     if (!pokemon) return null;
   
     const typeKeys = (pokemon.types || []).map(function(t){ return t.type.name; });
     const hpStat = (pokemon.stats || []).find(function(s){ return s.stat.name === 'hp'; });
     const hp = hpStat ? hpStat.base_stat : 0;
     const name = prettyName(pokemon.name);
     const isFav = Favorites.has(pokemon.id);
   
     const favBtn = el('button', {
       class: 'fav-btn',
       type: 'button',
       'aria-pressed': isFav ? 'true' : 'false',
       'aria-label': (isFav ? 'Remover ' : 'Adicionar ') + name + ' dos favoritos',
       title: 'Favoritar'
     }, [document.createTextNode(isFav ? '♥' : '♡')]);
   
     favBtn.addEventListener('click', function(ev){
       ev.stopPropagation();
       ev.preventDefault();
       const list = Favorites.toggle(pokemon.id);
       const nowFav = list.indexOf(Number(pokemon.id)) !== -1;
       favBtn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
       favBtn.textContent = nowFav ? '♥' : '♡';
       favBtn.setAttribute('aria-label', (nowFav ? 'Remover ' : 'Adicionar ') + name + ' dos favoritos');
       Toast[nowFav ? 'ok' : 'info'](name + (nowFav ? ' adicionado à coleção!' : ' removido da coleção.'));
       document.dispatchEvent(new CustomEvent('collection:changed'));
   
       if (opts.album && !nowFav){
         const card = favBtn.closest('.pcard');
         if (card){
           card.style.transition = 'opacity .3s, transform .3s';
           card.style.opacity = '0';
           card.style.transform = 'scale(.92)';
           setTimeout(function(){
             if (card.parentNode) card.parentNode.removeChild(card);
             document.dispatchEvent(new CustomEvent('collection:changed'));
           }, 300);
         }
       }
     });
   
     const img = el('img', {
       src: PokeAPI.bestArtwork(pokemon),
       alt: 'Ilustração oficial de ' + name,
       loading: 'lazy', decoding: 'async', width: 200, height: 200
     });
     img.addEventListener('error', function(){ img.src = PokeAPI.artworkUrl(pokemon.id); });
   
     const typeRow = el('div', { class: 'pcard__types' });
     typeKeys.forEach(function(k){ typeRow.appendChild(typeBadge(k, true)); });
   
     const hpFill = el('span', { class: 'hp-fill' });
     hpFill.style.width = '0%';
   
     const card = el('article', {
       class: 'pcard' + (opts.album ? ' pcard--album' : ''),
       tabindex: '0',
       role: 'link',
       'aria-label': name + ', ' + pad3(pokemon.id),
       dataset: { id: pokemon.id }
     }, [
       el('div', { class: 'pcard__shine', 'aria-hidden': 'true' }),
       el('div', { class: 'pcard__top' }, [
         el('span', { class: 'pcard__num', text: pad3(pokemon.id) }),
         favBtn
       ]),
       el('div', { class: 'pcard__img' }, [img]),
       el('h3', { class: 'pcard__name', text: name }),
       typeRow,
       el('div', { class: 'pcard__hp' }, [
         el('span', { class: 'hp-label', text: 'HP' }),
         el('div', { class: 'hp-track' }, [hpFill]),
         el('span', { class: 'hp-value', text: String(hp) })
       ])
     ]);
   
     applyTypeVars(card, typeKeys);
   
     requestAnimationFrame(function(){
       setTimeout(function(){
         hpFill.style.width = Math.max(4, Math.min(100, Math.round((hp / 180) * 100))) + '%';
       }, 60);
     });
   
     function open(){ location.hash = '#pokemon?id=' + pokemon.id; }
     card.addEventListener('click', function(ev){
       if (ev.target.closest('.fav-btn')) return;
       open();
     });
     card.addEventListener('keydown', function(ev){
       if (ev.key === 'Enter' || ev.key === ' '){
         ev.preventDefault();
         open();
       }
     });
   
     return card;
   }
   
   /* =========================================================================
      7. SKELETONS / ESTADOS
      ========================================================================= */
   
   function renderCardSkeletons(container, amount){
     if (!container) return;
     container.innerHTML = '';
     const total = amount || 8;
     for (let i = 0; i < total; i++){
       container.appendChild(el('div', { class: 'skeleton skeleton--card', 'aria-hidden': 'true' }));
     }
   }
   
   function renderError(container, onRetry, message){
     if (!container) return;
     container.innerHTML = '';
     container.appendChild(el('div', { class: 'state-box', role: 'alert' }, [
       el('span', { class: 'state-box__icon', 'aria-hidden': 'true', text: '📡' }),
       el('h3', { text: 'Não conseguimos carregar os dados.' }),
       el('p', { text: message || 'Verifique sua conexão e tente novamente.' }),
       el('button', { class: 'btn btn--primary', type: 'button', onclick: onRetry },
         [document.createTextNode('Tentar novamente')])
     ]));
   }
   
   function renderState(container, icon, title, text, actionLabel, onAction){
     if (!container) return;
     container.innerHTML = '';
     const children = [
       el('span', { class: 'state-box__icon', 'aria-hidden': 'true', text: icon }),
       el('h3', { text: title }),
       el('p', { text: text })
     ];
     if (actionLabel && onAction){
       children.push(el('button', { class: 'btn btn--primary', type: 'button', onclick: onAction },
         [document.createTextNode(actionLabel)]));
     }
     container.appendChild(el('div', { class: 'state-box' }, children));
   }
   
   /* =========================================================================
      8. EFEITO HOLOGRÁFICO
      ========================================================================= */
   
   function initHoloTilt(card){
     if (!card) return;
     const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
     const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
     if (!fine || reduced) return;
   
     let rafId = null;
   
     function reset(){
       card.classList.remove('is-tilting');
       card.style.setProperty('--rx','0deg');
       card.style.setProperty('--ry','0deg');
       card.style.setProperty('--mx','50%');
       card.style.setProperty('--my','50%');
       card.style.setProperty('--gx','50%');
       card.style.setProperty('--gy','50%');
     }
   
     function onMove(ev){
       const rect = card.getBoundingClientRect();
       if (!rect.width || !rect.height) return;
       const px = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
       const py = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
       if (rafId) cancelAnimationFrame(rafId);
       rafId = requestAnimationFrame(function(){
         card.classList.add('is-tilting');
         card.style.setProperty('--rx', ((0.5 - py) * 16).toFixed(2) + 'deg');
         card.style.setProperty('--ry', ((px - 0.5) * 16).toFixed(2) + 'deg');
         card.style.setProperty('--mx', (px * 100).toFixed(2) + '%');
         card.style.setProperty('--my', (py * 100).toFixed(2) + '%');
         card.style.setProperty('--gx', ((1 - px) * 100).toFixed(2) + '%');
         card.style.setProperty('--gy', ((1 - py) * 100).toFixed(2) + '%');
       });
     }
   
     card.addEventListener('pointermove', onMove);
     card.addEventListener('pointerleave', function(){ if (rafId) cancelAnimationFrame(rafId); reset(); });
     card.addEventListener('pointercancel', reset);
   }
   
   /* =========================================================================
      9. HEADER E BUSCA GLOBAL
      ========================================================================= */
   
   function initHeaderUI(){
     const header = $('#siteHeader');
     const navToggle = $('#navToggle');
     const body = document.body;
   
     if (header){
       const onScroll = function(){ header.classList.toggle('is-scrolled', window.scrollY > 12); };
       onScroll();
       window.addEventListener('scroll', onScroll, { passive: true });
     }
   
     if (navToggle){
       navToggle.addEventListener('click', function(){
         const open = body.classList.toggle('nav-open');
         navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
         navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
       });
       $$('#mainNav a').forEach(function(a){
         a.addEventListener('click', function(){
           body.classList.remove('nav-open');
           navToggle.setAttribute('aria-expanded', 'false');
         });
       });
       document.addEventListener('click', function(ev){
         if (!body.classList.contains('nav-open')) return;
         if (ev.target.closest('#mainNav') || ev.target.closest('#navToggle')) return;
         body.classList.remove('nav-open');
         navToggle.setAttribute('aria-expanded', 'false');
       });
     }
   
     const year = $('#year');
     if (year) year.textContent = new Date().getFullYear();
   
     $$('#randomBtn, #randomBtnHero').forEach(function(btn){
       btn.addEventListener('click', goRandom);
     });
   
     initGlobalSearch();
   }
   
   let globalIndexPromise = null;
   
   function initGlobalSearch(){
     const input = $('#globalSearch');
     const results = $('#searchResults');
     if (!input || !results) return;
   
     let index = [];
   
     function loadIndex(){
       if (!globalIndexPromise){
         globalIndexPromise = PokeAPI.getIndex()
           .then(function(list){ index = list; return list; })
           .catch(function(){ return []; });
       }
       return globalIndexPromise;
     }
   
     function close(){
       results.hidden = true;
       input.setAttribute('aria-expanded', 'false');
       results.innerHTML = '';
     }
   
     function render(list, term){
       results.innerHTML = '';
       if (!list.length){
         results.appendChild(el('div', { class: 'search-empty', text: 'Nenhum Pokémon encontrado para "' + term + '".' }));
       } else {
         list.forEach(function(item){
           const name = prettyName(item.name);
           const btn = el('button', {
             class: 'search-item', type: 'button', role: 'option',
             'aria-label': name + ', número ' + item.id
           }, [
             el('img', { src: SPRITE_BASE + item.id + '.png', alt: '', loading: 'lazy', width: 44, height: 44 }),
             el('span', { class: 'search-item__info' }, [
               el('span', { class: 'search-item__name', text: name }),
               el('span', { class: 'search-item__num', text: pad3(item.id) })
             ])
           ]);
           btn.addEventListener('click', function(){
             close();
             location.hash = '#pokemon?id=' + item.id;
           });
           results.appendChild(btn);
         });
       }
       results.hidden = false;
       input.setAttribute('aria-expanded', 'true');
     }
   
     const doSearch = debounce(function(term){
       const q = term.trim().toLowerCase();
       if (q.length < 1){ close(); return; }
       const numeric = parseInt(q.replace(/[^0-9]/g,''), 10);
       const matches = index.filter(function(item){
         if (item.name.indexOf(q) !== -1) return true;
         if (!isNaN(numeric) && item.id === numeric) return true;
         return false;
       }).slice(0, 8);
       render(matches, term.trim());
     }, 220);
   
     input.addEventListener('focus', loadIndex);
     input.addEventListener('input', function(){ loadIndex(); doSearch(input.value); });
     input.addEventListener('keydown', function(ev){
       if (ev.key === 'Escape'){ close(); input.blur(); }
       if (ev.key === 'Enter'){
         ev.preventDefault();
         const term = input.value.trim();
         if (!term) return;
         close();
         location.hash = '#pokedex?q=' + encodeURIComponent(term);
       }
     });
   
     document.addEventListener('click', function(ev){
       if (!ev.target.closest('.global-search')) close();
     });
   
     document.addEventListener('route:changed', close);
   }
   
   /* =========================================================================
      10. POKÉMON ALEATÓRIO
      ========================================================================= */
   
   function goRandom(){
     const id = Math.floor(Math.random() * PokeAPI.TOTAL_POKEMON) + 1;
     const overlay = el('div', { class: 'random-overlay', role: 'status', 'aria-live': 'polite' }, [
       el('div', { class: 'random-overlay__ball', 'aria-hidden': 'true' }),
       el('p', { text: 'Sorteando um Pokémon...' })
     ]);
     document.body.appendChild(overlay);
     setTimeout(function(){
       location.hash = '#pokemon?id=' + id;
       setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
     }, 850);
   }
   
   /* =========================================================================
      11. HOME
      ========================================================================= */
   
   function initHome(){
     const popularGrid = $('#popularGrid');
     const typeChips = $('#typeChips');
     const featuredWrap = $('#featuredWrap');
   
     if (typeChips && !typeChips.dataset.done){
       typeChips.dataset.done = '1';
       TYPE_KEYS.forEach(function(key){
         const meta = TYPES[key];
         const chip = el('a', {
           class: 'type-chip', href: '#pokedex?type=' + key,
           'aria-label': 'Explorar Pokémon do tipo ' + meta.pt
         }, [
           el('span', { class: 'type-chip__icon', 'aria-hidden': 'true', text: meta.icon }),
           el('span', { text: meta.pt })
         ]);
         chip.style.setProperty('--tc', meta.color);
         chip.style.setProperty('--tc2', meta.color2);
         typeChips.appendChild(chip);
       });
     }
   
     if (featuredWrap){
       const featuredPool = [25, 6, 150, 448, 133, 384, 658, 887, 149, 94];
       const featuredId = featuredPool[Math.floor(Math.random() * featuredPool.length)];
       featuredWrap.innerHTML = '';
       featuredWrap.appendChild(el('div', { class: 'skeleton skeleton--card', 'aria-hidden': 'true' }));
   
       PokeAPI.getPokemon(featuredId)
         .then(function(pokemon){
           featuredWrap.innerHTML = '';
           const card = buildMiniHoloCard(pokemon);
           featuredWrap.appendChild(card);
           initHoloTilt(card);
         })
         .catch(function(){
           featuredWrap.innerHTML = '';
           featuredWrap.appendChild(el('div', {
             class: 'state-box',
             html: '<span class="state-box__icon">📡</span><h3>Destaque indisponível</h3><p>Tente recarregar a página.</p>'
           }));
         });
     }
   
     if (popularGrid){
       const popularIds = [25, 6, 9, 3, 150, 448, 133, 143, 94, 130, 149, 658];
       renderCardSkeletons(popularGrid, 8);
       mapLimit(popularIds, 5, function(id){ return PokeAPI.getPokemon(id); })
         .then(function(list){
           const valid = list.filter(Boolean);
           if (!valid.length){
             renderError(popularGrid, initHome, 'Não conseguimos carregar os Pokémon populares.');
             return;
           }
           popularGrid.innerHTML = '';
           valid.forEach(function(p){
             const card = createPokemonCard(p, {});
             if (card) popularGrid.appendChild(card);
           });
         })
         .catch(function(){
           renderError(popularGrid, initHome, 'Não conseguimos carregar os Pokémon populares.');
         });
     }
   }
   
   function buildMiniHoloCard(pokemon){
     const typeKeys = (pokemon.types || []).map(function(t){ return t.type.name; });
     const hpStat = (pokemon.stats || []).find(function(s){ return s.stat.name === 'hp'; });
     const name = prettyName(pokemon.name);
   
     const img = el('img', {
       src: PokeAPI.bestArtwork(pokemon),
       alt: 'Carta de ' + name,
       width: 300, height: 300, decoding: 'async'
     });
     img.addEventListener('error', function(){ img.src = PokeAPI.artworkUrl(pokemon.id); });
   
     const typeRow = el('div', { class: 'card-types' });
     typeKeys.forEach(function(k){ typeRow.appendChild(typeBadge(k)); });
   
     const card = el('div', { class: 'holo-card', dataset: { id: pokemon.id } }, [
       el('div', { class: 'holo-card__inner' }, [
         el('div', { class: 'holo-layer holo-rainbow', 'aria-hidden': 'true' }),
         el('div', { class: 'holo-layer holo-shine', 'aria-hidden': 'true' }),
         el('div', { class: 'holo-layer holo-sparkle', 'aria-hidden': 'true' }),
         el('div', { class: 'holo-border', 'aria-hidden': 'true' }),
         el('div', { class: 'card-body' }, [
           el('div', { class: 'card-head' }, [
             el('div', { class: 'card-head__name', text: name }),
             el('div', { class: 'card-head__hp' }, [
               el('span', { class: 'hp-word', text: 'HP' }),
               document.createTextNode(String(hpStat ? hpStat.base_stat : '--'))
             ])
           ]),
           typeRow,
           el('div', { class: 'card-art' }, [img]),
           el('div', { class: 'card-subtitle', text: pad3(pokemon.id) + ' • Carta colecionável' })
         ])
       ])
     ]);
   
     applyTypeVars(card, typeKeys);
     card.style.cursor = 'pointer';
     card.addEventListener('click', function(){
       location.hash = '#pokemon?id=' + pokemon.id;
     });
     return card;
   }
   
   /* =========================================================================
      12. POKÉDEX
      ========================================================================= */
   
   const PokedexPage = (function(){
     const PAGE_SIZE = 24;
     const STAT_SORT_CAP = 200;
   
     const state = {
       mounted: false,
       index: [],
       details: new Map(),
       filtered: [],
       rendered: 0,
       busy: false,
       filters: { q: '', type: '', gen: '', sort: 'number' },
       observer: null
     };
   
     let grid, countEl, hintEl, searchInput, filterType, filterGen, filterSort, clearBtn, loadMoreBtn, sentinel;
   
     function mount(){
       grid = $('#dexGrid');
       countEl = $('#dexCount');
       hintEl = $('#dexHint');
       searchInput = $('#dexSearch');
       filterType = $('#filterType');
       filterGen = $('#filterGen');
       filterSort = $('#filterSort');
       clearBtn = $('#clearFilters');
       loadMoreBtn = $('#loadMore');
       sentinel = $('#dexSentinel');
   
       if (!grid) return;
   
       if (!state.mounted){
         state.mounted = true;
         populateTypeSelect();
         bind();
       }
     }
   
     function populateTypeSelect(){
       if (!filterType || filterType.dataset.done) return;
       filterType.dataset.done = '1';
       TYPE_KEYS.forEach(function(key){
         const meta = TYPES[key];
         const opt = document.createElement('option');
         opt.value = key;
         opt.textContent = meta.icon + ' ' + meta.pt;
         filterType.appendChild(opt);
       });
     }
   
     function bind(){
       const onSearch = debounce(function(value){
         state.filters.q = value;
         applyFilters();
       }, 320);
   
       searchInput.addEventListener('input', function(){ onSearch(searchInput.value); });
       filterType.addEventListener('change', function(){ state.filters.type = filterType.value; applyFilters(); });
       filterGen.addEventListener('change', function(){ state.filters.gen = filterGen.value; applyFilters(); });
       filterSort.addEventListener('change', function(){ state.filters.sort = filterSort.value; applyFilters(); });
   
       clearBtn.addEventListener('click', function(){
         state.filters = { q: '', type: '', gen: '', sort: 'number' };
         searchInput.value = '';
         filterType.value = '';
         filterGen.value = '';
         filterSort.value = 'number';
         applyFilters();
         Toast.info('Filtros limpos.');
       });
   
       loadMoreBtn.addEventListener('click', renderNextPage);
   
       if ('IntersectionObserver' in window && sentinel){
         state.observer = new IntersectionObserver(function(entries){
           entries.forEach(function(entry){
             if (entry.isIntersecting && !loadMoreBtn.hidden && !state.busy){
               renderNextPage();
             }
           });
         }, { rootMargin: '400px 0px' });
         state.observer.observe(sentinel);
       }
     }
   
     function readParams(params){
       state.filters = { q: '', type: '', gen: '', sort: 'number' };
       if (filterType) filterType.value = '';
       if (filterGen) filterGen.value = '';
       if (filterSort) filterSort.value = 'number';
       if (searchInput) searchInput.value = '';
   
       const type = params.get('type');
       const gen = params.get('gen');
       const q = params.get('q');
       const sort = params.get('sort');
   
       if (type && TYPES[type]){ state.filters.type = type; filterType.value = type; }
       if (gen && GENERATION_RANGES[gen]){ state.filters.gen = gen; filterGen.value = gen; }
       if (q){ state.filters.q = q; searchInput.value = q; }
       if (sort){
         const valid = Array.prototype.some.call(filterSort.options, function(o){ return o.value === sort; });
         if (valid){ state.filters.sort = sort; filterSort.value = sort; }
       }
     }
   
     async function init(params){
       mount();
       if (!grid) return;
       readParams(params);
   
       renderCardSkeletons(grid, 12);
       countEl.textContent = 'Carregando Pokédex...';
       hintEl.textContent = '';
   
       try {
         if (!state.index.length){
           state.index = await PokeAPI.getIndex();
         }
         await applyFilters();
       } catch (err){
         countEl.textContent = '';
         renderError(grid, function(){ init(params); }, 'Não conseguimos carregar a lista de Pokémon.');
       }
     }
   
     async function applyFilters(){
       state.rendered = 0;
       grid.innerHTML = '';
       renderCardSkeletons(grid, 12);
       hintEl.textContent = '';
       countEl.textContent = 'Filtrando...';
   
       let list = state.index.slice();
   
       /* tipo */
       if (state.filters.type){
         try {
           const typeData = await PokeAPI.getType(state.filters.type);
           const ids = new Set((typeData.pokemon || [])
             .map(function(e){ return idFromUrl(e.pokemon.url); })
             .filter(function(id){ return id && id <= PokeAPI.TOTAL_POKEMON; }));
           list = list.filter(function(i){ return ids.has(i.id); });
         } catch (e){
           countEl.textContent = '';
           renderError(grid, applyFilters, 'Não conseguimos carregar esse tipo agora.');
           return;
         }
       }
   
       /* geração */
       if (state.filters.gen){
         const range = GENERATION_RANGES[state.filters.gen];
         if (range) list = list.filter(function(i){ return i.id >= range[0] && i.id <= range[1]; });
       }
   
       /* busca textual */
       const query = state.filters.q.trim().toLowerCase();
       if (query){
         const numeric = parseInt(query.replace(/[^0-9]/g,''), 10);
         const typeMatch = TYPE_KEYS.find(function(k){
           return k === query || TYPES[k].pt.toLowerCase() === query;
         });
   
         if (typeMatch){
           try {
             const typeData = await PokeAPI.getType(typeMatch);
             const ids = new Set((typeData.pokemon || [])
               .map(function(e){ return idFromUrl(e.pokemon.url); })
               .filter(function(id){ return id && id <= PokeAPI.TOTAL_POKEMON; }));
             list = list.filter(function(i){ return ids.has(i.id); });
           } catch (e){}
         } else {
           list = list.filter(function(i){
             if (i.name.indexOf(query) !== -1) return true;
             if (!isNaN(numeric) && i.id === numeric) return true;
             return false;
           });
         }
       }
   
       /* ordenação */
       list = await sortList(list, state.filters.sort);
   
       state.filtered = list;
   
       if (!list.length){
         countEl.textContent = '0 Pokémon encontrados';
         renderState(grid, '🔍', 'Nenhum Pokémon encontrado',
           'Tente ajustar a busca ou limpar os filtros para ver mais resultados.',
           'Limpar filtros', function(){ clearBtn.click(); });
         loadMoreBtn.hidden = true;
         return;
       }
   
       updateCount();
       renderNextPage();
     }
   
     async function sortList(list, sort){
       const sorted = list.slice();
       if (sort === 'number'){ sorted.sort(function(a,b){ return a.id - b.id; }); return sorted; }
       if (sort === 'number-desc'){ sorted.sort(function(a,b){ return b.id - a.id; }); return sorted; }
       if (sort === 'name'){ sorted.sort(function(a,b){ return a.name.localeCompare(b.name); }); return sorted; }
       if (sort === 'name-desc'){ sorted.sort(function(a,b){ return b.name.localeCompare(a.name); }); return sorted; }
   
       const statKey = sort === 'total' ? 'total' : sort;
       const capped = sorted.length > STAT_SORT_CAP;
       const subset = capped ? sorted.slice(0, STAT_SORT_CAP) : sorted;
   
       countEl.textContent = 'Ordenando por ' + statKey + '...';
   
       const details = await fetchDetails(subset.map(function(i){ return i.id; }));
   
       const withStats = subset.map(function(item, idx){
         return { item: item, detail: details[idx] };
       }).filter(function(e){ return e.detail; });
   
       withStats.sort(function(a,b){ return statValue(b.detail, statKey) - statValue(a.detail, statKey); });
   
       const result = withStats.map(function(e){ return e.item; });
   
       if (capped){
         hintEl.textContent = 'Ordenação aplicada aos primeiros ' + STAT_SORT_CAP +
           ' resultados para manter a performance. Refine os filtros para ordenar todo o conjunto.';
         const rest = sorted.slice(STAT_SORT_CAP).sort(function(a,b){ return a.id - b.id; });
         return result.concat(rest);
       }
   
       hintEl.textContent = '';
       return result;
     }
   
     function statValue(detail, key){
       if (!detail || !detail.stats) return 0;
       if (key === 'total'){
         return detail.stats.reduce(function(s, e){ return s + e.base_stat; }, 0);
       }
       const f = detail.stats.find(function(s){ return s.stat.name === key; });
       return f ? f.base_stat : 0;
     }
   
     async function fetchDetails(ids){
       const missing = ids.filter(function(id){ return !state.details.has(id); });
       if (missing.length){
         const fetched = await mapLimit(missing, 8, function(id){ return PokeAPI.getPokemon(id); });
         fetched.forEach(function(d){ if (d) state.details.set(d.id, d); });
       }
       return ids.map(function(id){ return state.details.get(id) || null; });
     }
   
     async function renderNextPage(){
       if (state.busy) return;
       if (state.rendered >= state.filtered.length) return;
   
       state.busy = true;
       loadMoreBtn.disabled = true;
       loadMoreBtn.textContent = 'Carregando...';
   
       const slice = state.filtered.slice(state.rendered, state.rendered + PAGE_SIZE);
   
       if (state.rendered === 0){
         $$('.skeleton', grid).forEach(function(n){ n.remove(); });
       }
   
       const placeholders = [];
       for (let i = 0; i < slice.length; i++){
         const ph = el('div', { class: 'skeleton skeleton--card', 'aria-hidden': 'true' });
         grid.appendChild(ph);
         placeholders.push(ph);
       }
   
       const details = await fetchDetails(slice.map(function(i){ return i.id; }));
       placeholders.forEach(function(n){ n.remove(); });
   
       details.forEach(function(d){
         if (!d) return;
         const c = createPokemonCard(d, {});
         if (c) grid.appendChild(c);
       });
   
       state.rendered += slice.length;
       updateCount();
   
       loadMoreBtn.disabled = false;
       loadMoreBtn.textContent = 'Carregar mais';
       loadMoreBtn.hidden = state.rendered >= state.filtered.length;
   
       state.busy = false;
     }
   
     function updateCount(){
       const showing = Math.min(state.rendered, state.filtered.length);
       countEl.textContent = 'Mostrando ' + showing + ' de ' + state.filtered.length + ' Pokémon';
     }
   
     return { init: init };
   })();
   
   /* =========================================================================
      13. DETALHE DO POKÉMON
      ========================================================================= */
   
   const PokemonPage = (function(){
     const MAX_MOVES = 12;
   
     function rarityOf(total){
       if (total >= 600) return { key: 'lendario', label: '★ Lendário' };
       if (total >= 500) return { key: 'epico', label: '◆ Épico' };
       if (total >= 400) return { key: 'raro', label: '● Raro' };
       if (total >= 300) return { key: 'incomum', label: '○ Incomum' };
       return { key: 'comum', label: '· Comum' };
     }
   
     function retreatCostOf(pokemon){
       const speed = (pokemon.stats || []).find(function(s){ return s.stat.name === 'speed'; });
       const v = speed ? speed.base_stat : 50;
       if (v >= 110) return 0;
       if (v >= 85) return 1;
       if (v >= 60) return 2;
       if (v >= 40) return 3;
       return 4;
     }
   
     function computeMatchups(typeData){
       const mult = {};
       typeData.forEach(function(type){
         const rel = type.damage_relations || {};
         (rel.double_damage_from || []).forEach(function(t){ mult[t.name] = (mult[t.name] || 1) * 2; });
         (rel.half_damage_from || []).forEach(function(t){ mult[t.name] = (mult[t.name] || 1) * 0.5; });
         (rel.no_damage_from || []).forEach(function(t){ mult[t.name] = (mult[t.name] || 1) * 0; });
       });
       const weaknesses = [], resistances = [], immunities = [];
       Object.keys(mult).forEach(function(name){
         const v = mult[name];
         if (v > 1) weaknesses.push({ name, value: v });
         else if (v === 0) immunities.push({ name, value: v });
         else if (v < 1) resistances.push({ name, value: v });
       });
       weaknesses.sort(function(a,b){ return b.value - a.value; });
       return { weaknesses, resistances, immunities };
     }
   
     const root = () => $('#pokemonContent');
     const crumb = () => $('#crumbName');
   
     async function init(params){
       const rootEl = root();
       if (!rootEl) return;
   
       const idParam = params.get('id');
       const nameParam = params.get('name');
       const query = (idParam && /^\d+$/.test(idParam)) ? Number(idParam) : (nameParam || 1);
   
       renderLoading();
       if (crumb()) crumb().textContent = 'Carregando...';
   
       try {
         const pokemon = await PokeAPI.getPokemon(query);
         const name = prettyName(pokemon.name);
         if (crumb()) crumb().textContent = name;
         document.title = name + ' — Carta Pokémon';
   
         const speciesName = (pokemon.species && pokemon.species.name) || pokemon.id;
   
         const [species, typeDataArr] = await Promise.all([
           PokeAPI.getSpecies(speciesName).catch(function(){ return null; }),
           mapLimit((pokemon.types || []).map(function(t){ return t.type.name; }), 2,
             function(n){ return PokeAPI.getType(n); })
         ]);
   
         const typeData = typeDataArr.filter(Boolean);
   
         let evolution = null;
         if (species && species.evolution_chain && species.evolution_chain.url){
           evolution = await PokeAPI.getEvolutionChain(species.evolution_chain.url).catch(function(){ return null; });
         }
   
         renderDetail(pokemon, species, typeData, evolution);
   
       } catch (err){
         const message = err && err.code === 'NOT_FOUND'
           ? 'Não encontramos esse Pokémon. Verifique o número ou o nome.'
           : 'Não conseguimos carregar os dados deste Pokémon.';
         renderError(rootEl, function(){ init(params); }, message);
       }
     }
   
     function renderLoading(){
       const rootEl = root();
       rootEl.innerHTML = '';
       rootEl.appendChild(el('div', { class: 'detail-layout' }, [
         el('div', { class: 'detail-col detail-card-col' }, [
           el('div', { class: 'skeleton skeleton--card', 'aria-hidden': 'true' })
         ]),
         el('div', { class: 'detail-col' }, [
           el('div', { class: 'skeleton skeleton--block', 'aria-hidden': 'true' }),
           el('div', { class: 'panel' }, [
             el('div', { class: 'skeleton skeleton--line', 'aria-hidden': 'true' }),
             el('div', { class: 'skeleton skeleton--stat', 'aria-hidden': 'true' }),
             el('div', { class: 'skeleton skeleton--stat', 'aria-hidden': 'true' }),
             el('div', { class: 'skeleton skeleton--stat', 'aria-hidden': 'true' }),
             el('div', { class: 'skeleton skeleton--stat', 'aria-hidden': 'true' })
           ])
         ])
       ]));
     }
   
     function renderDetail(pokemon, species, typeData, evolution){
       const rootEl = root();
       rootEl.innerHTML = '';
   
       const typeKeys = (pokemon.types || []).map(function(t){ return t.type.name; });
       const name = prettyName(pokemon.name);
       const matchups = computeMatchups(typeData);
   
       const stats = (pokemon.stats || []).map(function(e){
         return { key: e.stat.name, label: STAT_LABELS[e.stat.name] || e.stat.name, value: e.base_stat };
       });
       const total = stats.reduce(function(s, e){ return s + e.value; }, 0);
       const rarity = rarityOf(total);
       const retreat = retreatCostOf(pokemon);
   
       const layout = el('div', { class: 'detail-layout' });
   
       /* -------- coluna esquerda -------- */
       const leftCol = el('div', { class: 'detail-col detail-card-col' });
       const stage = el('div', { class: 'holo-stage' });
       const card = buildHoloCard(pokemon, species, typeKeys, matchups, retreat, rarity);
       stage.appendChild(card);
       leftCol.appendChild(stage);
   
       const favBtn = el('button', {
         class: 'btn btn--primary', type: 'button',
         'aria-pressed': Favorites.has(pokemon.id) ? 'true' : 'false'
       }, [document.createTextNode(Favorites.has(pokemon.id) ? '♥ Na coleção' : '♡ Adicionar à coleção')]);
   
       favBtn.addEventListener('click', function(){
         const list = Favorites.toggle(pokemon.id);
         const isFav = list.indexOf(Number(pokemon.id)) !== -1;
         favBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
         favBtn.textContent = isFav ? '♥ Na coleção' : '♡ Adicionar à coleção';
         Toast[isFav ? 'ok' : 'info'](name + (isFav ? ' adicionado à coleção!' : ' removido da coleção.'));
         document.dispatchEvent(new CustomEvent('collection:changed'));
       });
       leftCol.appendChild(favBtn);
   
       leftCol.appendChild(el('span', {
         class: 'rarity-badge',
         dataset: { rarity: rarity.key },
         text: rarity.label + ' • Total ' + total
       }));
   
       layout.appendChild(leftCol);
   
       /* -------- coluna direita -------- */
       const rightCol = el('div', { class: 'detail-col' });
   
       rightCol.appendChild(el('div', {}, [
         el('span', { class: 'eyebrow', text: PokeAPI.generationName(species) || 'Pokémon' }),
         el('h1', { text: name }),
         el('div', { class: 'pcard__types', style: 'margin-top:.4rem' },
           typeKeys.map(function(k){ return typeBadge(k); }))
       ]));
   
       /* ficha */
       const infoList = el('ul', { class: 'info-list' });
       [
         { label: 'Número', value: pad3(pokemon.id) },
         { label: 'Altura', value: (pokemon.height / 10).toFixed(1) + ' m' },
         { label: 'Peso', value: (pokemon.weight / 10).toFixed(1) + ' kg' },
         { label: 'Espécie', value: PokeAPI.genus(species) || '—' },
         { label: 'Geração', value: PokeAPI.generationName(species) || '—' },
         { label: 'Base XP', value: String(pokemon.base_experience || '—') }
       ].forEach(function(item){
         infoList.appendChild(el('li', {}, [
           el('span', { class: 'label', text: item.label }),
           el('span', { class: 'value', text: item.value })
         ]));
       });
   
       rightCol.appendChild(el('section', { class: 'panel' }, [
         el('h2', { class: 'panel__title' }, [
           el('span', { 'aria-hidden': 'true', text: '📋' }),
           document.createTextNode('Ficha técnica')
         ]),
         infoList
       ]));
   
       /* estatísticas */
       const statsPanel = el('section', { class: 'panel' }, [
         el('h2', { class: 'panel__title' }, [
           el('span', { 'aria-hidden': 'true', text: '📊' }),
           document.createTextNode('Estatísticas base')
         ])
       ]);
   
       const bars = [];
       stats.forEach(function(stat){
         const colors = statColors(stat.value);
         const fill = el('span', { class: 'stat-row__fill' });
         fill.style.setProperty('--bar-a', colors[0]);
         fill.style.setProperty('--bar-b', colors[1]);
   
         statsPanel.appendChild(el('div', { class: 'stat-row' }, [
           el('span', { class: 'stat-row__name', text: stat.label }),
           el('div', { class: 'stat-row__track', role: 'progressbar',
             'aria-valuemin': '0', 'aria-valuemax': '255', 'aria-valuenow': String(stat.value),
             'aria-label': stat.label }, [fill]),
           el('span', { class: 'stat-row__value', text: String(stat.value) })
         ]));
         bars.push({ fill: fill, value: stat.value });
       });
   
       statsPanel.appendChild(el('div', { class: 'stat-total' }, [
         el('span', { text: 'Total' }),
         el('strong', { text: String(total) })
       ]));
   
       rightCol.appendChild(statsPanel);
   
       /* habilidades */
       const abilitiesPanel = el('section', { class: 'panel' }, [
         el('h2', { class: 'panel__title' }, [
           el('span', { 'aria-hidden': 'true', text: '✨' }),
           document.createTextNode('Habilidades')
         ])
       ]);
   
       (pokemon.abilities || []).forEach(function(entry){
         const cardEl = el('article', { class: 'ability-card' }, [
           el('div', { class: 'ability-card__icon', 'aria-hidden': 'true', text: '🔮' }),
           el('div', { class: 'ability-card__body' }, [
             el('h3', { class: 'ability-card__name' }, [
               document.createTextNode(prettyName(entry.ability.name)),
               entry.is_hidden ? el('span', { class: 'ability-card__hidden', text: 'Oculta' }) : null
             ]),
             el('p', { class: 'ability-card__desc', text: 'Carregando descrição...' })
           ])
         ]);
         abilitiesPanel.appendChild(cardEl);
   
         PokeAPI.getAbility(entry.ability.name)
           .then(function(detail){
             const desc = (detail.effect_entries || []).find(function(e){ return e.language.name === 'en'; });
             const short = (detail.flavor_text_entries || []).find(function(e){ return e.language.name === 'en'; });
             let text = '';
             if (desc && desc.effect) text = desc.effect;
             else if (short && short.flavor_text) text = short.flavor_text;
             else text = 'Sem descrição disponível para esta habilidade.';
             const node = cardEl.querySelector('.ability-card__desc');
             if (node) node.textContent = text.replace(/\s+/g, ' ').trim();
           })
           .catch(function(){
             const node = cardEl.querySelector('.ability-card__desc');
             if (node) node.textContent = 'Não foi possível carregar a descrição desta habilidade.';
           });
       });
   
       rightCol.appendChild(abilitiesPanel);
   
       /* movimentos */
       const movesPanel = el('section', { class: 'panel' }, [
         el('h2', { class: 'panel__title' }, [
           el('span', { 'aria-hidden': 'true', text: '⚔️' }),
           document.createTextNode('Movimentos')
         ]),
         el('div', { class: 'moves-grid', id: 'movesGrid' }, [
           el('div', { class: 'skeleton skeleton--block', 'aria-hidden': 'true' })
         ])
       ]);
       rightCol.appendChild(movesPanel);
   
       /* evoluções */
       if (evolution){
         rightCol.appendChild(el('section', { class: 'panel' }, [
           el('h2', { class: 'panel__title' }, [
             el('span', { 'aria-hidden': 'true', text: '🧬' }),
             document.createTextNode('Linha evolutiva')
           ]),
           el('div', { class: 'evo-chain', id: 'evoChain' })
         ]));
       }
   
       layout.appendChild(rightCol);
       rootEl.appendChild(layout);
   
       /* barra animada */
       requestAnimationFrame(function(){
         setTimeout(function(){
           bars.forEach(function(b){
             b.fill.style.width = Math.max(3, Math.min(100, Math.round((b.value / 180) * 100))) + '%';
           });
         }, 120);
       });
   
       /* holo */
       initHoloTilt(card);
   
       /* movimentos + evolução */
       loadMoves(pokemon);
       if (evolution) renderEvolution(evolution.chain, pokemon.id);
     }
   
     function buildHoloCard(pokemon, species, typeKeys, matchups, retreat, rarity){
       const name = prettyName(pokemon.name);
       const hpStat = (pokemon.stats || []).find(function(s){ return s.stat.name === 'hp'; });
       const hp = hpStat ? hpStat.base_stat : '--';
   
       const img = el('img', {
         src: PokeAPI.bestArtwork(pokemon),
         alt: 'Ilustração oficial de ' + name,
         width: 440, height: 440, decoding: 'async'
       });
       img.addEventListener('error', function(){ img.src = PokeAPI.artworkUrl(pokemon.id); });
   
       const typeRow = el('div', { class: 'card-types' });
       typeKeys.forEach(function(k){ typeRow.appendChild(typeBadge(k)); });
   
       const abilitiesSection = el('div', { class: 'card-section' }, [
         el('div', { class: 'card-section__title' }, [document.createTextNode('Habilidades')])
       ]);
       (pokemon.abilities || []).slice(0, 3).forEach(function(entry){
         abilitiesSection.appendChild(el('div', { class: 'card-ability' }, [
           el('span', { class: 'card-ability__icon', 'aria-hidden': 'true', text: entry.is_hidden ? '🌟' : '🔮' }),
           el('span', {}, [
             el('span', { class: 'card-ability__name', text: prettyName(entry.ability.name) }),
             el('span', { class: 'card-ability__desc', text: entry.is_hidden ? 'Habilidade oculta' : 'Habilidade padrão' })
           ])
         ]));
       });
   
       const attacksSection = el('div', { class: 'card-section' }, [
         el('div', { class: 'card-section__title' }, [document.createTextNode('Ataques')])
       ]);
       const topMoves = (pokemon.moves || []).slice(0, 2);
       if (!topMoves.length){
         attacksSection.appendChild(el('div', { class: 'card-attack' }, [
           el('div', { class: 'card-attack__meta', text: 'Nenhum movimento registrado.' })
         ]));
       } else {
         topMoves.forEach(function(entry){
           const cost = el('span', { class: 'card-attack__cost' });
           for (let i = 0; i < 2; i++){
             const e = el('span', { class: 'energy', 'aria-hidden': 'true' });
             e.style.setProperty('--tc', (TYPES[typeKeys[0]] || TYPES.normal).color);
             cost.appendChild(e);
           }
           attacksSection.appendChild(el('div', { class: 'card-attack' }, [
             el('div', { class: 'card-attack__top' }, [
               cost,
               el('span', { class: 'card-attack__name', text: prettyName(entry.move.name) }),
               el('span', { class: 'card-attack__power', text: '—' })
             ]),
             el('div', { class: 'card-attack__meta', text: 'Movimento aprendido' })
           ]));
         });
       }
   
       const weaknessValues = el('div', { class: 'values' });
       if (matchups.weaknesses.length){
         matchups.weaknesses.slice(0, 3).forEach(function(item){
           const meta = TYPES[item.name];
           weaknessValues.appendChild(el('span', { class: 'pip' }, [
             el('span', { 'aria-hidden': 'true', text: meta ? meta.icon : '❔' }),
             document.createTextNode('×' + item.value)
           ]));
         });
       } else {
         weaknessValues.appendChild(el('span', { class: 'pip', text: '—' }));
       }
   
       const resistValues = el('div', { class: 'values' });
       const allResist = matchups.resistances.concat(matchups.immunities);
       if (allResist.length){
         allResist.slice(0, 3).forEach(function(item){
           const meta = TYPES[item.name];
           resistValues.appendChild(el('span', { class: 'pip' }, [
             el('span', { 'aria-hidden': 'true', text: meta ? meta.icon : '❔' }),
             document.createTextNode(item.value === 0 ? '×0' : '×½')
           ]));
         });
       } else {
         resistValues.appendChild(el('span', { class: 'pip', text: '—' }));
       }
   
       const retreatWrap = el('div', { class: 'retreat-cost' });
       for (let i = 0; i < 4; i++){
         retreatWrap.appendChild(el('span', {
           class: 'retreat-star' + (i < retreat ? ' is-on' : ''),
           'aria-hidden': 'true'
         }));
       }
   
       const footer = el('div', { class: 'card-footer' }, [
         el('div', { class: 'card-footer__col' }, [
           el('span', { class: 'label', text: 'Fraquezas' }),
           weaknessValues
         ]),
         el('div', { class: 'card-footer__col' }, [
           el('span', { class: 'label', text: 'Resistências' }),
           resistValues
         ]),
         el('div', { class: 'card-footer__col' }, [
           el('span', { class: 'label', text: 'Custo de recuo' }),
           retreatWrap
         ])
       ]);
   
       const flavor = PokeAPI.flavorText(species) || 'Este Pokémon ainda não possui uma descrição registrada na Pokédex.';
   
       const card = el('article', {
         class: 'holo-card',
         'aria-label': 'Carta colecionável de ' + name
       }, [
         el('div', { class: 'holo-card__inner' }, [
           el('div', { class: 'holo-layer holo-rainbow', 'aria-hidden': 'true' }),
           el('div', { class: 'holo-layer holo-shine', 'aria-hidden': 'true' }),
           el('div', { class: 'holo-layer holo-sparkle', 'aria-hidden': 'true' }),
           el('div', { class: 'holo-border', 'aria-hidden': 'true' }),
           el('div', { class: 'card-body' }, [
             el('header', { class: 'card-head' }, [
               el('div', { class: 'card-head__name', text: name }),
               el('div', { class: 'card-head__hp' }, [
                 el('span', { class: 'hp-word', text: 'HP' }),
                 document.createTextNode(String(hp))
               ])
             ]),
             typeRow,
             el('div', { class: 'card-art' }, [img]),
             el('div', { class: 'card-subtitle', text: pad3(pokemon.id) + ' • ' + rarity.label }),
             abilitiesSection,
             attacksSection,
             footer,
             el('p', { class: 'card-flavor', text: flavor })
           ])
         ])
       ]);
   
       applyTypeVars(card, typeKeys);
       return card;
     }
   
     async function loadMoves(pokemon){
       const grid = document.getElementById('movesGrid');
       if (!grid) return;
   
       const moves = (pokemon.moves || []).slice(0, MAX_MOVES);
   
       if (!moves.length){
         grid.innerHTML = '';
         grid.appendChild(el('p', { class: 'ability-card__desc', text: 'Nenhum movimento registrado para este Pokémon.' }));
         return;
       }
   
       const details = await mapLimit(moves, 6, function(entry){
         return PokeAPI.getMove(entry.move.name);
       });
   
       grid.innerHTML = '';
       let rendered = 0;
   
       details.forEach(function(move){
         if (!move) return;
         rendered++;
         const moveType = (move.type && move.type.name) || 'normal';
         const meta = TYPES[moveType] || TYPES.normal;
   
         const cardEl = el('article', { class: 'move-card' }, [
           el('div', { class: 'move-card__head' }, [
             el('h3', { class: 'move-card__name', text: prettyName(move.name) }),
             typeBadge(moveType, true)
           ]),
           el('div', { class: 'move-card__stats' }, [
             el('div', { class: 'move-card__stat' }, [
               el('span', { text: 'Poder' }),
               el('strong', { text: move.power ? String(move.power) : '—' })
             ]),
             el('div', { class: 'move-card__stat' }, [
               el('span', { text: 'Precisão' }),
               el('strong', { text: move.accuracy ? move.accuracy + '%' : '—' })
             ]),
             el('div', { class: 'move-card__stat' }, [
               el('span', { text: 'PP' }),
               el('strong', { text: move.pp ? String(move.pp) : '—' })
             ])
           ]),
           el('div', { class: 'card-attack__meta', style: 'margin-top:.55rem',
             text: 'Categoria: ' + prettyName((move.damage_class && move.damage_class.name) || '—') })
         ]);
   
         cardEl.style.setProperty('--tc', meta.color);
         cardEl.style.setProperty('--tc2', meta.color2);
         grid.appendChild(cardEl);
       });
   
       if (!rendered){
         grid.appendChild(el('p', { class: 'ability-card__desc', text: 'Não foi possível carregar os movimentos.' }));
         return;
       }
   
       if ((pokemon.moves || []).length > MAX_MOVES){
         grid.appendChild(el('p', {
           class: 'dex-hint',
           style: 'grid-column:1/-1;margin:.4rem 0 0',
           text: 'Mostrando ' + MAX_MOVES + ' de ' + pokemon.moves.length + ' movimentos disponíveis.'
         }));
       }
     }
   
     function flattenChain(node, depth, out){
       const result = out || [];
       if (!result[depth]) result[depth] = [];
       result[depth].push(node.species);
       (node.evolves_to || []).forEach(function(child){ flattenChain(child, depth + 1, result); });
       return result;
     }
   
     function renderEvolution(chain, currentId){
       const container = document.getElementById('evoChain');
       if (!container) return;
   
       const stages = flattenChain(chain, 0, []);
       container.innerHTML = '';
   
       stages.forEach(function(speciesList, stageIndex){
         if (stageIndex > 0){
           container.appendChild(el('span', { class: 'evo-arrow', 'aria-hidden': 'true', text: '→' }));
         }
         const stage = el('div', { class: 'evo-stage' });
         speciesList.forEach(function(species){
           const id = idFromUrl(species.url);
           if (!id || id > PokeAPI.TOTAL_POKEMON) return;
           const isCurrent = Number(currentId) === Number(id);
   
           const node = el('button', {
             class: 'evo-node' + (isCurrent ? ' is-current' : ''),
             type: 'button',
             'aria-label': 'Ver ' + prettyName(species.name),
             'aria-current': isCurrent ? 'true' : 'false'
           }, [
             el('img', { src: PokeAPI.artworkUrl(id), alt: 'Ilustração de ' + prettyName(species.name),
               loading: 'lazy', width: 74, height: 74 }),
             el('span', { class: 'evo-node__name', text: prettyName(species.name) }),
             el('span', { class: 'evo-node__num', text: pad3(id) })
           ]);
           node.addEventListener('click', function(){
             location.hash = '#pokemon?id=' + id;
           });
           stage.appendChild(node);
         });
         container.appendChild(stage);
       });
     }
   
     return { init: init };
   })();
   
   /* =========================================================================
      14. TIPOS
      ========================================================================= */
   
   const TypesPage = (function(){
     const DESCRIPTIONS = {
       normal:   'Versátil e equilibrado. Pokémon Normais se adaptam a qualquer situação e costumam ter uma ampla variedade de movimentos.',
       fire:     'Energia ardente e ofensiva. Fogo brilha em ataques poderosos, mas sente o peso da água e da terra.',
       water:    'Fluido e resistente. A água controla o ritmo da batalha e apaga qualquer chama por perto.',
       electric: 'Velocidade e choque. Elétricos são rápidos e imprevisíveis, mas o solo os neutraliza por completo.',
       grass:    'Vida e regeneração. Planta domina a longa batalha com cura e controle, mas teme o fogo e o gelo.',
       ice:      'Frio cortante e preciso. Gelo congela o campo, porém derrete diante de pedra, fogo e luta.',
       fighting: 'Força bruta e disciplina. Lutadores quebram defesas físicas com golpes diretos e implacáveis.',
       poison:   'Toxinas e desgaste. Venenosos vencem pelo tempo, corroendo o adversário turno após turno.',
       ground:   'Poder telúrico. Terra é imune à eletricidade e arrasta qualquer voo para o chão.',
       flying:   'Liberdade e altitude. Voadores atacam de cima e escapam das amarras do solo.',
       psychic:  'Mente sobre matéria. Psíquicos manipulam energia, confundem e preveem cada movimento.',
       bug:      'Instinto e número. Insetos compensam a fragilidade com velocidade e estratégias de suporte.',
       rock:     'Defesa sólida. Pedra resiste a golpes físicos e esmaga com ataques de impacto brutal.',
       ghost:    'Mistério e intangibilidade. Fantasmas atravessam defesas e brincam com o medo do oponente.',
       dragon:   'Poder ancestral. Dragões são raros, imponentes e dominam batalhas com stats altíssimos.',
       dark:     'Estratégia e astúcia. Sombrios atacam pelos flancos e punem qualquer distração.',
       steel:    'Armadura viva. Aço resiste a quase tudo e devolve o golpe com precisão cirúrgica.',
       fairy:    'Encanto e magia. Fadas surpreendem os dragões e curam aliados com doçura letal.'
     };
   
     let mounted = false;
     let grid;
     const counts = {};
   
     function mount(){
       grid = $('#typeGrid');
       if (!grid || mounted) return;
       mounted = true;
       renderCards();
       loadCounts().catch(function(){ Toast.warn('Algumas contagens não puderam ser carregadas.'); });
     }
   
     function renderCards(){
       grid.innerHTML = '';
       TYPE_KEYS.forEach(function(key){
         const meta = TYPES[key];
         const count = counts[key];
   
         const card = el('article', { class: 'type-card' }, [
           el('div', { class: 'type-card__head' }, [
             el('span', { class: 'type-card__icon', 'aria-hidden': 'true', text: meta.icon }),
             el('div', {}, [
               el('h2', { class: 'type-card__title', text: meta.pt }),
               el('span', { class: 'type-card__en', text: key })
             ])
           ]),
           el('p', { class: 'type-card__desc', text: DESCRIPTIONS[key] || '' }),
           el('div', { class: 'type-card__foot' }, [
             el('span', { class: 'type-card__count',
               text: count === undefined ? 'Carregando...' : count + ' Pokémon' }),
             el('a', { class: 'btn btn--sm', href: '#pokedex?type=' + key,
               'aria-label': 'Explorar Pokémon do tipo ' + meta.pt },
               [document.createTextNode('Explorar')])
           ])
         ]);
         card.style.setProperty('--tc', meta.color);
         card.style.setProperty('--tc2', meta.color2);
         grid.appendChild(card);
       });
     }
   
     async function loadCounts(){
       const results = await mapLimit(TYPE_KEYS, 4, function(key){
         return PokeAPI.getType(key).then(function(data){
           const total = (data.pokemon || []).filter(function(e){
             const id = idFromUrl(e.pokemon.url);
             return id && id <= PokeAPI.TOTAL_POKEMON;
           }).length;
           return { key, total };
         }).catch(function(){ return { key, total: null }; });
       });
   
       results.forEach(function(item){ if (item && item.total !== null) counts[item.key] = item.total; });
   
       $$('.type-card', grid).forEach(function(card, index){
         const key = TYPE_KEYS[index];
         const node = card.querySelector('.type-card__count');
         if (!node) return;
         const v = counts[key];
         node.textContent = v === undefined ? '— Pokémon' : v + ' Pokémon';
       });
     }
   
     return { init: function(){ mount(); } };
   })();
   
   /* =========================================================================
      15. COLEÇÃO
      ========================================================================= */
   
   const CollectionPage = (function(){
     const TOTAL = 1025;
   
     const state = { ids: [], details: new Map(), query: '', type: '' };
     let grid, countEl, bar, searchInput, typeSelect, clearBtn;
     let mounted = false;
   
     function mount(){
       grid = $('#collectionGrid');
       countEl = $('#colCount');
       bar = $('#albumBar');
       searchInput = $('#colSearch');
       typeSelect = $('#colType');
       clearBtn = $('#clearCollection');
   
       if (!grid || mounted) return;
       mounted = true;
   
       TYPE_KEYS.forEach(function(key){
         const meta = TYPES[key];
         const opt = document.createElement('option');
         opt.value = key;
         opt.textContent = meta.icon + ' ' + meta.pt;
         typeSelect.appendChild(opt);
       });
   
       const onSearch = debounce(function(v){
         state.query = v.trim().toLowerCase();
         render();
       }, 260);
   
       searchInput.addEventListener('input', function(){ onSearch(searchInput.value); });
       typeSelect.addEventListener('change', function(){ state.type = typeSelect.value; render(); });
   
       clearBtn.addEventListener('click', function(){
         if (!state.ids.length){ Toast.info('Sua coleção já está vazia.'); return; }
         if (window.confirm('Tem certeza que deseja remover todos os Pokémon da sua coleção?')){
           Favorites.clear();
           Toast.warn('Coleção esvaziada.');
           refresh();
         }
       });
   
       document.addEventListener('collection:changed', function(){
         /* Atualiza contador quando muda de outra tela */
         const n = Favorites.all().length;
         if (countEl) countEl.textContent = String(n);
         if (bar) bar.style.width = Math.min(100, (n / TOTAL) * 100).toFixed(2) + '%';
       });
     }
   
     async function refresh(){
       state.ids = Favorites.all();
       updateCounter();
   
       if (!state.ids.length){ renderEmpty(); return; }
   
       renderCardSkeletons(grid, Math.min(state.ids.length, 8));
   
       const missing = state.ids.filter(function(id){ return !state.details.has(id); });
       if (missing.length){
         const fetched = await mapLimit(missing, 6, function(id){
           return PokeAPI.getPokemon(id).catch(function(){ return null; });
         });
         fetched.forEach(function(d){ if (d) state.details.set(d.id, d); });
       }
   
       render();
     }
   
     function updateCounter(){
       const n = Favorites.all().length;
       if (countEl) countEl.textContent = String(n);
       if (bar) bar.style.width = Math.min(100, (n / TOTAL) * 100).toFixed(2) + '%';
     }
   
     function render(){
       const entries = state.ids.map(function(id){ return state.details.get(id); }).filter(Boolean);
   
       const filtered = entries.filter(function(p){
         if (state.query){
           const name = p.name.toLowerCase();
           const numeric = parseInt(state.query.replace(/[^0-9]/g,''), 10);
           const matchName = name.indexOf(state.query) !== -1;
           const matchId = !isNaN(numeric) && p.id === numeric;
           if (!matchName && !matchId) return false;
         }
         if (state.type){
           const types = (p.types || []).map(function(t){ return t.type.name; });
           if (types.indexOf(state.type) === -1) return false;
         }
         return true;
       });
   
       grid.innerHTML = '';
   
       if (!state.ids.length){ renderEmpty(); return; }
   
       if (!filtered.length){
         renderState(grid, '🔍', 'Nenhuma carta encontrada',
           'Nenhum Pokémon da sua coleção corresponde a esse filtro.',
           'Limpar filtros', function(){
             searchInput.value = ''; typeSelect.value = '';
             state.query = ''; state.type = '';
             render();
           });
         return;
       }
   
       filtered.sort(function(a,b){ return a.id - b.id; })
         .forEach(function(p){
           const c = createPokemonCard(p, { album: true });
           if (c) grid.appendChild(c);
         });
     }
   
     function renderEmpty(){
       grid.innerHTML = '';
       grid.appendChild(el('div', { class: 'album-empty' }, [
         el('div', { class: 'album-empty__icon', 'aria-hidden': 'true', text: '🃏' }),
         el('h3', { text: 'Sua coleção está vazia' }),
         el('p', { text: 'Explore a Pokédex e toque no coração dos Pokémon para montar seu álbum de cartas.' }),
         el('a', { class: 'btn btn--primary', href: '#pokedex' },
           [document.createTextNode('Explorar Pokédex')])
       ]));
     }
   
     return { init: function(){ mount(); refresh(); } };
   })();
   
   /* =========================================================================
      16. ROTEADOR
      ========================================================================= */
   
   function parseHash(){
     const raw = location.hash.replace(/^#/, '') || 'home';
     const [path, queryString] = raw.split('?');
     const params = new URLSearchParams(queryString || '');
     return { page: path || 'home', params };
   }
   
   function updateNav(page){
     $$('#mainNav a').forEach(function(a){
       const target = a.getAttribute('data-nav');
       let active = false;
       if (page === 'home' && target === 'sobre') active = true;
       else active = target === page;
       a.classList.toggle('is-active', active);
     });
   }
   
   async function handleRoute(){
     const { page, params } = parseHash();
   
     $$('.page-view').forEach(function(v){ v.hidden = true; });
   
     const view = document.getElementById('page-' + page);
     if (!view){
       location.hash = '#home';
       return;
     }
   
     view.hidden = false;
     updateNav(page);
     window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
   
     /* Notifica o componente de busca global */
     document.dispatchEvent(new CustomEvent('route:changed'));
   
     try {
       if (page === 'home') initHome();
       else if (page === 'pokedex') PokedexPage.init(params);
       else if (page === 'pokemon') PokemonPage.init(params);
       else if (page === 'types') TypesPage.init();
       else if (page === 'collection') CollectionPage.init();
     } catch (err){
       console.error(err);
       Toast.error('Ocorreu um erro inesperado. Tente recarregar a página.');
     }
   }
   
   /* =========================================================================
      17. BOOTSTRAP
      ========================================================================= */
   
   document.addEventListener('DOMContentLoaded', function(){
     initHeaderUI();
   
     if (!location.hash){
       history.replaceState(null, '', '#home');
     }
   
     window.addEventListener('hashchange', handleRoute);
     handleRoute();
   });