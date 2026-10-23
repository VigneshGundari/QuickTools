import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  ShieldCheck,
  UploadCloud,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import PDFPreview from "../components/PDFPreview";

const API_URL = (
  import.meta.env.VITE_PDF_TO_WORD_API || ""
).replace(/\/+$/, "");

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PDFToWord() {
    const thumbnailCanvasRef = useRef(null);
const zoomCanvasRef = useRef(null);

const [pdfDocument, setPdfDocument] = useState(null);
const [previewOpen, setPreviewOpen] = useState(false);
const [previewZoom, setPreviewZoom] = useState(1);
const [previewError, setPreviewError] = useState("");
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function selectFile(files) {
    const selected = files?.[0];
    if (!selected) return;

    setError("");
    setSuccess("");

    if (
      selected.type !== "application/pdf" &&
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a PDF file.");
      return;
    }

    if (!selected.size) {
      setError("The selected PDF is empty.");
      return;
    }

    if (selected.size > 50 * 1024 * 1024) {
      setError("Maximum PDF size is 50 MB.");
      return;
    }

    setFile(selected);
  }

  function clearFile() {
    if (processing) return;
    setFile(null);
    setError("");
    setSuccess("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function convertFile() {
    if (!file || processing) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/pdf-to-word`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Conversion failed. Please try another PDF.";
        try {
          const data = await response.json();
          if (data.error) message = data.error;
        } catch {}
        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The converted Word document is empty.");
      }

      const signature = new Uint8Array(
        await blob.slice(0, 2).arrayBuffer()
      );

      if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
        throw new Error("The server did not return a valid DOCX file.");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file.name.replace(/\.pdf$/i, "") || "converted"}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);

      setSuccess("Your Word document has been downloaded.");
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
    <main className="merge-page">
      <div className="merge-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} />
          Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <FileText size={28} />
          </div>
          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>PDF to Word</h1>
            <p>Convert your PDF into an editable Word document.</p>
          </div>
        </header>

        <section className="merge-workspace">
          <div className="merge-workspace-top">
            <div>
              <h2>Your PDF files</h2>
              <p>
                {file
                  ? `1 file selected · ${formatBytes(file.size)}`
                  : "No file selected"}
              </p>
            </div>

            <button
              type="button"
              className="merge-add-button"
              onClick={() => inputRef.current?.click()}
              disabled={processing}
            >
              <Plus size={18} />
              {file ? "Replace PDF" : "Select PDF files"}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(event) => {
                selectFile(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

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
            >
              <span className="merge-upload-icon">
                <UploadCloud size={32} />
              </span>
              <strong>Drop your PDF here</strong>
              <span>or click to select a PDF document</span>
              <small>PDF files only · Maximum 50 MB</small>
            </button>
          ) : (
  <>
    <div className="pdf-word-section-heading">
      <h2>Uploaded PDF</h2>
      <span className="pdf-word-count">1 PDF</span>
    </div>

    <div className="pdf-word-preview-grid">
      <PDFPreview
        file={file}
        onRemove={clearFile}
      />
    </div>
  </>
)}
          {error && (
            <div className="pdf-word-message error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="pdf-word-message success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {processing && (
            <div className="pdf-word-status" role="status">
              <LoaderCircle size={19} className="pdf-word-spinner" />
              Converting your PDF to Word...
            </div>
          )}

          <div className="pdf-word-bottom-bar">
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
                  Convert to Word
                  <Download size={17} />
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <ShieldCheck size={17} />
          <span>Your PDF is processed by your configured conversion server.</span>
        </div>

        <section className="merge-how">
          <h2>How to convert PDF to Word</h2>
          <div className="merge-steps">
            <div>
              <span>01</span>
              <h3>Select PDF</h3>
              <p>Choose a PDF file from your device.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Convert</h3>
              <p>Convert the PDF into an editable Word document.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Download</h3>
              <p>Download your DOCX file.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}