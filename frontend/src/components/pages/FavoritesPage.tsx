import React, { useState, useEffect } from 'react';
import { Bookmark, Heart, Briefcase, Users, Building2, Trash2, ArrowRight, Sparkles, Search, MessageSquare, Eye } from 'lucide-react';
import { favoriteService } from '../../services/api';
import { FavoriteItem, Job, Candidate } from '../../types';
import { JobCard } from '../jobs/JobCard';

interface FavoritesPageProps {
  onSelectJob: (job: Job) => void;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigateToCatalog: () => void;
  onNavigateToCandidates: () => void;
  user?: any;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  onSelectJob,
  onSelectCandidate,
  onNavigateToCatalog,
  onNavigateToCandidates,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'job' | 'worker' | 'company'>('job');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const res = await favoriteService.getFavorites(activeTab);
      setFavorites(res.items || []);
    } catch (err) {
      console.error('Error loading favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
    const handleRefresh = () => loadFavorites();
    window.addEventListener('ergon_favorites_updated', handleRefresh);
    return () => window.removeEventListener('ergon_favorites_updated', handleRefresh);
  }, [activeTab]);

  const handleRemoveFavorite = async (targetType: 'job' | 'worker' | 'company', targetId: string) => {
    try {
      await favoriteService.removeFavorite(targetType, targetId);
      setFavorites((prev) => prev.filter((item) => item.target_id !== targetId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-xs font-bold border border-white/10">
            <Heart className="w-3.5 h-3.5 fill-indigo-300 text-indigo-300" />
            <span>Ваша личная подборка</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Избранное
          </h1>
          <p className="text-sm text-indigo-200/90 font-medium max-w-xl">
            Сохраненные вакансии, интересующие резюме кандидатов и проверенные компании в одном месте.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 z-10">
          <button
            onClick={() => setActiveTab('job')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'job'
                ? 'bg-white text-indigo-950 shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Вакансии</span>
          </button>

          <button
            onClick={() => setActiveTab('worker')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'worker'
                ? 'bg-white text-indigo-950 shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Кандидаты</span>
          </button>

          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'company'
                ? 'bg-white text-indigo-950 shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Компании</span>
          </button>
        </div>
      </div>

      {/* Main Content List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 space-y-4 animate-pulse">
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md w-1/2" />
              <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-xl" />
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 border border-slate-200 dark:border-slate-700 shadow-sm text-center max-w-xl mx-auto space-y-6 animate-scale-up">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/60 rounded-3xl text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner border border-indigo-100 dark:border-indigo-800/60">
            <Heart className="w-10 h-10 text-indigo-500 dark:text-indigo-400 stroke-[1.5]" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {activeTab === 'job' && 'У вас пока нет сохраненных вакансий'}
              {activeTab === 'worker' && 'У вас пока нет сохраненных кандидатов'}
              {activeTab === 'company' && 'У вас пока нет сохраненных компаний'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-md mx-auto">
              Нажимайте на значок сердечка на карточках, чтобы добавлять важные позиций или профили в свой список избранного.
            </p>
          </div>

          <div className="pt-2">
            {activeTab === 'job' ? (
              <button
                onClick={onNavigateToCatalog}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition-all active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span>Перейти в Каталог Вакансий</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onNavigateToCandidates}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition-all active:scale-95"
              >
                <Users className="w-4 h-4" />
                <span>Искать Кандидатов</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Favorites Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((fav) => {
            const details = fav.target_details;

            if (fav.target_type === 'job') {
              const job: Job = details || {
                id: fav.target_id,
                title: 'Вакансия',
                description: '',
                currency: 'TJS',
                location: 'Душанбе',
                employment_type: 'full_time',
                status: 'open',
                created_at: fav.created_at,
                updated_at: fav.created_at
              };

              return (
                <div key={fav.id} className="relative group">
                  <JobCard job={job} onSelectJob={() => onSelectJob(job)} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite('job', fav.target_id);
                    }}
                    title="Удалить из избранного"
                    className="absolute top-4 right-4 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-rose-200 dark:border-rose-900/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            if (fav.target_type === 'worker') {
              const candidate = details;
              const name = candidate?.user?.full_name || candidate?.full_name || 'Соискатель';
              const pos = candidate?.desired_position || 'Специалист';
              const city = candidate?.user?.city || candidate?.city || 'Таджикистан';

              return (
                <div
                  key={fav.id}
                  onClick={() => candidate && onSelectCandidate(candidate)}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:shadow-lg transition-all duration-300 relative group cursor-pointer space-y-4"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite('worker', fav.target_id);
                    }}
                    title="Удалить из избранного"
                    className="absolute top-4 right-4 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 transition-all shadow-sm border border-rose-200 dark:border-rose-900/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-md">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">{name}</h4>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{pos}</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{city}</p>
                    </div>
                  </div>

                  {candidate?.skills && candidate.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {candidate.skills.slice(0, 4).map((s: any, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                          {s.name || s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    {candidate && candidate.user_id && !candidate.is_external ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCandidate(candidate);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Написать</span>
                      </button>
                    ) : null}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (candidate) onSelectCandidate(candidate);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs border border-indigo-200/80 dark:border-indigo-800/60 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Посмотреть резюме</span>
                    </button>
                  </div>
                </div>
              );
            }

            if (fav.target_type === 'company') {
              const company = details;
              const name = company?.company_name || 'Компания';
              const industry = company?.industry || 'Бизнес и Услуги';

              return (
                <div
                  key={fav.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:shadow-lg transition-all duration-300 relative group space-y-4"
                >
                  <button
                    onClick={() => handleRemoveFavorite('company', fav.target_id)}
                    title="Удалить из избранного"
                    className="absolute top-4 right-4 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 transition-all shadow-sm border border-rose-200 dark:border-rose-900/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                      <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">{name}</h4>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{industry}</p>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

    </div>
  );
};
