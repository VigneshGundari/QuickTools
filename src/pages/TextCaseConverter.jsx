import { useMemo, useState } from "react";
import { Check, Copy, RotateCcw, Type } from "lucide-react";
import QuickToolPage from "../components/QuickToolPage";

const CASES = [
  { id: "upper", label: "UPPERCASE" },
  { id: "lower", label: "lowercase" },
  { id: "title", label: "Title Case" },
  { id: "sentence", label: "Sentence case" },
  { id: "alternating", label: "aLtErNaTiNg" },
];

function convertCase(text, mode) {
  if (mode === "upper") return text.toLocaleUpperCase();
  if (mode === "lower") return text.toLocaleLowerCase();
  if (mode === "title") {
    return text.toLocaleLowerCase().replace(/(^|[\s([{'"“])([\p{L}\p{N}])/gu, (match) => match.toLocaleUpperCase());
  }
  if (mode === "sentence") {
    return text
      .toLocaleLowerCase()
      .replace(/(^\s*|[.!?]\s+)([\p{L}\p{N}])/gu, (match) => match.toLocaleUpperCase());
  }
  return Array.from(text).map((character, index) =>
    index % 2 === 0 ? character.toLocaleLowerCase() : character.toLocaleUpperCase()
  ).join("");
}

export default function TextCaseConverter() {
  const [text, setText] = useState("");
  const [selectedCase, setSelectedCase] = useState("upper");
  const [message, setMessage] = useState("");
  const result = useMemo(() => convertCase(text, selectedCase), [text, selectedCase]);

  async function copyResult() {
    if (!result) {
      setMessage("Enter some text before copying.");
      return;
    }

    try {
      await navigator.clipboard.writeText(result);
      setMessage("Converted text copied to your clipboard.");
    } catch (error) {
      console.error("Text Case Converter clipboard error:", error);
      setMessage("Clipboard access was denied. Select and copy the result manually.");
    }
  }

  return (
    <QuickToolPage
      title="Text Case Converter"
      description="Convert text to uppercase, lowercase, title case, sentence case, or alternating case in your browser."
      path="/text-case-converter"
      icon={Type}
      steps={[
        { title: "Enter your text", description: "Type or paste text into the editor." },
        { title: "Choose a text case", description: "Select the capitalization style you need." },
        { title: "Copy your result", description: "Copy the converted text to use in another app." },
      ]}
      faqs={[
        { question: "Is my text uploaded?", answer: "No. Text conversion runs in your browser; the text is not sent to a server." },
        { question: "What does title case do?", answer: "It capitalizes the first letter of each word and lowercases the remaining letters." },
        { question: "Can I convert large text?", answer: "Yes. The tool works in your browser. Very large text may depend on the memory available to your device." },
      ]}
    >
      <section className="quick-utility-workspace">
        <div className="quick-utility-editor-heading">
          <div>
            <h2>Your text</h2>
            <p>Enter or paste text. Your original stays unchanged while you try styles.</p>
          </div>
          <span>{text.length.toLocaleString()} characters</span>
        </div>

        <label className="quick-utility-label" htmlFor="case-source">Text to convert</label>
        <textarea
          id="case-source"
          className="quick-utility-textarea"
          value={text}
          onChange={(event) => { setText(event.target.value); setMessage(""); }}
          placeholder="Type or paste your text here..."
          rows={7}
        />

        <div className="quick-case-options" role="group" aria-label="Choose capitalization style">
          {CASES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selectedCase === item.id ? "active" : ""}
              aria-pressed={selectedCase === item.id}
              onClick={() => { setSelectedCase(item.id); setMessage(""); }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="quick-utility-result-heading">
          <h2>Converted text</h2>
          <div>
            <button type="button" className="quick-utility-secondary" onClick={() => { setText(""); setMessage(""); }}>
              <RotateCcw size={15} /> Clear
            </button>
            <button type="button" className="quick-utility-primary" onClick={copyResult} disabled={!result}>
              {message.startsWith("Converted") ? <Check size={16} /> : <Copy size={16} />}
              Copy result
            </button>
          </div>
        </div>
        <div className="quick-utility-output" aria-live="polite">
          {result || <span>Your converted text will appear here.</span>}
        </div>
        {message && <p className="quick-utility-message" role="status">{message}</p>}
        <p className="quick-utility-privacy">Your text is processed locally in this browser.</p>
      </section>
    </QuickToolPage>
  );
}
