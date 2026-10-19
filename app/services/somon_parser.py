import logging
import re
import asyncio
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional, List, Set, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import Job
from app.models.enums import EmploymentType, JobStatus
from app.services.vacancy_normalizer import VacancyNormalizer

logger = logging.getLogger(__name__)

SOMON_VACANCIES_BASE_URL = "https://somon.tj/vakansii/"
SOMON_DOMAIN = "https://somon.tj"

def parse_somon_salary(raw_salary: Optional[str]) -> Tuple[Optional[float], Optional[float], str]:
    return VacancyNormalizer.parse_salary(sal_from=None, sal_to=None, raw_text=raw_salary)

def map_somon_employment_type(title: str, description: str) -> EmploymentType:
    comb = f"{title} {description}".lower()
    if "удален" in comb or "дистанцио" in comb or "фриланс" in comb or "remote" in comb:
        return EmploymentType.REMOTE
    if "частичн" in comb or "гибк" in comb or "смен" in comb or "полдня" in comb or "part-time" in comb:
        return EmploymentType.PART_TIME
    if "стажировк" in comb or "практик" in comb or "intern" in comb:
        return EmploymentType.INTERNSHIP
    if "проект" in comb or "контракт" in comb or "времен" in comb:
        return EmploymentType.CONTRACT
    return EmploymentType.FULL_TIME

def detect_somon_category(title: str, description: str, breadcrumb_cat: Optional[str] = None) -> str:
    return VacancyNormalizer.normalize_category(title, description, breadcrumb_cat)


class SomonParserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

    async def get_max_pages(self, client: httpx.AsyncClient) -> int:
        try:
            res = await client.get(SOMON_VACANCIES_BASE_URL)
            if res.status_code != 200:
                return 1
            res.encoding = "utf-8"
            soup = BeautifulSoup(res.text, "html.parser")
            page_nums = [1]
            for a in soup.find_all("a", href=True):
                if "page=" in a["href"]:
                    try:
                        num = int(a["href"].split("page=")[-1].split("&")[0])
                        page_nums.append(num)
                    except ValueError:
                        pass
            return max(page_nums)
        except Exception as e:
            logger.error(f"Error discovering Somon max pages: {e}")
            return 1

    async def fetch_item_links(self, client: httpx.AsyncClient, page: int = 1) -> List[str]:
        if page == 1:
            page_url = SOMON_VACANCIES_BASE_URL
        else:
            page_url = f"{SOMON_VACANCIES_BASE_URL}?page={page}"
            
        retries = 3
        for attempt in range(retries):
            try:
                res = await client.get(page_url)
                if res.status_code == 200:
                    res.encoding = "utf-8"
                    soup = BeautifulSoup(res.text, "html.parser")
                    links = []
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        if href.startswith("/adv/") and href not in links:
                            links.append(href)
                    return links
                await asyncio.sleep(0.5 * (attempt + 1))
            except Exception as err:
                logger.warning(f"Error fetching Somon page {page} (attempt {attempt+1}): {err}")
                await asyncio.sleep(0.5 * (attempt + 1))
        return []

    async def parse_detail_page(self, client: httpx.AsyncClient, href: str) -> Optional[Dict[str, Any]]:
        full_url = SOMON_DOMAIN + href if href.startswith("/") else href
        
        id_match = re.search(r'/adv/(\d+)', href)
        if not id_match:
            return None
        external_id = id_match.group(1)

        retries = 2
        for attempt in range(retries):
            try:
                res = await client.get(full_url)
                if res.status_code != 200:
                    if attempt < retries - 1:
                        await asyncio.sleep(0.5)
                        continue
                    return None
                res.encoding = "utf-8"
                soup = BeautifulSoup(res.text, "html.parser")

                title_el = soup.select_one(".announcement-title, h1, .title")
                title = title_el.get_text(strip=True) if title_el else "Вакансия"

                price_el = soup.select_one(".announcement-price, .price-tag, .js-announcement-price, .price, [class*='price']")
                raw_salary = price_el.get_text(strip=True) if price_el else None
                salary_min, salary_max, currency = parse_somon_salary(raw_salary)

                desc_el = soup.select_one(".announcement-description, .js-announcement-text, [itemprop='description']")
                raw_desc = desc_el.get_text("\n", strip=True) if desc_el else ""
                clean_desc = VacancyNormalizer.clean_html(raw_desc)

                employer_name = "Somon Работодатель"
                author_el = soup.select_one(".announcement-author__name, .user-name, .author-name, [class*='author']")
                if author_el:
                    employer_name = author_el.get_text(strip=True)

                chars = []
                comp_from_char = None
                for char_el in soup.select("ul.chars-column li, .announcement-characteristics__item, .characteristics-list__item, li.char, div.announcement-characteristics li"):
                    txt = char_el.get_text(" ", strip=True)
                    if txt:
                        chars.append(txt)
                        if "компани" in txt.lower() or "организаци" in txt.lower() or "название" in txt.lower():
                            parts = txt.split(":", 1)
                            if len(parts) > 1 and len(parts[1].strip()) > 0:
                                comp_from_char = parts[1].strip().replace('"', '')

                if comp_from_char and len(comp_from_char) > 1:
                    employer_name = comp_from_char

                bc_list = [a.get_text(strip=True) for a in soup.select(".breadcrumbs a, .breadcrumb a, ul.breadcrumb li a, nav.breadcrumbs a")]
                raw_cat = bc_list[-1] if len(bc_list) > 2 else (bc_list[1] if len(bc_list) > 1 else None)
                cat_name = detect_somon_category(title, clean_desc, raw_cat)

                raw_location = "г. Душанбе"
                for span in soup.select("span, div, p"):
                    txt = span.get_text(strip=True)
                    if any(city in txt for city in ["Душанбе", "Худжанд", "Бохтар", "Куляб", "Гиссар", "Вахдат"]):
                        raw_location = txt
                        break
                location = VacancyNormalizer.normalize_city(raw_location)

                pub_date_str = None
                for meta_el in soup.select("div[class*='meta'], span[class*='date'], div[class*='date']"):
                    t_text = meta_el.get_text(strip=True)
                    if "Опубликовано" in t_text or "Дата" in t_text:
                        pub_date_str = t_text
                        break
                published_at = VacancyNormalizer.parse_datetime(pub_date_str) or datetime.now(timezone.utc)

                img_el = soup.select_one(".announcement-gallery img, .image-gallery img, img[itemprop='image']")
                logo_url = img_el["src"] if img_el and img_el.has_attr("src") else None
                if logo_url and logo_url.startswith("//"):
                    logo_url = "https:" + logo_url
                elif logo_url and logo_url.startswith("/"):
                    logo_url = SOMON_DOMAIN + logo_url

                desc_parts = []
                desc_parts.append(f"🏢 Компания: {employer_name}")
                desc_parts.append(f"📍 Локация: {location}")
                if raw_salary:
                    desc_parts.append(f"💰 Оплата: {raw_salary}")
                if chars:
                    desc_parts.append(f"📋 Характеристики:\n• " + "\n• ".join(chars))
                if clean_desc:
                    desc_parts.append(f"📌 Описание вакансии:\n{clean_desc}")
                desc_parts.append(f"\nℹ️ Вакансия импортирована с портала somon.tj")
                full_description = "\n\n".join(desc_parts)

                emp_type = map_somon_employment_type(title, clean_desc)

                raw_data_dict = {
                    "external_id": external_id,
                    "url": full_url,
                    "title": title,
                    "raw_salary": raw_salary,
                    "employer_name": employer_name,
                    "breadcrumbs": bc_list,
                    "characteristics": chars,
                    "raw_description": raw_desc,
                    "location": location,
                    "published_at": published_at.isoformat() if published_at else None
                }

                return {
                    "external_id": external_id,
                    "external_url": full_url,
                    "title": title,
                    "description": full_description,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "currency": currency,
                    "location": location,
                    "category": cat_name,
                    "employment_type": emp_type,
                    "external_company_name": employer_name,
                    "external_company_logo": logo_url,
                    "characteristics": chars,
                    "published_at": published_at,
                    "raw_data": raw_data_dict
                }
            except Exception as err:
                logger.error(f"Error parsing Somon detail page {full_url} (attempt {attempt+1}): {err}")
                if attempt < retries - 1:
                    await asyncio.sleep(0.5)

        return None

    async def fetch_and_sync(
        self,
        max_pages: Optional[int] = None,
        delay_seconds: float = 0.05,
        full_import: bool = True
    ) -> Dict[str, Any]:
        stats = {
            "source": "somon.tj",
            "total_found": 0,
            "total_fetched": 0,
            "created": 0,
            "updated": 0,
            "deactivated": 0,
            "errors": 0,
            "pages_processed": 0
        }

        now_utc = datetime.now(timezone.utc)
        seen_external_ids: Set[str] = set()

        async with httpx.AsyncClient(timeout=35.0, headers=self.headers, follow_redirects=True) as client:
            discovered_max = await self.get_max_pages(client)
            pages_to_crawl = min(max_pages, discovered_max) if max_pages else discovered_max
            logger.info(f"SomonParserService: Scraping {pages_to_crawl} pages out of {discovered_max} discovered.")

            all_hrefs: List[str] = []
            for page in range(1, pages_to_crawl + 1):
                hrefs = await self.fetch_item_links(client, page)
                if not hrefs and page > 3:
                    logger.warning(f"No hrefs returned on Somon page {page}, stopping pagination.")
                    break
                all_hrefs.extend(hrefs)
                stats["pages_processed"] += 1
                await asyncio.sleep(delay_seconds)

            unique_hrefs = list(dict.fromkeys(all_hrefs))
            stats["total_found"] = len(unique_hrefs)
            logger.info(f"SomonParserService: Found {len(unique_hrefs)} unique vacancy URLs.")

            semaphore = asyncio.Semaphore(5)

            async def fetch_single(href: str) -> Optional[Dict[str, Any]]:
                async with semaphore:
                    try:
                        return await self.parse_detail_page(client, href)
                    except Exception as e:
                        logger.error(f"Error fetching detail {href}: {e}")
                        return None

            batch_size = 25
            for i in range(0, len(unique_hrefs), batch_size):
                batch_hrefs = unique_hrefs[i:i+batch_size]
                parsed_results = await asyncio.gather(*(fetch_single(h) for h in batch_hrefs))

                for data in parsed_results:
                    if not data:
                        stats["errors"] += 1
                        continue

                    vac_id = data["external_id"]
                    seen_external_ids.add(vac_id)
                    stats["total_fetched"] += 1

                    group_id = VacancyNormalizer.compute_job_group_id(
                        data["title"], data["external_company_name"], data["location"]
                    )

                    req_dict = {
                        "characteristics": data.get("characteristics", []),
                        "skills": [s.strip() for s in data["title"].split() if len(s.strip()) > 2]
                    }

                    try:
                        async with self.session.begin_nested():
                            stmt = select(Job).where(
                                Job.external_source == "somon.tj",
                                Job.external_id == vac_id
                            )
                            res = await self.session.execute(stmt)
                            existing_job = res.scalar_one_or_none()

                            if existing_job:
                                existing_job.title = data["title"]
                                existing_job.description = data["description"]
                                existing_job.salary_min = data["salary_min"]
                                existing_job.salary_max = data["salary_max"]
                                existing_job.currency = data["currency"]
                                existing_job.location = data["location"]
                                existing_job.category = data["category"]
                                existing_job.employment_type = data["employment_type"]
                                existing_job.external_company_name = data["external_company_name"]
                                existing_job.external_company_logo = data["external_company_logo"]
                                existing_job.external_url = data["external_url"]
                                existing_job.requirements = req_dict
                                existing_job.status = JobStatus.OPEN
                                existing_job.raw_data = data["raw_data"]
                                existing_job.published_at = data["published_at"]
                                existing_job.last_seen_at = now_utc
                                existing_job.job_group_id = group_id
                                stats["updated"] += 1
                            else:
                                new_job = Job(
                                    company_id=None,
                                    title=data["title"],
                                    description=data["description"],
                                    salary_min=data["salary_min"],
                                    salary_max=data["salary_max"],
                                    currency=data["currency"],
                                    location=data["location"],
                                    category=data["category"],
                                    employment_type=data["employment_type"],
                                    status=JobStatus.OPEN,
                                    requirements=req_dict,
                                    is_external=True,
                                    external_source="somon.tj",
                                    external_id=vac_id,
                                    external_url=data["external_url"],
                                    external_company_name=data["external_company_name"],
                                    external_company_logo=data["external_company_logo"],
                                    raw_data=data["raw_data"],
                                    published_at=data["published_at"],
                                    first_seen_at=now_utc,
                                    last_seen_at=now_utc,
                                    job_group_id=group_id
                                )
                                self.session.add(new_job)
                                stats["created"] += 1
                    except Exception as e:
                        logger.error(f"DB Error saving Somon vacancy {vac_id}: {e}")
                        stats["errors"] += 1

                await self.session.commit()
                await asyncio.sleep(delay_seconds)

        if full_import and seen_external_ids:
            try:
                stmt = select(Job).where(
                    Job.external_source == "somon.tj",
                    Job.is_external == True,
                    Job.status == JobStatus.OPEN
                )
                res = await self.session.execute(stmt)
                existing_somon_jobs = res.scalars().all()

                for job in existing_somon_jobs:
                    if job.external_id and job.external_id not in seen_external_ids:
                        job.status = JobStatus.CLOSED
                        stats["deactivated"] += 1

                await self.session.commit()
            except Exception as e:
                logger.error(f"Error deactivating stale Somon vacancies: {e}")

        logger.info(f"SOMON IMPORT FINISHED: {stats}")
        return stats
