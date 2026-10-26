
import React, { useEffect, useRef, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowLeft,
  RotateCw,
  RotateCcw,
  UploadCloud,
  Download,
  ShieldCheck,
  AlertCircle,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";
import PageSEO from "../components/PageSEO";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function safeBaseName(name) {
  return (
    name
      .replace(/\.pdf$/i, "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim() || "document"
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getPdfFiles(fileList) {
  return Array.from(fileList || []).filter(
    (file) =>
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
  );
}

function RotatePageCard({ file, pageNumber, rotation, onRotate, disabled }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let pdf;
    let renderTask;

    async function renderPage() {
      setLoading(true);
      setError(false);

      try {
        const buffer = await file.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
        });

        pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const angle = normalizeAngle(rotation + page.rotate);
        const baseViewport = page.getViewport({
          scale: 1,
          rotation: angle,
        });

        const scale = Math.min(
          220 / baseViewport.width,
          235 / baseViewport.height,
          1.5
        );

        const viewport = page.getViewport({
          scale,
          rotation: angle,
        });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : null,
        });

        await renderTask.promise;

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          console.error("PDF preview error:", err);
          setError(true);
          setLoading(false);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;

      try {
        renderTask?.cancel();
      } catch {}

      try {
        pdf?.destroy();
      } catch {}

      try {
        loadingTask?.destroy();
      } catch {}
    };
  }, [file, pageNumber, rotation]);

  return (
    <article className="rotate-page-card">
      <div className="rotate-page-preview">
        {loading && !error && (
          <div className="rotate-preview-message">
            <LoaderCircle className="rotate-spinner" size={22} />
            <span>Rendering page...</span>
          </div>
        )}

        {error && (
          <div className="rotate-preview-message">
            <AlertCircle size={22} />
            <span>Preview unavailable</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={loading ? "is-rendering" : ""}
          aria-label={`Preview of page ${pageNumber}`}
        />

        {!loading && !error && (
          <div className="rotate-page-hover-actions">
            <button
              type="button"
              onClick={() => onRotate(-90)}
              disabled={disabled}
              title={`Rotate page ${pageNumber} left`}
              aria-label={`Rotate page ${pageNumber} left`}
            >
              <RotateCcw size={19} />
            </button>

            <button
              type="button"
              onClick={() => onRotate(90)}
              disabled={disabled}
              title={`Rotate page ${pageNumber} right`}
              aria-label={`Rotate page ${pageNumber} right`}
            >
              <RotateCw size={19} />
            </button>
          </div>
        )}
      </div>

      <div className="rotate-page-details">
        <div className="rotate-page-label">
          <strong>Page {pageNumber}</strong>
          <span>
            {rotation === 0
              ? "Original orientation"
              : `${rotation}° clockwise`}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function RotatePDF() {
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageRotations, setPageRotations] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("warning");

  function showMessage(text, type = "warning") {
    setMessage(text);
    setMessageType(type);
  }

  async function makePagePreviews(pdfFile) {
    setLoadingPages(true);
    setPreviewError("");
    setPages([]);
    setPageRotations([]);

    let loadingTask;
    let pdf;

    try {
      const buffer = await pdfFile.arrayBuffer();

      loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
      });

      pdf = await loadingTask.promise;

      setPages(
        Array.from({ length: pdf.numPages }, (_, index) => ({
          number: index + 1,
        }))
      );

      setPageRotations(Array(pdf.numPages).fill(0));
    } catch (err) {
      console.error("PDF loading error:", err);
      setPreviewError(
        "This PDF could not be opened. It may be damaged or password-protected."
      );
      setPages([]);
      setPageRotations([]);
    } finally {
      try {
        await pdf?.destroy();
      } catch {}

      try {
        await loadingTask?.destroy();
      } catch {}

      setLoadingPages(false);
    }
  }

  async function handleFiles(fileList) {
    if (processing) return;

    const selected = getPdfFiles(fileList);

    if (!selected.length) {
      showMessage("Please select a valid PDF file.");
      return;
    }

    const selectedFile = selected[0];

    if (selectedFile.size === 0) {
      showMessage("This PDF file is empty. Please choose another file.");
      return;
    }

    setFile(selectedFile);
    setMessage("");

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    await makePagePreviews(selectedFile);
  }

  function rotatePage(index, amount) {
    setPageRotations((current) =>
      current.map((angle, i) =>
        i === index ? normalizeAngle(angle + amount) : angle
      )
    );

    setMessage("");
  }

  function rotateAll(amount) {
    setPageRotations((current) =>
      current.map((angle) => normalizeAngle(angle + amount))
    );

    setMessage("");
  }

  function resetRotations() {
    setPageRotations((current) => current.map(() => 0));
    setMessage("");
  }

  function clearFile() {
    if (processing || loadingPages) return;

    setFile(null);
    setPages([]);
    setPageRotations([]);
    setMessage("");
    setPreviewError("");
    setDragging(false);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  async function rotateAndDownload() {
    if (!file || !pageRotations.length || processing || loadingPages) {
      showMessage("Upload a PDF before rotating pages.");
      return;
    }

    if (pageRotations.every((angle) => angle === 0)) {
      showMessage("Rotate at least one page before downloading.");
      return;
    }

    setProcessing(true);
    setMessage("");

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const pdfPages = pdf.getPages();

      pdfPages.forEach((page, index) => {
        const currentRotation = page.getRotation().angle;
        const finalRotation = normalizeAngle(
          currentRotation + (pageRotations[index] || 0)
        );

        page.setRotation(degrees(finalRotation));
      });

      const output = await pdf.save();
      const blob = new Blob([output], {
        type: "application/pdf",
      });

      downloadBlob(blob, `${safeBaseName(file.name)}-rotated.pdf`);

      showMessage("Your rotated PDF has been downloaded.", "success");
    } catch (err) {
      console.error("Rotate PDF error:", err);

      showMessage(
        err?.message?.toLowerCase().includes("encrypted")
          ? "This PDF is password-protected. Unlock it and try again."
          : "We couldn't rotate this PDF. It may be damaged or password-protected."
      );
    } finally {
      setProcessing(false);
    }
  }

  const totalRotation = pageRotations.filter((angle) => angle !== 0).length;

  return (
    <main className="merge-page rotate-tool-page">
      <PageSEO
        title="Rotate PDF Pages Online | QuickTools"
        description="Rotate PDF pages online to correct sideways or upside-down documents, then save your corrected PDF with QuickTools."
        path="/rotate-pdf"
      />
      <div className="merge-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} />
          Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <RotateCw size={25} />
          </div>

          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>Rotate PDF</h1>
            <p>Rotate individual pages or turn every page at once.</p>
          </div>
        </header>

        <section className="merge-workspace rotate-workspace">
          <div className="merge-workspace-top">
            <div>
              <h2>Your PDF files</h2>
              <p>
                {file
                  ? `1 file selected · ${formatBytes(file.size)}`
                  : "Choose PDF files to get started."}
              </p>
            </div>

            {file && (
              <button
                type="button"
                className="merge-add-button"
                onClick={() => fileRef.current?.click()}
                disabled={processing || loadingPages}
              >
                <span className="rotate-select-plus">+</span>
                Select PDF files
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={(event) => handleFiles(event.target.files)}
          />

          {!file && (
            <div
              className={`merge-dropzone rotate-dropzone ${
                dragging ? "is-dragging" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                handleFiles(event.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileRef.current?.click();
                }
              }}
            >
              <div className="merge-upload-icon">
                <UploadCloud size={25} />
              </div>

              <h3>Choose PDF files</h3>
              <p>Select one or more PDFs to rotate.</p>
              <span className="rotate-file-hint">
                PDF files only · Your files stay on your device
              </span>
            </div>
          )}

          {file && (
            <>
              <div className="rotate-review-notice">
                <strong>Review your PDF before rotating.</strong>
                <p>
                  Use the page controls to rotate individual pages or rotate
                  every page at once.
                </p>
              </div>

              {loadingPages && (
                <div className="rotate-loading">
                  <LoaderCircle className="rotate-spinner" size={23} />
                  <span>Preparing page previews...</span>
                </div>
              )}

              {previewError && (
                <div className="merge-message merge-error">
                  <AlertCircle size={18} />
                  {previewError}
                </div>
              )}

              {!loadingPages && pages.length > 0 && (
                <>
                  <div className="rotate-uploaded-heading">
                    <h2>Uploaded PDFs</h2>
                    <span>
                      {pages.length} {pages.length === 1 ? "PAGE" : "PAGES"}
                    </span>
                  </div>

                  <div className="rotate-toolbar">
                    <div>
                      <h3>Rotate pages</h3>
                      <p>
                        {totalRotation
                          ? `${totalRotation} page${totalRotation === 1 ? "" : "s"} rotated`
                          : "Choose a direction for any page."}
                      </p>
                    </div>

                    <div className="rotate-toolbar-actions">
                      <button
                        type="button"
                        className="rotate-secondary-button"
                        onClick={() => rotateAll(-90)}
                        disabled={processing}
                      >
                        <RotateCcw size={16} />
                        All left
                      </button>

                      <button
                        type="button"
                        className="rotate-secondary-button"
                        onClick={() => rotateAll(90)}
                        disabled={processing}
                      >
                        <RotateCw size={16} />
                        All right
                      </button>

                      <button
                        type="button"
                        className="rotate-secondary-button"
                        onClick={resetRotations}
                        disabled={processing || totalRotation === 0}
                      >
                        <RotateCcw size={16} />
                        Reset
                      </button>
                    </div>
                  </div>

                  <p className="rotate-instruction-message">
                    Hover over a PDF page to reveal the rotation arrows. Click
                    an arrow to rotate that page.
                  </p>

                  <div className="rotate-pages-grid">
                    {pages.map((page, index) => (
                      <RotatePageCard
                        key={page.number}
                        file={file}
                        pageNumber={page.number}
                        rotation={pageRotations[index] || 0}
                        onRotate={(amount) => rotatePage(index, amount)}
                        disabled={processing}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {message && (
            <div
              className={`merge-message ${
                messageType === "success" ? "merge-success" : "merge-error"
              }`}
              role="status"
            >
              {messageType === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{message}</span>
            </div>
          )}

          <div className="rotate-action-row">
            <button
              type="button"
              className="rotate-clear-button"
              onClick={clearFile}
              disabled={!file || processing || loadingPages}
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button rotate-main-button"
              onClick={rotateAndDownload}
              disabled={
                !file ||
                processing ||
                loadingPages ||
                !pages.length ||
                totalRotation === 0
              }
            >
              {processing ? (
                <>
                  <LoaderCircle className="rotate-spinner" size={18} />
                  Rotating PDF...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Rotate PDF
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy rotate-outside-privacy">
          <ShieldCheck size={17} />
          <span>
            <strong>Your files stay private.</strong>{" "}
            Processing happens in your browser; your documents are not
            uploaded to a server.
          </span>
        </div>

        <section className="rotate-how">
          <h2>How to rotate a PDF</h2>

          <div className="merge-steps">
            <div>
              <span>01</span>
              <strong>Upload PDFs</strong>
              <p>Choose the PDF you want to adjust.</p>
            </div>

            <div>
              <span>02</span>
              <strong>Rotate pages</strong>
              <p>Use the arrows or rotate all pages together.</p>
            </div>

            <div>
              <span>03</span>
              <strong>Download</strong>
              <p>Save your rotated PDF to your device.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
