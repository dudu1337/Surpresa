import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'nosso-album-state';
const TOTAL_PAGES = 27;

interface State {
  packsOpened: boolean[];
  stickersCollected: boolean[];
  stickersPlaced: boolean[];
  sticker11Image: string;
  currentScreen: 'packs' | 'reveal' | 'album';
  currentPage: number;
  generatedPacks: number[][];
}

const defaultState: State = {
  packsOpened: [false, false, false, false, false],
  stickersCollected: new Array(12).fill(false),
  stickersPlaced: new Array(12).fill(false),
  sticker11Image: '',
  currentScreen: 'packs',
  currentPage: 0,
  generatedPacks: []
};

interface Particle {
  id: number;
  left: string;
  top: string;
  color: string;
  dx: number;
  dy: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  gravity: number;
  life: number;
}

const STICKER_PAGES: Record<number, { page: number; name: string }> = {
  0: { page: 3, name: "Quando nos vimos" },
  1: { page: 7, name: "Mais Unidos Que Nunca" },
  2: { page: 8, name: "Janeiro: Encontros" },
  3: { page: 10, name: "Cheesecake & Cafe" },
  4: { page: 13, name: "Mudanças & Trabalho" },
  5: { page: 16, name: "O Pedido de Namoro" },
  6: { page: 16, name: "O Pedido de Namoro" },
  7: { page: 18, name: "Silvania & Surprezoca" },
  8: { page: 20, name: "Distância & Pizza" },
  9: { page: 21, name: "Treino Juntos" },
  10: { page: 22, name: "Superação & Família" },
  11: { page: 25, name: "Nossa Foto Atual" }
};

export default function App() {
  // --- STATE ---
  const [state, setState] = useState<State>(defaultState);
  const [initialized, setInitialized] = useState(false);

  // --- REVEAL MECHANICS ---
  const [currentPackIdx, setCurrentPackIdx] = useState<number | null>(null);
  const [isTearing, setIsTearing] = useState(false);
  const [isTorn, setIsTorn] = useState(false);
  const [tearParticles, setTearParticles] = useState<Particle[]>([]);
  const [flippedCards, setFlippedCards] = useState<boolean[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);



  // --- SELECTION & DRAG-AND-DROP ---
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(null);
  const [placingId, setPlacingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // --- ZOOM IMAGE ---
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomedImageCaption, setZoomedImageCaption] = useState<string | null>(null);

  // --- SPIRAL ANIMATION ---
  const [spiralSpin, setSpiralSpin] = useState(0);

  useEffect(() => {
    setSpiralSpin((prev) => prev + 1);
  }, [state.currentPage]);

  const showToastMessage = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // --- TRANSITION DIRECTION ---
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right'>('left');

  // --- SWIPE TRACKING ---
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // --- CANVAS & INPUT REFS ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [showPhotoSourceDialog, setShowPhotoSourceDialog] = useState(false);

  const generateRandomPacks = (): number[][] => {
    const stickers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = stickers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = stickers[i];
      stickers[i] = stickers[j];
      stickers[j] = temp;
    }
    return [
      [stickers[0], stickers[1]],
      [stickers[2], stickers[3]],
      [stickers[4], stickers[5]],
      [stickers[6], stickers[7]],
      [stickers[8], stickers[9], stickers[10]]
    ];
  };

  // --- LOAD STATE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.stickersCollected && parsed.stickersCollected.length < 12) {
          const tempCollected = new Array(12).fill(false);
          const tempPlaced = new Array(12).fill(false);
          for (let i = 0; i < parsed.stickersCollected.length; i++) {
            tempCollected[i] = parsed.stickersCollected[i];
            tempPlaced[i] = parsed.stickersPlaced[i] || false;
          }
          parsed.stickersCollected = tempCollected;
          parsed.stickersPlaced = tempPlaced;
        }

        const initialPacks = Array.isArray(parsed.generatedPacks) && parsed.generatedPacks.length === 5 
          ? parsed.generatedPacks 
          : generateRandomPacks();

        const sanitized: State = {
          packsOpened: Array.isArray(parsed.packsOpened) && parsed.packsOpened.length === 5 ? parsed.packsOpened.map(Boolean) : [false, false, false, false, false],
          stickersCollected: Array.isArray(parsed.stickersCollected) && parsed.stickersCollected.length === 12 ? parsed.stickersCollected.map(Boolean) : new Array(12).fill(false),
          stickersPlaced: Array.isArray(parsed.stickersPlaced) && parsed.stickersPlaced.length === 12 ? parsed.stickersPlaced.map(Boolean) : new Array(12).fill(false),
          sticker11Image: typeof parsed.sticker11Image === 'string' ? parsed.sticker11Image : '',
          currentScreen: ['packs', 'reveal', 'album'].includes(parsed.currentScreen) ? parsed.currentScreen : 'packs',
          currentPage: typeof parsed.currentPage === 'number' && !isNaN(parsed.currentPage) && parsed.currentPage >= 0 && parsed.currentPage < TOTAL_PAGES ? parsed.currentPage : 0,
          generatedPacks: initialPacks
        };
        setState(sanitized);
      } else {
        setState(prev => ({
          ...prev,
          generatedPacks: generateRandomPacks()
        }));
      }
    } catch (e) {
      console.warn('LocalStorage unavailable:', e);
    }
    setInitialized(true);
  }, []);

  // --- SAVE STATE ---
  const updateState = (updater: Partial<State> | ((prev: State) => State)) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
      return next;
    });
  };

  // --- KEYBOARD RESET (z + c) ---
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = true;
      if (keysPressed['z'] && keysPressed['c']) {
        localStorage.clear();
        setState(defaultState);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
        } catch (err) {}
        window.location.reload();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- CONFETTI ANIMATION SYSTEM ---
  const fireConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces: ConfettiPiece[] = [];
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

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      pieces.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.life -= 0.007;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      });

      if (alive) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animate();
  };

  // Resize canvas handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- STICKER PATHS ---
  const getStickerPath = (id: number): string => {
    if (id === 11) {
      return state.sticker11Image || '';
    }
    const numStr = String(id).padStart(2, '0');
    const ext = id === 0 ? 'png' : 'jpg';
    return `/assets/figurinhas/${numStr}.${ext}`;
  };

  // --- ACTIONS: PACKS ---
  const handleOpenPack = (packIdx: number) => {
    const wasOpened = state.packsOpened[packIdx];
    setCurrentPackIdx(packIdx);
    const packLength = (state.generatedPacks[packIdx] || []).length;

    if (wasOpened) {
      setIsReviewMode(true);
      setIsTorn(true);
      setIsTearing(false);
      setFlippedCards(new Array(packLength).fill(true));
      updateState({ currentScreen: 'reveal' });
    } else {
      setIsReviewMode(false);
      setIsTorn(false);
      setIsTearing(false);
      setFlippedCards(new Array(packLength).fill(false));
      updateState({ currentScreen: 'reveal' });
    }
  };

  // --- ACTIONS: REVEAL / TEARING ---
  const handleTearPack = () => {
    if (isTearing || isTorn) return;
    setIsTearing(true);

    const colors = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff'];
    const particles: Particle[] = Array.from({ length: 35 }).map((_, i) => {
      const angle = Math.random() * 360;
      const dist = 60 + Math.random() * 110;
      const dx = Math.cos((angle * Math.PI) / 180) * dist;
      const dy = Math.sin((angle * Math.PI) / 180) * dist - 25;
      return {
        id: i,
        left: `${15 + Math.random() * 70}%`,
        top: '25%',
        color: colors[Math.floor(Math.random() * colors.length)],
        dx,
        dy
      };
    });
    setTearParticles(particles);

    setTimeout(() => {
      setIsTorn(true);
      setIsTearing(false);
    }, 1000);
  };

  const handleFlipCard = (cardIdx: number) => {
    if (isReviewMode) return;
    setFlippedCards((prev) => {
      const next = [...prev];
      next[cardIdx] = true;
      return next;
    });
  };

  const handleCollectStickers = () => {
    if (currentPackIdx === null) return;
    const packStickers = state.generatedPacks[currentPackIdx] || [];

    updateState((prev) => {
      const nextOpened = [...prev.packsOpened];
      nextOpened[currentPackIdx] = true;

      const nextCollected = [...prev.stickersCollected];
      packStickers.forEach((id) => {
        nextCollected[id] = true;
      });

      const allOpened = nextOpened.every((v) => v);
      return {
        ...prev,
        packsOpened: nextOpened,
        stickersCollected: nextCollected,
        currentScreen: allOpened ? 'album' : 'packs',
        currentPage: allOpened ? 0 : prev.currentPage
      };
    });

    const nextPacksOpened = [...state.packsOpened];
    nextPacksOpened[currentPackIdx] = true;
    const allOpened = nextPacksOpened.every((v) => v);

    if (allOpened) {
      setTimeout(() => {
        fireConfetti();
      }, 300);
    }

    setCurrentPackIdx(null);
    setIsTorn(false);
    setIsTearing(false);
    setTearParticles([]);
  };

  const handleVoltarPacks = () => {
    updateState({ currentScreen: 'packs' });
    setCurrentPackIdx(null);
    setIsTorn(false);
    setIsTearing(false);
    setTearParticles([]);
  };

  // --- ACTIONS: ALBUM NAVIGATION ---
  const goToSpread = (target: number) => {
    if (target === state.currentPage || target < 0 || target >= TOTAL_PAGES) return;
    const direction = target > state.currentPage ? 'left' : 'right';
    setTransitionDirection(direction);
    updateState({ currentPage: target });
  };

  const handlePrevPage = () => {
    goToSpread(state.currentPage - 1);
  };

  const handleNextPage = () => {
    goToSpread(state.currentPage + 1);
  };

  // --- SWIPE HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) {
        handleNextPage();
      } else {
        handlePrevPage();
      }
    }
  };

  // --- ACTIONS: STICKER SELECTION AND PLACING ---
  const checkOverlap = (info: any, stickerId: number) => {
    const slotEl = document.getElementById(`slot-${stickerId}`);
    if (!slotEl) return false;
    const rect = slotEl.getBoundingClientRect();
    const x = info.point.x;
    const y = info.point.y;
    return (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  };

  const handlePlaceSticker = (id: number) => {
    setPlacingId(id);
    setSelectedStickerId(null);
    setTimeout(() => {
      updateState((prev) => {
        const nextPlaced = [...prev.stickersPlaced];
        nextPlaced[id] = true;
        return {
          ...prev,
          stickersPlaced: nextPlaced
        };
      });
      setPlacingId(null);
      fireConfetti();
    }, 600);
  };

  const handleSelectStickerFromTray = (id: number) => {
    if (selectedStickerId === id) {
      setSelectedStickerId(null);
    } else {
      setSelectedStickerId(id);
      const targetInfo = STICKER_PAGES[id];
      if (targetInfo.page === state.currentPage) {
        showToastMessage(`Figurinha ${String(id).padStart(2, '0')} selecionada! Toque no espaço pontilhado correspondente no álbum para colar.`);
      } else {
        showToastMessage(`Figurinha ${String(id).padStart(2, '0')} selecionada! Ela deve ser colada na página do dia "${targetInfo.name}".`);
      }
    }
  };

  // --- ACTIONS: PHOTO UPLOAD ---
  const triggerPhotoUpload = () => {
    setShowPhotoSourceDialog(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (!base64) return;

      setPlacingId(11);
      setTimeout(() => {
        updateState((prev) => {
          const nextCollected = [...prev.stickersCollected];
          nextCollected[11] = true;
          const nextPlaced = [...prev.stickersPlaced];
          nextPlaced[11] = true;
          return {
            ...prev,
            stickersCollected: nextCollected,
            stickersPlaced: nextPlaced,
            sticker11Image: base64
          };
        });
        setPlacingId(null);
        fireConfetti();
      }, 700);
    };
    reader.readAsDataURL(file);
  };

  // --- RENDER HELPERS ---
  const renderStickerSlot = (stickerId: number, label: string, isSpecial: boolean = false, customStyle?: React.CSSProperties) => {
    const isCollected = state.stickersCollected[stickerId];
    const isPlaced = state.stickersPlaced[stickerId];
    const isPlacing = placingId === stickerId;
    const isPhoto = stickerId === 11;
    const imgPath = getStickerPath(stickerId);
    const isSelected = selectedStickerId === stickerId;

    let slotClass = 'sticker-slot';
    if (isSpecial) slotClass += ' slot-special';
    if (isPhoto) slotClass += ' slot-photo';
    if (isPlaced) slotClass += ' placed';
    else if (isCollected) slotClass += ' available';
    if (isPlacing) slotClass += ' placing';
    if (isSelected && isCollected && !isPlaced) slotClass += ' selected-target';

    const handleClick = (e: React.MouseEvent) => {
      if (isPhoto) {
        e.stopPropagation();
        if (isPlaced) {
          setZoomedImage(state.sticker11Image || imgPath);
          setZoomedImageCaption(`Figurinha ${String(stickerId).padStart(2, '0')}: ${label}`);
        } else {
          triggerPhotoUpload();
        }
        return;
      }
      if (isPlaced) {
        e.stopPropagation();
        setZoomedImage(imgPath);
        setZoomedImageCaption(`Figurinha ${String(stickerId).padStart(2, '0')}: ${label}`);
        return;
      }

      if (selectedStickerId !== null) {
        if (selectedStickerId === stickerId) {
          handlePlaceSticker(stickerId);
        } else {
          const targetInfo = STICKER_PAGES[selectedStickerId];
          showToastMessage(`Esta figurinha não pertence a este espaço! Ela vai na página do dia "${targetInfo.name}".`);
        }
      } else if (isCollected) {
        setSelectedStickerId(stickerId);
        showToastMessage(`Espaço pontilhado ${String(stickerId).padStart(2, '0')} selecionado! Toque na figurinha correspondente no painel para colar.`);
      }
    };

    let slotStyle: React.CSSProperties = {
      width: '185px',
      height: '247px',
      margin: '0 auto',
      ...customStyle
    };

    if (stickerId === 0) {
      slotStyle = {
        width: '290px',
        height: '387px',
        margin: '6px auto',
        ...customStyle
      };
    } else if (isPhoto) {
      slotStyle = {
        width: '210px',
        height: '280px',
        margin: '0 auto',
        ...customStyle
      };
    }

    return (
      <div
        id={`slot-${stickerId}`}
        className={slotClass}
        onClick={handleClick}
        style={slotStyle}
      >
        <div className="slot-empty">
          <span className="slot-number">{String(stickerId).padStart(2, '0')}</span>
          <span className="slot-label">{label}</span>
          {isSpecial && (
            <div className="slot-sparkles">
              <span>✦</span><span>✧</span><span>✦</span><span>✧</span>
            </div>
          )}
          {isPhoto && (
            <button
              className="btn-upload-photo"
              onClick={(e) => {
                e.stopPropagation();
                triggerPhotoUpload();
              }}
            >
              Escolher Foto
            </button>
          )}
        </div>
        <div className="slot-filled">
          <div className={`wc-sticker ${isSpecial ? 'wc-shiny' : ''}`}>
            <div className="wc-header">LOVE ALBUM</div>
            <div className="wc-number">{String(stickerId).padStart(2, '0')}</div>
            <div className="wc-photo-wrapper">
              {imgPath && (
                <div
                  className="wc-photo"
                  style={{ backgroundImage: `url(${imgPath})` }}
                />
              )}
            </div>
            <div className="wc-footer">ZOCA</div>
            {isSpecial && <div className="wc-hologram"></div>}
          </div>
        </div>
      </div>
    );
  };

  const sparkleHeartEffect = (e: React.MouseEvent) => {
    const hearts = ['❤️', '💖', '💖', '✨', '💕', '🥰', '🌸'];

    for (let i = 0; i < 15; i++) {
      const span = document.createElement('span');
      span.className = 'sparkle-heart';
      span.textContent = hearts[Math.floor(Math.random() * hearts.length)];

      const offsetX = (Math.random() - 0.5) * 80;
      const offsetY = (Math.random() - 0.5) * 40;

      span.style.left = `${e.clientX + offsetX}px`;
      span.style.top = `${e.clientY + offsetY}px`;

      const angle = Math.random() * 360;
      const speed = 2 + Math.random() * 5;
      const vx = Math.cos((angle * Math.PI) / 180) * speed;
      const vy = Math.sin((angle * Math.PI) / 180) * speed - 2;

      span.style.setProperty('--vx', `${vx}px`);
      span.style.setProperty('--vy', `${vy}px`);

      document.body.appendChild(span);

      span.animate(
        [
          { transform: 'translate(0, 0) scale(0.5)', opacity: 1 },
          { transform: `translate(${vx * 15}px, ${vy * 15}px) scale(1.5)`, opacity: 0 }
        ],
        {
          duration: 1000 + Math.random() * 500,
          easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
          fill: 'forwards'
        }
      );

      setTimeout(() => span.remove(), 1500);
    }
  };

  const unplacedStickers = state.stickersCollected
    .map((collected, id) => ({ collected, id }))
    .filter(({ collected, id }) => collected && !state.stickersPlaced[id]);

  const getScatteredRot = (id: number) => {
    const rotates = [10, -12, 7, -8, 15, -6, 9, -11, 13, -7, 5];
    return rotates[id % rotates.length];
  };

  const getPackAnimateProps = (idx: number) => {
    const positions = [
      { x: -160, y: 25, rotate: -15 },
      { x: -70, y: -35, rotate: 10 },
      { x: 15, y: 30, rotate: -8 },
      { x: 95, y: -25, rotate: 18 },
      { x: 170, y: 35, rotate: -12 }
    ];
    return positions[idx] || { x: 0, y: 0, rotate: 0 };
  };

  const renderSpiralBinding = () => {
    return (
      <motion.div
        className="spiral-binding"
        animate={{ rotateY: spiralSpin * 180 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          left: '-14px',
          top: '5%',
          bottom: '5%',
          width: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
          pointerEvents: 'none',
          transformStyle: 'preserve-3d',
          perspective: 1000
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="spiral-ring-wrapper" style={{ position: 'relative', width: '28px', height: '14px', transformStyle: 'preserve-3d' }}>
            <div className="spiral-hole" style={{
              position: 'absolute',
              left: '12px',
              top: '3px',
              width: '6px',
              height: '8px',
              backgroundColor: '#1b0f0b',
              borderRadius: '50%',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
              zIndex: 1
            }} />
            <div
              className="spiral-ring"
              style={{
                position: 'absolute',
                left: '-4px',
                top: '0',
                width: '22px',
                height: '14px',
                background: 'linear-gradient(180deg, #d8d8d8 0%, #ffffff 30%, #a8a8a8 70%, #585858 100%)',
                borderRadius: '7px / 7px',
                boxShadow: '1px 2px 3px rgba(0,0,0,0.4)',
                transform: 'rotate(-5deg) translateZ(10px)',
                zIndex: 10
              }}
            />
          </div>
        ))}
      </motion.div>
    );
  };

  if (!initialized) {
    return null;
  }

  // --- SCREEN RENDERS ---
  return (
    <div id="app" className="desk-background">
      {/* ===================== CONFETTI CANVAS ===================== */}
      <canvas id="confetti-canvas" ref={canvasRef}></canvas>

      {/* ===================== DESK DECORATIONS ===================== */}
      <div className="desk-decoration cup-of-coffee">
        <span className="steam">~</span>
        <span className="steam">~</span>
        ☕
      </div>
      <div className="desk-decoration love-note">
        Para: Zoquinha ♥
      </div>

      <AnimatePresence mode="wait">
        {/* ===================== TELA: PACOTINHOS ===================== */}
        {state.currentScreen === 'packs' && (
          <motion.section
            key="packs"
            id="screen-packs"
            className="screen active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            {/* Cleaned layout: no texts or headers as requested, just scattered packages on wood */}

            <div className="packs-container" style={{ position: 'relative', minHeight: '340px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '25px', flexWrap: 'wrap' }}>
              {state.generatedPacks.map((packStickers, idx) => {
                const isOpened = state.packsOpened[idx];
                const hasSpecial = packStickers.includes(0);
                const anim = getPackAnimateProps(idx);

                return (
                  <motion.div
                    key={idx}
                    className={`pack ${isOpened ? 'opened' : ''} ${hasSpecial ? 'pack-special' : ''}`}
                    drag
                    dragConstraints={{ left: -250, right: 250, top: -100, bottom: 100 }}
                    dragElastic={0.15}
                    animate={anim}
                    transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    whileTap={{ scale: 0.96 }}
                    onTap={() => handleOpenPack(idx)}
                  >
                    <div className="pack-wrapper">
                      <div className="pack-body">
                        <div className="pack-lid">
                          <div className="pack-tear-edge"></div>
                        </div>
                        <div className="pack-base">
                          <div className="pack-design">
                            {hasSpecial ? (
                              <>
                                <div className="pack-heart-shiny">💖</div>
                                <div className="pack-star">★</div>
                              </>
                            ) : (
                              <div className="pack-heart">❤️</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="pack-opened-badge">✓ Aberto</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="packs-footer">
              {state.packsOpened.some((v) => v) && (
                <button className="btn-secondary" onClick={() => updateState({ currentScreen: 'album' })}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span>Ver Álbum</span>
                </button>
              )}
            </div>
          </motion.section>
        )}

        {/* ===================== TELA: REVELAÇÃO ===================== */}
        {state.currentScreen === 'reveal' && (
          <motion.section
            key="reveal"
            id="screen-reveal"
            className="screen active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="reveal-container">
              {/* Packaging packet foil */}
              {!isTorn && (
                <div className="reveal-pack-wrapper">
                  <motion.div
                    className={`reveal-pack-foil ${isTearing ? 'tearing' : ''}`}
                    onClick={handleTearPack}
                    animate={isTearing ? { scale: 0.96 } : { scale: 1 }}
                  >
                    <motion.div
                      className="foil-top"
                      animate={isTearing ? { y: -250, x: -50, rotate: -10, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    />
                    <motion.div
                      className="foil-bottom"
                      animate={isTearing ? { y: 350, opacity: 0 } : { y: 0, opacity: 1 }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    >
                      <div className="foil-body">
                        <span className="foil-logo">❤️</span>
                        <span className="foil-title">LOVE ALBUM</span>
                        <span className="foil-subtitle">Namorados 2026</span>
                      </div>
                    </motion.div>
                  </motion.div>
                  {/* Tear flying particles */}
                  <div className="tear-particles" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {isTearing &&
                      tearParticles.map((p) => (
                        <motion.div
                          key={p.id}
                          className="tear-particle"
                          style={{
                            left: p.left,
                            top: p.top,
                            backgroundColor: p.color,
                            position: 'absolute',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%'
                          }}
                          initial={{ x: 0, y: 0, scale: 1.5, opacity: 1 }}
                          animate={{ x: p.dx, y: p.dy, scale: 0, opacity: 0 }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Render face down / review cards */}
              {isTorn && currentPackIdx !== null && (
                <div className="reveal-stickers">
                  {(state.generatedPacks[currentPackIdx] || []).map((stickerId, index) => {
                    const isShiny = stickerId === 0;
                    const numStr = String(stickerId).padStart(2, '0');
                    const imgPath = getStickerPath(stickerId);
                    const isFlipped = flippedCards[index];

                    return (
                      <motion.div
                        key={stickerId}
                        className={`reveal-card-3d ${isFlipped ? 'flipped' : ''}`}
                        onClick={() => handleFlipCard(index)}
                        initial={{ y: 80, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 90, damping: 15, delay: index * 0.12 }}
                      >
                        <div className="card-inner">
                          {/* Back Side */}
                          <div className="card-back">
                            <div className="card-back-foil">
                              <span className="card-back-logo">❤️</span>
                              <span className="card-back-text">TOQUE</span>
                            </div>
                          </div>
                          {/* Front Side */}
                          <div className="card-front">
                            <div className={`wc-sticker ${isShiny ? 'wc-shiny' : ''}`}>
                              <div className="wc-header">LOVE ALBUM</div>
                              <div className="wc-number">{numStr}</div>
                              <div className="wc-photo-wrapper">
                                <div className="wc-photo" style={{ backgroundImage: `url(${imgPath})` }}></div>
                              </div>
                              <div className="wc-footer">ZOCA</div>
                              {isShiny && <div className="wc-hologram"></div>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="reveal-counter">
                {!isTorn ? (
                  <span className="pulse-text">✨ Toque no pacote para rasgar! ✨</span>
                ) : isReviewMode ? (
                  'Revisando figurinhas deste pacote'
                ) : flippedCards.every((v) => v) ? (
                  'Prontinho! Colete suas figurinhas! 🎉'
                ) : (
                  `${flippedCards.filter((v) => v).length}/${flippedCards.length} reveladas`
                )}
              </div>

              {isTorn && (isReviewMode || flippedCards.every((v) => v)) && (
                <button
                  className="btn-primary"
                  onClick={isReviewMode ? handleVoltarPacks : handleCollectStickers}
                >
                  <span>{isReviewMode ? 'Voltar aos Pacotes' : 'Coletar Todas!'}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              )}
            </div>
          </motion.section>
        )}

        {/* ===================== TELA: ÁLBUM ===================== */}
        {state.currentScreen === 'album' && (
          <motion.section
            key="album"
            id="screen-album"
            className="screen active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="album-container">
              <div
                className="book"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <AnimatePresence initial={false} custom={transitionDirection} mode="popLayout">
                  <motion.div
                    key={state.currentPage}
                    custom={transitionDirection}
                    variants={{
                      enter: (dir: 'left' | 'right') => ({
                        rotateY: dir === 'left' ? 90 : -90,
                        opacity: 0,
                        scale: 0.98,
                        transformOrigin: "left center"
                      }),
                      center: {
                        rotateY: 0,
                        opacity: 1,
                        scale: 1,
                        transformOrigin: "left center"
                      },
                      exit: (dir: 'left' | 'right') => ({
                        rotateY: dir === 'left' ? -90 : 90,
                        opacity: 0,
                        scale: 0.98,
                        transformOrigin: "left center"
                      })
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
                    className="book-spread"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'block',
                      opacity: 1,
                      pointerEvents: 'all',
                      transformStyle: 'preserve-3d',
                      perspective: 1500,
                      backfaceVisibility: 'hidden'
                    }}
                  >
                    {/* PAGE 0: Capa */}
                    {state.currentPage === 0 && (
                      <div className="book-page page-cover-image-mode" onClick={() => { setZoomedImage('/assets/capa.png'); setZoomedImageCaption('ZOCA - Capa do Álbum'); }} style={{ cursor: 'zoom-in' }}>
                        <img src="/assets/capa.png" className="album-cover-img" alt="Capa do Álbum" />
                      </div>
                    )}

                    {/* PAGE 1: Primeiros Contatos (19 Out e 20 Nov) */}
                    {state.currentPage === 1 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <h3 className="page-date">19 de Outubro</h3>
                                <p className="page-text">
                                  Num dia comum, à noite, alguém apareceu pra mim, num aplicativo que deve ser falado. E nesse mesmo dia conversamos como se fôssemos amigos, sem filtro, sem nenhuma maldade, só agindo como bons jovens sem pensar no que o outro ia achar de estranho do outro.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/19-10.jpg'); setZoomedImageCaption('19/10 - Como bons amigos...'); }}>
                                <img src="/assets/imagens zoca/19-10.jpg" alt="19 de Outubro" style={{ maxHeight: '320px' }} />
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <h3 className="page-date">20 de Novembro</h3>
                                <p className="page-text">
                                  Eu recebo algo que me deixou muito feliz: alguém dando valor a querer estar comigo, me chamando pra sair. Acho que nunca me senti um homem tão feliz. Não falando que sou feio ou nunca fui atraente, mas foi uma situation especial pra mim. Eu não estava em JF, mas vi que você queria me ver e estar comigo.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/20-11.jpg'); setZoomedImageCaption('20/11 - Querer estar junto'); }}>
                                <img src="/assets/imagens zoca/20-11.jpg" alt="20 de Novembro" style={{ maxHeight: '320px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 2: Primeiras Decisões (05 Dez e 06 Dez) */}
                    {state.currentPage === 2 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <h3 className="page-date">05 de Dezembro</h3>
                              <p className="page-text">
                                O dia no qual eu mudei meu visual pela primeira vez. Eu arrisquei, saí da zona de conforto, tava me tornando finalmente uma pessoa livre e não me importando realmente com o que minha família achava das minhas coisas, algo que meu pai e tanto minha mãe não apoiavam. Eu pintei meu cabelo!
                              </p>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <h3 className="page-date">06 de Dezembro</h3>
                              <p className="page-text" style={{ marginBottom: '8px' }}>
                                Você me chama pra sair. Neste dia eu estava num churrasco de graça, no Cascatinha Country Club, pro aniversário do pai de um amigo. E em algum momento eu falei que teria que sair. E no meio do churrasco eu saio, passo em casa pra pegar uma vodka e vou rumo à casa de Isadora. A única foto que tenho desse dia é a incrível foto do perfume da bolsonara!
                              </p>
                              <div className="perfume-note" style={{ margin: '10px 0', padding: '12px' }}>
                                <div className="perfume-emoji" style={{ fontSize: '1.8rem' }}>🧴🇧🇷</div>
                                <p className="perfume-text" style={{ fontSize: '0.85rem' }}>O lendário perfume da Bolsonara!</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 3: Quando nos vimos & Figurinha 0 */}
                    {state.currentPage === 3 && (
                      <div className="book-page">
                        <div className="page-inner text-page sticker-page">
                          <h3 className="page-date">Quando nos vimos...</h3>
                          <p className="page-text" style={{ fontSize: '1.05rem', lineHeight: '1.7', marginBottom: '20px' }}>
                            A primeira vez que te vi eu me encantei. Conversamos sem parar todos os dias a partir dali, você foi meu tudo desde aquele momento. Eu senti que achei a pessoa com quem eu podia ser quem sempre fui, não ter que reprimir ser o "zoca". Eu podia falar de jogos, animes, músicas, bobeiras, e tudo você me entendia.
                          </p>

                          <div className="sticker-wrapper-album" style={{ marginTop: '10px' }}>
                            <h4 className="sticker-title" style={{ fontSize: '1.3rem' }}>✨ Figurinha Especial ✨</h4>
                            <p className="sticker-desc" style={{ fontSize: '0.95rem', marginBottom: '15px' }}>A constelação do dia em que nos conhecemos</p>
                            {renderStickerSlot(0, 'Brilhante', true, { width: '300px', height: '400px' })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 4: Conquista e Primeiro Encontro (09 Dez e 11 Dez) */}
                    {state.currentPage === 4 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <h3 className="page-date">09 de Dezembro</h3>
                                <p className="page-text">
                                  Eu reclamando do meu chefe na época e você rindo kkk, ainda me chamou de "escurinho", ali você me conquistou.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/09-12.jpg'); setZoomedImageCaption('09/12 - Ali você me conquistou'); }}>
                                <img src="/assets/imagens zoca/09-12.jpg" alt="09 de Dezembro" style={{ maxHeight: '300px' }} />
                                <div className="photo-caption">09/12 - Conquista</div>
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <h3 className="page-date">11 de Dezembro</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  Simplesmente a primeira vez que iríamos sair, e simplesmente ALI foi o dia que eu sabia que te amava. Era 100% de certeza que eu queria namorar com você. O primeiro dia saindo juntos e a gente parecia um casal tão lindo. Comprar coisas do Fluminense, comer na praça de alimentação... Parece simples, mas aquele dia simbolizou muito pra mim. E foi nesse dia que você me passou seu número, porque eu não gostava de conversar pelo Insta. Eu precisava perguntar se você tinha chegado bem, precisava poder falar com você todo dia, o tempo todo.
                                </p>
                              </div>
                              <div className="album-photos-row" style={{ gap: '12px', margin: '8px 0' }}>
                                <div className="album-photo micro-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/11-12.jpg'); setZoomedImageCaption('Primeiro dia saindo'); }}>
                                  <img src="/assets/imagens zoca/11-12.jpg" alt="11 de Dezembro 1" style={{ maxHeight: '280px' }} />
                                </div>
                                <div className="album-photo micro-photo" style={{ '--rot': '2deg', cursor: 'zoom-in' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/11-12.2.jpg'); setZoomedImageCaption('Meu número pra você'); }}>
                                  <img src="/assets/imagens zoca/11-12.2.jpg" alt="11 de Dezembro 2" style={{ maxHeight: '280px' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 5: Lembranças Engraçadas (12 Dez) */}
                    {state.currentPage === 5 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'center' }}>
                            <div>
                              <h3 className="page-date">12 de Dezembro</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem' }}>
                                Registrando nossos momentos engraçados e felizes, cada vídeo com você é uma lembrança eterna. Com a camisa que compramos juntos e hidratando meu cabelo com o óleo que você comprou pra mim, pra eu cuidar das minhas novas madeixas.
                              </p>
                            </div>
                            <div style={{ width: '100%', maxWidth: '650px', margin: '0 auto' }}>
                              <video className="album-video" src="/assets/videos/12-12.mp4" controls preload="metadata" style={{ width: '100%', maxHeight: '450px' }}></video>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 6: Mais Unidos Que Nunca */}
                    {state.currentPage === 6 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', height: '100%', gap: '16px' }}>
                            <div>
                              <h3 className="page-title-romantic" style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '12px' }}>Mais Unidos Que Nunca</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
                                E essa semana seguinte foi como se minha vida tivesse virado a melhor do mundo. A gente se viu durante a semana, conversou, falou que se amava, foi a melhor coisa que aconteceu na minha vida.
                              </p>
                              <p className="page-text" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
                                E no dia 22 de dezembro a gente se despediu pra você poder passar o ano novo com sua família e eu com a minha, sem saber quando nos veríamos de novo. O medo de você me esquecer era grande, então eu queria te contar tudo e te mostrar tudo que fazia: de vídeos da Leona à foto jogando bola, as coisas que eu comia, a tudo. E ver que era recíproco me fez tão feliz! Receber vídeos seus e da Alycia, você contando as coisas que fez, os presentes que ganhou. Foi o momento mais importante porque, mesmo longe, nós estreitamos nossos laços.
                              </p>
                            </div>
                            <div className="zoca-creation-box" style={{ margin: '10px auto', padding: '16px', maxWidth: '550px', width: '100%' }}>
                              <p className="page-text" style={{ margin: 0, textAlign: 'center' }}>
                                E foi aqui que o apelido <strong>Zoca</strong> foi criado. Enquanto você estava com o Zoiudo, chamou ele de <em>zocaroca</em>, e daí saiu: <em>zocoroco</em> and <em>zoca</em>. E depois daí nunca mais existiu Dudu e Isa, e sim...
                              </p>
                              <div className="zoca-highlight-container" style={{ marginTop: '10px' }}>
                                <span className="zoca-highlight" style={{ fontSize: '1.8rem', padding: '4px 18px' }} onClick={sparkleHeartEffect}>ZOCA</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 7: Sobrevivi até dia 12-01! (12 Jan) */}
                    {state.currentPage === 7 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">12 de Janeiro</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                                A passada da virada até chegar o dia que te veria de novo não foi fácil, mas eu aguentei. EU SOBREVIVI ATÉ O DIA 12-01! O momento em que pra mim eu sabia que tinha encontrado o amor da minha vida. A saudade foi tão importante pra fazer algo que nunca tive coragem: fazer um piercing! Estar com você é poder "ser eu", sem julgamentos.
                              </p>
                            </div>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                              {renderStickerSlot(1, 'Piercing ⚡', false, { width: '260px', height: '347px' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 8: Encontros e Dormidas (17 Jan) */}
                    {state.currentPage === 8 && (
                      <div className="book-page">
                        <div className="page-inner text-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '16px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '8px' }}>
                              <div>
                                <h3 className="page-date">17 de Janeiro</h3>
                                <p className="page-text" style={{ fontSize: '0.82rem' }}>
                                  Já tínhamos dormido juntos algumas vezes até aí. Você me via todo dia, era tão bom estar com você nesse dia inclusive dormimos na onça. E nesse mesmo dia a gente ia sair com minha melhor amiga. Eu ia te apresentar pra uma das pessoas importantes pra mim, e mesmo com vergonha você abraçou minha amiga. Ver vocês duas juntas foi tão especial, podermos ser um "casal oficial" pela primeira vez. Em você eu via tudo que eu queria pra passar todos os dias da minha vida.
                                </p>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {renderStickerSlot(2, 'Dormindo Onça 🐆', false, { width: '190px', height: '253px', margin: '0 auto' })}
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                              <div className="album-photos-row" style={{ flexDirection: 'column', gap: '8px', width: 'auto', margin: '0 auto' }}>
                                <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', maxWidth: '100%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/17-01.jpg'); setZoomedImageCaption('17 de Janeiro - Alycia & Zoca'); }}>
                                  <img src="/assets/imagens zoca/17-01.jpg" alt="17 de Janeiro 1" style={{ maxHeight: '250px' }} />
                                </div>
                                <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', maxWidth: '100%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/17-01.2.jpg'); setZoomedImageCaption('17 de Janeiro - Dormindo na onça'); }}>
                                  <img src="/assets/imagens zoca/17-01.2.jpg" alt="17 de Janeiro 2" style={{ maxHeight: '250px' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 9: Burger King de Madrugada (20 Jan) */}
                    {state.currentPage === 9 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">20 de Janeiro</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                                O dia que tentamos coisar pela primeira vez... Tentamos, porque acho que não deu muito certo kkk, mas deu uma canseira danada e fomos ao BK de madrugada, às 3 da manhã, pra comer 2 rodeios. Isso foi eu sendo eu e você não julgando e aceitando minha loucura!
                              </p>
                            </div>
                            <div className="album-photos-row" style={{ gap: '20px', justifyContent: 'center', width: '100%' }}>
                              <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/20-01.jpg'); setZoomedImageCaption('20/01 - BK de Madrugada'); }}>
                                <img src="/assets/imagens zoca/20-01.jpg" alt="BK 1" style={{ maxHeight: '320px' }} />
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/20-01.2.jpg'); setZoomedImageCaption('20/01 - BK de Madrugada'); }}>
                                <img src="/assets/imagens zoca/20-01.2.jpg" alt="BK 2" style={{ maxHeight: '320px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 10: Cheesecake & Festa (29 e 31 Jan) */}
                    {state.currentPage === 10 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">29 de Janeiro</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  O dia que coisamos oficialmente! Com você eu sempre pude ser eu, estar com você foi tudo pra mim. E nesse dia ainda fizemos a cheesecake viral de iogurte e oreo, que ficou ruim pro meu gosto kkk, mas como fizemos juntos foi tão especial.
                                </p>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {renderStickerSlot(3, 'BK & Doces 🍰', false, { width: '260px', height: '347px', margin: '0 auto' })}
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">31 de Janeiro</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  Não aconteceu nada esse dia, mas é um marco de você ter ido a uma festa com sua amiga, e continuar se importando em me dar notícias, em querer saber o que eu sentia in relation a isso.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/30-01.jpg'); setZoomedImageCaption('Nos importando um com o outro'); }}>
                                <img src="/assets/imagens zoca/30-01.jpg" alt="Cheesecake / Festa" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 11: Sonho da Cafeteria (05 Fev) */}
                    {state.currentPage === 11 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">05 de Fevereiro</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                                O dia que eu realizei meu sonho: <strong>IR NUMA CAFETERIA COM VOCÊ</strong>. Sempre foi o que eu quis desde a primeira vez que conversamos. Ouvir você falar, sentados tomando um café da tarde... A calmaria que isso deu no meu coração e a felicidade foi algo sem explicação.
                              </p>
                            </div>
                            <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', maxWidth: '95%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/05-02.jpg'); setZoomedImageCaption('05/02 - Sonho do café'); }}>
                              <img src="/assets/imagens zoca/05-02.jpg" alt="Cafeteria" style={{ maxHeight: '380px' }} />
                              <div className="photo-caption">05/02 - Sonho do café</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 12: Cabelo Rosa (12 Fev) */}
                    {state.currentPage === 12 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">12 de Fevereiro</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                                O dia que o Zoca deixou você pintar meu cabelo de rosa! Quem seria o imbecil que deixaria? Eu. Ver sua felicidade no olhar em fazer bobeiras comigo me deixa tão feliz.
                              </p>
                            </div>
                            <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', maxWidth: '95%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/12-02.jpg'); setZoomedImageCaption('12/02 - Madeixas rosa! 🌸'); }}>
                              <img src="/assets/imagens zoca/12-02.jpg" alt="Cabelo Rosa" style={{ maxHeight: '380px' }} />
                              <div className="photo-caption">12/02 - Madeixas rosa! 🌸</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 13: Apresentando Amigos do Serviço (21 Fev) */}
                    {state.currentPage === 13 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">21 de Fevereiro</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                                O dia que eu te apresentei pros meus amigos do serviço. Todos estavam ansiosos pra conhecer a pessoa que mudou o Dudu, que fez o menino mais alegre da CGS virar o menino mais alegre do mundo. Eles conheceram e entenderam que a Zoca é o amor da minha vida.
                              </p>
                            </div>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                              {renderStickerSlot(4, 'Trabalho 🏢', false, { width: '260px', height: '347px' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 14: Nick do LoL e Foto Embaçada (24 e 27 Fev) */}
                    {state.currentPage === 14 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">24 de Fevereiro</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  MUDEI MEU NICK DO LOL PRA <strong>ZOCA</strong>! Tomei muito xingo de amigo kkkk, porque na teoria é um nick bobo, mas eu estava com o amor da minha vida sempre que eu fosse jogar. Ter você comigo até nos momentos em que estou longe.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/24-02.jpg'); setZoomedImageCaption('ZOCA no LoL 🎮'); }}>
                                <img src="/assets/imagens zoca/24-02.jpg" alt="ZOCA Lol" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">27 de Fevereiro</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  Você pode não gostar dessa foto, mas ela representa muito pra mim. Eu me senti um pai tirando uma foto de sua família. Não importa se a foto está embaçada, você estava genuinamente feliz comigo, and eu estava feliz tirando.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/27-02.jpg'); setZoomedImageCaption('27/02 - Felicidade genuína'); }}>
                                <img src="/assets/imagens zoca/27-02.jpg" alt="Foto no Café" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 15: Anel de Canudinho (04 Mar) */}
                    {state.currentPage === 15 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">04 de Março</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                                Uma onda de bons cafés, toda semana aproveitando pra tomar um café, virando rotina. Nunca me enjoaria de olhar pra você e te ouvir falando baboseiras. E estava aí uma prévia do pedido: um anel de plástico de canudinho kkk.
                              </p>
                            </div>
                            <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', maxWidth: '95%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/04-03.jpg'); setZoomedImageCaption('04/03 - Prévia do anel'); }}>
                              <img src="/assets/imagens zoca/04-03.jpg" alt="Anel Canudinho" style={{ maxHeight: '380px' }} />
                              <div className="photo-caption">04/03 - Prévia do anel</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 16: O Pedido de Namoro (13 Mar) */}
                    {state.currentPage === 16 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', height: '100%', alignItems: 'center' }}>
                            {/* Col 1 */}
                            <div>
                              <h3 className="page-date">13 de Março - O Grande Dia</h3>
                              <p className="page-text" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                                Quem diria que a ideia era começar a namorar dia 12/03, mas dia 12/03 era aniversário do Flávio, então escolhi 13/03. Decidi te levar no Outback. O dia começou legal, passeamos, fomos à loja de discos, mas chegando em casa você emburrou comigo porque achou que eu estava te enrolando e fazendo de boba. O que eu fiz? Estraguei a surpresa e te pedi em namoro logo ali! Um momento estranho com você triste, feliz, chorando e rindo. Mas eu tinha certeza que fiz a melhor escolha da minha vida. Ter a Zoca de verdade, com medos e inseguranças, é o que eu precisava. Te entender e você me entender fez nosso relacionamento ser o que é hoje.
                              </p>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center', alignItems: 'center' }}>
                              <h4 className="sticker-title" style={{ fontSize: '1.15rem' }}>Nossas Figurinhas</h4>
                              <p className="sticker-desc" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Eternizando o pedido ❤️</p>
                              <div className="sticker-grid-row" style={{ margin: 0, gap: '15px', justifyContent: 'center', flexDirection: 'column' }}>
                                {renderStickerSlot(5, 'Outback 🥩', false, { width: '200px', height: '267px' })}
                                {renderStickerSlot(6, 'Namorados ❤️', false, { width: '200px', height: '267px' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 17: Lembranças do Pedido (13 Mar) */}
                    {state.currentPage === 17 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div className="album-photos-row" style={{ gap: '10px', justifyContent: 'center', width: '100%' }}>
                              <div className="album-photo micro-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', padding: '6px 6px 12px 6px' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/13-03.jpg'); setZoomedImageCaption('13/03 - A aliança'); }}>
                                <img src="/assets/imagens zoca/13-03.jpg" alt="Pedido 1" style={{ maxHeight: '250px' }} />
                              </div>
                              <div className="album-photo micro-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', padding: '6px 6px 12px 6px' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/13-03.2.jpg'); setZoomedImageCaption('Pedido de namoro'); }}>
                                <img src="/assets/imagens zoca/13-03.2.jpg" alt="Pedido 2" style={{ maxHeight: '250px' }} />
                              </div>
                              <div className="album-photo micro-photo" style={{ '--rot': '-1deg', cursor: 'zoom-in', padding: '6px 6px 12px 6px' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/13.03.3.jpg'); setZoomedImageCaption('Pedido de namoro'); }}>
                                <img src="/assets/imagens zoca/13.03.3.jpg" alt="Pedido 3" style={{ maxHeight: '250px' }} />
                              </div>
                            </div>
                            <div style={{ width: '100%', maxWidth: '650px', marginTop: '10px' }}>
                              <video className="album-video" src="/assets/videos/13-03.mp4" controls preload="metadata" style={{ width: '100%', maxHeight: '420px' }}></video>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 18: CS Live & Silvania Families (17 e 20 Mar) */}
                    {state.currentPage === 18 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">17 de Março</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  Primeira vez que você viu uma live minha de CS. Pra mim, um cara que sempre quis viver disso, ter a melhor fã do mundo fez meu dia muito feliz. Você me apoiou e estava lá comigo!
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/17-03.jpg'); setZoomedImageCaption('17/03 - CS Live 🎮'); }}>
                                <img src="/assets/imagens zoca/17-03.jpg" alt="Live CS" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">20 de Março</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  O Zoca te ama, e por isso permite você ser você. Nesse dia compramos nosso "primeiro filho", um Silvania Families! Ver seu olho brilhando me faz o homem mais feliz do mundo.
                                </p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                {renderStickerSlot(7, 'Silvania 🐰', false, { width: '200px', height: '267px', margin: 0 })}
                                <video className="album-video" src="/assets/videos/20-03.mov" controls preload="metadata" style={{ margin: 0, width: '220px', height: '180px' }}></video>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 19: Surprezoca & BTS Show (24 Mar e 09 Abr) */}
                    {state.currentPage === 19 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">24 de Março</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  Simplesmente a <strong>Surprezoca</strong>. Você fazer coisas por mim que eu nunca imaginei. O valor sentimental dos presentes vale mais que qualquer dinheiro.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/24-03.jpg'); setZoomedImageCaption('Surprezoca'); }}>
                                <img src="/assets/imagens zoca/24-03.jpg" alt="Surprezoca" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'flex-start' }}>
                              <div>
                                <h3 className="page-date">09 de Abril</h3>
                                <p className="page-text" style={{ fontSize: '0.85rem' }}>
                                  Fizemos de tudo pra você conseguir viver seu sonho de ir no show do BTS! Escutei as músicas, entrei na fila do ingresso e conseguimos! O dia que compramos o ingresso.
                                </p>
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', margin: '8px auto', maxWidth: '90%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/09-04.jpg'); setZoomedImageCaption('Show BTS! 🎟️'); }}>
                                <img src="/assets/imagens zoca/09-04.jpg" alt="Show BTS" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 20: Distância e Sorvete (Abril) */}
                    {state.currentPage === 20 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date">Abril: Distância e Saudade</h3>
                              <p className="page-text" style={{ fontSize: '0.92rem', textAlign: 'center', marginBottom: '12px' }}>
                                O mês de abril foi conturbado. Ficamos muito tempo longe, com o Flávio passando mal tive que ficar 1 semana em Três Rios, depois viagem pro Rio. Ficamos quase 2 semanas sem nos ver. Mas você queria saber de tudo, se importava comigo.
                              </p>
                              <h3 className="page-date">21 de Abril</h3>
                              <p className="page-text" style={{ fontSize: '0.92rem', textAlign: 'center' }}>
                                Minha volta foi conturbada, você estava distante e brava comigo. Mas o importante é que nos entendemos. Esse dia foi muito especial, tomamos sorvete, vimos filme, comemos pizza. Foi importante ver que você ainda me amava.
                              </p>
                            </div>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                              {renderStickerSlot(8, 'Sorvete & Pizza 🍕', false, { width: '260px', height: '347px' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 21: Treino Juntos (24 Abr) */}
                    {state.currentPage === 21 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '14px' }}>
                              <div>
                                <h3 className="page-date">24 de Abril - Treino Juntos</h3>
                                <p className="page-text" style={{ fontSize: '0.9rem' }}>
                                  O dia que você foi treinar comigo. Fomos e até coisas chatas ficam divertidas juntos. Depois a gente comeu picolé e eu tirei a foto que eu mais amo sua: você está genuinamente feliz. Minha foto favorita do mundo!
                                </p>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                                {renderStickerSlot(9, 'Treino 💪', false, { width: '260px', height: '347px', margin: '0 auto' })}
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center' }}>
                              <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', maxWidth: '95%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/24-04.jpg'); setZoomedImageCaption('Treino juntos'); }}>
                                <img src="/assets/imagens zoca/24-04.jpg" alt="Treino 1" style={{ maxHeight: '300px' }} />
                              </div>
                              <div className="album-photo small-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', maxWidth: '95%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/24-04.02.jpg'); setZoomedImageCaption('Treino juntos - Foto favorita!'); }}>
                                <img src="/assets/imagens zoca/24-04.02.jpg" alt="Treino 2" style={{ maxHeight: '300px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 22: Superação (13 Maio) */}
                    {state.currentPage === 22 && (
                      <div className="book-page">
                        <div className="page-inner text-page">
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', height: '100%' }}>
                            {/* Col 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '8px' }}>
                              <div>
                                <h3 className="page-date">13 de Maio - Superação</h3>
                                <p className="page-text" style={{ fontSize: '0.82rem' }}>
                                  Essa época foi nebulosa, passamos por algumas coisas. Eu com problemas no serviço, meu chefe mandado embora, Tobito passando por cirurgia... Eu estava sem um CENTAVO. Foram uns 10-15 dias difíceis, mas fiz de tudo pra esse dia ser especial. Comemos pizza, treinamos, tomamos sorvete. Fazer você lembrar que me amava foi importante. Nenhum casal vive só de felicidade, o principal é passar por isso sem desistir.
                                </p>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {renderStickerSlot(10, 'Superação 🤝', false, { width: '190px', height: '253px', margin: '0 auto' })}
                              </div>
                            </div>
                            {/* Col 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                              <div className="album-photo micro-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', maxWidth: '95%', margin: '0 auto' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/13-05.jpg'); setZoomedImageCaption('Maio - Pizzaria'); }}>
                                <img src="/assets/imagens zoca/13-05.jpg" alt="Maio 1" style={{ maxHeight: '175px' }} />
                              </div>
                              <div className="album-photo micro-photo" style={{ '--rot': '2deg', cursor: 'zoom-in', maxWidth: '95%', margin: '0 auto' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/13-05.02.jpg'); setZoomedImageCaption('Maio - Pizza e sorvete'); }}>
                                <img src="/assets/imagens zoca/13-05.02.jpg" alt="Maio 2" style={{ maxHeight: '175px' }} />
                              </div>
                              <div className="album-photo micro-photo" style={{ '--rot': '-1deg', cursor: 'zoom-in', maxWidth: '95%', margin: '0 auto' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/13.05.3.jpg'); setZoomedImageCaption('Maio - Amor'); }}>
                                <img src="/assets/imagens zoca/13.05.3.jpg" alt="Maio 3" style={{ maxHeight: '175px' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 23: Família & Bobie Goods (16, 17, 30 e 31 Maio) */}
                    {state.currentPage === 23 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <h3 className="page-date">16 e 17 de Maio - Minha Família</h3>
                              <p className="page-text" style={{ fontSize: '0.84rem', marginBottom: '8px' }}>
                                Você conheceu minha família e todos gostaram de você. Minha irmã te amou, minha mãe também, o Flávio também. Almoçamos, brincamos. Vi uma criança sorrindo dentro de você, e tive certeza que era você com quem eu queria formar uma família.
                              </p>
                              <div className="album-photos-row" style={{ gap: '10px', alignItems: 'flex-start', margin: '0' }}>
                                <div className="album-photo small-photo" style={{ '--rot': '-1.5deg', cursor: 'zoom-in', margin: '0', maxWidth: '48%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/16-05.png'); setZoomedImageCaption('16/05 - Minha Família'); }}>
                                  <img src="/assets/imagens zoca/16-05.png" alt="16 de Maio - Família" style={{ maxHeight: '210px' }} />
                                </div>
                                <div className="album-photo small-photo" style={{ '--rot': '1.5deg', cursor: 'zoom-in', margin: '0', maxWidth: '48%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/17-05.jpg'); setZoomedImageCaption('17/05 - Minha Família'); }}>
                                  <img src="/assets/imagens zoca/17-05.jpg" alt="17 de Maio - Família" style={{ maxHeight: '210px' }} />
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
                              <div>
                                <h3 className="page-date">30 de Maio - Meu Pai</h3>
                                <p className="page-text" style={{ fontSize: '0.82rem', marginBottom: '6px' }}>
                                  Você conheceu meu pai. Fomos oficializados pra toda nossa família!
                                </p>
                                <div className="album-photo small-photo" style={{ '--rot': '1.5deg', cursor: 'zoom-in', margin: '0 auto', maxWidth: '100%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/30-05.png'); setZoomedImageCaption('30/05 - Conhecendo o Pai'); }}>
                                  <img src="/assets/imagens zoca/30-05.png" alt="Faculdade / Pai" style={{ maxHeight: '290px' }} />
                                </div>
                              </div>
                              <div>
                                <h3 className="page-date">31 de Maio - Bobie Goods</h3>
                                <p className="page-text" style={{ fontSize: '0.82rem', marginBottom: '6px' }}>
                                  Nosso segundo bobie goods pintando com você! Conheci sua irmã e sua mãe.
                                </p>
                                <div className="album-photo small-photo" style={{ '--rot': '-2deg', cursor: 'zoom-in', margin: '0 auto', maxWidth: '100%' } as React.CSSProperties} onClick={() => { setZoomedImage('/assets/imagens zoca/31-05.jpg'); setZoomedImageCaption('31/05 - Pintando juntos'); }}>
                                  <img src="/assets/imagens zoca/31-05.jpg" alt="Bobie Goods" style={{ maxHeight: '290px' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 24: Minha Zoquinha */}
                    {state.currentPage === 24 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', height: '100%', gap: '16px' }}>
                            <div>
                              <h3 className="page-title-romantic" style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '12px' }}>Minha Zoquinha</h3>
                              <p className="page-text" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
                                Não tenho palavras pra descrever o que sinto por você. Te amo mais que tudo na minha vida. As idas aos sebos comprar livros que virou um hábito cheio de afeto, as comidinhas que você faz pra mim (cookies e brownies que me fazem peidar kkk), a festinha da Maju, os inúmeros cafés, os lanches noturnos, você me ajudando a dar nome e me apoiando a jogar Pokémon...
                              </p>
                              <p className="page-text" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
                                O carinho que você tem ao cuidar de mim, me escutar sobre o que me magoa, me deixar ser eu com meus hobbies e meus defeitos... Obrigado por me fazer sentir especial. Eu nunca vou fazer nada pra te deixar triste de propósito. Quero sempre o seu bem.
                              </p>
                              <p className="page-text" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
                                Não sou bom com presentes, sempre falo que vou comprar doces. Mas senti que fazer algo programando, que é o que sei fazer, tem seu valor. Foi feito com muito carinho.
                              </p>
                            </div>
                            <div className="signature-box" style={{ marginTop: '10px', paddingTop: '10px', textAlign: 'center' }}>
                              <p className="signature-text" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-script)' }}>Com todo o amor do mundo,</p>
                              <p className="signature-name" style={{ fontSize: '2.2rem', fontFamily: 'var(--font-script)', color: 'var(--pink)', fontWeight: 'bold' }}>Zoca Bosta</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 25: Nossa Foto Atual */}
                    {state.currentPage === 25 && (
                      <div className="book-page">
                        <div className="page-inner text-page scrollable-page">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: '100%' }}>
                              <h3 className="page-date" style={{ textAlign: 'center' }}>Nossa Foto Atual</h3>
                              <p className="page-text" style={{ textAlign: 'center', fontSize: '0.95rem', marginBottom: '12px' }}>
                                E para completar este álbum, esta última figurinha pertence a você. Tire uma foto agora ou suba uma foto nossa recente para fechar nossa história com chave de ouro!
                              </p>
                            </div>
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              {renderStickerSlot(11, 'Nossa Foto 📸', false, { width: '280px', height: '373px' })}
                              {state.stickersPlaced[11] ? (
                                <button
                                  className="btn-upload-photo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerPhotoUpload();
                                  }}
                                  style={{ marginTop: '8px' }}
                                >
                                  Alterar Foto
                                </button>
                              ) : (
                                <p className="page-hint" style={{ marginTop: '8px', fontSize: '1.2rem' }}>
                                  Toque na figurinha para tirar uma foto ou fazer o upload!
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 26: Fim do Álbum */}
                    {state.currentPage === 26 && (
                      <div className="book-page page-final">
                        <div className="final-page">
                          <div className="final-heart">❤️</div>
                          <h2 className="final-title">Álbum Completo!</h2>
                          <p className="final-message">
                            Cada figurinha, cada texto e cada risada é um pedacinho da nossa história que continuaremos a escrever juntos. Te amo para sempre, minha Zoquinha! ❤️
                          </p>
                          <div className="signature-box" style={{ marginTop: '20px', paddingTop: '10px', textAlign: 'center' }}>
                            <p className="signature-text" style={{ fontSize: '1.3rem', fontFamily: 'var(--font-script)', fontStyle: 'italic', color: '#5a3a3a' }}>Com todo o amor do mundo,</p>
                            <p className="signature-name" style={{ fontSize: '2.5rem', fontFamily: 'var(--font-script)', color: 'var(--pink)', fontWeight: 'bold', marginTop: '4px' }}>Zoca Bosta</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                {renderSpiralBinding()}
              </div>

              {/* Album Navigation */}
              <div className="album-nav">
                <button
                  className="nav-arrow nav-prev"
                  onClick={handlePrevPage}
                  disabled={state.currentPage === 0}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="page-dots">
                  {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                    <span
                      key={i}
                      className={`dot ${i === state.currentPage ? 'active' : ''}`}
                      onClick={() => goToSpread(i)}
                    />
                  ))}
                </div>
                <button
                  className="nav-arrow nav-next"
                  onClick={handleNextPage}
                  disabled={state.currentPage === TOTAL_PAGES - 1}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>

              {/* Sticker Tray (Drag & Drop or Select-to-Place) */}
              {/* Scattered Stickers (Minhas Figurinhas "jogado ali" nas laterais) */}
              {unplacedStickers.map(({ id }) => {
                const isShiny = id === 0;
                const numStr = String(id).padStart(2, '0');
                const imgPath = getStickerPath(id);
                const isSelected = selectedStickerId === id;

                const index = unplacedStickers.findIndex(item => item.id === id);
                const isLeft = index % 2 === 0;
                const colIdx = Math.floor(index / 2);
                
                // Vertical coordinate: space them out vertically
                const topVal = `${8 + colIdx * 14}vh`;
                const rot = getScatteredRot(id);

                return (
                  <motion.div
                    key={id}
                    drag
                    dragElastic={0.4}
                    dragMomentum={false}
                    style={{
                      position: 'absolute',
                      top: topVal,
                      left: isLeft ? '2.5vw' : 'auto',
                      right: isLeft ? 'auto' : '2.5vw',
                      width: isShiny ? '120px' : '96px',
                      height: isShiny ? '160px' : '128px',
                      zIndex: isSelected ? 100 : 15,
                      cursor: 'grab'
                    }}
                    animate={{
                      x: 0,
                      y: 0,
                      rotate: rot,
                      scale: isSelected ? 1.08 : 1
                    }}
                    whileDrag={{
                      scale: 1.15,
                      zIndex: 1000,
                      cursor: 'grabbing'
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    onDragEnd={(_, info) => {
                      if (checkOverlap(info, id)) {
                        handlePlaceSticker(id);
                      } else {
                        const bookEl = document.querySelector(".book");
                        if (bookEl) {
                          const bookRect = bookEl.getBoundingClientRect();
                          const inBook = (
                            info.point.x >= bookRect.left &&
                            info.point.x <= bookRect.right &&
                            info.point.y >= bookRect.top &&
                            info.point.y <= bookRect.bottom
                          );
                          if (inBook) {
                            const targetInfo = STICKER_PAGES[id];
                            if (targetInfo.page !== state.currentPage) {
                              showToastMessage(`Essa figurinha pertence à página "${targetInfo.name}". Folheie o álbum até lá!`);
                            } else {
                              showToastMessage(`Solte a figurinha exatamente sobre o contorno pontilhado ${numStr}!`);
                            }
                          }
                        }
                      }
                    }}
                    onTap={() => handleSelectStickerFromTray(id)}
                    className={`tray-sticker-wrapper scattered ${isSelected ? 'selected' : ''}`}
                  >
                    <div className={`wc-sticker ${isShiny ? 'wc-shiny' : ''}`} style={{ width: '100%', height: '100%', border: '3px solid #fff', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
                      <div className="wc-header" style={{ fontSize: '0.45rem', padding: '1px 0' }}>LOVE ALBUM</div>
                      <div className="wc-number" style={{ top: '8px', fontSize: '0.55rem', padding: '0px 2px' }}>{numStr}</div>
                      <div className="wc-photo-wrapper" style={{ margin: '1px' }}>
                        <div className="wc-photo" style={{ backgroundImage: `url(${imgPath})` }} />
                      </div>
                      <div className="wc-footer" style={{ fontSize: '0.4rem', padding: '1px 0' }}>ZOCA</div>
                      {isShiny && <div className="wc-hologram" />}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="album-footer">
              <button className="btn-secondary" onClick={() => updateState({ currentScreen: 'packs' })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </svg>
                <span>Pacotinhos</span>
              </button>
              <div className="sticker-progress">
                <span className="progress-text">
                  <span>{state.stickersPlaced.filter((v) => v).length}</span>/12 coladas
                </span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(state.stickersPlaced.filter((v) => v).length / 12) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ===================== PHOTO SOURCE SELECTOR DIALOG ===================== */}
      <AnimatePresence>
        {showPhotoSourceDialog && (
          <div className="overlay show" onClick={() => setShowPhotoSourceDialog(false)}>
            <motion.div
              className="overlay-content"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <h3>Como quer adicionar a foto?</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(90, 58, 58, 0.7)', marginBottom: '20px' }}>
                Tire uma foto agora para registrar esse momento ou escolha uma da galeria!
              </p>
              <div className="overlay-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setShowPhotoSourceDialog(false);
                  }}
                  style={{ gap: '10px', justifyContent: 'center' }}
                >
                  📸 Tirar Foto
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowPhotoSourceDialog(false);
                  }}
                  style={{ gap: '10px', justifyContent: 'center' }}
                >
                  📁 Escolher da Galeria
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setShowPhotoSourceDialog(false)}
                  style={{ marginTop: '12px', fontSize: '0.85rem', color: 'rgba(90, 58, 58, 0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== HIDDEN INPUTS ===================== */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoUpload}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={handlePhotoUpload}
      />

      {/* ===================== CUSTOM TOAST NOTIFICATION ===================== */}
      <AnimatePresence>
        {toast !== null && (
          <motion.div
            className="custom-toast"
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 250, damping: 22 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== ZOOM IMAGE LIGHTBOX MODAL ===================== */}
      <AnimatePresence>
        {zoomedImage !== null && (
          <div className="overlay show zoomed-image-overlay" onClick={() => { setZoomedImage(null); setZoomedImageCaption(null); }} style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
              className="zoomed-image-container"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '90vw', maxHeight: '90vh' }}
            >
              <img src={zoomedImage} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', border: '4px solid white', boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }} alt="Figurinha Ampliada" />
              {zoomedImageCaption && (
                <div style={{ color: 'white', marginTop: '10px', fontSize: '1.2rem', fontFamily: 'var(--font-script)', textShadow: '1px 1px 3px rgba(0,0,0,0.8)', textAlign: 'center' }}>
                  {zoomedImageCaption}
                </div>
              )}
              <button
                onClick={() => { setZoomedImage(null); setZoomedImageCaption(null); }}
                style={{
                  position: 'absolute',
                  top: '-15px',
                  right: '-15px',
                  background: '#E8839A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
