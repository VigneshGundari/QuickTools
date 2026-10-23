import React, { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
import {
  ArrowLeft, ArrowRight, AlertCircle, Download, FileText, LoaderCircle,
  ShieldCheck, UploadCloud, X, ZoomIn, ZoomOut, RotateCw, Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
const safeBaseName = (name) => name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "document";
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
function isPdf(file) {
  return file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
}

function PdfFileCard({ item, index, onZoom, onRotate, onRemove, disabled }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let renderTask;
    let pdf;
    const render = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;
        const rotation = ((item.rotation || 0) + (page.rotate || 0)) % 360;
        const base = page.getViewport({ scale: 1, rotation });
        const maxWidth = 230;
        const maxHeight = 300;
        const scale = Math.min(maxWidth / base.width, maxHeight / base.height, 1.2);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
        });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          console.error("Compress PDF preview error:", error);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
        try { await pdf?.destroy(); } catch { /* PDF preview cleanup */ }
      }
    };
    render();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* render may already be complete */ }
      try { loadingTask?.destroy(); } catch { /* loading may already be complete */ }
    };
  }, [item.file, item.rotation]);

  return (
    <article className="compress-pdf-card">
      <div className="compress-pdf-card-preview">
        <span className="compress-pdf-type">PDF</span>
        <div className="compress-pdf-page-wrap">
          <canvas ref={canvasRef} aria-label={`First page preview of ${item.file.name}`} />
          {loading && <div className="compress-pdf-preview-state"><LoaderCircle size={22} className="compress-spinner" /></div>}
          {failed && <div className="compress-pdf-preview-state compress-pdf-fallback"><FileText size={34} /><small>Preview unavailable</small></div>}
        </div>
        <div className="compress-pdf-hover-actions">
          <button type="button" title="Rotate PDF 90°" aria-label={`Rotate ${item.file.name}`} onClick={() => onRotate(index)} disabled={disabled}><RotateCw size={18} /></button>
          <button type="button" title="Enlarge preview" aria-label={`Enlarge ${item.file.name} preview`} onClick={() => onZoom(index)} disabled={disabled}><ZoomIn size={19} /><Plus size={10} className="compress-pdf-plus" /></button>
          <button type="button" title="Remove PDF" aria-label={`Remove ${item.file.name}`} onClick={() => onRemove(index)} disabled={disabled}><X size={18} /></button>
        </div>
      </div>
      <div className="compress-pdf-card-details">
        <span className="compress-pdf-file-icon"><FileText size={21} /></span>
        <span className="compress-pdf-file-info"><strong title={item.file.name}>{item.file.name}</strong><small>{formatBytes(item.file.size)}{item.rotation ? ` · Rotated ${item.rotation}°` : ""}</small></span>
      </div>
    </article>
  );
}

function PdfZoomModal({ item, onClose }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    setPageNumber(1);
    setPageCount(0);
    setZoom(1);
    setRotation(item?.rotation || 0);
    setError(false);
  }, [item?.file]);
  useEffect(() => {
    if (!item) return undefined;
    let cancelled = false;
    let loadingTask;
    let renderTask;
    let pdf;
    (async () => {
      try {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: zoom, rotation: ((rotation || 0) + (page.rotate || 0)) % 360 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* already complete */ }
      try { loadingTask?.destroy(); } catch { /* already complete */ }
      try { pdf?.destroy(); } catch { /* already complete */ }
    };
  }, [item, pageNumber, zoom, rotation]);
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setPageNumber((page) => Math.max(1, page - 1));
      if (event.key === "ArrowRight") setPageNumber((page) => Math.min(pageCount || 1, page + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);
  if (!item) return null;
  return (
    <div className="compress-pdf-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="compress-pdf-modal" role="dialog" aria-modal="true" aria-label={`Preview ${item.file.name}`}>
        <header className="compress-pdf-modal-toolbar">
          <div className="compress-pdf-modal-file"><FileText size={19} /><div><strong>{item.file.name}</strong><small>Page {pageNumber} of {pageCount || "…"}</small></div></div>
          <div className="compress-pdf-modal-actions">
            <button type="button" title="Rotate preview" aria-label="Rotate preview" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw size={19} /></button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.15).toFixed(2)))}><ZoomOut size={19} /></button>
            <span className="compress-pdf-zoom-level">{Math.round(zoom * 100)}%</span>
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.5, +(value + 0.15).toFixed(2)))}><ZoomIn size={19} /></button>
            <button type="button" title="Close preview" aria-label="Close preview" onClick={onClose}><X size={21} /></button>
          </div>
        </header>
        <div className="compress-pdf-modal-content">
          {error ? <div className="compress-pdf-preview-state compress-pdf-fallback"><FileText size={36} /><span>Preview unavailable</span></div> : <canvas ref={canvasRef} />}
        </div>
        <button className="compress-pdf-page-arrow compress-pdf-page-arrow-left" type="button" aria-label="Previous page" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1}><ArrowLeft size={23} /></button>
        <button className="compress-pdf-page-arrow compress-pdf-page-arrow-right" type="button" aria-label="Next page" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))} disabled={!pageCount || pageNumber >= pageCount}><ArrowRight size={23} /></button>
        <footer className="compress-pdf-modal-pagination"><button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1}><span>‹</span> Previous</button><strong>{pageNumber} / {pageCount || "…"}</strong><button type="button" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))} disabled={!pageCount || pageNumber >= pageCount}>Next <span>›</span></button></footer>
      </section>
    </div>
  );
}

async function optimizePdf(item, level) {
  const presets = {
    extreme: {
      label: "Extreme",
      pdfSettings: "/screen",
      imageResolution: 60,
      grayResolution: 60,
      monoResolution: 150,
      jpegQuality: 35,
    },
    recommended: {
      label: "Recommended",
      pdfSettings: "/ebook",
      imageResolution: 150,
      grayResolution: 150,
      monoResolution: 300,
      jpegQuality: 75,
    },
    less: {
      label: "Less Compression",
      pdfSettings: "/printer",
      imageResolution: 300,
      grayResolution: 300,
      monoResolution: 600,
      jpegQuality: 90,
    },
  };
  const preset = presets[level] || presets.recommended;

  // Apply requested page rotation structurally before Ghostscript processes the PDF.
  // This keeps page text/vector content intact; it does not rasterize every page.
  const sourceBytes = await item.file.arrayBuffer();
  let inputBytes = new Uint8Array(sourceBytes);

  if (item.rotation) {
    const rotatedPdf = await PDFDocument.load(inputBytes);
    rotatedPdf.getPages().forEach((page) => {
      const angle = ((page.getRotation().angle + item.rotation) % 360 + 360) % 360;
      page.setRotation(degrees(angle));
    });
    inputBytes = await rotatedPdf.save({ useObjectStreams: true, addDefaultPage: false });
  }

  let gs;
  try {
    // This package runs Ghostscript in WebAssembly in the browser.
    // Install it in the project: npm install @wasm-zoo/ghostscript
    const { load } = await import("@wasm-zoo/ghostscript");
    gs = await load();

    const outputPath = "/out/compressed.pdf";
    const result = await gs.exec(
      [
        "-dSAFER",
        "-dBATCH",
        "-dNOPAUSE",
        "-dQUIET",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        `-dPDFSETTINGS=${preset.pdfSettings}`,
        "-dDownsampleColorImages=true",
        `-dColorImageResolution=${preset.imageResolution}`,
        "-dDownsampleGrayImages=true",
        `-dGrayImageResolution=${preset.grayResolution}`,
        "-dDownsampleMonoImages=true",
        `-dMonoImageResolution=${preset.monoResolution}`,
        "-dAutoFilterColorImages=false",
        "-dColorImageFilter=/DCTEncode",
        "-dAutoFilterGrayImages=false",
        "-dGrayImageFilter=/DCTEncode",
        `-dJPEGQ=${preset.jpegQuality}`,
        `-sOutputFile=${outputPath}`,
        "/input.pdf",
      ],
      {
        files: [{ name: "/input.pdf", data: inputBytes }],
        dirs: ["/out"],
        outputs: [outputPath],
      }
    );

    const outputFile = result?.files?.find((file) => file.name === outputPath);
    if (!outputFile?.data || outputFile.data.byteLength === 0) {
      throw new Error("Ghostscript did not return a compressed PDF.");
    }

    const compressedBytes = outputFile.data instanceof Uint8Array
      ? outputFile.data
      : new Uint8Array(outputFile.data);
    // Validate the output signature before offering it as a PDF download.
    const signature = new TextDecoder("ascii").decode(compressedBytes.subarray(0, 5));
    if (signature !== "%PDF-") {
      throw new Error("The compression engine returned an invalid PDF file.");
    }

    const compressedBlob = new Blob([compressedBytes], { type: "application/pdf" });

    // For unrotated files, never return a larger result when the original is
    // available unchanged. Rotated files must use the processed result so the
    // user's requested rotation is retained.
    const originalBlob = new Blob([sourceBytes], { type: "application/pdf" });
    if (!item.rotation && originalBlob.size <= compressedBlob.size) return originalBlob;
    return compressedBlob;
  } catch (error) {
    console.error("Ghostscript PDF compression failed:", error);
    throw new Error(
      error?.message?.includes("Failed to fetch") || error?.message?.includes("fetch")
        ? "The compression engine could not load. Check your internet connection and try again."
        : "Compression failed for this PDF. It may be encrypted, damaged, or unsupported. Your original file has not been changed."
    );
  } finally {
    try { gs?.dispose?.(); } catch { /* Ghostscript cleanup */ }
  }
}

export default function CompressPDF() {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [compression, setCompression] = useState("recommended");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(null);
  const totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
  const zoomItem = zoomIndex == null ? null : files[zoomIndex] || null;
  const showMessage = (text) => setMessage(text);

  const addFiles = useCallback((list) => {
    const selected = Array.from(list || []);
    if (!selected.length) return;
    const pdfs = selected.filter(isPdf);
    if (!pdfs.length) { showMessage("Please choose at least one valid PDF file."); return; }
    setFiles((current) => {
      const keys = new Set(current.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
      const unique = pdfs.filter((file) => !keys.has(`${file.name}-${file.size}-${file.lastModified}`));
      if (!unique.length) { showMessage("These PDF files have already been added."); return current; }
      const next = [...current, ...unique.map((file) => ({ file, rotation: 0 }))];
      setResults([]);
      if (selected.length !== pdfs.length) showMessage("Only PDF files were added. Other file types were skipped.");
      else showMessage("");
      return next;
    });
  }, []);

  function removeFile(index) {
    setFiles((current) => current.filter((_, i) => i !== index));
    setResults([]); showMessage("");
    setZoomIndex((current) => current == null ? null : current === index ? null : current > index ? current - 1 : current);
  }
  function rotateFile(index) {
    setFiles((current) => current.map((item, i) => i === index ? { ...item, rotation: (item.rotation + 90) % 360 } : item));
    setResults([]); showMessage("");
  }
  function clearFiles() {
    setFiles([]); setResults([]); setZoomIndex(null); showMessage("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function startCompression() {
    if (processing) return;
    if (!files.length) { showMessage("Please upload at least one PDF before optimizing."); return; }
    setProcessing(true); setResults([]); showMessage("");
    try {
      const processed = [];
      for (const item of files) {
        const blob = await optimizePdf(item, compression);
        processed.push({ originalName: item.file.name, outputName: `${safeBaseName(item.file.name)}-optimized.pdf`, originalSize: item.file.size, outputSize: blob.size, blob });
      }
      setResults(processed);
      if (processed.length === 1) downloadBlob(processed[0].blob, processed[0].outputName);
      else {
        const zip = new JSZip();
        processed.forEach((item) => zip.file(item.outputName, item.blob));
        downloadBlob(await zip.generateAsync({ type: "blob" }), "quicktools-optimized-pdfs.zip");
      }
      const savedBytes = processed.reduce((sum, item) => sum + Math.max(0, item.originalSize - item.outputSize), 0);
      const reducedCount = processed.filter((item) => item.outputSize < item.originalSize).length;
      const sizeSummary = processed.length === 1
        ? `Original: ${formatBytes(processed[0].originalSize)} · Result: ${formatBytes(processed[0].outputSize)}.`
        : `${reducedCount} of ${processed.length} PDFs became smaller.`;
      showMessage(reducedCount === processed.length
        ? `Compression complete. Saved ${formatBytes(savedBytes)}. ${sizeSummary}`
        : `Processing complete. ${sizeSummary} Some PDFs may already be optimized or contain mostly text/vector content, which has less room for this browser-based compression method.`);
    } catch (error) {
      console.error("Compress PDF error:", error);
      showMessage(error?.message?.toLowerCase().includes("encrypted") ? "This PDF appears to be password-protected. Remove its password and upload it again." : "We couldn't process this PDF. It may be damaged or password-protected. Please try another PDF.");
    } finally { setProcessing(false); }
  }

  return (
    <main className="merge-page compress-tool-page">
      <div className="merge-container">
        <Link to="/" className="merge-back"><ArrowLeft size={17} />Back to all tools</Link>
        <header className="merge-heading"><div className="merge-heading-icon"><FileText size={27} /></div><div><span className="merge-eyebrow">PDF TOOL</span><h1>Compress PDF</h1><p>Optimize PDF documents and download processed copies.</p></div></header>
        <section className="merge-workspace">
          <div className="compress-pdf-files-heading">
            <div><h2>Your PDF files</h2><p>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected · ${formatBytes(totalSize)}` : "Choose PDF files to get started."}</p></div>
            {files.length > 0 && <button type="button" className="compress-pdf-select-button" onClick={() => fileRef.current?.click()} disabled={processing}><Plus size={19} />Select PDF files</button>}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          {files.length === 0 ? (
            <button type="button" className="merge-dropzone" onClick={() => fileRef.current?.click()}>
              <span className="merge-upload-icon"><UploadCloud size={27} /></span><strong>Choose PDF files</strong><span>Select one or more PDFs to optimize.</span><small>PDF files only · Your files stay on your device</small>
            </button>
          ) : (
            <>
              <div className="compress-pdf-instruction"><strong>Review your PDFs before optimizing.</strong><span>Use the card controls to preview, rotate, or remove a PDF.</span></div>
              <div className="compress-pdf-list-heading"><h2>Uploaded PDFs</h2><span>{files.length} PDF{files.length === 1 ? "" : "s"}</span></div>
              <div className="qt-pdf-gallery compress-pdf-grid">{files.map((item, index) => <PdfFileCard key={`${item.file.name}-${item.file.size}-${item.file.lastModified}`} item={item} index={index} onZoom={setZoomIndex} onRotate={rotateFile} onRemove={removeFile} disabled={processing} />)}</div>
              <button type="button" className="compress-pdf-add-another" onClick={() => fileRef.current?.click()} disabled={processing}><Plus size={18} />Add another PDF</button>
              <div className="compress-pdf-options">
                <h3>Optimization level</h3>
                <div className="compress-pdf-option-grid">
                  <label><input type="radio" name="compress-level" value="extreme" checked={compression === "extreme"} onChange={(event) => setCompression(event.target.value)} disabled={processing} /><span><strong>Extreme Compression</strong><small>Less quality, high compression</small></span></label>
                  <label><input type="radio" name="compress-level" value="recommended" checked={compression === "recommended"} onChange={(event) => setCompression(event.target.value)} disabled={processing} /><span><strong>Recommended Compression</strong><small>Good quality, good compression</small></span></label>
                  <label><input type="radio" name="compress-level" value="less" checked={compression === "less"} onChange={(event) => setCompression(event.target.value)} disabled={processing} /><span><strong>Less Compression</strong><small>High quality, less compression</small></span></label>
                </div>
                <p className="compress-pdf-note">Compression runs locally using Ghostscript WebAssembly. Extreme prioritizes smaller files, Recommended balances size and clarity, and Less Compression prioritizes quality. Text and vector content are generally preserved, but image quality and some advanced PDF features may change. Already-optimized PDFs may show little or no reduction.</p>
              </div>
            </>
          )}
          {message && <div className="merge-message split-warning" role="status"><AlertCircle size={18} /><span>{message}</span></div>}
          <div className="merge-footer"><button type="button" className="merge-clear-button" onClick={clearFiles} disabled={!files.length || processing}>Clear all</button><button type="button" className="merge-submit-button" onClick={startCompression} disabled={processing}>{processing ? <><LoaderCircle size={17} className="compress-spinner" />Optimizing…</> : <><Download size={17} />Compress PDFs</>}</button></div>
        </section>
        <div className="merge-privacy"><ShieldCheck size={19} /><span><strong>Your files stay private.</strong> Processing happens in your browser; your documents are not uploaded to a server.</span></div>
        <section className="merge-how"><h2>How to compress a PDF</h2><div className="merge-steps"><div><span className="merge-step-number">01</span><h3>Upload PDFs</h3><p>Choose one or more PDF documents.</p></div><div><span className="merge-step-number">02</span><h3>Review files</h3><p>Preview, rotate, or remove files before processing.</p></div><div><span className="merge-step-number">03</span><h3>Download</h3><p>Save your processed PDF files.</p></div></div></section>
      </div>
      <PdfZoomModal item={zoomItem} onClose={() => setZoomIndex(null)} />
    </main>
  );
}
