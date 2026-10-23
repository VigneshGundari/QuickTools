import React, { useRef, useState, useEffect } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowLeft, CheckCircle2, Download, FileText, LoaderCircle, Plus,
  RotateCw, UploadCloud, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Grip
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, DragOverlay,
  useSensor, useSensors
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "../styles.css";
import "../organize-pdf.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const FILE_COLORS = [
  { name: "Red", border: "#E05252", soft: "#FCE7E7", text: "#B42318" },
  { name: "Blue", border: "#3B82F6", soft: "#DBEAFE", text: "#1D4ED8" },
  { name: "Green", border: "#22A06B", soft: "#DDF7E8", text: "#137547" },
  { name: "Purple", border: "#8B5CF6", soft: "#EDE9FE", text: "#6D28D9" },
  { name: "Orange", border: "#F59E0B", soft: "#FEF3C7", text: "#92400E" },
  { name: "Teal", border: "#0D9488", soft: "#CCFBF1", text: "#115E59" },
  { name: "Pink", border: "#EC4899", soft: "#FCE7F3", text: "#9D174D" },
  { name: "Indigo", border: "#6366F1", soft: "#E0E7FF", text: "#3730A3" }
];

const safeName = (name) =>
  name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() ||
  "organized-document";

function SortablePage({
  page,
  fileInfo,
  onRotate,
  onRemove,
  onMagnify,
  disabled
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: page.id, disabled });

  const color = fileInfo?.color || FILE_COLORS[0];

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.28 : 1,
        zIndex: isDragging ? 1 : "auto",
        borderColor: color.border,
        borderWidth: 2
      }}
      className={`organize-page-card ${isDragging ? "is-dragging" : ""}`}
    >
      <div className="organize-page-preview-wrap">
        <div className="organize-page-preview">
          {page.preview ? (
            <img
              src={page.preview}
              alt={`Page ${page.originalIndex + 1}`}
              style={{ transform: `rotate(${page.rotation}deg)` }}
            />
          ) : (
            <LoaderCircle className="organize-spin" size={22} />
          )}
        </div>

        <span
          className="organize-page-count"
          style={{ background: color.border }}
        >
          {fileInfo?.label || "PDF"} · Page {page.originalIndex + 1}
        </span>

        <div className="organize-hover-controls">
          <button
            type="button"
            className="organize-hover-btn organize-drag-button"
            title="Drag to reorder using the nine-dot handle"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <Grip size={17} />
          </button>

          <button
            type="button"
            className="organize-hover-btn"
            title="Rotate page"
            aria-label="Rotate page"
            onClick={() => onRotate(page.id)}
            disabled={disabled}
          >
            <RotateCw size={16} />
          </button>

          <button
            type="button"
            className="organize-hover-btn"
            title="Magnify page"
            aria-label="Magnify page"
            onClick={() => onMagnify(page.id)}
          >
            <ZoomIn size={17} />
          </button>

          <button
            type="button"
            className="organize-hover-btn"
            title="Delete page"
            aria-label="Delete page"
            onClick={() => onRemove(page.id)}
            disabled={disabled}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="organize-page-fileline">
        <span className="organize-page-fileicon">
          <FileText size={19} />
        </span>

        <div>
          <strong title={fileInfo?.name}>
            {fileInfo?.label || "PDF"} · Page {page.originalIndex + 1}
          </strong>
          <span title={fileInfo?.name}>
            {fileInfo?.name || "PDF page"}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function OrganizePDF() {
  const originalPagesRef = useRef([]);
  const inputRef = useRef(null);
  const warningTimerRef = useRef(null);
  const dragOriginRef = useRef(null);
  const [dragResetKey, setDragResetKey] = useState(0);
  const [files, setFiles] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const [activePage, setActivePage] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [zoom, setZoom] = useState(100);

  const [organizeAllInOnePDF, setOrganizeAllInOnePDF] = useState(true);
  const [crossPdfWarning, setCrossPdfWarning] = useState(false);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const previewPage = pages.find((p) => p.id === previewId) || null;

  const previewFile = previewPage
    ? files.find((f) => f.id === previewPage.fileId)
    : null;

  const totalSize = files.reduce((total, item) => total + item.size, 0);
  const totalPageCount = pages.length;

  useEffect(() => {
    if (!previewId) return;

    const onKey = (e) => {
      if (e.key === "Escape") setPreviewId(null);
      if (e.key === "ArrowRight") movePreview(1);
      if (e.key === "ArrowLeft") movePreview(-1);
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [previewId, pages]);

  function movePreview(delta) {
    const idx = pages.findIndex((p) => p.id === previewId);

    if (idx >= 0 && pages.length) {
      setPreviewId(
        pages[(idx + delta + pages.length) % pages.length].id
      );
    }
  }

  async function addPDFs(fileList) {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    setError("");
    setSuccess("");

    const valid = [];
    const invalid = [];

    selected.forEach((item) => {
      if (
        !(
          item.type === "application/pdf" ||
          item.name.toLowerCase().endsWith(".pdf")
        )
      ) {
        invalid.push(`${item.name}: not a PDF`);
      } else if (item.size > MAX_FILE_SIZE) {
        invalid.push(`${item.name}: larger than 100 MB`);
      } else {
        valid.push(item);
      }
    });

    if (invalid.length) {
      setError(`Some files were skipped: ${invalid.join("; ")}.`);
    }

    if (!valid.length) return;

    setLoading(true);

    try {
      const newFiles = [];
      const newPages = [];

      for (const selectedFile of valid) {
        const duplicate =
          files.some(
            (f) =>
              f.name === selectedFile.name &&
              f.size === selectedFile.size &&
              f.lastModified === selectedFile.lastModified
          ) ||
          newFiles.some(
            (f) =>
              f.name === selectedFile.name &&
              f.size === selectedFile.size &&
              f.lastModified === selectedFile.lastModified
          );

        if (duplicate) {
          setError((current) =>
            [
              current,
              `Skipped duplicate file: ${selectedFile.name}.`
            ]
              .filter(Boolean)
              .join(" ")
          );
          continue;
        }

        const buffer = await selectedFile.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer.slice(0))
        }).promise;

        if (!pdf.numPages) {
          throw new Error(
            `${selectedFile.name} does not contain any pages.`
          );
        }

        const fileId = `file-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

        const color =
          FILE_COLORS[(files.length + newFiles.length) % FILE_COLORS.length];

        const fileInfo = {
          id: fileId,
          name: selectedFile.name,
          size: selectedFile.size,
          lastModified: selectedFile.lastModified,
          file: selectedFile,
          label: String.fromCharCode(
            65 + ((files.length + newFiles.length) % 26)
          ),
          color,
          pageCount: pdf.numPages
        };

        newFiles.push(fileInfo);

        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1);
          const base = page.getViewport({ scale: 1 });

          const viewport = page.getViewport({
            scale: Math.min(
              2,
              1000 / Math.max(base.width, base.height)
            )
          });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { alpha: false });

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({
            canvasContext: ctx,
            viewport
          }).promise;

          const preview = canvas.toDataURL("image/jpeg", 0.86);

          newPages.push({
            id: `page-${fileId}-${i}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            fileId,
            originalIndex: i,
            rotation: 0,
            preview
          });

          canvas.width = 0;
          canvas.height = 0;
        }
      }

      if (newFiles.length) {
        setFiles((current) => [...current, ...newFiles]);

        setPages((current) => {
          const updatedPages = [...current, ...newPages];

          originalPagesRef.current = updatedPages.map((page) => ({
            ...page,
          }));

          return updatedPages;
        });

        setSuccess(
          `${newFiles.length} PDF ${
            newFiles.length === 1 ? "file was" : "files were"
          } added successfully.`
        );
      }
    } catch (e) {
      console.error("Organize PDF error:", e);

      setError(
        e?.message ||
          "We couldn't read one of the selected PDFs. It may be damaged or password-protected."
      );
    } finally {
      setLoading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function rotatePage(id) {
    setPages((current) =>
      current.map((p) =>
        p.id === id
          ? { ...p, rotation: (p.rotation + 90) % 360 }
          : p
      )
    );

    setSuccess("");
  }

  function removePage(id) {
    if (pages.length <= 1) {
      setError(
        "A PDF must contain at least one page. You can't delete the last remaining page."
      );
      return;
    }

    const page = pages.find((p) => p.id === id);
    if (!page) return;

    const remainingForFile = pages.filter(
      (p) => p.fileId === page.fileId && p.id !== id
    ).length;

    setPages((current) => current.filter((p) => p.id !== id));

    if (remainingForFile === 0) {
      setFiles((current) =>
        current.filter((f) => f.id !== page.fileId)
      );
    }

    if (previewId === id) setPreviewId(null);

    setError("");
    setSuccess("");
  }

  function removeFile(fileId) {
    const nextPages = pages.filter((p) => p.fileId !== fileId);

    if (!nextPages.length) {
      setError(
        "Keep at least one page in the workspace. Use Clear all to remove everything."
      );
      return;
    }

    setPages(nextPages);
    setFiles((current) => current.filter((f) => f.id !== fileId));

    if (
      previewId &&
      !nextPages.some((p) => p.id === previewId)
    ) {
      setPreviewId(null);
    }

    setError("");
    setSuccess("");
  }

  
function onDragStart(event) {
  const page = pages.find((p) => p.id === event.active.id);

  dragOriginRef.current = page
    ? {
        id: page.id,
        fileId: page.fileId,
      }
    : null;

  setActivePage(page || null);
  setError("");
  setSuccess("");
}

function onDragEnd(event) {
  const { active, over } = event;
  const origin = dragOriginRef.current;

  dragOriginRef.current = null;
  setActivePage(null);

  if (!over || active.id === over.id) return;

  const draggedPage = pages.find((p) => p.id === active.id);
  const targetPage = pages.find((p) => p.id === over.id);

  if (!draggedPage || !targetPage) return;

  // Reject a move into another PDF when the checkbox is unchecked.
  if (
    !organizeAllInOnePDF &&
    origin &&
    origin.fileId !== targetPage.fileId
  ) {
    setCrossPdfWarning(true);

    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
    }

    warningTimerRef.current = window.setTimeout(() => {
      setCrossPdfWarning(false);
      warningTimerRef.current = null;
    }, 2000);

    // Reset the sortable components without changing page order.
    setActivePage(null);
    setDragResetKey((key) => key + 1);

    return;
  }

  setCrossPdfWarning(false);

  if (warningTimerRef.current) {
    window.clearTimeout(warningTimerRef.current);
    warningTimerRef.current = null;
  }

  setError("");

  setPages((current) => {
    const fromIndex = current.findIndex((p) => p.id === active.id);
    const toIndex = current.findIndex((p) => p.id === over.id);

    if (fromIndex < 0 || toIndex < 0) return current;

    return arrayMove(current, fromIndex, toIndex);
  });

  setSuccess("");
}


  async function downloadPDF() {
    if (!files.length || !pages.length || processing || loading) {
      return;
    }

    setError("");
    setSuccess("");
    setProcessing(true);

    try {
      const output = await PDFDocument.create();
      const loadedSources = new Map();

      for (const fileInfo of files) {
        if (pages.some((p) => p.fileId === fileInfo.id)) {
          const source = await PDFDocument.load(
            await fileInfo.file.arrayBuffer()
          );

          loadedSources.set(fileInfo.id, source);
        }
      }

      for (const pageInfo of pages) {
        const source = loadedSources.get(pageInfo.fileId);
        if (!source) continue;

        const [copiedPage] = await output.copyPages(source, [
          pageInfo.originalIndex
        ]);

        const original = copiedPage.getRotation().angle || 0;

        copiedPage.setRotation(
          degrees(
            ((original + pageInfo.rotation) % 360 + 360) % 360
          )
        );

        output.addPage(copiedPage);
      }

      if (!output.getPageCount()) {
        throw new Error("There are no pages left to export.");
      }

      const bytes = await output.save();

      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" })
      );

      const a = document.createElement("a");
      a.href = url;

      a.download =
        files.length === 1
          ? `${safeName(files[0].name)}-organized.pdf`
          : "organized-multiple-pdfs.pdf";

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1200);

      setSuccess(
        `Your organized PDF is ready. ${pages.length} ${
          pages.length === 1 ? "page" : "pages"
        } saved from ${files.length} ${
          files.length === 1 ? "PDF" : "PDFs"
        }.`
      );
    } catch (e) {
      console.error("Organize PDF export error:", e);

      setError(
        e?.message?.toLowerCase().includes("encrypt")
          ? "One of these PDFs is encrypted. Please remove its password protection before organizing."
          : "Something went wrong while creating the PDF. Please try again with another file."
      );
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    originalPagesRef.current = [];
    setFiles([]);
    setPages([]);
    setError("");
    setSuccess("");
    setPreviewId(null);
    setActivePage(null);
    setCrossPdfWarning(false);

    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const openFilePicker = () => inputRef.current?.click();

  return (
    <main className="merge-page organize-tool-page">
      <div className="merge-container organize-tool-inner">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} /> Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <Grip size={28} />
          </div>

          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>Organize PDF</h1>
            <p>
              Rearrange, rotate, or remove pages from one or more PDFs
              in a single workspace.
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
                {(totalSize / 1048576).toFixed(2)} MB
                {" · "}
                {totalPageCount} {totalPageCount === 1 ? "page" : "pages"}
              </p>
            </div>

            <button
              type="button"
              className="merge-add-button"
              onClick={openFilePicker}
              disabled={loading || processing}
            >
              <Plus size={17} /> Add PDF files
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                addPDFs(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="organize-file-list">
              {files.map((fileInfo) => (
                <div
                  className="organize-file-chip"
                  key={fileInfo.id}
                  style={{
                    borderColor: fileInfo.color.border,
                    background: fileInfo.color.soft
                  }}
                >
                  <span
                    className="organize-file-letter"
                    style={{ background: fileInfo.color.border }}
                  >
                    {fileInfo.label}
                  </span>

                  <div className="organize-file-chip-info">
                    <strong title={fileInfo.name}>
                      {fileInfo.name}
                    </strong>

                    <span>
                      {fileInfo.pageCount}{" "}
                      {fileInfo.pageCount === 1 ? "page" : "pages"}
                      {" · "}
                      {(fileInfo.size / 1048576).toFixed(2)} MB
                    </span>
                  </div>

                  <button
                    type="button"
                    title={`Remove ${fileInfo.name}`}
                    aria-label={`Remove ${fileInfo.name}`}
                    onClick={() => removeFile(fileInfo.id)}
                    disabled={processing || loading}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 ? (
            <button
              type="button"
              className={`merge-dropzone ${
                draggingFile ? "organize-drop-active" : ""
              }`}
              onClick={openFilePicker}
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingFile(true);
              }}
              onDragLeave={() => setDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingFile(false);
                addPDFs(e.dataTransfer.files);
              }}
              disabled={loading}
            >
              <span className="merge-upload-icon">
                {loading ? (
                  <LoaderCircle className="organize-spin" size={32} />
                ) : (
                  <UploadCloud size={32} />
                )}
              </span>

              <strong>
                {loading
                  ? "Preparing your PDFs…"
                  : "Choose PDFs to organize"}
              </strong>

              <span>
                {loading
                  ? "Loading pages and creating previews. Please wait."
                  : "Click here or drag and drop multiple PDF files"}
              </span>

              {!loading && (
                <small>
                  Select one or more PDF files · Maximum 100 MB per file
                </small>
              )}
            </button>
          ) : (
            <>
              {/* Instruction box */}
              <div className="merge-notice organize-notice">
                <strong>Arrange your PDF pages.</strong>
                <p>
                  <Grip size={15} className="organize-inline-grip" />
                  Drag pages using the nine-dot handle to change their
                  order. Hover over a page to rotate, magnify, or delete it.
                </p>
              </div>

              {/* Checkbox is outside the instruction box */}
              <div className="organize-combine-option">
                <label className="organize-combine-label">
                  <input
                    type="checkbox"
                    checked={organizeAllInOnePDF}
                    onChange={(e) => {
                      const checked = e.target.checked;

                      setOrganizeAllInOnePDF(checked);
                      setCrossPdfWarning(false);
                      setError("");
                      setSuccess("");

                      if (warningTimerRef.current) {
                        window.clearTimeout(warningTimerRef.current);
                        warningTimerRef.current = null;
                      }

                      if (!checked) {
                        setPages((current) => {
                          const originalOrder = originalPagesRef.current;
                          const currentIds = new Set(current.map((page) => page.id));

                          // Restore the original order of pages that still exist.
                          const restoredPages = originalOrder
                            .filter((page) => currentIds.has(page.id))
                            .map((page) => {
                              const currentPage = current.find((p) => p.id === page.id);
                              return currentPage || page;
                            });

                          // Keep any newly added pages that aren't in the saved snapshot.
                          const originalIds = new Set(restoredPages.map((page) => page.id));
                          const newPages = current.filter((page) => !originalIds.has(page.id));

                          return [...restoredPages, ...newPages];
                        });

                        setDragResetKey((key) => key + 1);
                      }
                    }}
                    disabled={processing || loading}
                  />

                  <span className="organize-combine-copy">
                    <strong>
                      Organize all pages in one PDF file
                    </strong>

                    <small>
                      {organizeAllInOnePDF
                        ? "Move pages freely between different PDFs."
                        : "Pages can only be rearranged within their original PDF."}
                    </small>
                  </span>
                </label>

                {crossPdfWarning && (
                  <p
                    className="organize-cross-pdf-warning"
                    role="status"
                  >
                    Cross-PDF reordering is disabled. Enable
                    "Organize all pages in one PDF file" to move pages
                    between PDFs.
                  </p>
                )}
              </div>

              <section className="merge-preview-section">
                <div className="merge-preview-heading">
                  <div>
                    <h2>Uploaded PDF pages</h2>
                  </div>

                  <span>
                    {pages.length} {pages.length === 1 ? "page" : "pages"}
                  </span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragCancel={() => {
                    dragOriginRef.current = null;
                    setActivePage(null);
                    setDragResetKey((key) => key + 1);
                  }}
                >
                  <SortableContext
                    items={pages.map((p) => p.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div
                      key={dragResetKey}
                      className="qt-pdf-gallery organize-pages-grid"
                    >
                      {pages.map((page) => (
                        <SortablePage
                          key={page.id}
                          page={page}
                          fileInfo={files.find(
                            (f) => f.id === page.fileId
                          )}
                          onRotate={rotatePage}
                          onRemove={removePage}
                          onMagnify={setPreviewId}
                          disabled={processing || loading}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay dropAnimation={null}>
                    {activePage ? (
                      <div
                        className="organize-drag-overlay"
                        style={{
                          borderColor: files.find(
                            (f) => f.id === activePage.fileId
                          )?.color.border
                        }}
                      >
                        <div className="organize-drag-overlay-preview">
                          {activePage.preview && (
                            <img
                              src={activePage.preview}
                              alt=""
                              style={{
                                transform: `rotate(${activePage.rotation}deg)`
                              }}
                            />
                          )}
                        </div>

                        <strong>
                          {
                            files.find(
                              (f) => f.id === activePage.fileId
                            )?.label
                          }{" "}
                          · Page {activePage.originalIndex + 1}
                        </strong>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                <button
                  type="button"
                  className="merge-add-another"
                  onClick={openFilePicker}
                  disabled={processing || loading}
                >
                  <Plus size={17} /> Add more PDFs
                </button>
              </section>
            </>
          )}

          {loading && files.length > 0 && (
            <div className="organize-loading-line">
              <LoaderCircle className="organize-spin" size={17} />
              Adding PDFs and generating page previews…
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
              onClick={reset}
              disabled={!files.length || processing}
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button"
              onClick={downloadPDF}
              disabled={
                !files.length || !pages.length || loading || processing
              }
            >
              {processing ? (
                <>
                  <LoaderCircle className="organize-spin" size={18} />
                  Creating PDF…
                </>
              ) : (
                <>
                  <FileText size={18} />
                  Organize PDF
                  <Download size={17} />
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <CheckCircle2 size={18} />
          <span>
            <strong>Simple and secure.</strong> PDF processing happens
            in your browser; your files aren't uploaded to a server by
            this tool.
          </span>
        </div>

        <section className="merge-how">
          <h2>How to organize a PDF</h2>

          <div className="merge-steps">
            <div>
              <span>01</span>
              <h3>Upload your PDFs</h3>
              <p>
                Select one or more PDFs to bring all their pages into
                one workspace.
              </p>
            </div>

            <div>
              <span>02</span>
              <h3>Arrange the pages</h3>
              <p>
                Drag with the nine-dot handle, rotate, or delete pages
                until the order is right.
              </p>
            </div>

            <div>
              <span>03</span>
              <h3>Download your PDF</h3>
              <p>
                Save a new PDF containing the remaining pages in your
                chosen order.
              </p>
            </div>
          </div>
        </section>
      </div>

      {previewPage && (
        <div
          className="organize-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="PDF page preview"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewId(null);
          }}
        >
          <div className="organize-preview-top">
            <div className="organize-preview-file">
              <FileText size={22} />

              <div>
                <strong title={previewFile?.name}>
                  {previewFile?.name}
                </strong>

                <span>
                  {previewFile?.label} · Page{" "}
                  {pages.findIndex((p) => p.id === previewId) + 1} of{" "}
                  {pages.length}
                </span>
              </div>
            </div>

            <div className="organize-preview-controls">
              <button
                type="button"
                title="Rotate page"
                onClick={() => rotatePage(previewPage.id)}
              >
                <RotateCw size={19} />
              </button>

              <button
                type="button"
                title="Zoom out"
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
              >
                <ZoomOut size={19} />
              </button>

              <span>{zoom}%</span>

              <button
                type="button"
                title="Zoom in"
                onClick={() => setZoom((z) => Math.min(200, z + 25))}
              >
                <ZoomIn size={19} />
              </button>

              <button
                type="button"
                title="Close preview"
                onClick={() => setPreviewId(null)}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="organize-preview-nav prev"
            title="Previous page"
            onClick={() => movePreview(-1)}
            disabled={pages.length < 2}
          >
            <ChevronLeft size={26} />
          </button>

          <div className="organize-preview-canvas">
            {previewPage.preview && (
              <img
                src={previewPage.preview}
                alt={`Preview of page ${previewPage.originalIndex + 1}`}
                style={{
                  transform: `rotate(${previewPage.rotation}deg) scale(${zoom / 100})`
                }}
              />
            )}
          </div>

          <button
            type="button"
            className="organize-preview-nav next"
            title="Next page"
            onClick={() => movePreview(1)}
            disabled={pages.length < 2}
          >
            <ChevronRight size={26} />
          </button>

          <div className="organize-preview-bottom">
            <button
              type="button"
              onClick={() => movePreview(-1)}
              disabled={pages.length < 2}
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <strong>
              {pages.findIndex((p) => p.id === previewId) + 1} /{" "}
              {pages.length}
            </strong>

            <button
              type="button"
              onClick={() => movePreview(1)}
              disabled={pages.length < 2}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}