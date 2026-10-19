import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Building, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { authService } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { saveEmployerProfile } from '../../services/matchService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [role, setRole] = useState<'worker' | 'employer'>('worker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inn, setInn] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim();
    try {
      if (mode === 'login') {
        const res = await authService.login({ email: cleanEmail, password });
        let loggedUser = res.user;
        if (!loggedUser) {
          loggedUser = await authService.getCurrentUser();
        }
        if (!loggedUser) {
          loggedUser = { id: `usr-${Date.now()}`, email, username: email.split('@')[0], role };
        }
        localStorage.setItem('ergon_user', JSON.stringify(loggedUser));
        window.dispatchEvent(new Event('ergon_profile_updated'));
        if (loggedUser.role === 'admin') {
          window.location.hash = '#admin';
        }
        onSuccess(loggedUser);
        onClose();
      } else {
        const cleanUsername = username.trim() || email.split('@')[0];
        if (role === 'worker') {
          await authService.registerWorker({ email, username: cleanUsername, password });
        } else {
          const cleanInn = inn.trim();
          if (!companyName.trim() || !cleanInn || cleanInn.length !== 9) {
            setError('Для регистрации работодателя обязательно укажите полное название компании и 9-значный ИНН организации (например, 010023456).');
            setLoading(false);
            return;
          }
          await authService.registerEmployer({ email, username: cleanUsername, password, company_name: companyName.trim(), inn: cleanInn });
        }

        const pendingUserData = { 
          id: `usr-${Date.now()}`, 
          email, 
          username: cleanUsername, 
          role, 
          company_name: role === 'employer' ? companyName.trim() : undefined,
          is_email_verified: false
        };

        if (role === 'employer' && companyName.trim()) {
          saveEmployerProfile({
            company_name: companyName.trim(),
            industry: 'IT & Технологии',
            company_description: '',
            location: 'г. Душанбе',
            website: '',
            contact_email: email,
            contact_phone: '',
            target_position: '',
            required_skills: [],
            min_experience_years: '1-3 года'
          }, pendingUserData);
        }

        setPendingUser(pendingUserData);
        setStep('verify');
        setResendTimer(60);
      }
    } catch (err: any) {
      let serverDetail = err.response?.data?.detail;
      let targetEmail = email;
      if (typeof serverDetail === 'object' && serverDetail !== null) {
        if (serverDetail.email) {
          targetEmail = serverDetail.email;
        }
        serverDetail = serverDetail.message || JSON.stringify(serverDetail);
      }
      if (Array.isArray(serverDetail)) {
        serverDetail = serverDetail.map((d: any) => d.msg || d.detail).join('; ');
      }
      
      if (serverDetail === 'Invalid email or password' || serverDetail === 'Incorrect email or password' || serverDetail === 'Неверный email или пароль') {
        setError('Неверный email / имя пользователя или пароль.');
      } else if (err.response?.status === 403 || (typeof serverDetail === 'string' && (serverDetail.includes('не подтверждён') || serverDetail.includes('unverified')))) {
        setEmail(targetEmail);
        setPendingUser({ email: targetEmail, role });
        setStep('verify');
        setResendTimer(60);
        setError('Email не подтверждён. Новый код подтверждения отправлен на ваш email.');
      } else {
        setError(serverDetail || 'Ошибка проверки данных. Проверьте правильность заполнения полей.');
      }
    } finally {
      setLoading(false);
    }
  };

  const [resendTimer, setResendTimer] = useState(0);

  React.useEffect(() => {
    let timer: any;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setError('');
    try {
      await authService.resendVerification(email);
      setResendTimer(60);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Не удалось повторно отправить код.');
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const resData = await authService.verifyEmail(verificationCode, email);
      setVerificationSuccess(true);
      
      let loggedUser = resData?.user || pendingUser;
      if (!loggedUser) {
        loggedUser = await authService.getCurrentUser();
      }
      if (loggedUser) {
        loggedUser.is_email_verified = true;
        localStorage.setItem('ergon_user', JSON.stringify(loggedUser));
        window.dispatchEvent(new Event('ergon_profile_updated'));
      }

      setTimeout(() => {
        if (loggedUser) onSuccess(loggedUser);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный 6-значный код подтверждения.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipVerification = () => {
    if (pendingUser) {
      localStorage.setItem('ergon_user', JSON.stringify(pendingUser));
      window.dispatchEvent(new Event('ergon_profile_updated'));
      onSuccess(pendingUser);
    }
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 duration-200"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'verify' ? (
          <div className="text-center py-2 space-y-5 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-sm">
              <Mail className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {t('auth.verify_email_title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {t('auth.enter_code')} <br />
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{email}</span>
              </p>
            </div>

            {verificationSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Email {t('common.success')}!</span>
              </div>
            ) : (
              <form onSubmit={handleVerifyEmailCode} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth.enter_code')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center tracking-widest text-xl font-black py-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                  />
                  <div className="mt-2 flex items-center justify-end text-[11px]">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendTimer > 0}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold disabled:opacity-50 disabled:no-underline"
                    >
                      {resendTimer > 0 ? `${t('auth.resend_code')} (${resendTimer}s)` : t('auth.resend_code')}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? t('common.loading') : t('auth.verify_btn')}</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="text-center mb-6 flex flex-col items-center">
              <img 
                src="/logo-dark.png" 
                alt="HamKor Logo" 
                className="h-14 w-auto object-contain mb-3 dark:block hidden"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
              />
              <img 
                src="/logo-light.png" 
                alt="HamKor Logo" 
                className="h-14 w-auto object-contain mb-3 dark:hidden block"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
              />
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {mode === 'login' ? t('nav.login') : t('auth.register_tab')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {mode === 'login' ? 'Получите доступ к AI-инструментам и откликам' : 'Выберите вашу роль на платформе'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-6 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  mode === 'login' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {t('nav.login')}
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  mode === 'register' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Регистрация
              </button>
            </div>

            {/* Role Switcher if Register */}
            {mode === 'register' && (
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setRole('worker')}
                  className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    role === 'worker' 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black shadow-2xs' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <UserIcon className="w-5 h-5" />
                  <span className="text-xs">Соискатель</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('employer')}
                  className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    role === 'employer' 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black shadow-2xs' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Building className="w-5 h-5" />
                  <span className="text-xs">{t('nav.employer')}</span>
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Имя пользователя</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="alex_dev"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && role === 'employer' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                      Название компании <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Например: ЗАО Алиф Банк, ООО Осиё..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                        ИНН компании (9 цифр) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/60 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        Реестр РТ
                      </span>
                    </div>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-indigo-500 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required
                        maxLength={9}
                        value={inn}
                        onChange={(e) => setInn(e.target.value.replace(/\D/g, ''))}
                        placeholder="Пример: 010023456"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 tracking-wider"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      * Наш сервис сверяет ИНН и название организации с Единым налоговым реестром РТ.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  {mode === 'login' ? 'Email или Имя пользователя' : 'Электронная почта'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={mode === 'login' ? 'text' : 'email'}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={mode === 'login' ? 'Email или логин (например: superadmin, worker, admin@hamkor.tj)' : 'user@hamkor.tj'}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">Пароль</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Загрузка...' : mode === 'login' ? t('nav.login') : 'Зарегистрироваться'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
};
