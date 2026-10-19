import logging
import re
import asyncio
from datetime import datetime, timezone
import httpx
from typing import Dict, Any, Optional, List, Set
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import Job
from app.models.enums import EmploymentType, JobStatus
from app.services.vacancy_normalizer import VacancyNormalizer

logger = logging.getLogger(__name__)

YORA_API_SEARCH_URL = "https://api.yora.tj/api/v1/vacancy_search"
YORA_BASE_VACANCY_URL = "https://yora.tj/ru/vacancies"

class YoraParserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.normalizer = VacancyNormalizer()

    @staticmethod
    def _map_employment_type(work_format_name: Optional[str]) -> EmploymentType:
        if not work_format_name:
            return EmploymentType.FULL_TIME
        name_lower = work_format_name.lower()
        if "удал" in name_lower or "дистанц" in name_lower:
            return EmploymentType.REMOTE
        if "частич" in name_lower or "гибк" in name_lower or "смен" in name_lower:
            return EmploymentType.PART_TIME
        if "стаж" in name_lower or "практик" in name_lower:
            return EmploymentType.INTERNSHIP
        if "проект" in name_lower or "контракт" in name_lower:
            return EmploymentType.CONTRACT
        return EmploymentType.FULL_TIME

    @staticmethod
    def _clean_text(raw_text: Optional[str]) -> str:
        return VacancyNormalizer.clean_html(raw_text)

    @staticmethod
    def _build_description(item: Dict[str, Any]) -> str:
        parts = []

        org_name = (item.get("organisation_name") or "Работодатель").strip()
        pos_title = (item.get("position") or "Специалист").strip()
        raw_region = item.get("region_id_name") or "Таджикистан"
        region = VacancyNormalizer.normalize_city(raw_region)
        exp_level = item.get("experience_level_name")
        work_format = item.get("work_format_name")

        meta_info = []
        meta_info.append(f"🏢 Компания: {org_name}")
        meta_info.append(f"📍 Локация: {region}")
        if exp_level:
            meta_info.append(f"💼 Требуемый опыт: {exp_level}")
        if work_format:
            meta_info.append(f"⏰ Формат работы: {work_format}")
        parts.append("\n".join(meta_info))

        position_txt = VacancyNormalizer.clean_html(item.get("position_txt"))
        if position_txt and len(position_txt) > 20:
            parts.append(f"📌 Описание вакансии:\n{position_txt}")

        responsibilities = VacancyNormalizer.clean_html(item.get("responsibilities"))
        if responsibilities:
            parts.append(f"📋 Обязанности:\n{responsibilities}")

        requirements = VacancyNormalizer.clean_html(item.get("requirements"))
        if requirements:
            parts.append(f"🎯 Требования к кандидату:\n{requirements}")

        conditions = VacancyNormalizer.clean_html(item.get("conditions"))
        if conditions:
            parts.append(f"🎁 Условия и преимущества:\n{conditions}")

        if len(parts) == 1:
            parts.append(f"Компания {org_name} приглашает специалиста на должность {pos_title} в городе {region}.")

        parts.append(f"\nℹ️ Вакансия верифицирована и импортирована с официального портала yora.tj")
        return "\n\n".join(parts)

    async def fetch_and_sync(
        self,
        max_pages: Optional[int] = None,
        page_size: int = 50,
        full_import: bool = True
    ) -> Dict[str, Any]:
        stats = {
            "source": "yora.tj",
            "total_found": 0,
            "total_fetched": 0,
            "created": 0,
            "updated": 0,
            "deactivated": 0,
            "errors": 0,
            "pages_processed": 0
        }

        seen_external_ids: Set[str] = set()
        now_utc = datetime.now(timezone.utc)

        async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }

            current_page = 1
            total_pages = 1

            while current_page <= total_pages:
                if max_pages and current_page > max_pages:
                    break

                fetch_success = False
                retries = 3
                for attempt in range(retries):
                    try:
                        params = {
                            "page": current_page,
                            "page_size": page_size
                        }
                        response = await client.get(YORA_API_SEARCH_URL, headers=headers, params=params)

                        if response.status_code == 200:
                            data = response.json()
                            total_pages = data.get("total_pages", 1)
                            stats["total_found"] = data.get("total_cnt") or (total_pages * page_size)
                            items = data.get("data", [])

                            for item in items:
                                stats["total_fetched"] += 1
                                vac_id = item.get("id")
                                if vac_id:
                                    seen_external_ids.add(str(vac_id))

                                try:
                                    async with self.session.begin_nested():
                                        await self._sync_single_vacancy(client, item, stats, now_utc)
                                except Exception as e:
                                    logger.error(f"Error syncing Yora vacancy {item.get('id')}: {e}")
                                    stats["errors"] += 1

                            await self.session.commit()
                            fetch_success = True
                            stats["pages_processed"] += 1
                            break
                        else:
                            logger.warning(f"Yora page {current_page} attempt {attempt+1} status {response.status_code}")
                            await asyncio.sleep(1.0 * (attempt + 1))
                    except Exception as e:
                        logger.error(f"Network error fetching Yora page {current_page} (attempt {attempt+1}): {e}")
                        await asyncio.sleep(1.0 * (attempt + 1))

                if not fetch_success:
                    logger.error(f"Failed to fetch Yora page {current_page} after {retries} attempts.")
                    stats["errors"] += 1

                current_page += 1
                await asyncio.sleep(0.1)

        # Soft delete / deactivation logic for full import mode
        if full_import and seen_external_ids:
            try:
                stmt = select(Job).where(
                    Job.external_source == "yora.tj",
                    Job.is_external == True,
                    Job.status == JobStatus.OPEN
                )
                result = await self.session.execute(stmt)
                existing_yora_jobs = result.scalars().all()

                for job in existing_yora_jobs:
                    if job.external_id and job.external_id not in seen_external_ids:
                        job.status = JobStatus.CLOSED
                        stats["deactivated"] += 1

                await self.session.commit()
            except Exception as e:
                logger.error(f"Error deactivating stale Yora vacancies: {e}")

        logger.info(f"YORA IMPORT FINISHED: {stats}")
        return stats

    async def _sync_single_vacancy(
        self,
        client: httpx.AsyncClient,
        item: Dict[str, Any],
        stats: Dict[str, Any],
        now_utc: datetime
    ) -> None:
        vac_id = item.get("id")
        if not vac_id:
            return

        external_id = str(vac_id)
        external_source = "yora.tj"
        title = (item.get("position") or "Вакансия").strip()
        description = self._build_description(item)

        raw_sal_from = item.get("salary_from")
        raw_sal_to = item.get("salary_to")
        raw_curr = item.get("currency_name") or "TJS"
        salary_min, salary_max, currency = VacancyNormalizer.parse_salary(
            sal_from=raw_sal_from,
            sal_to=raw_sal_to,
            raw_currency=raw_curr
        )

        raw_location = item.get("region_id_name") or "Таджикистан"
        location = VacancyNormalizer.normalize_city(raw_location)
        work_format = item.get("work_format_name")
        employment_type = self._map_employment_type(work_format)

        category = VacancyNormalizer.normalize_category(title, description, item.get("position"))
        org_name = (item.get("organisation_name") or "Компания").strip()
        org_logo = await self._extract_logo_async(client, item)
        external_url = f"{YORA_BASE_VACANCY_URL}/{external_id}"
        published_at = VacancyNormalizer.parse_datetime(item.get("publish_date")) or now_utc

        req_dict = {
            "experience_level": item.get("experience_level_name"),
            "work_format": work_format,
            "responsibilities": VacancyNormalizer.clean_html(item.get("responsibilities")),
            "requirements": VacancyNormalizer.clean_html(item.get("requirements")),
            "skills": [s.strip() for s in title.split() if len(s.strip()) > 2]
        }

        group_id = VacancyNormalizer.compute_job_group_id(title, org_name, location)

        # Check existing job
        stmt = select(Job).where(
            Job.external_source == external_source,
            Job.external_id == external_id
        )
        result = await self.session.execute(stmt)
        existing_job = result.scalar_one_or_none()

        if existing_job:
            existing_job.title = title
            existing_job.description = description
            existing_job.salary_min = salary_min
            existing_job.salary_max = salary_max
            existing_job.currency = currency
            existing_job.location = location
            existing_job.category = category
            existing_job.employment_type = employment_type
            existing_job.requirements = req_dict
            existing_job.external_company_name = org_name
            existing_job.external_company_logo = org_logo
            existing_job.external_url = external_url
            existing_job.status = JobStatus.OPEN
            existing_job.raw_data = item
            existing_job.published_at = published_at
            existing_job.last_seen_at = now_utc
            existing_job.job_group_id = group_id
            stats["updated"] += 1
        else:
            new_job = Job(
                company_id=None,
                title=title,
                description=description,
                salary_min=salary_min,
                salary_max=salary_max,
                currency=currency,
                location=location,
                category=category,
                employment_type=employment_type,
                status=JobStatus.OPEN,
                requirements=req_dict,
                is_external=True,
                external_source=external_source,
                external_id=external_id,
                external_url=external_url,
                external_company_name=org_name,
                external_company_logo=org_logo,
                raw_data=item,
                published_at=published_at,
                first_seen_at=now_utc,
                last_seen_at=now_utc,
                job_group_id=group_id
            )
            self.session.add(new_job)
            stats["created"] += 1

    async def _extract_logo_async(self, client: httpx.AsyncClient, item: Dict[str, Any]) -> str:
        raw_logo = (
            item.get("organisation_avatar_url") or
            item.get("employer_avatar_url") or
            item.get("logo") or
            item.get("photo_url") or
            item.get("avatar") or
            item.get("organisation_logo")
        )
        if raw_logo and isinstance(raw_logo, str) and raw_logo.strip():
            url = raw_logo.strip()
            if url.startswith("http://") or url.startswith("https://"):
                return url
            if url.startswith("/"):
                return f"https://yora.tj{url}"
            return f"https://yora.tj/{url}"

        org = item.get("organisation_name") or "HamKor"
        initial = org[0].upper() if org and org[0].isalnum() else "E"
        
        gradients = [
            ("4f46e5", "7c3aed"),
            ("059669", "0d9488"),
            ("dc2626", "ea580c"),
            ("2563eb", "0284c7"),
            ("d97706", "ca8a04"),
            ("7c3aed", "c026d3"),
        ]
        g_idx = abs(hash(org)) % len(gradients)
        c1, c2 = gradients[g_idx]

        return f"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23{c1}'/><stop offset='100%' stop-color='%23{c2}'/></linearGradient></defs><rect width='120' height='120' rx='32' fill='url(%23g)'/><text x='60' y='76' font-size='56' font-weight='900' font-family='sans-serif' fill='white' text-anchor='middle'>{initial}</text></svg>"
