import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Globe, Mail, Phone, MapPin, Sparkles, CheckCircle2, 
  Plus, Trash2, Save, Eye, Check, Search, ChevronDown, User, ArrowUpRight, Filter
} from 'lucide-react';
import { Candidate } from '../../types';
import { candidateService, profileService, fileService } from '../../services/api';
import { 
  getSavedEmployerProfile, 
  saveEmployerProfile, 
  EmployerProfileData, 
  evaluateEmployerCandidateMatch,
  sortCandidatesByEmployerMatch,
  DEFAULT_USER_AVATAR 
} from '../../services/matchService';
import { CandidateDetailModal } from '../candidates/CandidateDetailModal';
import { TAJIKISTAN_CITIES } from './ProfilePage';

interface EmployerProfilePageProps {
  user: any;
  onOpenAuth?: () => void;
  onNavigateToPostJob?: () => void;
}

export const EmployerProfilePage: React.FC<EmployerProfilePageProps> = ({
  user,
  onOpenAuth,
  onNavigateToPostJob
}) => {
  const [profile, setProfile] = useState<EmployerProfileData>({
    company_name: user?.company_name || user?.full_name || user?.username || '',
    inn: '',
    industry: '',
    company_description: '',
    location: user?.city || 'г. Душанбе',
    address: '',
    website: '',
    contact_email: user?.email || '',
    contact_phone: user?.phone || '',
    target_position: '',
    required_skills: [],
    min_experience_years: '',
    offered_salary_min: undefined,
    offered_salary_max: undefined,
    avatar_url: user?.avatar_url || '',
    logo_url: user?.avatar_url || ''
  });

  const [newSkillInput, setNewSkillInput] = useState('');
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'matches'>('profile');

  // Load profile strictly from backend PostgreSQL DB on mount
  useEffect(() => {
    const loadCompanyBackendProfile = async () => {
      if (user?.id) {
        try {
          const cp = await profileService.getCompanyProfile();
          if (cp) {
            setProfile({
              company_name: cp.company_name || user.company_name || user.full_name || user.username || '',
              inn: cp.inn || '',
              industry: cp.industry || '',
              company_description: cp.description || '',
              location: cp.address || user.city || 'г. Душанбе',
              address: cp.address || '',
              website: cp.website || '',
              contact_email: cp.contact_email || user.email || '',
              contact_phone: cp.contact_phone || user.phone || '',
              employee_count: cp.employee_count || '',
              logo_url: cp.logo_url || user.avatar_url || '',
              avatar_url: cp.logo_url || user.avatar_url || '',
              target_position: cp.target_position || '',
              required_skills: Array.isArray(cp.required_skills) ? cp.required_skills : [],
              min_experience_years: cp.min_experience_years || '',
              offered_salary_min: cp.offered_salary_min ?? undefined,
              offered_salary_max: cp.offered_salary_max ?? undefined
            });
          }
        } catch (e) {
          console.error('Failed to load company profile from backend DB:', e);
        }
      }
    };

    loadCompanyBackendProfile();
  }, [user?.id]);

  // Load real candidates from API
  useEffect(() => {
    candidateService.getCandidates({ limit: 30 })
      .then((res) => {
        if (res.items) setCandidates(res.items);
      })
      .catch((err) => console.error('Error fetching candidates for employer matching:', err));
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      const rawMin = profile.offered_salary_min as any;
      const cleanSalaryMin = (rawMin !== '' && rawMin !== null && rawMin !== undefined)
        ? parseFloat(String(rawMin))
        : undefined;

      const rawMax = profile.offered_salary_max as any;
      const cleanSalaryMax = (rawMax !== '' && rawMax !== null && rawMax !== undefined)
        ? parseFloat(String(rawMax))
        : undefined;

      const logoUrl = (profile.logo_url || profile.avatar_url) ? (profile.logo_url || profile.avatar_url) : undefined;

      // 1. Update Company Profile in PostgreSQL Database
      let updatedCp: any = null;
      try {
        updatedCp = await profileService.updateCompanyProfile({
          company_name: profile.company_name,
          inn: profile.inn || undefined,
          industry: profile.industry || undefined,
          description: profile.company_description || undefined,
          website: profile.website || undefined,
          contact_email: profile.contact_email || undefined,
          contact_phone: profile.contact_phone || undefined,
          address: profile.address || profile.location || undefined,
          logo_url: logoUrl,
          employee_count: (profile as any).employee_count ? String((profile as any).employee_count) : undefined,
          target_position: profile.target_position || undefined,
          required_skills: profile.required_skills,
          min_experience_years: profile.min_experience_years ? String(profile.min_experience_years) : undefined,
          offered_salary_min: Number.isNaN(cleanSalaryMin) ? undefined : cleanSalaryMin,
          offered_salary_max: Number.isNaN(cleanSalaryMax) ? undefined : cleanSalaryMax
        });
      } catch (cpErr) {
        console.error('Error updating company profile in DB:', cpErr);
      }

      // 2. Update User Details in PostgreSQL Database
      let updatedUser: any = null;
      try {
        updatedUser = await profileService.updateUser({
          full_name: profile.company_name,
          avatar_url: logoUrl,
          phone: profile.contact_phone || undefined,
          city: profile.location || undefined
        });
      } catch (uErr) {
        console.error('Error updating user in DB:', uErr);
      }

      // Update local user in localStorage & trigger event so Navbar updates immediately
      if (updatedUser) {
        const storedUser = localStorage.getItem('ergon_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            const merged = { ...parsed, ...updatedUser, avatar_url: profile.logo_url || profile.avatar_url };
            localStorage.setItem('ergon_user', JSON.stringify(merged));
            window.dispatchEvent(new Event('ergon_user_updated'));
          } catch (e) {
            console.error('Error updating ergon_user in localStorage:', e);
          }
        }
      }

      // 3. Update local state directly from backend response
      if (updatedCp) {
        setProfile({
          company_name: updatedCp.company_name || profile.company_name,
          inn: updatedCp.inn || '',
          industry: updatedCp.industry || '',
          company_description: updatedCp.description || '',
          location: updatedCp.address || profile.location,
          address: updatedCp.address || '',
          website: updatedCp.website || '',
          contact_email: updatedCp.contact_email || profile.contact_email,
          contact_phone: updatedCp.contact_phone || profile.contact_phone,
          employee_count: updatedCp.employee_count || '',
          logo_url: updatedCp.logo_url || profile.logo_url,
          avatar_url: updatedCp.logo_url || profile.avatar_url,
          target_position: updatedCp.target_position || '',
          required_skills: Array.isArray(updatedCp.required_skills) ? updatedCp.required_skills : profile.required_skills,
          min_experience_years: updatedCp.min_experience_years || '',
          offered_salary_min: updatedCp.offered_salary_min ?? profile.offered_salary_min,
          offered_salary_max: updatedCp.offered_salary_max ?? profile.offered_salary_max
        });
      }

      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 4000);
    } catch (err) {
      console.error('Failed to save company profile to backend DB:', err);
      alert('Ошибка при сохранении профиля компании. Попробуйте снова.');
    }
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;

      // 1. Set instant local preview
      setProfile((prev) => ({
        ...prev,
        logo_url: base64String,
        avatar_url: base64String
      }));

      // 2. Attempt dedicated multipart upload
      try {
        const updatedCompany = await profileService.uploadCompanyLogo(file);
        const serverLogoUrl = updatedCompany?.logo_url || '';

        if (serverLogoUrl) {
          setProfile((prev) => ({
            ...prev,
            logo_url: serverLogoUrl,
            avatar_url: serverLogoUrl
          }));

          const storedUser = localStorage.getItem('ergon_user');
          if (storedUser) {
            try {
              const parsed = JSON.parse(storedUser);
              localStorage.setItem('ergon_user', JSON.stringify({ ...parsed, avatar_url: serverLogoUrl }));
            } catch (e) {}
          }
          window.dispatchEvent(new Event('ergon_user_updated'));
          window.dispatchEvent(new Event('ergon_profile_updated'));
          return;
        }
      } catch (err: any) {
        console.warn('Multipart upload failed, using automatic base64 persistence fallback:', err);
      }

      // 3. Fallback: Save base64 string to PostgreSQL via profileService
      try {
        const updatedCompany = await profileService.updateCompanyProfile({ logo_url: base64String });
        await profileService.updateUser({ avatar_url: base64String });
        const savedUrl = updatedCompany?.logo_url || base64String;

        setProfile((prev) => ({
          ...prev,
          logo_url: savedUrl,
          avatar_url: savedUrl
        }));

        const storedUser = localStorage.getItem('ergon_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            localStorage.setItem('ergon_user', JSON.stringify({ ...parsed, avatar_url: savedUrl }));
          } catch (e) {}
        }
        window.dispatchEvent(new Event('ergon_user_updated'));
        window.dispatchEvent(new Event('ergon_profile_updated'));
      } catch (fallbackErr) {
        console.error('Failed to persist company photo:', fallbackErr);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = async () => {
    try {
      await profileService.deleteCompanyLogo();
      setProfile((prev) => ({
        ...prev,
        logo_url: '',
        avatar_url: ''
      }));

      const storedUser = localStorage.getItem('ergon_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          localStorage.setItem('ergon_user', JSON.stringify({ ...parsed, avatar_url: '' }));
        } catch (e) {}
      }
      window.dispatchEvent(new Event('ergon_user_updated'));
      window.dispatchEvent(new Event('ergon_profile_updated'));
    } catch (err) {
      console.warn('Failed to delete logo from backend:', err);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (trimmed && !profile.required_skills.includes(trimmed)) {
      setProfile((prev) => ({
        ...prev,
        required_skills: [...prev.required_skills, trimmed]
      }));
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setProfile((prev) => ({
      ...prev,
      required_skills: prev.required_skills.filter((s) => s !== skillToRemove)
    }));
  };

  // Evaluate & sort candidates according to employer criteria
  const matchedCandidates = useMemo(() => {
    return sortCandidatesByEmployerMatch(candidates, profile);
  }, [candidates, profile]);

  const topMatchCount = matchedCandidates.filter(
    (c) => evaluateEmployerCandidateMatch(c, profile).matchScore >= 80
  ).length;

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm">
          <Building2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Профиль работодателя</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Пожалуйста, войдите в аккаунт или зарегистрируйтесь как работодатель, чтобы просмотреть и настроить профиль вашей компании.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-lg shadow-indigo-600/30"
        >
          <User className="w-5 h-5" />
          <span>Войти / Зарегистрироваться</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in pb-16">
      
      {/* Top Profile Header */}
      <div className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-1 shrink-0 shadow-md">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden">
              {(profile.logo_url || profile.avatar_url) ? (
                <img src={profile.logo_url || profile.avatar_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {profile.company_name || 'Профиль Работодателя'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold border border-indigo-100 dark:border-indigo-800/60">
                Работодатель
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> {profile.location} {profile.address ? `• ${profile.address}` : ''}
              <span>•</span>
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> {profile.industry}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Данные компании</span>
          </button>

          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 relative ${
              activeTab === 'matches'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>ИИ-Подбор кандидатов</span>
            {topMatchCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                {topMatchCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'profile' ? (
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Section 1: Company Profile Info */}
          <div className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  Информация о вашей компании
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-semibold">Используется для ИИ-подбора</span>
            </div>

            {/* Company Logo Photo Picker */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80 border border-indigo-100/80 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shadow-sm">
                  {(profile.logo_url || profile.avatar_url) ? (
                    <img src={profile.logo_url || profile.avatar_url} alt="Company Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-10 h-10 text-indigo-400" />
                  )}
                </div>
                <label className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl cursor-pointer transition-opacity text-white text-xs font-bold">
                  {(profile.logo_url || profile.avatar_url) ? 'Изменить' : 'Выбрать'}
                  <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                </label>
              </div>

              <div className="flex-1 space-y-2 w-full">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  Логотип / Фото компании
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95">
                    <span>{(profile.logo_url || profile.avatar_url) ? 'Изменить фото' : 'Загрузить фото'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                  </label>

                  {(profile.logo_url || profile.avatar_url) && (
                    <button
                      type="button"
                      onClick={handleDeleteLogo}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Удалить фото</span>
                    </button>
                  )}

                  <input
                    type="text"
                    placeholder="Или вставьте URL картинки логотипа"
                    value={profile.logo_url || ''}
                    onChange={(e) => setProfile({ ...profile, logo_url: e.target.value, avatar_url: e.target.value })}
                    className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Вы можете заменить текущее фото на новое или вставить ссылку. Формат: PNG, JPG, WebP до 5 МБ.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Название компании <span className="text-emerald-500 font-normal">(из регистрации)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: ЗАО Банк Арванд / ООО ТоргКомплекс"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                />
              </div>

              {/* Company INN */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  ИНН компании <span className="text-amber-600 dark:text-amber-400 font-medium text-[10px] bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">🔒 Неизменяемое поле</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  placeholder="ИНН не указан"
                  value={profile.inn || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-xs font-bold outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed select-none transition-all"
                />
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Сфера деятельности (Индустрия)</label>
                <select
                  value={profile.industry}
                  onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                >
                  <option value="IT & Технологии">IT & Технологии / Веб-разработка</option>
                  <option value="Финансы и банки">Финансы, Банки и Банковские услуги</option>
                  <option value="Торговля & Продажи">Торговля & Продажи & Дистрибуция</option>
                  <option value="Строительство & Архитектура">Строительство & Архитектура</option>
                  <option value="Услуги & Консалтинг">Услуги & Консалтинг & Юриспруденция</option>
                  <option value="Производство & Промышленность">Производство & Промышленность</option>
                  <option value="Медицина & Фармацевтика">Медицина & Фармацевтика</option>
                  <option value="Образование & Наука">Образование & Наука</option>
                  <option value="Логистика & Транспорт">Логистика & Транспорт</option>
                </select>
              </div>

              {/* Location (City) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Город в Таджикистане</label>
                <select
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                >
                  {TAJIKISTAN_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Company Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Улица и адрес офиса</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Например: проспект Рудаки 45, БЦ Помир, 4 этаж"
                    value={profile.address || ''}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full text-xs font-semibold bg-transparent outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Веб-сайт или страница компании</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="url"
                    placeholder="https://mycompany.tj"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="w-full text-xs font-semibold bg-transparent outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Contact Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Контактный Email HR отдела</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="email"
                    placeholder="hr@company.tj"
                    value={profile.contact_email}
                    onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                    className="w-full text-xs font-semibold bg-transparent outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Телефон HR / Отдела кадров</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="tel"
                    placeholder="+992 900 000 000"
                    value={profile.contact_phone}
                    onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                    className="w-full text-xs font-semibold bg-transparent outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

            </div>

            {/* Description */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Описание компании и культура</label>
              <textarea
                rows={3}
                placeholder="Расскажите об основных направлениях деятельности компании, преимуществах работы у вас..."
                value={profile.company_description}
                onChange={(e) => setProfile({ ...profile, company_description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>
          </div>

          {/* Section 2: AI Candidate Hiring Requirements */}
          <div className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  Требования для ИИ-подбора сотрудников
                </h2>
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                ⚡ Алгоритм Smart Match
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Target Position */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Искомая должность специалиста</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Главный бухгалтер / iOS Разработчик"
                  value={profile.target_position}
                  onChange={(e) => setProfile({ ...profile, target_position: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                />
              </div>

              {/* Min Experience */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Требуемый опыт работы</label>
                <select
                  value={profile.min_experience_years}
                  onChange={(e) => setProfile({ ...profile, min_experience_years: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                >
                  <option value="Без опыта">Без опыта / Начинающий</option>
                  <option value="1-3 года">От 1 до 3 лет</option>
                  <option value="3-5 лет">От 3 до 5 лет</option>
                  <option value="Более 5 лет">Более 5 лет (Senior)</option>
                </select>
              </div>

              {/* Salary Min */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Предлагаемая окладная вилка от (TJS)</label>
                <input
                  type="number"
                  placeholder="6000"
                  value={profile.offered_salary_min || ''}
                  onChange={(e) => setProfile({ ...profile, offered_salary_min: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                />
              </div>

              {/* Salary Max */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Предлагаемая окладная вилка до (TJS)</label>
                <input
                  type="number"
                  placeholder="12000"
                  value={profile.offered_salary_max || ''}
                  onChange={(e) => setProfile({ ...profile, offered_salary_max: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                />
              </div>

            </div>

            {/* Key Skills Tags Manager */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ключевые требуемые навыки (Ключевые слова для ИИ)</label>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Добавьте навык (например: React, 1С, SQL, Маркетинг)..."
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {profile.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-xs font-extrabold border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Save Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 p-4 rounded-2xl shadow-sm">
            {isSavedNotice ? (
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Профиль работодателя и настройки ИИ-подбора сохранены!
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-semibold">
                Изменения моментально обновят ранжирование кандидатов
              </span>
            )}

            <button
              type="submit"
              className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2 ml-auto"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить профиль</span>
            </button>
          </div>

        </form>
      ) : (
        /* TAB 2: AI MATCHED CANDIDATES LIST */
        <div className="space-y-6 animate-fade-in">
          
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-6 rounded-3xl shadow-md border border-indigo-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] mb-2 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
                Smart Match Engine Active
              </div>
              <h2 className="text-lg sm:text-xl font-black">
                ИИ-Подбор для: "{profile.target_position || 'Специалист'}" ({profile.location})
              </h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                Ранжирование базы анкет Таджикистана на основе совпадения требуемых навыков, зарплаты и квалификации.
              </p>
            </div>

            {onNavigateToPostJob && (
              <button
                onClick={onNavigateToPostJob}
                className="px-5 py-2.5 rounded-xl bg-white text-indigo-950 font-black text-xs shrink-0 shadow-md hover:bg-slate-100 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Опубликовать вакансию</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchedCandidates.map((cand) => {
              const u: any = cand.user || {};
              const name = u.full_name || u.username || 'Соискатель';
              const pos = cand.desired_position || 'Специалист';
              const avatarUrl = u.avatar_url;
              const city = u.city || 'Душанбе';
              const salary = cand.desired_salary;
              const { matchScore, matchedSkills } = evaluateEmployerCandidateMatch(cand, profile);

              return (
                <div
                  key={cand.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-indigo-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group relative"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-700 border border-indigo-100 dark:border-slate-600 p-0.5 shrink-0 overflow-hidden shadow-xs">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <div className="w-full h-full rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center">
                            {name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="overflow-hidden flex-1">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 inline-block mb-1">
                          🎯 {matchScore}% Совпадение
                        </span>
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {name}
                        </h3>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">{pos}</p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {city}
                      </span>
                      {salary && (
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          от {salary.toLocaleString()} TJS
                        </span>
                      )}
                    </div>

                    {matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {matchedSkills.map((sk) => (
                          <span key={sk} className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                            ✓ {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedCandidate(cand)}
                    className="w-full py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white dark:hover:text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Посмотреть резюме</span>
                  </button>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Candidate Detail Modal */}
      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        user={user}
      />

    </div>
  );
};
