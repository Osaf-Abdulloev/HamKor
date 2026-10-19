import React, { useState, useEffect } from 'react';
import { X, MapPin, Building2, ExternalLink, CheckCircle2, ShieldAlert, Sparkles, Zap, Clock, Send, FileText, Heart } from 'lucide-react';
import { Job } from '../../types';
import { evaluateProfileJobMatch, getSavedUserProfile } from '../../services/matchService';
import { applicationService, jobService } from '../../services/api';
import { saveUserApplication } from '../pages/ApplicationsPage';
import { resumeService } from '../../services/resumeService';
import { Resume } from '../../types/resume';
import { openTelegramLink } from '../../utils/telegram';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  user?: any;
  onOpenAuth?: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, user, onOpenAuth }) => {
  if (!job) return null;

  const [showApplyForm, setShowApplyForm] = useState(false);
  const [coverNote, setCoverNote] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState<boolean>(job.has_applied || false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [isSaved, setIsSaved] = useState<boolean>(job.is_saved || job.is_favorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState<boolean>(false);

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    const prev = isSaved;
    setIsSaved(!prev);
    try {
      if (prev) {
        await jobService.unsaveJob(job.id);
      } else {
        await jobService.saveJob(job.id);
      }
      window.dispatchEvent(new Event('ergon_favorites_updated'));
    } catch (err) {
      setIsSaved(prev);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const [userResumes, setUserResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');

  useEffect(() => {
    if (user && user.role === 'worker') {
      resumeService.getResumes().then((resumes) => {
        setUserResumes(resumes);
        const pub = resumes.find((r) => r.is_published);
        if (pub) {
          setSelectedResumeId(pub.id);
        } else if (resumes.length > 0) {
          setSelectedResumeId(resumes[0].id);
        }
      });

      if (job?.id) {
        applicationService.checkApplicationStatus(job.id).then((res: any) => {
          if (res?.has_applied) {
            setHasAlreadyApplied(true);
          }
        }).catch(() => {});
      }
    }
  }, [user, job?.id]);


  const isExternal = job?.is_external || !!job?.external_source;
  const companyName = job?.external_company_name || (job as any)?.company?.company_name || 'Работодатель HamKor';
  const logoUrl = job?.external_company_logo || (job as any)?.company?.logo_url;

  const formatSalary = () => {
    if (job.salary_min && job.salary_max) {
      return `${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()} ${job.currency || 'TJS'}`;
    }
    if (job.salary_min) {
      return `от ${job.salary_min.toLocaleString()} ${job.currency || 'TJS'}`;
    }
    if (job.salary_max) {
      return `до ${job.salary_max.toLocaleString()} ${job.currency || 'TJS'}`;
    }
    return 'По договорённости';
  };

  const getSourceInfo = () => {
    const src = (job.external_source || '').toLowerCase();
    const url = (job.external_url || '').toLowerCase();

    if (src.includes('telegram') || url.includes('t.me') || url.includes('telegram')) {
      return {
        type: 'telegram',
        label: 'Telegram',
        buttonText: 'Откликнуться в Telegram ↗',
        badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/30'
      };
    }
    if (src.includes('somon') || url.includes('somon')) {
      return {
        type: 'somon',
        label: 'somon.tj',
        buttonText: 'Откликнуться на somon.tj ↗',
        badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30'
      };
    }
    if (src.includes('yora') || url.includes('yora')) {
      return {
        type: 'yora',
        label: 'yora.tj',
        buttonText: 'Откликнуться на yora.tj ↗',
        badgeBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
        buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
      };
    }
    return {
      type: 'external',
      label: job.external_source || 'Внешний источник',
      buttonText: 'Перейти к вакансии ↗',
      badgeBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
    };
  };

  const sourceInfo = getSourceInfo();

  const handleApply = async () => {
    setIsApplying(true);
    setApplyError(null);
    const activeUserId = user?.id || 'guest';
    const selectedResume = userResumes.find((r) => r.id === selectedResumeId);

    const appData = {
      id: `app-${Date.now()}`,
      job_id: job.id,
      job_title: job.title,
      company_name: companyName,
      logo_url: logoUrl,
      location: job.location,
      salary: formatSalary(),
      cover_note: coverNote,
      applied_at: new Date().toLocaleDateString('ru-RU'),
      status: 'PENDING' as const,
      resume_id: selectedResumeId || undefined,
      resume_title: selectedResume?.title || undefined
    };

    try {
      const appRes = await applicationService.applyToJob({ 
        job_id: job.id, 
        cover_note: coverNote,
        resume_id: selectedResumeId || undefined
      });
      if (appRes && appRes.id) {
        appData.id = appRes.id;
      }
      setAppliedSuccess(true);
      setHasAlreadyApplied(true);
      window.dispatchEvent(new Event('ergon_applications_updated'));
    } catch (e: any) {
      const errDetail = e?.response?.data?.detail || e?.message || 'Не удалось отправить отклик.';
      if (e?.response?.status === 409 || errDetail.includes('уже откликались')) {
        setHasAlreadyApplied(true);
        setApplyError('Вы уже откликались на эту вакансию. Повторный отклик невозможен.');
      } else {
        setApplyError(errDetail);
      }
    } finally {
      setIsApplying(false);
    }
  };


  const [backendCommute, setBackendCommute] = useState<any>(null);

  useEffect(() => {
    if (job?.id) {
      jobService.getJobCommute(job.id).then((res: any) => {
        if (res) setBackendCommute(res);
      }).catch(() => {});
    }
  }, [job?.id]);

  const userProfile = getSavedUserProfile();
  const { matchScore, scoreBreakdown, matchedSkills, missingSkills, matchedReasons, commuteEstimate, distanceEstimate } = evaluateProfileJobMatch(job, userProfile);
  
  const displayDistance = backendCommute?.distance_text || distanceEstimate;
  const displayCommute = backendCommute?.commute_text || commuteEstimate;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-3xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative max-h-[88vh] overflow-y-auto border border-white/20 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-6 duration-200"
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

        {/* Top Header Buttons */}
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            disabled={isTogglingFavorite}
            title={isSaved ? "Удалить из избранного" : "Сохранить в избранное"}
            className={`p-2 rounded-full border transition-all active:scale-95 cursor-pointer ${
              isSaved
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-200 dark:border-rose-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Heart className={`w-5 h-5 ${isSaved ? 'fill-rose-600 text-rose-600' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header Section */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-10 h-10 text-slate-400" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{companyName}</span>
              {isExternal && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${sourceInfo.badgeBg}`}>
                  Источник: {sourceInfo.label}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {job.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {job.location} ({displayDistance})
              </span>
              <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                <Clock className="w-3.5 h-3.5" />
                {displayCommute}
              </span>
            </div>
          </div>
        </div>

        {/* Profile AI Match Banner in Modal */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white shadow-md border border-indigo-700/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              <h4 className="text-xs font-black text-white">ИИ-Аналитика совместимости с вашим профилем</h4>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
              🎯 {matchScore}% Совпадение
            </span>
          </div>

          {scoreBreakdown && (
            <div className="grid grid-cols-4 gap-1 p-2 rounded-xl bg-black/20 text-[10px] font-bold text-center border border-white/10">
              <div>
                <span className="block text-[9px] text-indigo-200">Должность</span>
                <span className="text-amber-300 font-black">{scoreBreakdown.positionScore}/30</span>
              </div>
              <div>
                <span className="block text-[9px] text-indigo-200">Навыки</span>
                <span className="text-emerald-300 font-black">{scoreBreakdown.skillScore}/35</span>
              </div>
              <div>
                <span className="block text-[9px] text-indigo-200">Зарплата</span>
                <span className="text-cyan-300 font-black">{scoreBreakdown.salaryScore}/15</span>
              </div>
              <div>
                <span className="block text-[9px] text-indigo-200">Локация</span>
                <span className="text-rose-300 font-black">{scoreBreakdown.locationScore}/15</span>
              </div>
            </div>
          )}

          {matchedSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-extrabold text-amber-300 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Совпавшие навыки ({matchedSkills.length}):
              </span>
              {matchedSkills.map((sk) => (
                <span key={sk} className="px-2 py-0.5 rounded bg-white/10 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  ✓ {sk}
                </span>
              ))}
            </div>
          )}

          {missingSkills && missingSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-extrabold text-amber-400 uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Совет по росту: Добавьте в профиль
              </span>
              {missingSkills.map((sk) => (
                <span key={sk} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px] font-bold border border-amber-400/40">
                  + {sk} (+12%)
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {matchedReasons.map((reason, idx) => (
              <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-indigo-100">
                ✓ {reason}
              </span>
            ))}
          </div>
        </div>

        {/* Salary Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Уровень дохода</span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {formatSalary()}
            </div>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs border border-slate-200 dark:border-slate-600">
            {job.employment_type === 'remote' ? 'Удалёнка' : 'Полный день'}
          </span>
        </div>

        {/* Description Section */}
        <div className="prose max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-4 mb-8 whitespace-pre-wrap leading-relaxed">
          {job.description}
        </div>

        {/* Application Modal / Action Section */}
        {showApplyForm ? (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in">
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Отклик на вакансию "{job.title}"</span>
            </h4>

            {appliedSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Ваш отклик успешно отправлен работодателю! Компании выслано ваше резюме и контакты.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {userResumes.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1.5 shadow-2xs">
                    <label className="text-[11px] font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Прикрепить созданное резюме HamKor AI:</span>
                    </label>
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      {userResumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          ✨ {r.title} ({r.is_published ? 'Опубликовано ✓' : 'Черновик'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  rows={3}
                  placeholder="Напишите сопроводительное письмо работодателю (например: Сообщите о вашей готовности приступить к работе)..."
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium outline-none focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowApplyForm(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Sparkles className={`w-4 h-4 ${isApplying ? 'animate-spin' : ''}`} />
                    <span>{isApplying ? 'Отправка...' : 'Отправить отклик'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Вакансии проверяются и синхронизируются автоматически</span>
            </div>

            {applyError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{applyError}</span>
              </div>
            )}

            {isExternal ? (
              job.external_url ? (
                <a
                  href={job.external_url}
                  onClick={(e) => {
                    if (sourceInfo.type === 'telegram' || (job.external_url || '').toLowerCase().includes('t.me')) {
                      openTelegramLink(e, job.external_url!);
                    }
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-6 py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 w-full sm:w-auto shadow-md transition-all active:scale-95 cursor-pointer ${sourceInfo.buttonClass}`}
                >
                  {sourceInfo.type === 'telegram' ? (
                    <Send className="w-4 h-4" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  <span>{sourceInfo.buttonText}</span>
                </a>
              ) : (
                <div className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-2 w-full sm:w-auto">
                  <span>Ссылка на оригинальную вакансию недоступна</span>
                </div>
              )
            ) : (
              user?.role === 'employer' ? (
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 px-4 py-2.5 rounded-xl">
                  Работодатели не могут откликаться на вакансии
                </div>
              ) : hasAlreadyApplied ? (
                <div className="px-6 py-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold flex items-center justify-center gap-2 w-full sm:w-auto shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Вы уже откликнулись на эту вакансию</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!user) {
                      if (onOpenAuth) onOpenAuth();
                      return;
                    }
                    setShowApplyForm(true);
                  }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 w-full sm:w-auto shadow-md transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Откликнуться через HamKor</span>
                </button>
              )
            )}
          </div>
        )}


      </div>
    </div>
  );
};
