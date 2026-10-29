"""
AI tutor: i+1 conversation (Krashen's comprehensible input).

Each tutor message may use known lemmas (any inflection or clitic) plus one new lemma from
the most frequent unknown ones. The LLM is asked to obey that, then every reply is checked
by lemmatizing it with Camelira; violations are sent back for a rewrite, and the best
attempt is what reaches the learner.
"""
import json
import os
import re
import urllib.error
import urllib.request
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from .extensions import db
from .models import Lemma, Word, Sentence, WordInstance, prune, find_lemma
from .routes import lemmatize, clean_punctuation, lemma_json, update_sentence_completeness

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

tutor = Blueprint('tutor', __name__)

# (chat completions URL, model, key variable); Gemini goes through its OpenAI-compatible endpoint
OPENAI = ('https://api.openai.com/v1/chat/completions', 'gpt-5.4-mini', 'OPENAI_API_KEY')
GEMINI = ('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-3.6-flash', 'GEMINI_API_KEY')
NEW_WORD_CHOICES = 50
MAX_ATTEMPTS = 3
ARABIC = re.compile(r'[؀-ۿ]')

SYSTEM_PROMPT = """You are an Arabic conversation partner for a learner, following Krashen's comprehensible input hypothesis (i+1).
Speak Modern Standard Arabic without diacritics. Keep each message short: one or two simple sentences. Stay in character for the scenario and keep the conversation moving, e.g. by asking the learner something.

Vocabulary rules, which are strict:
- Use only words whose lemma is in KNOWN. Any inflection is fine (conjugation, gender, number, case), as are attached clitics (و ف ب ل ك س ال and pronoun suffixes).
- In every message also use exactly one lemma from NEW (any inflection), picking whichever fits naturally. Never use more than one NEW lemma in a message.
- No other words: no names, loanwords, or numbers written as words unless their lemma is in KNOWN.
- If the learner writes in English or makes mistakes, carry on in Arabic.

Reply with a JSON object: {"arabic": "<your message>", "english": "<faithful English translation>"}

KNOWN: {known}

NEW (lemma: meaning): {new}"""

OPENING_PROMPT = """Start a new conversation. Invent a short everyday scenario or roleplay for the learner, chosen so one NEW lemma fits naturally, and open it in character.
Reply with a JSON object: {"scenario": "<one English sentence setting the scene, addressed to the learner, e.g. You're in a coffee shop and a stranger sits at your table.>", "arabic": "<your opening line>", "english": "<translation>"}"""

def ask_llm(messages):
    gemini_key = os.getenv('GEMINI_API_KEY', '')
    url, model, key_var = GEMINI if gemini_key and not gemini_key.startswith('your_') else OPENAI
    body = {'model': model, 'messages': messages}
    if key_var == 'OPENAI_API_KEY':
        body['response_format'] = {'type': 'json_object'}
    req = urllib.request.Request(
        url, json.dumps(body).encode(),
        {'Content-Type': 'application/json', 'Authorization': f"Bearer {os.environ[key_var]}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            content = json.load(res)['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        err = json.load(e)
        err = err[0] if isinstance(err, list) else err  # Gemini wraps errors in a list
        raise RuntimeError(err['error']['message']) from e  # e.g. "You have no credits remaining..."
    # The JSON object, without any ```json fence around it (Gemini runs without JSON mode)
    return json.loads(re.search(r'\{.*\}', content, re.S).group())

def lemma_for(analysis):
    """Lexicon row for a Camelira analysis, preferring a known row among same-spelled homographs."""
    gloss = re.sub(r'_\[\w+\]', '', analysis.get('stemgloss', ''))
    lemma = find_lemma(analysis.get('lex', ''), gloss)
    if lemma and not lemma.known:
        lemma = Lemma.query.filter_by(plaintext=lemma.plaintext, known=True).first() or lemma
    return lemma

def check(arabic, known, new):
    """Tokens (with lemmas) of a reply, plus the words breaking the i+1 rules."""
    analyses = lemmatize(arabic)
    tokens, violations, new_used = [], [], set()
    for raw in arabic.split():
        word = clean_punctuation(raw)
        lemma = lemma_for(analyses[word]) if word in analyses else None
        tokens.append({'text': raw, 'lemma': lemma_json(lemma) if lemma else None})
        if not ARABIC.search(word) or (lemma and lemma.plaintext in known):
            continue
        if lemma and lemma.plaintext in new and (not new_used or lemma.plaintext in new_used):
            new_used.add(lemma.plaintext)
            continue
        violations.append(f"{word} (lemma {lemma.plaintext})" if lemma else word)
    return tokens, violations

@tutor.route('/api/tutor', methods=['POST'])
def tutor_reply():
    """Next tutor message. Body: {scenario, messages: [{role: 'tutor'|'user', arabic|text, english}]}; no messages = new chat."""
    data = request.get_json()
    history = data.get('messages', [])

    known = {l.plaintext for l in Lemma.query.filter_by(known=True)}
    candidates = Lemma.query.filter_by(known=False).order_by(Lemma.lemma_id).limit(NEW_WORD_CHOICES).all()
    new = {l.plaintext for l in candidates}
    new_list = '; '.join(f"{l.plaintext}: {(l.translation or '').split('#')[0].replace('_', ' ')}" for l in candidates)

    system = SYSTEM_PROMPT.replace('{known}', '، '.join(sorted(known))).replace('{new}', new_list)
    if data.get('scenario'):
        system += f"\n\nSCENARIO: {data['scenario']}"
    messages = [{'role': 'system', 'content': system}]
    for m in history:
        if m['role'] == 'tutor':
            messages.append({'role': 'assistant', 'content': json.dumps({'arabic': m['arabic'], 'english': m['english']}, ensure_ascii=False)})
        else:
            messages.append({'role': 'user', 'content': m['text']})
    if not history:
        messages.append({'role': 'user', 'content': OPENING_PROMPT})

    try:
        best = None
        for attempt in range(MAX_ATTEMPTS):
            try:
                reply = ask_llm(messages)
                tokens, violations = check(reply['arabic'], known, new)
            except Exception:
                if best:
                    break  # a failed rewrite still leaves an earlier attempt to show
                raise
            print(f"Tutor attempt {attempt + 1}: {reply['arabic']} | violations: {violations}")
            if best is None or len(violations) < len(best[2]):
                best = (reply, tokens, violations)
            if not violations:
                break
            messages += [
                {'role': 'assistant', 'content': json.dumps(reply, ensure_ascii=False)},
                {'role': 'user', 'content': f"Not allowed: {', '.join(violations)}. Rewrite your message with the same intent, "
                                            "using only KNOWN lemmas plus at most one NEW lemma. Same JSON format."},
            ]
        reply, tokens, _ = best
        return jsonify({'scenario': reply.get('scenario') or data.get('scenario'), 'arabic': reply['arabic'],
                        'english': reply['english'], 'tokens': tokens})
    except Exception as e:
        print(f"Tutor Error: {e}")
        return jsonify({'error': str(e)}), 502

@tutor.route('/api/tutor/flashcard', methods=['POST'])
def tutor_flashcard():
    """Saves a tutor message as a sentence, linking each token to the lemma the tutor's analysis found."""
    data = request.get_json()
    try:
        sentence = Sentence(plaintext=data['arabic'], translation=data['english'], length=len(data['arabic'].split()))
        db.session.add(sentence)
        db.session.flush()
        for index, token in enumerate(data['tokens']):
            text = clean_punctuation(token['text'])
            lemma_id = (token.get('lemma') or {}).get('lemma_id')
            if not text or not lemma_id:
                continue
            word = Word.query.filter_by(plaintext=text, lemma_id=lemma_id).first()
            if not word:
                word = Word(plaintext=text, lemma_id=lemma_id, prune=prune(text))
                db.session.add(word)
                db.session.flush()
            db.session.add(WordInstance(sentence_id=sentence.sentence_id, word_id=word.word_id, index=index))
        db.session.flush()
        update_sentence_completeness(sentence)
        db.session.commit()
        return jsonify({'success': True, 'sentence_id': sentence.sentence_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
