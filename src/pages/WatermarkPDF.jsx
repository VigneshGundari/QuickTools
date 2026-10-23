import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, PDFArray, StandardFonts, rgb, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
import {
  ArrowLeft, UploadCloud, FileText, X, Plus, Type, Image as ImageIcon,
  Bold, Italic, Underline, Download, LoaderCircle, ShieldCheck,
  AlertCircle, CheckCircle2, ChevronDown, Layers, Trash2, ZoomIn
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";
import "../watermark-pdf.css";
import PDFPreview from "../components/PDFPreview";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const POSITIONS = [
  { id: "top-left", label: "Top left", x: 0.17, y: 0.84 },
  { id: "top-center", label: "Top center", x: 0.5, y: 0.84 },
  { id: "top-right", label: "Top right", x: 0.83, y: 0.84 },
  { id: "middle-left", label: "Middle left", x: 0.17, y: 0.5 },
  { id: "center", label: "Center", x: 0.5, y: 0.5 },
  { id: "middle-right", label: "Middle right", x: 0.83, y: 0.5 },
  { id: "bottom-left", label: "Bottom left", x: 0.17, y: 0.16 },
  { id: "bottom-center", label: "Bottom center", x: 0.5, y: 0.16 },
  { id: "bottom-right", label: "Bottom right", x: 0.83, y: 0.16 },
];
const FONT_OPTIONS = [
  { label: "Helvetica", value: "Helvetica" },
  { label: "Times New Roman", value: "TimesRoman" },
  { label: "Courier New", value: "Courier" },
];
const ROTATIONS = [
  { label: "Do not rotate", value: 0 },
  { label: "Rotate 45°", value: 45 },
  { label: "Rotate 90°", value: 90 },
  { label: "Rotate 180°", value: 180 },
  { label: "Rotate 270°", value: 270 },
];

function bytesLabel(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function cleanName(name) {
  return (name || "document").replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-") || "document";
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function fontFor(font, bold, italic) {
  if (font === "TimesRoman") {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (font === "Courier") {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}
function colorToRgb(hex) {
  const clean = (hex || "#7557dc").replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((v) => v + v).join("") : clean;
  const number = Number.parseInt(value, 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}
function getPositions(selected, mosaic) {
  return mosaic ? POSITIONS : [POSITIONS.find((position) => position.id === selected) || POSITIONS[0]];
}

function PreviewTile({ page, settings, onRemove, fileName, onZoom }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task;
    let renderTask;

    async function render() {
      setLoading(true);
      setFailed(false);

      try {
        const data = new Uint8Array(await page.file.arrayBuffer());
        if (cancelled) return;

        task = pdfjsLib.getDocument({ data });
        const pdf = await task.promise;
        const pdfPage = await pdf.getPage(page.pageNumber);

        if (cancelled) return;

        const viewport = pdfPage.getViewport({ scale: 0.7 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = pdfPage.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
        });

        await renderTask.promise;
      } catch (error) {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
        if (task) task.destroy().catch(() => {});
      }
    }

    render();

    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
      if (task) task.destroy().catch(() => {});
    };
  }, [page.file, page.pageNumber]);

  const position = POSITIONS.find(
    (item) => item.id === settings.position
  ) || POSITIONS[0];

  return (
    <article className="watermark-preview-card">
      <div className="watermark-preview-sheet">
        <canvas
          ref={canvasRef}
          aria-label={`Preview page ${page.pageNumber} of ${fileName}`}
        />

        {loading && (
          <div className="watermark-preview-loading">
            <LoaderCircle size={19} className="merge-spinner" />
          </div>
        )}

        {failed && (
          <div className="watermark-preview-failed">
            <FileText size={25} />
            <small>Preview unavailable</small>
          </div>
        )}

        {!loading && !failed && (
          <span
            className="watermark-position-dot"
            style={{
              left: `${position.x * 100}%`,
              top: `${(1 - position.y) * 100}%`,
            }}
            title={`Watermark position: ${position.label}`}
          />
        )}

        <button
          type="button"
          className="watermark-zoom-button"
          title="Enlarge page preview"
          aria-label={`Enlarge page ${page.pageNumber}`}
          onClick={() => onZoom(page)}
        >
          <ZoomIn size={20} />
        </button>

        <span className="watermark-page-number">
          Page {page.pageNumber}
        </span>
      </div>

      <div className="watermark-preview-caption">
        <div>
          <FileText size={15} />
          <span title={fileName}>{fileName}</span>
        </div>

        <button
          type="button"
          title="Remove this PDF"
          aria-label={`Remove ${fileName}`}
          onClick={onRemove}
        >
          <X size={15} />
        </button>
      </div>
    </article>
  );
}


function ZoomedPDFPage({ page }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let task;
    let renderTask;

    async function renderPage() {
      setLoading(true);
      setFailed(false);

      try {
        const data = new Uint8Array(await page.file.arrayBuffer());
        if (cancelled) return;

        task = pdfjsLib.getDocument({ data });
        const pdf = await task.promise;
        const pdfPage = await pdf.getPage(page.pageNumber);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const maxWidth = Math.max(300, window.innerWidth - 100);
        const maxHeight = Math.max(300, window.innerHeight - 180);
        const scale = Math.min(
          maxWidth / baseViewport.width,
          maxHeight / baseViewport.height,
          2
        );
        const viewport = pdfPage.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = pdfPage.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });

        await renderTask.promise;
      } catch (error) {
        if (!cancelled) {
          console.error("Zoomed PDF preview error:", error);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
      if (task) task.destroy().catch(() => {});
    };
  }, [page.file, page.pageNumber]);

  return (
    <div className="watermark-zoom-page">
      {loading && (
        <div className="watermark-preview-loading">
          <LoaderCircle size={24} className="merge-spinner" />
          <span>Loading page preview…</span>
        </div>
      )}

      {failed && (
        <div className="watermark-preview-failed">
          <FileText size={30} />
          <span>Could not display this page.</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        aria-label={`Enlarged preview of page ${page.pageNumber}`}
        style={{ display: loading || failed ? "none" : "block" }}
      />
    </div>
  );
}

export default function WatermarkPDF() {
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [zoomPage, setZoomPage] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState({
    mode: "text", text: "QuickTools", fontFamily: "Helvetica", fontSize: 36,
    bold: false, italic: false, underline: false, color: "#7557dc", position: "top-left",
    mosaic: false, transparency: 0, rotation: 0, fromPage: 1, toPage: 1, layer: "over",
    imageBytes: null, imageUrl: "", imageType: "",
  });
  const pageCount = useMemo(() => files.reduce((sum, file) => sum + file.pages, 0), [files]);
  const isMulti = files.length > 1;

  useEffect(() => () => {
    if (settings.imageUrl) URL.revokeObjectURL(settings.imageUrl);
  }, [settings.imageUrl]);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const resetMessages = () => { setError(""); setSuccess(""); };

  const loadFiles = useCallback(async (incoming) => {
    const candidates = Array.from(incoming || []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!candidates.length) { setError("Please choose one or more valid PDF files."); return; }
    resetMessages(); setLoading(true);
    const accepted = [];
    try {
      for (const file of candidates) {
        if (files.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
        if (file.size > 100 * 1024 * 1024) { setError(`${file.name} is larger than 100 MB and was skipped.`); continue; }
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const count = pdf.getPageCount();
        if (!count) { setError(`${file.name} does not contain any pages.`); continue; }
        accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`, file, pages: count });
      }
      if (!accepted.length && !files.length) return;
            setFiles((current) => {
        const next = [...current, ...accepted];

        setSelectedFileId((selectedId) =>
          selectedId || next[0]?.id || ""
        );

        return next;
      });
      const total = files.reduce((sum, item) => sum + item.pages, 0) + accepted.reduce((sum, item) => sum + item.pages, 0);
      setSettings((current) => ({ ...current, fromPage: 1, toPage: total || 1 }));
    } catch (loadError) {
      console.error("Watermark PDF load error:", loadError);
      setError("We couldn't read one of those PDFs. Please check that it is valid and not password-protected.");
    } finally { setLoading(false); if (inputRef.current) inputRef.current.value = ""; }
  }, [files]);

  function removeFile(id) {
    const next = files.filter((item) => item.id !== id);

    setFiles(next);

    setSelectedFileId((currentId) => {
      if (currentId !== id && next.some((item) => item.id === currentId)) {
        return currentId;
      }

      return next[0]?.id || "";
    });

    const total = next.reduce((sum, item) => sum + item.pages, 0);

    setSettings((current) => ({
      ...current,
      fromPage: 1,
      toPage: total || 1,
    }));

    setZoomPage(null);
    resetMessages();
  }

  async function chooseImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) { setError("Choose a PNG or JPG image."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Please choose an image smaller than 15 MB."); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = URL.createObjectURL(file);
    setSettings((current) => {
      if (current.imageUrl) URL.revokeObjectURL(current.imageUrl);
      return { ...current, mode: "image", imageBytes: bytes, imageUrl: url, imageType: file.type };
    });
    resetMessages();
  }

  function clearAll() {
    setSelectedFileId("");
    setZoomPage(null);
    setFiles([]); setError(""); setSuccess("");
    setSettings((current) => ({ ...current, fromPage: 1, toPage: 1 }));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function applyWatermark() {
    resetMessages();
    if (!files.length) { setError("Upload at least one PDF first."); return; }
    if (settings.mode === "text" && !settings.text.trim()) { setError("Enter the text you want to use as a watermark."); return; }
    if (settings.mode === "image" && !settings.imageBytes) { setError("Please add an image watermark first."); return; }
    if (!isMulti && (Number(settings.fromPage) < 1 || Number(settings.toPage) < Number(settings.fromPage) || Number(settings.toPage) > files[0].pages)) {
      setError(`Choose a page range between 1 and ${files[0].pages}.`); return;
    }
    setProcessing(true);
    try {
      const outputFiles = [];
      for (const entry of files) {
        const pdf = await PDFDocument.load(await entry.file.arrayBuffer());
        const font = settings.mode === "text" ? await pdf.embedFont(fontFor(settings.fontFamily, settings.bold, settings.italic)) : null;
        let embeddedImage = null;
        if (settings.mode === "image") {
          if (settings.imageType === "image/png") embeddedImage = await pdf.embedPng(settings.imageBytes);
          else embeddedImage = await pdf.embedJpg(settings.imageBytes);
        }
        const pages = pdf.getPages();
        const first = isMulti ? 1 : Math.max(1, Number(settings.fromPage));
        const last = isMulti ? pages.length : Math.min(pages.length, Number(settings.toPage));
        const positions = getPositions(settings.position, settings.mosaic);
        const opacity = 1 - Number(settings.transparency) / 100;
        for (let pageIndex = first - 1; pageIndex < last; pageIndex += 1) {
          const page = pages[pageIndex];
          const { width, height } = page.getSize();
          for (const position of positions) {
            const angle = Number(settings.rotation);
            if (settings.mode === "text") {
              const size = Math.max(1, Number(settings.fontSize) || 36);
              const textWidth = font.widthOfTextAtSize(settings.text, size);
              const textHeight = font.heightAtSize(size);
              // Treat the chosen position as the visual centre of the watermark.
              const centerX = width * position.x;
              const centerY = height * position.y;
              const x = Math.max(0, Math.min(width - Math.min(textWidth, width), centerX - textWidth / 2));
              const y = Math.max(0, Math.min(height - textHeight, centerY - textHeight / 2));
              page.drawText(settings.text, {
                x, y, size, font, color: colorToRgb(settings.color), opacity,
                rotate: degrees(angle),
              });
              // pdf-lib's text border is not an underline; draw a real underline instead.
              if (settings.underline) {
                const underlineY = Math.max(1, y - Math.max(1, size * 0.08));
                page.drawLine({
                  start: { x, y: underlineY },
                  end: { x: Math.min(width, x + textWidth), y: underlineY },
                  thickness: Math.max(0.5, size / 24),
                  color: colorToRgb(settings.color),
                  opacity,
                });
              }
            } else {
              const maxWidth = width * (settings.mosaic ? 0.2 : 0.42);
              const maxHeight = height * (settings.mosaic ? 0.12 : 0.22);
              const dims = embeddedImage.scale(1);
              const scale = Math.min(maxWidth / dims.width, maxHeight / dims.height);
              const drawWidth = dims.width * scale;
              const drawHeight = dims.height * scale;
              page.drawImage(embeddedImage, { x: Math.max(0, Math.min(width - drawWidth, width * position.x - drawWidth / 2)), y: Math.max(0, Math.min(height - drawHeight, height * position.y - drawHeight / 2)), width: drawWidth, height: drawHeight, opacity, rotate: degrees(angle) });
            }
          }
          // Watermark drawing is stored in its own trailing content stream by pdf-lib.
          // Move that stream to the beginning when the user selects "below".
          if (settings.layer === "below") {
            const contents = page.node.Contents();
            if (contents instanceof PDFArray && contents.size() > 1) {
              const lastIndex = contents.size() - 1;
              const watermarkStream = contents.get(lastIndex);
              contents.remove(lastIndex);
              contents.insert(0, watermarkStream);
            }
          }
        }
        const bytes = await pdf.save();
        outputFiles.push({ name: `${cleanName(entry.file.name)}-watermarked.pdf`, bytes });
      }
      if (outputFiles.length === 1) {
        saveBlob(new Blob([outputFiles[0].bytes], { type: "application/pdf" }), outputFiles[0].name);
        setSuccess("Your watermarked PDF is ready to download.");
      } else {
        const zip = new JSZip();
        outputFiles.forEach((item) => zip.file(item.name, item.bytes));
        const blob = await zip.generateAsync({ type: "blob" });
        saveBlob(blob, "quicktools-watermarked-pdfs.zip");
        setSuccess(`${outputFiles.length} watermarked PDFs are ready. All files were downloaded together as a ZIP.`);
      }
    } catch (processError) {
      console.error("Watermark PDF processing error:", processError);
      setError("We couldn't apply the watermark. Please check that the PDF and image are valid, then try again.");
    } finally { setProcessing(false); }
  }

  const allPages = useMemo(() => files.flatMap((entry) => Array.from({ length: entry.pages }, (_, index) => ({ id: `${entry.id}-${index + 1}`, file: entry.file, pageNumber: index + 1, fileId: entry.id }))), [files]);
  const selectedFile = files.find(
    (entry) => entry.id === selectedFileId
  ) || files[0];

  const visiblePages = allPages.filter(
    (page) => page.fileId === selectedFile?.id
  );

  return (
    <main className="merge-page watermark-tool-page">
      <div className="merge-container watermark-container">
        <Link to="/" className="merge-back"><ArrowLeft size={17} />Back to all tools</Link>
        <header className="merge-heading">
          <div className="merge-heading-icon"><Type size={27} /></div>
          <div><span className="merge-eyebrow">PDF TOOL</span><h1>Watermark PDF</h1><p>Add a text or image watermark to your PDF documents.</p></div>
        </header>

        {!files.length ? (
          <section className="merge-workspace watermark-upload-workspace">
            <div className="merge-workspace-top"><div><h2>Watermark your PDFs</h2><p>Upload one or more PDFs, customize your watermark, and download.</p></div></div>
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={(event) => loadFiles(event.target.files)} />
            <button type="button" className={`merge-dropzone${dragging ? " is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); loadFiles(event.dataTransfer.files); }}>
              <span className="merge-upload-icon"><UploadCloud size={27} /></span><strong>{loading ? "Reading your PDFs…" : "Choose PDFs to watermark"}</strong><span>Click to browse or drag and drop multiple PDF files.</span><small>PDF files only · Maximum 100 MB per file</small>
            </button>
            {error && <div className="merge-message merge-error"><AlertCircle size={18} />{error}</div>}
            
            <div className="watermark-empty-actions">
              <button
                type="button"
                className="watermark-clear-link"
                disabled
                title="Upload a PDF first"
              >
                <Trash2 size={15} />
                Clear all PDFs
              </button>

              <button
                type="button"
                className="watermark-submit"
                disabled
                title="Upload a PDF first"
              >
                Add watermark <Download size={18} />
              </button>
            </div>

          </section>
          
        ) : (
          <section className="watermark-editor">
            <div className="watermark-preview-area">
              <div className="watermark-preview-topbar"><div><strong>Your PDF files</strong><span>{files.length} file{files.length === 1 ? "" : "s"} · {bytesLabel(files.reduce((sum, item) => sum + item.file.size, 0))} · {pageCount} pages</span></div><button type="button" className="merge-add-button" onClick={() => inputRef.current?.click()}><Plus size={16} />Add PDFs</button></div>
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={(event) => loadFiles(event.target.files)} />
              <div className="watermark-file-selector">
                <div className="watermark-file-select-wrap">
                  <FileText size={17} />

                  <select
                    aria-label="Choose PDF to preview"
                    value={selectedFileId}
                    onChange={(event) => setSelectedFileId(event.target.value)}
                  >
                    {files.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.file.name} — {entry.pages} page
                        {entry.pages === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>

                  <ChevronDown size={15} className="watermark-select-chevron" />
                </div>

                <button
                  type="button"
                  className="watermark-remove-selected"
                  title="Remove selected PDF"
                  aria-label="Remove selected PDF"
                  onClick={() => {
                    if (selectedFileId) removeFile(selectedFileId);
                  }}
                  disabled={!selectedFileId}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              {loading && <div className="watermark-loading-line"><LoaderCircle size={18} className="merge-spinner" />Loading PDFs…</div>}
              <div className="watermark-preview-grid">
                {visiblePages.map((page) => (
                  <PreviewTile
                    key={page.id}
                    page={page}
                    fileName={page.file.name}
                    settings={settings}
                    onRemove={() => removeFile(page.fileId)}
                    onZoom={setZoomPage}
                  />
                ))}
              </div>
              <div className="watermark-preview-foot"><span>Preview updates as you change your watermark settings.</span><button type="button" className="watermark-clear-link" onClick={clearAll}><Trash2 size={14} />Clear all PDFs</button></div>
            </div>

            <aside className="watermark-settings-panel">
              <div className="watermark-panel-heading"><h2>Watermark options</h2><p>Customize how your watermark looks.</p></div>
              <div className="watermark-mode-tabs">
                <button type="button" className={settings.mode === "text" ? "active" : ""} onClick={() => update("mode", "text")}><Type size={23} /><span>Place text</span></button>
                <button type="button" className={settings.mode === "image" ? "active" : ""} onClick={() => update("mode", "image")}><ImageIcon size={23} /><span>Place image</span></button>
              </div>
              {settings.mode === "text" ? <div className="watermark-control-block">
                <label className="watermark-label" htmlFor="watermark-text">Text</label>
                <input id="watermark-text" className="watermark-text-input" value={settings.text} onChange={(event) => update("text", event.target.value)} placeholder="Enter watermark text" maxLength={100} />
                <label className="watermark-label">Text format</label>
                <div className="watermark-format-row">
                  <label className="watermark-font-select"><span className="sr-only">Font family</span><select value={settings.fontFamily} onChange={(event) => update("fontFamily", event.target.value)}>{FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select><ChevronDown size={13} /></label>
                  <label className="watermark-size-select"><span className="sr-only">Font size</span><select value={settings.fontSize} onChange={(event) => update("fontSize", Number(event.target.value))}>{[12,16,20,24,28,32,36,42,48,56,64,72].map((size) => <option key={size} value={size}>{size}px</option>)}</select></label>
                  <button type="button" className={`watermark-format-btn${settings.bold ? " active" : ""}`} title="Bold" aria-pressed={settings.bold} onClick={() => update("bold", !settings.bold)}><Bold size={16} /></button>
                  <button type="button" className={`watermark-format-btn${settings.italic ? " active" : ""}`} title="Italic" aria-pressed={settings.italic} onClick={() => update("italic", !settings.italic)}><Italic size={16} /></button>
                  <button type="button" className={`watermark-format-btn${settings.underline ? " active" : ""}`} title="Underline" aria-pressed={settings.underline} onClick={() => update("underline", !settings.underline)}><Underline size={16} /></button>
                  <label
                      className="watermark-color-picker"
                      title="Choose text color"
                    >
                      <span className="watermark-color-letter">A</span>
                      <span
                        className="watermark-color-underline"
                        style={{ backgroundColor: settings.color }}
                      />

                      <input
                        type="color"
                        value={settings.color}
                        aria-label="Choose watermark text color"
                        onChange={(event) => update("color", event.target.value)}
                      />

                      <ChevronDown size={12} />
                    </label>
                </div>
              </div> : <div className="watermark-control-block">
                <label className="watermark-label">Image watermark</label>
                <input ref={imageRef} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => chooseImage(event.target.files?.[0])} />
                <button type="button" className="watermark-image-upload" onClick={() => imageRef.current?.click()}><span><ImageIcon size={19} /></span><div><strong>{settings.imageUrl ? "Change image" : "Add image"}</strong><small>PNG or JPG · Up to 15 MB</small></div><Plus size={17} /></button>
                {settings.imageUrl && <div className="watermark-image-selected"><img src={settings.imageUrl} alt="Selected watermark" /><span>Image selected</span><button type="button" onClick={() => { URL.revokeObjectURL(settings.imageUrl); update("imageUrl", ""); update("imageBytes", null); update("imageType", ""); }} aria-label="Remove image"><X size={15} /></button></div>}
              </div>}

              <div className="watermark-control-block watermark-position-block">
                <label className="watermark-label">Position</label>
                <div className="watermark-position-line">
                  <div className="watermark-position-grid" role="group" aria-label="Watermark position">
                    {POSITIONS.map((position) => <button type="button" key={position.id} className={`${settings.position === position.id ? "selected" : ""}${settings.mosaic ? " mosaic-selected" : ""}`} title={position.label} aria-label={position.label} aria-pressed={settings.mosaic || settings.position === position.id} onClick={() => update("position", position.id)}><span /></button>)}
                  </div>
                  <label className="watermark-mosaic-toggle"><input type="checkbox" checked={settings.mosaic} onChange={(event) => update("mosaic", event.target.checked)} /><span className="watermark-custom-checkbox" /><span><strong>Mosaic</strong><small>Repeat across the page</small></span></label>
                </div>
                {settings.mosaic && <p className="watermark-control-hint">All 9 positions are selected automatically for mosaic.</p>}
              </div>

              <div className="watermark-control-block watermark-two-col">
                <label><span className="watermark-label">Transparency</span><select value={settings.transparency} onChange={(event) => update("transparency", Number(event.target.value))}><option value={0}>No transparency</option><option value={15}>15%</option><option value={30}>30%</option><option value={50}>50%</option><option value={70}>70%</option><option value={85}>85%</option></select></label>
                <label><span className="watermark-label">Rotation</span><select value={settings.rotation} onChange={(event) => update("rotation", Number(event.target.value))}>{ROTATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              </div>

              {!isMulti && <div className="watermark-control-block watermark-pages-block"><label className="watermark-label">Pages</label><div className="watermark-page-range"><label><span>from page</span><input type="number" min="1" max={files[0].pages} value={settings.fromPage} onChange={(event) => update("fromPage", event.target.value)} /></label><label><span>to</span><input type="number" min="1" max={files[0].pages} value={settings.toPage} onChange={(event) => update("toPage", event.target.value)} /></label></div><small>PDF contains {files[0].pages} page{files[0].pages === 1 ? "" : "s"}.</small></div>}

              <div className="watermark-control-block watermark-layer-block"><label className="watermark-label">Layer</label><div className="watermark-layer-options"><button type="button" className={settings.layer === "over" ? "active" : ""} onClick={() => update("layer", "over")}><Layers size={21} /><span>Over the PDF content</span></button><button type="button" className={settings.layer === "below" ? "active" : ""} onClick={() => update("layer", "below")}><Layers size={21} className="watermark-below-icon" /><span>Below the PDF content</span></button></div><small className="watermark-control-hint">{settings.layer === "below" ? "The watermark is placed behind existing page content where the PDF content-stream structure allows it." : "The watermark is placed over existing page content."}</small></div>

              {error && <div className="merge-message merge-error watermark-panel-message"><AlertCircle size={17} />{error}</div>}
              {success && <div className="merge-message merge-success watermark-panel-message"><CheckCircle2 size={17} />{success}</div>}
              <button type="button" className="watermark-submit" onClick={applyWatermark} disabled={processing || loading || !files.length}>{processing ? <><LoaderCircle size={19} className="merge-spinner" />Applying watermark…</> : <>Add watermark <Download size={19} /></>}</button>
            </aside>
          </section>
        )}

        {zoomPage && (
          <div
            className="watermark-zoom-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setZoomPage(null);
              }
            }}
            role="presentation"
          >
            <section
              className="watermark-zoom-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Preview page ${zoomPage.pageNumber}`}
            >
              <header className="watermark-zoom-header">
                <div>
                  <strong>{zoomPage.file.name}</strong>
                  <span>Page {zoomPage.pageNumber}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomPage(null)}
                  aria-label="Close enlarged preview"
                  title="Close"
                >
                  <X size={21} />
                </button>
              </header>

              <div className="watermark-zoom-content">
                <ZoomedPDFPage page={zoomPage} />
              </div>
            </section>
          </div>
        )}

        <div className="merge-privacy"><ShieldCheck size={19} /><span><strong>Your files stay private.</strong> PDF processing happens in your browser. Your document is not uploaded to a server.</span></div>
        {!files.length && <section className="merge-how"><h2>How to watermark a PDF</h2><div className="merge-steps"><div><span className="merge-step-number">01</span><h3>Upload PDFs</h3><p>Choose one or more PDF documents from your device.</p></div><div><span className="merge-step-number">02</span><h3>Customize</h3><p>Choose text or an image and adjust position, transparency, and rotation.</p></div><div><span className="merge-step-number">03</span><h3>Download</h3><p>Download your watermarked PDF or all processed PDFs in one ZIP.</p></div></div></section>}
      </div>
    </main>
  );
}
