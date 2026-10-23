
import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  ArrowLeft,
  CheckCircle2,
  Combine,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import PDFPreview from "../components/PDFPreview";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function SortablePDFCard({ file, onRemove, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: fileKey(file),
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`merge-sortable-card ${
        isDragging ? "is-dragging" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <PDFPreview file={file} onRemove={onRemove} />
    </div>
  );
}

function DraggedPDFCard({ file }) {
  if (!file) return null;

  return (
    <div className="merge-drag-overlay">
      <div className="merge-drag-overlay-icon">
        <FileText size={30} />
      </div>
      <div className="merge-drag-overlay-info">
        <strong title={file.name}>{file.name}</strong>
        <span>
          {(file.size / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>
    </div>
  );
}

export default function MergePDF() {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeFile, setActiveFile] = useState(null);

  const inputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalSize = files.reduce(
    (total, file) => total + file.size,
    0
  );

  function addFiles(fileList) {
    setError("");
    setSuccess("");

    const selected = Array.from(fileList || []);
    const pdfs = selected.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );

    if (selected.length !== pdfs.length) {
      setError(
        "Only PDF files are supported. Non-PDF files were skipped."
      );
    }

    setFiles((current) => {
      const next = [...current];

      for (const file of pdfs) {
        const duplicate = next.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (!duplicate) next.push(file);
      }

      return next;
    });
  }

  function removeFile(fileToRemove) {
    setFiles((current) =>
      current.filter(
        (file) => fileKey(file) !== fileKey(fileToRemove)
      )
    );

    setError("");
    setSuccess("");
  }

  function handleDragStart(event) {
    const file = files.find(
      (item) => fileKey(item) === event.active.id
    );

    setActiveFile(file || null);
    setError("");
    setSuccess("");
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    setActiveFile(null);

    if (!over || active.id === over.id) return;

    setFiles((current) => {
      const oldIndex = current.findIndex(
        (file) => fileKey(file) === active.id
      );

      const newIndex = current.findIndex(
        (file) => fileKey(file) === over.id
      );

      if (oldIndex < 0 || newIndex < 0) return current;

      return arrayMove(current, oldIndex, newIndex);
    });

    setSuccess("");
  }

  function handleDragCancel() {
    setActiveFile(null);
  }

  async function mergePDFs() {
    setError("");
    setSuccess("");

    if (files.length < 2) {
      setError("Please select at least two PDF files to merge.");
      return;
    }

    setIsMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(buffer);
        const pageIndices = sourcePdf.getPageIndices();

        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          pageIndices
        );

        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();

      const blob = new Blob([mergedBytes], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "quicktools-merged.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setSuccess("Your PDFs were merged successfully!");
    } catch (err) {
      console.error("PDF merge error:", err);

      setError(
        "We couldn't merge these files. Check that every PDF is valid and not password-protected."
      );
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <main className="merge-page">
      <div className="merge-container">
        <Link to="/" className="merge-back">
          <ArrowLeft size={17} />
          Back to all tools
        </Link>

        <header className="merge-heading">
          <div className="merge-heading-icon">
            <Combine size={28} />
          </div>

          <div>
            <span className="merge-eyebrow">PDF TOOL</span>
            <h1>Merge PDF</h1>
            <p>
              Combine multiple PDF documents into one file.
              Arrange them in the order you want before merging.
            </p>
          </div>
        </header>

        <section className="merge-workspace">
          <div className="merge-workspace-top">
            <div>
              <h2>Your PDF files</h2>
              <p>
                {files.length}{" "}
                {files.length === 1 ? "file" : "files"} selected
                {files.length > 0 &&
                  ` · ${(totalSize / (1024 * 1024)).toFixed(2)} MB`}
              </p>
            </div>

            <button
              type="button"
              className="merge-add-button"
              onClick={() => inputRef.current?.click()}
              disabled={isMerging}
            >
              <Plus size={17} />
              Select PDF files
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {files.length === 0 ? (
            <button
              type="button"
              className="merge-dropzone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
              disabled={isMerging}
            >
              <span className="merge-upload-icon">
                <UploadCloud size={32} />
              </span>

              <strong>Choose PDF files to merge</strong>
              <span>
                Click here or drag and drop your PDFs
              </span>
              <small>Select two or more PDF files</small>
            </button>
          ) : (
            <>
              {files.length === 1 && (
                <div className="merge-notice" role="status">
                  <strong>Please select more PDF files.</strong>
                  <p>
                    Click "Select PDF files" or "Add another PDF"
                    to add more documents.
                  </p>
                  <p>
                    To select multiple files at once, hold Ctrl
                    while selecting them on Windows.
                  </p>
                </div>
              )}

              {files.length >= 2 && (
                <div className="merge-notice" role="status">
                <strong>Arrange your PDFs in the order you want.</strong>
                <p>
                    Drag and drop cards to change their order. The first card
                    will be merged first.
                </p>
                </div>
                )}

              <section className="merge-preview-section">
                <div className="merge-preview-heading">
                <div>
                    <h2>Uploaded PDFs</h2>
                </div>

                <span>
                    {files.length}{" "}
                    {files.length === 1 ? "PDF" : "PDFs"}
                </span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext
                    items={files.map(fileKey)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="qt-pdf-gallery">
                      {files.map((file) => (
                        <SortablePDFCard
                          key={fileKey(file)}
                          file={file}
                          onRemove={() => removeFile(file)}
                          disabled={isMerging}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay dropAnimation={null}>
                    <DraggedPDFCard file={activeFile} />
                  </DragOverlay>
                </DndContext>

                <button
                  type="button"
                  className="merge-add-another"
                  onClick={() => inputRef.current?.click()}
                  disabled={isMerging}
                >
                  <Plus size={17} />
                  Add another PDF
                </button>
              </section>
            </>
          )}

          {error && (
            <div className="merge-message merge-error" role="alert">
              <X size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="merge-message merge-success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <div className="merge-footer">
            <button
              type="button"
              className="merge-clear-button"
              onClick={() => {
                setFiles([]);
                setError("");
                setSuccess("");
                setActiveFile(null);
              }}
              disabled={files.length === 0 || isMerging}
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button"
              onClick={mergePDFs}
              disabled={files.length < 2 || isMerging}
            >
              {isMerging ? (
                <>
                  <LoaderCircle
                    className="merge-spinner"
                    size={18}
                  />
                  Merging PDFs...
                </>
              ) : (
                <>
                  <Combine size={18} />
                  Merge PDFs
                  <Download size={17} />
                </>
              )}
            </button>
          </div>
        </section>

        <div className="merge-privacy">
          <CheckCircle2 size={18} />
          <span>
            <strong>Simple and secure.</strong> PDF processing
            happens in your browser; your files aren't uploaded
            to a server by this tool.
          </span>
        </div>

        <section className="merge-how">
          <h2>How to merge PDF files</h2>

          <div className="merge-steps">
            <div>
              <span>01</span>
              <h3>Select PDFs</h3>
              <p>Choose two or more PDF documents.</p>
            </div>

            <div>
              <span>02</span>
              <h3>Arrange files</h3>
              <p>Drag cards to set their order.</p>
            </div>

            <div>
              <span>03</span>
              <h3>Merge and download</h3>
              <p>Combine your documents into one PDF.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
