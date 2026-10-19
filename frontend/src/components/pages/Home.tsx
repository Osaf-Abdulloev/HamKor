import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, CheckCircle2, Hand, Building2, ChevronRight, Sparkles, Eye, User, Briefcase, PlusCircle, ArrowRight, Bot, Loader2, MessageSquare, X } from 'lucide-react';
import { Job, Candidate } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { candidateService, aiService } from '../../services/api';
import { CandidateDetailModal } from '../candidates/CandidateDetailModal';
import { CandidatesCatalog } from '../candidates/CandidatesCatalog';
import { 
  getSavedUserProfile,
  getSavedEmployerProfile, 
  evaluateEmployerCandidateMatch, 
  sortCandidatesByEmployerMatch,
  evaluateProfileJobMatch
} from '../../services/matchService';

interface HomeProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onNavigateToJobs: (searchQuery?: string) => void;
  onNavigateToAIConsultant?: (initialQuery?: string) => void;
  user?: any;
  onOpenAuth?: () => void;
  onNavigateToPostJob?: () => void;
}

export const Home: React.FC<HomeProps> = ({
  jobs,
  onSelectJob,
  onNavigateToJobs,
  onNavigateToAIConsultant,
  user,
  onOpenAuth,
  onNavigateToPostJob
}) => {
  const { t } = useLanguage();
  const [positionQuery, setPositionQuery] = useState('');
  const [winW, setWinW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateModal, setSelectedCandidateModal] = useState<Candidate | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultModal, setAiResultModal] = useState<{
    query: string;
    answer: string;
    matchedJobs: Job[];
  } | null>(null);

  useEffect(() => {
    const handleResize = () => setWinW(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    candidateService.getCandidates({ limit: 20 }).then((res) => {
      if (res.items && res.items.length > 0) {
        setCandidates(res.items);
      }
    }).catch((err) => console.error('Error fetching candidates for home:', err));
  }, []);

  // Automatic role-based check
  const isEmployerMode = user?.role === 'employer';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryText = positionQuery.trim();
    if (queryText && onNavigateToAIConsultant) {
      onNavigateToAIConsultant(queryText);
    } else {
      onNavigateToJobs(queryText);
    }
  };

  const handleRecommendByProfile = () => {
    if (onNavigateToAIConsultant) {
      onNavigateToAIConsultant("🎯 Показать подходящие вакансии по моему профилю");
    } else {
      onNavigateToJobs('');
    }
  };

  // Read saved candidate profile from localStorage for smart match
  const userProfile = useMemo(() => {
    return getSavedUserProfile(user);
  }, [user]);

  const evaluateJobMatch = (job: Job) => {
    return evaluateProfileJobMatch(job, userProfile);
  };

  // Sort ALL jobs by candidate profile match score descending across the entire database
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const scoreA = a.match_score ?? evaluateJobMatch(a).matchScore;
      const scoreB = b.match_score ?? evaluateJobMatch(b).matchScore;
      return scoreB - scoreA;
    });
  }, [jobs, userProfile]);

  // Prepare up to 12 featured real jobs directly from PostgreSQL
  const featuredJobsList = useMemo(() => {
    return sortedJobs.slice(0, 12);
  }, [sortedJobs]);

  const defaultCandidateFallbacks: Candidate[] = [
    {
      id: 'c1',
      user_id: 'u1',
      desired_position: 'Бухгалтер по учету материалов',
      desired_salary: 6000,
      skills: [{ name: '1С:Бухгалтерия' }, { name: 'Налоги' }],
      experiences: [],
      user: { id: 'u1', email: 'ramzier@yora.tj', username: 'ramzier', full_name: 'Рамзиёр Шафиев', city: 'Душанбе', avatar_url: 'https://s3.twcstorage.ru/1f733599-3e211fde-2ba8-417c-b764-c3dd3da3cf2c/user_avatar_1147060.jpg', role: 'worker' }
    },
    {
      id: 'c2',
      user_id: 'u2',
      desired_position: 'Full Stack Developer',
      desired_salary: 10000,
      skills: [{ name: 'React' }, { name: 'Node.js' }],
      experiences: [],
      user: { id: 'u2', email: 'abdurahmon@yora.tj', username: 'abdurahmon', full_name: 'Abdurahmon Nazirov', city: 'Душанбе', avatar_url: 'https://s3.twcstorage.ru/1f733599-3e211fde-2ba8-417c-b764-c3dd3da3cf2c/user_avatar_1210398.jpg', role: 'worker' }
    },
    {
      id: 'c3',
      user_id: 'u3',
      desired_position: 'Ведущий системный админ',
      desired_salary: 7000,
      skills: [{ name: 'Linux' }, { name: 'Networks' }],
      experiences: [],
      user: { id: 'u3', email: 'vadudov@yora.tj', username: 'vadudov', full_name: 'Вадудов Мустафо', city: 'Душанбе', avatar_url: 'https://s3.twcstorage.ru/1f733599-3e211fde-2ba8-417c-b764-c3dd3da3cf2c/user_avatar_1208581.jpg', role: 'worker' }
    },
    {
      id: 'c4',
      user_id: 'u4',
      desired_position: 'Глава департамента маркетинга',
      desired_salary: 15000,
      skills: [{ name: 'Маркетинг' }, { name: 'PR' }],
      experiences: [],
      user: { id: 'u4', email: 'ardasher@yora.tj', username: 'ardasher', full_name: 'Ardasher Ismatulloh', city: 'Душанбе', avatar_url: 'https://s3.twcstorage.ru/1f733599-3e211fde-2ba8-417c-b764-c3dd3da3cf2c/user_avatar_811702.jpg', role: 'worker' }
    },
    {
      id: 'c5',
      user_id: 'u5',
      desired_position: 'Координатор программ',
      desired_salary: 5000,
      skills: [{ name: 'Управление' }, { name: 'Проекты' }],
      experiences: [],
      user: { id: 'u5', email: 'mansur@yora.tj', username: 'mansur', full_name: 'Мансур Ахунов', city: 'Душанбе', avatar_url: 'https://s3.twcstorage.ru/1f733599-3e211fde-2ba8-417c-b764-c3dd3da3cf2c/user_avatar_1190416.jpg', role: 'worker' }
    },
    {
      id: 'c6',
      user_id: 'u6',
      desired_position: 'Android Developer',
      desired_salary: 8000,
      skills: [{ name: 'Kotlin' }, { name: 'Android SDK' }],
      experiences: [],
      user: { id: 'u6', email: 'farhod@yora.tj', username: 'farhod', full_name: 'Farhod Ghaniev', city: 'Душанбе', avatar_url: 'https://s3.twcstorage.ru/1f733599-3e211fde-2ba8-417c-b764-c3dd3da3cf2c/user_avatar_1110934.jpg', role: 'worker' }
    }
  ];

  const employerProfile = useMemo(() => {
    return getSavedEmployerProfile(user);
  }, [user]);

  const sortedCandidates = useMemo(() => {
    return sortCandidatesByEmployerMatch(candidates, employerProfile);
  }, [candidates, employerProfile]);

  const featuredCandidatesList = useMemo(() => {
    const list: Candidate[] = [];
    for (let i = 0; i < 6; i++) {
      if (sortedCandidates[i]) {
        list.push(sortedCandidates[i]);
      } else {
        list.push(defaultCandidateFallbacks[i]);
      }
    }
    return list;
  }, [sortedCandidates]);

  const card2 = featuredJobsList[0];
  const card3 = featuredJobsList[1];
  const card4 = featuredJobsList[2];
  const card5 = featuredJobsList[3];
  const card6 = featuredJobsList[4];
  const card7 = featuredJobsList[5];

  const cand2 = featuredCandidatesList[0];
  const cand3 = featuredCandidatesList[1];
  const cand4 = featuredCandidatesList[2];
  const cand5 = featuredCandidatesList[3];
  const cand6 = featuredCandidatesList[4];
  const cand7 = featuredCandidatesList[5];

  const formatSalary = (job: Job) => {
    if (job.salary_min) return `${t('catalog.salary_min')} ${job.salary_min.toLocaleString()} ${job.currency || 'TJS'}`;
    return `${t('catalog.salary_min')} 3000 TJS`;
  };

  const handleApplyClick = (job: Job) => {
    if (job.is_external && job.external_url) {
      window.open(job.external_url, '_blank', 'noopener,noreferrer');
    } else {
      onSelectJob(job);
    }
  };

  // Funnel progress 0 → 1 over 550px of scrolling
  const p = Math.min(1, scrollY / 550);
  const cardScale  = Math.max(0, 1 - Math.pow(p, 1.8));
  const cardOpacity = Math.max(0, 1 - Math.pow(p, 2.2));

  const cx = winW / 2;
  const W_std = 265;

  const c2CenterX = 20 + W_std / 2;
  const c3CenterX = 10 + W_std / 2;
  const c4CenterX = 20 + W_std / 2;

  const c5CenterX = winW - 20 - W_std / 2;
  const c6CenterX = winW - 10 - W_std / 2;
  const c7CenterX = winW - 20 - W_std / 2;

  const dy = 800;

  const styleCard = (cardCenterX: number, extraScale = 1, rotateDeg = 0) => ({
    transform: `translate3d(${(cx - cardCenterX) * p}px, ${p * dy}px, 0) scale(${cardScale * extraScale}) rotate(${rotateDeg * (1 - p)}deg)`,
    opacity: cardOpacity,
    pointerEvents: (cardOpacity < 0.05 ? 'none' : 'auto') as React.CSSProperties['pointerEvents'],
  });

  const renderFloatingJobCard = (card: Job | undefined, cardCenterX: number, extraScale: number, rotateDeg: number, topPos: string, leftOrRightPos: string, animateClass: string, zIndex: string) => {
    if (!card) return null;
    return (
      <div
        style={styleCard(cardCenterX, extraScale, rotateDeg)}
        className={`hidden xl:block absolute ${topPos} ${leftOrRightPos} w-[255px] xl:w-[265px] p-3.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-md ${animateClass} ${zIndex} hover:z-30 transition-shadow`}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
            {card?.external_company_logo ? (
              <img src={card.external_company_logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                {((card?.external_company_name || card?.title || 'E')[0] || 'E').toUpperCase()}
              </div>
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{card.title}</h4>
            <p className="text-[10px] text-slate-400 font-semibold truncate">{card.external_company_name || 'Работодатель'}</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            🎯 {evaluateJobMatch(card).matchScore}% {t('catalog.match_tag')}
          </span>
        </div>

        <p className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">💳 {formatSalary(card)}</p>
        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> {card.location}
        </p>
        <button
          onClick={() => handleApplyClick(card)}
          className="w-full mt-2 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white dark:hover:text-white transition-all text-xs font-extrabold flex items-center justify-center gap-1"
        >
          <Hand className="w-3.5 h-3.5" />
          <span>{t('hero.apply_btn')}</span>
        </button>
      </div>
    );
  };

  const renderFloatingCandidateCard = (cand: Candidate, cardCenterX: number, extraScale: number, rotateDeg: number, topPos: string, leftOrRightPos: string, animateClass: string, zIndex: string) => {
    if (!cand) return null;
    const u: any = cand.user || {};
    const name = u.full_name || u.username || 'Соискатель';
    const pos = cand.desired_position || 'Специалист';
    const avatarUrl = u.avatar_url;
    const city = u.city || 'Душанбе';
    const salary = cand.desired_salary;

    return (
      <div
        style={styleCard(cardCenterX, extraScale, rotateDeg)}
        className={`hidden xl:block absolute ${topPos} ${leftOrRightPos} w-[255px] xl:w-[270px] p-3.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-md ${animateClass} ${zIndex} hover:z-30 transition-shadow`}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-slate-700 border border-indigo-100 dark:border-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                {name[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <div className="overflow-hidden flex-1">
            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{name}</h4>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold truncate">{pos}</p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 border border-white dark:border-slate-800" />
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            🎯 {evaluateEmployerCandidateMatch(cand, employerProfile).matchScore}% Подходит профилю
          </span>
        </div>

        {salary && (
          <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
            💳 от {salary.toLocaleString()} TJS
          </p>
        )}

        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> {city}
        </p>

        <button
          onClick={() => setSelectedCandidateModal(cand)}
          className="w-full mt-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white dark:hover:text-white transition-all text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Открыть резюме</span>
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-16 pb-16 overflow-hidden animate-fade-in">
      
      {/* Hero Section with 3D Floating Cards */}
      <section className="relative min-h-[760px] xl:min-h-[780px] pt-12 pb-16 flex flex-col items-center justify-center bg-gradient-to-b from-white via-indigo-50/20 to-slate-100/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/80 rounded-3xl border border-indigo-100/80 dark:border-slate-800 shadow-xs px-4 overflow-hidden">
        
        {/* Ambient Light Radial Blur */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] bg-indigo-400/10 dark:bg-indigo-600/15 blur-[110px] rounded-full pointer-events-none -z-0"></div>

        {/* Concentric Spherical Background Graphic */}
        <div className="absolute -bottom-28 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-gradient-to-t from-indigo-300/30 dark:from-indigo-900/30 via-indigo-200/20 dark:via-indigo-900/20 to-transparent border border-indigo-200/40 dark:border-indigo-800/40 blur-[1px] pointer-events-none z-0">
          <div className="w-[380px] h-[380px] rounded-full border border-indigo-300/30 dark:border-indigo-800/30 mx-auto mt-14">
            <div className="w-[270px] h-[270px] rounded-full border border-indigo-400/20 dark:border-indigo-700/20 mx-auto mt-12 bg-gradient-to-t from-indigo-500/15 to-transparent"></div>
          </div>
        </div>

        {/* ──────────── 6 FLOATING CARDS (WORKERS IF EMPLOYER ROLE, ELSE VACANCIES) ──────────── */}
        {isEmployerMode ? (
          <>
            {renderFloatingCandidateCard(cand2, c2CenterX, 1.0, -2, 'top-8', 'left-2 xl:left-4', 'animate-float-2', 'z-10')}
            {renderFloatingCandidateCard(cand3, c3CenterX, 1.02, 1, 'top-[270px]', 'left-1 xl:left-2', 'animate-float-1', 'z-20')}
            {renderFloatingCandidateCard(cand4, c4CenterX, 1.0, -1, 'top-[510px]', 'left-2 xl:left-4', 'animate-float-3', 'z-15')}
            {renderFloatingCandidateCard(cand5, c5CenterX, 1.0, 2, 'top-8', 'right-2 xl:right-4', 'animate-float-1', 'z-10')}
            {renderFloatingCandidateCard(cand6, c6CenterX, 1.02, -1, 'top-[270px]', 'right-1 xl:right-2', 'animate-float-2', 'z-20')}
            {renderFloatingCandidateCard(cand7, c7CenterX, 1.0, 1, 'top-[510px]', 'right-2 xl:right-4', 'animate-float-3', 'z-15')}
          </>
        ) : (
          <>
            {renderFloatingJobCard(card2, c2CenterX, 1.0, -2, 'top-8', 'left-2 xl:left-4', 'animate-float-2', 'z-10')}
            {renderFloatingJobCard(card3, c3CenterX, 1.02, 1, 'top-[270px]', 'left-1 xl:left-2', 'animate-float-1', 'z-20')}
            {renderFloatingJobCard(card4, c4CenterX, 1.0, -1, 'top-[510px]', 'left-2 xl:left-4', 'animate-float-3', 'z-15')}
            {renderFloatingJobCard(card5, c5CenterX, 1.0, 2, 'top-8', 'right-2 xl:right-4', 'animate-float-1', 'z-10')}
            {renderFloatingJobCard(card6, c6CenterX, 1.02, -1, 'top-[270px]', 'right-1 xl:right-2', 'animate-float-2', 'z-20')}
            {renderFloatingJobCard(card7, c7CenterX, 1.0, 1, 'top-[510px]', 'right-2 xl:right-4', 'animate-float-3', 'z-15')}
          </>
        )}

        {/* Main Hero Copy & Search / Action Form */}
        <div className="relative z-30 max-w-md xl:max-w-lg text-center space-y-5 px-2 my-auto">
          
          {isEmployerMode ? (
            <>
              {employerProfile?.target_position && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white text-[11px] font-extrabold shadow-md border border-indigo-700/50 animate-bounce-subtle">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span>ИИ-подбор соискателей: {employerProfile.target_position} ({employerProfile.location})</span>
                </div>
              )}

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold shadow-2xs">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <span>База проверенных специалистов HamKor</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Найдите лучших сотрудников <br />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 dark:from-indigo-400 dark:via-purple-400 dark:to-amber-400 bg-clip-text text-transparent">
                  для вашего бизнеса
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium max-w-sm sm:max-w-md mx-auto leading-relaxed">
                Размещайте новые вакансии и просматривайте анкеты лучших соискателей Таджикистана с фото и опытом работы.
              </p>

              {onNavigateToPostJob && (
                <div className="pt-2">
                  <button
                    onClick={onNavigateToPostJob}
                    className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Разместить вакансию</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {userProfile?.position && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white text-[11px] font-extrabold shadow-md border border-indigo-700/50 animate-bounce-subtle">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span>{t('hero.ai_matched_banner')}: {userProfile.position} ({userProfile.location})</span>
                </div>
              )}

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping"></span>
                <span>{t('hero.badge')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {t('hero.title_part1')} <br />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 dark:from-indigo-400 dark:via-purple-400 dark:to-amber-400 bg-clip-text text-transparent">
                  {t('hero.title_part2')}
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium max-w-sm sm:max-w-md mx-auto leading-relaxed">
                {t('hero.subtitle')}
              </p>

              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200/80 dark:border-slate-700 shadow-2xl max-w-sm sm:max-w-xl mx-auto transition-all focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/50">
                <div className="flex items-center gap-2.5 px-3.5 py-2 w-full">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 animate-pulse" />
                  <input
                    type="text"
                    placeholder="Спросите HamKor AI (например: Найди работу разработчиком в Душанбе)..."
                    value={positionQuery}
                    onChange={(e) => setPositionQuery(e.target.value)}
                    className="w-full text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs shadow-md shrink-0 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Bot className="w-4 h-4 text-amber-300" />
                  <span>⚡ ИИ Поиск</span>
                </button>
              </form>
            </>
          )}

        </div>

      </section>

      {/* Main Content Body */}
      {isEmployerMode ? (
        <section className="pt-2">
          <CandidatesCatalog
            user={user}
            onOpenAuth={onOpenAuth}
            onNavigateToPostJob={onNavigateToPostJob}
          />
        </section>
      ) : (
        /* Featured Jobs Section (3 Full Rows = 9 Cards Grid) */
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {userProfile?.position ? `${t('hero.featured_title')} (${userProfile.position})` : t('hero.featured_title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {t('hero.featured_subtitle')}
              </p>
            </div>

            <button
              onClick={() => onNavigateToJobs()}
              className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
            >
              <span>{t('hero.all_jobs')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Rows x 3 Columns = 9 Cards Container */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredJobsList.map((job) => {
              if (!job) return null;
              const { matchScore, matchedSkills } = evaluateJobMatch(job);
              return (
                <div
                  key={job.id}
                  className="ref-card p-5 bg-white dark:bg-slate-800 border border-indigo-100/80 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group rounded-2xl"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                          {job?.external_company_logo ? (
                            <img src={job.external_company_logo} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                              {((job?.external_company_name || job?.title || 'E')[0] || 'E').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            🎯 {matchScore}% {t('catalog.match_tag')}
                          </span>
                          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 mt-0.5">
                            {job.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            {job.external_company_name || 'Работодатель HamKor'}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 shrink-0">
                        {formatSalary(job)}
                      </span>
                    </div>

                    {matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {matchedSkills.slice(0, 3).map((sk, idx) => (
                          <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            ✓ {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 flex items-center gap-1 font-semibold truncate">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onSelectJob(job)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-all active:scale-95 flex items-center gap-1 border border-slate-200 dark:border-slate-600"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Подробнее</span>
                      </button>

                      <button
                        onClick={() => handleApplyClick(job)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1"
                      >
                        <span>{t('hero.apply_btn')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* "More Vacancies" Button at bottom of Homepage Vacancies Section */}
          <div className="pt-6 flex items-center justify-center">
            <button
              onClick={() => onNavigateToJobs()}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm sm:text-base shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all active:scale-95 flex items-center gap-3 border border-white/20"
            >
              <span>Больше вакансий</span>
              <ArrowRight className="w-5 h-5 text-amber-300" />
            </button>
          </div>
        </section>
      )}

      {/* Candidate Detail Modal */}
      <CandidateDetailModal
        candidate={selectedCandidateModal}
        onClose={() => setSelectedCandidateModal(null)}
        user={user}
        onOpenAuth={onOpenAuth}
      />

      {/* HamKor AI Response Modal */}
      {aiResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 dark:border-slate-700 relative space-y-6 animate-scale-up max-h-[85vh] overflow-y-auto custom-scrollbar">
            
            {/* Close button */}
            <button
              onClick={() => setAiResultModal(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold mb-1">
                  <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span>HamKor AI Консультант</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                  ИИ Ответ на ваш запрос
                </h3>
              </div>
            </div>

            {/* Query Tag */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="text-slate-400 dark:text-slate-500">Ваш вопрос:</span>
              <span className="text-indigo-600 dark:text-indigo-400">"{aiResultModal.query}"</span>
            </div>

            {/* AI Text Response Body */}
            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-900/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
              {aiResultModal.answer}
            </div>

            {/* Matched Jobs if available */}
            {aiResultModal.matchedJobs.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Подобранные вакансии по вашему запросу ({aiResultModal.matchedJobs.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiResultModal.matchedJobs.map((job: Job) => (
                    <div key={job.id} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 shadow-xs transition-all flex flex-col justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-black text-slate-900 dark:text-slate-100 line-clamp-1">{job.title}</h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{job.external_company_name || 'Работодатель HamKor'}</p>
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">{job.location}</p>
                      </div>
                      <button
                        onClick={() => {
                          setAiResultModal(null);
                          onSelectJob(job);
                        }}
                        className="w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] transition-all"
                      >
                        Подробнее
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => {
                  setAiResultModal(null);
                  onNavigateToJobs(aiResultModal.query);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <span>Искать в каталоге</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2">
                {onNavigateToAIConsultant && (
                  <button
                    onClick={() => {
                      setAiResultModal(null);
                      onNavigateToAIConsultant(aiResultModal.query);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-300" />
                    <span>Чат с ИИ</span>
                  </button>
                )}

                <button
                  onClick={() => setAiResultModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
                >
                  Закрыть
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
