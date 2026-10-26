
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RotateCw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";
import PageSEO from "../components/PageSEO";

const API_URL = "https://quicktools-rmgf.onrender.com"

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function WordFileCard({ file, rotation, onRotate, onRemove, disabled }) {
  return (
    <article className="compress-pdf-card word-pdf-card">
      <div className="compress-pdf-card-preview word-pdf-card-preview">
        <span className="word-pdf-type">DOCX</span>

        <div className="word-pdf-page-wrap">
          <div
            className="word-pdf-document"
            style={{ "--word-preview-rotation": `${rotation}deg` }}
            aria-label={`Word document preview for ${file.name}`}
          >
            <div className="word-pdf-document-fold" />
            <FileText size={43} strokeWidth={1.5} />
            <strong>WORD</strong>
            <span className="word-pdf-document-line" />
            <span className="word-pdf-document-line" />
            <span className="word-pdf-document-line short" />
          </div>
        </div>

        <div className="compress-pdf-hover-actions">
          <button
            type="button"
            title="Rotate preview"
            aria-label={`Rotate preview of ${file.name}`}
            onClick={onRotate}
            disabled={disabled}
          >
            <RotateCw size={18} />
          </button>
          <button
            type="button"
            title="Remove document"
            aria-label={`Remove ${file.name}`}
            onClick={onRemove}
            disabled={disabled}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="compress-pdf-card-details">
        <span className="compress-pdf-file-icon">
          <FileText size={21} />
        </span>
        <span className="compress-pdf-file-info">
          <strong title={file.name}>{file.name}</strong>
          <small>
            {formatBytes(file.size)}
            {rotation ? " · Preview rotated" : ""}
          </small>
        </span>
      </div>
    </article>
  );
}

export default function WordToPDF() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function selectFile(fileList) {
    const selected = fileList?.[0];
    if (!selected) return;

    resetMessages();

    const isDocx =
      selected.name.toLowerCase().endsWith(".docx") &&
      (selected.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        selected.type === "" ||
        selected.type === "application/octet-stream");

    if (!isDocx) {
      setError("Please select a Word document in .docx format.");
      return;
    }

    if (!selected.size) {
      setError("The selected Word document is empty.");
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("Maximum Word document size is 50 MB.");
      return;
    }

    setFile(selected);
    setRotation(0);
  }

  function clearFile() {
    if (processing) return;

    setFile(null);
    setRotation(0);
    resetMessages();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function convertFile() {
    if (!file || processing) return;

    setProcessing(true);
    resetMessages();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/api/convert/word-to-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let message = "Conversion failed. Please try again.";

        try {
          const data = await response.json();
          if (data.error) message = data.error;
        } catch {
          // The server may return a non-JSON error response.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The converted PDF is empty.");
      }

      const signature = new TextDecoder("ascii").decode(
        new Uint8Array(await blob.slice(0, 5).arrayBuffer())
      );

      if (signature !== "%PDF-") {
        throw new Error("The server did not return a valid PDF file.");
      }

      const outputName =
        file.name.replace(/\.docx$/i, "") || "converted";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${outputName}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 30000);

      setSuccess("Your PDF has been downloaded successfully.");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot connect to the conversion server. Make sure the Python backend is running."
          : err.message || "Conversion failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="merge-page word-pdf-tool-page">
      <PageSEO
        title="Word to PDF Converter Online | QuickTools"
        description="Convert Word documents to PDF files online with QuickTools for easier sharing and consistent document formatting."
        path="/word-to-pdf"
      />
      <div className="merge-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} />
          Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <FileText size={27} />
          </div>
          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>Word to PDF</h1>
            <p>
              Convert a Word document into a PDF you can share and view
              across devices.
            </p>
          </div>
        </header>

        <section className="merge-workspace">
          <div className="compress-pdf-files-heading">
            <div>
              <h2>Your Word document</h2>
              <p>
                {file
                  ? `1 file selected · ${formatBytes(file.size)}`
                  : "Choose a Word document to get started."}
              </p>
            </div>

            {file && (
              <button
                type="button"
                className="compress-pdf-select-button"
                onClick={() => inputRef.current?.click()}
                disabled={processing}
              >
                <Plus size={19} />
                Replace document
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(event) => {
              selectFile(event.target.files);
              event.target.value = "";
            }}
          />

          {!file ? (
            <button
              type="button"
              className={`merge-dropzone${dragging ? " is-dragging" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFile(event.dataTransfer.files);
              }}
              disabled={processing}
            >
              <span className="merge-upload-icon">
                <UploadCloud size={27} />
              </span>
              <strong>Choose a Word document</strong>
              <span>Click here or drag and drop your DOCX file.</span>
              <small>DOCX files only · Maximum 50 MB</small>
            </button>
          ) : (
            <>
              <div className="compress-pdf-instruction">
                <strong>Review your document before converting.</strong>
                <span>
                  Use the card controls to rotate the preview or remove
                  the document. Rotation only affects the preview.
                </span>
              </div>

              <div className="compress-pdf-list-heading">
                <h2>Uploaded document</h2>
                <span>1 DOCX</span>
              </div>

              <div className="qt-pdf-gallery compress-pdf-grid word-pdf-grid">
                <WordFileCard
                  file={file}
                  rotation={rotation}
                  onRotate={() =>
                    setRotation((value) => (value + 90) % 360)
                  }
                  onRemove={clearFile}
                  disabled={processing}
                />
              </div>

              <button
                type="button"
                className="compress-pdf-add-another"
                onClick={() => inputRef.current?.click()}
                disabled={processing}
              >
                <Plus size={18} />
                Replace document
              </button>
            </>
          )}

          {error && (
            <div className="merge-message merge-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="merge-message merge-success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {processing && (
            <div className="word-pdf-processing" role="status">
              <LoaderCircle size={19} className="compress-spinner" />
              Converting your Word document to PDF...
            </div>
          )}

          <div className="merge-footer">
            <button
              type="button"
              className="merge-clear-button"
              onClick={clearFile}
              disabled={!file || processing}
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button"
              onClick={convertFile}
              disabled={!file || processing}
            >
              {processing ? (
                <>
                  <LoaderCircle size={18} className="merge-spinner" />
                  Converting...
                </>
              ) : (
                <>
                  <FileText size={18} />
                  Convert to PDF
                  <Download size={17} />
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <ShieldCheck size={19} />
          <span>
            <strong>Your files stay private.</strong> Your document is sent
            to your configured conversion server for processing.
          </span>
        </div>

        <section className="merge-how">
          <h2>How to convert Word to PDF</h2>
          <div className="merge-steps">
            <div>
              <span className="merge-step-number">01</span>
              <h3>Upload your document</h3>
              <p>Choose a Word document in DOCX format.</p>
            </div>
            <div>
              <span className="merge-step-number">02</span>
              <h3>Convert to PDF</h3>
              <p>Let the conversion server process your document.</p>
            </div>
            <div>
              <span className="merge-step-number">03</span>
              <h3>Download your PDF</h3>
              <p>Save the converted PDF to your device.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
