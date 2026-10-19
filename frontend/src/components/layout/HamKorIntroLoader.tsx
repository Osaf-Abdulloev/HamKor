import React, { useEffect, useState, useRef } from 'react';

interface HamKorIntroLoaderProps {
  onComplete: () => void;
}

export const HamKorIntroLoader: React.FC<HamKorIntroLoaderProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'intro' | 'approach' | 'handshake' | 'assemble' | 'text' | 'hold' | 'exit'>('intro');
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Check if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onCompleteRef.current();
      return;
    }

    // Safety fallback timer to prevent infinite blank overlay
    const safetyTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 4000);

    // 1. PARTICLES BACKGROUND CANVAS
    const canvas = canvasRef.current;
    if (!canvas) {
      onCompleteRef.current();
      clearTimeout(safetyTimer);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onCompleteRef.current();
      clearTimeout(safetyTimer);
      return;
    }

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = width < 768 ? 40 : 80;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4 - 0.2,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.005,
    }));

    const renderParticles = () => {
      ctx.clearRect(0, 0, width, height);

      // Radial Dark Blue Gradient
      const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height) * 0.7);
      grad.addColorStop(0, '#0b1329');
      grad.addColorStop(0.5, '#060a17');
      grad.addColorStop(1, '#02040a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.005;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.1, Math.min(0.8, p.alpha))})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#38bdf8';
        ctx.fill();
      });

      animId = requestAnimationFrame(renderParticles);
    };

    renderParticles();

    // 2. TIMELINE & PHASE CONTROLLER
    const startTime = Date.now();
    const duration = 3800; // Snappy 3.8s intro animation ms

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
    }, 20);

    const t1 = setTimeout(() => setPhase('approach'), 400);
    const t2 = setTimeout(() => setPhase('handshake'), 1200);
    const t3 = setTimeout(() => setPhase('assemble'), 1900);
    const t4 = setTimeout(() => setPhase('text'), 2500);
    const t5 = setTimeout(() => setPhase('hold'), 3100);
    const t6 = setTimeout(() => setPhase('exit'), 3500);
    const t7 = setTimeout(() => {
      clearInterval(progressInterval);
      cancelAnimationFrame(animId);
      onCompleteRef.current();
    }, 3800);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(progressInterval);
      cancelAnimationFrame(animId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
    };
  }, []);


  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#02040a] transition-all duration-700 select-none overflow-hidden ${
        phase === 'exit' ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top Header Branding Badge */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20 flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_#38bdf8]" />
        <span className="text-[11px] font-black tracking-widest text-slate-300 uppercase">
          HAMKOR.TJ &bull; OFFICIAL PLATFORM
        </span>
      </div>

      {/* Skip Button */}
      <button
        onClick={() => {
          setPhase('exit');
          setTimeout(onComplete, 400);
        }}
        className="absolute top-6 right-6 sm:top-8 sm:right-8 z-30 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-indigo-600/90 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-white text-xs font-extrabold transition-all shadow-lg backdrop-blur-md active:scale-95 flex items-center gap-2"
      >
        <span>Пропустить</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>

      {/* CENTER STAGE: THE ANIMATED HAMKOR LOGO ASSEMBLY */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4">
        
        {/* LOGO CONTAINER */}
        <div className="relative flex items-center justify-center min-h-[140px] sm:min-h-[180px]">

          {/* ── STAGE A: SEPARATED "H" LEGS & HANDSHAKE ASSEMBLY (Phases: intro, approach, handshake) ── */}
          {(phase === 'intro' || phase === 'approach' || phase === 'handshake') && (
            <div className="relative flex items-center justify-center gap-0">
              
              {/* LEFT H PILLAR */}
              <div
                className="transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform:
                    phase === 'intro'
                      ? 'translateX(-160px) rotateY(-25deg) scale(0.8)'
                      : phase === 'approach'
                      ? 'translateX(-22px) rotateY(-5deg) scale(1)'
                      : 'translateX(-4px) rotateY(0deg) scale(1)',
                  opacity: phase === 'intro' ? 0 : 1,
                }}
              >
                {/* SVG Left Pillar of H */}
                <svg width="68" height="110" viewBox="0 0 68 110" fill="none" className="drop-shadow-[0_0_20px_rgba(37,99,235,0.6)]">
                  <defs>
                    <linearGradient id="blueGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="40%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 12 5 C 28 5 36 5 44 14 C 44 24 38 34 32 40 L 32 70 C 38 76 44 86 44 96 C 36 105 28 105 12 105 C 5 105 5 95 5 80 L 5 30 C 5 15 5 5 12 5 Z"
                    fill="url(#blueGradLeft)"
                  />
                </svg>
              </div>

              {/* CENTER HANDSHAKE ICON (EMOTIONAL CLIMAX) */}
              <div
                className="relative z-10 transition-all duration-700 ease-out flex items-center justify-center"
                style={{
                  transform:
                    phase === 'handshake'
                      ? 'scale(1.15) rotate(0deg)'
                      : phase === 'approach'
                      ? 'scale(0.2) rotate(-15deg)'
                      : 'scale(0) rotate(-30deg)',
                  opacity: phase === 'handshake' ? 1 : phase === 'approach' ? 0.4 : 0,
                }}
              >
                {/* Radial Contact Shockwave Pulse on Handshake clasp */}
                {phase === 'handshake' && (
                  <div className="absolute w-28 h-28 rounded-full border-2 border-cyan-400/80 animate-ping shadow-[0_0_30px_#38bdf8]" />
                )}

                {/* Handshake SVG Icon */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-[0_0_35px_rgba(56,189,248,0.8)] flex items-center justify-center">
                  <div className="w-full h-full rounded-[14px] bg-[#091126] flex items-center justify-center p-2">
                    <svg viewBox="0 0 64 64" fill="none" className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-300">
                      <path
                        d="M16 28L28 16C30 14 34 14 36 16L40 20C42 22 42 26 40 28L26 42C24 44 20 44 18 42L16 40"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M48 28L36 40C34 42 30 42 28 40L24 36C22 34 22 30 24 28L38 14"
                        stroke="#60a5fa"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="32" cy="32" r="4" fill="#38bdf8" className="animate-pulse" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* RIGHT H PILLAR */}
              <div
                className="transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform:
                    phase === 'intro'
                      ? 'translateX(160px) rotateY(25deg) scale(0.8)'
                      : phase === 'approach'
                      ? 'translateX(22px) rotateY(5deg) scale(1)'
                      : 'translateX(4px) rotateY(0deg) scale(1)',
                  opacity: phase === 'intro' ? 0 : 1,
                }}
              >
                {/* SVG Right Pillar of H */}
                <svg width="68" height="110" viewBox="0 0 68 110" fill="none" className="drop-shadow-[0_0_20px_rgba(37,99,235,0.6)]">
                  <defs>
                    <linearGradient id="blueGradRight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="60%" stopColor="#1d4ed8" />
                      <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 56 5 C 40 5 32 5 24 14 C 24 24 30 34 36 40 L 36 70 C 30 76 24 86 24 96 C 32 105 40 105 56 105 C 63 105 63 95 63 80 L 63 30 C 63 15 63 5 56 5 Z"
                    fill="url(#blueGradRight)"
                  />
                </svg>
              </div>

            </div>
          )}

          {/* ── STAGE B: OFFICIAL COMPLETE BRAND LOGO IMAGE (Phases: assemble, text, hold) ── */}
          {(phase === 'assemble' || phase === 'text' || phase === 'hold') && (
            <div
              className="relative flex items-center justify-center transition-all duration-800 ease-out transform"
              style={{
                transform: phase === 'text' || phase === 'hold' ? 'scale(1.05)' : 'scale(0.95)',
                opacity: 1,
              }}
            >
              {/* Backlight Glow Behind Logo */}
              <div className="absolute inset-0 bg-blue-500/25 blur-3xl rounded-full scale-150 animate-pulse" />

              {/* Exact High-Resolution Brand Logo Image (ENLARGED) */}
              <img
                src="/logo-dark.png"
                alt="HamKor Logo"
                className="h-28 sm:h-40 w-auto object-contain relative z-10 drop-shadow-[0_0_45px_rgba(37,99,235,0.85)] scale-110 sm:scale-125 transition-all duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.png';
                }}
              />


              {/* Light Flare Sweep Across Logo */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent skew-x-12 animate-[shimmer_2s_infinite] pointer-events-none" />
            </div>
          )}

        </div>

        {/* SUBTITLE & BRAND SLOGAN REVEAL */}
        <div
          className="mt-6 text-center transition-all duration-700"
          style={{
            transform: phase === 'text' || phase === 'hold' ? 'translateY(0)' : 'translateY(16px)',
            opacity: phase === 'text' || phase === 'hold' ? 1 : 0,
          }}
        >
          <p className="text-xs sm:text-sm font-extrabold tracking-widest text-cyan-400 uppercase drop-shadow-[0_0_10px_#38bdf8]">
            ИНТЕЛЛЕКТУАЛЬНЫЙ ПОИСК РАБОТЫ И СПЕЦИАЛИСТОВ
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            Партнёрство &bull; Сотрудничество &bull; Возможности
          </p>
        </div>

      </div>

      {/* BOTTOM PROGRESS & STATUS BAR */}
      <div className="absolute bottom-8 sm:bottom-12 z-20 flex flex-col items-center gap-3 w-full max-w-xs px-6">
        <div className="flex items-center justify-between w-full text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
          <span>
            {phase === 'intro' && 'ИНИЦИАЛИЗАЦИЯ...'}
            {phase === 'approach' && 'ПОДКЛЮЧЕНИЕ СТОРОН...'}
            {phase === 'handshake' && 'СОЕДИНЕНИЕ РУКОПОЖАТИЯ...'}
            {phase === 'assemble' && 'СБОРКА HAMKOR...'}
            {(phase === 'text' || phase === 'hold') && 'ГОТОВО'}
            {phase === 'exit' && 'ДОБРО ПОЖАЛОВАТЬ'}
          </span>
          <span className="text-cyan-400 font-mono">{progress}%</span>
        </div>

        {/* Glowing Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-900/90 overflow-hidden border border-slate-800 p-0.5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 rounded-full transition-all duration-150 shadow-[0_0_14px_#38bdf8]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

    </div>
  );
};
