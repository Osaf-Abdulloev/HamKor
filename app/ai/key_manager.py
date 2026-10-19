import os
import random
import logging
import httpx
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def clean_reasoning_tags(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    cleaned = re.sub(r'<think>.*', '', cleaned, flags=re.DOTALL)
    return cleaned.strip()

def get_all_groq_keys() -> List[str]:
    """
    Extracts all GROQ_API_KEY_1..20 keys from environment variables and .env.
    """
    keys = []
    # Check numbered keys GROQ_API_KEY_1 to GROQ_API_KEY_30
    for i in range(1, 31):
        k = os.getenv(f"GROQ_API_KEY_{i}")
        if k and k.strip() and k.strip() not in keys:
            keys.append(k.strip())
            
    # Check default single GROQ_API_KEY
    k_default = os.getenv("GROQ_API_KEY")
    if k_default and k_default.strip() and k_default.strip() not in keys:
        keys.append(k_default.strip())

    return keys


def get_all_gemini_keys() -> List[str]:
    """
    Extracts all GEMINI_API_KEY_1..20 keys from environment variables and .env.
    """
    keys = []
    for i in range(1, 31):
        k = os.getenv(f"GEMINI_API_KEY_{i}")
        if k and k.strip() and k.strip() not in keys:
            keys.append(k.strip())
            
    k_default = os.getenv("GEMINI_API_KEY")
    if k_default and k_default.strip() and k_default.strip() not in keys:
        keys.append(k_default.strip())

    return keys

class AIKeyManager:
    """
    Central AI Failover Manager supporting round-robin rotation across 20+ Groq and 20+ Gemini keys.
    Automatically retries with the next key if any key returns rate limits (429), quota errors, or network errors.
    """

    @staticmethod
    async def generate_completion(
        messages: List[Dict[str, str]],
        json_mode: bool = False,
        temperature: float = 0.5,
        max_tokens: int = 2000
    ) -> Optional[str]:
        # 1. Try Groq API keys first with active 2026 model list
        groq_keys = get_all_groq_keys()
        random.shuffle(groq_keys)
        groq_models = ["qwen/qwen3.6-27b", "groq/compound", "openai/gpt-oss-20b"]

        url_groq = "https://api.groq.com/openai/v1/chat/completions"
        for idx, api_key in enumerate(groq_keys):
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            for model_name in groq_models:
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                try:
                    async with httpx.AsyncClient(timeout=12.0) as client:
                        resp = await client.post(url_groq, json=payload, headers=headers)
                        if resp.status_code == 200:
                            data = resp.json()
                            content = data["choices"][0]["message"]["content"]
                            if content and content.strip():
                                cleaned = clean_reasoning_tags(content)
                                if cleaned:
                                    return cleaned
                        else:
                            logger.warning(f"[Groq Key #{idx+1} Model {model_name} Error {resp.status_code}]: {resp.text[:150]}")
                except Exception as e:
                    logger.warning(f"[Groq Key #{idx+1} Model {model_name} Exception]: {e}")
                    continue

        # 2. Failover to Gemini API keys if Groq keys are exhausted
        gemini_keys = get_all_gemini_keys()
        random.shuffle(gemini_keys)
        gemini_models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"]

        for idx, api_key in enumerate(gemini_keys):
            for model_name in gemini_models:
                url_gemini = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                
                # Format messages for Gemini API
                gemini_contents = []
                sys_instruction = None
                for m in messages:
                    if m["role"] == "system":
                        sys_instruction = {"parts": [{"text": m["content"]}]}
                    else:
                        role_str = "user" if m["role"] == "user" else "model"
                        gemini_contents.append({"role": role_str, "parts": [{"text": m["content"]}]})

                payload = {
                    "contents": gemini_contents,
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_tokens
                    }
                }
                if sys_instruction:
                    payload["systemInstruction"] = sys_instruction
                if json_mode:
                    payload["generationConfig"]["responseMimeType"] = "application/json"

                try:
                    async with httpx.AsyncClient(timeout=12.0) as client:
                        resp = await client.post(url_gemini, json=payload, headers={"Content-Type": "application/json"})
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            if candidates and "content" in candidates[0]:
                                parts = candidates[0]["content"].get("parts", [])
                                if parts and "text" in parts[0]:
                                    text = parts[0]["text"]
                                    if text and text.strip():
                                        cleaned = clean_reasoning_tags(text)
                                        if cleaned:
                                            return cleaned
                        else:
                            logger.warning(f"[Gemini Key #{idx+1} Model {model_name} Error {resp.status_code}]: {resp.text[:150]}")
                except Exception as e:
                    logger.warning(f"[Gemini Key #{idx+1} Model {model_name} Exception]: {e}")
                    continue

        return None
