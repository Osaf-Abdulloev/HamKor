import React, { useState, useEffect } from 'react';
import { X, Mail, MessageSquare, Send, CheckCircle2, AlertCircle, Phone, Lock, ExternalLink, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import { Candidate } from '../../types';
import { candidateService, applicationService, api } from '../../services/api';
import { chatService } from '../../services/chatService';
import { useLanguage } from '../../i18n/LanguageContext';

interface ContactCandidateModalProps {
  candidate: Candidate | null;
  applicationId?: string | null;
  jobTitle?: string | null;
  onClose: () => void;
  user?: any;
  onOpenAuth?: () => void;
  onOpenChat?: (chatId: string) => void;
}

export const ContactCandidateModal: React.FC<ContactCandidateModalProps> = ({
  candidate,
  applicationId,
  jobTitle,
  onClose,
  user,
  onOpenAuth,
  onOpenChat
}) => {
  const { t } = useLanguage();
  if (!candidate) return null;

  const isExternal = candidate.is_external || !candidate.user_id;
  const u: any = candidate.user || {};
  const candidateName = candidate.full_name || u.full_name || u.username || 'Соискатель';
  const position = jobTitle || candidate.desired_position || 'Специалист';
  const phone = candidate.contact_phone || u.phone || '';

  const [activeTab, setActiveTab] = useState<'chat' | 'email'>(isExternal ? 'chat' : 'email');
  
  // Chat state
  const [chatMessage, setChatMessage] = useState(`Здравствуйте, ${candidateName}! Просмотрели ваше резюме на HamKor и хотим пригласить вас на обсуждение вакансии "${position}".`);
  const [startingChat, setStartingChat] = useState(false);
  const [chatSuccess, setChatSuccess] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Email state
  const [subject, setSubject] = useState(jobTitle ? `Сообщение по вашему отклику на вакансию «${jobTitle}»` : `Приглашение на собеседование — ${position}`);
  const [emailMessage, setEmailMessage] = useState(
    `Здравствуйте, ${candidateName}!\n\nПросмотрели ваш отклик на платформе HamKor. Ваш опыт работы и навыки подходят для нашей вакансии "${position}".\n\nПредлагаем обсудить детали и назначить удобное время для собеседования.\n\nС уважением,\nКоманда рекрутинга`
  );
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (candidate) {
      setSubject(jobTitle ? `Сообщение по вашему отклику на вакансию «${jobTitle}»` : `Приглашение на собеседование — ${position}`);
      setEmailMessage(`Здравствуйте, ${candidateName}!\n\nПросмотрели ваш отклик на платформе HamKor. Ваш опыт работы и навыки подходят для нашей вакансии "${position}".\n\nПредлагаем обсудить детали и назначить удобное время для собеседования.\n\nС уважением,\nКоманда рекрутинга`);
      setChatMessage(`Здравствуйте, ${candidateName}! Просмотрели ваше резюме на HamKor и хотим пригласить вас на обсуждение вакансии "${position}".`);
      setActiveTab(isExternal ? 'chat' : 'email');
      setEmailSuccess(null);
      setEmailError(null);
      setChatSuccess(null);
      setChatError(null);
    }
  }, [candidate, applicationId, jobTitle]);

  const handleStartChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (candidate.user_id) {
      setStartingChat(true);
      setChatError(null);
      try {
        const chatRoom = await chatService.getOrCreateChat(candidate.user_id);
        if (chatRoom && chatRoom.id && chatMessage.trim()) {
          await chatService.sendMessageHttp(chatRoom.id, 'text', chatMessage.trim());
        }
        onClose();
        if (onOpenChat) {
          onOpenChat(candidate.user_id);
        }
      } catch (err: any) {
        console.error('Error starting chat:', err);
        setChatError('Не удалось создать чат. Попробуйте снова.');
      } finally {
        setStartingChat(false);
      }
    } else {
      setChatError('Кандидат импортирован из внешнего источника. Используйте прямой телефон или контакты источника.');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (isExternal) {
      setEmailError('Прямая отправка email недоступна для сторонних соискателей.');
      return;
    }

    if (!subject.trim() || !emailMessage.trim()) {
      setEmailError('Заполните тему и текст сообщения.');
      return;
    }

    setSendingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      let res: any;
      if (applicationId) {
        res = await applicationService.sendApplicationEmail(applicationId, {
          subject: subject.trim(),
          message: emailMessage.trim()
        });
      } else {
        res = await candidateService.sendCandidateEmail({
          candidate_user_id: candidate.user_id,
          subject: subject.trim(),
          message: emailMessage.trim()
        });
      }

      setEmailSuccess(res.message || 'Сообщение успешно отправлено кандидату на email!');
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      console.error('Error sending email:', err);
      setEmailError(err?.response?.data?.detail || 'Ошибка отправки email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 dark:border-slate-700 relative space-y-6 animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-md">
            {candidateName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{candidateName}</h3>
              {!isExternal ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <UserCheck className="w-3 h-3" /> Зарегистрирован
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  Парсинг yora.tj
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              Желаемая должность: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{position}</span>
            </p>
          </div>
        </div>

        {/* External Candidate Informational Warning */}
        {isExternal && (
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-950 dark:text-amber-200">Кандидат импортирован из внешнего источника</p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  Этот соискатель был автоматически импортирован с внешнего ресурса (yora.tj). Прямая отправка email через платформу недоступна, так как его почта не верифицирована в нашей системе.
                </p>
              </div>
            </div>

            {phone && (
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Phone className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span className="font-bold">Публичный контакт: {phone}</span>
              </div>
            )}
          </div>
        )}

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            disabled={isExternal}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'email'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : isExternal
                ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Отправить Email</span>
            {isExternal && <Lock className="w-3 h-3 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Внутренний Чат</span>
          </button>
        </div>

        {/* TAB 1: EMAIL (REGISTERED USERS ONLY) */}
        {activeTab === 'email' && !isExternal && (
          <form onSubmit={handleSendEmail} className="space-y-4 animate-fade-in">
            {emailSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{emailSuccess}</span>
              </div>
            )}

            {emailError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Получатель (Email соискателя)</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Сохраненный адрес в профиле ({u.email || candidate.contact_email || 'Верифицированный адрес'})
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Тема сообщения</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Тема письма..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Текст сообщения</label>
              <textarea
                required
                rows={5}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Напишите сообщение..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={sendingEmail || !!emailSuccess}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <Send className={`w-4 h-4 ${sendingEmail ? 'animate-bounce' : ''}`} />
                <span>{sendingEmail ? 'Отправка...' : 'Отправить Email'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: INTERNAL CHAT */}
        {(activeTab === 'chat' || isExternal) && (
          <form onSubmit={handleStartChat} className="space-y-4 animate-fade-in">
            {chatSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{chatSuccess}</span>
              </div>
            )}

            {chatError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{chatError}</span>
              </div>
            )}

            {!isExternal ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Первое сообщение в чате</label>
                <textarea
                  required
                  rows={4}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Приветственное сообщение..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100 leading-relaxed"
                />
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  Для связи с данным внешним кандидатом используйте напрямую публичный номер телефона или ознакомьтесь с оригиналом на портале.
                </p>
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Позвонить: {phone}</span>
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
              >
                Закрыть
              </button>

              {!isExternal && (
                <button
                  type="submit"
                  disabled={startingChat || !!chatSuccess}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{startingChat ? 'Создание чата...' : 'Открыть Чат'}</span>
                </button>
              )}
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
