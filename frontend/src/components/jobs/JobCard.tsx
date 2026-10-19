import React, { useState } from 'react';
import { MapPin, Building2, Eye, ArrowUpRight, Heart } from 'lucide-react';
import { Job } from '../../types';
import { openTelegramLink } from '../../utils/telegram';
import { jobService } from '../../services/api';

interface JobCardProps {
  job: Job;
  onSelectJob: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onSelectJob }) => {
  if (!job) return null;
  const isExternal = job.is_external || !!job.external_source;
  const companyName = job?.external_company_name || (job as any)?.company?.company_name || 'Работодатель';
  const logoUrl = job?.external_company_logo || (job as any)?.company?.logo_url;

  const [isSaved, setIsSaved] = useState<boolean>(job.is_saved || job.is_favorite || false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;
    setIsToggling(true);
    const prevVal = isSaved;
    setIsSaved(!prevVal);
    try {
      if (prevVal) {
        await jobService.unsaveJob(job.id);
      } else {
        await jobService.saveJob(job.id);
      }
      window.dispatchEvent(new Event('ergon_favorites_updated'));
    } catch (err) {
      setIsSaved(prevVal);
    } finally {
      setIsToggling(false);
    }
  };

  const formatSalary = () => {
    if (job.salary_min && job.salary_max) {
      return `${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()} ${job.currency}`;
    }
    if (job.salary_min) {
      return `от ${job.salary_min.toLocaleString()} ${job.currency}`;
    }
    if (job.salary_max) {
      return `до ${job.salary_max.toLocaleString()} ${job.currency}`;
    }
    return 'По договорённости';
  };

  const getEmploymentBadge = () => {
    switch (job.employment_type) {
      case 'remote':
        return { label: 'Удалённо', bg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' };
      case 'part_time':
        return { label: 'Частичная', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'internship':
        return { label: 'Стажировка', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'contract':
        return { label: 'Проектная', bg: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' };
      default:
        return { label: 'Полный день', bg: 'bg-brand-500/10 text-brand-600 border-brand-500/20' };
    }
  };

  const getSourceBadge = () => {
    const src = (job.external_source || '').toLowerCase();
    const url = (job.external_url || '').toLowerCase();

    if (src.includes('telegram') || url.includes('t.me') || url.includes('telegram')) {
      return {
        label: 'Telegram',
        bg: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
        dot: 'bg-sky-500'
      };
    }
    if (src.includes('yora') || url.includes('yora')) {
      return {
        label: 'yora.tj',
        bg: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
        dot: 'bg-cyan-500'
      };
    }
    if (src.includes('somon') || url.includes('somon')) {
      return {
        label: 'somon.tj',
        bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        dot: 'bg-amber-500'
      };
    }
    if (isExternal) {
      return {
        label: job.external_source || 'Внешняя',
        bg: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
        dot: 'bg-slate-500'
      };
    }
    return {
      label: 'Прямая',
      bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      dot: 'bg-emerald-500'
    };
  };

  const empBadge = getEmploymentBadge();
  const srcBadge = getSourceBadge();

  const [imgError, setImgError] = useState<boolean>(false);

  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-glass-hover transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 relative">
      
      {/* Top Header & Avatar */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {logoUrl && !imgError ? (
                <img 
                  src={logoUrl} 
                  alt={companyName}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Building2 className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                {companyName}
              </h4>
              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-brand-500" />
                {job.location}
              </span>
            </div>
          </div>

          {/* Source Tag & Favorite Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${srcBadge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${srcBadge.dot} animate-pulse`}></span>
              {srcBadge.label}
            </span>

            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={isToggling}
              title={isSaved ? "Удалить из избранного" : "Сохранить в избранное"}
              className={`p-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer shrink-0 ${
                isSaved
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-200 dark:border-rose-800/60'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 border-slate-200/80 dark:border-slate-700/60'
              }`}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-600 text-rose-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Job Title */}
        <h3 
          onClick={() => onSelectJob(job)}
          className="text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors line-clamp-2 cursor-pointer mb-2"
        >
          {job.title}
        </h3>

        {/* Salary & Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm font-extrabold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-3 py-1 rounded-lg border border-brand-500/10">
            {formatSalary()}
          </span>
          
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${empBadge.bg}`}>
            {empBadge.label}
          </span>
        </div>
      </div>

      {/* Card Actions */}
      <div className="pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between gap-2">
        <button
          onClick={() => onSelectJob(job)}
          className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-600 flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          Подробнее
        </button>

          {job.has_applied ? (
            <span className="text-[11px] font-extrabold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              ✓ Откликнулись
            </span>
          ) : isExternal && job.external_url ? (
            <a
              href={job.external_url}
              onClick={(e) => {
                const src = (job.external_source || '').toLowerCase();
                const url = (job.external_url || '').toLowerCase();
                if (src.includes('telegram') || url.includes('t.me') || url.includes('telegram')) {
                  openTelegramLink(e, job.external_url!);
                }
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="gradient-btn text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <span>Откликнуться</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={() => onSelectJob(job)}
              className="gradient-btn text-xs px-3.5 py-1.5 rounded-lg font-semibold"
            >
              Откликнуться
            </button>
          )}
        </div>


    </div>
  );
};
