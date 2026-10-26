
import React, { useCallback, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
import {
  ArrowLeft,
  AlertCircle,
  Download,
  FileImage,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import PDFPreview from "../components/PDFPreview";
import "../styles.css";
import "../pdf-to-jpg.css";
import PageSEO from "../components/PageSEO";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const QUALITY_OPTIONS = {
  standard: { scale: 1.25, quality: 0.75 },
  high: { scale: 1.75, quality: 0.88 },
  best: { scale: 2.25, quality: 0.96 },
};

const formatBytes = (bytes) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const safeBaseName = (name) =>
  name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() ||
  "document";

function isPdf(file) {
  return (
    file?.type === "application/pdf" ||
    file?.name?.toLowerCase().endsWith(".pdf")
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
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function convertPdf(file, quality, onProgress) {
  const bytes = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  let pdf;

  try {
    pdf = await task.promise;
    const images = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({
        scale: QUALITY_OPTIONS[quality].scale,
      });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) throw new Error("Unable to create image canvas.");

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({ canvasContext: context, viewport }).promise;

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Unable to create JPG image.")),
          "image/jpeg",
          QUALITY_OPTIONS[quality].quality
        );
      });

      images.push({
        name: `${safeBaseName(file.name)}-page-${pageNumber}.jpg`,
        blob,
      });

      canvas.width = 0;
      canvas.height = 0;
      onProgress?.(pageNumber, pdf.numPages);
    }

    return images;

  } finally {
    // Clean up the PDF.js loading task safely.
    try {
      await loadingTask.destroy();
    } catch (cleanupError) {
      console.warn("PDF cleanup warning:", cleanupError);
    }
  }

}

export default function PDFToJPG() {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [quality, setQuality] = useState("high");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const addFiles = useCallback((fileList) => {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const pdfs = selected.filter(isPdf);

    if (!pdfs.length) {
      setMessage("Please choose at least one valid PDF file.");
      setMessageType("error");
      return;
    }

    setFiles((current) => {
      const keys = new Set(
        current.map(
          (file) => `${file.name}-${file.size}-${file.lastModified}`
        )
      );

      const unique = pdfs.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      });

      if (!unique.length) {
        setMessage("These PDF files have already been added.");
        setMessageType("error");
        return current;
      }

      setMessage(
        selected.length !== pdfs.length
          ? "Only PDF files were added. Other file types were skipped."
          : ""
      );
      setMessageType("error");
      setProgress("");

      return [...current, ...unique];
    });
  }, []);

  function removeFile(fileToRemove) {
    setFiles((current) => current.filter((file) => file !== fileToRemove));
    setMessage("");
    setProgress("");
  }

  function clearFiles() {
    setFiles([]);
    setMessage("");
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function startConversion() {
    if (!files.length || processing) {
      if (!files.length) {
        setMessage("Please upload at least one PDF before converting.");
        setMessageType("error");
      }
      return;
    }

    setProcessing(true);
    setMessage("");
    setProgress("");

    try {
      const converted = [];

      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        setProgress(
          `Converting PDF ${index + 1} of ${files.length}: ${file.name}`
        );

        const images = await convertPdf(file, quality, (page, total) => {
          setProgress(
            `PDF ${index + 1} of ${files.length} · Page ${page} of ${total}`
          );
        });

        converted.push({
          folderName: safeBaseName(file.name),
          images,
        });
      }

      if (converted.length === 1) {
        const images = converted[0].images;

        if (images.length === 1) {
          downloadBlob(images[0].blob, images[0].name);
        } else {
          // A single PDF with multiple pages downloads as individual JPGs.
          for (let i = 0; i < images.length; i++) {
            downloadBlob(images[i].blob, images[i].name);
            if (i < images.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 350));
            }
          }
        }

        setMessage(
          images.length === 1
            ? "JPG downloaded successfully."
            : "Conversion complete. Allow multiple downloads in your browser if prompted."
        );
        setMessageType("success");
        return;
      }

      const zip = new JSZip();

      converted.forEach(({ folderName, images }) => {
        const folder = zip.folder(folderName);
        images.forEach(({ name, blob }) => folder.file(name, blob));
      });

      setProgress("Preparing ZIP download…");

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 4 },
      });

      downloadBlob(zipBlob, "quicktools-pdf-to-jpg.zip");
      setMessage("All PDFs were converted successfully. Your ZIP is downloading.");
      setMessageType("success");
    } catch (error) {
      console.error("PDF to JPG conversion failed:", error);
      setMessage(
        "We couldn't convert one of these PDFs. It may be damaged or password-protected."
      );
      setMessageType("error");
    } finally {
      setProcessing(false);
      setProgress("");
    }
  }

  return (
    <main className="merge-page compress-tool-page pdf-to-jpg-page">
      <PageSEO
        title="PDF to JPG Converter Online | QuickTools"
        description="Convert PDF pages into JPG images online with QuickTools, making your documents easier to use as image files."
        path="/pdf-to-jpg"
      />
      <div className="merge-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} />
          Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <FileImage size={27} />
          </div>
          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>PDF to JPG</h1>
            <p>Convert PDF pages into JPG images.</p>
          </div>
        </header>

        <section className="merge-workspace">
          <div className="compress-pdf-files-heading">
            <div>
              <h2>Your PDF files</h2>
              <p>
                {files.length
                  ? `${files.length} file${files.length === 1 ? "" : "s"} selected · ${formatBytes(totalSize)}`
                  : "Choose PDF files to get started."}
              </p>
            </div>

            {files.length > 0 && (
              <button
                type="button"
                className="compress-pdf-select-button"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
              >
                <Plus size={19} />
                Select PDF files
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
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
              className="merge-dropzone"
              onClick={() => fileRef.current?.click()}
            >
              <span className="merge-upload-icon">
                <UploadCloud size={27} />
              </span>
              <strong>Choose PDF files</strong>
              <span>Select one or more PDFs to convert.</span>
              <small>PDF files only · Your files stay on your device</small>
            </button>
          ) : (
            <>
              <div className="compress-pdf-instruction">
                <strong>Review your PDFs before converting.</strong>
                <span>
                  Hover over a PDF to preview, rotate, enlarge, or remove it.
                </span>
              </div>

              <div className="compress-pdf-list-heading">
                <h2>Uploaded PDFs</h2>
                <span>
                  {files.length} PDF{files.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="qt-pdf-gallery compress-pdf-grid pdf-jpg-preview-grid">
                {files.map((file) => (
                  <PDFPreview
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    file={file}
                    onRemove={() => removeFile(file)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="compress-pdf-add-another"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
              >
                <Plus size={18} />
                Add another PDF
              </button>

              <div className="compress-pdf-options pdf-jpg-quality">
                <h3>Image quality</h3>
                <div className="compress-pdf-option-grid">
                  {[
                    ["standard", "Standard", "Smaller files"],
                    ["high", "High", "Recommended"],
                    ["best", "Best", "More detail"],
                  ].map(([value, label, description]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="jpg-quality"
                        value={value}
                        checked={quality === value}
                        onChange={(event) => setQuality(event.target.value)}
                        disabled={processing}
                      />
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {message && (
            <div className="merge-message split-warning" role="status">
              <AlertCircle size={18} />
              <span>{message}</span>
            </div>
          )}

          {progress && (
            <div className="pdf-jpg-progress" role="status">
              <LoaderCircle size={18} className="compress-spinner" />
              <span>{progress}</span>
            </div>
          )}

          <div className="merge-footer">
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
                  <LoaderCircle size={17} className="compress-spinner" />
                  Converting…
                </>
              ) : (
                <>
                  <Download size={17} />
                  Convert to JPG
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <ShieldCheck size={19} />
          <span>
            <strong>Your files stay private.</strong> Processing happens in
            your browser; your documents are not uploaded to a server.
          </span>
        </div>

        <section className="merge-how">
          <h2>How to convert PDF to JPG</h2>
          <div className="merge-steps">
            <div>
              <span className="merge-step-number">01</span>
              <h3>Upload PDFs</h3>
              <p>Choose one or more PDF documents.</p>
            </div>
            <div>
              <span className="merge-step-number">02</span>
              <h3>Review files</h3>
              <p>Preview or remove PDFs and choose image quality.</p>
            </div>
            <div>
              <span className="merge-step-number">03</span>
              <h3>Download JPGs</h3>
              <p>Download individual JPGs or one ZIP for multiple PDFs.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
