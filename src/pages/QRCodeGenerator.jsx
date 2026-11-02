import { useRef, useState } from "react";
import { Download, Link2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import QuickToolPage from "../components/QuickToolPage";

const QUICKTOOLS_URL = "https://quicktools-roan.vercel.app/";

function normalizeQrValue(value) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#].*)?$/i.test(trimmedValue)) {
    return `https://${trimmedValue}`;
  }

  return trimmedValue;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function QRCodeGenerator() {
  const previewRef = useRef(null);
  const [value, setValue] = useState("");
  const [size, setSize] = useState(320);
  const [foreground, setForeground] = useState("#222239");
  const [background, setBackground] = useState("#ffffff");
  const [error, setError] = useState("");
  const qrValue = normalizeQrValue(value);

  function getSvgMarkup() {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) throw new Error("Enter some text or a link before downloading.");
    return new XMLSerializer().serializeToString(svg);
  }

  function downloadSvg() {
    try {
      const markup = getSvgMarkup();
      downloadBlob(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), "quicktools-qr-code.svg");
      setError("");
    } catch (downloadError) {
      console.error("QR Code SVG download error:", downloadError);
      setError(downloadError.message);
    }
  }

  async function downloadPng() {
    let objectUrl;
    try {
      const markup = getSvgMarkup();
      const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Could not render the QR code image."));
        image.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export is not supported by this browser.");
      context.fillStyle = background;
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Could not create the PNG download."));
        }, "image/png");
      });
      downloadBlob(png, "quicktools-qr-code.png");
      setError("");
    } catch (downloadError) {
      console.error("QR Code PNG download error:", downloadError);
      setError(downloadError.message || "Could not download the PNG.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <QuickToolPage
      title="QR Code Generator"
      description="Create a downloadable QR code from a website link or text. Customize its colors and export as SVG or PNG."
      path="/qr-code-generator"
      icon={QrCode}
      steps={[
        { title: "Enter a link or text", description: "Choose the website URL or message your QR code should contain." },
        { title: "Choose colors and size", description: "Customize the code while keeping strong contrast for scanning." },
        { title: "Download your QR code", description: "Save a crisp SVG or a PNG image." },
      ]}
      faqs={[
        { question: "Does the generator upload my link?", answer: "No. QR codes are generated in your browser and your entered content is not sent to a server." },
        { question: "Which formats can I download?", answer: "Download SVG for scalable artwork or PNG for an image that is easy to share." },
        { question: "Why should the code have a quiet border?", answer: "A clear margin around the code helps QR readers distinguish it from nearby artwork and text." },
      ]}
    >
      <section className="quick-utility-workspace quick-qr-workspace">
        <div className="quick-qr-editor">
          <label className="quick-utility-label" htmlFor="qr-value">Website link or text</label>
          <div className="quick-qr-input-wrap">
            <Link2 size={18} />
            <input
              id="qr-value"
              value={value}
              onChange={(event) => { setValue(event.target.value); setError(""); }}
              placeholder="https://example.com or type a message"
              maxLength={2000}
            />
          </div>
          <p className="quick-utility-help">
            Scan to open a public website by entering its URL. Domains without a protocol get{" "}
            <code>https://</code> automatically; localhost links only work on your own computer.{" "}
            <button type="button" className="quick-qr-site-link" onClick={() => { setValue(QUICKTOOLS_URL); setError(""); }}>
              Use the QuickTools homepage
            </button>
          </p>

          <div className="quick-qr-controls">
            <label>
              <span className="quick-utility-label">Foreground</span>
              <span className="quick-color-control"><input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /><span>{foreground.toUpperCase()}</span></span>
            </label>
            <label>
              <span className="quick-utility-label">Background</span>
              <span className="quick-color-control"><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /><span>{background.toUpperCase()}</span></span>
            </label>
            <label>
              <span className="quick-utility-label">Image size</span>
              <select value={size} onChange={(event) => setSize(Number(event.target.value))}>
                <option value={256}>256 × 256</option>
                <option value={320}>320 × 320</option>
                <option value={512}>512 × 512</option>
                <option value={1024}>1024 × 1024</option>
              </select>
            </label>
          </div>

          <div className="quick-qr-downloads">
            <button type="button" className="quick-utility-primary" onClick={downloadPng} disabled={!value.trim()}>
              <Download size={16} /> Download PNG
            </button>
            <button type="button" className="quick-utility-secondary" onClick={downloadSvg} disabled={!value.trim()}>
              <Download size={16} /> Download SVG
            </button>
          </div>
          {error && <p className="quick-utility-error" role="alert">{error}</p>}
        </div>

        <div className="quick-qr-preview-panel">
          <h2>Live preview</h2>
          <div className="quick-qr-preview" ref={previewRef} style={{ backgroundColor: background }}>
            {qrValue ? (
              <QRCodeSVG value={qrValue} size={size} level="M" marginSize={4} fgColor={foreground} bgColor={background} />
            ) : (
              <div className="quick-qr-empty"><QrCode size={42} /><span>Your QR code appears here</span></div>
            )}
          </div>
          <p>Keep enough contrast between the code and its background so it remains easy to scan.</p>
        </div>
      </section>
    </QuickToolPage>
  );
}
