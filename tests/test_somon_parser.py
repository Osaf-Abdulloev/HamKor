import re
import pytest
from app.services.somon_parser import (
    parse_somon_salary,
    map_somon_employment_type,
    detect_somon_category,
    SomonParserService
)
from app.models.enums import EmploymentType

def test_parse_somon_salary():
    min_val, max_val, curr = parse_somon_salary("2 500c.")
    assert min_val == 2500.0
    assert max_val == 2500.0
    assert curr == "TJS"

    min_val, max_val, curr = parse_somon_salary("3 000 – 6 000 c.")
    assert min_val == 3000.0
    assert max_val == 6000.0

    min_val, max_val, curr = parse_somon_salary("от 4 000 c.")
    assert min_val == 4000.0
    assert max_val is None

    min_val, max_val, curr = parse_somon_salary("Договорная")
    assert min_val is None
    assert max_val is None

def test_map_somon_employment_type():
    assert map_somon_employment_type("Разработчик", "Работа дистанционно") == EmploymentType.REMOTE
    assert map_somon_employment_type("Продавец", "Сменный график 2 через 2") == EmploymentType.PART_TIME
    assert map_somon_employment_type("Инженер", "Полный рабочий день") == EmploymentType.FULL_TIME

def test_detect_somon_category():
    assert detect_somon_category("Python Developer", "Разработка веб приложений") == "IT & Технологии"
    assert detect_somon_category("Главный Бухгалтер", "Расчет налогов") == "Финансы и банки"
    assert detect_somon_category("Торговый представитель", "Продажи товаров") == "Торговля & Продажи"

@pytest.mark.asyncio
async def test_somon_parser_service_mock(db_session, httpx_mock):
    httpx_mock.add_response(
        url=re.compile(r"https://somon\.tj/vakansii/.*"),
        is_reusable=True,
        text="""
        <html>
            <body>
                <a href="/adv/99988877_test_job_somon/">Тестовая Вакансия Somon</a>
                <a href="/vakansii/?page=1">1</a>
            </body>
        </html>
        """
    )
    httpx_mock.add_response(
        url="https://somon.tj/adv/99988877_test_job_somon/",
        is_reusable=True,
        text="""
        <html>
            <body>
                <h1 class="announcement-title">Программист Python Somon</h1>
                <div class="announcement-price">5 000c.</div>
                <div class="announcement-description">Разработка веб-сервисов на FastAPI в Душанбе.</div>
                <div class="announcement-author__name">ООО ИТ Солюшнс</div>
            </body>
        </html>
        """
    )

    parser = SomonParserService(db_session)
    stats = await parser.fetch_and_sync(max_pages=1, delay_seconds=0.0, full_import=False)

    assert stats["total_fetched"] == 1
    assert stats["created"] == 1
    assert stats["errors"] == 0

@pytest.mark.asyncio
async def test_sync_somon_jobs_api_endpoint(client, httpx_mock):
    httpx_mock.add_response(
        url=re.compile(r"https://somon\.tj/vakansii/.*"),
        is_reusable=True,
        text="""
        <html>
            <body>
                <a href="/adv/11223344_buhgalter_somon/">Бухгалтер Somon</a>
                <a href="/vakansii/?page=1">1</a>
            </body>
        </html>
        """
    )
    httpx_mock.add_response(
        url="https://somon.tj/adv/11223344_buhgalter_somon/",
        is_reusable=True,
        text="""
        <html>
            <body>
                <h1 class="announcement-title">Главный Бухгалтер Somon</h1>
                <div class="announcement-price">6 000c.</div>
                <div class="announcement-description">Ведение бухучета в 1С.</div>
                <div class="announcement-author__name">ЗАО Банк</div>
            </body>
        </html>
        """
    )

    res = await client.post("/api/v1/jobs/sync/somon?max_pages=1&full_import=false")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["source"] == "somon.tj"
    assert data["stats"]["created"] == 1
