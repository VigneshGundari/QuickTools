
import React, { useEffect, useRef, useState } from "react";
import { PDFDocument } from "@carboneio/pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RotateCw,
  ShieldCheck,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";
import "../ProtectPDF.css";
import PageSEO from "../components/PageSEO";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const safeName = (name) =>
  name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() ||
  "protected-document";

function formatSize(size) {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ProtectPDF() {
  const inputRef = useRef(null);
  const thumbnailCanvasRefs = useRef({});
  const viewerCanvasRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [previewId, setPreviewId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const previewFile = files.find((file) => file.id === previewId) || null;

  useEffect(() => {
    let cancelled = false;
    const tasks = [];

    async function renderThumbnails() {
      for (const item of files) {
        if (cancelled) return;

        try {
          const bytes = await item.file.arrayBuffer();
          const task = pdfjsLib.getDocument({
            data: new Uint8Array(bytes),
          });
          tasks.push(task);

          const pdf = await task.promise;
          if (cancelled) return;

          const page = await pdf.getPage(1);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(1.25, 210 / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const canvas = thumbnailCanvasRefs.current[item.id];

          if (!canvas || cancelled) continue;

          const context = canvas.getContext("2d");
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);

          canvas.width = Math.ceil(viewport.width * outputScale);
          canvas.height = Math.ceil(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          await page.render({
            canvasContext: context,
            viewport,
            transform:
              outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null,
          }).promise;

          if (!cancelled) {
            setFiles((current) =>
              current.map((file) =>
                file.id === item.id
                  ? { ...file, pageCount: pdf.numPages, thumbnailReady: true }
                  : file
              )
            );
          }
        } catch (e) {
          console.error("Protect PDF thumbnail error:", e);
          if (!cancelled) {
            setFiles((current) =>
              current.map((file) =>
                file.id === item.id
                  ? { ...file, thumbnailError: true }
                  : file
              )
            );
          }
        }
      }
    }

    if (files.length) renderThumbnails();

    return () => {
      cancelled = true;
      tasks.forEach((task) => {
        try {
          task.destroy();
        } catch {
          // Ignore cleanup errors.
        }
      });
    };
  }, [files.map((file) => file.id).join("|")]);

  useEffect(() => {
    if (!previewFile) return;

    let cancelled = false;
    let loadingTask;
    let renderTask;

    async function renderViewerPage() {
      setViewerLoading(true);
      setViewerError("");

      try {
        const bytes = await previewFile.file.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(bytes),
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);
        const pageNumber = Math.min(currentPage, pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        const canvas = viewerCanvasRef.current;

        if (!canvas || cancelled) return;

        const effectiveRotation = (page.rotate + rotation + 360) % 360;
        const viewport = page.getViewport({
          scale: zoom,
          rotation: effectiveRotation,
        });

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d");

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
      } catch (e) {
        if (e?.name !== "RenderingCancelledException") {
          console.error("Protect PDF viewer error:", e);
          if (!cancelled) {
            setViewerError(
              "This PDF page could not be displayed. Try another PDF."
            );
          }
        }
      } finally {
        if (!cancelled) setViewerLoading(false);
        if (loadingTask) {
          try {
            await loadingTask.destroy();
          } catch {
            // Ignore cleanup errors.
          }
        }
      }
    }

    renderViewerPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // Ignore cleanup errors.
        }
      }
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          // Ignore cleanup errors.
        }
      }
    };
  }, [previewFile, currentPage, zoom, rotation]);

  useEffect(() => {
    if (!previewFile) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") closePreview();
      if (event.key === "ArrowLeft") {
        setCurrentPage((page) => Math.max(1, page - 1));
      }
      if (event.key === "ArrowRight") {
        setCurrentPage((page) => Math.min(pageCount || 1, page + 1));
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [previewFile, pageCount]);

  async function addPDFs(fileList) {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    setError("");
    setSuccess("");

    const valid = [];
    const invalid = [];

    for (const file of selected) {
      const isPDF =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isPDF) {
        invalid.push(`${file.name}: not a PDF`);
      } else if (file.size > MAX_FILE_SIZE) {
        invalid.push(`${file.name}: larger than 100 MB`);
      } else {
        valid.push(file);
      }
    }

    if (invalid.length) {
      setError(`Some files were skipped: ${invalid.join("; ")}.`);
    }

    if (!valid.length) return;

    setLoading(true);

    try {
      const additions = [];

      for (const file of valid) {
        const duplicate = [...files, ...additions].some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified
        );

        if (duplicate) {
          setError((current) =>
            [current, `Skipped duplicate file: ${file.name}.`]
              .filter(Boolean)
              .join(" ")
          );
          continue;
        }

        // Read the PDF now so invalid or password-protected files can be
        // reported before the user attempts to protect them.
        const bytes = await file.arrayBuffer();
        const task = pdfjsLib.getDocument({
          data: new Uint8Array(bytes.slice(0)),
        });

        try {
          const pdf = await task.promise;

          additions.push({
            id: `protect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            pageCount: pdf.numPages,
            thumbnailReady: false,
            thumbnailError: false,
            rotation: 0,
          });
        } finally {
          try {
            await task.destroy();
          } catch {
            // Ignore cleanup errors.
          }
        }
      }

      if (additions.length) {
        setFiles((current) => [...current, ...additions]);
        setSuccess(
          `${additions.length} PDF ${
            additions.length === 1 ? "file was" : "files were"
          } added successfully.`
        );
      }
    } catch (e) {
      console.error("Protect PDF upload error:", e);
      setError(
        "We couldn't read one of these PDFs. It may be damaged or password-protected."
      );
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeFile(id) {
    setFiles((current) => current.filter((file) => file.id !== id));
    if (previewId === id) closePreview();
    setError("");
    setSuccess("");
  }

  function clearAll() {
    setFiles([]);
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    closePreview();
    if (inputRef.current) inputRef.current.value = "";
  }

  function openPreview(id) {
    setPreviewId(id);
    setCurrentPage(1);
    setPageCount(files.find((file) => file.id === id)?.pageCount || 0);
    setZoom(1);
    setRotation(0);
    setViewerError("");
  }

  function closePreview() {
    setPreviewId(null);
    setCurrentPage(1);
    setZoom(1);
    setRotation(0);
    setViewerError("");
  }

  function rotateCard(id) {
    setFiles((current) =>
      current.map((file) =>
        file.id === id
          ? { ...file, rotation: ((file.rotation || 0) + 90) % 360 }
          : file
      )
    );
  }

  async function protectPDFs() {
    if (!files.length || processing || loading) return;

    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords don't match. Please check and try again.");
      return;
    }

    if (!globalThis.crypto?.getRandomValues) {
      setError(
        "Secure encryption is unavailable in this browser context. Open QuickTools using localhost or HTTPS and try again."
      );
      return;
    }

    setProcessing(true);
    let completed = 0;
    const failed = [];

    try {
      for (const item of files) {
        try {
          const inputBytes = new Uint8Array(await item.file.arrayBuffer());

          // Load the source with the encryption-capable PDF library.
          const pdfDoc = await PDFDocument.load(inputBytes, {
            updateMetadata: false,
          });

          // AES-256 encryption: the user password is required to open the PDF.
          pdfDoc.encrypt({
            userPassword: password,
            ownerPassword: `${password}-${crypto.randomUUID()}`,
            algorithm: "AES-256",
          });

          const protectedBytes = await pdfDoc.save();
          const blob = new Blob([protectedBytes], {
            type: "application/pdf",
          });

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${safeName(item.name)}-protected.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();

          window.setTimeout(() => URL.revokeObjectURL(url), 1500);
          completed++;
        } catch (e) {
          console.error(`Could not protect ${item.name}:`, e);
          failed.push(item.name);
        }
      }

      if (completed && !failed.length) {
        setSuccess(
          `${completed} protected PDF ${
            completed === 1 ? "file is" : "files are"
          } ready to download. Open one to confirm it asks for your password.`
        );
      } else if (completed && failed.length) {
        setError(
          `Protected ${completed} PDF(s), but couldn't protect: ${failed.join(", ")}.`
        );
      } else {
        setError(
          "No files were protected. Check that the PDFs are valid and aren't already password-protected, then try again."
        );
      }
    } finally {
      setProcessing(false);
    }
  }

  const openFilePicker = () => inputRef.current?.click();

  return (
    <main className="merge-page protect-tool-page">
      <PageSEO
        title="Protect PDF with a Password | QuickTools"
        description="Protect PDF documents with password encryption using QuickTools to help restrict unauthorized access to your files."
        path="/protect-pdf"
      />
      <div className="merge-container protect-tool-inner">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} /> Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <FileLock2 size={28} />
          </div>
          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>Protect PDF</h1>
            <p>
              Add password protection to your PDF files. Your documents are
              processed in your browser.
            </p>
          </div>
        </header>

        <section className="merge-workspace">
          <div className="merge-workspace-top">
            <div>
              <h2>Your PDF files</h2>
              <p>
                {files.length} {files.length === 1 ? "file" : "files"} selected
                {" · "}
                {formatSize(totalSize)}
              </p>
            </div>

            <button
              type="button"
              className="merge-add-button"
              onClick={openFilePicker}
              disabled={loading || processing}
            >
              <Plus size={17} /> Select PDF files
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(event) => {
                addPDFs(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {files.length === 0 ? (
            <button
              type="button"
              className={`merge-dropzone ${
                draggingFile ? "protect-drop-active" : ""
              }`}
              onClick={openFilePicker}
              onDragOver={(event) => {
                event.preventDefault();
                setDraggingFile(true);
              }}
              onDragLeave={() => setDraggingFile(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDraggingFile(false);
                addPDFs(event.dataTransfer.files);
              }}
              disabled={loading}
            >
              <span className="merge-upload-icon">
                {loading ? (
                  <LoaderCircle className="protect-spin" size={32} />
                ) : (
                  <UploadCloud size={32} />
                )}
              </span>
              <strong>
                {loading ? "Preparing your PDFs…" : "Choose PDFs to protect"}
              </strong>
              <span>
                {loading
                  ? "Checking your PDFs. Please wait."
                  : "Click here or drag and drop your PDFs"}
              </span>
              {!loading && (
                <small>Select one or multiple PDF files · Maximum 100 MB per file</small>
              )}
            </button>
          ) : (
            <>
              <div className="protect-file-list">
                {files.map((item) => (
                  <article className="protect-file-card" key={item.id}>
                    <div className="protect-file-preview">
                      <canvas
                        ref={(node) => {
                          if (node) thumbnailCanvasRefs.current[item.id] = node;
                          else delete thumbnailCanvasRefs.current[item.id];
                        }}
                        className="protect-thumbnail-canvas"
                        aria-label={`First page preview of ${item.name}`}
                        style={{ transform: `rotate(${item.rotation || 0}deg)` }}
                      />

                      {!item.thumbnailReady && !item.thumbnailError && (
                        <div className="protect-thumbnail-state">
                          <LoaderCircle className="protect-spin" size={24} />
                          <span>Loading preview…</span>
                        </div>
                      )}

                      {item.thumbnailError && (
                        <div className="protect-thumbnail-state">
                          <FileText size={38} />
                          <span>Preview unavailable</span>
                        </div>
                      )}

                      <span className="protect-page-count">
                        {item.pageCount
                          ? `${item.pageCount} page${item.pageCount === 1 ? "" : "s"}`
                          : "PDF"}
                      </span>

                      <div className="protect-hover-controls">
                        <button
                          type="button"
                          title="Rotate preview"
                          aria-label={`Rotate ${item.name} preview`}
                          className="protect-hover-btn"
                          onClick={() => rotateCard(item.id)}
                        >
                          <RotateCw size={16} />
                        </button>
                        <button
                          type="button"
                          title="Magnify PDF"
                          aria-label={`Magnify ${item.name}`}
                          className="protect-hover-btn"
                          onClick={() => openPreview(item.id)}
                        >
                          <ZoomIn size={17} />
                        </button>
                        <button
                          type="button"
                          title="Remove PDF"
                          aria-label={`Remove ${item.name}`}
                          className="protect-hover-btn"
                          onClick={() => removeFile(item.id)}
                          disabled={processing}
                        >
                          <X size={17} />
                        </button>
                      </div>
                    </div>

                    <div className="protect-file-info">
                      <span className="protect-file-icon">
                        <FileText size={19} />
                      </span>
                      <div>
                        <strong title={item.name}>{item.name}</strong>
                        <span>
                          {formatSize(item.size)}
                          {item.pageCount ? ` · ${item.pageCount} pages` : ""}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="merge-add-another"
                onClick={openFilePicker}
                disabled={processing || loading}
              >
                <Plus size={17} /> Add more PDFs
              </button>

              <div className="protect-password-section">
                <div className="protect-section-heading">
                  <h2>Set a password</h2>
                  <p>The same password will protect every selected PDF.</p>
                </div>

                <label className="protect-field-label" htmlFor="protect-password">
                  Password
                </label>
                <div className="protect-password-input">
                  <LockKeyhole size={18} />
                  <input
                    id="protect-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      setSuccess("");
                    }}
                    placeholder="Enter a strong password"
                    disabled={processing}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <label
                  className="protect-field-label"
                  htmlFor="protect-confirm-password"
                >
                  Confirm password
                </label>
                <div className="protect-password-input">
                  <LockKeyhole size={18} />
                  <input
                    id="protect-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                      setSuccess("");
                    }}
                    placeholder="Re-enter your password"
                    disabled={processing}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    title={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {loading && files.length > 0 && (
            <div className="protect-loading-line">
              <LoaderCircle className="protect-spin" size={17} />
              Checking PDFs and preparing previews…
            </div>
          )}

          {error && (
            <div className="merge-message merge-error" role="alert">
              <X size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="merge-message merge-success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <div className="merge-footer">
            <button
              type="button"
              className="merge-clear-button"
              onClick={clearAll}
              disabled={!files.length || processing}
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button"
              onClick={protectPDFs}
              disabled={
                !files.length ||
                !password ||
                !confirmPassword ||
                loading ||
                processing
              }
            >
              {processing ? (
                <>
                  <LoaderCircle className="protect-spin" size={18} />
                  Protecting PDFs…
                </>
              ) : (
                <>
                  <LockKeyhole size={18} />
                  Protect PDF
                  <Download size={17} />
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <ShieldCheck size={18} />
          <span>
            <strong>Simple and secure.</strong> This tool processes your
            selected files in the browser rather than uploading them to a
            QuickTools server.
          </span>
        </div>

        <section className="merge-how">
          <h2>How to protect a PDF</h2>
          <div className="merge-steps">
            <div>
              <span>01</span>
              <h3>Upload your PDFs</h3>
              <p>Select one or more PDF files that you want to protect.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Set a password</h3>
              <p>Enter a password and confirm it before encrypting your files.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Download protected PDFs</h3>
              <p>Download each protected PDF and keep your password somewhere safe.</p>
            </div>
          </div>
        </section>
      </div>

      {previewFile && (
        <div
          className="protect-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`PDF preview: ${previewFile.name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <header className="protect-preview-top">
            <div className="protect-preview-file">
              <FileText size={22} />
              <div>
                <strong title={previewFile.name}>{previewFile.name}</strong>
                <span>
                  Page {currentPage} of {pageCount || previewFile.pageCount || "…"}
                </span>
              </div>
            </div>

            <div className="protect-preview-controls">
              <button
                type="button"
                title="Rotate page"
                aria-label="Rotate page"
                onClick={() => setRotation((value) => (value + 90) % 360)}
              >
                <RotateCw size={19} />
              </button>
              <button
                type="button"
                title="Zoom out"
                aria-label="Zoom out"
                disabled={zoom <= 0.5}
                onClick={() =>
                  setZoom((value) => Math.max(0.5, +(value - 0.25).toFixed(2)))
                }
              >
                <ZoomOut size={19} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                title="Zoom in"
                aria-label="Zoom in"
                disabled={zoom >= 2.5}
                onClick={() =>
                  setZoom((value) => Math.min(2.5, +(value + 0.25).toFixed(2)))
                }
              >
                <ZoomIn size={19} />
              </button>
              <button
                type="button"
                title="Close preview"
                aria-label="Close preview"
                onClick={closePreview}
              >
                <X size={22} />
              </button>
            </div>
          </header>

          <button
            type="button"
            className="protect-preview-nav prev"
            title="Previous page"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            <ChevronLeft size={26} />
          </button>

          <div className="protect-preview-canvas">
            {viewerLoading && (
              <div className="protect-viewer-loading">
                <LoaderCircle className="protect-spin" size={28} />
                <span>Rendering PDF page…</span>
              </div>
            )}
            {viewerError ? (
              <p className="protect-viewer-error" role="alert">
                {viewerError}
              </p>
            ) : (
              <canvas
                ref={viewerCanvasRef}
                className="protect-viewer-canvas"
                aria-label={`Page ${currentPage}`}
              />
            )}
          </div>

          <button
            type="button"
            className="protect-preview-nav next"
            title="Next page"
            aria-label="Next page"
            disabled={currentPage >= pageCount}
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
          >
            <ChevronRight size={26} />
          </button>

          <footer className="protect-preview-bottom">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <strong>
              {currentPage} / {pageCount || previewFile.pageCount || "…"}
            </strong>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() =>
                setCurrentPage((page) => Math.min(pageCount, page + 1))
              }
            >
              Next <ChevronRight size={16} />
            </button>
          </footer>
        </div>
      )}
    </main>
  );
}
