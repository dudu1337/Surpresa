// ===== GLOBAL ERROR LOGGER =====
window.onerror = function (msg, url, lineNo, columnNo, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '10px';
  errorDiv.style.left = '10px';
  errorDiv.style.right = '10px';
  errorDiv.style.background = 'rgba(255, 0, 0, 0.9)';
  errorDiv.style.color = '#fff';
  errorDiv.style.padding = '15px';
  errorDiv.style.zIndex = '100000';
  errorDiv.style.borderRadius = '8px';
  errorDiv.style.fontSize = '12px';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.maxHeight = '200px';
  errorDiv.style.overflowY = 'auto';
  errorDiv.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
  errorDiv.innerHTML = `<strong>Erro no Navegador:</strong><br>${msg}<br>no arquivo: ${url}<br>linha: ${lineNo}:${columnNo}`;
  document.body.appendChild(errorDiv);
  return false;
};

// ===== STATE =====
const STORAGE_KEY = 'nosso-album-state';
// 11 stickers in total from packs: 0 to 10.
// Pack 1: [1,2,3], Pack 2: [4,5,6], Pack 3: [7,8,9,10,0] (contains shiny 00 last)
const PACKS = [[1, 2, 3], [4, 5, 6], [7, 8, 9, 10, 0]]; 

let state = {
  packsOpened: [false, false, false],
  stickersCollected: new Array(12).fill(false), // 0 to 11 (11 is custom photo)
  stickersPlaced: new Array(12).fill(false),
  sticker11Image: '', // base64 string
  currentScreen: 'packs',
  currentPage: 0 // represents the current active spread (0 to 11)
};

// ===== PATH UTILITY =====
function getStickerPath(stickerId) {
  if (stickerId === 11) {
    return state.sticker11Image || '';
  }
  const numStr = String(stickerId).padStart(2, '0');
  const ext = (stickerId === 0) ? 'png' : 'jpg';
  return `assets/figurinhas/${numStr}.${ext}`;
}

// ===== STATE SANITIZATION =====
function sanitizeState() {
  if (!state || typeof state !== 'object') {
    state = {
      packsOpened: [false, false, false],
      stickersCollected: new Array(12).fill(false),
      stickersPlaced: new Array(12).fill(false),
      sticker11Image: '',
      currentScreen: 'packs',
      currentPage: 0
    };
    return;
  }

  if (!Array.isArray(state.packsOpened) || state.packsOpened.length !== 3) {
    state.packsOpened = [false, false, false];
  } else {
    state.packsOpened = state.packsOpened.map(v => !!v);
  }

  if (!Array.isArray(state.stickersCollected) || state.stickersCollected.length !== 12) {
    state.stickersCollected = new Array(12).fill(false);
  } else {
    state.stickersCollected = state.stickersCollected.map(v => !!v);
  }

  if (!Array.isArray(state.stickersPlaced) || state.stickersPlaced.length !== 12) {
    state.stickersPlaced = new Array(12).fill(false);
  } else {
    state.stickersPlaced = state.stickersPlaced.map(v => !!v);
  }

  if (typeof state.sticker11Image !== 'string') {
    state.sticker11Image = '';
  }

  if (typeof state.currentScreen !== 'string') {
    state.currentScreen = 'packs';
  }

  if (typeof state.currentPage !== 'number' || isNaN(state.currentPage) || state.currentPage < 0 || state.currentPage >= 12) {
    state.currentPage = 0;
  }
}

// ===== PERSISTENCE =====
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage is blocked or unavailable:', e);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure compatibility with 12 elements if coming from an older save
      if (parsed && parsed.stickersCollected && parsed.stickersCollected.length < 12) {
        const tempCollected = new Array(12).fill(false);
        const tempPlaced = new Array(12).fill(false);
        for(let i=0; i<parsed.stickersCollected.length; i++) {
          tempCollected[i] = parsed.stickersCollected[i];
          tempPlaced[i] = parsed.stickersPlaced[i] || false;
        }
        parsed.stickersCollected = tempCollected;
        parsed.stickersPlaced = tempPlaced;
      }
      Object.assign(state, parsed); 
    }
  } catch (e) {
    console.warn('LocalStorage is blocked or unavailable:', e);
  }
  // Guarantee state validity under any circumstances
  sanitizeState();
}

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  if (screen) screen.classList.add('active');
  state.currentScreen = id;
  saveState();
}

// Welcome screen removed

// Safe click helper — attaches click only if element exists
function safeClick(id, handler) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.addEventListener('click', handler);
}

// ===== PACKS =====
function initPacks() {
  document.querySelectorAll('.pack').forEach(el => {
    const idx = parseInt(el.dataset.pack);
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      openPack(idx);
    });
  });
  
  const goAlbumBtn = document.getElementById('btn-go-album');
  if (goAlbumBtn) {
    goAlbumBtn.addEventListener('click', function() {
      showScreen('album');
      updateAlbum();
    });
  }
  updatePacksUI();
}

function updatePacksUI() {
  state.packsOpened.forEach((opened, i) => {
    const el = document.getElementById('pack-' + i);
    if (el) {
      if (opened) el.classList.add('opened');
      else el.classList.remove('opened');
    }
  });
  // Show album button if any pack opened
  const anyOpened = state.packsOpened.some(v => v);
  const goAlbumBtn = document.getElementById('btn-go-album');
  if (goAlbumBtn) {
    goAlbumBtn.style.display = anyOpened ? 'inline-flex' : 'none';
  }
}

// ===== PACK OPENING =====
let revealQueue = [];
let revealFlippedCount = 0;

function openPack(packIdx) {
  revealQueue = [...PACKS[packIdx]];
  revealFlippedCount = 0;
  
  const wasOpened = state.packsOpened[packIdx];
  if (wasOpened) {
    // Review mode (already opened)
    showScreen('reveal');
    renderReviewCards();
    return;
  }
  
  state.packsOpened[packIdx] = true;
  saveState();
  updatePacksUI();
  showScreen('reveal');
  preparePackForTearing();
}

function preparePackForTearing() {
  const foilPack = document.getElementById('reveal-pack-foil');
  const packWrapper = document.getElementById('reveal-pack-wrapper');
  const stickersEl = document.getElementById('reveal-stickers');
  const btnCollect = document.getElementById('btn-reveal-collect');
  const counter = document.getElementById('reveal-counter');

  stickersEl.innerHTML = '';
  btnCollect.style.display = 'none';
  counter.innerHTML = '<span class="pulse-text">✨ Toque no pacote para rasgar! ✨</span>';
  
  foilPack.classList.remove('tearing');
  foilPack.style.display = 'block';
  packWrapper.style.display = 'block';
  
  // Use click with { once: true } for reliable one-shot tear
  foilPack.addEventListener('click', function tearHandler() {
    triggerTearSequence();
  }, { once: true });
}

function triggerTearSequence() {
  const foilPack = document.getElementById('reveal-pack-foil');
  const counter = document.getElementById('reveal-counter');
  counter.textContent = 'Rasgando... ✂️';

  // Create particles/sparkles at the tear line
  const particles = document.getElementById('tear-particles');
  particles.innerHTML = '';
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.className = 'tear-particle';
    p.style.left = (15 + Math.random() * 70) + '%';
    p.style.top = '25%'; // Tear line height
    p.style.backgroundColor = ['#ffb3ba','#ffdfba','#ffffba','#baffc9','#bae1ff'][Math.floor(Math.random()*5)];
    const angle = Math.random() * 360;
    const dist = 60 + Math.random() * 110;
    const dx = Math.cos(angle * Math.PI / 180) * dist;
    const dy = Math.sin(angle * Math.PI / 180) * dist - 25;
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--dy', dy + 'px');
    particles.appendChild(p);
  }

  // Trigger tear animation class
  foilPack.classList.add('tearing');
  
  particles.querySelectorAll('.tear-particle').forEach(p => {
    const dx = parseFloat(p.style.getPropertyValue('--dx')) || (Math.random() * 100 - 50);
    const dy = parseFloat(p.style.getPropertyValue('--dy')) || (-25 - Math.random() * 60);
    p.animate([
      { transform: 'translate(0,0) scale(1.5)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 }
    ], { duration: 900, easing: 'ease-out', fill: 'forwards' });
  });

  // Once torn, hide package wrapper completely and render 3D cards face-down
  setTimeout(() => {
    document.getElementById('reveal-pack-wrapper').style.display = 'none';
    renderFaceDownCards();
  }, 1400);
}

function renderFaceDownCards() {
  const stickersEl = document.getElementById('reveal-stickers');
  const counter = document.getElementById('reveal-counter');
  stickersEl.innerHTML = '';
  counter.textContent = 'Toque em cada figurinha para revelá-las!';
  
  revealQueue.forEach((stickerId, index) => {
    const isShiny = stickerId === 0;
    const numStr = String(stickerId).padStart(2, '0');
    const imgPath = getStickerPath(stickerId);
    
    const card3D = document.createElement('div');
    card3D.className = 'reveal-card-3d';
    card3D.style.setProperty('--card-index', index);
    
    card3D.innerHTML = `
      <div class="card-inner">
        <!-- Back side: foil pattern -->
        <div class="card-back">
          <div class="card-back-foil">
            <span class="card-back-logo">❤️</span>
            <span class="card-back-text">TOQUE</span>
          </div>
        </div>
        <!-- Front side: World Cup sticker -->
        <div class="card-front">
          <div class="wc-sticker ${isShiny ? 'wc-shiny' : ''}">
            <div class="wc-header">LOVE ALBUM</div>
            <div class="wc-number">${numStr}</div>
            <div class="wc-photo-wrapper">
              <div class="wc-photo" style="background-image: url('${imgPath}')"></div>
            </div>
            <div class="wc-footer">ZOCA & DUDU</div>
            ${isShiny ? '<div class="wc-hologram"></div>' : ''}
          </div>
        </div>
      </div>
    `;
    
    card3D.addEventListener('click', function() {
      if (card3D.classList.contains('flipped')) return;
      card3D.classList.add('flipped');
      
      revealFlippedCount++;
      counter.textContent = `${revealFlippedCount}/${revealQueue.length} reveladas`;
      
      if (revealFlippedCount === revealQueue.length) {
        setTimeout(() => {
          const btnCollect = document.getElementById('btn-reveal-collect');
          btnCollect.style.display = 'inline-flex';
          counter.textContent = 'Prontinho! Colete suas figurinhas! 🎉';
        }, 800);
      }
    });
    
    stickersEl.appendChild(card3D);
  });
}

function renderReviewCards() {
  const packWrapper = document.getElementById('reveal-pack-wrapper');
  const stickersEl = document.getElementById('reveal-stickers');
  const btnCollect = document.getElementById('btn-reveal-collect');
  const counter = document.getElementById('reveal-counter');

  packWrapper.style.display = 'none';
  stickersEl.innerHTML = '';
  
  // Show "Voltar" instead of "Coletar Todas"
  btnCollect.style.display = 'inline-flex';
  btnCollect.querySelector('span').textContent = 'Voltar aos Pacotes';
  
  counter.textContent = 'Revisando figurinhas deste pacote';

  revealQueue.forEach((stickerId, index) => {
    const isShiny = stickerId === 0;
    const numStr = String(stickerId).padStart(2, '0');
    const imgPath = getStickerPath(stickerId);
    
    const card3D = document.createElement('div');
    card3D.className = 'reveal-card-3d flipped'; // start flipped open!
    card3D.style.setProperty('--card-index', index);
    
    card3D.innerHTML = `
      <div class="card-inner">
        <div class="card-back">
          <div class="card-back-foil">
            <span class="card-back-logo">❤️</span>
          </div>
        </div>
        <div class="card-front">
          <div class="wc-sticker ${isShiny ? 'wc-shiny' : ''}">
            <div class="wc-header">LOVE ALBUM</div>
            <div class="wc-number">${numStr}</div>
            <div class="wc-photo-wrapper">
              <div class="wc-photo" style="background-image: url('${imgPath}')"></div>
            </div>
            <div class="wc-footer">ZOCA & DUDU</div>
            ${isShiny ? '<div class="wc-hologram"></div>' : ''}
          </div>
        </div>
      </div>
    `;
    stickersEl.appendChild(card3D);
  });
}

function collectStickers() {
  revealQueue.forEach(id => { state.stickersCollected[id] = true; });
  saveState();
  
  const allOpened = state.packsOpened.every(v => v);
  if (allOpened) {
    showScreen('album');
    state.currentPage = 0;
    saveState();
    updateAlbum();
    fireConfetti();
  } else {
    showScreen('packs');
  }
}

// ===== ALBUM & SPREADS =====
const TOTAL_SPREADS = 12;

function initAlbum() {
  safeClick('btn-prev-page', () => flipSpread(-1));
  safeClick('btn-next-page', () => flipSpread(1));
  safeClick('btn-go-packs', () => showScreen('packs'));

  // Touch swipe support on book element
  const book = document.getElementById('book');
  if (book) {
    let touchStartX = 0;
    let touchStartY = 0;
    
    book.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    book.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
        flipSpread(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  // Sticker slot clicks
  document.querySelectorAll('.sticker-slot:not(.slot-photo)').forEach(slot => {
    slot.addEventListener('click', function() {
      const stickerId = parseInt(slot.dataset.sticker);
      if (state.stickersCollected[stickerId] && !state.stickersPlaced[stickerId]) {
        showPlaceOverlay(stickerId);
      }
    });
  });

  // Page dots click
  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', function() {
      const target = parseInt(dot.dataset.dot);
      goToSpread(target);
    });
  });
}

function flipSpread(dir) {
  const next = state.currentPage + dir;
  if (next < 0 || next >= TOTAL_SPREADS) return;
  goToSpread(next, dir);
}

function goToSpread(target, dir = 0) {
  if (target === state.currentPage || target < 0 || target >= TOTAL_SPREADS) return;
  
  const spreads = document.querySelectorAll('.book-spread');
  const currentSpread = spreads[state.currentPage];
  const nextSpread = spreads[target];
  
  // Decide page turn classes
  let exitClass = 'exit-left';
  let enterClass = 'exit-right';
  if (dir < 0 || (dir === 0 && target < state.currentPage)) {
    exitClass = 'exit-right';
    enterClass = 'exit-left';
  }
  
  currentSpread.classList.remove('active');
  currentSpread.classList.add(exitClass);
  
  // Prepare next spread
  nextSpread.classList.remove('exit-left', 'exit-right');
  nextSpread.classList.add('active');
  
  setTimeout(() => {
    currentSpread.classList.remove('exit-left', 'exit-right');
    state.currentPage = target;
    saveState();
    updatePageNav();
  }, 250);
}

function updatePageNav() {
  document.getElementById('btn-prev-page').disabled = state.currentPage === 0;
  document.getElementById('btn-next-page').disabled = state.currentPage === TOTAL_SPREADS - 1;
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === state.currentPage);
  });
}

function updateAlbum() {
  // Update sticker slots
  for (let i = 0; i < 12; i++) {
    const slot = document.getElementById('slot-' + i);
    if (!slot) continue;
    
    slot.classList.remove('available', 'placed', 'placing');
    
    if (state.stickersPlaced[i]) {
      slot.classList.add('placed');
      loadStickerImage(slot, i);
    } else if (state.stickersCollected[i]) {
      slot.classList.add('available');
    }
  }
  
  // Update progress
  const placedCount = state.stickersPlaced.filter(v => v).length;
  document.getElementById('placed-count').textContent = placedCount;
  document.getElementById('progress-fill').style.width = (placedCount / 12 * 100) + '%';
  
  // Update nav dots & buttons
  updatePageNav();

  // Set the current active spread in HTML
  const spreads = document.querySelectorAll('.book-spread');
  spreads.forEach((spread, idx) => {
    if (idx === state.currentPage) {
      spread.classList.add('active');
    } else {
      spread.classList.remove('active');
    }
  });
}

function loadStickerImage(slot, stickerId) {
  const imgPath = getStickerPath(stickerId);
  const filled = slot.querySelector('.slot-filled');
  if (!filled) return;
  
  const isShiny = stickerId === 0;
  const numStr = String(stickerId).padStart(2, '0');
  
  filled.innerHTML = `
    <div class="wc-sticker ${isShiny ? 'wc-shiny' : ''}">
      <div class="wc-header">LOVE ALBUM</div>
      <div class="wc-number">${numStr}</div>
      <div class="wc-photo-wrapper">
        <div class="wc-photo" style="background-image: url('${imgPath}')"></div>
      </div>
      <div class="wc-footer">ZOCA & DUDU</div>
      ${isShiny ? '<div class="wc-hologram"></div>' : ''}
    </div>
  `;
}

// ===== PLACE STICKER OVERLAY =====
let pendingPlaceId = -1;

function showPlaceOverlay(stickerId) {
  pendingPlaceId = stickerId;
  const overlay = document.getElementById('overlay-place');
  const preview = document.getElementById('overlay-sticker-preview');
  const numStr = String(stickerId).padStart(2, '0');
  const isShiny = stickerId === 0;
  const imgPath = getStickerPath(stickerId);

  preview.innerHTML = `
    <div class="wc-sticker ${isShiny ? 'wc-shiny' : ''}" style="width:100%; height:100%;">
      <div class="wc-header">LOVE ALBUM</div>
      <div class="wc-number">${numStr}</div>
      <div class="wc-photo-wrapper">
        <div class="wc-photo" style="background-image: url('${imgPath}')"></div>
      </div>
      <div class="wc-footer">ZOCA & DUDU</div>
      ${isShiny ? '<div class="wc-hologram"></div>' : ''}
    </div>
  `;
  
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('show'), 10);
}

function hidePlaceOverlay() {
  const overlay = document.getElementById('overlay-place');
  overlay.classList.remove('show');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
  pendingPlaceId = -1;
}

function confirmPlace() {
  if (pendingPlaceId < 0) return;
  const id = pendingPlaceId;
  state.stickersPlaced[id] = true;
  saveState();
  hidePlaceOverlay();
  
  const slot = document.getElementById('slot-' + id);
  if (slot) {
    slot.classList.remove('available');
    slot.classList.add('placing');
    loadStickerImage(slot, id);
    setTimeout(() => {
      slot.classList.remove('placing');
      slot.classList.add('placed');
      fireConfetti();
    }, 700);
  }
  
  updateAlbum();
}

// ===== PHOTO UPLOAD FOR FIGURINHA 11 =====
function triggerPhotoUpload() {
  const fileInput = document.getElementById('photo-upload-input');
  if (fileInput) fileInput.click();
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    state.sticker11Image = base64;
    state.stickersCollected[11] = true;
    state.stickersPlaced[11] = true;
    saveState();
    
    const slot = document.getElementById('slot-11');
    if (slot) {
      slot.classList.remove('available');
      slot.classList.add('placing');
      loadStickerImage(slot, 11);
      setTimeout(() => {
        slot.classList.remove('placing');
        slot.classList.add('placed');
        fireConfetti();
      }, 700);
    }
    updateAlbum();
  };
  reader.readAsDataURL(file);
}

// ===== MICRO-INTERACTIONS: HEART SPARKLES =====
function sparkleHeartEffect(event) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const hearts = ['❤️', '💖', '💖', '✨', '💕', '🥰', '🌸'];
  
  for (let i = 0; i < 15; i++) {
    const span = document.createElement('span');
    span.className = 'sparkle-heart';
    span.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    
    // Spawn randomly around clicked text
    const offsetX = (Math.random() - 0.5) * 80;
    const offsetY = (Math.random() - 0.5) * 40;
    
    span.style.left = (event.clientX || (rect.left + rect.width / 2)) + offsetX + 'px';
    span.style.top = (event.clientY || (rect.top + rect.height / 2)) + offsetY + 'px';
    
    const angle = Math.random() * 360;
    const speed = 2 + Math.random() * 5;
    const vx = Math.cos(angle * Math.PI / 180) * speed;
    const vy = Math.sin(angle * Math.PI / 180) * speed - 2; // drift upward
    
    span.style.setProperty('--vx', vx + 'px');
    span.style.setProperty('--vy', vy + 'px');
    
    document.body.appendChild(span);
    
    span.animate([
      { transform: 'translate(0, 0) scale(0.5)', opacity: 1 },
      { transform: `translate(${vx * 15}px, ${vy * 15}px) scale(1.5)`, opacity: 0 }
    ], {
      duration: 1000 + Math.random() * 500,
      easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
      fill: 'forwards'
    });
    
    setTimeout(() => span.remove(), 1500);
  }
}

// ===== CONFETTI =====
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const pieces = [];
  const colors = ['#e8456b', '#ff6b8a', '#d4a853', '#f0d48a', '#ff9a9e', '#fad0c4', '#667eea', '#764ba2'];
  
  for (let i = 0; i < 100; i++) {
    pieces.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 300,
      y: canvas.height / 2 + (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 14,
      vy: -10 - Math.random() * 10,
      size: 5 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.16 + Math.random() * 0.1,
      life: 1
    });
  }
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    
    pieces.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.life -= 0.007;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.7);
      ctx.restore();
    });
    
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  animate();
}

// ===== INIT =====
function init() {
  try {
    loadState();
    initPacks();
    initAlbum();
    
    safeClick('btn-reveal-collect', function() {
      const btnCollect = document.getElementById('btn-reveal-collect');
      const span = btnCollect ? btnCollect.querySelector('span') : null;
      if (span && span.textContent.includes('Voltar')) {
        showScreen('packs');
        span.textContent = 'Coletar Todas!';
      } else {
        collectStickers();
      }
    });

    safeClick('btn-place-confirm', confirmPlace);
    safeClick('btn-place-cancel', hidePlaceOverlay);
    
    updatePacksUI();
    updateAlbum();
    
    // Decide screen based on completion
    const allOpened = state.packsOpened.every(v => v);
    if (allOpened) {
      showScreen('album');
    } else {
      showScreen('packs');
    }
    
    console.log('[Album] Init completed successfully. Packs:', document.querySelectorAll('.pack').length);
  } catch (err) {
    console.error('[Album] Init error:', err);
    // Show error visually
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:#fff;padding:15px;z-index:99999;font:14px monospace';
    d.textContent = 'Erro init: ' + err.message;
    document.body.appendChild(d);
  }
}

document.addEventListener('DOMContentLoaded', init);

// Handle canvas resizing
window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// Keyboard shortcut for resetting state (z + c pressed together)
let keysPressed = {};
document.addEventListener('keydown', (e) => {
  keysPressed[e.key.toLowerCase()] = true;
  if (keysPressed['z'] && keysPressed['c']) {
    localStorage.clear();
    location.reload();
  }
});
document.addEventListener('keyup', (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});
