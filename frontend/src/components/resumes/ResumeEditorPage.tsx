import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Save, CheckCircle2, Sparkles, Eye, Edit3, Plus, Trash2, ChevronDown, 
  ChevronUp, Globe, Briefcase, GraduationCap, Award, Code, Send, RefreshCw, AlertCircle, Copy, FileText, X
} from 'lucide-react';
import { Resume, ResumeContent, WorkExperienceItem, EducationItem, LanguageItem, CertificateItem, ProjectItem, CustomSectionItem } from '../../types/resume';
import { resumeService } from '../../services/resumeService';
import { ResumePreviewCard } from './ResumePreviewCard';
import { useLanguage } from '../../i18n/LanguageContext';
import { cleanText } from '../../utils/cleanText';


interface ResumeEditorPageProps {
  resumeId: string;
  initialResume?: Resume | null;
  onBack: () => void;
  user?: any;
}

const sanitizeContent = (raw: any): ResumeContent => {
  const c = typeof raw === 'object' && raw !== null ? raw : {};
  const p = typeof c.personal_info === 'object' && c.personal_info !== null ? c.personal_info : {};
  const s = typeof c.skills === 'object' && c.skills !== null ? c.skills : {};

  return {
    personal_info: {
      full_name: p.full_name || '',
      desired_position: p.desired_position || '',
      email: p.email || '',
      phone: p.phone || '',
      city: p.city || '',
      photo_url: p.photo_url || '',
      summary: p.summary || ''
    },
    work_experience: Array.isArray(c.work_experience) ? c.work_experience.map((item: any) => ({
      id: item.id || `exp-${Date.now()}-${Math.random()}`,
      company_name: item.company_name || '',
      position: item.position || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      is_current: Boolean(item.is_current),
      responsibilities: Array.isArray(item.responsibilities) ? item.responsibilities : [],
      achievements: Array.isArray(item.achievements) ? item.achievements : []
    })) : [],
    education: Array.isArray(c.education) ? c.education.map((item: any) => ({
      id: item.id || `edu-${Date.now()}-${Math.random()}`,
      institution: item.institution || '',
      degree: item.degree || '',
      field_of_study: item.field_of_study || '',
      start_year: item.start_year || '',
      end_year: item.end_year || ''
    })) : [],
    skills: {
      technical: Array.isArray(s.technical) ? s.technical : (Array.isArray(s) ? s : []),
      soft: Array.isArray(s.soft) ? s.soft : []
    },
    languages: Array.isArray(c.languages) ? c.languages : [],
    certificates: Array.isArray(c.certificates) ? c.certificates : [],
    projects: Array.isArray(c.projects) ? c.projects : [],
    social_links: typeof c.social_links === 'object' && c.social_links !== null ? c.social_links : {},
    custom_sections: Array.isArray(c.custom_sections) ? c.custom_sections : []
  };
};

export const ResumeEditorPage: React.FC<ResumeEditorPageProps> = ({ resumeId, initialResume, onBack, user }) => {
  const { t } = useLanguage();
  const [resume, setResume] = useState<Resume | null>(initialResume || null);
  const [content, setContent] = useState<ResumeContent | null>(initialResume?.content ? sanitizeContent(initialResume.content) : null);
  const [title, setTitle] = useState(initialResume?.title || '');
  const [targetPosition, setTargetPosition] = useState(initialResume?.target_position || initialResume?.content?.personal_info?.desired_position || '');

  const [isLoading, setIsLoading] = useState(!initialResume);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Active Tab & View Mode
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [expandedSection, setExpandedSection] = useState<string | null>('personal_info');
  const [showAiDrawer, setShowAiDrawer] = useState(false);

  // New skill input state
  const [newTechSkill, setNewTechSkill] = useState('');
  const [newSoftSkill, setNewSoftSkill] = useState('');

  const autosaveTimerRef = useRef<any>(null);

  // Load initial resume data
  useEffect(() => {
    if (!initialResume) {
      setIsLoading(true);
    }
    resumeService.getResumeById(resumeId).then((res) => {
      if (res) {
        setResume(res);
        setContent(sanitizeContent(res.content));
        setTitle(res.title || 'Моё резюме');
        setTargetPosition(res.target_position || res.content?.personal_info?.desired_position || '');
      }
    }).catch((err) => {
      console.error('Error loading resume by id:', err);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [resumeId, initialResume]);

  // Handle field update & trigger debounced autosave
  const handleContentChange = (updatedContent: ResumeContent) => {
    setContent(updatedContent);

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSave(updatedContent, false);
    }, 1500);
  };

  const handleSave = async (contentToSave = content, showNotification = true) => {
    if (!contentToSave) return;
    setIsSaving(true);
    try {
      const updated = await resumeService.updateResume(resumeId, {
        title,
        target_position: targetPosition,
        content: contentToSave
      });
      if (updated) {
        setResume(updated);
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.error('Autosave error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!content) return;
    setPublishError(null);
    setIsPublishing(true);

    try {
      // First save latest edits
      await handleSave(content, false);
      // Publish
      const published = await resumeService.publishResume(resumeId);
      if (published) {
        setResume(published);
        setPublishSuccess(true);
        setTimeout(() => setPublishSuccess(false), 4000);
      }
    } catch (err: any) {
      setPublishError(err?.response?.data?.detail || 'Не удалось опубликовать резюме. Проверьте обязательные поля.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Helper updater for Personal Info
  const updatePersonalInfo = (field: string, value: string) => {
    if (!content) return;
    const updated = {
      ...content,
      personal_info: { ...content.personal_info, [field]: value }
    };
    handleContentChange(updated);
  };

  // Work Experience Operations
  const addExperienceItem = () => {
    if (!content) return;
    const newItem: WorkExperienceItem = {
      id: `exp-${Date.now()}`,
      company_name: '',
      position: '',
      start_date: '',
      end_date: '',
      is_current: false,
      responsibilities: [''],
      achievements: []
    };
    handleContentChange({
      ...content,
      work_experience: [newItem, ...content.work_experience]
    });
  };

  const updateExperienceItem = (id: string, field: string, value: any) => {
    if (!content) return;
    const updatedExp = content.work_experience.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    handleContentChange({ ...content, work_experience: updatedExp });
  };

  const deleteExperienceItem = (id: string) => {
    if (!content) return;
    handleContentChange({
      ...content,
      work_experience: content.work_experience.filter((item) => item.id !== id)
    });
  };

  // Skill Operations
  const addTechSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed || !content) return;
    if (content.skills.technical.includes(trimmed)) return;
    handleContentChange({
      ...content,
      skills: {
        ...content.skills,
        technical: [...content.skills.technical, trimmed]
      }
    });
    setNewTechSkill('');
  };

  const removeTechSkill = (skill: string) => {
    if (!content) return;
    handleContentChange({
      ...content,
      skills: {
        ...content.skills,
        technical: content.skills.technical.filter((s) => s !== skill)
      }
    });
  };

  const addSoftSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed || !content) return;
    if (content.skills.soft.includes(trimmed)) return;
    handleContentChange({
      ...content,
      skills: {
        ...content.skills,
        soft: [...content.skills.soft, trimmed]
      }
    });
    setNewSoftSkill('');
  };

  const removeSoftSkill = (skill: string) => {
    if (!content) return;
    handleContentChange({
      ...content,
      skills: {
        ...content.skills,
        soft: content.skills.soft.filter((s) => s !== skill)
      }
    });
  };

  // Education Operations
  const addEducationItem = () => {
    if (!content) return;
    const newItem: EducationItem = {
      id: `edu-${Date.now()}`,
      institution: '',
      degree: '',
      field_of_study: '',
      start_year: '',
      end_year: ''
    };
    handleContentChange({
      ...content,
      education: [...content.education, newItem]
    });
  };

  const deleteEducationItem = (id: string) => {
    if (!content) return;
    handleContentChange({
      ...content,
      education: content.education.filter((i) => i.id !== id)
    });
  };

  // Apply AI Suggestion
  const handleApplyAISuggestion = (suggestion: any) => {
    if (!content) return;

    if (suggestion.action_type === 'enhance_summary' && suggestion.payload?.text) {
      updatePersonalInfo('summary', suggestion.payload.text);
    } else if (suggestion.action_type === 'add_skill' && suggestion.payload?.suggested_skills) {
      const currentTech = content.skills.technical;
      const newSkills = suggestion.payload.suggested_skills.filter((s: string) => !currentTech.includes(s));
      handleContentChange({
        ...content,
        skills: {
          ...content.skills,
          technical: [...currentTech, ...newSkills]
        }
      });
    } else if (suggestion.action_type === 'add_section') {
      setExpandedSection('work_experience');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Загрузка редактора резюме...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-8 text-center rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 max-w-md mx-auto space-y-4 shadow-sm my-12 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Резюме не найдено</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Запрошенный документ резюме не найден или у вас нет прав на его просмотр.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Вернуться к списку резюме</span>
        </button>
      </div>
    );
  }

  const p = content.personal_info;
  const completeness = resume?.completeness_score || 50;
  const suggestionsList = resume?.ai_suggestions?.suggestions || [];

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      
      {/* TOP NAV BAR / ACTIONS */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 shadow-xs sticky top-20 z-40 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shrink-0"
            title="Назад к списку резюме"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => handleSave(content, false)}
                className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 bg-transparent outline-none border-b border-transparent focus:border-indigo-500 transition-all truncate max-w-xs"
              />
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                resume?.is_published
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
              }`}>
                {resume?.is_published ? 'Опубликовано ✓' : 'Черновик'}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold mt-0.5">
              <span>{isSaving ? 'Сохранение...' : lastSavedTime ? `Черновик сохранён в ${lastSavedTime}` : 'Черновик автосохраняется'}</span>
              <span>•</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">🎯 {completeness}% Заполнено</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* AI Assistant Button */}
          <button
            onClick={() => setShowAiDrawer(!showAiDrawer)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
              showAiDrawer
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>ИИ Советы ({suggestionsList.length})</span>
          </button>

          {/* Toggle View Mode Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'editor' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Редактор</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Предпросмотр</span>
            </button>
          </div>

          {/* Save Manual */}
          <button
            onClick={() => handleSave(content, true)}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-extrabold transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Сохранить</span>
          </button>

          {/* Publish Button */}
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-bounce' : ''}`} />
            <span>{isPublishing ? 'Публикация...' : 'Опубликовать'}</span>
          </button>
        </div>

      </div>

      {publishSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300 text-xs font-extrabold flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Резюме успешно опубликовано! Оно синхронизировано с вашим публичным профилем соискателя.</span>
        </div>
      )}

      {publishError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-300 text-xs font-extrabold flex items-center gap-3 animate-fade-in shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{publishError}</span>
        </div>
      )}

      {/* MAIN SPLIT VIEW CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: SECTIONS EDITOR */}
        <div className={`space-y-4 ${activeTab === 'preview' ? 'hidden lg:block lg:col-span-5' : 'lg:col-span-6'}`}>
          
          {/* SECTION 1: PERSONAL INFO */}
          <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
            <button
              onClick={() => setExpandedSection(expandedSection === 'personal_info' ? null : 'personal_info')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Личные данные и Желаемая должность</h3>
              </div>
              {expandedSection === 'personal_info' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSection === 'personal_info' && (
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Имя и Фамилия</label>
                    <input
                      type="text"
                      value={p.full_name || ''}
                      onChange={(e) => updatePersonalInfo('full_name', e.target.value)}
                      placeholder="Иван Иванов"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Желаемая должность</label>
                    <input
                      type="text"
                      value={p.desired_position || ''}
                      onChange={(e) => {
                        updatePersonalInfo('desired_position', e.target.value);
                        setTargetPosition(e.target.value);
                      }}
                      placeholder="Frontend Разработчик"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Email</label>
                    <input
                      type="email"
                      value={p.email || ''}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                      placeholder="example@mail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Телефон</label>
                    <input
                      type="text"
                      value={p.phone || ''}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      placeholder="+992 900 000 000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Город проживания</label>
                    <input
                      type="text"
                      value={p.city || ''}
                      onChange={(e) => updatePersonalInfo('city', e.target.value)}
                      placeholder="Душанбе"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">О себе / Профессиональное резюме (Summary)</label>
                  </div>
                  <textarea
                    rows={4}
                    value={p.summary || ''}
                    onChange={(e) => updatePersonalInfo('summary', e.target.value)}
                    placeholder="Кратко опишите ваш ключевой опыт, сильные стороны и профессиональные цели..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100 leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: WORK EXPERIENCE */}
          <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
            <button
              onClick={() => setExpandedSection(expandedSection === 'work_experience' ? null : 'work_experience')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Опыт работы ({content.work_experience.length})</h3>
              </div>
              {expandedSection === 'work_experience' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSection === 'work_experience' && (
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in">
                <div className="flex justify-end pt-3">
                  <button
                    onClick={addExperienceItem}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800/60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить место работы
                  </button>
                </div>

                <div className="space-y-4">
                  {content.work_experience.map((item, idx) => (
                    <div key={item.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 space-y-3 relative">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700 pb-2">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">Опыт #{idx + 1}</span>
                        <button
                          onClick={() => deleteExperienceItem(item.id)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300"
                          title="Удалить место работы"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Название компании</label>
                          <input
                            type="text"
                            value={item.company_name}
                            onChange={(e) => updateExperienceItem(item.id, 'company_name', e.target.value)}
                            placeholder="ООО Компания"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Должность</label>
                          <input
                            type="text"
                            value={item.position}
                            onChange={(e) => updateExperienceItem(item.id, 'position', e.target.value)}
                            placeholder="Инженер / Разработчик"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Дата начала</label>
                          <input
                            type="text"
                            value={item.start_date}
                            onChange={(e) => updateExperienceItem(item.id, 'start_date', e.target.value)}
                            placeholder="01.2022"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Дата окончания</label>
                          <input
                            type="text"
                            disabled={item.is_current}
                            value={item.is_current ? 'По настоящее время' : (item.end_date || '')}
                            onChange={(e) => updateExperienceItem(item.id, 'end_date', e.target.value)}
                            placeholder="12.2023"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`current-${item.id}`}
                          checked={item.is_current || false}
                          onChange={(e) => updateExperienceItem(item.id, 'is_current', e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor={`current-${item.id}`} className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Работаю по настоящее время
                        </label>
                      </div>

                      {/* Responsibilities list input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Обязанности (через новую строку)</label>
                        <textarea
                          rows={3}
                          value={(item.responsibilities || []).map((r) => cleanText(r)).filter((r) => r.length > 0).join('\n')}
                          onChange={(e) => updateExperienceItem(item.id, 'responsibilities', e.target.value.split('\n'))}
                          placeholder="Каждая обязанность с новой строки..."
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: SKILLS */}
          <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
            <button
              onClick={() => setExpandedSection(expandedSection === 'skills' ? null : 'skills')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Навыки и Технологии ({content.skills.technical.length + content.skills.soft.length})</h3>
              </div>
              {expandedSection === 'skills' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSection === 'skills' && (
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in">
                {/* Tech Skills */}
                <div className="space-y-2 pt-3">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Профессиональные / Профильные навыки</label>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTechSkill}
                      onChange={(e) => setNewTechSkill(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTechSkill(newTechSkill))}
                      placeholder="Добавить навык (например: Python, React, CRM)..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => addTechSkill(newTechSkill)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                    >
                      Добавить
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {content.skills.technical.map((sk) => (
                      <span key={sk} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/80 dark:border-indigo-800/60">
                        {sk}
                        <button onClick={() => removeTechSkill(sk)} className="text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Soft Skills */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Гибкие навыки (Soft Skills)</label>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSoftSkill}
                      onChange={(e) => setNewSoftSkill(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSoftSkill(newSoftSkill))}
                      placeholder="Добавить (например: Ответственность, Тайм-менеджмент)..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => addSoftSkill(newSoftSkill)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      Добавить
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {content.skills.soft.map((sk) => (
                      <span key={sk} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200/80 dark:border-emerald-800/60">
                        {sk}
                        <button onClick={() => removeSoftSkill(sk)} className="text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: EDUCATION */}
          <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
            <button
              onClick={() => setExpandedSection(expandedSection === 'education' ? null : 'education')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Образование ({content.education.length})</h3>
              </div>
              {expandedSection === 'education' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSection === 'education' && (
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in">
                <div className="flex justify-end pt-3">
                  <button
                    onClick={addEducationItem}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800/60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить образование
                  </button>
                </div>

                <div className="space-y-3">
                  {content.education.map((item, idx) => (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 space-y-2 relative">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700 pb-1.5">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">Заведение #{idx + 1}</span>
                        <button onClick={() => deleteEducationItem(item.id)} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={item.institution}
                          onChange={(e) => {
                            const updated = content.education.map((ed) => ed.id === item.id ? { ...ed, institution: e.target.value } : ed);
                            handleContentChange({ ...content, education: updated });
                          }}
                          placeholder="Название ВУЗа / Колледжа"
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={item.degree}
                          onChange={(e) => {
                            const updated = content.education.map((ed) => ed.id === item.id ? { ...ed, degree: e.target.value } : ed);
                            handleContentChange({ ...content, education: updated });
                          }}
                          placeholder="Степень (Бакалавр, Магистр)"
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: LIVE PREVIEW & AI SUGGESTIONS DRAWER */}
        <div className={`space-y-6 ${activeTab === 'editor' ? 'hidden lg:block lg:col-span-6' : 'lg:col-span-6'}`}>
          
          {/* AI Suggestions Floating Assistant */}
          {showAiDrawer && suggestionsList.length > 0 && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white shadow-xl border border-purple-500/40 space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h4 className="text-sm font-black text-white">HamKor AI: ИИ-Ассистент резюме</h4>
                </div>
                <button onClick={() => setShowAiDrawer(false)} className="text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {suggestionsList.map((sug: any) => (
                  <div key={sug.id} className="p-3.5 rounded-xl bg-white/10 border border-white/15 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-300">{sug.title}</span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-white/20 text-white">
                        {sug.section}
                      </span>
                    </div>
                    <p className="text-indigo-100 text-[11px] leading-relaxed font-medium">{sug.suggestion}</p>

                    {sug.action_type && (
                      <button
                        onClick={() => handleApplyAISuggestion(sug)}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Применить совет ИИ</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIVE PREVIEW CONTAINER */}
          <div className="sticky top-32">
            <div className="flex items-center justify-between pb-2 px-1 text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span>Интерактивный живой предпросмотр (Live Preview)</span>
              <span className="text-indigo-600 dark:text-indigo-400">Обновляется мгновенно</span>
            </div>

            <ResumePreviewCard content={content} title={title} />
          </div>

        </div>

      </div>

    </div>
  );
};
