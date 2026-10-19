export type UserRole = 'worker' | 'employer' | 'admin';
export type EmploymentType = 'full_time' | 'part_time' | 'remote' | 'contract' | 'internship';
export type JobStatus = 'draft' | 'open' | 'closed';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  city?: string;
}

export interface Job {
  id: string;
  company_id?: string;
  title: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  currency: string;
  location: string;
  category?: string;
  employment_type: EmploymentType;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  is_external?: boolean;
  external_source?: string;
  external_id?: string;
  external_url?: string;
  external_company_name?: string;
  external_company_logo?: string;
  published_at?: string;
  requirements?: any;
  match_score?: number;
  commute_estimate?: string;
  distance_estimate?: string;
  matched_reasons?: string[];
  matched_skills?: string[];
  has_applied?: boolean;
  is_saved?: boolean;
  is_favorite?: boolean;
}


export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SyncStats {
  total_fetched: number;
  created: number;
  updated: number;
  errors: number;
}

export interface SyncResponse {
  status: string;
  source: string;
  stats: SyncStats;
}

export interface Skill {
  id: string;
  name: string;
}

export interface Experience {
  id: string;
  company_name: string;
  role_title: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

export interface Candidate {
  id: string;
  user_id?: string;
  desired_position?: string;
  desired_salary?: number;
  bio?: string;
  education?: string;
  portfolio_links?: any;
  skills: { id?: string; name: string }[];
  experiences: Experience[];
  user?: User;
  full_name?: string;
  city?: string;
  is_external?: boolean;
  external_source?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface CandidateSearchParams {
  name?: string;
  skill?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  target_type: 'job' | 'worker' | 'company';
  target_id: string;
  created_at: string;
  target_details?: any;
}

