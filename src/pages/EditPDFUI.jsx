
import React from "react";
import {
  ArrowLeft,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Hand,
  Type,
  Image as ImageIcon,
  Pencil,
  Square,
  Circle,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Eraser,
  RotateCcw,
  RotateCw,
  Trash2,
  Eye,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Check,
  ShieldCheck,
  Minus,
  Undo2,
  Redo2,
  MousePointer2,
  Shapes,
} from "lucide-react";
import "../EditPDFUI.css";

const pages = [
  { number: 1, type: "Text and content", active: true },
  { number: 2, type: "Shapes and images", active: false },
  { number: 3, type: "Additional content", active: false },
];

function ToolButton({ icon: Icon, label, active = false, danger = false }) {
  return (
    <button
      type="button"
      className={`epui-tool ${active ? "is-active" : ""} ${
        danger ? "is-danger" : ""
      }`}
      title={label}
      aria-label={label}
    >
      <Icon size={17} strokeWidth={1.9} />
    </button>
  );
}

function PageThumbnail({ page }) {
  return (
    <div className={`epui-thumb ${page.active ? "selected" : ""}`}>
      <div className="epui-thumb-paper">
        <span className="thumb-line thumb-line-title" />
        <span className="thumb-line long" />
        <span className="thumb-line medium" />
        <span className="thumb-line short" />
        <span className="thumb-gap" />
        <span className="thumb-line long" />
        <span className="thumb-line medium" />
        {page.number === 2 && <span className="thumb-outline" />}
        {page.number === 3 && <span className="thumb-signature">〰</span>}
      </div>
      <span className="epui-thumb-number">{page.number}</span>
    </div>
  );
}

function PageListItem({ page }) {
  return (
    <div className={`epui-page-row ${page.active ? "selected" : ""}`}>
      <div className="epui-page-mini">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="epui-page-meta">
        <strong>Page {page.number}</strong>
        <span>{page.type}</span>
      </div>

      <button
        type="button"
        className="epui-more"
        aria-label={`More options for page ${page.number}`}
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}

function DocumentPreview() {
  return (
    <article className="epui-document">
      <div className="epui-document-top">
        <div className="epui-document-mark">
          <FileText size={25} />
        </div>
        <div className="epui-document-lines">
          <span />
          <span />
        </div>
      </div>

      <h1>DOCUMENT TITLE</h1>
      <p className="epui-subtitle">A short description or subtitle goes here</p>

      <section className="epui-doc-section">
        <h2>1. Introduction</h2>
        <p>
          This area represents the content of your PDF document. The original
          document will be displayed here in the finished application.
        </p>
        <p>
          Use the toolbar to add text, images, drawings and shapes to your
          document.
        </p>
      </section>

      <section className="epui-doc-section">
        <h2>2. Details</h2>
        <table className="epui-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Example 01</td>
              <td>Sample document content</td>
            </tr>
            <tr>
              <td>Example 02</td>
              <td>Additional information</td>
            </tr>
            <tr>
              <td>Example 03</td>
              <td>More document details</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="epui-doc-section epui-notes">
        <h2>3. Notes</h2>
        <p>
          This is sample content for the UI preview. It is not an actual
          uploaded PDF.
        </p>
        <div className="epui-signature-line" />
        <span className="epui-signature-label">Signature</span>
      </section>

      <span className="epui-document-page-number">1</span>
    </article>
  );
}

export default function EditPDFUI() {
  return (
    <main className="epui">
      {/* Top header and complete editing toolbar */}
      <header className="epui-header">
        <div className="epui-brand">
          <div className="epui-brand-icon">
            <FileText size={23} />
          </div>
          <span>QuickTools <b>PDF</b></span>
        </div>

        <button type="button" className="epui-back">
          <ArrowLeft size={17} />
          <span>Back to tools</span>
        </button>

        <div className="epui-file-select">
          <FileText size={17} />
          <span>POP Name</span>
          <ChevronDown size={15} />
        </div>

        <div className="epui-mode-tabs">
          <button type="button" className="active">Annotate</button>
          <button type="button">Edit</button>
        </div>

        <div className="epui-header-tools">
          <div className="epui-tool-group">
            <ToolButton icon={Hand} label="Move" active />
            <ToolButton icon={Type} label="Add text" />
            <ToolButton icon={ImageIcon} label="Add image" />
            <ToolButton icon={Pencil} label="Draw" />
            <ToolButton icon={Square} label="Add shape" />
          </div>

          <div className="epui-format-group">
            <label className="epui-select">
              <span>Arial</span>
              <ChevronDown size={13} />
            </label>
            <label className="epui-select epui-font-size">
              <span>36</span>
              <ChevronDown size={13} />
            </label>
            <ToolButton icon={Bold} label="Bold" />
            <ToolButton icon={Italic} label="Italic" />
            <ToolButton icon={Underline} label="Underline" />
            <button className="epui-color-button" title="Text color" type="button">
              <span>A</span>
              <i />
            </button>
            <ToolButton icon={Eraser} label="Eraser" />
            <ToolButton icon={AlignLeft} label="Text alignment" />
            <ToolButton icon={Palette} label="Color options" />
          </div>

          <div className="epui-zoom-select">
            100% <ChevronDown size={13} />
          </div>

          <div className="epui-history-tools">
            <ToolButton icon={Undo2} label="Undo" />
            <ToolButton icon={Redo2} label="Redo" />
          </div>

          <ToolButton icon={Trash2} label="Delete" danger />
          <ToolButton icon={Eye} label="Preview" />
        </div>
      </header>

      {/* Main editor workspace */}
      <div className="epui-workspace">
        <aside className="epui-left-sidebar">
          <div className="epui-sidebar-heading">
            <strong>Pages</strong>
            <button type="button" className="epui-add-page-icon" aria-label="Add page">
              <Plus size={19} />
            </button>
          </div>

          <div className="epui-thumbnails">
            {pages.map((page) => (
              <PageThumbnail key={page.number} page={page} />
            ))}
          </div>

          <button type="button" className="epui-add-page">
            <Plus size={16} />
            Add page
          </button>
        </aside>

        <section className="epui-viewer">
          <div className="epui-viewer-file">
            <FileText size={17} />
            <span>POP Name.pdf</span>
          </div>

          <div className="epui-canvas">
            <DocumentPreview />
          </div>

          {/* Floating navigation stays below the PDF, not the editing toolbar */}
          <div className="epui-page-controls">
            <button type="button" aria-label="Previous page">
              <ChevronLeft size={18} />
            </button>
            <span className="epui-page-count">1 <i>/</i> 3</span>
            <button type="button" aria-label="Next page">
              <ChevronRight size={18} />
            </button>

            <span className="epui-control-divider" />

            <button type="button" aria-label="Zoom out">
              <ZoomOut size={17} />
            </button>
            <span className="epui-current-zoom">100% <ChevronDown size={13} /></span>
            <button type="button" aria-label="Zoom in">
              <ZoomIn size={17} />
            </button>

            <span className="epui-control-divider" />

            <button type="button" aria-label="Rotate left">
              <RotateCcw size={17} />
            </button>
            <button type="button" aria-label="Rotate right">
              <RotateCw size={17} />
            </button>

            <span className="epui-control-divider" />

            <button type="button" aria-label="Preview page">
              <Eye size={17} />
            </button>
          </div>
        </section>

        <aside className="epui-right-sidebar">
          <div className="epui-page-list-heading">
            <strong>Page list</strong>
            <button type="button">Remove all</button>
          </div>

          <div className="epui-page-list">
            {pages.map((page) => (
              <PageListItem key={page.number} page={page} />
            ))}
          </div>

          <div className="epui-right-bottom">
            <div className="epui-preview-notice">
              <div className="epui-notice-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <strong>UI preview only</strong>
                <p>No files are uploaded or changed in this prototype.</p>
              </div>
            </div>

            <button type="button" className="epui-edit-button">
              Edit PDF <ChevronRight size={18} />
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
