import React, { useState, useEffect } from 'react';
import { User as UserIcon, Briefcase, Search, FileText, Mail, Sparkles, LogIn, Lock, UserCheck, Heart, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getSavedUserProfile, getSavedEmployerProfile, DEFAULT_USER_AVATAR } from '../../services/matchService';
import { authService } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: any;
  onOpenAuth?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  user,
  onOpenAuth,
}) => {
  const { t } = useLanguage();
  const [profileAvatar, setProfileAvatar] = useState<string>(DEFAULT_USER_AVATAR);
  const [displayName, setDisplayName] = useState<string>(t('nav.guest'));
  const [displaySubtitle, setDisplaySubtitle] = useState<string>(t('nav.not_logged_in'));
  const [isVerifiedUser, setIsVerifiedUser] = useState<boolean>(false);
  const [badgeLabel, setBadgeLabel] = useState<string>('');
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);
  const [applicationsCount, setApplicationsCount] = useState<number>(0);

  const fetchBackendProfile = async () => {
    if (!user) {
      setDisplayName(t('nav.guest'));
      setDisplaySubtitle(t('nav.not_logged_in'));
      setProfileAvatar(DEFAULT_USER_AVATAR);
      setIsVerifiedUser(false);
      setBadgeLabel('');
      setActiveJobsCount(0);
      setApplicationsCount(0);
      return;
    }

    try {
      const data = await authService.getSidebarProfile();
      if (data) {
        setDisplayName(data.display_name || user.full_name || user.username || 'Пользователь');
        setDisplaySubtitle(data.subtitle || user.city || (user.role === 'employer' ? 'Компания' : 'Соискатель'));
        setProfileAvatar(data.avatar_url || user.avatar_url || DEFAULT_USER_AVATAR);
        setIsVerifiedUser(Boolean(data.is_email_verified));
        setBadgeLabel(data.badge_label || (user.role === 'employer' ? 'Работодатель' : 'Соискатель'));
        setActiveJobsCount(data.active_jobs_count || 0);
        setApplicationsCount(data.applications_count || 0);
        return;
      }
    } catch (err) {
      // fallback
    }

    setIsVerifiedUser(Boolean(user.is_email_verified));
    setProfileAvatar(user?.avatar_url || DEFAULT_USER_AVATAR);
    setDisplayName(user?.company_name || user?.full_name || user?.username || 'Пользователь');
    setDisplaySubtitle(user?.city || (user?.role === 'employer' ? 'Компания' : 'Соискатель'));
    setBadgeLabel(user?.role === 'employer' ? 'Работодатель' : 'Соискатель');
  };

  useEffect(() => {
    fetchBackendProfile();

    const handleProfileChange = () => {
      fetchBackendProfile();
    };

    window.addEventListener('ergon_profile_updated', handleProfileChange);
    window.addEventListener('storage', handleProfileChange);
    return () => {
      window.removeEventListener('ergon_profile_updated', handleProfileChange);
      window.removeEventListener('storage', handleProfileChange);
    };
  }, [user, t]);


  const allNavItems = [
    { id: 'profile', label: user?.role === 'employer' ? t('nav.company_profile') : t('nav.my_profile'), icon: user?.role === 'employer' ? Building2 : UserIcon, protected: true },
    ...(user?.role === 'employer' ? [{ id: 'my_jobs', label: t('nav.my_jobs'), icon: Briefcase, protected: true }] : []),
    ...(user?.role !== 'employer' ? [{ id: 'resumes', label: t('nav.ai_resumes'), icon: Sparkles, protected: true }] : []),
    { id: 'jobs', label: user?.role === 'employer' ? t('nav.all_candidates') : t('nav.all_jobs'), icon: user?.role === 'employer' ? UserCheck : Search, protected: false },
    { id: 'favorites', label: t('nav.favorites'), icon: Heart, protected: false },
    { id: 'applications', label: t('nav.applications'), icon: FileText, protected: true },
    { id: 'chat', label: t('nav.messages'), icon: Mail, protected: true },
  ];

  const handleNavClick = (itemId: string, isProtected: boolean) => {
    if (isProtected && !user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setActiveTab(itemId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6 flex flex-col md:flex-row gap-6 min-h-[calc(100vh-5rem)] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
      
      {/* Left Sidebar (Desktop Only) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 flex-col justify-between h-[calc(100vh-7rem)] sticky top-20 shadow-xl shadow-indigo-500/5 transition-all">
        
        <div className="space-y-5">
          
          {/* Dynamic User Profile Card */}
          {user ? (
            <div 
              onClick={() => setActiveTab('profile')}
              className="group relative p-3 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 dark:from-slate-800/90 dark:via-slate-800 dark:to-indigo-950/40 border border-indigo-100 dark:border-slate-700/80 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/80 hover:shadow-md transition-all duration-300 overflow-hidden"
            >
              {/* Subtle top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl p-0.5 bg-gradient-to-tr from-indigo-600 via-purple-500 to-indigo-400 shadow-sm group-hover:scale-105 transition-transform duration-300">
                    <img 
                      src={profileAvatar} 
                      alt="Avatar" 
                      className="w-full h-full rounded-[10px] object-cover bg-white dark:bg-slate-900"
                    />
                  </div>
                  {/* Online status indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full shadow-xs" />
                </div>

                <div className="overflow-hidden flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {displayName}
                    </h3>
                    {isVerifiedUser && (
                      <span title="Email подтвержден" className="inline-flex shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {displaySubtitle}
                  </p>

                  {/* Role Badge and Stats */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                      user.role === 'employer'
                        ? 'bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                        : 'bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                    }`}>
                      {user.role === 'employer' ? (
                        <>
                          <Building2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          <span>{badgeLabel || 'Работодатель'}</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{badgeLabel || 'Соискатель'}</span>
                        </>
                      )}
                    </span>

                    {user.role === 'employer' && activeJobsCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {activeJobsCount} вак.
                      </span>
                    )}
                    {user.role !== 'employer' && applicationsCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {applicationsCount} откл.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => onOpenAuth && onOpenAuth()}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white cursor-pointer hover:shadow-lg hover:shadow-indigo-500/25 transition-all group shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
                <LogIn className="w-5 h-5" />
              </div>
              <div className="overflow-hidden flex-1">
                <h3 className="text-xs font-black truncate">{t('nav.guest_login')}</h3>
                <p className="text-[10px] text-indigo-100 font-semibold truncate flex items-center gap-1 mt-0.5">
                  <span>{t('nav.login')} / Регистрация</span> →
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-1">
              {t('nav.dashboard_title')}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 font-medium">
              {t('nav.career_management')}
            </p>
          </div>

          {/* Navigation links with vibrant highlights */}
          <nav className="space-y-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id, item.protected)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20 translate-x-0.5'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </div>
                  {item.protected && !user && (
                    <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
              );
            })}
          </nav>

        </div>

        {/* Bottom Dedicated AI Consultant Button */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 mt-auto">
          <button
            onClick={() => setActiveTab('ai_consultant')}
            className={`w-full flex items-center justify-center gap-2.5 px-3.5 py-3 rounded-2xl text-xs font-black transition-all duration-300 shadow-sm ${
              activeTab === 'ai_consultant'
                ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-md shadow-indigo-500/30'
                : 'bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 dark:from-indigo-950/50 dark:via-purple-950/40 dark:to-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:shadow-md border border-indigo-200/60 dark:border-indigo-800/60'
            }`}
          >
            <Sparkles className={`w-4 h-4 animate-pulse ${activeTab === 'ai_consultant' ? 'text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>{t('nav.ai_consultant')}</span>
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden animate-fade-in">
        {children}
      </main>

    </div>
  );
};

