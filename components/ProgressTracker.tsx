import React, { useEffect, useRef } from 'react';
import { CheckCircle, Loader, Sparkles } from 'lucide-react';

interface ProgressTrackerProps {
  currentStep: number; // 0-15 (0 = not started, 15 = complete)
  isActive: boolean;
  lang: 'uz' | 'en';
}

const TOTAL_STEPS = 15;

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ currentStep, isActive, lang }) => {
  const progressRef = useRef<HTMLDivElement>(null);

  const clampedStep = Math.max(0, Math.min(TOTAL_STEPS, currentStep));
  const progressPercent = (clampedStep / TOTAL_STEPS) * 100;
  const isComplete = clampedStep === TOTAL_STEPS;

  const t = {
    uz: {
      title: 'Kompilyatsiya jarayoni',
      complete: 'Barcha promptlar tayyor!',
      generating: 'Generatsiya jarayonida...',
      waiting: 'Boshlash uchun tayyor',
      step: 'qadam',
    },
    en: {
      title: 'Compilation Progress',
      complete: 'All prompts compiled!',
      generating: 'Generating prompts...',
      waiting: 'Ready to start',
      step: 'step',
    },
  }[lang];

  // Auto-resize shimmer animation speed based on activity
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.width = `${progressPercent}%`;
    }
  }, [progressPercent]);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 sm:p-6 transition-all duration-500 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <Sparkles className="w-5 h-5 text-emerald-400" />
          ) : isActive ? (
            <Loader className="w-5 h-5 text-indigo-400 animate-spin" />
          ) : (
            <CheckCircle className="w-5 h-5 text-slate-600" />
          )}
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t.title}
          </h3>
        </div>

        {/* Status badge */}
        <span
          className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border transition-all duration-300 ${
            isComplete
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
              : isActive
              ? 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'
              : 'bg-slate-900/60 text-slate-500 border-slate-800/60'
          }`}
        >
          {isComplete ? '✓ ' : ''}{clampedStep} / {TOTAL_STEPS}
        </span>
      </div>

      {/* Progress bar track */}
      <div className="relative w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50 mb-4">
        {/* Animated fill */}
        <div
          ref={progressRef}
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPercent}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #059669, #10b981, #34d399)'
              : 'linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7, #7c3aed, #4f46e5)',
            backgroundSize: '200% 100%',
            animation: isActive && !isComplete ? 'shimmer 2s ease infinite' : 'none',
          }}
        />
        {/* Shimmer overlay on active bar */}
        {isActive && !isComplete && clampedStep > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-30"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease infinite',
            }}
          />
        )}
      </div>

      {/* Step dots grid */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap mb-4">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const stepNum = i + 1;
          const isStepComplete = stepNum <= clampedStep;
          const isCurrent = stepNum === clampedStep && isActive && !isComplete;

          return (
            <div
              key={i}
              className={`
                w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-500 ease-out
                ${
                  isStepComplete
                    ? isComplete
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                      : 'bg-indigo-500 shadow-sm shadow-indigo-500/30'
                    : 'bg-slate-700'
                }
                ${isCurrent ? 'animate-pulse ring-2 ring-indigo-400/50 scale-125' : ''}
              `}
              title={`${t.step} ${stepNum}`}
            />
          );
        })}
      </div>

      {/* Status text */}
      <div className="text-center">
        {isComplete ? (
          <div className="flex items-center justify-center gap-2 transition-all duration-500">
            <span className="text-lg">🎉</span>
            <p className="text-sm font-bold text-emerald-400" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t.complete}
            </p>
            <span className="text-lg">✨</span>
          </div>
        ) : isActive ? (
          <p className="text-xs text-indigo-300/80 font-medium animate-pulse" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t.generating}
          </p>
        ) : clampedStep === 0 ? (
          <p className="text-xs text-slate-500 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t.waiting}
          </p>
        ) : (
          <p className="text-xs text-slate-400 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
            {clampedStep} / {TOTAL_STEPS} {t.step}
          </p>
        )}
      </div>
    </div>
  );
};
