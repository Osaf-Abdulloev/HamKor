import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error Boundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 max-w-xl mx-auto space-y-4 shadow-sm my-12 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {this.props.fallbackMessage || 'Произошла непредвиденная ошибка отображения'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed max-w-md mx-auto">
              Попробуйте обновить страницу или вернуться на главную.
            </p>
            {this.state.error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 max-w-md mx-auto break-words select-all">
                {this.state.error.message || String(this.state.error)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('ergon_active_tab');
                } catch (e) {}
                this.setState({ hasError: false, error: null });
                window.location.hash = '#home';
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Обновить страницу</span>
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#home';
                window.dispatchEvent(new Event('hashchange'));
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>На главную</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
