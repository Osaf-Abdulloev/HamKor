import React, { useState } from 'react';
import { Bot, Sparkles, X, MessageSquare, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FloatingAIButtonProps {
  onNavigateToAIConsultant: (initialQuery?: string) => void;
}

export const FloatingAIButton: React.FC<FloatingAIButtonProps> = ({ onNavigateToAIConsultant }) => {
  const { t } = useLanguage();
  const [showQuickTooltip, setShowQuickTooltip] = useState(false);

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end pointer-events-auto">
      {/* Quick Hover Tooltip */}
      {showQuickTooltip && (
        <div className="mb-3 p-4 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-indigo-500/30 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
              HamKor AI Assistant
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowQuickTooltip(false); }}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            Спросите ИИ о вакансиях, составлении резюме или оценке ваших шансов!
          </p>
          <button
            onClick={() => {
              setShowQuickTooltip(false);
              onNavigateToAIConsultant();
            }}
            className="w-full py-1.5 px-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/25 transition-all"
          >
            <span>Запустить ИИ-консультанта</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => onNavigateToAIConsultant()}
        onMouseEnter={() => setShowQuickTooltip(true)}
        className="group relative flex items-center justify-center p-4 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20"
        title="HamKor AI Assistant"
      >
        {/* Glow backdrop pulse */}
        <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 opacity-70 blur-md group-hover:opacity-100 transition duration-500 animate-pulse" />

        <div className="relative flex items-center gap-2">
          <Bot className="w-7 h-7 text-white animate-bounce" style={{ animationDuration: '3s' }} />
          <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
          <span className="hidden group-hover:inline-block font-bold text-sm pr-1 transition-all duration-200">
            ИИ Помощник
          </span>
        </div>
      </button>
    </div>
  );
};
