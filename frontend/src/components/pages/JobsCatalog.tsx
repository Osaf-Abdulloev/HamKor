import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Bookmark, Building2, ChevronLeft, ChevronRight, ExternalLink, Sparkles, MapPin, Zap, RefreshCw, Layers } from 'lucide-react';
import { Job } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { jobService } from '../../services/api';
import { getSavedUserProfile, evaluateProfileJobMatch } from '../../services/matchService';

interface JobsCatalogProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  initialSearch?: string;
}

// Helper to parse query parameters from hash or search string
const parseUrlParams = () => {
  const hash = window.location.hash || '';
  const searchPart = hash.includes('?') ? hash.split('?')[1] : window.location.search.replace('?', '');
  const params = new URLSearchParams(searchPart);
  return {
    page: parseInt(params.get('page') || '1', 10),
    search: params.get('search') || '',
    city: params.get('city') || 'all',
    category: params.get('category') || 'all',
    source: params.get('source') || 'all',
  };
};

export const JobsCatalog: React.FC<JobsCatalogProps> = ({
  jobs: initialPropJobs,
  onSelectJob,
  initialSearch = '',
}) => {
  const { t } = useLanguage();
  const initialUrlState = useMemo(() => parseUrlParams(), []);

  const [searchTerm, setSearchTerm] = useState(initialUrlState.search || initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialUrlState.category);
  const [selectedCity, setSelectedCity] = useState<string>(initialUrlState.city);
  const [selectedSource, setSelectedSource] = useState<string>(initialUrlState.source);
  const [currentPage, setCurrentPage] = useState(initialUrlState.page);

  const [catalogJobs, setCatalogJobs] = useState<Job[]>(initialPropJobs);
  const [totalJobs, setTotalJobs] = useState<number>(initialPropJobs.length || 0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const itemsPerPage = 20;

  // Sync state to URL hash
  const updateUrl = useCallback((page: number, search: string, city: string, cat: string, src: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (search.trim()) params.set('search', search.trim());
    if (city !== 'all') params.set('city', city);
    if (cat !== 'all' && cat !== 'All Roles') params.set('category', cat);
    if (src !== 'all') params.set('source', src);

    const queryString = params.toString();
    const newHash = queryString ? `#jobs?${queryString}` : '#jobs';
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, []);

  // Fetch jobs from backend API directly
  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await jobService.getJobs({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm.trim() || undefined,
        location: selectedCity !== 'all' ? selectedCity : undefined,
        category: (selectedCategory !== 'all' && selectedCategory !== 'All Roles' && selectedCategory !== t('catalog.cat_all')) ? selectedCategory : undefined,
        source: selectedSource !== 'all' ? selectedSource : undefined,
      });

      if (res && res.items) {
        setCatalogJobs(res.items);
        setTotalJobs(res.total || res.items.length);
        setTotalPages(res.pages || Math.ceil((res.total || res.items.length) / itemsPerPage) || 1);
      }
    } catch (err) {
      console.error('Error fetching catalog jobs from server:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, selectedCity, selectedCategory, selectedSource, t]);

  useEffect(() => {
    fetchJobs();
    updateUrl(currentPage, searchTerm, selectedCity, selectedCategory, selectedSource);
  }, [fetchJobs, updateUrl, currentPage, searchTerm, selectedCity, selectedCategory, selectedSource]);

  const categories = [
    t('catalog.cat_all'),
    'IT & Технологии',
    'Маркетинг & PR',
    'Финансы и банки',
    'Торговля & Продажи',
    'Рестораторы, повара, официанты',
    'Логистика & Транспорт',
    'Медицина & Фармацевтика'
  ];

  const sources = [
    { id: 'all', label: 'Все источники' },
    { id: 'yora.tj', label: 'Yora.tj' },
    { id: 'somon.tj', label: 'Somon.tj' },
    { id: 'direct', label: 'Прямые работодатели' }
  ];

  const userProfile = useMemo(() => {
    return getSavedUserProfile();
  }, []);

  const evaluateJobWithProfile = (job: Job) => {
    return evaluateProfileJobMatch(job, userProfile);
  };

  const formatSalary = (job: Job) => {
    if (job.salary_min && job.salary_max) {
      return `${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()} ${job.currency || 'TJS'}`;
    }
    if (job.salary_min) return `${t('catalog.salary_min')} ${job.salary_min.toLocaleString()} ${job.currency || 'TJS'}`;
    if (job.salary_max) return `${t('catalog.salary_max')} ${job.salary_max.toLocaleString()} ${job.currency || 'TJS'}`;
    return t('catalog.salary_negotiable');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCity('all');
    setSelectedCategory('all');
    setSelectedSource('all');
    setCurrentPage(1);
  };

  // Generate pagination numbers array e.g. [1, 2, 3, '...', 426]
  const paginationPages = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      
      {/* Search Bar Hero Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl space-y-6 border border-indigo-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t('catalog.title')}</h1>
            <p className="text-xs sm:text-sm text-indigo-200 font-medium">
              {isLoading
                ? 'Загрузка реальных вакансий из базы PostgreSQL...'
                : `Найдено ${totalJobs.toLocaleString()} активных вакансий`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              База данных PostgreSQL
            </span>
          </div>
        </div>

        {/* High-Visibility Search Input Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-2 bg-white/10 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/20 dark:border-slate-700 shadow-2xl">
          <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl w-full flex-1 border border-slate-200 dark:border-slate-700">
            <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <input
              type="text"
              placeholder="Поиск по названию вакансии, компании, описанию или навыкам..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-sm font-semibold outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="text-xs font-extrabold text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* City Selector Dropdown */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-56 shrink-0">
            <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs font-bold outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              <option value="all" className="dark:bg-slate-800">Все города</option>
              <option value="Душанбе" className="dark:bg-slate-800">г. Душанбе</option>
              <option value="Худжанд" className="dark:bg-slate-800">г. Худжанд</option>
              <option value="Бохтар" className="dark:bg-slate-800">г. Бохтар</option>
              <option value="Куляб" className="dark:bg-slate-800">г. Куляб</option>
              <option value="Истаравшан" className="dark:bg-slate-800">г. Истаравшан</option>
              <option value="Турсунзаде" className="dark:bg-slate-800">г. Турсунзаде</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Toolbar: Sources & Categories */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Layers className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
            {sources.map((src) => (
              <button
                key={src.id}
                onClick={() => {
                  setSelectedSource(src.id);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
                  selectedSource === src.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>

          {(searchTerm || selectedCity !== 'all' || selectedCategory !== 'all' || selectedSource !== 'all') && (
            <button
              onClick={clearFilters}
              className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Сбросить все фильтры</span>
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Pills Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat || (cat === t('catalog.cat_all') && selectedCategory === 'all');
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat === t('catalog.cat_all') ? 'all' : cat);
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-700/60 rounded w-1/2" />
                </div>
              </div>
              <div className="h-12 bg-slate-100 dark:bg-slate-700/40 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <div className="p-12 text-center space-y-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Не удалось загрузить вакансии из базы данных.</p>
          <button
            onClick={fetchJobs}
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition-all active:scale-95"
          >
            Повторить попытку
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && catalogJobs.length === 0 && (
        <div className="p-12 text-center space-y-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mx-auto text-indigo-600">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Вакансии не найдены</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Попробуйте изменить параметры поиска или сбросить фильтры.</p>
          </div>
          <button
            onClick={clearFilters}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all"
          >
            Сбросить фильтры
          </button>
        </div>
      )}

      {/* Grid of Real Vacancies */}
      {!isLoading && !isError && catalogJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalogJobs.map((job) => {
            if (!job) return null;
            const { matchScore } = evaluateJobWithProfile(job);
            const sourceName = job.external_source || (job.is_external ? 'Внешний' : 'HamKor Direct');

            return (
              <div 
                key={job.id} 
                className="ref-card p-5 space-y-3.5 hover:shadow-md transition-all bg-white dark:bg-slate-800 border border-[#e8e6e5] dark:border-slate-700 flex flex-col justify-between rounded-2xl"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        sourceName.includes('yora')
                          ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60'
                          : sourceName.includes('somon')
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                      }`}>
                        Источник: {sourceName}
                      </span>
                      {matchScore > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          🎯 {matchScore}%
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                      {formatSalary(job)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {job?.external_company_logo ? (
                        <img src={job.external_company_logo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                          {((job?.external_company_name || job?.title || 'H')[0] || 'H').toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <h4 
                        onClick={() => onSelectJob(job)}
                        className="text-sm font-extrabold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer line-clamp-1 transition-colors"
                      >
                        {job.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{job.external_company_name || 'Работодатель'}</span>
                        <span>•</span>
                        <span className="shrink-0">{job.location}</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-normal">
                    {job.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">
                    {job.published_at ? new Date(job.published_at).toLocaleDateString('ru-RU') : new Date(job.created_at).toLocaleDateString('ru-RU')}
                  </span>

                  <button 
                    onClick={() => onSelectJob(job)}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Подробнее</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Страница {currentPage} из {totalPages.toLocaleString()} ({totalJobs.toLocaleString()} вакансий)
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>

            {paginationPages.map((pg, idx) => (
              <React.Fragment key={idx}>
                {pg === '...' ? (
                  <span className="px-2 text-xs text-slate-400 font-black">...</span>
                ) : (
                  <button
                    onClick={() => handlePageChange(pg as number)}
                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                      currentPage === pg
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pg}
                  </button>
                )}
              </React.Fragment>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-all"
            >
              Вперёд <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
