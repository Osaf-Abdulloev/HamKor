import asyncio
import argparse
import logging
import sys
from typing import Dict, Any

from app.database.session import AsyncSessionLocal
from app.services.yora_parser import YoraParserService
from app.services.somon_parser import SomonParserService

# Configure clean console logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("import_jobs_cli")

async def run_import(source: str, mode: str, max_pages: int = None) -> Dict[str, Any]:
    full_import = (mode.lower() == "full")
    results = {}

    async with AsyncSessionLocal() as session:
        if source in ["yora", "all"]:
            logger.info(f"Starting Yora.tj import (mode={mode}, max_pages={max_pages})...")
            yora_service = YoraParserService(session)
            yora_stats = await yora_service.fetch_and_sync(
                max_pages=max_pages,
                full_import=full_import
            )
            results["yora"] = yora_stats
            print("\n" + "="*50)
            print(" YORA.TJ IMPORT SUMMARY")
            print("="*50)
            print(f" Source:           {yora_stats.get('source')}")
            print(f" Pages Processed:  {yora_stats.get('pages_processed')}")
            print(f" Total Found:      {yora_stats.get('total_found')}")
            print(f" Total Fetched:    {yora_stats.get('total_fetched')}")
            print(f" Created:          {yora_stats.get('created')}")
            print(f" Updated:          {yora_stats.get('updated')}")
            print(f" Deactivated:      {yora_stats.get('deactivated')}")
            print(f" Errors:           {yora_stats.get('errors')}")
            print("="*50 + "\n")

        if source in ["somon", "all"]:
            logger.info(f"Starting Somon.tj import (mode={mode}, max_pages={max_pages})...")
            somon_service = SomonParserService(session)
            somon_stats = await somon_service.fetch_and_sync(
                max_pages=max_pages,
                full_import=full_import
            )
            results["somon"] = somon_stats
            print("\n" + "="*50)
            print(" SOMON.TJ IMPORT SUMMARY")
            print("="*50)
            print(f" Source:           {somon_stats.get('source')}")
            print(f" Pages Processed:  {somon_stats.get('pages_processed')}")
            print(f" Total Found:      {somon_stats.get('total_found')}")
            print(f" Total Fetched:    {somon_stats.get('total_fetched')}")
            print(f" Created:          {somon_stats.get('created')}")
            print(f" Updated:          {somon_stats.get('updated')}")
            print(f" Deactivated:      {somon_stats.get('deactivated')}")
            print(f" Errors:           {somon_stats.get('errors')}")
            print("="*50 + "\n")

    return results

def main():
    parser = argparse.ArgumentParser(description="HamKor Vacancy Importer CLI")
    parser.add_argument("--source", type=str, choices=["yora", "somon", "all"], default="all", help="Source to import")
    parser.add_argument("--mode", type=str, choices=["full", "update"], default="full", help="Import mode (full or update)")
    parser.add_argument("--max-pages", type=int, default=None, help="Maximum pages to process")

    args = parser.parse_args()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run_import(args.source, args.mode, args.max_pages))
    finally:
        loop.close()

if __name__ == "__main__":
    main()
