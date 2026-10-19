from typing import Optional, List, Any
from pydantic import BaseModel

class ChatHistoryMessage(BaseModel):
    role: str
    content: str

class AIRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    context: Optional[Any] = None
    user_profile: Optional[Any] = None
    history: Optional[List[ChatHistoryMessage]] = None
    messages: Optional[List[ChatHistoryMessage]] = None

class AIResponse(BaseModel):
    result: str
    session_id: Optional[str] = None
    tool_calls: Optional[Any] = None

class ResumeAnalysisRequest(BaseModel):
    worker_id: Optional[str] = None
    resume_text: Optional[str] = None

class JobDescriptionGeneratorRequest(BaseModel):
    title: str
    company_name: str
    key_skills: str

class MatchBreakdownOut(BaseModel):
    position_score: float
    skill_score: float
    salary_score: float
    location_score: float
    completeness_score: float

class JobMatchRecommendationOut(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    salary: Optional[str] = None
    match_score: float
    breakdown: MatchBreakdownOut
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    match_reasons: List[str] = []
    growth_advice: List[str] = []

class ProfileAnalysisRequest(BaseModel):
    user_profile: Optional[Any] = None

class ProfileAnalysisResponse(BaseModel):
    health_score: float
    overall_rating: str
    key_strengths: List[str] = []
    missing_in_demand_skills: List[str] = []
    salary_assessment: str
    recommended_jobs: List[JobMatchRecommendationOut] = []
    actionable_tips: List[str] = []

