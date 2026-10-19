import os
import abc
import random
import logging
import uuid
import re
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.ai.tools import AITools
from app.ai.key_manager import AIKeyManager
from app.models.domain import UserMemory

logger = logging.getLogger(__name__)

class BaseAIProvider(abc.ABC):
    @abc.abstractmethod
    async def generate_response(
        self, 
        prompt: str, 
        context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        pass

class GroqAIProvider(BaseAIProvider):
    def __init__(self, tools: AITools):
        self.tools = tools

    async def get_user_memories(self, user_id_str: Optional[str]) -> List[Dict[str, str]]:
        if not user_id_str:
            return []
        try:
            uid = uuid.UUID(user_id_str)
            stmt = select(UserMemory).where(UserMemory.user_id == uid).order_by(UserMemory.updated_at.desc())
            res = await self.tools.session.execute(stmt)
            memories = res.scalars().all()
            return [{"key": m.key, "value": m.value} for m in memories]
        except Exception as e:
            logger.warning(f"Error reading user memories: {e}")
            return []

    async def extract_and_save_facts(self, prompt: str, user_id_str: Optional[str]):
        if not prompt or not user_id_str:
            return
        p_lower = prompt.lower()
        uid = uuid.UUID(user_id_str)

        # Detect profession / skills / location / salary statements
        facts_to_save = {}

        if "я " in p_lower or "мой " in p_lower or "умею" in p_lower or "работаю" in p_lower:
            if any(w in p_lower for w in ["smm", "смм", "контент", "видео"]):
                facts_to_save["profession"] = "SMM / Контент-специалист"
                facts_to_save["skills"] = "SMM, Съёмка видео, Контент-мейкинг"
            elif any(w in p_lower for w in ["python", "питон", "пайтон", "backend", "бэкенд"]):
                facts_to_save["profession"] = "Python / Backend Разработчик"
                facts_to_save["skills"] = "Python, Backend"
            elif any(w in p_lower for w in ["frontend", "фронтенд", "react", "js"]):
                facts_to_save["profession"] = "Frontend Разработчик"
                facts_to_save["skills"] = "React, Frontend, JavaScript"

        if "душанбе" in p_lower:
            facts_to_save["preferred_city"] = "Душанбе"
        elif "ходжент" in p_lower or "худжанд" in p_lower:
            facts_to_save["preferred_city"] = "Худжанд"

        if "удален" in p_lower or "удалён" in p_lower or "дистанцион" in p_lower:
            facts_to_save["work_format"] = "Удалённо"

        sal_match = re.search(r'от\s+(\d{4,6})', p_lower)
        if sal_match:
            facts_to_save["desired_salary"] = f"от {sal_match.group(1)} TJS"

        for k, v in facts_to_save.items():
            try:
                stmt = select(UserMemory).where(UserMemory.user_id == uid, UserMemory.key == k)
                res = await self.tools.session.execute(stmt)
                existing = res.scalar_one_or_none()
                if existing:
                    existing.value = v
                else:
                    new_mem = UserMemory(user_id=uid, key=k, value=v)
                    self.tools.session.add(new_mem)
                await self.tools.session.commit()
            except Exception as ex:
                logger.warning(f"Error saving user memory: {ex}")

    async def generate_response(
        self, 
        prompt: str, 
        context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        user_name = context.get("full_name") or context.get("email") if context else None
        user_id = context.get("user_id") if context else None
        name_str = f" Имя соискателя: {user_name}." if user_name else ""

        # Asynchronously extract long-term facts
        if user_id and prompt:
            await self.extract_and_save_facts(prompt, user_id)

        # Load long-term memories
        memories = await self.get_user_memories(user_id)
        mem_info = ""
        if memories:
            mem_items = [f"- {m['key']}: {m['value']}" for m in memories]
            mem_info = f"\nДолгосрочная память AI о пользователе:\n" + "\n".join(mem_items) + "\n"

        user_prof = (context or {}).get("user_profile") or {}
        prof_info = ""
        if user_prof and isinstance(user_prof, dict):
            pos = user_prof.get("position") or ""
            skills = ", ".join(user_prof.get("skills") or [])
            loc = user_prof.get("location") or ""
            bio = user_prof.get("bio") or ""
            prof_info = f"\nПрофиль соискателя:\n- Целевая должность: {pos}\n- Навыки: {skills}\n- Город: {loc}\n- Опыт/О себе: {bio}\n"

        # Fetch active vacancies from PostgreSQL database
        jobs_text = ""
        total_vacancies_count = 0
        try:
            db_jobs = await self.tools.search_jobs(title="", limit=1000)
            total_vacancies_count = len(db_jobs)
            if db_jobs:
                prompt_lower = (prompt or "").lower()
                user_pos_lower = (user_prof.get("position") or "").lower() if isinstance(user_prof, dict) else ""
                user_skills = [s.lower() for s in (user_prof.get("skills") or [])] if isinstance(user_prof, dict) else []
                
                # Incorporate user memory into relevance matching
                for m in memories:
                    if m["key"] == "skills":
                        user_skills.extend([s.strip().lower() for s in m["value"].split(",")])
                    if m["key"] == "profession" and not user_pos_lower:
                        user_pos_lower = m["value"].lower()

                def get_relevance(j):
                    score = 0
                    t_low = j['title'].lower()
                    d_low = (j.get('description') or '').lower()

                    if user_pos_lower and any(w in t_low for w in user_pos_lower.split() if len(w) >= 3):
                        score += 50
                    for sk in user_skills:
                        if len(sk) >= 2 and (sk in t_low or sk in d_low):
                            score += 20
                    for word in prompt_lower.split():
                        if len(word) >= 3 and word not in ["как", "что", "где", "для", "меня", "какие", "есть", "покажи", "ещё"]:
                            if word in t_low: score += 15
                            if word in d_low: score += 5
                    return score

                sorted_jobs = sorted(db_jobs, key=get_relevance, reverse=True)
                top_grounded_jobs = sorted_jobs[:40]

                job_list_str = []
                for j in top_grounded_jobs:
                    sal = f" (зарплата: {j['salary_min']} TJS)" if j.get('salary_min') else ""
                    comp = j.get('company') or "Работодатель"
                    job_list_str.append(f"• \"{j['title']}\" — {comp}, {j['location']}{sal}")
                jobs_text = f"\nВсего опубликованных вакансий в базе HamKor: {total_vacancies_count}. Подходящие реальные вакансии:\n" + "\n".join(job_list_str)
        except Exception as e:
            logger.error(f"Error loading jobs for AI context: {e}")

        system_prompt = (
            f"Ты — HamKor AI, интеллигентный персональный карьерный ассистент платформы HamKor в Таджикистане.{name_str}\n"
            f"У тебя есть ДОСТУП К {total_vacancies_count} РЕАЛЬНЫМ ВАКАНСИЯМ ПЛАТФОРМЫ HAMKOR И ПРОФИЛЮ СОИСКАТЕЛЯ.\n"
            f"{prof_info}\n"
            f"{mem_info}\n"
            f"{jobs_text}\n"
            "ПРАВИЛА И ИНСТРУКЦИИ:\n"
            "1. Отвечай прямо на конкретное сообщение пользователя! Если пользователь пишет, например, 'я умею снимать видео' или 'я SMM', НЕ выводи стандартное шаблонное приветствие и НЕ начинай рассказывать про несоответствующие вакансии. Поддержи диалог, проанализируй его навыки, уточни намерения или покажи подходящие вакансии.\n"
            "2. Учитывай историю текущего диалога и долговременную память пользователя для уточняющих вопросов ('какие у меня варианты?', 'а в Душанбе?', 'покажи ещё').\n"
            "3. При поиске вакансий используй ТОЛЬКО реальные вакансии HamKor из списка выше. Указывай процент соответствия (например 🎯 96% Подходит) и аргументируй совпадение.\n"
            "4. ОБЯЗАТЕЛЬНО выделяй точные названия вакансий двойными кавычками, например: \"SMM специалист\" или \"Frontend разработчик\", и оформляй каждую вакансию списком с новой строки (НЕ сливай в сплошную таблицу), чтобы на платформе создавались кликабельные кнопки-ссылки на вакансии!\n"
            "5. НЕ выдумывай несуществующие вакансии, компании или данные.\n"
            "6. Отвечай вежливо, коротко и по делу на языке пользователя (русский, таджикский)."
        )

        # Check for automatic job application intent
        prompt_lower = (prompt or "").lower()
        if any(w in prompt_lower for w in ["откликнись на", "подай заявку на", "отправить отклик на"]):
            if user_id:
                try:
                    db_jobs = await self.tools.search_jobs(title="", limit=1000)
                    matched_job = None

                    for j in db_jobs:
                        t_low = j["title"].lower()
                        if t_low in prompt_lower:
                            matched_job = j
                            break

                    if not matched_job and db_jobs:
                        words = [w for w in prompt_lower.split() if len(w) >= 3 and w not in ["откликнись", "подай", "заявку", "отклик", "вакансию", "на", "мне"]]
                        for j in db_jobs:
                            t_low = j["title"].lower()
                            if any(word in t_low for word in words):
                                matched_job = j
                                break

                    if matched_job:
                        from app.services.application import ApplicationService
                        from app.schemas.application import ApplicationCreate
                        app_service = ApplicationService(self.tools.session)
                        cover_note = f"Автоматический отклик через HamKor AI на вакансию '{matched_job['title']}'."
                        
                        try:
                            sal_val = matched_job.get("salary_min")
                            sal_str = f"{sal_val} TJS" if sal_val else "Договорная"
                            
                            await app_service.apply_to_job(uuid.UUID(user_id), ApplicationCreate(job_id=uuid.UUID(matched_job["id"]), cover_note=cover_note))
                            return (
                                f"✅ **Отклик успешно отправлен!**\n\n"
                                f"HamKor AI оформил заявку на вакансию **\"{matched_job['title']}\"**\n"
                                f"🏢 **Компания:** {matched_job.get('company', 'Работодатель')}\n"
                                f"📍 **Локация:** {matched_job.get('location', 'Таджикистан')}\n"
                                f"💰 **Зарплата:** {sal_str}\n\n"
                                f"Уведомление отправлено работодателю!"
                            )
                        except Exception as app_err:
                            if "already" in str(app_err).lower() or "существует" in str(app_err).lower():
                                return f"ℹ️ Вы уже отправляли отклик на вакансию **\"{matched_job['title']}\"**."
                            raise app_err
                except Exception as ex:
                    logger.error(f"AI application error: {ex}")

        # Construct multi-turn message payload
        messages_payload = [{"role": "system", "content": system_prompt}]
        
        if history:
            for item in history[-10:]:
                role = "assistant" if item.get("role") in ["assistant", "ai"] else "user"
                content = item.get("content") or ""
                if content.strip():
                    messages_payload.append({"role": role, "content": content})

        messages_payload.append({"role": "user", "content": prompt})

        res = await AIKeyManager.generate_completion(messages_payload, json_mode=False, temperature=0.4, max_tokens=1200)
        if res and res.strip():
            from app.ai.key_manager import clean_reasoning_tags
            cleaned_res = clean_reasoning_tags(res)
            if cleaned_res:
                return cleaned_res

        return await DynamicFallbackAIProvider(self.tools).generate_response(prompt, context, history)


class DynamicFallbackAIProvider(BaseAIProvider):
    def __init__(self, tools: AITools):
        self.tools = tools

    async def generate_response(
        self, 
        prompt: str, 
        context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        user_name = context.get("full_name") if context else None
        greeting_name = f", {user_name}" if user_name else ""
        return f"ИИ-ассистент HamKor{greeting_name} обрабатывает ваш запрос. Если модель задерживается, пожалуйста, повторите попытку через пару секунд."

class AIService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.tools = AITools(session)
        self.provider: BaseAIProvider = GroqAIProvider(self.tools)

    async def process_user_query(
        self, 
        prompt: str, 
        context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        return await self.provider.generate_response(prompt, context, history)
