import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Home } from './components/pages/Home';
import { JobsCatalog } from './components/pages/JobsCatalog';
import { ProfilePage } from './components/pages/ProfilePage';
import { ChatPage } from './components/pages/ChatPage';
import { AIConsultantPage } from './components/pages/AIConsultantPage';
import { EmployerDashboard } from './components/pages/EmployerDashboard';
import { MyJobsPage } from './components/pages/MyJobsPage';
import { ApplicationsPage } from './components/pages/ApplicationsPage';
import { CandidatesCatalog } from './components/candidates/CandidatesCatalog';
import { FavoritesPage } from './components/pages/FavoritesPage';
import { JobDetailModal } from './components/jobs/JobDetailModal';
import { CandidateDetailModal } from './components/candidates/CandidateDetailModal';
import { AuthModal } from './components/auth/AuthModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MutedScreen } from './components/auth/MutedScreen';
import { ResumeHubPage } from './components/resumes/ResumeHubPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FloatingAIButton } from './components/layout/FloatingAIButton';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { HamKorIntroLoader } from './components/layout/HamKorIntroLoader';
import { jobService, authService } from './services/api';
import { Job, Candidate } from './types';

const VALID_TABS = ['home', 'jobs', 'profile', 'resumes', 'chat', 'ai_consultant', 'employer', 'my_jobs', 'applications', 'favorites', 'admin'];


const getInitialTab = (): string => {
  try {
    const rawHash = window.location.hash.replace('#', '').trim();
    const hashClean = rawHash.split('/')[0].split('?')[0];
    if (hashClean && VALID_TABS.includes(hashClean)) {
      return hashClean;
    }
    const saved = localStorage.getItem('ergon_active_tab');
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Error reading initial tab:', e);
  }
  return 'home';
};

export const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      const seen = sessionStorage.getItem('hamkor_intro_shown');
      return !seen;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 4200);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [searchMode, setSearchMode] = useState<'job' | 'candidate'>('job');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [user, setUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('ergon_user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [aiInitialPrompt, setAiInitialPrompt] = useState('');
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('ergon_language') || 'RU';
  });
  const [chatRecipientId, setChatRecipientId] = useState<string | null>(() => {
    return localStorage.getItem('ergon_active_chat_recipient') || null;
  });
  const [selectedJobIdFilter, setSelectedJobIdFilter] = useState<string | null>(null);


  const changeActiveTab = (tab: string) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('ergon_active_tab', tab);
      if (window.location.hash !== `#${tab}`) {
        window.history.pushState(null, '', `#${tab}`);
      }
    } catch (e) {
      console.error('Error saving active tab:', e);
    }
  };

  const handleSelectJob = (job: Job | null) => {
    setSelectedJob(job);
    if (job) {
      localStorage.setItem('ergon_selected_job_id', job.id);
    } else {
      localStorage.removeItem('ergon_selected_job_id');
    }
  };

  const loadJobs = async () => {
    try {
      const data = await jobService.getJobs({ limit: 12, page: 1 });
      const loadedJobs = data.items || [];
      setJobs(loadedJobs);

      // Restore selected job if saved in localStorage
      const savedJobId = localStorage.getItem('ergon_selected_job_id');
      if (savedJobId && loadedJobs.length > 0) {
        const found = loadedJobs.find((j) => j.id === savedJobId);
        if (found) {
          setSelectedJob(found);
        }
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  };

  useEffect(() => {
    loadJobs();

    // 1. Instant User Restoration from LocalStorage (0ms flicker)
    const cachedUser = localStorage.getItem('ergon_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setUser(parsed);
        if (parsed.role === 'employer') {
          setSearchMode('candidate');
        }
      } catch (e) {
        console.error('Failed to parse cached user:', e);
      }
    }

    // 2. Validate user token in background without logging out on network blips
    authService.getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        if (u.role === 'employer') {
          setSearchMode('candidate');
        }
      }
    });

    const handleProfileUpdated = () => {
      authService.getCurrentUser().then((u) => setUser(u));
      loadJobs();
    };

    const handleHashChange = () => {
      const rawHash = window.location.hash.replace('#', '').trim();
      const hashClean = rawHash.split('/')[0].split('?')[0];
      if (hashClean && VALID_TABS.includes(hashClean)) {
        setActiveTab(hashClean);
        localStorage.setItem('ergon_active_tab', hashClean);
      }
    };

    window.addEventListener('ergon_profile_updated', handleProfileUpdated);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    // Initial hash setup
    const initialTab = getInitialTab();
    if (window.location.hash !== `#${initialTab}`) {
      window.history.replaceState(null, '', `#${initialTab}`);
    }

    return () => {
      window.removeEventListener('ergon_profile_updated', handleProfileUpdated);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const handleNavigateToJobs = (searchQuery?: string) => {
    if (searchQuery) {
      setInitialSearchQuery(searchQuery);
    }
    changeActiveTab('jobs');
  };

  const handleNavigateToAIConsultant = (initialQuery?: string) => {
    if (initialQuery) {
      setAiInitialPrompt(initialQuery);
    }
    changeActiveTab('ai_consultant');
  };

  const handleNavigateToChat = (recipientId?: string | null) => {
    if (recipientId) {
      setChatRecipientId(recipientId);
      localStorage.setItem('ergon_active_chat_recipient', recipientId);
    }
    changeActiveTab('chat');
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    localStorage.removeItem('ergon_active_chat_recipient');
    localStorage.removeItem('ergon_selected_job_id');
    changeActiveTab('home');
  };

  const isDashboardView = ['jobs', 'profile', 'resumes', 'chat', 'ai_consultant', 'employer', 'my_jobs', 'applications', 'favorites'].includes(activeTab);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#0f172a] text-[#0F172A] dark:text-slate-100 transition-colors duration-200">
      
      {/* If user is muted by admin, block site access with Muted Screen */}
      {user && user.is_muted && (
        <MutedScreen user={user} onLogout={handleLogout} />
      )}

      {/* Header containing Logo, Post Vacancy, Language Selector & Auth */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={changeActiveTab}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        currentLang={currentLang}
        onChangeLang={(lang) => setCurrentLang(lang)}
      />

      {/* Main Area */}
      <div className="flex-1 w-full pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {activeTab === 'admin' ? (
          <AdminDashboard user={user} onOpenAuth={() => setIsAuthOpen(true)} />
        ) : activeTab === 'home' ? (
          <Home
            jobs={jobs}
            onSelectJob={handleSelectJob}
            onNavigateToJobs={handleNavigateToJobs}
            onNavigateToAIConsultant={handleNavigateToAIConsultant}
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
            onNavigateToPostJob={() => changeActiveTab('employer')}
          />
        ) : isDashboardView ? (
          <DashboardLayout
            activeTab={activeTab}
            setActiveTab={changeActiveTab}
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
          >
            {activeTab === 'jobs' && (
              user?.role === 'employer' ? (
                <CandidatesCatalog
                  user={user}
                  onOpenAuth={() => setIsAuthOpen(true)}
                  onNavigateToPostJob={() => changeActiveTab('employer')}
                  onOpenChat={(chatId) => handleNavigateToChat(chatId)}
                />
              ) : (
                <JobsCatalog
                  jobs={jobs}
                  onSelectJob={handleSelectJob}
                  initialSearch={initialSearchQuery}
                />
              )
            )}

            {activeTab === 'favorites' && (
              <FavoritesPage
                user={user}
                onSelectJob={handleSelectJob}
                onSelectCandidate={(cand) => setSelectedCandidate(cand)}
                onNavigateToCatalog={() => changeActiveTab('jobs')}
                onNavigateToCandidates={() => changeActiveTab('jobs')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfilePage
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onLogout={handleLogout}
                jobs={jobs}
                onSelectJob={handleSelectJob}
                onNavigateToResumes={() => changeActiveTab('resumes')}
              />
            )}

            {activeTab === 'resumes' && (
              <ErrorBoundary fallbackMessage="Произошла ошибка в Конструкторе Резюме">
                <ResumeHubPage user={user} onOpenAuth={() => setIsAuthOpen(true)} />
              </ErrorBoundary>
            )}


            {activeTab === 'chat' && (
              <ChatPage
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                initialRecipientId={chatRecipientId}
              />
            )}

            {activeTab === 'ai_consultant' && (
              <AIConsultantPage
                jobs={jobs}
                onSelectJob={handleSelectJob}
                user={user}
                initialPrompt={aiInitialPrompt}
              />
            )}

            {activeTab === 'employer' && (
              <EmployerDashboard
                onJobCreated={() => {
                  loadJobs();
                  changeActiveTab('my_jobs');
                }}
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenChat={(chatId) => handleNavigateToChat(chatId)}
              />
            )}

            {activeTab === 'my_jobs' && (
              <MyJobsPage
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onNavigateToCreateJob={() => changeActiveTab('employer')}
                onViewCandidates={(jobId) => {
                  setSelectedJobIdFilter(jobId);
                  changeActiveTab('applications');
                }}
              />
            )}

            {activeTab === 'applications' && (
              <ApplicationsPage
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onSelectJob={handleSelectJob}
                onNavigateToChat={handleNavigateToChat}
                selectedJobIdFilter={selectedJobIdFilter}
              />
            )}
          </DashboardLayout>
        ) : null}
      </div>

      {/* Footer */}
      <Footer />

      {/* Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => handleSelectJob(null)}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Candidate Detail Modal */}
      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenChat={(chatId) => {
          setSelectedCandidate(null);
          handleNavigateToChat(chatId);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(loggedUser) => setUser(loggedUser)}
      />

      {/* Floating AI Button accessible on all pages */}
      <FloatingAIButton onNavigateToAIConsultant={handleNavigateToAIConsultant} />

      {/* Bottom Navigation for Mobile Devices */}
      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={changeActiveTab}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />

      {/* 3D Intro / Loading Screen */}
      {showIntro && (
        <HamKorIntroLoader
          onComplete={() => {
            try {
              sessionStorage.setItem('hamkor_intro_shown', 'true');
            } catch (e) {}
            setShowIntro(false);
          }}
        />
      )}

    </div>
  );
};


export default App;
