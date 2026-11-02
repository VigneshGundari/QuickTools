import { useState } from "react";
import { ArrowDownToLine, FileText } from "lucide-react";
import { PDFDocument, PageSizes, StandardFonts } from "pdf-lib";
import QuickToolPage from "../components/QuickToolPage";

const PAGE_OPTIONS = {
  A4: PageSizes.A4,
  Letter: PageSizes.Letter,
};

function wrapParagraph(paragraph, font, fontSize, maxWidth) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      line = word;
      continue;
    }

    line = "";
    let part = "";
    for (const character of word) {
      if (part && font.widthOfTextAtSize(part + character, fontSize) > maxWidth) {
        lines.push(part);
        part = character;
      } else {
        part += character;
      }
    }
    line = part;
  }
  if (line) lines.push(line);
  return lines;
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

export default function TextToPDF() {
  const [text, setText] = useState("");
  const [pageSize, setPageSize] = useState("A4");
  const [fontSize, setFontSize] = useState(12);
  const [margin, setMargin] = useState(48);
  const [filename, setFilename] = useState("quicktools-document");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function createPdf() {
    if (!text.trim()) {
      setError(true);
      setMessage("Enter some text before creating a PDF.");
      return;
    }

    setProcessing(true);
    setError(false);
    setMessage("");
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const [pageWidth, pageHeight] = PAGE_OPTIONS[pageSize];
      const lineHeight = fontSize * 1.45;
      const maxWidth = pageWidth - margin * 2;
      const top = pageHeight - margin;
      const bottom = margin;
      let page = pdf.addPage([pageWidth, pageHeight]);
      let y = top;

      for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
        const lines = wrapParagraph(paragraph, font, fontSize, maxWidth);
        for (const line of lines) {
          if (y - lineHeight < bottom) {
            page = pdf.addPage([pageWidth, pageHeight]);
            y = top;
          }
          if (line) page.drawText(line, { x: margin, y: y - fontSize, size: fontSize, font });
          y -= lineHeight;
        }
      }

      const bytes = await pdf.save();
      const safeName = filename.trim().replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-") || "quicktools-document";
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${safeName}.pdf`);
      setMessage("Your PDF is ready to download.");
    } catch (pdfError) {
      console.error("Text to PDF export error:", pdfError);
      setError(true);
      setMessage("The PDF could not be created. Try removing unsupported characters and try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <QuickToolPage
      title="Text to PDF"
      description="Turn typed or pasted text into a downloadable PDF with automatic line wrapping and page breaks."
      path="/text-to-pdf"
      icon={FileText}
      steps={[
        { title: "Write or paste text", description: "Add the content you want to put in your PDF." },
        { title: "Choose page options", description: "Set A4 or Letter paper, font size, and page margins." },
        { title: "Create your PDF", description: "Download the formatted document directly from your browser." },
      ]}
      faqs={[
        { question: "Is my text sent to a server?", answer: "No. PDF creation happens locally in your browser; your text is not uploaded." },
        { question: "Will long text continue onto another page?", answer: "Yes. Lines wrap to fit the selected paper size, and additional pages are added automatically." },
        { question: "Can this preserve complex formatting?", answer: "This tool creates a clean text-only PDF. Rich formatting, tables, and embedded images are not included." },
      ]}
    >
      <section className="quick-utility-workspace">
        <div className="quick-utility-editor-heading">
          <div>
            <h2>Document content</h2>
            <p>Plain text is laid out with line wrapping and automatic page breaks.</p>
          </div>
          <span>{text.length.toLocaleString()} characters</span>
        </div>

        <label className="quick-utility-label" htmlFor="pdf-content">Text to convert</label>
        <textarea
          id="pdf-content"
          className="quick-utility-textarea"
          value={text}
          onChange={(event) => { setText(event.target.value); setMessage(""); }}
          placeholder="Write or paste your document text here..."
          rows={10}
          maxLength={100000}
        />
        <div className="quick-pdf-controls">
          <label>
            <span className="quick-utility-label">File name</span>
            <input value={filename} onChange={(event) => setFilename(event.target.value)} maxLength={80} />
          </label>
          <label>
            <span className="quick-utility-label">Paper size</span>
            <select value={pageSize} onChange={(event) => setPageSize(event.target.value)}>
              <option value="A4">A4</option>
              <option value="Letter">US Letter</option>
            </select>
          </label>
          <label>
            <span className="quick-utility-label">Font size</span>
            <select value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))}>
              {[10, 11, 12, 14, 16, 18].map((size) => <option key={size} value={size}>{size} pt</option>)}
            </select>
          </label>
          <label>
            <span className="quick-utility-label">Margins</span>
            <select value={margin} onChange={(event) => setMargin(Number(event.target.value))}>
              <option value={36}>Narrow</option>
              <option value={48}>Normal</option>
              <option value={72}>Wide</option>
            </select>
          </label>
        </div>

        <div className="quick-utility-actions">
          {message && <p className={error ? "quick-utility-error" : "quick-utility-message"} role={error ? "alert" : "status"}>{message}</p>}
          <button type="button" className="quick-utility-primary" onClick={createPdf} disabled={processing || !text.trim()}>
            <ArrowDownToLine size={17} />
            {processing ? "Creating PDF…" : "Create and download PDF"}
          </button>
        </div>
        <p className="quick-utility-privacy">Your text is converted locally in this browser. Maximum input: 100,000 characters.</p>
      </section>
    </QuickToolPage>
  );
}
