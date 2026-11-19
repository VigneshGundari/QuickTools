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
import PageSEO from "../components/PageSEO";

const API_URL = "https://quicktools-rmgf.onrender.com"

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
      <PageSEO
        title="PDF to Word Converter Online (PDF to DOCX) | QuickTools"
        description="Convert a PDF to an editable Word (DOCX) file online. Upload a PDF up to 50 MB, download your document, and review it for formatting changes."
        path="/pdf-to-word"
      />
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
            <h1>PDF to Word Converter</h1>
            <p>
              Convert a PDF into an editable Word document and download it as a
              DOCX file.
            </p>
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
              {file ? "Replace PDF" : "Select a PDF"}
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

        <section className="pdf-word-details" aria-labelledby="pdf-word-details-title">
          <h2 id="pdf-word-details-title">Before you convert</h2>
          <div className="pdf-word-detail-grid">
            <article>
              <h3>File requirements</h3>
              <p>
                Upload one PDF file up to 50 MB. The converted document
                downloads in DOCX format and can be opened in Microsoft Word
                and other compatible editors.
              </p>
            </article>
            <article>
              <h3>Scanned PDFs and formatting</h3>
              <p>
                Scanned pages are images, so they may need OCR before their
                text can be edited. Complex layouts, fonts, and images may
                also look different after conversion; review the DOCX before
                using or sharing it.
              </p>
            </article>
          </div>
        </section>

        <section className="pdf-word-faq" aria-labelledby="pdf-word-faq-title">
          <h2 id="pdf-word-faq-title">PDF to Word questions</h2>
          <details>
            <summary>How do I convert a PDF to a Word document?</summary>
            <p>
              Select a PDF from your device, choose “Convert to Word,” then
              download the DOCX file when conversion finishes.
            </p>
          </details>
          <details>
            <summary>What is the maximum PDF file size?</summary>
            <p>You can upload one PDF file up to 50 MB.</p>
          </details>
          <details>
            <summary>Can I edit a scanned PDF after converting it?</summary>
            <p>
              Scanned PDFs contain page images rather than selectable text.
              This converter does not perform OCR, so you may need to run OCR
              with another tool before converting.
            </p>
          </details>
          <details>
            <summary>Will the Word document look exactly like my PDF?</summary>
            <p>
              Not always. Conversion can change spacing, fonts, or page layout,
              especially in documents with columns, tables, or complex design.
              Review the converted file before relying on it.
            </p>
          </details>
          <details>
            <summary>Is my PDF processed in my browser?</summary>
            <p>
              No. The PDF is sent to the QuickTools conversion server to create
              the Word file. Read our{" "}
              <Link to="/privacy">Privacy page</Link> for information about
              file handling.
            </p>
          </details>
        </section>

        <nav className="pdf-word-related" aria-label="Related document tools">
          <span>Need another format?</span>
          <Link to="/word-to-pdf">Convert Word to PDF</Link>
          <Link to="/">Explore all tools</Link>
        </nav>
      </div>
    </main>
  );
}