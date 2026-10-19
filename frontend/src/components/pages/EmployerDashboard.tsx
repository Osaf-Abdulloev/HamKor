import React, { useState, useEffect } from 'react';
import { PlusCircle, Building2, MapPin, DollarSign, CheckCircle2, User, FileText, Briefcase, Clock, ExternalLink, Check, X, Sparkles, MessageSquare, Eye, Calendar, XCircle } from 'lucide-react';
import { jobService, applicationService } from '../../services/api';
import { Job } from '../../types';
import { CandidateDetailModal } from '../candidates/CandidateDetailModal';
import { ContactCandidateModal } from '../candidates/ContactCandidateModal';
import { useLanguage } from '../../i18n/LanguageContext';

interface EmployerDashboardProps {
  onJobCreated: () => void;
  user?: any;
  onOpenAuth?: () => void;
  onOpenChat?: (recipientId: string) => void;
}

export const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ onJobCreated, user, onOpenAuth, onOpenChat }) => {
  const { t } = useLanguage();
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-md">
          <Building2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">Кабинет работодателя защищен</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto font-medium leading-relaxed">
            Чтобы публиковать новые вакансии и получать отклики кандидатов, войдите или зарегистрируйтесь как работодатель.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>Войти или Зарегистрироваться</span>
          </button>
        </div>
      </div>
    );
  }

  if (user?.role !== 'employer') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 shadow-md">
          <Briefcase className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">Раздел только для Работодателей</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto font-medium leading-relaxed">
            Вы авторизованы как соискатель. Публиковать новые вакансии могут только зарегистрированные аккаунты Работодателей и Компаний.
          </p>
        </div>
      </div>
    );
  }

  const [activeSubTab, setActiveSubTab] = useState<'create' | 'my_jobs' | 'applications'>('create');
  
  // Vacancy Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState('г. Душанбе');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [category, setCategory] = useState('Информационные технологии');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // My Created Jobs & Candidate Applications
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [incomingApplications, setIncomingApplications] = useState<any[]>([]);
  const [appFilter, setAppFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'cancelled'>('all');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Modals state
  const [selectedCandidateModal, setSelectedCandidateModal] = useState<any | null>(null);
  const [contactModalCandidate, setContactModalCandidate] = useState<any | null>(null);

  const loadEmployerData = async () => {
    setIsLoadingData(true);
    try {
      // 1. Fetch employer's created jobs directly from my jobs API
      const jobsRes = await jobService.getMyJobs({ limit: 100 });
      const userJobs = jobsRes.items || [];
      setMyJobs(userJobs);

      // 2. Fetch candidate applications for employer
      try {
        const empAppsRes = await applicationService.getEmployerApplications();
        if (empAppsRes && empAppsRes.items) {
          setIncomingApplications(empAppsRes.items);
        } else if (userJobs.length > 0) {
          const appsList: any[] = [];
          for (const j of userJobs.slice(0, 10)) {
            try {
              const appsRes = await applicationService.getJobApplications(j.id);
              if (appsRes.items) {
                appsList.push(...appsRes.items.map((app: any) => ({ ...app, jobTitle: j.title })));
              }
            } catch (e) {}
          }
          setIncomingApplications(appsList);
        }
      } catch (e) {
        if (userJobs.length > 0) {
          const appsList: any[] = [];
          for (const j of userJobs.slice(0, 10)) {
            try {
              const appsRes = await applicationService.getJobApplications(j.id);
              if (appsRes.items) {
                appsList.push(...appsRes.items.map((app: any) => ({ ...app, jobTitle: j.title })));
              }
            } catch (e) {}
          }
          setIncomingApplications(appsList);
        }
      }
    } catch (e) {
      console.error('Error loading employer data:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadEmployerData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let fullDesc = description.trim();
    if (responsibilities.trim()) fullDesc += `\n\nОбязанности:\n${responsibilities.trim()}`;
    if (requirements.trim()) fullDesc += `\n\nТребования:\n${requirements.trim()}`;

    try {
      await jobService.createJob({
        title,
        description: fullDesc,
        location,
        employment_type: employmentType as any,
        category,
        salary_min: salaryMin ? parseInt(salaryMin) : undefined,
        salary_max: salaryMax ? parseInt(salaryMax) : undefined,
        currency: 'TJS',
        status: 'open'
      });

      setSuccess(true);
      onJobCreated();
      
      // Reset Form
      setTitle('');
      setDescription('');
      setResponsibilities('');
      setRequirements('');
      setSalaryMin('');
      setSalaryMax('');

      loadEmployerData();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error creating job:', err);
      setError(err.response?.data?.detail || 'Ошибка при публикации вакансии. Проверьте заполнение полей.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppStatus = async (appId: string, newStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVIEWED') => {
    setIncomingApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: newStatus.toLowerCase() as any } : a))
    );
    try {
      await applicationService.updateStatus(appId, newStatus.toLowerCase());
      await loadEmployerData();
    } catch (e) {
      console.error('Error updating app status:', e);
      await loadEmployerData();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 animate-fade-in">
      
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Кабинет работодателя</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Управляйте публикацией вакансий компании, откликами соискателей и ИИ-подбором.
          </p>
        </div>

        {/* Subtab Navigation Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <button
            onClick={() => setActiveSubTab('create')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Создать вакансию</span>
          </button>

          <button
            onClick={() => setActiveSubTab('my_jobs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'my_jobs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Мои вакансии ({myJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('applications')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'applications'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Отклики ({incomingApplications.length})</span>
          </button>
        </div>
      </div>

      {/* ── 1. CREATE NEW VACANCY FORM TAB ── */}
      {activeSubTab === 'create' && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Публикация новой вакансии</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">HamKor Job Aggregator</span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              <span>Вакансия успешно опубликована! Соискатели теперь могут откликаться.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Название должности / Специальность *</label>
            <input
              type="text"
              required
              placeholder="Например: Главный бухгалтер, Frontend Разработчик, Менеджер по закупкам"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Город / Локация *</label>
              <input
                type="text"
                required
                placeholder="г. Душанбе"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Формат работы</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              >
                <option value="full_time">Полный рабочий день</option>
                <option value="remote">Удаленная работа</option>
                <option value="part_time">Частичная занятость</option>
                <option value="internship">Стажировка / Обучение</option>
                <option value="contract">Проектная / Контрактная работа</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Зарплата от (TJS)</label>
              <input
                type="number"
                placeholder="5000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Зарплата до (TJS)</label>
              <input
                type="number"
                placeholder="12000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Краткое описание вакансии *</label>
            <textarea
              required
              rows={3}
              placeholder="Расскажите о вашей компании и задачах сотрудника..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Обязанности сотрудника</label>
              <textarea
                rows={3}
                placeholder="• Ведение учета кассы&#10;• Составление отчетов..."
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Требования к кандидату</label>
              <textarea
                rows={3}
                placeholder="• Опыт работы от 1 года&#10;• Знание 1С и Excel..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <PlusCircle className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Публикация...' : 'Опубликовать вакансию'}</span>
          </button>
        </form>
      )}

      {/* ── 2. MY CREATED JOBS TAB ── */}
      {activeSubTab === 'my_jobs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Вакансии вашей компании</h2>
            <button
              onClick={() => setActiveSubTab('create')}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center gap-1 shadow-2xs hover:bg-indigo-700 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Новая вакансия</span>
            </button>
          </div>

          {myJobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {myJobs.map((j) => (
                <div key={j.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-black uppercase">
                        Активна
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">{j.location}</span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{j.title}</h3>
                    <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                      {j.salary_min ? `от ${j.salary_min.toLocaleString()} TJS` : 'По договоренности'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveSubTab('applications')}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-extrabold transition-all"
                    >
                      Отклики candidates
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ref-card p-12 text-center space-y-3">
              <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">У вашей компании пока нет опубликованных вакансий</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Нажмите "Создать вакансию", чтобы опубликовать первое объявление.</p>
            </div>
          )}
        </div>
      )}

      {/* ── 3. CANDIDATE APPLICATIONS TAB ── */}
      {activeSubTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Отклики соискателей</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Просматривайте поступившие заявки, резюме и меняйте статусы кандидатов
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0">
              <button
                onClick={() => setAppFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  appFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Все ({incomingApplications.length})
              </button>

              <button
                onClick={() => setAppFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  appFilter === 'pending' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                На рассмотрении
              </button>

              <button
                onClick={() => setAppFilter('accepted')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  appFilter === 'accepted' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Приняты
              </button>

              <button
                onClick={() => setAppFilter('rejected')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  appFilter === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Отклоненные кандидаты
              </button>

              <button
                onClick={() => setAppFilter('cancelled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  appFilter === 'cancelled' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Отмененные
              </button>
            </div>
          </div>

          {incomingApplications.filter((app) => {
            const st = (app.status || '').toUpperCase();
            if (appFilter === 'pending') return st === 'PENDING' || st === 'REVIEWED';
            if (appFilter === 'accepted') return st === 'ACCEPTED';
            if (appFilter === 'rejected') return st === 'REJECTED';
            if (appFilter === 'cancelled') return st === 'CANCELLED';
            return true;
          }).length > 0 ? (
            <div className="space-y-4">
              {incomingApplications.filter((app) => {
                const st = (app.status || '').toUpperCase();
                if (appFilter === 'pending') return st === 'PENDING' || st === 'REVIEWED';
                if (appFilter === 'accepted') return st === 'ACCEPTED';
                if (appFilter === 'rejected') return st === 'REJECTED';
                if (appFilter === 'cancelled') return st === 'CANCELLED';
                return true;
              }).map((app) => {
                const w = app.worker || app.worker_data || {};
                const candidateName = app.worker_name || w.full_name || w.username || app.full_name || 'Соискатель';
                const avatarUrl = w.avatar_url || app.logo_url;
                const position = app.jobTitle || app.job_title || app.job?.title || 'Специалист';
                const city = w.city || app.location || 'г. Душанбе';
                const formattedDate = app.applied_at || (app.created_at ? new Date(app.created_at).toLocaleDateString('ru-RU') : '01.08.2026');
                const appStatusUpper = (app.status || 'PENDING').toString().toUpperCase();

                return (
                  <div
                    key={app.id}
                    className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs hover:shadow-md transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-700 border border-indigo-100 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={candidateName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                              {candidateName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                            {candidateName}
                          </span>
                          <h3 className="text-base font-black text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            {position}
                          </h3>
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <span>{city}</span>
                            <span>•</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{app.salary || 'По договорённости'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {appStatusUpper === 'ACCEPTED' ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Принят на собеседование</span>
                          </span>
                        ) : appStatusUpper === 'REJECTED' ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            <span>Отклонен</span>
                          </span>
                        ) : appStatusUpper === 'REVIEWED' ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span>На рассмотрении</span>
                          </span>
                        ) : appStatusUpper === 'CANCELLED' ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                            <XCircle className="w-4 h-4 text-slate-500" />
                            <span>Отменено</span>
                          </span>
                        ) : (
                          <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                            <span>Новый отклик</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cover Note Section if exists */}
                    {app.cover_note && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          Сопроводительное письмо соискателя:
                        </span>
                        <p className="leading-relaxed font-medium">{app.cover_note}</p>
                      </div>
                    )}

                    {/* EMPLOYER ACTION BAR (ACCEPT/REJECT BUTTONS + CHAT + VIEW PROFILE) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                      {/* Action buttons: Accept / Reject / Status Selector */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleUpdateAppStatus(app.id, 'ACCEPTED')}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                            appStatusUpper === 'ACCEPTED'
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>{appStatusUpper === 'ACCEPTED' ? 'Принято' : 'Принять отклик'}</span>
                        </button>

                        {/* Smooth Animated Reject Button */}
                        <div
                          className={`transition-all duration-500 ease-in-out transform origin-left ${
                            appStatusUpper === 'ACCEPTED'
                              ? 'opacity-0 max-w-0 scale-90 overflow-hidden pointer-events-none p-0 border-0 shadow-none -ml-2'
                              : 'opacity-100 max-w-[140px] scale-100 ml-0'
                          }`}
                        >
                          <button
                            onClick={() => handleUpdateAppStatus(app.id, 'REJECTED')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shadow-2xs active:scale-95 ${
                              appStatusUpper === 'REJECTED'
                                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/40'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white'
                            }`}
                          >
                            <X className="w-4 h-4" />
                            <span>{appStatusUpper === 'REJECTED' ? 'Отклонено' : 'Отклонить'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 ml-1">
                          <span className="text-[11px] font-bold text-slate-400">Статус:</span>
                          <select
                            value={appStatusUpper}
                            onChange={(e) => handleUpdateAppStatus(app.id, e.target.value as any)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
                          >
                            <option value="PENDING">Новый отклик</option>
                            <option value="REVIEWED">Взять на рассмотрение</option>
                            <option value="ACCEPTED">Принять на собеседование</option>
                            <option value="REJECTED">Отклонить отклик</option>
                          </select>
                        </div>
                      </div>

                      {/* Main Buttons: Contact Candidate + View Profile */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={async () => {
                            try {
                              await applicationService.contactCandidate(app.id);
                            } catch (err) {}
                            const workerUserId = app.worker_id || app.worker?.id || app.user_id;
                            if (workerUserId && onOpenChat) {
                              onOpenChat(workerUserId);
                            } else {
                              const cand: any = {
                                id: workerUserId || app.id,
                                user_id: workerUserId,
                                full_name: candidateName,
                                desired_position: position,
                                contact_email: app.email || w.email,
                                user: {
                                  id: workerUserId,
                                  email: app.email || w.email,
                                  full_name: candidateName
                                }
                              };
                              setContactModalCandidate(cand);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-sm active:scale-95 ${
                            app.status === 'ACCEPTED' || app.can_contact
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-black ring-2 ring-indigo-300 dark:ring-indigo-800'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Написать кандидату</span>
                        </button>

                        <button
                          onClick={() => {
                            const cand: any = {
                              id: app.worker_id || app.id,
                              user_id: app.worker_id || app.worker?.id,
                              full_name: candidateName,
                              desired_position: position,
                              contact_email: app.email || w.email,
                              education: w.education,
                              skills: w.skills || [],
                              experiences: w.experiences || [],
                              city: city,
                              desired_salary: app.salary_min || app.salary,
                              user: {
                                id: app.worker_id || app.worker?.id,
                                email: app.email || w.email,
                                full_name: candidateName,
                                avatar_url: avatarUrl,
                                city: city
                              }
                            };
                            setSelectedCandidateModal(cand);
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 border border-slate-200 dark:border-slate-600"
                        >
                          <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Посмотреть профиль</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs text-slate-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Дата отклика: {formattedDate}
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
            <div className="ref-card p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Откликов пока нет</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Когда специалисты начнут откликаться на ваши вакансии, их резюме появятся здесь.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Candidate Full Profile Detail Modal */}
      <CandidateDetailModal
        candidate={selectedCandidateModal}
        onClose={() => setSelectedCandidateModal(null)}
        user={user}
        onOpenAuth={onOpenAuth}
        onOpenChat={(recipientId) => {
          setSelectedCandidateModal(null);
          if (onOpenChat) {
            onOpenChat(recipientId);
          }
        }}
      />

      {/* Contact Candidate Modal */}
      <ContactCandidateModal
        candidate={contactModalCandidate}
        onClose={() => setContactModalCandidate(null)}
        user={user}
        onOpenAuth={onOpenAuth}
        onOpenChat={(chatId) => {
          setContactModalCandidate(null);
          if (onOpenChat) onOpenChat(chatId);
        }}
      />

    </div>
  );
};
