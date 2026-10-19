import React, { useEffect, useState } from 'react';
import { 
  Home, Search, Heart, MessageSquare, User, Building2, UserCheck, 
  Sparkles, Grid, X, FileText, Briefcase, Shield, LogOut, ChevronRight, CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { chatService } from '../../services/chatService';

interface BottomNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onOpenAuth: () => void;
  onLogout?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const { t } = useLanguage();
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Fetch real unread count for chat if user is logged in
  useEffect(() => {
    if (!user) {
      setUnreadChatCount(0);
      return;
    }

    let isSubscribed = true;
    const checkUnread = async () => {
      try {
        const chats = await chatService.getChats();
        if (isSubscribed) {
          const totalUnread = chats.reduce((acc, chat) => acc + (chat.unread_count || 0), 0);
          setUnreadChatCount(totalUnread);
        }
      } catch (e) {
        // ignore error silently
      }
    };

    checkUnread();

    const interval = setInterval(checkUnread, 15000);
    window.addEventListener('ergon_chat_updated', checkUnread);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      window.removeEventListener('ergon_chat_updated', checkUnread);
    };
  }, [user]);

  const isEmployer = user?.role === 'employer';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    {
      id: 'home',
      label: t('nav.home') || 'Главная',
      icon: Home,
      protected: false,
    },
    {
      id: 'jobs',
      label: isEmployer ? (t('nav.candidates') || 'Кандидаты') : (t('nav.jobs') || 'Поиск'),
      icon: isEmployer ? UserCheck : Search,
      protected: false,
    },
    {
      id: 'favorites',
      label: t('nav.favorites') || 'Избранное',
      icon: Heart,
      protected: false,
    },
    {
      id: 'chat',
      label: t('nav.messages') || 'Чаты',
      icon: MessageSquare,
      protected: true,
      badge: unreadChatCount > 0 ? (unreadChatCount > 9 ? '9+' : unreadChatCount) : null,
    },
    {
      id: 'menu',
      label: t('nav.menu'),
      icon: Grid,
      protected: false,
      isMenuTrigger: true,
    },
  ];

  const handleTabClick = (item: typeof navItems[0]) => {
    if (item.isMenuTrigger) {
      setIsMenuOpen(!isMenuOpen);
      return;
    }

    setIsMenuOpen(false);

    if (item.protected && !user) {
      onOpenAuth();
      return;
    }
    setActiveTab(item.id);
  };

  const handleQuickNav = (tabId: string, isProtected = false) => {
    setIsMenuOpen(false);
    if (isProtected && !user) {
      onOpenAuth();
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <>
      {/* ── 1. FLOATING BOTTOM NAVIGATION BAR ── */}
      <nav
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 max-w-md mx-auto z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl shadow-indigo-500/20 transition-all duration-300 select-none p-1.5"
        aria-label="Парящая нижняя навигация"
      >
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isMenuTrigger = item.isMenuTrigger;
            const isActive =
              isMenuTrigger
                ? isMenuOpen || ['profile', 'employer', 'resumes', 'my_jobs', 'applications', 'ai_consultant', 'admin'].includes(activeTab)
                : activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                aria-label={item.label}
                className={`relative flex flex-col items-center justify-center flex-1 h-full py-0.5 rounded-2xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
                }`}
              >
                {/* Active Capsule Backdrop */}
                {isActive && (
                  <span className="absolute inset-0 bg-indigo-50/80 dark:bg-indigo-950/70 rounded-2xl border border-indigo-100/60 dark:border-indigo-800/60 transition-all duration-200 shadow-2xs" />
                )}

                {/* Icon Container */}
                <div className="relative z-10 flex flex-col items-center">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-[1.8px]'}`} />

                  {/* Unread badge */}
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900 animate-pulse">
                      {item.badge}
                    </span>
                  )}

                  {/* Label */}
                  <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[60px] text-center">
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── 2. MOBILE FLOATING SIDEBAR DRAWER (BOTTOM SHEET) ── */}
      {isMenuOpen && (
        <div 
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 z-50 md:hidden bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in flex flex-col justify-end"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom-6 duration-200 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Top Bar / Drag Handle */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Summary Card inside Mobile Menu */}
            {user ? (
              <div 
                onClick={() => handleQuickNav(isEmployer ? 'employer' : 'profile')}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between cursor-pointer active:scale-98 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-sm">
                    <img 
                      src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
                      alt="Avatar" 
                      className="w-full h-full rounded-[10px] object-cover bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                      {user.company_name || user.full_name || user.username || 'Пользователь'}
                      {user.is_email_verified && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 inline" />}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {isEmployer ? 'Кабинет работодателя' : 'Кабинет соискателя'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            ) : (
              <div 
                onClick={() => { setIsMenuOpen(false); onOpenAuth(); }}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between cursor-pointer shadow-md active:scale-98 transition-transform"
              >
                <div>
                  <h4 className="text-xs font-black">Войти или Зарегистрироваться</h4>
                  <p className="text-[10px] text-indigo-100 font-medium">Доступ ко всем возможностям HamKor</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white" />
              </div>
            )}

            {/* Quick Actions List (Mobile Sidebar items) */}
            <div className="space-y-1.5 pt-1">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-1">
                Навигация по разделам
              </h5>

              {/* AI Consultant */}
              <button
                onClick={() => handleQuickNav('ai_consultant')}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === 'ai_consultant' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-slate-50 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 animate-pulse text-amber-400" />
                  <span>ИИ-Консультант & Карьерный Помощник</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              {/* Resumes (Worker) */}
              {!isEmployer && (
                <button
                  onClick={() => handleQuickNav('resumes', true)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'resumes' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>Конструктор Резюме (AI)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              )}

              {/* Employer My Jobs */}
              {isEmployer && (
                <button
                  onClick={() => handleQuickNav('my_jobs', true)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'my_jobs' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4 h-4 text-indigo-500" />
                    <span>Мои Вакансии</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              )}

              {/* Applications */}
              <button
                onClick={() => handleQuickNav('applications', true)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === 'applications' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>Отклики & Заявки</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              {/* Admin Panel */}
              {isAdmin && (
                <button
                  onClick={() => handleQuickNav('admin')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'admin' 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4" />
                    <span>Панель Администратора</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-70" />
                </button>
              )}

              {/* Logout Button if user logged in */}
              {user && onLogout && (
                <button
                  onClick={() => { setIsMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all mt-2"
                >
                  <div className="flex items-center gap-2.5">
                    <LogOut className="w-4 h-4" />
                    <span>Выйти из аккаунта</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
