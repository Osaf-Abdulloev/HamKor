import React, { useState, useEffect } from 'react';
import { Globe, LogIn, LogOut, User as UserIcon, ChevronDown, Shield, Heart, Sun, Moon, Monitor, Bell, CheckCheck, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Language } from '../../i18n/translations';
import { getSavedUserProfile, DEFAULT_USER_AVATAR } from '../../services/matchService';
import { useTheme, Theme } from '../../theme/ThemeContext';
import { notificationService } from '../../services/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onOpenAuth: () => void;
  onLogout: () => void;
  currentLang: string;
  onChangeLang: (lang: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAuth,
  onLogout,
  currentLang,
  onChangeLang,
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [navAvatar, setNavAvatar] = useState<string>(DEFAULT_USER_AVATAR);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { language, setLanguage, t } = useLanguage();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const updateNavAvatar = () => {
    const saved = getSavedUserProfile();
    if (saved && saved.avatar_url) {
      setNavAvatar(saved.avatar_url);
    } else if (user && user.avatar_url) {
      setNavAvatar(user.avatar_url);
    } else {
      setNavAvatar(DEFAULT_USER_AVATAR);
    }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem('ergon_token') || localStorage.getItem('ergon_access_token');
    if (!user || !token) return;
    try {
      const data = await notificationService.getNotifications(20);
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      // ignore
    }
  };


  useEffect(() => {
    updateNavAvatar();

    const handleProfileChange = () => {
      updateNavAvatar();
    };

    window.addEventListener('ergon_profile_updated', handleProfileChange);
    window.addEventListener('ergon_user_updated', handleProfileChange);
    window.addEventListener('storage', handleProfileChange);
    return () => {
      window.removeEventListener('ergon_profile_updated', handleProfileChange);
      window.removeEventListener('ergon_user_updated', handleProfileChange);
      window.removeEventListener('storage', handleProfileChange);
    };
  }, [user]);

  // Live WebSocket Connection for Real-Time In-App Notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const token = localStorage.getItem('ergon_token') || localStorage.getItem('ergon_access_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/v1/notifications/ws?token=${token}`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);

      socket.onerror = () => {
        // silence socket disconnect errors
      };
      socket.onclose = () => {
        // silence socket close errors
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'new_notification' && payload.notification) {
            setNotifications((prev) => [payload.notification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        } catch (err) {
          // ignore
        }
      };

      const keepAlive = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send('{"event": "ping"}');
        }
      }, 25000);

      return () => {
        clearInterval(keepAlive);
        if (socket) socket.close();
      };
    } catch (e) {
      // ws error handling
    }
  }, [user]);

  const languages: { code: Language; label: string; displayCode: string }[] = [
    { code: 'ru', label: 'Русский', displayCode: 'RU' },
    { code: 'tj', label: 'Тоҷикӣ', displayCode: 'TJ' },
    { code: 'en', label: 'English', displayCode: 'EN' },
  ];

  const themeOptions: { code: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { code: 'light', label: 'Светлая', icon: Sun },
    { code: 'dark', label: 'Тёмная', icon: Moon },
    { code: 'system', label: 'Системная', icon: Monitor },
  ];

  const currentDisplayLang = language.toUpperCase();

  const handleSelectLanguage = (langCode: Language) => {
    setLanguage(langCode);
    onChangeLang(langCode.toUpperCase());
    setIsLangOpen(false);
  };

  const handleSelectTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsThemeOpen(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      // ignore
    }
  };

  const CurrentThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* 1. Clean Brand Logo */}
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 cursor-pointer select-none group shrink-0"
        >
          <div className="h-14 sm:h-16 flex items-center group-hover:scale-105 transition-transform overflow-visible">
            <img 
              src={resolvedTheme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} 
              alt="HamKor Logo" 
              className="h-10 sm:h-14 md:h-16 w-auto object-contain max-h-16 scale-100 sm:scale-125 origin-left drop-shadow-sm" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
        </div>

        {/* Right Section: Language Switcher, Theme Switcher, Notifications, Post Job & User Auth */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

          {/* Favorites Header Button (Desktop view, since Bottom Nav has Favorites on mobile) */}
          <button
            onClick={() => setActiveTab('favorites')}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all shadow-2xs ${
              activeTab === 'favorites'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Избранное"
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === 'favorites' ? 'text-white fill-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>{t('nav.favorites')}</span>
          </button>

          {/* Real-time Notification Bell Dropdown (for Logged In Users) */}
          {user && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  setIsLangOpen(false);
                  setIsThemeOpen(false);
                }}
                className="relative flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all shadow-2xs"
                title="Уведомления"
              >
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">Уведомления</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-full">
                          {unreadCount} новых
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Прочитать все</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                        У вас пока нет новых уведомлений
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-left transition-colors ${
                            !n.is_read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{n.title}</span>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {n.body}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                            {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post Job button (HIDDEN for Workers, only shown for Employers and Admins or Guests) */}
          {(user?.role === 'employer' || user?.role === 'admin' || !user) && (
            <button
              onClick={() => {
                if (user?.role === 'employer') {
                  setActiveTab('employer');
                } else if (!user) {
                  onOpenAuth();
                } else {
                  setActiveTab('employer');
                }
              }}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
            >
              <span>{t('nav.post_job')}</span>
            </button>
          )}

          {/* Admin Dashboard link for Admin Role */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition-all active:scale-95 ${
                activeTab === 'admin'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t('nav.admin')}</span>
            </button>
          )}

          {/* Theme Toggle Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsThemeOpen(!isThemeOpen);
                setIsLangOpen(false);
                setIsNotifOpen(false);
              }}
              className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all shadow-2xs"
              title="Переключить тему"
            >
              <CurrentThemeIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </button>

            {isThemeOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 animate-fade-in">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = theme === opt.code;
                  return (
                    <button
                      key={opt.code}
                      onClick={() => handleSelectTheme(opt.code)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-2 ${
                        isSelected 
                          ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/70 dark:bg-indigo-950/50' 
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsLangOpen(!isLangOpen);
                setIsThemeOpen(false);
                setIsNotifOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{currentDisplayLang}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 animate-fade-in">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors ${
                      language === lang.code ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/70 dark:bg-indigo-950/50' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile Cabinet & Logout Buttons */}
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (user?.role === 'employer') {
                    setActiveTab('employer');
                  } else if (user?.role === 'admin') {
                    setActiveTab('admin');
                  } else {
                    setActiveTab('profile');
                  }
                }}
                className="flex items-center gap-2 p-1.5 pl-3 rounded-xl border border-indigo-200 dark:border-slate-700 bg-indigo-50/70 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 transition-all shadow-2xs group cursor-pointer active:scale-95"
                title="Перейти в личный кабинет"
              >
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 hidden sm:inline">
                  Перейти в кабинет
                </span>
                <img
                  src={navAvatar}
                  alt="Avatar"
                  className="w-7 h-7 rounded-lg object-cover ring-2 ring-indigo-600/40 group-hover:scale-105 transition-transform"
                  onError={() => setNavAvatar(DEFAULT_USER_AVATAR)}
                />
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-extrabold transition-all active:scale-95 shadow-2xs"
                title="Выйти из аккаунта"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Выйти</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs shadow-md transition-all active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('nav.login')}</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
