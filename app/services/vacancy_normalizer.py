import re
import hashlib
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime, timezone
from dateutil import parser as date_parser

TAJIK_CITIES_MAP = {
    "душанбе": "г. Душанбе",
    "dushanbe": "г. Душанбе",
    "худжанд": "г. Худжанд",
    "khujand": "г. Худжанд",
    "ходжент": "г. Худжанд",
    "бохтар": "г. Бохтар",
    "bokhtar": "г. Бохтар",
    "курган-тюбе": "г. Бохтар",
    "куляб": "г. Куляб",
    "kulob": "г. Куляб",
    "гиссар": "г. Гиссар",
    "hissar": "г. Гиссар",
    "вахдат": "г. Вахдат",
    "vahdat": "г. Вахдат",
    "турсунзаде": "г. Турсунзаде",
    "tursunzoda": "г. Турсунзаде",
    "истаравшан": "г. Истаравшан",
    "istaravshan": "г. Истаравшан",
    "пенджикент": "г. Пенджикент",
    "panjakent": "г. Пенджикент",
    "хорог": "г. Хорог",
    "khorog": "г. Хорог",
    "нурек": "г. Нурек",
    "nurek": "г. Нурек",
}

CATEGORY_KEYWORDS = [
    ("IT & Технологии", ["it", "программист", "разработчик", "дизайнер", "python", "javascript", "react", "веб", "devops", "sysadmin", "qa", "тестировщик", "front-end", "backend", "fullstack", "1с", "информацион"]),
    ("Финансы и банки", ["бухгалтер", "финанс", "кассир", "аудит", "банк", "налог", "кредит", "экономист", "сметчик", "учет"]),
    ("Торговля & Продажи", ["торгов", "продаж", "консультант", "менеджер по продажам", "супервайзер", "мерчендайзер", "касса", "магазин", "продавец", "торговый представитель"]),
    ("Логистика & Транспорт", ["водитель", "курьер", "доставк", "логист", "склад", "погрузчик", "экспедитор", "перевозк", "грузчик"]),
    ("Услуги & Консалтинг", ["ресепш", "администратор", "офис-менеджер", "секретарь", "оператор", "колл-центр", "call-center", "поддержк"]),
    ("Образование & Наука", ["учитель", "преподаватель", "педагог", "воспитатель", "тренер", "репетитор", "уподаватель"]),
    ("Медицина & Фармацевтика", ["врач", "медсестра", "фармацевт", "стоматолог", "провизор", "медицинск", "лаборант"]),
    ("Строительство & Архитектура", ["инженер", "строитель", "электрик", "мастер", "прораб", "архитектор", "монтажник", "сантехник", "сварщик"]),
    ("Маркетинг & PR", ["маркетолог", "smm", "pr", "копирайтер", "контент", "target", "таргетолог", "реклам"]),
    ("Административный персонал", ["директор", "управляющий", "руководитель", "менеджер", "hr", "кадры", "рекрутер"]),
]

class VacancyNormalizer:
    @staticmethod
    def normalize_city(raw_city: Optional[str]) -> str:
        if not raw_city or not isinstance(raw_city, str):
            return "г. Душанбе"
        clean = raw_city.strip().lower()
        clean = re.sub(r'^(г\.|город|согд|хт|г|область)\s*', '', clean).strip()
        for key, val in TAJIK_CITIES_MAP.items():
            if key in clean:
                return val
        return raw_city.strip() if len(raw_city.strip()) > 0 else "г. Душанбе"

    @staticmethod
    def normalize_category(title: str, description: str, raw_category: Optional[str] = None) -> str:
        text = f"{title} {description} {raw_category or ''}".lower()
        for cat_name, keywords in CATEGORY_KEYWORDS:
            if any(k in text for k in keywords):
                return cat_name
        return raw_category.strip() if (raw_category and len(raw_category.strip()) > 0) else "Вакансии"

    @staticmethod
    def parse_salary(sal_from: Any, sal_to: Any, raw_currency: Optional[str] = None, raw_text: Optional[str] = None) -> Tuple[Optional[float], Optional[float], str]:
        s_min: Optional[float] = None
        s_max: Optional[float] = None

        if sal_from is not None:
            try:
                v = float(sal_from)
                if v > 0:
                    s_min = v
            except (ValueError, TypeError):
                pass

        if sal_to is not None:
            try:
                v = float(sal_to)
                if v > 0:
                    s_max = v
            except (ValueError, TypeError):
                pass

        # If numerical min/max absent, try parsing raw_text
        if s_min is None and s_max is None and raw_text and isinstance(raw_text, str):
            clean = raw_text.lower().replace("\xa0", " ").replace(" ", "").replace("c.", "").replace("сомони", "").replace("смн", "").replace("тјs", "")
            if not ("договорная" in clean or "ценанеуказана" in clean):
                range_match = re.search(r'(?:от)?(\d+)(?:до|-|–|—)(\d+)', clean)
                if range_match:
                    try:
                        s_min = float(range_match.group(1))
                        s_max = float(range_match.group(2))
                    except ValueError:
                        pass
                else:
                    ot_match = re.search(r'от(\d+)', clean)
                    if ot_match:
                        try:
                            s_min = float(ot_match.group(1))
                        except ValueError:
                            pass
                    do_match = re.search(r'до(\d+)', clean)
                    if do_match:
                        try:
                            s_max = float(do_match.group(1))
                        except ValueError:
                            pass
                    if s_min is None and s_max is None:
                        single_match = re.search(r'(\d+)', clean)
                        if single_match:
                            try:
                                val = float(single_match.group(1))
                                s_min = val
                                s_max = val
                            except ValueError:
                                pass

        # Currency normalization
        curr = (raw_currency or "TJS").upper()
        if any(w in curr for w in ["SOMONI", "TJS", "СОМОНИ", "СМН"]):
            curr = "TJS"
        elif any(w in curr for w in ["USD", "DOLLAR", "$"]):
            curr = "USD"
        elif any(w in curr for w in ["RUB", "RUBLE", "РУБ"]):
            curr = "RUB"
        else:
            curr = "TJS"

        return s_min, s_max, curr

    @staticmethod
    def clean_html(raw_html: Optional[str]) -> str:
        if not raw_html or not isinstance(raw_html, str):
            return ""
        text = re.sub(r'<script.*?>.*?</script>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style.*?>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</li>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'&quot;', '"', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&lt;', '<', text)
        text = re.sub(r'&gt;', '>', text)
        text = re.sub(r'&#39;', "'", text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    @staticmethod
    def parse_datetime(raw_date: Optional[Any]) -> Optional[datetime]:
        if not raw_date:
            return None
        if isinstance(raw_date, datetime):
            if raw_date.tzinfo is None:
                return raw_date.replace(tzinfo=timezone.utc)
            return raw_date
        try:
            dt = date_parser.parse(str(raw_date))
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return datetime.now(timezone.utc)

    @staticmethod
    def compute_job_group_id(title: str, company: str, city: str) -> str:
        clean_t = re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', title.lower())
        clean_c = re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', company.lower())
        clean_l = re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', city.lower())
        payload = f"{clean_t}:{clean_c}:{clean_l}"
        return hashlib.md5(payload.encode('utf-8')).hexdigest()[:16]
