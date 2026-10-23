
import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PDFPreview({ file, onRemove }) {
  const thumbnailRef = useRef(null);
  const viewerCanvasRef = useRef(null);

  const [pageCount, setPageCount] = useState(0);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let pdf;

    async function renderThumbnail() {
      setThumbnailLoading(true);
      setThumbnailError(false);
      setPageCount(0);

      try {
        const bytes = await file.arrayBuffer();

        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(bytes),
        });

        pdf = await loadingTask.promise;

        if (cancelled) return;

        setPageCount(pdf.numPages);

        const page = await pdf.getPage(1);
        const outputScale = Math.min(
          window.devicePixelRatio || 1,
          2
        );
        const viewport = page.getViewport({ scale: 1.15 });
        const canvas = thumbnailRef.current;

        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
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
      } catch (err) {
        console.error("PDF thumbnail error:", err);
        if (!cancelled) setThumbnailError(true);
      } finally {
        if (!cancelled) setThumbnailLoading(false);
        if (loadingTask) loadingTask.destroy().catch(() => {});
        }
    }

    renderThumbnail();

    return () => {
    cancelled = true;
    if (loadingTask) loadingTask.destroy().catch(() => {});
    };
  }, [file]);

  useEffect(() => {
    if (!viewerOpen) return;

    let cancelled = false;
    let loadingTask;
    let pdf;
    let renderTask;

    async function renderViewerPage() {
      setViewerLoading(true);
      setViewerError("");

      try {
        const bytes = await file.arrayBuffer();

        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(bytes),
        });

        pdf = await loadingTask.promise;

        if (cancelled) return;

        const page = await pdf.getPage(currentPage);
        const canvas = viewerCanvasRef.current;

        if (!canvas || cancelled) return;

        const effectiveRotation =
          (page.rotate + rotation + 360) % 360;

        const viewport = page.getViewport({
          scale: zoom,
          rotation: effectiveRotation,
        });

        const outputScale = Math.min(
          window.devicePixelRatio || 1,
          2
        );

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
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF viewer error:", err);
          if (!cancelled) {
            setViewerError(
              "This page could not be displayed. Please try again."
            );
          }
        }
      } finally {
        if (!cancelled) setViewerLoading(false);
        if (loadingTask) loadingTask.destroy().catch(() => {});
        }
    }

    renderViewerPage();

    return () => {
    cancelled = true;
    if (renderTask) renderTask.cancel();
    if (loadingTask) loadingTask.destroy().catch(() => {});
    };
  }, [file, viewerOpen, currentPage, zoom, rotation]);

  useEffect(() => {
    if (!viewerOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setViewerOpen(false);

      if (event.key === "ArrowLeft") {
        setCurrentPage((page) => Math.max(1, page - 1));
      }

      if (event.key === "ArrowRight") {
        setCurrentPage((page) =>
          Math.min(pageCount || 1, page + 1)
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [viewerOpen, pageCount]);

  function openViewer() {
    setCurrentPage(1);
    setZoom(1);
    setRotation(0);
    setViewerError("");
    setViewerOpen(true);
  }

  if (!file) return null;

  return (
    <>
      <article className="qt-pdf-card">
        <div className="qt-pdf-card-preview">
          <canvas
            ref={thumbnailRef}
            className="qt-pdf-card-canvas"
            aria-label={`First page preview of ${file.name}`}
          />

          {thumbnailLoading && (
            <div className="qt-pdf-card-loading">
              <LoaderCircle size={24} className="qt-pdf-spin" />
              <span>Loading preview…</span>
            </div>
          )}

          {thumbnailError && (
            <div className="qt-pdf-card-fallback">
              <FileText size={42} />
              <span>Preview unavailable</span>
            </div>
          )}

          <div className="qt-pdf-card-actions">
            <button
              type="button"
              title="Rotate PDF"
              aria-label={`Rotate ${file.name}`}
              onClick={() => setRotation((value) => (value + 90) % 360)}
            >
              <RotateCw size={16} />
            </button>

            <button
              type="button"
              title="Zoom PDF"
              aria-label={`Zoom ${file.name}`}
              onClick={openViewer}
            >
              <ZoomIn size={17} />
            </button>

            {onRemove && (
              <button
                type="button"
                title="Remove PDF"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove()}
              >
                <X size={17} />
              </button>
            )}
          </div>

          <span className="qt-pdf-card-page-count">
            {pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "PDF"}
          </span>
        </div>

        <div className="qt-pdf-card-info">
          <span className="qt-pdf-card-file-icon">
            <FileText size={18} />
          </span>
          <div>
            <strong title={file.name}>{file.name}</strong>
            <span>
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
        </div>
      </article>

      {viewerOpen && (
        <div
          className="qt-pdf-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`PDF viewer: ${file.name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewerOpen(false);
            }
          }}
        >
          <header className="qt-pdf-modal-header">
            <div className="qt-pdf-modal-title">
              <FileText size={21} />
              <div>
                <strong title={file.name}>{file.name}</strong>
                <span>
                  Page {currentPage} of {pageCount || "…"}
                </span>
              </div>
            </div>

            <div className="qt-pdf-modal-tools">
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

              <span className="qt-pdf-zoom-label">
                {Math.round(zoom * 100)}%
              </span>

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
                className="qt-pdf-modal-close"
                title="Close viewer"
                aria-label="Close viewer"
                onClick={() => setViewerOpen(false)}
              >
                <X size={21} />
              </button>
            </div>
          </header>

          <div className="qt-pdf-modal-body">
            <button
              type="button"
              className="qt-pdf-page-arrow qt-pdf-page-arrow-left"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
            >
              <ChevronLeft size={28} />
            </button>

            <div className="qt-pdf-modal-stage">
              {viewerLoading && (
                <div className="qt-pdf-modal-loading">
                  <LoaderCircle size={30} className="qt-pdf-spin" />
                  <span>Rendering PDF page…</span>
                </div>
              )}

              {viewerError ? (
                <p className="qt-pdf-modal-error" role="alert">
                  {viewerError}
                </p>
              ) : (
                <canvas
                  ref={viewerCanvasRef}
                  className="qt-pdf-modal-canvas"
                  aria-label={`Page ${currentPage}`}
                />
              )}
            </div>

            <button
              type="button"
              className="qt-pdf-page-arrow qt-pdf-page-arrow-right"
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(pageCount, page + 1)
                )
              }
            >
              <ChevronRight size={28} />
            </button>
          </div>

          <footer className="qt-pdf-modal-footer">
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <span>
              {currentPage} / {pageCount || "…"}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(pageCount, page + 1)
                )
              }
              disabled={currentPage >= pageCount}
            >
              Next
              <ChevronRight size={17} />
            </button>
          </footer>
        </div>
      )}
    </>
  );
}
