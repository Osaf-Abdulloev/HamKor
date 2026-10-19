import React, { useState, useEffect } from 'react';
import { FileText, Building2, MapPin, Calendar, Clock, CheckCircle2, XCircle, ArrowRight, User, MessageSquare, Eye, ChevronDown } from 'lucide-react';
import { applicationService, jobService } from '../../services/api';
import { chatService } from '../../services/chatService';
import { useLanguage } from '../../i18n/LanguageContext';
import { RealtimeChatModal } from '../chat/RealtimeChatModal';
import { CandidateDetailModal } from '../candidates/CandidateDetailModal';
import { ContactCandidateModal } from '../candidates/ContactCandidateModal';

interface ApplicationsPageProps {
  user?: any;
  onOpenAuth?: () => void;
  onSelectJob?: (job: any) => void;
  onNavigateToChat?: (recipientId: string | null) => void;
  selectedJobIdFilter?: string | null;
}

export interface UserApplication {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  logo_url?: string;
  location?: string;
  salary?: string;
  cover_note?: string;
  employer_feedback?: string;
  applied_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVIEWED' | 'CANCELLED';
  worker_id?: string;
  worker_data?: any;
  employer_id?: string;
  company_user_id?: string;
}

export const getSavedApplications = (_userId?: string): UserApplication[] => [];
export const saveUserApplication = (_userId: string, _app: UserApplication) => {};

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  user,
  onOpenAuth,
  onSelectJob,
  onNavigateToChat,
  selectedJobIdFilter = null
}) => {
  const { t } = useLanguage();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-md">
          <FileText className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">{t('nav.login')}</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto font-medium leading-relaxed">
            {t('apps.worker_sub')}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>{t('nav.login')}</span>
          </button>
        </div>
      </div>
    );
  }

  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'cancelled'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string>(selectedJobIdFilter || 'all');
  const [employerJobs, setEmployerJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedJobIdFilter) {
      setSelectedJobId(selectedJobIdFilter);
    }
  }, [selectedJobIdFilter]);

  // Load list of employer's created jobs for the filter dropdown
  useEffect(() => {
    if (user && user.role === 'employer') {
      jobService.getMyJobs({ limit: 100 }).then((res) => {
        setEmployerJobs(res.items || []);
      }).catch((e) => console.error('Failed to fetch employer jobs list:', e));
    }
  }, [user]);

  // Edit Cover Note State
  const [editingCoverApp, setEditingCoverApp] = useState<UserApplication | null>(null);
  const [newCoverNote, setNewCoverNote] = useState('');

  // Employer Status Change Feedback Modal State
  const [feedbackApp, setFeedbackApp] = useState<{ id: string; status: 'ACCEPTED' | 'REJECTED' | 'PENDING' } | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');

  // Chat & Candidate Modal States
  const [activeChatRecipient, setActiveChatRecipient] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [contactCandidateData, setContactCandidateData] = useState<{ candidate: any; applicationId?: string; jobTitle?: string } | null>(null);

  const loadApplications = async () => {
    setIsLoading(true);
    let apiApps: UserApplication[] = [];

    try {
      if (user.role === 'employer') {
        const jobIdParam = selectedJobId !== 'all' ? selectedJobId : undefined;
        const res = await applicationService.getEmployerApplications(filter !== 'all' ? filter : undefined, jobIdParam);
        apiApps = (res.items || res).map((item: any) => {
          const wUser = item.worker?.user || item.worker || {};
          const jJob = item.job || {};
          return {
            id: item.id,
            job_id: item.job_id || jJob.id,
            job_title: jJob.title || item.job_title || 'Вакансия',
            company_name: wUser.full_name || wUser.username || item.worker_name || 'Соискатель',
            logo_url: wUser.avatar_url,
            location: wUser.city || 'г. Душанбе',
            salary: item.salary || 'По договоренности',
            cover_note: item.cover_letter || item.cover_note || '',
            employer_feedback: item.employer_feedback || '',
            applied_at: new Date(item.created_at || Date.now()).toLocaleDateString(),
            status: (item.status || 'PENDING').toUpperCase() as any,
            worker_id: item.worker_id || wUser.id,
            worker_data: item.worker
          };
        });
      } else {
        const res = await applicationService.getMyApplications();
        apiApps = (res.items || res).map((item: any) => {
          const jJob = item.job || {};
          return {
            id: item.id,
            job_id: item.job_id || jJob.id,
            job_title: jJob.title || item.job_title || 'Вакансия',
            company_name: jJob.external_company_name || jJob.employer?.company_name || item.company_name || 'Работодатель HamKor',
            logo_url: jJob.external_logo_url || jJob.employer?.avatar_url,
            location: jJob.location || item.location || 'Душанбе',
            salary: jJob.salary_min ? `от ${jJob.salary_min} TJS` : 'По договоренности',
            cover_note: item.cover_letter || item.cover_note || '',
            employer_feedback: item.employer_feedback || '',
            applied_at: new Date(item.created_at || Date.now()).toLocaleDateString(),
            status: (item.status || 'PENDING').toUpperCase() as any,
            employer_id: item.employer_id || item.company_user_id || jJob.company?.employer_id || jJob.employer_id,
            company_user_id: item.company_user_id || item.employer_id || jJob.company?.employer_id || jJob.employer_id
          };
        });
      }
    } catch (e) {
      console.error('Failed to fetch applications from PostgreSQL API:', e);
    }

    setApplications(apiApps);
    setIsLoading(false);
  };

  useEffect(() => {
    loadApplications();
    const handleUpdate = () => loadApplications();
    window.addEventListener('ergon_applications_updated', handleUpdate);

    const token = localStorage.getItem('ergon_access_token') || localStorage.getItem('ergon_token') || '';
    let wsConn: any = null;
    if (token) {
      wsConn = chatService.connectWebSocket(
        token,
        () => {},
        () => {},
        (eventData) => {
          if (eventData && eventData.event === 'application_status_changed') {
            const appStatus = eventData.status ? eventData.status.toUpperCase() : 'PENDING';
            setApplications((prev) =>
              prev.map((a) => {
                if (a.id === eventData.application_id || a.job_id === eventData.job_id) {
                  return {
                    ...a,
                    status: appStatus as any,
                    employer_feedback: eventData.employer_feedback !== undefined ? eventData.employer_feedback : a.employer_feedback
                  };
                }
                return a;
              })
            );
          }
        }
      );
    }

    return () => {
      window.removeEventListener('ergon_applications_updated', handleUpdate);
      if (wsConn) wsConn.close();
    };
  }, [user.id, user.role, filter, selectedJobId]);

  const handleUpdateStatus = async (appId: string, newStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED', feedback?: string) => {
    setUpdatingId(appId);
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: newStatus, employer_feedback: feedback || a.employer_feedback } : a))
    );

    try {
      await applicationService.updateStatus(appId, newStatus.toLowerCase(), feedback);
    } catch (e) {
      console.error('Failed to update status on server:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelApplication = async (appId: string) => {
    if (!window.confirm('Вы действительно хотите отменить ваш отклик?')) return;
    setUpdatingId(appId);
    try {
      await applicationService.cancelApplication(appId);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'CANCELLED' } : a))
      );
    } catch (e) {
      console.error('Failed to cancel application:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveCoverNote = async () => {
    if (!editingCoverApp) return;
    try {
      await applicationService.updateCoverNote(editingCoverApp.id, newCoverNote);
      setApplications((prev) =>
        prev.map((a) => (a.id === editingCoverApp.id ? { ...a, cover_note: newCoverNote } : a))
      );
      setEditingCoverApp(null);
    } catch (e) {
      console.error('Failed to update cover note:', e);
    }
  };

  const handleViewCandidateProfile = (app: UserApplication) => {
    const aAny = app as any;
    const wData = aAny.worker || aAny.worker_data?.user || aAny.worker_data || {};
    const wProfile = app.worker_data || {};
    const candidateObj: any = {
      id: app.worker_id || app.id,
      user_id: app.worker_id || app.id,
      desired_position: wProfile.desired_position || app.job_title || 'Соискатель',
      desired_salary: wProfile.desired_salary || null,
      bio: wProfile.bio || null,
      cover_note: app.cover_note || null,
      education: wProfile.education || null,
      skills: wProfile.skills || [],
      experiences: wProfile.experiences || [],
      user: {
        id: app.worker_id || app.id,
        full_name: wData.full_name || wData.username || (app as any).worker_name || 'Соискатель',
        username: wData.username || (app as any).worker_name || 'applicant',
        avatar_url: wData.avatar_url,
        city: wData.city || app.location || 'Душанбе',
        phone: wData.phone || '',
        email: wData.email || ''
      }
    };
    setSelectedCandidate(candidateObj);
  };

  const filteredApps = applications.filter((app) => {
    const st = app.status?.toUpperCase();
    if (filter === 'pending') return st === 'PENDING' || st === 'REVIEWED';
    if (filter === 'accepted') return st === 'ACCEPTED';
    if (filter === 'rejected') return st === 'REJECTED';
    if (filter === 'cancelled') return st === 'CANCELLED';
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in">
      
      {/* Top Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {user?.role === 'employer' ? t('apps.employer_title') : t('apps.worker_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {user?.role === 'employer'
                ? t('apps.employer_sub')
                : t('apps.worker_sub')}
            </p>
          </div>

          {/* Job Filter Dropdown for Employer */}
          {user?.role === 'employer' && employerJobs.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">Вакансия:</span>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Все вакансии (Все откликанты)</option>
                {employerJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.location || 'Душанбе'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Все ({applications.length})
          </button>

          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filter === 'pending' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            В рассмотрении
          </button>

          <button
            onClick={() => setFilter('accepted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filter === 'accepted' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Принятые
          </button>

          <button
            onClick={() => setFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filter === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Отклоненные кандидаты
          </button>

          <button
            onClick={() => setFilter('cancelled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filter === 'cancelled' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Отмененные
          </button>
        </div>
      </div>

      {/* Applications List */}
      {filteredApps.length > 0 ? (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const statusUpper = (app.status || 'PENDING').toString().toUpperCase();
            return (
              <div
                key={app.id}
              className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs hover:shadow-md transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-700 border border-indigo-100 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {app.logo_url ? (
                      <img src={app.logo_url} alt={app.company_name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {app.company_name}
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {app.job_title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <span>{app.location || 'Душанбе'}</span>
                      <span>•</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{app.salary || t('catalog.salary_negotiable')}</span>
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                {(() => {
                  const statusUpper = (app.status || 'PENDING').toString().toUpperCase();
                  return (
                    <div className="flex items-center gap-2">
                      {statusUpper === 'ACCEPTED' ? (
                        <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Принято</span>
                        </span>
                      ) : statusUpper === 'REJECTED' ? (
                        <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span>Отклонено</span>
                        </span>
                      ) : statusUpper === 'CANCELLED' ? (
                        <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                          <XCircle className="w-4 h-4 text-slate-500" />
                          <span>Отменено</span>
                        </span>
                      ) : (
                        <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                          <span>В рассмотрении</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Cover Note Section */}
              {app.cover_note && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    {user?.role === 'employer' ? 'Сопроводительное письмо соискателя:' : 'Ваше сопроводительное письмо:'}
                  </span>
                  <p className="leading-relaxed font-medium">{app.cover_note}</p>
                </div>
              )}

              {/* Employer Feedback Note */}
              {app.employer_feedback && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <span className="font-bold block flex items-center gap-1">
                    💬 Заметка работодателя:
                  </span>
                  <p className="leading-relaxed font-semibold">{app.employer_feedback}</p>
                </div>
              )}

              {/* WORKER ACTION BUTTONS (Edit Cover Note / Cancel Application / Chat with Employer) */}
              {user?.role !== 'employer' && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {statusUpper === 'ACCEPTED' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                        🎉 Работодатель принял ваш отклик! Вы можете написать работодателю прямо в чате.
                      </span>
                    ) : statusUpper === 'REJECTED' ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        ⚠️ Работодатель отклонил этот отклик. Повторный отклик невозможен.
                      </span>
                    ) : statusUpper === 'CANCELLED' ? (
                      <span className="text-slate-500 font-bold">
                        Отклик был отменен.
                      </span>
                    ) : (
                      <span>Отклик успешно доставлен работодателю</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {statusUpper === 'ACCEPTED' && (
                      <button
                        onClick={() => {
                          const empId = app.employer_id || app.company_user_id;
                          if (onNavigateToChat) {
                            onNavigateToChat(empId || null);
                          }
                        }}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 animate-pulse"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Написать работодателю</span>
                      </button>
                    )}

                    {(statusUpper === 'PENDING' || statusUpper === 'REVIEWED') && (
                      <>
                        <button
                          onClick={() => {
                            setEditingCoverApp(app);
                            setNewCoverNote(app.cover_note || '');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
                        >
                          Редактировать письмо
                        </button>
                        <button
                          onClick={() => handleCancelApplication(app.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-800 transition-all"
                        >
                          Отменить отклик
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* EMPLOYER ACTION BAR WITH ANIMATED REJECT BUTTON */}
              {user?.role === 'employer' && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">Статус:</span>
                    
                    {/* Quick Accept & Animated Reject Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setFeedbackApp({ id: app.id, status: 'ACCEPTED' });
                          setFeedbackNote('');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                          statusUpper === 'ACCEPTED'
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{statusUpper === 'ACCEPTED' ? 'Принято' : 'Принять'}</span>
                      </button>

                      {/* Smooth Animated Reject Button */}
                      <div
                        className={`transition-all duration-500 ease-in-out transform origin-left ${
                          statusUpper === 'ACCEPTED'
                            ? 'opacity-0 max-w-0 scale-90 overflow-hidden pointer-events-none p-0 border-0 shadow-none -ml-2'
                            : 'opacity-100 max-w-[140px] scale-100 ml-0'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setFeedbackApp({ id: app.id, status: 'REJECTED' });
                            setFeedbackNote('');
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shadow-2xs active:scale-95 ${
                            statusUpper === 'REJECTED'
                              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/40'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>{statusUpper === 'REJECTED' ? 'Отклонено' : 'Отклонить'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => {
                        const aAny = app as any;
                        const cand: any = {
                          id: aAny.worker_id || aAny.id,
                          user_id: aAny.worker_id,
                          full_name: aAny.worker_name || aAny.full_name || aAny.user?.full_name,
                          desired_position: aAny.job_title,
                          contact_email: aAny.email || aAny.user?.email,
                          user: {
                            id: aAny.worker_id,
                            email: aAny.email || aAny.user?.email,
                            full_name: aAny.worker_name || aAny.full_name || aAny.user?.full_name
                          }
                        };
                        setContactCandidateData({
                          candidate: cand,
                          applicationId: app.id,
                          jobTitle: app.job_title
                        });
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Написать кандидату</span>
                    </button>

                    <button
                      onClick={() => handleViewCandidateProfile(app)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 border border-slate-200 dark:border-slate-600"
                    >
                      <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Посмотреть профиль</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Дата отклика: {app.applied_at}
                </span>

                <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                  Синхронизировано ✓
                </span>
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="ref-card p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-sm">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              {user?.role === 'employer' ? 'В этой категории пока нет откликов' : 'У вас пока нет отправленных откликов'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
              {user?.role === 'employer'
                ? 'Все отклики кандидатов автоматически классифицируются по категориям.'
                : 'Выберите подходящую вакансию в каталоге и нажмите "Откликнуться", чтобы отправить свое резюме.'}
            </p>
          </div>
        </div>
      )}

      {/* Edit Cover Note Modal */}
      {editingCoverApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Редактировать сопроводительное письмо
            </h3>
            <textarea
              value={newCoverNote}
              onChange={(e) => setNewCoverNote(e.target.value)}
              rows={4}
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="Введите текст вашего письма..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingCoverApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveCoverNote}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employer Feedback Note Modal */}
      {feedbackApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {feedbackApp.status === 'ACCEPTED' ? 'Принять соискателя на собеседование' : 'Отклонить отклик кандидату'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Вы можете добавить заметку или сообщение для кандидата (необязательно):
            </p>
            <textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              rows={3}
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder={feedbackApp.status === 'ACCEPTED' ? 'Например: Приглашаем вас на интервью в офисе во вторник в 14:00' : 'Например: К сожалению, на данную позицию требуется более 5 лет опыта'}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFeedbackApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  handleUpdateStatus(feedbackApp.id, feedbackApp.status, feedbackNote);
                  setFeedbackApp(null);
                }}
                className={`px-5 py-2 rounded-xl text-white text-xs font-extrabold ${
                  feedbackApp.status === 'ACCEPTED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time WebSocket Chat Modal */}
      <RealtimeChatModal
        isOpen={!!activeChatRecipient}
        onClose={() => setActiveChatRecipient(null)}
        recipient={activeChatRecipient}
        user={user}
      />

      {/* Candidate Full Profile Detail Modal */}
      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        user={user}
        onOpenAuth={onOpenAuth}
        onOpenChat={(recipientId) => {
          setSelectedCandidate(null);
          if (onNavigateToChat) onNavigateToChat(recipientId);
        }}
      />

      {/* Contact Candidate Modal */}
      <ContactCandidateModal
        candidate={contactCandidateData?.candidate || null}
        applicationId={contactCandidateData?.applicationId || null}
        jobTitle={contactCandidateData?.jobTitle || null}
        onClose={() => setContactCandidateData(null)}
        user={user}
        onOpenAuth={onOpenAuth}
        onOpenChat={onNavigateToChat}
      />

    </div>
  );
};
