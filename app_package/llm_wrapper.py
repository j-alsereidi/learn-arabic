# app_package/llm_wrapper.py

from typing import List, Optional, Dict, Any
import re

ARABIC_WORD_RE = re.compile(r"[\u0600-\u06FF]+")

def _tokenize_arabic(text: str) -> List[str]:
    """
    Very simple Arabic tokenization:
    extracts sequences of Arabic letters (ignores punctuation/latin).
    """
    return ARABIC_WORD_RE.findall(text)

def generate_constrained_sentence(
    allowed_words: List[str],
    new_word: Optional[str] = None,
    max_allowed_words_used: int = 8,
) -> Dict[str, Any]:
    """
    Option C PoC:
    - Generates a simple sentence using ONLY a whitelist of allowed words (+ optional new_word)
    - Validates output tokens against the whitelist
    - Returns tokens + violations so you can prove "constraint enforcement" in SDP-I
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
