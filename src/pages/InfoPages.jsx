import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import PageSEO from "../components/PageSEO";

const supportTopics = [
  {
    question: "How do I use a tool?",
    answer:
      "Open a tool from the homepage, select the file types it accepts, follow the on-screen options, and download the result. Each tool page includes its own quick steps.",
  },
  {
    question: "Why did my file fail?",
    answer:
      "Check that the file is in a supported format and within the size limit shown on the tool page. Password-protected, damaged, scanned, or unusually complex documents may not work with every tool.",
  },
  {
    question: "Are my files uploaded?",
    answer:
      "Most PDF and image tools process files in your browser. PDF-to-Word and Word-to-PDF use a conversion service, and optional phone-based signing sends signature data through Supabase Realtime. See the Privacy page for details.",
  },
  {
    question: "Can I edit text in a scanned PDF?",
    answer:
      "Scanned pages are images rather than selectable text. OCR is not included, so text in a scanned page cannot be edited with the Edit PDF tool.",
  },
];

export default function InfoPages({ page }) {
  const isPrivacy = page === "privacy";
  const title = isPrivacy ? "Privacy | QuickTools" : "Help & Support | QuickTools";
  const description = isPrivacy
    ? "Learn how QuickTools handles files, conversion requests, signature data, analytics, and browser preferences."
    : "Get help using QuickTools PDF tools, troubleshoot common file issues, and find answers to frequently asked questions.";
  const path = isPrivacy ? "/privacy" : "/support";

  return (
    <main className="info-page">
      <PageSEO title={title} description={description} path={path} />
      <div className="info-page-inner">
        <Link to="/" className="info-back-link">
          <ArrowLeft size={16} />
          Back to QuickTools
        </Link>

        {isPrivacy ? (
          <>
            <header className="info-page-heading">
              <span className="info-page-icon"><ShieldCheck size={24} /></span>
              <div>
                <span className="info-eyebrow">YOUR FILES AND DATA</span>
                <h1>Privacy</h1>
                <p>What happens to information when you use QuickTools.</p>
              </div>
            </header>
            <p className="info-updated">Last updated: November 2, 2026</p>

            <section className="info-content-section">
              <h2>Files you select</h2>
              <p>
                Most PDF and image tools in QuickTools process your selected
                files in your browser. For these tools, the document stays on
                your device while the operation runs. Do not use a tool for
                sensitive material unless its behavior meets your needs.
              </p>
            </section>

            <section className="info-content-section">
              <h2>Document conversion</h2>
              <p>
                PDF-to-Word and Word-to-PDF conversion send the selected file
                to the QuickTools conversion API, which returns the converted
                file to your browser. This host is an API service, not a public
                website, so opening its root URL may show a 404; that does not
                mean the conversion endpoints are unavailable. You can check
                the{" "}
                <a href="https://quicktools-rmgf.onrender.com/api/health">
                  conversion API status
                </a>
                . The service’s file-retention and request-log settings are
                controlled by its operator and hosting provider; verify those
                settings before sending confidential documents.
              </p>
            </section>

            <section className="info-content-section">
              <h2>Phone-based signature</h2>
              <p>
                If you choose to draw a signature on a phone and send it back
                to your computer, the signature image is transmitted through
                Supabase Realtime. This optional feature requires the site
                operator to configure Supabase. You can avoid this transfer by
                not using phone-based signing.
              </p>
            </section>

            <section className="info-content-section">
              <h2>Analytics and preferences</h2>
              <p>
                QuickTools includes Vercel Analytics to measure website usage.
                The light or dark theme choice is saved in your browser’s local
                storage so it can be remembered on your next visit.
              </p>
            </section>

            <section className="info-content-section">
              <h2>Questions about privacy</h2>
              <p>
                A public privacy contact address has not been configured for
                this site yet. Before using QuickTools for confidential files,
                review the data flows above and contact the site operator
                through their published support channel if you need more
                information.
              </p>
            </section>
          </>
        ) : (
          <>
            <header className="info-page-heading">
              <span className="info-page-icon"><ArrowRight size={24} /></span>
              <div>
                <span className="info-eyebrow">QUICKTOOLS HELP CENTER</span>
                <h1>Help &amp; Support</h1>
                <p>Quick answers for using the file tools.</p>
              </div>
            </header>

            <section className="info-content-section info-support-tools">
              <h2>Go to a tool</h2>
              <p>
                Choose the task you want to complete. The tool page explains
                the steps and accepted file formats.
              </p>
              <div className="info-tool-links">
                <Link to="/merge-pdf">Merge PDF</Link>
                <Link to="/split-pdf">Split PDF</Link>
                <Link to="/compress-pdf">Compress PDF</Link>
                <Link to="/edit-pdf">Edit PDF</Link>
                <Link to="/pdf-to-word">PDF to Word</Link>
                <Link to="/word-to-pdf">Word to PDF</Link>
              </div>
            </section>

            <section className="info-content-section">
              <h2>Common questions</h2>
              <div className="info-faq-list">
                {supportTopics.map(({ question, answer }) => (
                  <details key={question} className="info-faq-item">
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="info-support-note">
              <h2>Still need help?</h2>
              <p>
                This site does not have a public support email or contact form
                configured yet. Include the tool name, browser, steps to
                reproduce the issue, and any error message when contacting the
                site operator.
              </p>
              <Link to="/privacy">Read the Privacy page <ArrowRight size={15} /></Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
