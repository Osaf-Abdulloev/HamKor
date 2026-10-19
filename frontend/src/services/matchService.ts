import { Job, Candidate } from '../types';

export const DEFAULT_USER_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%234f46e5'/><stop offset='50%' stop-color='%237c3aed'/><stop offset='100%' stop-color='%232563eb'/></linearGradient><linearGradient id='sh' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='%23ffffff' stop-opacity='0.25'/><stop offset='100%' stop-color='%23000000' stop-opacity='0.15'/></linearGradient></defs><rect width='120' height='120' rx='60' fill='url(%23bg)'/><circle cx='60' cy='46' r='20' fill='%23ffffff'/><path d='M26 100 C26 78 41 68 60 68 C79 68 94 78 94 100 Z' fill='%23ffffff'/><circle cx='60' cy='60' r='58' fill='none' stroke='url(%23sh)' stroke-width='4'/></svg>";

export interface UserProfileData {
  full_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  location: string;
  position: string;
  bio: string;
  education?: string;
  expected_salary: string;
  relocation: 'not_ready' | 'ready_city' | 'ready_country' | 'ready_abroad';
  commute_time: 'up_to_15' | 'up_to_30' | 'up_to_60' | 'any';
  work_format: 'full_time' | 'remote' | 'hybrid' | 'shift' | 'part_time';
  has_driving_license: boolean;
  driving_categories: string[];
  has_own_car: boolean;
  no_driving_license: boolean;
  github_url: string;
  portfolio_url: string;
  linkedin_url: string;
  telegram_url: string;
  no_github: boolean;
  certificates: any[];
  experiences: any[];
  skills: string[];
  no_certificates: boolean;
}

export interface EmployerProfileData {
  company_name: string;
  inn?: string;
  industry: string;
  company_description: string;
  location: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  target_position: string;
  required_skills: string[];
  min_experience_years: string;
  offered_salary_min?: number;
  offered_salary_max?: number;
  avatar_url?: string;
  logo_url?: string;
  address?: string;
  employee_count?: string;
}

export interface ProfileMatchScoreBreakdown {
  positionScore: number;
  skillScore: number;
  salaryScore: number;
  locationScore: number;
  completenessScore: number;
}

export interface ProfileMatchEvaluation {
  matchScore: number;
  scoreBreakdown: ProfileMatchScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  matchedReasons: string[];
  growthAdvice: string[];
  commuteEstimate: string;
  distanceEstimate: string;
}

export const sanitizeUserProfile = (profile: any): UserProfileData => {
  if (!profile || typeof profile !== 'object') {
    return {
      full_name: '',
      email: '',
      phone: '',
      location: 'г. Душанбе',
      position: 'Менеджер по закупкам',
      bio: '',
      education: '',
      expected_salary: '8000 TJS',
      relocation: 'not_ready',
      commute_time: 'any',
      work_format: 'full_time',
      has_driving_license: false,
      driving_categories: [],
      has_own_car: false,
      no_driving_license: false,
      github_url: '',
      portfolio_url: '',
      linkedin_url: '',
      telegram_url: '',
      no_github: false,
      certificates: [],
      experiences: [],
      skills: [],
      no_certificates: false,
      avatar_url: ''
    };
  }

  const rawSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const cleanSkills = rawSkills.map((s: any) => {
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object' && s.name) return String(s.name);
    return String(s || '');
  }).filter(Boolean);

  return {
    ...profile,
    skills: cleanSkills,
    certificates: Array.isArray(profile.certificates) ? profile.certificates : [],
    experiences: Array.isArray(profile.experiences) ? profile.experiences : [],
    driving_categories: Array.isArray(profile.driving_categories) ? profile.driving_categories : []
  };
};

export const getSavedUserProfile = (user?: any): UserProfileData | null => {
  if (!user || !user.id) return null;
  try {
    const keysToTry: string[] = [
      `ergon_user_profile_${user.id}`,
      `ergon_user_profile_uname_${user.username}`,
      `ergon_user_profile_email_${user.email ? user.email.toLowerCase() : ''}`
    ];

    for (const key of keysToTry) {
      if (!key) continue;
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object') return sanitizeUserProfile(parsed);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('Failed to load candidate profile:', e);
  }

  return null;
};

export const saveUserProfile = (data: UserProfileData, user?: any): void => {
  if (!user || !user.id) return;
  try {
    const keysToSave: string[] = [
      `ergon_user_profile_${user.id}`,
      `ergon_user_profile_uname_${user.username}`,
      `ergon_user_profile_email_${user.email ? user.email.toLowerCase() : ''}`
    ];

    keysToSave.forEach((key) => {
      if (key) localStorage.setItem(key, JSON.stringify(data));
    });

    window.dispatchEvent(new Event('ergon_profile_updated'));
  } catch (e) {
    console.error('Failed to save candidate profile:', e);
  }
};

export const getSavedEmployerProfile = (user?: any): EmployerProfileData | null => {
  if (!user || !user.id) return null;
  try {
    const keysToTry: string[] = [
      `ergon_employer_profile_${user.id}`,
      `ergon_employer_profile_uname_${user.username}`,
      `ergon_employer_profile_email_${user.email ? user.email.toLowerCase() : ''}`
    ];

    for (const key of keysToTry) {
      if (!key) continue;
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('Failed to load employer profile:', e);
  }

  return null;
};

export const saveEmployerProfile = (data: EmployerProfileData, user?: any): void => {
  if (!user || !user.id) return;
  try {
    const keysToSave: string[] = [
      `ergon_employer_profile_${user.id}`,
      `ergon_employer_profile_uname_${user.username}`,
      `ergon_employer_profile_email_${user.email ? user.email.toLowerCase() : ''}`
    ];

    keysToSave.forEach((key) => {
      if (key) localStorage.setItem(key, JSON.stringify(data));
    });

    window.dispatchEvent(new Event('ergon_profile_updated'));
  } catch (e) {
    console.error('Failed to save employer profile:', e);
  }
};

const SKILL_DICTIONARY: Record<string, string[]> = {
  it: ['React', 'JavaScript', 'TypeScript', 'Python', 'FastAPI', 'Node.js', 'PostgreSQL', 'Docker', 'Git', 'HTML/CSS', 'Tailwind', 'REST API', 'Figma'],
  procurement: ['Закупки', 'Переговоры', 'Снабжение', 'Тендеры', 'ВЭД', 'Логистика', 'Поставщики', '1С: Склад', 'Договоры', 'Экспорт/Импорт'],
  hr: ['Подбор персонала', 'Рекрутинг', 'Кадровое делопроизводство', 'Адаптация', 'Обучение', 'KPI', 'Проведение собеседований'],
  finance: ['Бухгалтерский учет', '1С: Бухгалтерия', 'Налоги', 'Финансовый анализ', 'Аудит', 'Отчетность', 'Excel (VLOOKUP, Pivot)'],
  sales: ['B2B Продажи', 'Переговоры', 'Холодные звонки', 'CRM', 'Работа с клиентами', 'Презентации', 'Выполнение плана продаж'],
  legal: ['Юриспруденция', 'Договорное право', 'Претензионная работа', 'Консультирование', 'Составление исков', 'Корпоративное право']
};

const evalCache = new Map<string, ProfileMatchEvaluation>();

export const evaluateProfileJobMatch = (
  job: Job,
  profileOverride?: UserProfileData | null
): ProfileMatchEvaluation => {
  const profile = profileOverride !== undefined ? profileOverride : getSavedUserProfile();

  const defaultBreakdown: ProfileMatchScoreBreakdown = {
    positionScore: 20,
    skillScore: 25,
    salaryScore: 10,
    locationScore: 15,
    completenessScore: 5
  };

  if (!job || !job.id) {
    return {
      matchScore: 75,
      scoreBreakdown: defaultBreakdown,
      matchedSkills: [],
      missingSkills: [],
      matchedReasons: ['Базовое соответствие требованиям'],
      growthAdvice: ['Заполните профиль для расчета 100% точного совпадения'],
      commuteEstimate: '~15-20 мин',
      distanceEstimate: '~4 км от центра'
    };
  }

  const profSig = profile ? `${profile.position || ''}_${(profile.skills || []).join(',')}_${profile.location || ''}` : 'none';
  const cacheKey = `${job.id}_${profSig}`;
  if (evalCache.has(cacheKey)) {
    return evalCache.get(cacheKey)!;
  }

  if (!profile) {
    const defaultRes: ProfileMatchEvaluation = {
      matchScore: 75,
      scoreBreakdown: defaultBreakdown,
      matchedSkills: [],
      missingSkills: [],
      matchedReasons: ['Базовое соответствие требованиям'],
      growthAdvice: ['Заполните профиль для расчета 100% точного совпадения'],
      commuteEstimate: '~15-20 мин',
      distanceEstimate: '~4 км от центра'
    };
    evalCache.set(cacheKey, defaultRes);
    return defaultRes;
  }

  const userPos = (profile.position || '').toLowerCase().trim();
  const userBio = (profile.bio || '').toLowerCase().trim();
  const userLoc = (profile.location || 'Душанбе').toLowerCase().replace('г.', '').replace('п.', '').trim();
  const userSkills = (profile.skills || []).map((s) => s.toLowerCase().trim());
  const expectedSal = profile.expected_salary ? parseFloat(profile.expected_salary) : 0;

  const jTitle = job.title.toLowerCase();
  const jDesc = (job.description || '').toLowerCase();
  const jLoc = (job.location || '').toLowerCase();

  let positionScore = 10;
  let skillScore = 10;
  let salaryScore = 10;
  let locationScore = 10;
  let completenessScore = 0;

  const matchedReasons: string[] = [];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const growthAdvice: string[] = [];

  if (userPos && (jTitle.includes(userPos) || userPos.includes(jTitle))) {
    positionScore = 30;
    matchedReasons.push(`Должность: "${profile.position}"`);
  } else if (
    (userPos.includes('закуп') || userBio.includes('закуп') || userSkills.some((s) => s.includes('закуп'))) &&
    (jTitle.includes('закуп') || jDesc.includes('закуп') || jTitle.includes('снабжен'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: Закупки и снабжение');
  } else if (
    (userPos.includes('hr') || userPos.includes('кадр') || userPos.includes('персонал')) &&
    (jTitle.includes('hr') || jDesc.includes('персонал') || jTitle.includes('рекрутер'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: Управление персоналом (HR)');
  } else if (
    (userPos.includes('разработ') || userPos.includes('dev') || userPos.includes('программ')) &&
    (jTitle.includes('разработ') || jDesc.includes('dev') || jTitle.includes('frontend') || jTitle.includes('backend'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: IT & Разработка ПО');
  } else if (
    (userPos.includes('бухгалтер') || userPos.includes('учет')) &&
    (jTitle.includes('бухгалтер') || jDesc.includes('бухгалтерия') || jTitle.includes('1с'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: Бухгалтерия и учет');
  } else if (
    (userPos.includes('юрист') || userPos.includes('право')) &&
    (jTitle.includes('юрист') || jDesc.includes('право'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: Юриспруденция');
  } else {
    positionScore = 15;
    matchedReasons.push('Частичное совпадение сферы работы');
  }

  for (const skill of profile.skills || []) {
    const sLower = skill.toLowerCase().trim();
    if (sLower && (jTitle.includes(sLower) || jDesc.includes(sLower))) {
      skillScore += 8;
      matchedSkills.push(skill);
    }
  }
  skillScore = Math.min(35, Math.max(10, skillScore));

  if (matchedSkills.length > 0) {
    matchedReasons.push(`Совпали навыки (${matchedSkills.length}): ${matchedSkills.slice(0, 3).join(', ')}`);
  }

  let domainKey = 'it';
  if (jTitle.includes('закуп') || jTitle.includes('снабжен')) domainKey = 'procurement';
  else if (jTitle.includes('hr') || jTitle.includes('рекрут') || jTitle.includes('персонал')) domainKey = 'hr';
  else if (jTitle.includes('бухгалтер') || jTitle.includes('учет')) domainKey = 'finance';
  else if (jTitle.includes('продаж') || jTitle.includes('менеджер')) domainKey = 'sales';
  else if (jTitle.includes('юрист') || jTitle.includes('право')) domainKey = 'legal';

  const potentialSkills = SKILL_DICTIONARY[domainKey] || SKILL_DICTIONARY['it'];
  for (const pSkill of potentialSkills) {
    const pLower = pSkill.toLowerCase();
    const isInJob = jTitle.includes(pLower) || jDesc.includes(pLower);
    const hasSkill = userSkills.some((s) => s.includes(pLower) || pLower.includes(s));
    if (isInJob && !hasSkill && !missingSkills.includes(pSkill)) {
      missingSkills.push(pSkill);
    }
  }

  if (missingSkills.length > 0) {
    growthAdvice.push(`Добавьте навык "${missingSkills[0]}", чтобы поднять совпадение по вакансии на +12%`);
  } else {
    growthAdvice.push('Ваш набор навыков отлично покрывает требования данной вакансии');
  }

  if (expectedSal > 0 && job.salary_min) {
    if (job.salary_min >= expectedSal * 0.9) {
      salaryScore = 15;
      matchedReasons.push(`Зарплата выше ожиданий (от ${job.salary_min.toLocaleString()} TJS)`);
    } else if (job.salary_min >= expectedSal * 0.75) {
      salaryScore = 12;
      matchedReasons.push(`Зарплата соответствует рынку (${job.salary_min.toLocaleString()} TJS)`);
    } else {
      salaryScore = 6;
      growthAdvice.push(`Предлагаемая зарплата (от ${job.salary_min} TJS) ниже ваших ожиданий (${expectedSal} TJS)`);
    }
  } else {
    salaryScore = 12;
  }

  const isRemote = job.employment_type === 'remote' || jLoc.includes('удал');
  let distanceEstimate = '0 км (Удаленно)';
  let commuteEstimate = 'Удаленная работа';

  if (isRemote) {
    locationScore = 15;
    distanceEstimate = '0 км (Удаленно)';
    commuteEstimate = 'Удаленная работа';
    matchedReasons.push('Формат: Удаленная работа');
  } else if (userLoc && (jLoc.includes(userLoc) || userLoc.includes(jLoc))) {
    locationScore = 15;
    distanceEstimate = '~3.8 км от вас';
    commuteEstimate = '~16 мин в пути';
    matchedReasons.push(`Логистика: ~16 мин в пути (${job.location || 'Душанбе'})`);
  } else {
    if (profile.relocation === 'ready_country' || profile.relocation === 'ready_abroad') {
      locationScore = 10;
      distanceEstimate = '~250 км (Релокация)';
      commuteEstimate = '3 ч 40 мин в пути';
      matchedReasons.push('Готовность к переезду');
    } else {
      locationScore = 3;
      distanceEstimate = 'Межгород';
      commuteEstimate = '> 3 часов в пути';
    }
  }

  if (profile.certificates && profile.certificates.length > 0) completenessScore += 2;
  if (profile.driving_categories && profile.driving_categories.length > 0) completenessScore += 2;
  if (profile.portfolio_url || profile.github_url) completenessScore += 1;

  const totalScore = positionScore + skillScore + salaryScore + locationScore + completenessScore;
  const finalScore = Math.min(99, Math.max(38, totalScore));

  const scoreBreakdown: ProfileMatchScoreBreakdown = {
    positionScore,
    skillScore,
    salaryScore,
    locationScore,
    completenessScore
  };

  const evalResult: ProfileMatchEvaluation = {
    matchScore: finalScore,
    scoreBreakdown,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 3),
    matchedReasons: matchedReasons.slice(0, 3),
    growthAdvice,
    commuteEstimate,
    distanceEstimate
  };

  evalCache.set(cacheKey, evalResult);
  if (evalCache.size > 2000) evalCache.clear();
  return evalResult;
};

export const evaluateEmployerCandidateMatch = (
  candidate: Candidate,
  profileOverride?: EmployerProfileData | null
): ProfileMatchEvaluation => {
  const profile = profileOverride !== undefined ? profileOverride : getSavedEmployerProfile();

  const defaultBreakdown: ProfileMatchScoreBreakdown = {
    positionScore: 25,
    skillScore: 25,
    salaryScore: 12,
    locationScore: 12,
    completenessScore: 4
  };

  if (!profile) {
    return {
      matchScore: 78,
      scoreBreakdown: defaultBreakdown,
      matchedSkills: [],
      missingSkills: [],
      matchedReasons: ['Базовый профиль кандидата'],
      growthAdvice: [],
      commuteEstimate: '~15 мин в пути',
      distanceEstimate: 'Локация: Душанбе'
    };
  }

  const targetPos = (profile.target_position || '').toLowerCase().trim();
  const reqSkills = (profile.required_skills || []).map((s) => s.toLowerCase().trim());
  const empLoc = (profile.location || 'Душанбе').toLowerCase().replace('г.', '').replace('п.', '').trim();

  const u: any = candidate.user || {};
  const candPos = (candidate.desired_position || '').toLowerCase().trim();
  const candLoc = (u.city || 'Душанбе').toLowerCase().replace('г.', '').replace('п.', '').trim();
  const candSkills = (candidate.skills || []).map((s: any) => (typeof s === 'string' ? s : s.name || '').toLowerCase().trim());

  let positionScore = 15;
  let skillScore = 15;
  let salaryScore = 10;
  let locationScore = 10;
  let completenessScore = 3;

  const matchedReasons: string[] = [];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const growthAdvice: string[] = [];

  // 1. Target Position Match (max 30 pts)
  if (targetPos && (candPos.includes(targetPos) || targetPos.includes(candPos))) {
    positionScore = 30;
    matchedReasons.push(`Должность совпадает: ${candidate.desired_position}`);
  } else if (
    (targetPos.includes('бухгалтер') || targetPos.includes('учет')) &&
    (candPos.includes('бухгалтер') || candPos.includes('учет') || candPos.includes('1с'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: Бухгалтерский учет');
  } else if (
    (targetPos.includes('разработ') || targetPos.includes('dev') || targetPos.includes('программ')) &&
    (candPos.includes('разработ') || candPos.includes('dev') || candPos.includes('программ'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: IT & Разработка');
  } else if (
    (targetPos.includes('продаж') || targetPos.includes('менеджер') || targetPos.includes('торг')) &&
    (candPos.includes('продаж') || candPos.includes('менеджер') || candPos.includes('супервайзер'))
  ) {
    positionScore = 28;
    matchedReasons.push('Специализация: Продажи & Менеджмент');
  }

  // 2. Required Skills Match (max 35 pts)
  for (const skill of profile.required_skills || []) {
    const sLower = skill.toLowerCase().trim();
    if (sLower && candSkills.some((cs: string) => cs.includes(sLower) || sLower.includes(cs))) {
      skillScore += 10;
      matchedSkills.push(skill);
    } else if (sLower) {
      missingSkills.push(skill);
    }
  }
  skillScore = Math.min(35, Math.max(10, skillScore));

  if (matchedSkills.length > 0) {
    matchedReasons.push(`Совпало навыков: ${matchedSkills.length}`);
  }

  // 3. Location Match (max 15 pts)
  if (empLoc && candLoc.includes(empLoc)) {
    locationScore = 15;
    matchedReasons.push(`Город: ${u.city || 'Душанбе'}`);
  }

  // 4. Salary expectations match (max 15 pts)
  if (profile.offered_salary_min && candidate.desired_salary) {
    if (candidate.desired_salary <= profile.offered_salary_min * 1.25) {
      salaryScore = 15;
      matchedReasons.push('Зарплатные ожидания подходят');
    } else {
      salaryScore = 8;
    }
  } else {
    salaryScore = 12;
  }

  const totalScore = positionScore + skillScore + salaryScore + locationScore + completenessScore;
  const finalScore = Math.min(99, Math.max(45, totalScore));

  return {
    matchScore: finalScore,
    scoreBreakdown: {
      positionScore,
      skillScore,
      salaryScore,
      locationScore,
      completenessScore
    },
    matchedSkills,
    missingSkills: missingSkills.slice(0, 3),
    matchedReasons: matchedReasons.slice(0, 3),
    growthAdvice,
    commuteEstimate: '~15-20 мин',
    distanceEstimate: `Локация: ${u.city || 'Душанбе'}`
  };
};

export const sortJobsByProfileMatch = (
  jobs: Job[],
  profileOverride?: UserProfileData | null
): Job[] => {
  if (!jobs || jobs.length === 0) return [];
  const profile = profileOverride !== undefined ? profileOverride : getSavedUserProfile();
  if (!profile || (!profile.position && (!profile.skills || profile.skills.length === 0))) {
    return jobs;
  }
  
  const scores = new Map<string, number>();
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const sc = j.match_score ?? evaluateProfileJobMatch(j, profile).matchScore;
    scores.set(j.id, sc);
  }

  return [...jobs].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
};

export const sortCandidatesByEmployerMatch = (
  candidates: Candidate[],
  profileOverride?: EmployerProfileData | null
): Candidate[] => {
  if (!candidates || candidates.length === 0) return [];
  const profile = profileOverride !== undefined ? profileOverride : getSavedEmployerProfile();
  if (!profile || (!profile.target_position && (!profile.required_skills || profile.required_skills.length === 0))) {
    return candidates;
  }

  const scores = new Map<string, number>();
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const sc = evaluateEmployerCandidateMatch(c, profile).matchScore;
    scores.set(c.id, sc);
  }

  return [...candidates].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
};

