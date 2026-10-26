import React, { useEffect, useRef, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ArrowLeft, CheckCircle2, Download, FileText, LoaderCircle, PenLine,
  RotateCcw, UploadCloud, X, ChevronLeft, ChevronRight, Type, Upload, Copy,
  UserRound, CalendarDays, Stamp, Pencil, CaseSensitive, GripVertical, Trash2, Check
} from "lucide-react";
import { Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import "../styles.css";
import "../sign-pdf.css";
import PageSEO from "../components/PageSEO";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const SIGNATURE_COLORS = ["#28264a", "#6257f5", "#3478f6", "#20a878"];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || "").replace(/\/$/, "");
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const SIGNATURE_STYLES = [
  { id: "script", label: "Classic script", font: '"Brush Script MT","Segoe Script",cursive', style: "italic" },
  { id: "elegant", label: "Elegant script", font: '"Segoe Script","Brush Script MT",cursive', style: "italic" },
  { id: "calligraphy", label: "Calligraphy", font: '"URW Chancery L","Apple Chancery",cursive', style: "italic" },
  { id: "handwriting", label: "Handwriting", font: '"Comic Sans MS","Segoe Print",cursive', style: "normal" },
  { id: "casual", label: "Casual handwritten", font: '"Bradley Hand","Comic Sans MS",cursive', style: "italic" },
  { id: "formal", label: "Simple formal", font: 'Georgia,serif', style: "italic" },
  { id: "classic", label: "Classic serif", font: '"Times New Roman",serif', style: "italic" },
  { id: "modern", label: "Modern clean", font: 'Arial,sans-serif', style: "normal" },
  { id: "bold", label: "Bold signature", font: 'Arial,sans-serif', style: "italic" },
  { id: "monospace", label: "Monospace", font: '"Courier New",monospace', style: "italic" }
];
function safeName(name) {
  return name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "signed-document";
}
function makeTextImage(text, color, font, fontStyle = "italic") {
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.font = `${fontStyle} 112px ${font}`;
  ctx.fillText(text.slice(0, 60), 22, 132, 1050);
  return canvas.toDataURL("image/png");
}
function getInitials(name) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function SignPDF() {
  const inputRef = useRef(null);
  const signatureUploadRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dragRef = useRef(null);

  const [file, setFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState("type");
  const [fieldPanelVisible, setFieldPanelVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [typedName, setTypedName] = useState("");
  const [signatureColor, setSignatureColor] = useState(SIGNATURE_COLORS[0]);
  const [signatureStyle, setSignatureStyle] = useState(SIGNATURE_STYLES[0].id);
  const [signatureData, setSignatureData] = useState("");
  const [mobileSignatureData, setMobileSignatureData] = useState("");
  const [signatureReady, setSignatureReady] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState({ x: 0.52, y: 0.72 });
  const [signatureWidth, setSignatureWidth] = useState(0.27);
  const [signatureImage, setSignatureImage] = useState("");
  const [companyStampImage, setCompanyStampImage] = useState("");
  const [stampModalOpen, setStampModalOpen] = useState(false);
  const [fieldEditId, setFieldEditId] = useState(null);
  const [fieldEditValue, setFieldEditValue] = useState("");
  const [fields, setFields] = useState([]);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [mobileSessionId, setMobileSessionId] = useState("");
  const [mobileQrOpen, setMobileQrOpen] = useState(false);
  const [mobileConnected, setMobileConnected] = useState(false);
  const [mobileSent, setMobileSent] = useState(false);
  const [mobileMessage, setMobileMessage] = useState("");
  const [mobileCanvasHasInk, setMobileCanvasHasInk] = useState(false);
  const [isMobileSigner] = useState(() => new URLSearchParams(window.location.search).has("mobileSign"));
  const mobileSessionFromUrl = new URLSearchParams(window.location.search).get("mobileSign") || "";
  const mobileCanvasRef = useRef(null);
  const mobileDrawingRef = useRef(false);
  const mobileInkRef = useRef(false);

  const selectedStyle = SIGNATURE_STYLES.find((item) => item.id === signatureStyle) || SIGNATURE_STYLES[0];

  // Keep every placed initials field in sync with the signature font and colour.
  useEffect(() => {
    const initialsText = initials || getInitials(fullName) || "AB";
    const nextImage = makeTextImage(initialsText, signatureColor, selectedStyle.font, selectedStyle.style);
    setFields((old) => {
      let changed = false;
      const next = old.filter(Boolean).map((field) => {
        if (field.type !== "initials" || !field.imageField || field.value === nextImage) return field;
        changed = true;
        return { ...field, value: nextImage };
      });
      return changed ? next : old;
    });
  }, [initials, fullName, signatureColor, selectedStyle]);

  useEffect(() => {
    if (!supabase || !mobileSessionId || isMobileSigner) return;
    const channel = supabase.channel(`sign-${mobileSessionId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "signature" }, ({ payload }) => {
        if (payload?.signatureData) {
          // Keep the received image separate from the local drawing canvas so it
          // remains visible and can be applied even when the desktop canvas is blank.
          setMobileSignatureData(payload.signatureData);
          setSignatureData(payload.signatureData);
          setSignatureReady(false);
          setSignatureMethod("draw");
          setMobileSent(true);
          setMobileMessage("Signature received from your mobile device.");
          setSuccess("Signature received from your mobile device.");
          setMobileQrOpen(false);
          setSignatureModalOpen(true);
        }
      })
      .subscribe((status) => {
        setMobileConnected(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, [mobileSessionId, isMobileSigner]);


  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      if (!pdfDocument || !pdfCanvasRef.current) return;
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(250, Math.min(760, window.innerWidth - 330));
        const scale = Math.min(1.35, availableWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        if (!cancelled) setError("We couldn't preview this PDF page. Please try another file.");
      }
    }
    renderPage();
    return () => { cancelled = true; };
  }, [pdfDocument, pageNumber, fieldPanelVisible]);

  useEffect(() => () => {
    if (pdfDocument) {
      try { pdfDocument.destroy(); } catch { /* already closed */ }
    }
  }, [pdfDocument]);

  function clearDrawing() {
    const canvas = signatureCanvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
    setSignatureReady(false);
    setError("");
  }
  function getDrawingPoint(event) {
    const canvas = signatureCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  }
  function startDrawing(event) {
    if (signatureMethod !== "draw" || processing) return;
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture?.(event.pointerId);
    const point = getDrawingPoint(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = signatureColor;
  }
  function continueDrawing(event) {
    if (!drawingRef.current || signatureMethod !== "draw") return;
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getDrawingPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  function stopDrawing() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = signatureCanvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL("image/png"));
    setSignatureReady(false);
  }
  function beginMobileSignature() {
    if (!supabase) {
      setError("Mobile signing needs Supabase setup. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart Vite.");
      return;
    }
    const id = `${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    setMobileSessionId(id);
    setMobileSent(false);
    setMobileSignatureData("");
    setMobileMessage("Scan this QR code with your phone camera.");
    setMobileQrOpen(true);
  }

  function getMobilePoint(event) {
    const canvas = mobileCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  }
  function startMobileDrawing(event) {
    event.preventDefault();
    const canvas = mobileCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || mobileSent) return;
    canvas.setPointerCapture?.(event.pointerId);
    const point = getMobilePoint(event);
    mobileDrawingRef.current = true;
    mobileInkRef.current = true;
    setMobileCanvasHasInk(true);
    ctx.beginPath(); ctx.moveTo(point.x, point.y);
    ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = signatureColor;
  }
  function continueMobileDrawing(event) {
    if (!mobileDrawingRef.current) return;
    event.preventDefault();
    const canvas = mobileCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getMobilePoint(event); ctx.lineTo(point.x, point.y); ctx.stroke();
  }
  function stopMobileDrawing() { mobileDrawingRef.current = false; }
  function clearMobileDrawing() {
    const canvas = mobileCanvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    mobileInkRef.current = false; setMobileCanvasHasInk(false); setMobileSent(false);
  }
  async function sendMobileSignature() {
    if (!supabase || !mobileSessionFromUrl) {
      setMobileMessage("This signing link is missing a valid session."); return;
    }
    const canvas = mobileCanvasRef.current;
    if (!canvas || !mobileInkRef.current) {
      setMobileMessage("Please draw your signature before applying it."); return;
    }
    setMobileMessage("Sending signature to your computer…");
    try {
      const signatureData = canvas.toDataURL("image/png");
      const channel = supabase.channel(`sign-${mobileSessionFromUrl}`, { config: { broadcast: { self: false } } });
      await new Promise((resolve, reject) => {
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try {
              const result = await channel.send({ type: "broadcast", event: "signature", payload: { signatureData, sentAt: Date.now() } });
              if (result === "ok") resolve(); else reject(new Error("Could not send signature."));
            } catch (error) { reject(error); }
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error("Could not connect to the computer."));
        });
      });
      setMobileSent(true);
      setMobileMessage("Signature sent to your computer! You can close this tab.");
      await supabase.removeChannel(channel);
    } catch (error) {
      setMobileMessage(error?.message || "Could not send your signature. Please try again.");
    }
  }

  function chooseMethod(method) {
    setSignatureMethod(method);
    setSignatureReady(false);
    setError("");
    if (method === "type") setTypedName(fullName || typedName);
  }
  function prepareSignatureData() {
    if (signatureMethod === "type") {
      const name = (typedName || fullName).trim();
      if (!name) {
        setError("Enter your full name before continuing.");
        return "";
      }
      return makeTextImage(name, signatureColor, selectedStyle.font, selectedStyle.style);
    }
    if (signatureMethod === "upload") {
      if (!signatureImage) {
        setError("Upload an image of your signature first.");
        return "";
      }
      return signatureImage;
    }
    if (mobileSent && mobileSignatureData) return mobileSignatureData;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return signatureData || "";
    const ctx = canvas.getContext("2d");
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasInk = false;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) { hasInk = true; break; }
    if (!hasInk) {
      if (signatureData && mobileSent) return signatureData;
      setError("Draw your signature in the box first.");
      return "";
    }
    return canvas.toDataURL("image/png");
  }
  function applySignatureSetup() {
    const data = prepareSignatureData();
    if (!data) return;
    const name = fullName.trim() || typedName.trim();
    setFullName(name);
    setTypedName(name);
    setInitials(initials.trim() || getInitials(name));
    setSignatureData(data);
    setSignatureReady(true);
    setSignaturePosition({ x: 0.52, y: 0.72 });
    setFieldPanelVisible(true);
    setSignatureModalOpen(false);
    setError("");
    setSuccess("Signature ready. Drag a field from the left panel onto the PDF.");
  }
  async function loadPDF(selectedFile) {
    if (!selectedFile) return;
    setError("");
    setSuccess("");
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("This PDF is larger than 100 MB. Please choose a smaller file.");
      return;
    }
    setLoading(true);
    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const document = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      if (!document.numPages) throw new Error("This PDF does not contain any pages.");
      if (pdfDocument) {
        try { await pdfDocument.destroy(); } catch { /* already closed */ }
      }
      setFile(selectedFile);
      setPdfBytes(bytes);
      setPdfDocument(document);
      setPageCount(document.numPages);
      setPageNumber(1);
      setSignaturePosition({ x: 0.52, y: 0.72 });
      setSignatureReady(false);
      setFields([]);
      setFieldPanelVisible(false);
      setSignatureModalOpen(true);
      setSuccess("");
    } catch (e) {
      console.error("Sign PDF load error:", e);
      setError(e?.message?.toLowerCase().includes("password")
        ? "This PDF is password-protected. Remove its password protection before signing."
        : "We couldn't open this PDF. It may be damaged or password-protected.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function startSignatureDrag(event, fieldId = "signature") {
    event.preventDefault();
    event.stopPropagation();
    const canvas = pdfCanvasRef.current;
    if (!canvas) return;
    const field = fields.find((item) => item.id === fieldId);
    const position = field ? { x: field.x, y: field.y } : signaturePosition;
    dragRef.current = { fieldId, startX: event.clientX, startY: event.clientY, initialX: position.x, initialY: position.y };
    setActiveFieldId(fieldId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveSignatureDrag(event) {
    const drag = dragRef.current;
    if (!drag || !pdfCanvasRef.current) return;
    const rect = pdfCanvasRef.current.getBoundingClientRect();
    if (drag.kind === "resize") {
      const delta = (event.clientX - drag.startX) / rect.width;
      const nextWidth = Math.max(0.07, Math.min(0.65, drag.initialWidth + delta));
      if (drag.fieldId === "signature") setSignatureWidth(nextWidth);
      else setFields((old) => old.filter(Boolean).map((item) => item.id === drag.fieldId ? { ...item, width: nextWidth } : item));
      return;
    }
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    const next = { x: Math.max(0.03, Math.min(0.97, drag.initialX + dx)), y: Math.max(0.03, Math.min(0.97, drag.initialY + dy)) };
    const draggedFieldId = drag.fieldId;
    if (draggedFieldId === "signature") setSignaturePosition(next);
    else setFields((old) => old.filter(Boolean).map((item) => item.id === draggedFieldId ? { ...item, ...next } : item));
  }
  function startFieldResize(event, fieldId = "signature") {
    event.preventDefault();
    event.stopPropagation();
    const rect = pdfCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const field = fields.find((item) => item.id === fieldId);
    dragRef.current = { kind: "resize", fieldId, startX: event.clientX, initialWidth: field?.width ?? (field ? 0.18 : signatureWidth) };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function removeField(fieldId) {
    if (fieldId === "signature") {
      setSignatureReady(false);
      setActiveFieldId(null);
      return;
    }
    setFields((old) => old.filter((item) => item && item.id !== fieldId));
    setActiveFieldId((old) => old === fieldId ? null : old);
  }
  function duplicateField(fieldId) {
    if (fieldId === "signature") {
      const copy = { id: `signature-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "signature", label: "Signature", value: signatureData, x: Math.min(0.92, signaturePosition.x + 0.06), y: Math.min(0.92, signaturePosition.y + 0.05), width: signatureWidth };
      setFields((old) => [...old, copy]);
      setActiveFieldId(copy.id);
      return;
    }
    const source = fields.find((item) => item.id === fieldId);
    if (!source) return;
    const copy = { ...source, id: `${source.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, x: Math.min(0.92, source.x + 0.06), y: Math.min(0.92, source.y + 0.04) };
    setFields((old) => [...old, copy]);
    setActiveFieldId(copy.id);
  }
  function endSignatureDrag() { dragRef.current = null; }
  function addField(type) {
    if (!pdfDocument) return;
    if (type === "stamp") { setStampModalOpen(true); return; }
    if (type === "signature") {
      if (!signatureData) { setSignatureModalOpen(true); return; }
      setSignatureReady(true);
      setSignaturePosition({ x: 0.5, y: 0.7 });
      setActiveFieldId("signature");
      return;
    }
    const defaults = {
      initials: { label: "Initials", value: makeTextImage(initials || getInitials(fullName) || "AB", signatureColor, selectedStyle.font, selectedStyle.style), x: 0.5, y: 0.8, imageField: true },
      name: { label: "Name", value: fullName || "Full name", x: 0.5, y: 0.83 },
      date: { label: "Date", value: new Date().toLocaleDateString(), x: 0.5, y: 0.86 },
      text: { label: "Text", value: "Enter text", x: 0.5, y: 0.89 },
      stamp: { label: "Company Stamp", value: "COMPANY STAMP", x: 0.5, y: 0.92 }
    };
    const def = defaults[type];
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setFields((old) => [...old, { id, type, ...def }]);
    setActiveFieldId(id);
  }
  function updateFieldValue(id, value) {
    setFields((old) => old.filter(Boolean).map((item) => item.id === id ? { ...item, value } : item));
  }

  function loadCompanyStamp(selectedFile) {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) { setError("Please choose a PNG, JPG, or SVG image for your company stamp."); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError("Company stamp image must be smaller than 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) { setError("We couldn't process that stamp image."); return; }
        context.drawImage(image, 0, 0);
        const value = canvas.toDataURL("image/png");
        setCompanyStampImage(value);
        const id = `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setFields((old) => [...old.filter(Boolean), { id, type: "stampImage", label: "Company Stamp", value, x: 0.5, y: 0.82, width: 0.22 }]);
        setActiveFieldId(id); setStampModalOpen(false); setError("");
      };
      image.onerror = () => setError("We couldn't read that stamp image.");
      image.src = String(reader.result || "");
    };
    reader.onerror = () => setError("We couldn't read that stamp image.");
    reader.readAsDataURL(selectedFile);
  }
  function openFieldEditor(field) {
    if (!field) return;
    setFieldEditId(field.id); setFieldEditValue(field.value || "");
  }
  function saveFieldEditor() {
    setFields((old) => old.filter(Boolean).map((item) => item.id === fieldEditId ? { ...item, value: fieldEditValue } : item));
    setFieldEditId(null);
  }

  async function downloadSignedPDF() {
    const hasPrimarySignature = Boolean(signatureReady && signatureData);
    if (!file || !pdfBytes || (!hasPrimarySignature && fields.length === 0) || processing) {
      setError("Add at least one signature or field to the PDF before downloading.");
      return;
    }
    setProcessing(true);
    setError("");
    setSuccess("");
    try {
      const output = await PDFDocument.load(pdfBytes);
      const targetPage = output.getPage(pageNumber - 1);
      if (hasPrimarySignature) {
        const signatureBuffer = await fetch(signatureData).then((response) => response.arrayBuffer());
        const image = await output.embedPng(signatureBuffer);
        const width = targetPage.getWidth() * signatureWidth;
        const height = width * (image.height / image.width);
        const centerX = signaturePosition.x * targetPage.getWidth();
        const centerY = (1 - signaturePosition.y) * targetPage.getHeight();
        targetPage.drawImage(image, {
          x: Math.max(0, Math.min(targetPage.getWidth() - width, centerX - width / 2)),
          y: Math.max(0, Math.min(targetPage.getHeight() - height, centerY - height / 2)),
          width, height
        });
      }
      for (const field of fields) {
        const cx = field.x * targetPage.getWidth();
        const cy = (1 - field.y) * targetPage.getHeight();
        if ((field.type === "signature" || field.type === "stampImage" || field.imageField) && field.value) {
          const imageBytes = await fetch(field.value).then((response) => response.arrayBuffer());
          const fieldImage = await output.embedPng(imageBytes);
          const width = targetPage.getWidth() * (field.width || 0.27);
          const height = width * (fieldImage.height / fieldImage.width);
          targetPage.drawImage(fieldImage, { x: Math.max(0, Math.min(targetPage.getWidth() - width, cx - width / 2)), y: Math.max(0, Math.min(targetPage.getHeight() - height, cy - height / 2)), width, height });
          continue;
        }
        const fontSize = field.type === "stamp" ? 13 : 12;
        const text = field.value || "";
        const font = await output.embedFont("Helvetica");
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        targetPage.drawText(text, {
          x: Math.max(0, Math.min(targetPage.getWidth() - textWidth, cx - textWidth / 2)),
          y: Math.max(0, Math.min(targetPage.getHeight() - fontSize, cy - fontSize / 2)),
          size: fontSize,
          color: rgb(0.25, 0.19, 0.14)
        });
      }
      const outputBytes = await output.save();
      const url = URL.createObjectURL(new Blob([outputBytes], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeName(file.name)}-signed.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setSuccess(`Your signed PDF has been downloaded. Fields applied to page ${pageNumber}.`);
    } catch (e) {
      console.error("Sign PDF export error:", e);
      setError(e?.message?.toLowerCase().includes("encrypt")
        ? "This PDF is encrypted. Remove its password protection and try again."
        : "Something went wrong while applying your signature. Please try again.");
    } finally { setProcessing(false); }
  }
  function clearAll() {
    if (pdfDocument) { try { pdfDocument.destroy(); } catch { /* already closed */ } }
    setFile(null); setPdfBytes(null); setPdfDocument(null); setPageNumber(1); setPageCount(0);
    setSignaturePosition({ x: 0.52, y: 0.72 }); setSignatureWidth(0.27);
    setSignatureReady(false); setSignatureData(""); setTypedName(""); setFullName(""); setInitials("");
    setSignatureImage(""); setCompanyStampImage(""); setStampModalOpen(false); setFieldEditId(null); setFields([]); setFieldPanelVisible(false); setSignatureModalOpen(false); setMobileQrOpen(false); setMobileSessionId("");
    setError(""); setSuccess("");
    const canvas = signatureCanvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    if (inputRef.current) inputRef.current.value = "";
  }
  async function loadSignatureImage(selectedFile) {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please upload a PNG, JPG, or other image file for your signature.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Signature image must be smaller than 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) { setError("We couldn't process that signature image."); return; }
        context.drawImage(image, 0, 0);
        setSignatureImage(canvas.toDataURL("image/png")); setError("");
      };
      image.onerror = () => setError("We couldn't read that signature image.");
      image.src = String(reader.result || "");
    };
    reader.onerror = () => setError("We couldn't read that signature image.");
    reader.readAsDataURL(selectedFile);
    if (signatureUploadRef.current) signatureUploadRef.current.value = "";
  }

  const previewWidth = pdfCanvasRef.current?.clientWidth || 612;
  if (isMobileSigner) {
    return (
      <main className="sign-mobile-page">
        <section className="sign-mobile-card">
          <div className="sign-mobile-brand">quicktools <span>· Sign PDF</span></div>
          <h1>{mobileSent ? "Signature sent" : "Draw your signature"}</h1>
          <p>{mobileSent ? "Your signature has been sent to the computer. You can safely close this tab." : "Draw your signature in the box below, then send it back to your computer."}</p>
          {mobileSent ? <div className="sign-mobile-success"><CheckCircle2 size={30} /><strong>Signature sent to your computer!</strong><span>You can close this tab and return to your PDF.</span></div> : <>
            <div className="sign-mobile-draw-wrap"><canvas ref={mobileCanvasRef} width={1000} height={320} onPointerDown={startMobileDrawing} onPointerMove={continueMobileDrawing} onPointerUp={stopMobileDrawing} onPointerCancel={stopMobileDrawing} className="sign-mobile-canvas" aria-label="Draw your signature" /><span>Use your finger to sign here</span></div>
            <div className="sign-mobile-actions"><button type="button" className="sign-secondary-button" onClick={clearMobileDrawing}><RotateCcw size={17} /> Clear</button><button type="button" className="sign-primary-button" onClick={sendMobileSignature} disabled={!mobileCanvasHasInk}><CheckCircle2 size={17} /> Apply signature</button></div>
          </>}
          {mobileMessage && <p className="sign-mobile-message" role="status">{mobileMessage}</p>}
          {!supabase && <p className="sign-mobile-message sign-mobile-error">Mobile signing is not configured yet. Please contact the person setting up this tool.</p>}
        </section>
      </main>
    );
  }
  return (
    <main className="merge-page sign-tool-page">
      <PageSEO
        title="Sign PDF Online Free | QuickTools"
        description="Sign PDF documents online by adding your signature to a PDF with QuickTools. Prepare signed documents conveniently."
        path="/sign-pdf"
      />
      <div className="merge-container sign-tool-inner">
        <Link to="/" className="merge-back"><ArrowLeft size={17} /> Back to all tools</Link>
        <header className="merge-heading">
          <div className="merge-heading-icon"><PenLine size={27} /></div>
          <div><span className="merge-eyebrow">PDF TOOL</span><h1>Sign PDF</h1><p>Create a signature, place signing fields, and download your signed PDF.</p></div>
        </header>
        <section className="merge-workspace">
          <div className="merge-workspace-top">
            <div><h2>Your PDF file</h2><p>{file ? `${file.name} · ${(file.size / 1048576).toFixed(2)} MB · ${pageCount} ${pageCount === 1 ? "page" : "pages"}` : "Upload a PDF to get started"}</p></div>
            {file && <button type="button" className="merge-add-button" onClick={() => inputRef.current?.click()} disabled={loading || processing}><UploadCloud size={17} /> Replace PDF</button>}
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => loadPDF(e.target.files?.[0])} />
          </div>
          {!file ? (
            <button type="button" className={`merge-dropzone ${draggingFile ? "sign-drop-active" : ""}`} onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)}
              onDrop={(e) => { e.preventDefault(); setDraggingFile(false); loadPDF(e.dataTransfer.files?.[0]); }} disabled={loading}>
              <span className="merge-upload-icon">{loading ? <LoaderCircle className="sign-spin" size={32} /> : <UploadCloud size={32} />}</span>
              <strong>{loading ? "Opening your PDF…" : "Choose a PDF to sign"}</strong>
              <span>{loading ? "Loading PDF pages. Please wait." : "Click here or drag and drop a PDF file"}</span>
              {!loading && <small>PDF files only · Maximum 100 MB</small>}
            </button>
          ) : (
            <>
              <div className="merge-notice sign-notice"><strong>Set up your signature and fields.</strong><p>Choose a field from the left panel and position it on the PDF. Your signature setup opens automatically after upload.</p></div>
              <div className="sign-editor">
                {fieldPanelVisible && <aside className="sign-field-sidebar">
                  <h2>Fields</h2>
                  <div className="sign-field-section-title">Required fields</div>
                  <button className="sign-field-card" type="button" draggable disabled={!signatureData} onClick={() => addField("signature")} onDragStart={(e) => e.dataTransfer.setData("application/quicktools-field", "signature")}>
                    <span className="sign-field-icon"><PenLine size={19} /></span><span className="sign-field-preview">{signatureData ? <img src={signatureData} alt="Signature preview" /> : "Signature"}</span><span className="sign-required-card-actions"><button type="button" title="Edit signature" aria-label="Edit signature" onClick={(e) => { e.stopPropagation(); setSignatureMethod("type"); setTypedName(fullName || typedName); setSignatureModalOpen(true); }}><Pencil size={15} /></button><GripVertical size={17} /></span>
                  </button>
                  <div className="sign-field-section-title">Optional fields</div>
                  <button className="sign-field-card" type="button" draggable onClick={() => addField("initials")} onDragStart={(e) => e.dataTransfer.setData("application/quicktools-field", "initials")}><span className="sign-field-icon"><CaseSensitive size={19} /></span><span><strong>Initials</strong><small>{initials || "Add initials"}</small></span><GripVertical size={17} /></button>
                  <button className="sign-field-card" type="button" draggable onClick={() => addField("name")} onDragStart={(e) => e.dataTransfer.setData("application/quicktools-field", "name")}><span className="sign-field-icon"><UserRound size={19} /></span><span><strong>Name</strong><small>{fullName || "Add name"}</small></span><GripVertical size={17} /></button>
                  <button className="sign-field-card" type="button" draggable onClick={() => addField("date")} onDragStart={(e) => e.dataTransfer.setData("application/quicktools-field", "date")}><span className="sign-field-icon"><CalendarDays size={19} /></span><span><strong>Date</strong><small>{new Date().toLocaleDateString()}</small></span><GripVertical size={17} /></button>
                  <button className="sign-field-card" type="button" draggable onClick={() => addField("text")} onDragStart={(e) => e.dataTransfer.setData("application/quicktools-field", "text")}><span className="sign-field-icon"><Type size={19} /></span><span><strong>Text</strong><small>Custom text field</small></span><GripVertical size={17} /></button>
                  <button className="sign-field-card" type="button" onClick={() => addField("stamp")}><span className="sign-field-icon"><Stamp size={19} /></span><span><strong>Company Stamp</strong><small>Upload a stamp image</small></span><GripVertical size={17} /></button>
                  <p className="sign-field-tip">Select a field to add it to the current page, then drag it into place.</p>
                </aside>}
                <section className="sign-preview-panel">
                  <div className="sign-panel-heading"><div><h2>PDF preview</h2><p>Place your signature and fields on the document</p></div><span>Page {pageNumber} of {pageCount}</span></div>
                  <div className="sign-page-toolbar">
                    <button type="button" onClick={() => setPageNumber((n) => Math.max(1, n - 1))} disabled={pageNumber <= 1 || processing}><ChevronLeft size={17} /> Previous</button>
                    <strong>{pageNumber} / {pageCount}</strong>
                    <button type="button" onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))} disabled={pageNumber >= pageCount || processing}>Next <ChevronRight size={17} /></button>
                  </div>
                  <div className="sign-page-stage" onDragOver={(e) => { if (e.dataTransfer.types.includes("application/quicktools-field")) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); const type = e.dataTransfer.getData("application/quicktools-field"); if (!type || !pdfCanvasRef.current) return; if (type === "stamp") { setStampModalOpen(true); return; } const rect = pdfCanvasRef.current.getBoundingClientRect(); const x = Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / rect.width)); const y = Math.max(0.03, Math.min(0.97, (e.clientY - rect.top) / rect.height)); if (type === "signature") { setSignatureReady(true); setSignaturePosition({ x, y }); setActiveFieldId("signature"); } else { const defs = { initials: { label: "Initials", value: makeTextImage(initials || getInitials(fullName) || "AB", signatureColor, selectedStyle.font, selectedStyle.style), imageField: true }, name: { label: "Name", value: fullName || "Full name" }, date: { label: "Date", value: new Date().toLocaleDateString() }, text: { label: "Text", value: "Enter text" }, stamp: { label: "Company Stamp", value: "COMPANY STAMP" } }; const def = defs[type]; const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; setFields((old) => [...old, { id, type, ...def, x, y, width: 0.22 }]); setActiveFieldId(id); } }}><div className="sign-pdf-page">
                    <canvas ref={pdfCanvasRef} className="sign-pdf-canvas" />
                    {signatureReady && signatureData && <div className={`sign-positioned-signature ${activeFieldId === "signature" ? "selected" : ""}`} style={{ left: `${signaturePosition.x * 100}%`, top: `${signaturePosition.y * 100}%`, width: `${signatureWidth * 100}%` }}
                      onPointerDown={(e) => startSignatureDrag(e, "signature")} onPointerMove={moveSignatureDrag} onPointerUp={endSignatureDrag} onPointerCancel={endSignatureDrag}
                      onClick={() => setActiveFieldId("signature")} role="button" tabIndex={0} aria-label="Drag to position signature" title="Drag to position your signature"><img src={signatureData} alt="Your signature" draggable="false" /><span className="sign-item-label">Signature</span><div className="sign-item-controls" onPointerDown={(e) => e.stopPropagation()}><button type="button" title="Duplicate signature" onClick={(e) => { e.stopPropagation(); duplicateField("signature"); }}><Copy size={12} /></button><button type="button" title="Remove signature" onClick={(e) => { e.stopPropagation(); removeField("signature"); }}><X size={12} /></button></div><button type="button" className="sign-resize-handle" aria-label="Resize signature" onPointerDown={(e) => startFieldResize(e, "signature")} onPointerMove={moveSignatureDrag} onPointerUp={endSignatureDrag} onPointerCancel={endSignatureDrag} /></div>}
                    {fields.filter(Boolean).map((field) => <div key={field.id} className={`sign-field-text ${activeFieldId === field.id ? "selected" : ""}`} style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${(field.width || 0.18) * 100}%` }}
                      onPointerDown={(e) => startSignatureDrag(e, field.id)} onPointerMove={moveSignatureDrag} onPointerUp={endSignatureDrag} onPointerCancel={endSignatureDrag}
                      onClick={() => setActiveFieldId(field.id)} role="button" tabIndex={0} title={`Drag ${field.label}`}>{(field.type === "signature" || field.type === "stampImage" || field.imageField) ? <img className="sign-field-signature-image" src={field.value} alt={field.label} draggable="false" /> : <span>{field.value}</span>}<div className="sign-item-controls" onPointerDown={(e) => e.stopPropagation()}>{!field.imageField && field.type !== "stampImage" && <button type="button" title={`Edit ${field.label}`} aria-label={`Edit ${field.label}`} onClick={(e) => { e.stopPropagation(); openFieldEditor(field); }}><Pencil size={12} /></button>}<button type="button" title={`Duplicate ${field.label}`} aria-label={`Duplicate ${field.label}`} onClick={(e) => { e.stopPropagation(); duplicateField(field.id); }}><Copy size={12} /></button><button type="button" title={`Remove ${field.label}`} aria-label={`Remove ${field.label}`} onClick={(e) => { e.stopPropagation(); removeField(field.id); }}><X size={12} /></button></div><button type="button" className="sign-resize-handle" aria-label={`Resize ${field.label}`} onPointerDown={(e) => startFieldResize(e, field.id)} onPointerMove={moveSignatureDrag} onPointerUp={endSignatureDrag} onPointerCancel={endSignatureDrag} /></div>)}
                  </div></div>
                  <p className="sign-preview-tip">Fields are added to the currently selected PDF page. Select another page to sign that page.</p>
                </section>
              </div>
            </>
          )}
          {error && <div className="merge-message merge-error" role="alert"><X size={18} /><span>{error}</span></div>}
          {success && <div className="merge-message merge-success" role="status"><CheckCircle2 size={18} /><span>{success}</span></div>}
          <div className="merge-footer">
            <button type="button" className="merge-clear-button" onClick={clearAll} disabled={!file || processing || loading}>Clear all</button>
            <button type="button" className="merge-submit-button" onClick={downloadSignedPDF} disabled={!file || (!signatureReady && fields.length === 0) || processing || loading}>
              {processing ? <><LoaderCircle className="sign-spin" size={18} /> Applying signature…</> : <><FileText size={18} /> Apply & download <Download size={17} /></>}
            </button>
          </div>
        </section>
        <div className="merge-privacy"><CheckCircle2 size={18} /><span><strong>Simple and secure.</strong> Your PDF is processed in your browser; this tool does not upload it to a server.</span></div>
        <section className="merge-how"><h2>How to sign a PDF</h2><div className="merge-steps">
          <div><span>01</span><h3>Upload your PDF</h3><p>Choose the PDF document you want to sign.</p></div>
          <div><span>02</span><h3>Create and place</h3><p>Create a signature and position the fields on your PDF.</p></div>
          <div><span>03</span><h3>Download your PDF</h3><p>Apply the signature and save a new signed PDF file.</p></div>
        </div></section>
      </div>
      {signatureModalOpen && file && <div className="sign-popup-backdrop" role="presentation">
        <section className="sign-popup" role="dialog" aria-modal="true" aria-labelledby="sign-popup-title">
          <header className="sign-popup-header"><div><h2 id="sign-popup-title">Set your signature details</h2><p>Create the signature you want to use on this PDF.</p></div><button className="sign-popup-close" type="button" aria-label="Close signature setup" onClick={() => { setSignatureModalOpen(false); }}><X size={19} /></button></header>
          <div className="sign-popup-body">
            <div className="sign-popup-details">
              <label className="sign-popup-label">Full name<input className="sign-popup-input" value={fullName} onChange={(e) => { const value = e.target.value; setFullName(value); setTypedName(value); if (!initials || initials === getInitials(fullName)) setInitials(getInitials(value)); setSignatureReady(false); }} placeholder="Enter your full name" /></label>
              <label className="sign-popup-label">Initials<input className="sign-popup-input" value={initials} onChange={(e) => setInitials(e.target.value)} maxLength={8} placeholder="AB" /></label>
            </div>
            <div className="sign-popup-tabs">
              <button type="button" className={signatureMethod === "type" ? "active" : ""} onClick={() => chooseMethod("type")}><Type size={19} /> Type</button>
              <button type="button" className={signatureMethod === "draw" ? "active" : ""} onClick={() => chooseMethod("draw")}><PenLine size={19} /> Draw</button>
              <button type="button" className={signatureMethod === "upload" ? "active" : ""} onClick={() => chooseMethod("upload")}><Upload size={19} /> Upload</button>
            </div>
            <div className="sign-popup-workspace">
              {signatureMethod === "type" && <>
                <label className="sign-name-label"><span>Signature preview</span><input value={typedName} onChange={(e) => { setTypedName(e.target.value); setSignatureReady(false); }} placeholder="Type your full name" maxLength={60} /></label>
                <div className="sign-style-list" style={{ marginTop: 12 }}>{SIGNATURE_STYLES.map((style) => <button key={style.id} type="button" className={`sign-style-option ${signatureStyle === style.id ? "active" : ""}`} onClick={() => setSignatureStyle(style.id)}><input type="radio" readOnly checked={signatureStyle === style.id} /><span className="sign-style-sample" style={{ fontFamily: style.font, fontStyle: style.style, color: signatureColor }}>{typedName || fullName || "Your signature"}</span></button>)}</div>
              </>}
              {signatureMethod === "draw" && <>
                {mobileSent && mobileSignatureData ? <div className="sign-mobile-received-preview">
                  <div className="sign-mobile-received-heading"><CheckCircle2 size={18} /><strong>Signature received from your phone</strong></div>
                  <div className="sign-mobile-received-image"><img src={mobileSignatureData} alt="Signature received from mobile device" /></div>
                  <p>Your signature is ready. Click <strong>Apply signature</strong> below to place it on the PDF.</p>
                  <div className="sign-signature-actions">
                    <button type="button" className="sign-secondary-button" onClick={() => { setMobileSignatureData(""); setMobileSent(false); setSignatureData(""); setSignatureReady(false); clearDrawing(); }}>Clear and draw again</button>
                    <button type="button" className="sign-secondary-button" onClick={beginMobileSignature}><UploadCloud size={16} /> Use phone again</button>
                  </div>
                </div> : <div className="sign-draw-layout"><div><div className="sign-draw-wrap"><canvas ref={signatureCanvasRef} width={900} height={240} className="sign-draw-canvas" aria-label="Draw your signature here" onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} /><span>Draw using your mouse, touchpad, or finger</span></div><div className="sign-signature-actions"><button type="button" className="sign-secondary-button" onClick={clearDrawing}><RotateCcw size={16} /> Clear drawing</button><button type="button" className="sign-secondary-button" onClick={beginMobileSignature}><UploadCloud size={16} /> Draw from your mobile device</button></div></div><button type="button" className="sign-mobile-qr-panel sign-mobile-qr-trigger" onClick={beginMobileSignature}><div className="sign-qr-placeholder"><PenLine size={31} /></div><strong>Draw from your phone</strong><span>Scan a QR code to sign on your mobile device.</span><small>Open a secure temporary signing link.</small></button></div>}
              </>}
              {signatureMethod === "upload" && <div className={`sign-upload-signature ${signatureImage ? "has-image" : ""}`}>{signatureImage ? <><button type="button" className="sign-upload-remove" title="Remove uploaded signature" aria-label="Remove uploaded signature" onClick={() => { setSignatureImage(""); setSignatureReady(false); if (signatureUploadRef.current) signatureUploadRef.current.value = ""; }}><Trash2 size={16} /></button><img src={signatureImage} alt="Uploaded signature preview" /><button type="button" className="sign-upload-replace" onClick={() => signatureUploadRef.current?.click()}><UploadCloud size={16} /> Replace image</button></> : <><UploadCloud size={28} /><strong>Upload an image of your signature</strong><span>Use a PNG with a transparent background for the cleanest result.</span><button type="button" className="sign-upload-choose" onClick={() => signatureUploadRef.current?.click()}>Choose image</button></>}<input ref={signatureUploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => loadSignatureImage(e.target.files?.[0])} /></div>}
              <div className="sign-color-row"><span>Color:</span>{SIGNATURE_COLORS.map((color) => <button key={color} type="button" aria-label={`Signature color ${color}`} className={`sign-color-button ${signatureColor === color ? "active" : ""}`} style={{ background: color }} onClick={() => setSignatureColor(color)} />)}</div>
            </div>
          </div>
          <footer className="sign-popup-footer"><small>Your signature stays in this browser session.</small><button type="button" className="sign-primary-button" onClick={applySignatureSetup}><CheckCircle2 size={17} /> Apply signature</button></footer>
        </section>
      </div>}
      {stampModalOpen && <div className="sign-popup-backdrop" role="presentation"><section className="sign-popup sign-stamp-popup" role="dialog" aria-modal="true" aria-labelledby="stamp-popup-title"><header className="sign-popup-header"><div><h2 id="stamp-popup-title">Upload company stamp</h2><p>Add an image stamp to your PDF.</p></div><button className="sign-popup-close" type="button" aria-label="Close company stamp upload" onClick={() => setStampModalOpen(false)}><X size={19} /></button></header><div className="sign-popup-body"><div className="sign-stamp-upload"><UploadCloud size={30} /><strong>Upload an image of your company stamp</strong><span>PNG, JPG, or SVG · Maximum 10 MB</span><button type="button" className="sign-upload-choose" onClick={() => document.getElementById("company-stamp-file")?.click()}>Choose image</button><input id="company-stamp-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { loadCompanyStamp(e.target.files?.[0]); e.target.value = ""; }} /></div></div><footer className="sign-popup-footer"><small>The stamp can be resized and moved after placing it.</small><button type="button" className="sign-secondary-button" onClick={() => setStampModalOpen(false)}>Cancel</button></footer></section></div>}
      {fieldEditId && <div className="sign-popup-backdrop" role="presentation"><section className="sign-popup sign-field-edit-popup" role="dialog" aria-modal="true" aria-labelledby="field-edit-title"><header className="sign-popup-header"><div><h2 id="field-edit-title">Edit {fields.find((item) => item?.id === fieldEditId)?.label || "text"}</h2><p>Update the text shown on your PDF.</p></div><button className="sign-popup-close" type="button" aria-label="Close field editor" onClick={() => setFieldEditId(null)}><X size={19} /></button></header><div className="sign-popup-body"><label className="sign-name-label"><span>Field text</span><input autoFocus value={fieldEditValue} onChange={(e) => setFieldEditValue(e.target.value)} /></label></div><footer className="sign-popup-footer"><button type="button" className="sign-secondary-button" onClick={() => setFieldEditId(null)}>Cancel</button><button type="button" className="sign-primary-button" onClick={saveFieldEditor}><Check size={17} /> Save changes</button></footer></section></div>}
      {mobileQrOpen && mobileSessionId && supabase && <div className="sign-popup-backdrop sign-mobile-qr-backdrop" role="presentation">
        <section className="sign-mobile-qr-modal" role="dialog" aria-modal="true" aria-labelledby="mobile-qr-title">
          <button className="sign-popup-close sign-mobile-qr-close" type="button" aria-label="Close QR code" onClick={() => setMobileQrOpen(false)}><X size={19} /></button>
          <h2 id="mobile-qr-title">Draw with your mobile device</h2>
          <p>Scan this QR code to draw your signature with a mobile device.</p>
          <div className="sign-mobile-qr-code"><QRCodeSVG value={`${PUBLIC_APP_URL || window.location.origin}${window.location.pathname}?mobileSign=${encodeURIComponent(mobileSessionId)}`} size={240} bgColor="#ffffff" fgColor="#292018" level="M" /></div>
          <div className={`sign-qr-status ${mobileSent ? "success" : ""}`} role="status">{mobileSent ? <><CheckCircle2 size={18} /> Signature received from your phone. You can close this window.</> : <><span className="sign-qr-pulse" /> {mobileConnected ? "Waiting for signature from your phone…" : "Connecting to QuickTools… keep this window open."}</>}</div>
          <small>Your PDF stays on this computer. Only the signature image is sent through the temporary signing session.</small>
        </section>
      </div>}
    </main>
  );
}
