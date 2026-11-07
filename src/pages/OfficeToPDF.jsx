import { useRef, useState } from "react";
import JSZip from "jszip";
import {
  ArrowDownToLine,
  Check,
  FileText,
  LoaderCircle,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import QuickToolPage from "../components/QuickToolPage";

const API_URL = import.meta.env.VITE_API_URL || "https://quicktools-rmgf.onrender.com";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_BATCH_SIZE = 20;

const OFFICE_TOOLS = {
  "excel-to-pdf": {
    title: "Excel to PDF",
    description: "Convert Excel spreadsheets to PDF for easy sharing and printing.",
    intro: "Select Excel files",
    extensions: [".xlsx", ".xls"],
    fileType: "Excel workbook (.xlsx or .xls)",
    action: "Convert to PDF",
    steps: [
      { title: "Upload spreadsheets", description: "Choose one or more XLSX or XLS workbooks." },
      { title: "Convert to PDF", description: "Your spreadsheets are converted by the QuickTools document service." },
      { title: "Download your PDFs", description: "Download a converted PDF or all results in a ZIP file." },
    ],
  },
  "powerpoint-to-pdf": {
    title: "PowerPoint to PDF",
    description: "Convert PowerPoint presentations to PDF slides that are easy to share.",
    intro: "Select PowerPoint files",
    extensions: [".pptx", ".ppt"],
    fileType: "PowerPoint presentation (.pptx or .ppt)",
    action: "Convert to PDF",
    steps: [
      { title: "Upload presentations", description: "Choose one or more PPTX or PPT slide decks." },
      { title: "Convert to PDF", description: "Your presentations are converted by the QuickTools document service." },
      { title: "Download your PDFs", description: "Download a converted PDF or all results in a ZIP file." },
    ],
  },
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function convertFile(file, index, total) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/convert/office-to-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Conversion failed. Please try again.";
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch {
      // The service can return an HTML error page instead of JSON.
    }
    throw new Error(`${file.name}: ${message}`);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error(`${file.name}: the converted PDF is empty.`);
  const signature = new TextDecoder("ascii").decode(new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
  if (signature !== "%PDF-") throw new Error(`${file.name}: the service did not return a valid PDF.`);
  const stem = file.name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-") || "converted";
  return {
    name: `${stem}${total > 1 ? `-${index + 1}` : ""}.pdf`,
    blob,
  };
}

export default function OfficeToPDF({ tool }) {
  const config = OFFICE_TOOLS[tool];
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function chooseFiles(fileList) {
    const candidates = Array.from(fileList || []);
    if (!candidates.length) return;
    setError("");
    setMessage("");
    setResults([]);
    const accepted = [];
    const rejected = [];
    for (const file of candidates) {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!config.extensions.includes(extension)) {
        rejected.push(`${file.name}: unsupported format`);
      } else if (!file.size || file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: must be between 1 byte and 50 MB`);
      } else if (files.length + accepted.length >= MAX_BATCH_SIZE) {
        rejected.push(`${file.name}: a maximum of ${MAX_BATCH_SIZE} files is allowed`);
      } else if (files.some((item) => item.name === file.name && item.size === file.size) ||
        accepted.some((item) => item.name === file.name && item.size === file.size)) {
        rejected.push(`${file.name}: already added`);
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length) setFiles((previous) => [...previous, ...accepted]);
    if (rejected.length) {
      setError(`${rejected.slice(0, 3).join(". ")}${rejected.length > 3 ? `. And ${rejected.length - 3} more file(s) were skipped.` : "."}`);
    }
  }

  function removeFile(index) {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
    setResults([]);
    setError("");
    setMessage("");
  }

  function clearFiles() {
    setFiles([]);
    setResults([]);
    setError("");
    setMessage("");
    setProgress("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function convert() {
    if (!files.length || processing) return;
    setProcessing(true);
    setError("");
    setMessage("");
    setResults([]);
    const completed = [];
    const failures = [];

    for (let index = 0; index < files.length; index += 1) {
      setProgress(`Converting file ${index + 1} of ${files.length}…`);
      try {
        completed.push(await convertFile(files[index], index, files.length));
      } catch (conversionError) {
        failures.push(conversionError instanceof TypeError
          ? `${files[index].name}: cannot connect to the conversion server.`
          : conversionError.message || `${files[index].name}: conversion failed.`);
      }
    }

    setResults(completed);
    setProgress("");
    if (failures.length) {
      setError(failures.join(" "));
    } else {
      setMessage(`${completed.length} ${completed.length === 1 ? "PDF is" : "PDFs are"} ready to download.`);
    }
    setProcessing(false);
  }

  async function downloadAll() {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].name);
      return;
    }
    const zip = new JSZip();
    for (const result of results) zip.file(result.name, result.blob);
    const archive = await zip.generateAsync({ type: "blob", compression: "STORE" });
    downloadBlob(archive, `${tool}-pdfs.zip`);
  }

  return (
    <QuickToolPage
      title={config.title}
      description={config.description}
      path={`/${tool}`}
      icon={FileText}
      steps={config.steps}
      faqs={[
        { question: "Which formats are supported?", answer: `Upload ${config.fileType}.` },
        { question: "Can I convert more than one file?", answer: "Yes. Add up to 20 files and download the converted PDFs individually or together as a ZIP." },
        { question: "Are my documents processed in the browser?", answer: "No. Files are sent to the QuickTools conversion server and removed after conversion." },
        { question: "What if the conversion server is unavailable?", answer: "The page displays an error so you can retry later. The conversion requires the document service to be online." },
      ]}
    >
      <section className="quick-utility-workspace quick-office-tool">
        <div className="quick-tool-step-heading">
          <span>1</span>
          <div>
            <h2>{files.length ? `${files.length} ${files.length === 1 ? "file" : "files"} selected` : config.intro}</h2>
            <p>{files.length ? "Add more files or remove any you don't need." : `Choose ${config.fileType} files from your device.`}</p>
          </div>
        </div>

        {!files.length ? (
          <button type="button" className="quick-image-upload" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFiles(event.dataTransfer.files); }}>
            <UploadCloud size={34} />
            <strong>{config.intro}</strong>
            <span>or drop files here · {config.fileType} · maximum 50 MB per file</span>
          </button>
        ) : (
          <div className="quick-office-file-list">
            {files.map((file, index) => (
              <article className="quick-office-item" key={`${file.name}-${file.size}-${file.lastModified}`}>
                <span className="quick-office-file-icon"><FileText size={22} /></span>
                <div><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)}</small></div>
                {!processing && <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)}><X size={16} /></button>}
              </article>
            ))}
            {files.length < MAX_BATCH_SIZE && <button type="button" className="quick-image-add-more" onClick={() => inputRef.current?.click()} disabled={processing}><Plus size={19} /><span>Add files</span></button>}
            {!processing && <button type="button" className="quick-image-clear-all" onClick={clearFiles}>Remove all</button>}
          </div>
        )}

        {files.length > 0 && (
          <div className="quick-tool-step-heading quick-tool-step-options">
            <span>2</span>
            <div><h2>Convert files</h2><p>Each selected file will be converted into a separate PDF.</p></div>
          </div>
        )}

        {error && <p className="quick-utility-error" role="alert">{error}</p>}
        {message && <p className="quick-utility-message" role="status">{message}</p>}
        {progress && <p className="quick-utility-message" role="status">{progress}</p>}

        {files.length > 0 && !results.length && (
          <div className="quick-utility-actions quick-image-submit">
            <button type="button" className="quick-utility-primary" onClick={convert} disabled={processing}>
              {processing ? <LoaderCircle size={17} className="quick-image-spinner" /> : <FileText size={17} />}
              {processing ? "Converting…" : config.action}
            </button>
          </div>
        )}

        {results.length > 0 && (
          <section className="quick-image-results" aria-live="polite">
            <div className="quick-tool-step-heading">
              <span><Check size={17} /></span>
              <div><h2>Your PDFs are ready</h2><p>{results.length} converted {results.length === 1 ? "file" : "files"}</p></div>
            </div>
            <div className="quick-image-result-list">
              {results.map((result) => (
                <article className="quick-image-result-row" key={result.name}>
                  <span className="quick-office-result-icon"><FileText size={21} /></span>
                  <div><strong>{result.name}</strong><small>{formatBytes(result.blob.size)}</small></div>
                  <button type="button" className="quick-utility-secondary" onClick={() => downloadBlob(result.blob, result.name)} aria-label={`Download ${result.name}`}><ArrowDownToLine size={16} /> Download</button>
                </article>
              ))}
            </div>
            <div className="quick-utility-actions">
              <button type="button" className="quick-utility-primary" onClick={downloadAll}><ArrowDownToLine size={17} />{results.length > 1 ? "Download all as ZIP" : "Download PDF"}</button>
              <button type="button" className="quick-utility-secondary" onClick={() => { setResults([]); setError(""); setMessage(""); }}>Convert again</button>
            </div>
          </section>
        )}

        <p className="quick-utility-privacy">Files are sent to the QuickTools document conversion service. Maximum 20 files, 50 MB each.</p>
        <input ref={inputRef} type="file" accept={config.extensions.join(",")} multiple hidden onChange={(event) => { chooseFiles(event.target.files); event.target.value = ""; }} />
      </section>
    </QuickToolPage>
  );
}
