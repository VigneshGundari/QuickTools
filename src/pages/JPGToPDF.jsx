
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import {
  ArrowLeft, AlertCircle, Download, FileImage, LoaderCircle,
  ShieldCheck, UploadCloud, Plus, RotateCw, ZoomIn, X,
  ChevronLeft, ChevronRight, RectangleVertical,
  RectangleHorizontal, Scan, Check, Trash2
} from "lucide-react";
import { Link } from "react-router-dom";
import "../styles.css";
import "../jpg-to-pdf.css";

const MAX_FILE_SIZE = 30 * 1024 * 1024;

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const MARGINS = { none: 0, small: 18, big: 48 };

function formatBytes(bytes) {
  return bytes
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : "0 MB";
}

function isSupportedImage(file) {
  return ["image/jpeg", "image/png"].includes(file.type) ||
    /\.(jpe?g|png)$/i.test(file.name);
}

function safeFilename(name) {
  return name.replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-").trim() || "images";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not open ${file.name}.`));
    };

    image.src = url;
  });
}

function getPageDimensions(pageSize, orientation, item) {
  if (pageSize === "original") {
    const width = item.width || 800;
    const height = item.height || 1000;

    return item.rotation % 180 !== 0
      ? [height, width]
      : [width, height];
  }

  let [width, height] = PAGE_SIZES[pageSize];

  if (
    (orientation === "landscape" && height > width) ||
    (orientation === "portrait" && width > height)
  ) {
    [width, height] = [height, width];
  }

  return [width, height];
}

function OptionCard({ active, icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      className={`jpg-pdf-option-card${active ? " active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ImagePreviewCard({
  item,
  index,
  pageSize,
  orientation,
  margin,
  fitMode,
  onRemove,
  onRotate,
  onZoom,
  disabled,
}) {
  const [failed, setFailed] = useState(false);

  const [pageWidth, pageHeight] = getPageDimensions(
    pageSize,
    orientation,
    item
  );

  const marginValue = pageSize === "original" ? 0 : MARGINS[margin];
  const insetTop = (marginValue / pageHeight) * 100;
  const insetSide = (marginValue / pageWidth) * 100;

  return (
    <article className="jpg-pdf-image-card">
      <div className="jpg-pdf-image-preview">
        <div
          className="jpg-pdf-paper"
          style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
        >
          <div
            className={`jpg-pdf-paper-content jpg-pdf-fit-${fitMode}`}
            style={{ inset: `${insetTop}% ${insetSide}%` }}
          >
            {failed ? (
              <div className="jpg-pdf-image-fallback">
                <FileImage size={25} />
                <span>Preview unavailable</span>
              </div>
            ) : (
              <img
                src={item.previewUrl}
                alt={`PDF page ${index + 1}`}
                onError={() => setFailed(true)}
                style={{ transform: `rotate(${item.rotation}deg)` }}
              />
            )}
          </div>
        </div>

        <div className="jpg-pdf-image-actions">
          <button
            type="button"
            title="Rotate image 90°"
            aria-label={`Rotate ${item.file.name}`}
            onClick={() => onRotate(index)}
            disabled={disabled}
          >
            <RotateCw size={17} />
          </button>

          <button
            type="button"
            title="Enlarge image"
            aria-label={`Preview ${item.file.name}`}
            onClick={() => onZoom(index)}
            disabled={disabled}
          >
            <ZoomIn size={18} />
          </button>

          <button
            type="button"
            title="Remove image"
            aria-label={`Remove ${item.file.name}`}
            onClick={() => onRemove(index)}
            disabled={disabled}
          >
            <X size={17} />
          </button>
        </div>

        <span className="jpg-pdf-image-number">{index + 1}</span>
      </div>

      <div className="jpg-pdf-image-details">
        <FileImage size={19} className="jpg-pdf-file-icon" />

        <span className="jpg-pdf-file-info">
          <strong title={item.file.name}>{item.file.name}</strong>
          <small>
            {formatBytes(item.file.size)}
            {item.rotation ? ` · Rotated ${item.rotation}°` : ""}
          </small>
        </span>
      </div>
    </article>
  );
}

function ImageZoomModal({
  item,
  onClose,
  onRotate,
  onPrevious,
  onNext,
  index,
  total,
}) {
  useEffect(() => {
    if (!item) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === "ArrowRight") onNext();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose, onPrevious, onNext]);

  if (!item) return null;

  return (
    <div
      className="jpg-pdf-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="jpg-pdf-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${item.file.name}`}
      >
        <header className="jpg-pdf-modal-toolbar">
          <div className="jpg-pdf-modal-title">
            <FileImage size={20} />
            <div>
              <strong title={item.file.name}>{item.file.name}</strong>
              <small>Image {index + 1} of {total}</small>
            </div>
          </div>

          <div className="jpg-pdf-modal-actions">
            <button
              type="button"
              onClick={() => onRotate(index)}
              title="Rotate image"
              aria-label="Rotate image"
            >
              <RotateCw size={19} />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close preview"
              aria-label="Close preview"
            >
              <X size={21} />
            </button>
          </div>
        </header>

        <div className="jpg-pdf-modal-content">
          <img
            src={item.previewUrl}
            alt={item.file.name}
            style={{ transform: `rotate(${item.rotation}deg)` }}
          />
        </div>

        <footer className="jpg-pdf-modal-pagination">
          <button
            type="button"
            onClick={onPrevious}
            disabled={index <= 0}
          >
            <ChevronLeft size={17} /> Previous
          </button>

          <strong>{index + 1} / {total}</strong>

          <button
            type="button"
            onClick={onNext}
            disabled={index >= total - 1}
          >
            Next <ChevronRight size={17} />
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function JPGToPDF() {
  const fileRef = useRef(null);
  const dragCounter = useRef(0);
  const previewUrlsRef = useRef(new Set());

  const [files, setFiles] = useState([]);
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("portrait");
  const [margin, setMargin] = useState("none");
  const [fitMode, setFitMode] = useState("contain");
  const [mergeAll, setMergeAll] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [zoomIndex, setZoomIndex] = useState(null);

  const totalSize = files.reduce(
    (sum, item) => sum + item.file.size,
    0
  );

  const zoomItem = zoomIndex == null ? null : files[zoomIndex] || null;

  const releasePreview = useCallback((url) => {
    if (!url) return;

    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }, []);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const addFiles = useCallback((fileList) => {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const images = selected.filter(isSupportedImage);
    const oversized = images.filter((file) => file.size > MAX_FILE_SIZE);
    const valid = images.filter((file) => file.size <= MAX_FILE_SIZE);

    if (!valid.length) {
      setMessage(
        oversized.length
          ? "Each image must be smaller than 30 MB."
          : "Please select JPG, JPEG, or PNG images."
      );
      setMessageType("error");
      return;
    }

    setFiles((current) => {
      const keys = new Set(
        current.map((item) =>
          `${item.file.name}-${item.file.size}-${item.file.lastModified}`
        )
      );

      const unique = [];

      for (const file of valid) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;

        if (keys.has(key)) continue;

        keys.add(key);

        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);

        unique.push({
          file,
          rotation: 0,
          width: 0,
          height: 0,
          previewUrl,
        });
      }

      if (!unique.length) {
        setMessage("These images have already been added.");
        setMessageType("error");
        return current;
      }

      const skipped =
        oversized.length > 0 || images.length !== selected.length;

      setMessage(
        skipped
          ? "Some files were skipped. Use JPG or PNG images under 30 MB."
          : ""
      );
      setMessageType("error");

      return [...current, ...unique];
    });
  }, []);

  function removeFile(index) {
    setFiles((current) => {
      const removed = current[index];

      if (removed) releasePreview(removed.previewUrl);

      return current.filter((_, i) => i !== index);
    });

    setZoomIndex((current) => {
      if (current == null || current === index) return null;
      return current > index ? current - 1 : current;
    });

    setMessage("");
  }

  function rotateFile(index) {
    setFiles((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, rotation: (item.rotation + 90) % 360 }
          : item
      )
    );
  }

  function clearFiles() {
    files.forEach((item) => releasePreview(item.previewUrl));

    setFiles([]);
    setZoomIndex(null);
    setMessage("");

    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current -= 1;

    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current = 0;
    setDragging(false);

    if (!processing) addFiles(event.dataTransfer.files);
  }

  async function createPdf(items) {
    const pdf = await PDFDocument.create();

    for (const item of items) {
      const image = await loadImage(item.file);

      const originalWidth = image.naturalWidth;
      const originalHeight = image.naturalHeight;
      const rotated = item.rotation % 180 !== 0;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to create image canvas.");
      }

      canvas.width = rotated ? originalHeight : originalWidth;
      canvas.height = rotated ? originalWidth : originalHeight;

      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((item.rotation * Math.PI) / 180);

      context.drawImage(
        image,
        -originalWidth / 2,
        -originalHeight / 2,
        originalWidth,
        originalHeight
      );

      const imageBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Image processing failed."));
        }, "image/png");
      });

      const imageBytes = new Uint8Array(
        await imageBlob.arrayBuffer()
      );

      const embeddedImage = await pdf.embedPng(imageBytes);

      const dimensionsItem = {
        ...item,
        width: canvas.width,
        height: canvas.height,
      };

      const [width, height] = getPageDimensions(
        pageSize,
        orientation,
        dimensionsItem
      );

      const page = pdf.addPage([width, height]);

      if (pageSize === "original") {
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      } else {
        const marginValue = MARGINS[margin];
        const availableWidth = width - marginValue * 2;
        const availableHeight = height - marginValue * 2;

        let drawWidth;
        let drawHeight;

        if (fitMode === "cover") {
          const scale = Math.max(
            availableWidth / embeddedImage.width,
            availableHeight / embeddedImage.height
          );

          drawWidth = embeddedImage.width * scale;
          drawHeight = embeddedImage.height * scale;
        } else if (fitMode === "original") {
          drawWidth = embeddedImage.width;
          drawHeight = embeddedImage.height;
        } else {
          const scale = Math.min(
            availableWidth / embeddedImage.width,
            availableHeight / embeddedImage.height
          );

          drawWidth = embeddedImage.width * scale;
          drawHeight = embeddedImage.height * scale;
        }

        page.drawImage(embeddedImage, {
          x: (width - drawWidth) / 2,
          y: (height - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }

      canvas.width = 0;
      canvas.height = 0;
    }

    return new Blob([await pdf.save()], {
      type: "application/pdf",
    });
  }

  async function startConversion() {
    if (!files.length || processing) return;

    setProcessing(true);
    setMessage("");

    try {
      if (mergeAll) {
        const blob = await createPdf(files);

        downloadBlob(
          blob,
          `${safeFilename(files[0].file.name)}-images.pdf`
        );

        setMessage(
          `Successfully created one PDF with ${files.length} image${files.length === 1 ? "" : "s"}.`
        );
      } else {
        const zip = new JSZip();

        for (let i = 0; i < files.length; i++) {
          setMessage(`Creating PDF ${i + 1} of ${files.length}…`);

          const blob = await createPdf([files[i]]);

          zip.file(
            `${safeFilename(files[i].file.name)}.pdf`,
            blob
          );
        }

        setMessage("Packaging your PDFs into a ZIP file…");

        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 4 },
        });

        downloadBlob(zipBlob, "jpg-to-pdf-files.zip");

        setMessage(
          `Successfully created ${files.length} separate PDFs in one ZIP file.`
        );
      }

      setMessageType("success");
    } catch (error) {
      console.error("JPG to PDF conversion failed:", error);

      setMessage(
        "We couldn't create the PDF files. Check your images and try again."
      );

      setMessageType("error");
    } finally {
      setProcessing(false);
    }
  }

  const handleModalPrevious = useCallback(() => {
    setZoomIndex((current) => Math.max(0, (current ?? 0) - 1));
  }, []);

  const handleModalNext = useCallback(() => {
    setZoomIndex((current) =>
      Math.min(files.length - 1, (current ?? 0) + 1)
    );
  }, [files.length]);

  const handleModalClose = useCallback(() => {
    setZoomIndex(null);
  }, []);

  return (
    <main
      className={`merge-page compress-tool-page jpg-to-pdf-page${dragging ? " jpg-pdf-is-dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="merge-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} /> Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <FileImage size={27} />
          </div>

          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>JPG to PDF</h1>
            <p>Convert your images into a PDF document.</p>
          </div>
        </header>

        <section className="merge-workspace">
          <div className="compress-pdf-files-heading">
            <div>
              <h2>Your image files</h2>
              <p>
                {files.length
                  ? `${files.length} image${files.length === 1 ? "" : "s"} selected · ${formatBytes(totalSize)}`
                  : "Choose image files to get started."}
              </p>
            </div>

            {files.length > 0 && (
              <button
                type="button"
                className="compress-pdf-select-button"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
              >
                <Plus size={19} /> Select images
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {files.length === 0 ? (
            <button
              type="button"
              className={`merge-dropzone${dragging ? " jpg-pdf-dropzone-active" : ""}`}
              onClick={() => fileRef.current?.click()}
              disabled={processing}
            >
              <span className="merge-upload-icon">
                <UploadCloud size={27} />
              </span>

              <strong>Choose image files</strong>
              <span>Select one or more JPG or PNG images.</span>
              <small>JPG and PNG · Up to 30 MB per image</small>
            </button>
          ) : (
            <div className="jpg-pdf-layout">
              <div className="jpg-pdf-gallery-panel">
                <div className="compress-pdf-instruction">
                  <strong>Preview your PDF pages.</strong>
                  <span>
                    Rotate, enlarge, or remove images before converting.
                  </span>
                </div>

                <div className="jpg-pdf-gallery-heading">
                  <div>
                    <h2>Uploaded images</h2>
                    <p>
                      {files.length} page{files.length === 1 ? "" : "s"} ·
                      Preview updates live
                    </p>
                  </div>

                  <button
                    type="button"
                    className="compress-pdf-add-another"
                    onClick={() => fileRef.current?.click()}
                    disabled={processing}
                  >
                    <Plus size={17} /> Add images
                  </button>
                </div>

                <div className="qt-pdf-gallery compress-pdf-grid jpg-pdf-image-grid">
                  {files.map((item, index) => (
                    <ImagePreviewCard
                      key={`${item.file.name}-${item.file.size}-${item.file.lastModified}`}
                      item={item}
                      index={index}
                      pageSize={pageSize}
                      orientation={orientation}
                      margin={margin}
                      fitMode={fitMode}
                      onRemove={removeFile}
                      onRotate={rotateFile}
                      onZoom={setZoomIndex}
                      disabled={processing}
                    />
                  ))}
                </div>
              </div>

              <aside className="jpg-pdf-settings-panel">
                <div className="jpg-pdf-settings-header">
                  <h2>PDF settings</h2>
                  <p>Customize the output before downloading.</p>
                </div>

                <div className="jpg-pdf-setting-section">
                  <h3>Page orientation</h3>

                  <div className="jpg-pdf-option-grid jpg-pdf-orientation-grid">
                    <OptionCard
                      active={orientation === "portrait"}
                      icon={<RectangleVertical size={22} />}
                      label="Portrait"
                      onClick={() => setOrientation("portrait")}
                      disabled={processing || pageSize === "original"}
                    />

                    <OptionCard
                      active={orientation === "landscape"}
                      icon={<RectangleHorizontal size={22} />}
                      label="Landscape"
                      onClick={() => setOrientation("landscape")}
                      disabled={processing || pageSize === "original"}
                    />
                  </div>
                </div>

                <div className="jpg-pdf-setting-section">
                  <h3>Page size</h3>

                  <select
                    className="jpg-pdf-page-size-select"
                    value={pageSize}
                    onChange={(event) => setPageSize(event.target.value)}
                    disabled={processing}
                  >
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                    <option value="original">Match image dimensions</option>
                  </select>
                </div>

                <div className="jpg-pdf-setting-section">
                  <h3>Margin</h3>

                  <div className="jpg-pdf-option-grid jpg-pdf-margin-grid">
                    <OptionCard
                      active={margin === "none"}
                      icon={<Scan size={20} />}
                      label="None"
                      onClick={() => setMargin("none")}
                      disabled={processing}
                    />

                    <OptionCard
                      active={margin === "small"}
                      icon={<Scan size={20} />}
                      label="Small"
                      onClick={() => setMargin("small")}
                      disabled={processing}
                    />

                    <OptionCard
                      active={margin === "big"}
                      icon={<Scan size={20} />}
                      label="Big"
                      onClick={() => setMargin("big")}
                      disabled={processing}
                    />
                  </div>
                </div>

                <div className="jpg-pdf-setting-section">
                  <h3>Image placement</h3>

                  <select
                    className="jpg-pdf-page-size-select"
                    value={fitMode}
                    onChange={(event) => setFitMode(event.target.value)}
                    disabled={processing}
                  >
                    <option value="contain">Fit inside page</option>
                    <option value="cover">Fill page (may crop edges)</option>
                    <option value="original">Original size, centered</option>
                  </select>
                </div>

                <label className="jpg-pdf-merge-checkbox">
                  <input
                    type="checkbox"
                    checked={mergeAll}
                    onChange={(event) => setMergeAll(event.target.checked)}
                    disabled={processing}
                  />

                  <span className="jpg-pdf-checkbox-icon">
                    <Check size={15} />
                  </span>

                  <span>Merge all images into one PDF</span>
                </label>

                {/* Message is immediately below the checkbox */}
                <p className="jpg-pdf-output-message" aria-live="polite">
                  {mergeAll
                    ? "All images will be saved as pages in one PDF. Your files stay in your browser."
                    : "Each image will become its own PDF, packaged into one ZIP download. Your files stay in your browser."}
                </p>

                <div className="jpg-pdf-sidebar-actions">
                  <button
                    type="button"
                    className="jpg-pdf-clear-button"
                    onClick={clearFiles}
                    disabled={!files.length || processing}
                  >
                    <Trash2 size={16} /> Clear images
                  </button>

                  <button
                    type="button"
                    className="merge-submit-button jpg-pdf-convert-button"
                    onClick={startConversion}
                    disabled={!files.length || processing}
                  >
                    {processing ? (
                      <>
                        <LoaderCircle
                          size={17}
                          className="jpg-pdf-spinner"
                        />
                        {mergeAll ? "Creating PDF…" : "Creating ZIP…"}
                      </>
                    ) : (
                      <>
                        <Download size={17} />
                        {mergeAll ? "Convert to PDF" : "Download ZIP"}
                      </>
                    )}
                  </button>
                </div>
              </aside>
            </div>
          )}

          {message && (
            <div
              className={`merge-message ${messageType === "error" ? "split-warning" : "jpg-pdf-success"}`}
              role="status"
              aria-live="polite"
            >
              {messageType === "error"
                ? <AlertCircle size={18} />
                : <Check size={18} />}

              <span>{message}</span>
            </div>
          )}

          {/* Always visible, including when no images are uploaded */}
          <div className="merge-footer jpg-pdf-bottom-actions">
            <button
              type="button"
              className="merge-clear-button"
              onClick={clearFiles}
              disabled={!files.length || processing}
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button"
              onClick={startConversion}
              disabled={!files.length || processing}
            >
              {processing ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="jpg-pdf-spinner"
                  />
                  {mergeAll ? "Creating PDF…" : "Creating ZIP…"}
                </>
              ) : (
                <>
                  <Download size={17} />
                  {mergeAll ? "Convert to PDF" : "Download PDFs as ZIP"}
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <ShieldCheck size={19} />

          <span>
            <strong>Your files stay private.</strong> Processing happens
            in your browser; your images are not uploaded to a server.
          </span>
        </div>

        <section className="merge-how">
          <h2>How to convert JPG to PDF</h2>

          <div className="merge-steps">
            <div>
              <span className="merge-step-number">01</span>
              <h3>Upload images</h3>
              <p>Select one or more JPG or PNG files.</p>
            </div>

            <div>
              <span className="merge-step-number">02</span>
              <h3>Set page options</h3>
              <p>Choose orientation, page size, margins, and image fit.</p>
            </div>

            <div>
              <span className="merge-step-number">03</span>
              <h3>Download files</h3>
              <p>Save one combined PDF or separate PDFs in a ZIP file.</p>
            </div>
          </div>
        </section>
      </div>

      <ImageZoomModal
        item={zoomItem}
        index={zoomIndex ?? 0}
        total={files.length}
        onClose={handleModalClose}
        onRotate={rotateFile}
        onPrevious={handleModalPrevious}
        onNext={handleModalNext}
      />
    </main>
  );
}
