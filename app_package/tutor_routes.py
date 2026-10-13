"""Tutor API routes using the existing project database."""

import unicodedata

from flask import jsonify, request, current_app

from .extensions import db
from .models import Sentence, Word, Root, WordInstance, Flashcard

from .tutor_service import (
    TutorError,
    generate_tutor_reply,
    normalize_word,
    provider_config,
)


def resolve_word(text, words):
    """
    Find an exact word first.
    Otherwise, use a unique match without vowel marks.
    Do not guess when multiple records match.
    """
    clean = "".join(
        character
        for character in text
        if not unicodedata.category(character).startswith(
            ("P", "S")
        )
    ).strip()

    exact = [
        word
        for word in words
        if word.plaintext == clean
    ]

    if len(exact) == 1:
        return exact[0]

    normalized = normalize_word(clean)

    matches = [
        word
        for word in words
        if normalize_word(word.plaintext) == normalized
    ]

    if normalized and len(matches) == 1:
        return matches[0]

    return None


def register_tutor_routes(main, calculate_completeness):

    @main.route(
        "/api/tutor/words/<int:word_id>/known",
        methods=["PUT"],
    )
    def tutor_set_known(word_id):
        data = request.get_json(silent=True)

        if (
            not isinstance(data, dict)
            or not isinstance(data.get("known"), bool)
        ):
            return jsonify(
                {"error": "known must be true or false."}
            ), 400

        word = db.session.get(Word, word_id)

        if word is None:
            return jsonify(
                {"error": "Word not found."}
            ), 404

        try:
            word.known = data["known"]
            db.session.commit()

            return jsonify(
                {
                    "success": True,
                    "new_known": word.known,
                }
            )

        except Exception:
            db.session.rollback()

            return jsonify(
                {"error": "Could not update word status."}
            ), 500

    @main.route("/api/tutor/status")
    def tutor_status():
        try:
            provider, _, model = provider_config()

            return jsonify(
                {
                    "configured": True,
                    "provider": provider,
                    "model": model,
                }
            )

        except TutorError as exc:
            return jsonify(
                {
                    "configured": False,
                    "message": str(exc),
                }
            )

    @main.route(
        "/api/tutor/chat",
        methods=["POST"],
    )
    def tutor_chat():
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify(
                {"error": "Send a JSON object."}
            ), 400

        message = data.get("message")
        history = data.get("history", [])

        if (
            not isinstance(message, str)
            or not message.strip()
            or len(message) > 4000
        ):
            return jsonify(
                {
                    "error":
                        "Enter a message of 1–4000 characters."
                }
            ), 400

        if (
            not isinstance(history, list)
            or len(history) > 100
        ):
            return jsonify(
                {"error": "Invalid conversation history."}
            ), 400

        cleaned = []

        for item in history:
            if (
                not isinstance(item, dict)
                or item.get("role")
                not in ("user", "assistant")
            ):
                return jsonify(
                    {"error": "Invalid conversation history."}
                ), 400

            content = item.get("content")

            if (
                not isinstance(content, str)
                or len(content) > 12000
            ):
                return jsonify(
                    {"error": "Invalid conversation history."}
                ), 400

            if content.strip():
                cleaned.append(
                    {
                        "role": item["role"],
                        "content": content.strip(),
                    }
                )

        cleaned = cleaned[-20:]

        try:
            known = [
                word.plaintext
                for word in Word.query.filter_by(
                    known=True
                ).all()
            ]

            reply = generate_tutor_reply(
                message.strip(),
                cleaned,
                known,
            )

            all_words = Word.query.all()

            roots = {
                root.root_id: root
                for root in Root.query.all()
            }

            for sentence in reply["sentences"]:
                glossary = {
                    normalize_word(item["word"]): item
                    for item in sentence.pop("glossary")
                }

                enriched = []

                for token in sentence["arabic"].split():
                    if not normalize_word(token):
                        enriched.append(
                            {
                                "text": token,
                                "state": "normal",
                            }
                        )
                        continue

                    match = resolve_word(
                        token,
                        all_words,
                    )

                    suggestion = glossary.get(
                        normalize_word(token),
                        {},
                    )

                    root = (
                        roots.get(match.root_id)
                        if match
                        else None
                    )

                    if match:
                        state = (
                            "known"
                            if match.known
                            else "unknown"
                        )
                    else:
                        state = "unknown"

                    meaning = (
                        match.translation
                        if match and match.translation
                        else suggestion.get("meaning", "")
                    )

                    enriched.append(
                        {
                            "text": token,
                            "word_id": (
                                match.word_id
                                if match
                                else None
                            ),
                            "state": state,
                            "meaning": meaning,
                            "transliteration": suggestion.get(
                                "transliteration",
                                "",
                            ),
                            "root": (
                                root.plaintext
                                if root
                                else suggestion.get("root", "")
                            ),
                            "source": (
                                "database"
                                if match
                                else "ai"
                            ),
                        }
                    )

                sentence["words"] = enriched

            return jsonify(reply)

        except TutorError as exc:
            return jsonify(
                {"error": str(exc)}
            ), exc.status

        except Exception:
            current_app.logger.exception(
                "Tutor request failed"
            )

            return jsonify(
                {
                    "error":
                        "The tutor could not load project data. "
                        "Check the Flask terminal."
                }
            ), 500

    @main.route(
        "/api/tutor/flashcards",
        methods=["GET"],
    )
    def tutor_flashcards_list():
        cards = Flashcard.query.join(
            Sentence,
            Flashcard.sentence_id == Sentence.sentence_id,
        ).all()

        sentences = {
            sentence.sentence_id: sentence
            for sentence in Sentence.query.all()
        }

        return jsonify(
            [
                {
                    "card_id": card.card_id,
                    "sentence_id": card.sentence_id,
                    "plaintext": sentences[
                        card.sentence_id
                    ].plaintext,
                    "translation": sentences[
                        card.sentence_id
                    ].translation,
                    "complete": sentences[
                        card.sentence_id
                    ].complete,
                    "length": sentences[
                        card.sentence_id
                    ].length,
                }
                for card in cards
            ]
        )

    @main.route(
        "/api/tutor/flashcards",
        methods=["POST"],
    )
    def tutor_flashcard_create():
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify(
                {"error": "Send a JSON object."}
            ), 400

        arabic = data.get("arabic")
        translation = data.get("translation")

        if (
            not isinstance(arabic, str)
            or not arabic.strip()
            or len(arabic) > 1500
            or not normalize_word(arabic)
        ):
            return jsonify(
                {"error": "A full Arabic sentence is required."}
            ), 400

        if (
            not isinstance(translation, str)
            or not translation.strip()
            or len(translation) > 2000
        ):
            return jsonify(
                {"error": "An English translation is required."}
            ), 400

        arabic = " ".join(arabic.split())
        translation = translation.strip()

        try:
            sentence = Sentence.query.filter_by(
                plaintext=arabic,
                translation=translation,
            ).first()

            if not sentence:
                sentence = Sentence(
                    plaintext=arabic,
                    translation=translation,
                    length=len(arabic.split()),
                    complete=False,
                )

                db.session.add(sentence)
                db.session.flush()

            words = Word.query.all()

            for index, token in enumerate(arabic.split()):
                existing = WordInstance.query.filter_by(
                    sentence_id=sentence.sentence_id,
                    index=index,
                ).first()

                if existing:
                    continue

                match = resolve_word(token, words)

                if match:
                    db.session.add(
                        WordInstance(
                            sentence_id=sentence.sentence_id,
                            word_id=match.word_id,
                            index=index,
                        )
                    )

            db.session.flush()

            sentence.complete = calculate_completeness(
                sentence
            )

            card = Flashcard.query.filter_by(
                sentence_id=sentence.sentence_id
            ).first()

            created = card is None

            if created:
                card = Flashcard(
                    sentence_id=sentence.sentence_id,
                    plaintext=arabic,
                    translation=translation,
                )

                db.session.add(card)

            db.session.commit()

            return jsonify(
                {
                    "success": True,
                    "created": created,
                    "card_id": card.card_id,
                    "sentence_id": sentence.sentence_id,
                    "complete": sentence.complete,
                }
            ), 201 if created else 200

        except Exception:
            db.session.rollback()

            current_app.logger.exception(
                "Tutor flashcard save failed"
            )

            return jsonify(
                {
                    "error":
                        "Could not save the flashcard. "
                        "Check the database setup "
                        "in the Flask terminal."
                }
            ), 500