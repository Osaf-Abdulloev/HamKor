import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, Plus, Edit3, Trash2, Copy, Send, CheckCircle2, 
  AlertCircle, Eye, RefreshCw, Clock, ArrowRight, Layers, ShieldCheck
} from 'lucide-react';
import { Resume } from '../../types/resume';
import { resumeService } from '../../services/resumeService';
import { ResumeImportWizardModal } from './ResumeImportWizardModal';
import { ResumeEditorPage } from './ResumeEditorPage';
import { useLanguage } from '../../i18n/LanguageContext';

interface ResumeHubPageProps {
  user?: any;
  onOpenAuth?: () => void;
}

export const ResumeHubPage: React.FC<ResumeHubPageProps> = ({ user, onOpenAuth }) => {
  const { t } = useLanguage();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [activeResume, setActiveResume] = useState<Resume | null>(null);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleOpenWizard = () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setIsWizardOpen(true);
  };


  const loadResumes = async () => {
    setIsLoading(true);
    try {
      const data = await resumeService.getResumes();
      setResumes(data);

      const pendingEditId = localStorage.getItem('ergon_edit_resume_id');
      if (pendingEditId) {
        localStorage.removeItem('ergon_edit_resume_id');
        const found = data.find((r) => r.id === pendingEditId);
        if (found) {
          setActiveResume(found);
          setActiveResumeId(found.id);
        } else {
          setActiveResumeId(pendingEditId);
        }
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'employer') {
      loadResumes();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  if (user?.role === 'employer') {
    return (
      <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 max-w-xl mx-auto space-y-4 shadow-sm my-12 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Доступно только соискателям</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
            Конструктор резюме предназначен для соискателей. Как работодатель, вы можете искать готовые резюме специалистов в базе кандидатов или размещать свои вакансии.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateBlankDraft = async () => {
    setIsLoading(true);
    try {
      const newDraft = await resumeService.createDraft({
        title: 'Новый черновик резюме',
        target_position: user?.worker_profile?.desired_position || 'Специалист'
      });
      if (newDraft) {
        setResumes([newDraft, ...resumes]);
        setActiveResume(newDraft);
        setActiveResumeId(newDraft.id);
      }
    } catch (err) {
      console.error('Error creating blank draft:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const dup = await resumeService.duplicateResume(id);
      if (dup) {
        setResumes([dup, ...resumes]);
        setActionMessage('Резюме продублировано');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error duplicating resume:', err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Вы уверены, что хотите удалить этот черновик резюме?')) return;
    try {
      const success = await resumeService.deleteResume(id);
      if (success) {
        setResumes(resumes.filter((r) => r.id !== id));
        if (activeResumeId === id) {
          setActiveResumeId(null);
          setActiveResume(null);
        }
        setActionMessage('Резюме удалено');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error deleting resume:', err);
    }
  };

  // If user selected a specific resume to edit, render Editor Page
  if (activeResumeId) {
    return (
      <ResumeEditorPage
        resumeId={activeResumeId}
        initialResume={activeResume}
        onBack={() => {
          setActiveResumeId(null);
          setActiveResume(null);
          loadResumes();
        }}
        user={user}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* HEADER HERO BANNER */}
      <div className="relative rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-10 shadow-xl overflow-hidden border border-indigo-700/50">
        
        {/* Glow backdrop decorative elements */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-amber-300 text-xs font-black tracking-wide">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>HamKor AI Resume Builder 2.0</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Генерация профессионального резюме с помощью ИИ
          </h1>

          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed font-medium">
            Загрузите свой текущий CV файл или создайте резюме с нуля. ИИ структурирует ваш опыт, выделит ключевые навыки и поможет пройти отбор на лучших работодателей.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenWizard}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Создать резюме с ИИ</span>
            </button>

            <button
              onClick={handleCreateBlankDraft}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Создать с нуля</span>
            </button>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-300 text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* MY RESUMES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Мои Резюме ({resumes.length})</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Загрузка резюме...</p>
          </div>
        ) : resumes.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-4 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">У вас пока нет созданных резюме</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Нажмите «Создать резюме с ИИ», чтобы мгновенно импортировать ваш CV файл и получить готовое резюме.
              </p>
            </div>
            <button
              onClick={handleOpenWizard}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all inline-flex items-center gap-2"
            >

              <Sparkles className="w-4 h-4" />
              <span>Создать резюме с ИИ</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {resumes.map((r) => {
              const isPub = r.is_published;
              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setActiveResume(r);
                    setActiveResumeId(r.id);
                  }}
                  className={`p-6 rounded-2xl bg-white dark:bg-slate-800 border cursor-pointer transition-all hover:shadow-lg relative group flex flex-col justify-between space-y-4 ${
                    isPub ? 'border-indigo-300 dark:border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/80 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isPub ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                      }`}>
                        {isPub ? 'Опубликовано ✓' : 'Черновик'}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDuplicate(r.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700"
                          title="Дублировать"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(r.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {r.title}
                    </h3>
                    
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                      {r.target_position || r.content?.personal_info?.desired_position || 'Специалист'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span>Заполнение:</span>
                      <span className="text-indigo-600 dark:text-indigo-400">🎯 {r.completeness_score}%</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(r.updated_at).toLocaleDateString('ru-RU')}
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Редактировать <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* IMPORT WIZARD MODAL */}
      <ResumeImportWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={(newResume) => {
          setResumes([newResume, ...resumes]);
          setActiveResume(newResume);
          setActiveResumeId(newResume.id);
        }}
        user={user}
        onOpenAuth={onOpenAuth}
      />


    </div>
  );
};
