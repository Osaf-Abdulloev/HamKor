import axios from 'axios';
import { Job, PaginatedResponse, SyncResponse, User } from '../types';

const API_BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to get stored auth token
export const getStoredToken = (): string => {
  return localStorage.getItem('ergon_token') || localStorage.getItem('ergon_access_token') || '';
};

// Add auth token if present in localStorage
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Automatic Token Refresh Queueing Interceptor
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/register')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('ergon_refresh_token');
      if (refreshToken) {
        try {
          const refreshResp = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          });

          if (refreshResp.data && refreshResp.data.access_token) {
            const newAccessToken = refreshResp.data.access_token;
            const newRefreshToken = refreshResp.data.refresh_token || refreshToken;

            localStorage.setItem('ergon_token', newAccessToken);
            localStorage.setItem('ergon_access_token', newAccessToken);
            localStorage.setItem('ergon_refresh_token', newRefreshToken);

            api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

            processQueue(null, newAccessToken);
            isRefreshing = false;

            return api(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          isRefreshing = false;

          localStorage.removeItem('ergon_token');
          localStorage.removeItem('ergon_access_token');
          localStorage.removeItem('ergon_refresh_token');
          localStorage.removeItem('ergon_user');
          window.dispatchEvent(new Event('ergon_profile_updated'));

          return Promise.reject(refreshErr);
        }
      }

      isRefreshing = false;
    }

    return Promise.reject(error);
  }
);

export const jobService = {
  getJobs: async (params?: {
    title?: string;
    search?: string;
    category?: string;
    location?: string;
    employment_type?: string;
    salary_min?: number;
    salary_max?: number;
    source?: string;
    sort_by_match?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Job>> => {
    const response = await api.get<PaginatedResponse<Job>>('/jobs', { params });
    return response.data;
  },

  getJobById: async (id: string): Promise<Job> => {
    const response = await api.get<Job>(`/jobs/${id}`);
    return response.data;
  },

  syncYoraJobs: async (maxPages?: number): Promise<SyncResponse> => {
    const response = await api.post<SyncResponse>('/jobs/sync/yora', null, {
      params: { max_pages: maxPages }
    });
    return response.data;
  },

  createJob: async (jobData: any): Promise<Job> => {
    const response = await api.post<Job>('/jobs', jobData);
    return response.data;
  },

  getMyJobs: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Job>> => {
    const response = await api.get<PaginatedResponse<Job>>('/jobs/my', { params });
    return response.data;
  },

  updateJob: async (id: string, jobData: any): Promise<Job> => {
    const response = await api.put<Job>(`/jobs/${id}`, jobData);
    return response.data;
  },

  deleteJob: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/jobs/${id}`);
    return response.data;
  },

  getJobCommute: async (jobId: string, originAddress?: string, transportMode = 'car') => {
    const response = await api.get(`/jobs/${jobId}/commute`, {
      params: { origin_address: originAddress, transport_mode: transportMode }
    });
    return response.data;
  },

  evaluateJobMatch: async (jobId: string) => {
    const response = await api.get(`/jobs/${jobId}/match`);
    return response.data;
  },

  saveJob: async (jobId: string) => {
    const response = await api.post(`/jobs/${jobId}/favorite`);
    return response.data;
  },

  unsaveJob: async (jobId: string) => {
    const response = await api.delete(`/jobs/${jobId}/favorite`);
    return response.data;
  }
};

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.access_token) {
      const token = response.data.access_token;
      localStorage.setItem('ergon_token', token);
      localStorage.setItem('ergon_access_token', token);
      if (response.data.refresh_token) {
        localStorage.setItem('ergon_refresh_token', response.data.refresh_token);
      }

      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      try {
        const userRes = await api.get('/users/me');
        if (userRes.data) {
          localStorage.setItem('ergon_user', JSON.stringify(userRes.data));
          window.dispatchEvent(new Event('ergon_profile_updated'));
          return { ...response.data, user: userRes.data };
        }
      } catch (e) {
        console.error('Error fetching current user after login:', e);
      }
    }
    return response.data;
  },

  registerWorker: async (data: any) => {
    const response = await api.post('/auth/register/worker', data);
    if (response.data.access_token) {
      const token = response.data.access_token;
      localStorage.setItem('ergon_token', token);
      localStorage.setItem('ergon_access_token', token);
      if (response.data.refresh_token) {
        localStorage.setItem('ergon_refresh_token', response.data.refresh_token);
      }
    }
    return response.data;
  },

  registerEmployer: async (data: any) => {
    const response = await api.post('/auth/register/employer', data);
    if (response.data.access_token) {
      const token = response.data.access_token;
      localStorage.setItem('ergon_token', token);
      localStorage.setItem('ergon_access_token', token);
      if (response.data.refresh_token) {
        localStorage.setItem('ergon_refresh_token', response.data.refresh_token);
      }
    }
    return response.data;
  },

  verifyEmail: async (code: string, email?: string) => {
    const response = await api.post('/auth/verify-email', { code, token: code, email });
    if (response.data.access_token) {
      const token = response.data.access_token;
      localStorage.setItem('ergon_token', token);
      localStorage.setItem('ergon_access_token', token);
      if (response.data.refresh_token) {
        localStorage.setItem('ergon_refresh_token', response.data.refresh_token);
      }
      try {
        const userRes = await api.get('/users/me');
        if (userRes.data) {
          localStorage.setItem('ergon_user', JSON.stringify(userRes.data));
          window.dispatchEvent(new Event('ergon_profile_updated'));
          return { ...response.data, user: userRes.data };
        }
      } catch (e) {}
    }
    return response.data;
  },

  resendVerification: async (email?: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },


  getCurrentUser: async () => {
    const token = getStoredToken();

    // If no token, return cached user if exists
    if (!token) {
      const cachedUser = localStorage.getItem('ergon_user');
      return cachedUser ? JSON.parse(cachedUser) : null;
    }

    try {
      const response = await api.get('/users/me');
      if (response.data) {
        localStorage.setItem('ergon_user', JSON.stringify(response.data));
        return response.data;
      }
    } catch (e: any) {
      // ONLY clear tokens if server explicitly returned 401 Unauthorized AND refresh token is invalid
      if (e.response && e.response.status === 401 && !localStorage.getItem('ergon_refresh_token')) {
        localStorage.removeItem('ergon_token');
        localStorage.removeItem('ergon_access_token');
        localStorage.removeItem('ergon_refresh_token');
        localStorage.removeItem('ergon_user');
        window.dispatchEvent(new Event('ergon_profile_updated'));
        return null;
      }
      // On network timeout or temporary server restart, maintain cached session!
      const cachedUser = localStorage.getItem('ergon_user');
      if (cachedUser) {
        try {
          return JSON.parse(cachedUser);
        } catch (parseErr) {
          return null;
        }
      }
    }
    return null;
  },

  getSidebarProfile: async () => {
    try {
      const response = await api.get('/users/me/sidebar-profile');
      return response.data;
    } catch (e) {
      return null;
    }
  },


  logout: () => {
    const refreshToken = localStorage.getItem('ergon_refresh_token');
    if (refreshToken) {
      api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {});
    }
    localStorage.removeItem('ergon_token');
    localStorage.removeItem('ergon_access_token');
    localStorage.removeItem('ergon_refresh_token');
    localStorage.removeItem('ergon_user');
    window.dispatchEvent(new Event('ergon_profile_updated'));
  }
};

export const applicationService = {
  checkApplicationStatus: async (jobId: string) => {
    const response = await api.get(`/applications/check/${jobId}`);
    return response.data;
  },

  applyToJob: async (data: { job_id: string; cover_note?: string; resume_id?: string }) => {
    const response = await api.post('/applications', data);
    return response.data;
  },


  getMyApplications: async () => {
    const response = await api.get('/applications/my');
    return response.data;
  },

  cancelApplication: async (applicationId: string) => {
    const response = await api.post(`/applications/${applicationId}/cancel`);
    return response.data;
  },

  updateCoverNote: async (applicationId: string, coverNote: string) => {
    const response = await api.patch(`/applications/${applicationId}/cover-note`, { cover_note: coverNote });
    return response.data;
  },

  getJobApplications: async (jobId: string, statusFilter?: string) => {
    const params = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};
    const response = await api.get(`/jobs/${jobId}/applications`, { params });
    return response.data;
  },

  getEmployerApplications: async (statusFilter?: string, jobId?: string) => {
    const params: any = {};
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter.toLowerCase();
    if (jobId) params.job_id = jobId;
    const response = await api.get('/applications/employer', { params });
    return response.data;
  },

  updateStatus: async (applicationId: string, status: string, employerFeedback?: string) => {
    const response = await api.patch(`/applications/${applicationId}/status`, {
      status: status.toLowerCase(),
      employer_feedback: employerFeedback
    });
    return response.data;
  },

  contactCandidate: async (applicationId: string) => {
    const response = await api.post(`/applications/${applicationId}/contact`);
    return response.data;
  },

  sendApplicationEmail: async (applicationId: string, data: { subject: string; message: string }) => {
    const response = await api.post(`/applications/${applicationId}/send-email`, data);
    return response.data;
  },

  getApplicationMessages: async (applicationId: string) => {
    const response = await api.get(`/applications/${applicationId}/messages`);
    return response.data;
  }
};

export const aiService = {
  generateCV: async (data: { prompt: string; user_details?: any }) => {
    const response = await api.post('/ai/generate-cv', data);
    return response.data;
  },
  
  askCareerConsultant: async (message: string, history?: any[], userProfile?: any, sessionId?: string) => {
    const response = await api.post('/ai/chat', { 
      prompt: message, 
      message, 
      history, 
      user_profile: userProfile,
      session_id: sessionId 
    });
    return response.data;
  },

  createSession: async (title?: string) => {
    const response = await api.post('/ai/sessions', null, { params: { title } });
    return response.data;
  },

  getSessions: async () => {
    const response = await api.get('/ai/sessions');
    return response.data;
  },

  getSessionDetail: async (sessionId: string) => {
    const response = await api.get(`/ai/sessions/${sessionId}`);
    return response.data;
  },

  deleteSession: async (sessionId: string) => {
    const response = await api.delete(`/ai/sessions/${sessionId}`);
    return response.data;
  }
};

export const candidateService = {
  getCandidates: async (params?: {
    name?: string;
    skill?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> => {
    const response = await api.get<PaginatedResponse<any>>('/users/workers', { params });
    return response.data;
  },

  getCandidateProfile: async (userId: string): Promise<any> => {
    const response = await api.get(`/users/workers/${userId}`);
    return response.data;
  },

  getFullCandidateProfile: async (userId: string): Promise<{ profile: any; published_resumes: any[] }> => {
    const response = await api.get(`/users/candidate/${userId}/full`);
    return response.data;
  },

  syncYoraCandidates: async (): Promise<any> => {
    const response = await api.post('/users/candidates/sync-yora');
    return response.data;
  },

  sendCandidateEmail: async (data: {
    candidate_user_id?: string;
    recipient_email?: string;
    subject: string;
    message: string;
  }): Promise<{ status: string; message: string }> => {
    const response = await api.post<{ status: string; message: string }>('/users/candidates/send-email', data);
    return response.data;
  }
};

export const favoriteService = {
  addFavorite: async (targetType: 'job' | 'worker' | 'company', targetId: string) => {
    const response = await api.post('/favorites', { target_type: targetType, target_id: targetId });
    return response.data;
  },
  getFavorites: async (targetType?: 'job' | 'worker' | 'company') => {
    const response = await api.get('/favorites', { params: { target_type: targetType } });
    return response.data;
  },
  removeFavorite: async (targetType: 'job' | 'worker' | 'company', targetId: string) => {
    const response = await api.delete(`/favorites/${targetType}/${targetId}`);
    return response.data;
  }
};

export const profileService = {
  getWorkerProfile: async () => {
    const response = await api.get('/users/me/worker-profile');
    return response.data;
  },

  updateWorkerProfile: async (data: any) => {
    const response = await api.put('/users/me/worker-profile', data);
    return response.data;
  },

  addExperience: async (data: { company_name: string; role_title: string; start_date: string; end_date?: string; description?: string }) => {
    const response = await api.post('/users/me/experience', data);
    return response.data;
  },

  deleteExperience: async (expId: string) => {
    const response = await api.delete(`/users/me/experience/${expId}`);
    return response.data;
  },

  addCertificate: async (data: { title: string; issuer: string; year?: string; credential_url?: string }) => {
    const response = await api.post('/users/me/certificates', data);
    return response.data;
  },

  deleteCertificate: async (certId: string) => {
    const response = await api.delete(`/users/me/certificates/${certId}`);
    return response.data;
  },

  getCompanyProfile: async () => {
    const response = await api.get('/users/me/company-profile');
    return response.data;
  },

  updateCompanyProfile: async (data: any) => {
    const response = await api.put('/users/me/company-profile', data);
    return response.data;
  },

  uploadCompanyLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/me/company-profile/logo', formData);
    return response.data;
  },

  deleteCompanyLogo: async () => {
    const response = await api.delete('/users/me/company-profile/logo');
    return response.data;
  },

  updateUser: async (data: any) => {
    const response = await api.put('/users/me', data);
    return response.data;
  }
};

export const adminService = {
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  getUsers: async (params?: any) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getJobs: async (params?: any) => {
    const response = await api.get('/admin/jobs', { params });
    return response.data;
  },

  toggleMuteUser: async (userId: string, isMuted: boolean) => {
    const response = await api.post(`/admin/users/${userId}/mute`, { is_muted: isMuted });
    return response.data;
  },

  muteUser: async (userId: string, data?: any) => {
    const response = await api.post(`/admin/users/${userId}/mute`, { is_muted: true, ...data });
    return response.data;
  },

  unmuteUser: async (userId: string) => {
    const response = await api.post(`/admin/users/${userId}/mute`, { is_muted: false });
    return response.data;
  },

  updateUserRole: async (userId: string, role: string) => {
    const response = await api.patch(`/admin/users/${userId}/role`, { role });
    return response.data;
  },

  syncTelegram: async (maxPages?: number) => {
    const response = await api.post('/jobs/sync/telegram', null, { params: { max_pages: maxPages } });
    return response.data;
  },

  syncYora: async (maxPages?: number) => {
    const response = await api.post('/jobs/sync/yora', null, { params: { max_pages: maxPages } });
    return response.data;
  },

  deleteUser: async (userId: string) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  deleteJob: async (jobId: string) => {
    const response = await api.delete(`/admin/jobs/${jobId}`);
    return response.data;
  }
};

export const notificationService = {
  getNotifications: async (limit: number = 30) => {
    const response = await api.get('/notifications', { params: { limit } });
    return response.data;
  },

  markRead: async (notificationId: string) => {
    const response = await api.post(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.post('/notifications/read-all');
    return response.data;
  }
};

export const telegramService = {
  getTelegramStatus: async () => {
    const response = await api.get('/profile/telegram');
    return response.data;
  },

  getTelegramLink: async (data?: { telegram_username?: string }) => {
    const response = await api.post('/profile/telegram/connect', data || {});
    return response.data;
  },

  connectTelegram: async (data: { telegram_chat_id?: string; telegram_username?: string }) => {
    const response = await api.post('/profile/telegram/connect', data);
    return response.data;
  },

  unlinkTelegram: async () => {
    const response = await api.post('/profile/telegram/disconnect');
    return response.data;
  },

  updateTelegramSettings: async (settings: {
    telegram_notifications_enabled?: boolean;
    telegram_job_recommendations_enabled?: boolean;
    telegram_messages_enabled?: boolean;
    telegram_system_notifications_enabled?: boolean;
    telegram_promotional_enabled?: boolean;
    telegram_username?: string;
  }) => {
    const response = await api.patch('/profile/telegram/settings', settings);
    return response.data;
  }
};

export const cvService = {
  uploadCv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/cv/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getCvs: async () => {
    const response = await api.get('/cv');
    return response.data;
  },

  getCvStatus: async (cvId: string) => {
    const response = await api.get(`/cv/${cvId}/status`);
    return response.data;
  },

  getCvSuggestions: async (cvId: string) => {
    const response = await api.get(`/cv/${cvId}/suggestions`);
    return response.data;
  },

  confirmSuggestions: async (suggestionId: string, acceptedFields: string[], customOverrides?: Record<string, any>) => {
    const response = await api.post(`/cv/suggestions/${suggestionId}/confirm`, {
      accepted_fields: acceptedFields,
      custom_overrides: customOverrides
    });
    return response.data;
  },

  rejectSuggestions: async (suggestionId: string) => {
    const response = await api.post(`/cv/suggestions/${suggestionId}/reject`);
    return response.data;
  }
};

export const resumeService = {
  getResumes: async (status?: string) => {
    const response = await api.get('/resumes', { params: { status } });
    return response.data;
  },

  getResume: async (id: string) => {
    const response = await api.get(`/resumes/${id}`);
    return response.data;
  },

  createResume: async (data: { title?: string; target_position?: string; content?: any }) => {
    const response = await api.post('/resumes', data);
    return response.data;
  },

  updateResume: async (id: string, data: { title?: string; target_position?: string; content?: any; status?: string }) => {
    const response = await api.put(`/resumes/${id}`, data);
    return response.data;
  },

  publishResume: async (id: string) => {
    const response = await api.post(`/resumes/${id}/publish`);
    return response.data;
  },

  duplicateResume: async (id: string) => {
    const response = await api.post(`/resumes/${id}/duplicate`);
    return response.data;
  },

  setDefaultResume: async (id: string) => {
    const response = await api.post(`/resumes/${id}/set-default`);
    return response.data;
  },

  deleteResume: async (id: string) => {
    const response = await api.delete(`/resumes/${id}`);
    return response.data;
  }
};

export const fileService = {
  uploadFile: async (file: File, folder: string = 'general'): Promise<{ id: string; url: string; file_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const response = await api.post<{ id: string; url: string; file_url: string }>('/files/upload', formData);
    return response.data;
  },

  uploadAvatar: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/me/avatar', formData);
    if (response.data) {
      const storedUser = localStorage.getItem('ergon_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const merged = { ...parsed, ...response.data };
          localStorage.setItem('ergon_user', JSON.stringify(merged));
          window.dispatchEvent(new Event('ergon_user_updated'));
          window.dispatchEvent(new Event('ergon_profile_updated'));
        } catch (e) {}
      }
    }
    return response.data;
  }
};


