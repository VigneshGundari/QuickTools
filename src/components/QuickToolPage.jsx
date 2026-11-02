import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import PageSEO from "./PageSEO";

export default function QuickToolPage({
  title,
  description,
  path,
  icon: Icon,
  children,
  steps,
  faqs,
}) {
  return (
    <main className="merge-page quick-utility-page">
      <PageSEO title={`${title} | QuickTools`} description={description} path={path} />
      <div className="quick-utility-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} />
          Back to all tools
        </Link>

        <header className="merge-heading quick-utility-heading">
          <div className="merge-heading-icon"><Icon size={27} /></div>
          <div>
            <span className="merge-eyebrow">QUICKTOOLS</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </header>

        {children}

        <section className="quick-tool-guide">
          <h2>How to use {title}</h2>
          <div className="quick-tool-steps">
            {steps.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>

          <div className="quick-tool-faq">
            <h2>Frequently asked questions</h2>
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
