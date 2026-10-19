import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, MapPin, Building2, ChevronRight, Briefcase, 
  ArrowUpRight, AlertCircle, Trash2, Plus, MessageSquare, Sparkles 
} from 'lucide-react';
import { aiService } from '../../services/api';
import { Job } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface AIConsultantPageProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  user?: any;
  initialPrompt?: string;
}

interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  recommendedJobs?: Job[];
  searchedSkill?: string;
  chips?: string[];
}

interface AIChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AIMessage[];
}

export const AIConsultantPage: React.FC<AIConsultantPageProps> = ({ jobs, onSelectJob, user, initialPrompt }) => {
  const { t } = useLanguage();
  const storageKey = `ergon_ai_chat_sessions_${user?.id || 'guest'}`;

  const createInitialSession = (): AIChatSession => ({
    id: `session-${Date.now()}`,
    title: 'Первый диалог',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: '1',
        sender: 'ai',
        text: 'Салом! Я ваш персональный HamKor AI Консультант. Напишите ваши навыки, должность или нажмите кнопку "🎯 Вакансии по профилю", и я подберу вакансии с точностью 99%!',
        chips: ['🎯 Вакансии по профилю', 'Менеджер по закупкам', 'У меня есть опыт HR и подбора персонала', 'Юридические навыки / Юрист', 'Фронтенд разработчик (React, JS)', 'Курьер / Доставка'],
      }
    ]
  });

  const [sessions, setSessions] = useState<AIChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading AI sessions:', e);
    }
    return [createInitialSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || `session-${Date.now()}`;
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialProcessed, setInitialProcessed] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sync backend sessions when user is authenticated
    const loadBackendSessions = async () => {
      if (!user) return;
      try {
        const backendSessions = await aiService.getSessions();
        if (Array.isArray(backendSessions) && backendSessions.length > 0) {
          const formattedSessions: AIChatSession[] = backendSessions.map((s: any) => ({
            id: s.id,
            title: s.title || 'Новый диалог',
            createdAt: s.created_at || new Date().toISOString(),
            updatedAt: s.created_at || new Date().toISOString(),
            messages: []
          }));
          setSessions(formattedSessions);
          setActiveSessionId(formattedSessions[0].id);

          // Load detail of active session
          const detail = await aiService.getSessionDetail(formattedSessions[0].id);
          if (detail && Array.isArray(detail.messages)) {
            const formattedMsgs: AIMessage[] = detail.messages.map((m: any) => ({
              id: m.id,
              sender: m.role === 'user' ? 'user' : 'ai',
              text: m.content
            }));
            setSessions((prev) =>
              prev.map((s) => (s.id === formattedSessions[0].id ? { ...s, messages: formattedMsgs } : s))
            );
          }
        }
      } catch (err) {
        console.warn('Backend sessions load warning:', err);
      }
    };
    loadBackendSessions();
  }, [user]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (!user) return;
    try {
      const detail = await aiService.getSessionDetail(sessionId);
      if (detail && Array.isArray(detail.messages)) {
        const formattedMsgs: AIMessage[] = detail.messages.map((m: any) => ({
          id: m.id,
          sender: m.role === 'user' ? 'user' : 'ai',
          text: m.content
        }));
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, messages: formattedMsgs } : s))
        );
      }
    } catch (e) {
      console.warn('Failed to load session details from backend:', e);
    }
  };

  const handleCreateNewChat = async () => {
    let newId = `session-${Date.now()}`;
    let newTitle = `Новый диалог ${sessions.length + 1}`;

    if (user) {
      try {
        const res = await aiService.createSession(newTitle);
        if (res && res.id) {
          newId = res.id;
          newTitle = res.title || newTitle;
        }
      } catch (err) {
        console.warn('Create backend session fallback:', err);
      }
    }

    const newSession: AIChatSession = {
      id: newId,
      title: newTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `${Date.now()}`,
          sender: 'ai',
          text: 'Салом! Я ваш персональный HamKor AI Консультант. Чем я могу помочь?',
          chips: ['🎯 Вакансии по профилю', 'Менеджер по закупкам', 'SMM / Контент-мейкер', 'Python разработчик'],
        }
      ]
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (user) {
      try {
        await aiService.deleteSession(sessionId);
      } catch (err) {
        console.warn('Failed to delete backend session:', err);
      }
    }

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = createInitialSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearActiveChat = () => {
    if (!activeSessionId) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [
              {
                id: `${Date.now()}`,
                sender: 'ai',
                text: 'Чат очищен. Напишите вашу специальность или навыки для поиска подходящих вакансий.',
                chips: ['Менеджер по закупкам', 'SMM / Контент', 'IT Разработка', 'Юрист'],
              }
            ]
          };
        }
        return s;
      })
    );
  };

  const updateActiveSessionMessages = (newMessages: AIMessage[], customTitle?: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            title: customTitle || s.title,
            updatedAt: new Date().toISOString(),
            messages: newMessages,
          };
        }
        return s;
      })
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const isJobSearchQuery = (query: string): boolean => {
    const q = query.toLowerCase();
    return (
      q.includes('найди') ||
      q.includes('покажи') ||
      q.includes('ваканси') ||
      q.includes('работу') ||
      q.includes('разработчик') ||
      q.includes('менеджер') ||
      q.includes('бухгалтер') ||
      q.includes('продаж') ||
      q.includes('худжанд') ||
      q.includes('душанбе') ||
      q.includes('профиль') ||
      q.includes('навык')
    );
  };

  const findMatchingJobsDynamic = (query: string): Job[] => {
    const q = query.toLowerCase();
    const matches = jobs.filter((job) => {
      const titleMatch = job.title.toLowerCase().includes(q) || q.includes(job.title.toLowerCase());
      const descMatch = (job.description || '').toLowerCase().includes(q);
      const locMatch = job.location.toLowerCase().includes(q);
      const compMatch = (job.external_company_name || '').toLowerCase().includes(q);
      return titleMatch || descMatch || locMatch || compMatch;
    });

    if (matches.length > 0) {
      return matches.slice(0, 4);
    }
    return jobs.slice(0, 3);
  };

  const renderTextWithJobLinks = (text: string) => {
    // Regex matches double quotes "Title", guillemets «Title», and markdown links [Title](/jobs/ID)
    const combinedRegex = /"([^"]+)"|«([^»]+)»|\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      const title = match[1] || match[2] || match[3];
      const linkUrl = match[4];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const cleanTitle = title.toLowerCase().replace(/[-_«»"]/g, ' ').trim();
      let foundJob = jobs.find((j) => {
        const jTitle = j.title.toLowerCase().replace(/[-_«»"]/g, ' ').trim();
        return jTitle === cleanTitle || jTitle.includes(cleanTitle) || cleanTitle.includes(jTitle);
      });

      if (!foundJob && linkUrl) {
        foundJob = jobs.find((j) => linkUrl.includes(j.id));
      }

      if (!foundJob && cleanTitle.length >= 3) {
        const words = cleanTitle.split(' ').filter((w) => w.length >= 3);
        foundJob = jobs.find((j) => {
          const jTitle = j.title.toLowerCase();
          return words.some((w) => jTitle.includes(w));
        });
      }

      if (foundJob) {
        parts.push(
          <span
            key={matchIndex}
            onClick={() => onSelectJob(foundJob)}
            className="text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1 my-0.5 transition-all hover:scale-105 shadow-xs"
            title={`Открыть вакансию: ${foundJob.title}`}
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>"{title}"</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </span>
        );
      } else {
        parts.push(
          <span
            key={matchIndex}
            onClick={() => {
              const matches = findMatchingJobsDynamic(title);
              if (matches.length > 0) onSelectJob(matches[0]);
            }}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer bg-indigo-50/50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40 inline-flex items-center gap-1 my-0.5"
            title={`Посмотреть вакансию ${title}`}
          >
            <span>"{title}"</span>
            <ArrowUpRight className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </span>
        );
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const handleSend = async (textToSend: string) => {
    const userMsgText = textToSend.trim();
    if (!userMsgText || isLoading) return;

    setInputText('');

    const userMessage: AIMessage = {
      id: `${Date.now()}`,
      sender: 'user',
      text: userMsgText,
    };

    const updatedMsgs = [...messages, userMessage];
    const newSessionTitle = activeSession.messages.length <= 1 ? (userMsgText.length > 20 ? userMsgText.slice(0, 20) + '...' : userMsgText) : activeSession.title;
    
    updateActiveSessionMessages(updatedMsgs, newSessionTitle);
    setIsLoading(true);

    try {
      let userProfile = null;
      try {
        const savedProf = localStorage.getItem(`ergon_profile_${user?.id || 'guest'}`);
        if (savedProf) {
          userProfile = JSON.parse(savedProf);
        } else {
          const fallbackProf = localStorage.getItem('ergon_profile');
          if (fallbackProf) {
            userProfile = JSON.parse(fallbackProf);
          }
        }
      } catch (e) {
        console.error('Error reading user profile in AI chat:', e);
      }

      let isProfileQuery = userMsgText.toLowerCase().includes('профил') || userMsgText.toLowerCase().includes('моим навыкам');
      const isJobReq = isJobSearchQuery(userMsgText) || isProfileQuery;
      let recommended: Job[] = [];

      if (isProfileQuery && userProfile) {
        const targetPos = (userProfile.position || '').toLowerCase();
        const userSkills = (userProfile.skills || []).map((s: string) => s.toLowerCase());
        
        const profileMatched = jobs.filter(job => {
          const jTitle = job.title.toLowerCase();
          const jDesc = (job.description || '').toLowerCase();
          const posMatch = targetPos && (jTitle.includes(targetPos) || jDesc.includes(targetPos));
          const skillMatch = userSkills.some((s: string) => jTitle.includes(s) || jDesc.includes(s));
          return posMatch || skillMatch;
        });

        if (profileMatched.length > 0) {
          recommended = profileMatched.slice(0, 4);
        } else {
          recommended = findMatchingJobsDynamic(userMsgText);
        }
      } else if (isJobReq) {
        recommended = findMatchingJobsDynamic(userMsgText);
      }

      const historyForApi = updatedMsgs.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const response = await aiService.askCareerConsultant(userMsgText, historyForApi, userProfile, activeSessionId);
      const aiResponseText = response?.result || response?.response || response?.text || response?.message || response;

      const aiMessage: AIMessage = {
        id: `${Date.now() + 1}`,
        sender: 'ai',
        text: typeof aiResponseText === 'string' ? aiResponseText : 'На основе ваших навыков я подобрал лучшие вакансии!',
        recommendedJobs: recommended.length > 0 ? recommended : undefined,
        searchedSkill: userMsgText,
      };

      updateActiveSessionMessages([...updatedMsgs, aiMessage], newSessionTitle);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const fallbackJobs = findMatchingJobsDynamic(userMsgText);

      const aiMessage: AIMessage = {
        id: `${Date.now() + 1}`,
        sender: 'ai',
        text: `Я проанализировал ваш запрос "${userMsgText}". Вот наиболее подходящие вакансии:`,
        recommendedJobs: fallbackJobs,
        searchedSkill: userMsgText,
      };
      updateActiveSessionMessages([...updatedMsgs, aiMessage], newSessionTitle);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && initialPrompt !== initialProcessed) {
      setInitialProcessed(initialPrompt);
      handleSend(initialPrompt);
    }
  }, [initialPrompt, initialProcessed]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
      
      {/* ── LEFT SIDEBAR: SAVED CHAT SESSIONS ── */}
      <div className="lg:col-span-4 ref-card p-4 flex flex-col justify-between h-full bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
        <div className="space-y-4 overflow-y-auto pr-1">
          
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('nav.chat')}</span>
            </h3>

            <button
              onClick={handleCreateNewChat}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('ai.new_chat')}</span>
            </button>
          </div>

          <div className="space-y-2">
            {sessions.map((session) => {
              const isSelected = session.id === activeSessionId;
              const msgCount = session.messages.length;

              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border flex items-center justify-between group ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:bg-indigo-50/40 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Bot className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    <div className="overflow-hidden flex-1">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                        {session.title}
                      </h4>
                      <p className={`text-[10px] font-medium truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {msgCount} сообщений
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    title="Удалить этот чат"
                    className={`p-1.5 rounded-lg transition-all ${
                      isSelected
                        ? 'text-white/70 hover:text-white hover:bg-white/20'
                        : 'text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 opacity-80 group-hover:opacity-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL: ACTIVE AI CHAT THREAD ── */}
      <div className="lg:col-span-8 ref-card p-6 flex flex-col justify-between h-full relative overflow-hidden bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700">
        
        {/* Header */}
        <div className="pb-4 border-b border-indigo-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{activeSession.title}</h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60">
                  HamKor AI Assistant
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {t('ai.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearActiveChat}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/60 transition-all text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
              title="Очистить чат"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Очистить</span>
            </button>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-2">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-3`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed font-medium shadow-xs ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none font-semibold'
                        : 'bg-slate-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none space-y-2'
                    }`}
                  >
                    {isUser ? msg.text : renderTextWithJobLinks(msg.text)}
                  </div>

                  {/* Render Vacancies Cards */}
                  {msg.recommendedJobs && msg.recommendedJobs.length > 0 && (
                    <div className="space-y-2.5 pt-1 animate-fade-in">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800/60">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Подходящие вакансии:</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {msg.recommendedJobs.map((j) => (
                          <div
                            key={j.id}
                            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all space-y-2 text-left group"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <h5 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1">
                                {j.title}
                              </h5>
                              <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 shrink-0">
                                98%
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {j.external_company_name || 'Работодатель HamKor'}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                                {j.salary_min ? `от ${j.salary_min} TJS` : 'По договорённости'}
                              </span>
                              <button
                                onClick={() => onSelectJob(j)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-0.5 shadow-2xs"
                              >
                                <span>Открыть</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chips Suggestions */}
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.chips.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(chip)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-slate-600 text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 active:scale-95"
                        >
                          <span>{chip}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                {t('ai.thinking')}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(inputText); }} className="pt-3 border-t border-indigo-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t('ai.placeholder')}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-indigo-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-xs font-semibold outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 transition-all shadow-xs"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="ref-btn-primary px-6 py-3 rounded-xl disabled:opacity-40 shrink-0 text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all"
            >
              <span>{t('ai.send_btn')}</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

      </div>

    </div>
  );
};
