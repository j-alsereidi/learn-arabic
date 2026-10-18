import os
from pathlib import Path

from flask import abort, jsonify, send_from_directory

from app_package import create_app


ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "frontend" / "build"

if not (BUILD / "index.html").is_file():
    raise RuntimeError(
        "Build the frontend before starting this server."
    )

if os.getenv("RENDER") == "true":
    for name in (
        "DATABASE_URL",
        "SECRET_KEY",
        "RENDER_EXTERNAL_URL",
    ):
        if not os.getenv(name):
            raise RuntimeError(
                f"Missing server environment variable: {name}"
            )

    os.environ.setdefault(
        "FRONTEND_ORIGIN",
        os.environ["RENDER_EXTERNAL_URL"],
    )

    os.environ["COOKIE_SECURE"] = "true"


app = create_app()

app.static_folder = str(BUILD / "static")


def frontend_home():
    response = send_from_directory(
        str(BUILD),
        "index.html",
    )
    response.headers["Cache-Control"] = "no-cache"
    return response


if "main.home" not in app.view_functions:
    raise RuntimeError(
        "Expected the main.home route in app_package/routes.py."
    )

app.view_functions["main.home"] = frontend_home


@app.get("/healthz")
def health():
    return jsonify(status="ok")


@app.get("/<path:filename>")
def frontend_asset(filename):
    # Only serve public frontend build files.
    if any(
        part.startswith(".")
        for part in filename.split("/")
    ):
        abort(404)

    if filename.split("/", 1)[0] in {"api", "static"}:
        abort(404)

    response = send_from_directory(
        str(BUILD),
        filename,
    )
    response.headers["Cache-Control"] = "no-cache"
    return response