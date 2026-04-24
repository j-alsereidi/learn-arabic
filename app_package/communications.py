# app_package/communications.py

from typing import List, Optional, Dict, Any
import os
import re
from dotenv import load_dotenv
from simple_llm_api import OpenAIAPI, GeminiAPI

load_dotenv()

ARABIC_WORD_RE = re.compile(r"[\u0600-\u06FF]+")

def _tokenize_arabic(text: str) -> List[str]:
    """
    Very simple Arabic tokenization:
    extracts sequences of Arabic letters (ignores punctuation/latin).
    """
    return ARABIC_WORD_RE.findall(text)

def simulate_gen(
    allowed_words: List[str],
    new_word: Optional[str] = None,
    max_allowed_words_used: int = 8,
) -> Dict[str, Any]:
    """
    Option C PoC:
    - Generates a simple sentence using ONLY a whitelist of allowed words (+ optional new_word)
    - Validates output tokens against the whitelist
    - Returns tokens + violations as simulated "constraint enforcement"
    """

    allowed_words = [w.strip() for w in (allowed_words or []) if isinstance(w, str) and w.strip()]
    allowed_set = set(allowed_words)

    used_new_word = False

    # ---- "Generation" (PoC) ----
    # For SDP-I, it's acceptable to mock the LLM and still enforce constraints.
    if not allowed_words and not new_word:
        text = "Hello world!"
    else:
        tokens = []

        # use some allowed words (up to the limit)
        tokens.extend(allowed_words[:max_allowed_words_used])


        # optionally introduce exactly one "new_word" (i+1)
        if new_word and isinstance(new_word, str) and new_word.strip():
            tokens.append(new_word.strip())
            used_new_word = True

        # fallback if somehow empty
        if not tokens:
            text = "Hello world!"
        else:
            text = " ".join(tokens)

    # ---- Constraint check ----
    output_tokens = _tokenize_arabic(text)
    violations = []

    # For PoC: allow either allowed_words OR the one new_word
    for t in output_tokens:
        if (t not in allowed_set) and (not (new_word and t == new_word.strip())):
            violations.append(t)

    return {
        "text": text,
        "tokens": output_tokens,
        "used_new_word": used_new_word,
        "violations": violations
    }

def openai_response(
    known_words: List[str],
    max_allowed_words_used: int = 8, # for simulate_gen fallback
) -> Dict[str, Any]:
    """
    Generates a sentence using an LLM with constraints on allowed words.
    Falls back to a simulated generator if no API key is set.
    """

    openai_api_key = os.getenv("OPENAI_API_KEY")

    if not openai_api_key:
        # No API key set: use simulated generator
        return simulate_gen(known_words, new_word=None, max_allowed_words_used=max_allowed_words_used)

    # Real LLM generation with simple-llm-api
    client = OpenAIAPI(api_key=openai_api_key, model="gpt-3.5-turbo")

    prompt_parts = [
        "You're a comprehensible input generator for Arabic language acquisition. ",
        "Generate a simple Arabic sentence using ONLY words from the following retrieved list:",
        ", ".join(known_words) if known_words else "(no allowed words)",
    ]
    prompt_parts.append(f"Aside from one new word from outside that list to meet the i+1 condition.")
    prompt_parts.append("Do not use any other words.")
    prompt = "\n".join(prompt_parts)
    
    response = client.simple_request(user_prompt=prompt, max_tokens=50, n=1, stop=None, temperature=0.7)
    
    text = response.choices[0].text.strip()
    output_tokens = _tokenize_arabic(text)
    violations = []
    used_new_word = False
    allowed_set = set(known_words)

    for t in output_tokens:
        if t not in allowed_set:
            violations.append(t)
            used_new_word = True
    
    return {
        "text": text,
        "tokens": output_tokens,
        "used_new_word": used_new_word,
        "violations": violations
    }

def gemini_response(
    known_words: List[str],
    max_allowed_words_used: int = 8, # for simulate_gen fallback
) -> Dict[str, Any]:
    """
    Exactly the same as openai_response, but for Gemini.
    """

    gemini_api_key = os.getenv("GEMINI_API_KEY")

    if not gemini_api_key:
        # No API key set: use simulated generator
        return simulate_gen(known_words, new_word=None, max_allowed_words_used=max_allowed_words_used)
    
    # Real LLM generation with simple-llm-api
    # client = GeminiAPI(api_key=gemini_api_key, model="gemini-2.0-flash")
    client = GeminiAPI(api_key=gemini_api_key, model="gemini-2.5-flash-lite")

    prompt_parts = [
        "You're a comprehensible input generator for Arabic language acquisition. ",
        "Generate a simple Arabic sentence using ONLY words from the following retrieved list:",
        ", ".join(known_words) if known_words else "(no allowed words)",
    ]
    prompt_parts.append(f"Aside from one new word from outside that list to meet the i+1 condition.")
    prompt_parts.append("Do not use any other words.")
    prompt = "\n".join(prompt_parts)

    response = client.simple_request(user_prompt=prompt)

    text = response.strip()
    output_tokens = _tokenize_arabic(text)
    violations = []
    used_new_word = False
    allowed_set = set(known_words)

    for t in output_tokens:
        if t not in allowed_set:
            violations.append(t)
            used_new_word = True

    return {
        "text": text,
        "tokens": output_tokens,
        "used_new_word": used_new_word,
        "violations": violations
    }