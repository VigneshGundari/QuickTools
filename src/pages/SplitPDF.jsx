import React, { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Scissors,
  ShieldCheck,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function safeName(name) {
  return name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-") || "document";
}

function formatPageRanges(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (!sorted.length) return "";
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === end + 1) {
      end = sorted[index];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = sorted[index];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

function parsePageRanges(value, totalPages) {
  const input = value.trim();
  if (!input) return [];
  const numbers = new Set();
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) throw new Error("Enter page numbers like 1, 3-5.");
    const match = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers or ranges, such as 1, 3-5.");
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > totalPages) {
      throw new Error(`Enter page numbers between 1 and ${totalPages}.`);
    }
    for (let page = first; page <= last; page += 1) numbers.add(page);
  }
  return [...numbers].sort((a, b) => a - b);
}

function PageThumbnail({ page, selected, onToggle, onZoom }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task;
    let pdf;
    let renderTask;
    let taskDestroyed = false;
    const destroyTask = () => {
      if (!task || taskDestroyed) return;
      taskDestroyed = true;
      task.destroy().catch(() => {});
    };

    async function render() {
      setLoading(true);
      setFailed(false);
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bytes = new Uint8Array(await page.file.arrayBuffer());
        if (cancelled) return;
        task = pdfjsLib.getDocument({ data: bytes });
        pdf = await task.promise;
        if (cancelled) return;
        const pdfPage = await pdf.getPage(page.number);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale: 0.42 });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
        });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          console.error("Split PDF thumbnail error:", error);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
        destroyTask();
      }
    }

    render();
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
      destroyTask();
    };
  }, [page.file, page.number]);

  return (
    <article className={`split-page-card${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="split-page-select"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} page ${page.number}`}
      >
        <span className="split-page-preview">
          <canvas ref={canvasRef} aria-label={`Preview of page ${page.number}`} />
          {loading && <span className="split-page-loading"><LoaderCircle size={20} className="merge-spinner" /></span>}
          {failed && <span className="split-page-fallback"><FileText size={32} /><small>Preview unavailable</small></span>}
          <span className="split-page-check">{selected && <Check size={14} />}</span>
        </span>
        <span className="split-page-label">Page {page.number}</span>
      </button>
      <div className="split-page-actions">
        <button type="button" onClick={() => onZoom(page.number)} title={`Preview page ${page.number}`} aria-label={`Zoom page ${page.number}`}>
          <ZoomIn size={17} />
        </button>
      </div>
    </article>
  );
}

export default function SplitPDF() {
  const inputRef = useRef(null);
  const viewerCanvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [pageRangeInput, setPageRangeInput] = useState("");
  const [mode, setMode] = useState("extract");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [viewerPage, setViewerPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const loadFile = useCallback(async (incoming) => {
    const nextFile = Array.from(incoming || []).find((item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"));
    if (!nextFile) {
      setError("Please choose a valid PDF file.");
      return;
    }
    resetMessages();
    setFile(nextFile);
    setPages([]);
    setSelectedPages([]);
    setLoadingPages(true);
    try {
      // pdf-lib validates the selected document and reads its page count without
      // starting a PDF.js worker during the upload step.
      const source = await PDFDocument.load(await nextFile.arrayBuffer());
      const pageCount = source.getPageCount();
      if (!pageCount) throw new Error("This PDF does not contain any pages.");
      const nextPages = Array.from({ length: pageCount }, (_, index) => ({ number: index + 1, file: nextFile }));
      setPages(nextPages);
      const allPageNumbers = nextPages.map((page) => page.number);
      setSelectedPages(allPageNumbers);
      setPageRangeInput(formatPageRanges(allPageNumbers));
    } catch (e) {
      console.error("Split PDF load error:", e);
      setFile(null);
      setPages([]);
      setSelectedPages([]);
      setPageRangeInput("");
      setError("We couldn't open this PDF. It may be damaged, password-protected, or not a valid PDF.");
    } finally {
      setLoadingPages(false);
    }
  }, []);

  const togglePage = (number) => {
    resetMessages();
    const next = selectedPages.includes(number)
      ? selectedPages.filter((item) => item !== number)
      : [...selectedPages, number].sort((a, b) => a - b);
    setSelectedPages(next);
    setPageRangeInput(formatPageRanges(next));
  };

  const selectAll = () => {
    const allPages = pages.map((page) => page.number);
    setSelectedPages(allPages);
    setPageRangeInput(formatPageRanges(allPages));
    resetMessages();
  };
  const selectNone = () => {
    setSelectedPages([]);
    setPageRangeInput("");
    resetMessages();
  };

  const updatePageRanges = (value) => {
    setPageRangeInput(value);
    resetMessages();
    try {
      setSelectedPages(parsePageRanges(value, pages.length));
    } catch {
      // Keep the user's text while they are still typing; validate on submit.
    }
  };

  useEffect(() => {
    if (!viewerOpen || !file || !viewerPage) return undefined;
    let cancelled = false;
    let task;
    let renderTask;
    let taskDestroyed = false;
    const destroyTask = () => {
      if (!task || taskDestroyed) return;
      taskDestroyed = true;
      task.destroy().catch(() => {});
    };
    async function renderViewer() {
      setViewerLoading(true);
      setViewerError("");
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        task = pdfjsLib.getDocument({ data: bytes });
        const pdf = await task.promise;
        if (cancelled) return;
        const page = await pdf.getPage(viewerPage);
        const canvas = viewerCanvasRef.current;
        if (!canvas || cancelled) return;
        const viewport = page.getViewport({ scale: viewerZoom });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({ canvasContext: context, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled && e?.name !== "RenderingCancelledException") {
          console.error("Split PDF viewer error:", e);
          setViewerError("This page couldn't be previewed. Please try again.");
        }
      } finally {
        if (!cancelled) setViewerLoading(false);
        destroyTask();
      }
    }
    renderViewer();
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
      destroyTask();
    };
  }, [file, viewerOpen, viewerPage, viewerZoom]);

  useEffect(() => {
    if (!viewerOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") setViewerPage((page) => Math.max(1, page - 1));
      if (event.key === "ArrowRight") setViewerPage((page) => Math.min(pages.length, page + 1));
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen, pages.length]);

  async function extractSelectedPages() {
    resetMessages();
    if (!file) return setError("Upload a PDF first.");
    if (selectedPages.length === 0) {
      return setError("Please select at least one page to extract from the PDF.");
    }
    let pagesToUse;
    try {
      pagesToUse = parsePageRanges(pageRangeInput, pages.length);
    } catch (rangeError) {
      return setError(rangeError.message);
    }
    if (!pagesToUse.length) return setError("Select at least one page or enter page numbers to extract.");
    setSelectedPages(pagesToUse);
    setPageRangeInput(formatPageRanges(pagesToUse));
    setProcessing(true);
    try {
      const source = await PDFDocument.load(await file.arrayBuffer());
      const output = await PDFDocument.create();
      const copied = await output.copyPages(source, pagesToUse.map((number) => number - 1));
      copied.forEach((page) => output.addPage(page));
      const bytes = await output.save();
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeName(file.name)}-extracted.pdf`);
      setSuccess(`${pagesToUse.length} page${pagesToUse.length === 1 ? "" : "s"} extracted successfully.`);
    } catch (e) {
      console.error("Extract pages error:", e);
      setError("We couldn't extract these pages. Please check that the PDF is valid and not password-protected.");
    } finally {
      setProcessing(false);
    }
  }

  async function splitIntoFiles() {
    resetMessages();
    if (!file) return setError("Upload a PDF first.");
    if (selectedPages.length === 0) {
      return setError("Please select at least one page to split into separate PDFs.");
    }
    let pagesToUse;
    try {
      pagesToUse = parsePageRanges(pageRangeInput, pages.length);
    } catch (rangeError) {
      return setError(rangeError.message);
    }
    if (!pagesToUse.length) return setError("Select at least one page or enter page numbers to split.");
    setSelectedPages(pagesToUse);
    setPageRangeInput(formatPageRanges(pagesToUse));
    setProcessing(true);
    try {
      const source = await PDFDocument.load(await file.arrayBuffer());
      const zip = new JSZip();
      for (const pageNumber of pagesToUse) {
        const output = await PDFDocument.create();
        const [copiedPage] = await output.copyPages(source, [pageNumber - 1]);
        output.addPage(copiedPage);
        const bytes = await output.save();
        zip.file(`${safeName(file.name)}-page-${pageNumber}.pdf`, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${safeName(file.name)}-selected-pages.zip`);
      setSuccess(`Your selected ${pagesToUse.length === 1 ? "page was" : "pages were"} split into ${pagesToUse.length} PDF file${pagesToUse.length === 1 ? "" : "s"} and downloaded as a ZIP.`);
    } catch (e) {
      console.error("Split PDF error:", e);
      setError("We couldn't split this PDF. Please check that it is valid and not password-protected.");
    } finally {
      setProcessing(false);
    }
  }

  function clearFile() {
    setFile(null); setPages([]); setSelectedPages([]); setPageRangeInput(""); setViewerOpen(false); resetMessages();
    if (inputRef.current) inputRef.current.value = "";
  }

  const selectedLabel = `${selectedPages.length} of ${pages.length} pages selected`;

  return (
    <main className="merge-page split-tool-page">
      <div className="merge-container">
        <Link to="/" className="merge-back"><ArrowLeft size={17} />Back to all tools</Link>
        <header className="merge-heading">
          <div className="merge-heading-icon"><Scissors size={27} /></div>
          <div><span className="merge-eyebrow">PDF TOOL</span><h1>Split PDF</h1><p>Separate a PDF into individual files or extract only the pages you need.</p></div>
        </header>

        <section className="merge-workspace">
          <div className="merge-workspace-top">
            <div><h2>Your PDF document</h2><p>{file ? `${file.name} · ${formatBytes(file.size)} · ${pages.length} pages` : "Upload one PDF file to get started."}</p></div>
            {file && <button type="button" className="merge-add-button" onClick={() => inputRef.current?.click()}><UploadCloud size={16} />Replace PDF</button>}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={(event) => {
              const chosenFiles = event.target.files;
              if (chosenFiles?.length) loadFile(chosenFiles);
              event.target.value = "";
            }}
          />

          {!file ? (
            <button type="button" className={`merge-dropzone${dragging ? " is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files); }}>
              <span className="merge-upload-icon"><UploadCloud size={27} /></span><strong>Choose a PDF or drop it here</strong><span>Upload one PDF document to preview its pages.</span><small>PDF files only · Your file stays on your device</small>
            </button>
          ) : (
            <>
              <div className="split-pages-toolbar">
                <div><strong>Pages</strong><span>{selectedLabel}</span></div>
                <div><button type="button" onClick={selectAll} disabled={selectedPages.length === pages.length}>Select all</button><button type="button" onClick={selectNone} disabled={!selectedPages.length}>Clear selection</button></div>
              </div>
              <div className="split-page-range-field">
                <label htmlFor="split-page-ranges">Pages to extract:</label>
                <input id="split-page-ranges" type="text" value={pageRangeInput} onChange={(event) => updatePageRanges(event.target.value)} placeholder="e.g. 1, 3-5" aria-describedby="split-page-ranges-help" />
                <small id="split-page-ranges-help">Enter pages or ranges separated by commas, like 1, 3-5. Clicking page thumbnails updates this field automatically.</small>
              </div>
              {loadingPages ? <div className="split-loading"><LoaderCircle size={23} className="merge-spinner" />Preparing page previews…</div> : (
                <div className="split-pages-grid">
                  {pages.map((page) => <PageThumbnail key={`${file.name}-${page.number}`} page={page} selected={selectedPages.includes(page.number)} onToggle={() => togglePage(page.number)} onZoom={(number) => { setViewerPage(number); setViewerZoom(1); setViewerError(""); setViewerOpen(true); }} />)}
                </div>
              )}
              <div className="split-options">
                <div className="split-option-heading"><h3>What would you like to do?</h3><p>Choose how your PDF should be separated.</p></div>
                <label className={`split-mode-card${mode === "extract" ? " active" : ""}`}><input type="radio" name="split-mode" value="extract" checked={mode === "extract"} onChange={() => { setMode("extract"); resetMessages(); }} /><span className="split-mode-radio" /><span className="split-mode-copy"><strong>Extract selected pages</strong><small>Save the selected pages together as one new PDF.</small></span><FileText size={20} /></label>
                <label className={`split-mode-card${mode === "split" ? " active" : ""}`}><input type="radio" name="split-mode" value="split" checked={mode === "split"} onChange={() => { setMode("split"); resetMessages(); }} /><span className="split-mode-radio" /><span className="split-mode-copy"><strong>Split into multiple PDF files</strong><small>Create one separate PDF for each selected page and download them in a ZIP.</small></span><Scissors size={20} /></label>
                <div className="split-selection-summary split-warning">
                  {mode === "extract" ? (
                    <>The <strong>{selectedPages.length} selected page{selectedPages.length === 1 ? "" : "s"}</strong> will be combined into <strong>1 PDF</strong>.</>
                  ) : (
                    <>Selected pages will be converted into separate PDF files. <strong>{selectedPages.length} PDF{selectedPages.length === 1 ? "" : "s"}</strong> will be created.</>
                  )}
                </div>
              </div>
            </>
          )}

          {error && <div className={`merge-message ${/select at least one page|please select at least one page|enter page numbers|please choose a valid pdf/i.test(error) ? "split-warning" : "merge-error"}`}><AlertCircle size={18} />{error}</div>}
          {success && <div className="merge-message merge-success"><CheckCircle2 size={18} />{success}</div>}
          <div className="merge-footer"><button type="button" className="merge-clear-button" onClick={clearFile} disabled={!file || processing}>Clear PDF</button><button type="button" className="merge-submit-button" onClick={mode === "extract" ? extractSelectedPages : splitIntoFiles} disabled={!file || processing || loadingPages}>{processing ? <><LoaderCircle size={17} className="merge-spinner" />Processing…</> : <>{mode === "extract" ? <Download size={17} /> : <Scissors size={17} />}{mode === "extract" ? "Extract pages" : "Split PDF"}</>}</button></div>
        </section>

        <div className="merge-privacy"><ShieldCheck size={19} /><span><strong>Your files stay private.</strong> PDF processing happens in your browser. Your document is not uploaded to a server.</span></div>

        <section className="merge-how"><h2>How to split a PDF</h2><div className="merge-steps"><div><span className="merge-step-number">01</span><h3>Upload your PDF</h3><p>Choose the document you want to split and review its page previews.</p></div><div><span className="merge-step-number">02</span><h3>Choose pages</h3><p>Select pages to extract, or choose how many pages each output file should contain.</p></div><div><span className="merge-step-number">03</span><h3>Download results</h3><p>Save the extracted PDF or download the separate files in a ZIP archive.</p></div></div></section>
      </div>

      {viewerOpen && file && (
        <div className="qt-pdf-modal" role="dialog" aria-modal="true" aria-label={`Page ${viewerPage} preview`} onMouseDown={(event) => { if (event.target === event.currentTarget) setViewerOpen(false); }}>
          <header className="qt-pdf-modal-header"><div className="qt-pdf-modal-title"><FileText size={21} /><div><strong title={file.name}>{file.name}</strong><span>Page {viewerPage} of {pages.length}</span></div></div>
            <div className="qt-pdf-modal-tools"><button type="button" title="Zoom out" aria-label="Zoom out" disabled={viewerZoom <= 0.5} onClick={() => setViewerZoom((value) => Math.max(0.5, +(value - 0.25).toFixed(2)))}><ZoomOut size={19} /></button><span className="qt-pdf-zoom-label">{Math.round(viewerZoom * 100)}%</span><button type="button" title="Zoom in" aria-label="Zoom in" disabled={viewerZoom >= 2.5} onClick={() => setViewerZoom((value) => Math.min(2.5, +(value + 0.25).toFixed(2)))}><ZoomIn size={19} /></button><button type="button" className="qt-pdf-modal-close" title="Close preview" aria-label="Close preview" onClick={() => setViewerOpen(false)}><X size={20} /></button></div>
          </header>
          <div className="qt-pdf-modal-body"><button type="button" className="qt-pdf-page-arrow qt-pdf-page-arrow-left" aria-label="Previous page" disabled={viewerPage <= 1} onClick={() => { setViewerPage((page) => page - 1); setViewerZoom(1); }}><ChevronLeft size={23} /></button><div className="qt-pdf-modal-stage">{viewerLoading && <div className="qt-pdf-modal-loading"><LoaderCircle size={22} className="qt-pdf-spin" />Rendering page…</div>}{viewerError && <div className="qt-pdf-modal-error">{viewerError}</div>}<canvas ref={viewerCanvasRef} className="qt-pdf-modal-canvas" /></div><button type="button" className="qt-pdf-page-arrow qt-pdf-page-arrow-right" aria-label="Next page" disabled={viewerPage >= pages.length} onClick={() => { setViewerPage((page) => page + 1); setViewerZoom(1); }}><ChevronRight size={23} /></button></div>
          <footer className="qt-pdf-modal-footer"><span>Use the arrows to browse pages</span><button type="button" onClick={() => setViewerOpen(false)}><X size={15} />Close preview</button></footer>
        </div>
      )}
    </main>
  );
}
