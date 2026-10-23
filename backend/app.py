
import os
import shutil
import tempfile
import logging
import subprocess
from pathlib import Path

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from pdf2docx import Converter
from werkzeug.utils import secure_filename
from pypdf import PdfReader, PdfWriter
from flask import request, send_file, jsonify
import io

app = Flask(__name__)

# Maximum upload size: 50 MB
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://quicktools-roan.vercel.app",
            ]
        }
    },
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Find LibreOffice on this PC or on the deployed server.
def find_libreoffice():
    configured_path = os.environ.get("LIBREOFFICE_PATH")

    if configured_path and os.path.isfile(configured_path):
        return configured_path

    office = shutil.which("soffice") or shutil.which("libreoffice")

    if office:
        return office

    candidates = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]

    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate

    return None


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "QuickTools document converter",
    })


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "error": "The file is too large. Maximum size is 50 MB."
    }), 413


@app.post("/api/pdf-to-word")
def pdf_to_word():
    uploaded = request.files.get("file")

    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Please upload a PDF file."}), 400

    safe_filename = secure_filename(uploaded.filename)

    if not safe_filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported."}), 400

    temp_dir = tempfile.mkdtemp(prefix="quicktools-pdf-word-")
    input_path = os.path.join(temp_dir, "input.pdf")
    output_path = os.path.join(temp_dir, "converted.docx")

    try:
        uploaded.save(input_path)

        if os.path.getsize(input_path) == 0:
            return jsonify({"error": "The uploaded PDF is empty."}), 400

        with open(input_path, "rb") as pdf_file:
            if pdf_file.read(5) != b"%PDF-":
                return jsonify({
                    "error": "This file is not a valid PDF."
                }), 400

        logger.info("Starting PDF-to-Word conversion")

        converter = Converter(input_path)

        try:
            converter.convert(
                output_path,
                start=0,
                end=None,
                pages=None,
                multi_processing=False,
            )
        finally:
            converter.close()

        if (
            not os.path.isfile(output_path)
            or os.path.getsize(output_path) == 0
        ):
            raise RuntimeError("PDF-to-Word output is missing or empty.")

        download_name = (
            f"{Path(safe_filename).stem or 'converted'}.docx"
        )

        response = send_file(
            output_path,
            mimetype=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
            as_attachment=True,
            download_name=download_name,
            conditional=False,
        )

        response.call_on_close(
            lambda: shutil.rmtree(temp_dir, ignore_errors=True)
        )
        return response

    except Exception:
        logger.exception("PDF-to-Word conversion failed")
        shutil.rmtree(temp_dir, ignore_errors=True)

        return jsonify({
            "error": (
                "Conversion failed. The PDF may be damaged, encrypted, "
                "scanned, or contain an unsupported layout."
            )
        }), 422


@app.post("/api/convert/word-to-pdf")
def word_to_pdf():
    uploaded = request.files.get("file")

    if not uploaded or not uploaded.filename:
        return jsonify({
            "error": "Please upload a Word document."
        }), 400

    safe_filename = secure_filename(uploaded.filename)

    if not safe_filename.lower().endswith(".docx"):
        return jsonify({
            "error": "Only .docx Word documents are supported."
        }), 400

    temp_dir = tempfile.mkdtemp(prefix="quicktools-word-pdf-")
    input_path = os.path.join(temp_dir, safe_filename)
    output_path = os.path.join(
        temp_dir,
        Path(safe_filename).stem + ".pdf",
    )

    try:
        uploaded.save(input_path)

        if os.path.getsize(input_path) == 0:
            return jsonify({"error": "The Word document is empty."}), 400

        # Check that the file has the basic signature of a DOCX ZIP package.
        with open(input_path, "rb") as source:
            if source.read(4) != b"PK\x03\x04":
                return jsonify({
                    "error": "This file is not a valid DOCX document."
                }), 400

        office = find_libreoffice()

        if not office:
            logger.error("LibreOffice executable could not be found.")
            return jsonify({
                "error": (
                    "LibreOffice could not be found on the conversion "
                    "server. Check its installation and configuration."
                )
            }), 503

        logger.info("Starting Word-to-PDF conversion using %s", office)

        # Use a separate LibreOffice profile for this conversion.
        profile_dir = os.path.join(temp_dir, "lo-profile")
        os.makedirs(profile_dir, exist_ok=True)
        profile_uri = Path(profile_dir).resolve().as_uri()

        result = subprocess.run(
            [
                office,
                "-env:UserInstallation=" + profile_uri,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                temp_dir,
                input_path,
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )

        if result.stdout:
            logger.info("LibreOffice output: %s", result.stdout)

        if result.stderr:
            logger.info("LibreOffice messages: %s", result.stderr)

        if (
            result.returncode != 0
            or not os.path.isfile(output_path)
            or os.path.getsize(output_path) == 0
        ):
            logger.error(
                "Word-to-PDF conversion failed. Return code: %s",
                result.returncode,
            )
            return jsonify({
                "error": (
                    "Conversion failed. Check that the Word document "
                    "can be opened and try again."
                )
            }), 422

        with open(output_path, "rb") as converted:
            if converted.read(5) != b"%PDF-":
                return jsonify({
                    "error": "The converter did not produce a valid PDF."
                }), 500

        response = send_file(
            output_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=Path(safe_filename).stem + ".pdf",
            conditional=False,
        )

        response.call_on_close(
            lambda: shutil.rmtree(temp_dir, ignore_errors=True)
        )
        return response

    except subprocess.TimeoutExpired:
        logger.warning("Word-to-PDF conversion timed out.")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({
            "error": "Conversion timed out. Try a smaller document."
        }), 408

    except Exception:
        logger.exception("Word-to-PDF conversion failed")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({
            "error": "An unexpected error occurred during conversion."
        }), 500


@app.route("/api/rotate-pdf", methods=["POST"])
def rotate_pdf():
    if "file" not in request.files:
        return jsonify({"error": "Please upload a PDF file."}), 400

    uploaded_file = request.files["file"]

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a valid PDF file."}), 400

    try:
        rotation = int(request.form.get("rotation", 90))

        if rotation not in (90, 180, 270):
            return jsonify({
                "error": "Rotation must be 90, 180, or 270 degrees."
            }), 400

        reader = PdfReader(uploaded_file.stream)

        if reader.is_encrypted:
            return jsonify({
                "error": "Password-protected PDFs are not supported yet."
            }), 400

        if len(reader.pages) == 0:
            return jsonify({"error": "This PDF has no pages."}), 400

        writer = PdfWriter()

        for page in reader.pages:
            page.rotate(rotation)
            writer.add_page(page)

        output = io.BytesIO()
        writer.write(output)
        output.seek(0)

        return send_file(
            output,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="quicktools-rotated.pdf"
        )

    except Exception:
        app.logger.exception("Rotate PDF failed")
        return jsonify({
            "error": "Could not rotate this PDF. Please check the file and try again."
        }), 400


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
    )
