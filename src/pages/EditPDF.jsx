import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Info,
  Check,
  X,
  Pencil,
  LoaderCircle,
  AlertCircle,
  MousePointer2,
  ShieldCheck,
  Hand,
  Type,
  Image,
  PenLine,
  Shapes,
  Square,
  Circle,
  Minus,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  MoveHorizontal,
  Settings,
  Crown,
  Trash2,
  RotateCw,
  Link2,
  PlusCircle,
  Copy,
  Redo2,
  Undo2,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFString } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "../EditPDF.css";
import fontkit from "@pdf-lib/fontkit";

import arialRegular from "../assets/fonts/arial.ttf?url";
import arialBold from "../assets/fonts/arialbd.ttf?url";
import arialItalic from "../assets/fonts/ariali.ttf?url";
import arialBoldItalic from "../assets/fonts/arialbi.ttf?url";

import timesRegular from "../assets/fonts/times.ttf?url";
import timesBold from "../assets/fonts/timesbd.ttf?url";
import timesItalic from "../assets/fonts/timesi.ttf?url";
import timesBoldItalic from "../assets/fonts/timesbi.ttf?url";

import calibriRegular from "../assets/fonts/calibri.ttf?url";
import calibriBold from "../assets/fonts/calibrib.ttf?url";
import calibriItalic from "../assets/fonts/calibrii.ttf?url";
import calibriBoldItalic from "../assets/fonts/calibriz.ttf?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex) {
  const clean = (hex || "#000000").replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((part) => part + part).join("")
      : clean;

  const number = Number.parseInt(full, 16);

  if (!Number.isFinite(number)) {
    return rgb(0, 0, 0);
  }

  return rgb(
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255
  );
}

function getItemBounds(item, viewport) {
  const transform = pdfjsLib.Util.transform(
    viewport.transform,
    item.transform
  );

  const height = Math.max(
    Math.hypot(transform[2], transform[3]),
    item.height * viewport.scale,
    6
  );

  const width = Math.max(item.width * viewport.scale, 4);

  return {
    left: transform[4],
    top: transform[5] - height,
    width,
    height,
  };
}

function estimateTextWidth(
  text,
  fontSize,
  fontFamily = "",
  isBold = false,
  isItalic = false
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return Math.max(8, text.length * fontSize * 0.55);
  }

  const family = getBrowserFontFamily(fontFamily);
  const weight = isBold ? "700" : "400";
  const style = isItalic ? "italic" : "normal";

  context.font = `${style} ${weight} ${fontSize}px "${family}"`;

  return Math.max(8, context.measureText(text || " ").width + 2);
}

/*
 * PDF.js may report generic families such as "sans-serif".
 * Prefer recognizable names from the PDF font's internal name.
 */
function getFontFamilyKey(fontFamily = "", fontName = "") {
  const name = `${fontFamily} ${fontName}`
    .toLowerCase()
    .replace(/^[a-z]{6}\+/, "")
    .replace(/[^a-z0-9]+/g, "");

  if (name.includes("calibri")) return "calibri";

  if (
    name.includes("arial") ||
    name.includes("helvetica") ||
    name.includes("liberationsans") ||
    name.includes("nimbus sans")
  ) {
    return "arial";
  }

  if (
    name.includes("times") ||
    name.includes("cambria") ||
    name.includes("liberationserif") ||
    name.includes("nimbusroman") ||
    name.includes("serif")
  ) {
    return "times";
  }

  if (
    name.includes("courier") ||
    name.includes("consolas") ||
    name.includes("monospace")
  ) {
    return "courier";
  }

  // Use PDF.js's generic family only as a fallback.
  const genericFamily = String(fontFamily).toLowerCase();

  if (genericFamily.includes("serif")) return "times";
  if (genericFamily.includes("mono")) return "courier";
  if (genericFamily.includes("sans")) return "arial";

  return "arial";
}

function getBrowserFontFamily(fontFamily = "") {
  const family = getFontFamilyKey(fontFamily, fontFamily);

  if (family === "times") return "Times New Roman";
  if (family === "courier") return "Courier New";

  return "Arial";
}

function detectFontStyle(
  fontName = "",
  fontFamily = "",
  pdfFont = null,
  style = {}
) {
  const originalName = [
    fontName,
    pdfFont?.name,
    pdfFont?.fallbackName,
    pdfFont?.loadedName,
    style?.fontFamily,
  ]
    .filter(Boolean)
    .join(" ");

  // Remove PDF subset prefixes such as BCDFEE+
  const name = originalName
    .replace(/\b[A-Z]{6}\+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  let pdfBold = false;
  let pdfBlack = false;
  let pdfItalic = false;

  try {
    pdfBold = Boolean(pdfFont?.bold);
    pdfBlack = Boolean(pdfFont?.black);
    pdfItalic = Boolean(pdfFont?.italic);
  } catch {
    // Font metadata is not always accessible.
  }

  const fontWeight = style?.fontWeight ?? pdfFont?.fontWeight;

  const isBold =
    pdfBold ||
    pdfBlack ||
    fontWeight === "bold" ||
    (
      fontWeight !== undefined &&
      fontWeight !== null &&
      fontWeight !== "" &&
      Number.isFinite(Number(fontWeight)) &&
      Number(fontWeight) >= 600
    ) ||
    /\b(bold|black|demi|semibold|heavy|extrabold|ultrabold)\b/.test(name) ||
    /\bboldmt\b/.test(name) ||
    /\b(bd|700|800|900)\b/.test(name);

  const isItalic =
    pdfItalic ||
    style?.italic === true ||
    style?.fontStyle === "italic" ||
    /\b(italic|oblique|slanted)\b/.test(name) ||
    /\bit\b/.test(name);

  return {
    isBold,
    isItalic,
    familyKey: getFontFamilyKey(fontFamily, originalName),
  };
}



function getStandardFontName(name = "") {
  const value = name.toLowerCase();
  const bold = /bold|black|demi|semibold|heavy/.test(value);
  const italic = /italic|oblique|slanted/.test(value);

  if (value.includes("courier") || value.includes("mono")) {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;

    return StandardFonts.Courier;
  }

  if (
    value.includes("times") ||
    value.includes("serif") ||
    value.includes("cambria")
  ) {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;

    return StandardFonts.TimesRoman;
  }

  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;

  return StandardFonts.Helvetica;
}
const EDITOR_PREVIEW_FONTS = {
  arial: {
    regular: `url("${arialRegular}")`,
    bold: `url("${arialBold}")`,
    italic: `url("${arialItalic}")`,
    boldItalic: `url("${arialBoldItalic}")`,
  },
};
const CUSTOM_FONT_URLS = {
  arial: {
    regular: arialRegular,
    bold: arialBold,
    italic: arialItalic,
    boldItalic: arialBoldItalic,
  },
  times: {
    regular: timesRegular,
    bold: timesBold,
    italic: timesItalic,
    boldItalic: timesBoldItalic,
  },
  calibri: {
    regular: calibriRegular,
    bold: calibriBold,
    italic: calibriItalic,
    boldItalic: calibriBoldItalic,
  },
};

function getFontVariant(isBold = false, isItalic = false) {
  if (isBold && isItalic) return "boldItalic";
  if (isItalic) return "italic";
  if (isBold) return "bold";
  return "regular";
}

function getCustomFontUrl(
  fontFamily = "",
  fontName = "",
  isBold = false,
  isItalic = false
) {
  const family = getFontFamilyKey(fontFamily, fontName);

  if (family === "courier") return null;

  const fontSet = CUSTOM_FONT_URLS[family];

  if (!fontSet) return null;

  return fontSet[getFontVariant(isBold, isItalic)];
}

async function embedEditorFont(
  pdfDoc,
  fontFamily = "",
  fontName = "",
  isBold = false,
  isItalic = false
) {
  const fontUrl = getCustomFontUrl(
    fontFamily,
    fontName,
    isBold,
    isItalic
  );

  if (fontUrl) {
    const response = await fetch(fontUrl);

    if (!response.ok) {
      throw new Error("Could not load the selected font.");
    }

    const fontBytes = await response.arrayBuffer();

    return pdfDoc.embedFont(fontBytes, {
      subset: true,
    });
  }

  // Courier is a standard PDF font. For other unknown families,
  // use the closest supported standard PDF font and style.
  const family = getFontFamilyKey(fontFamily, fontName);

  const standardName =
    family === "courier"
      ? [
        "Courier",
        isBold ? "Bold" : "",
        isItalic ? "Italic" : "",
      ].join(" ")
      : [
        family === "times" ? "Times" : "Helvetica",
        isBold ? "Bold" : "",
        isItalic ? "Italic" : "",
      ].join(" ");

  return pdfDoc.embedFont(getStandardFontName(standardName));
}

function getPageBackgroundColor() {
  return rgb(1, 1, 1);
}

function createSymbolDataUrl(symbol) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the selected symbol for export.");
  }

  context.font = '180px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(symbol, 128, 132);
  return canvas.toDataURL("image/png");
}

function destroyPdfDocument(pdfDocument) {
  if (!pdfDocument) return;

  if (typeof pdfDocument.destroy !== "function") {
    console.error("PDF document does not expose a destroy method.");
    return;
  }

  try {
    pdfDocument.destroy();
  } catch (destroyError) {
    console.error("Could not destroy the PDF document:", destroyError);
  }
}

const textFormatPalette = [
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#2196f3",
  "#00bcd4",
  "#4caf50",
  "#ffeb3b",
  "#ff5722",
  "#795548",
  "#e0e0e0",
  "#9e9e9e",
  "#424242",
];

const annotationSymbols = ["🙂", "🙁", "😐", "❤️", "!", "?", "✓", "✕"];

function EditPDF() {
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const customColorInputRef = useRef(null);
  const pageCanvasRefsRef = useRef(new Map());
  const pageWrapperRefsRef = useRef(new Map());
  const pageRenderTasksRef = useRef(new Map());
  const panDragRef = useRef(null);
  const canvasScrollRef = useRef(null);
  const pdfJsDocumentRef = useRef(null);
  const originalBytesRef = useRef(null);
  const pageRecordsRef = useRef([]);
  const editCounterRef = useRef(0);
  const annotationGestureRef = useRef(null);
  const [showTextEditor, setShowTextEditor] = useState(false);

  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textAlignment, setTextAlignment] = useState("left");
  const [textFontFamily, setTextFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#000000");
  const [customTextColors, setCustomTextColors] = useState(["#e52d2d", "#000000"]);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [selectedTextLink, setSelectedTextLink] = useState("");
  const editHistoryRef = useRef([]);
  const editRedoHistoryRef = useRef([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showTextList, setShowTextList] = useState(true);
  const [addTextMode, setAddTextMode] = useState(false);
  const [addedTexts, setAddedTexts] = useState([]);
  const [newTextValue, setNewTextValue] = useState("New text");
  const [newTextSize, setNewTextSize] = useState(36);
  const [newTextColor, setNewTextColor] = useState("#000000");
  const [textColorMenuOpen, setTextColorMenuOpen] = useState(false);
  const [highlightColorMenuOpen, setHighlightColorMenuOpen] = useState(false);
  const [newTextBold, setNewTextBold] = useState(false);
  const [newTextItalic, setNewTextItalic] = useState(false);
  const [newTextHighlight, setNewTextHighlight] = useState(false);
  const [newTextHighlightColor, setNewTextHighlightColor] = useState("#fff2a8");
  const [newTextOpacity, setNewTextOpacity] = useState(100);
  const [newTextAlignment, setNewTextAlignment] = useState("left");
  const [selectedAddedTextId, setSelectedAddedTextId] = useState(null);
  const [draggingAddedTextId, setDraggingAddedTextId] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState("annotate");
  const [annotationTool, setAnnotationTool] = useState("select");
  const [panMode, setPanMode] = useState(false);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [annotationColor, setAnnotationColor] = useState("#202124");
  const [annotationLineWidth, setAnnotationLineWidth] = useState(4);
  const [annotationFillColor, setAnnotationFillColor] = useState("#4caf50");
  const [annotationOpacity, setAnnotationOpacity] = useState(100);
  const [annotationStrokeStyle, setAnnotationStrokeStyle] = useState("solid");
  const [annotationSymbol, setAnnotationSymbol] = useState("🙂");
  const [activeShape, setActiveShape] = useState("line");
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const nextAnnotationIdRef = useRef(1);
  const [annotationFontFamily, setAnnotationFontFamily] = useState("Arial");
  const [annotationBold, setAnnotationBold] = useState(false);
  const [annotationItalic, setAnnotationItalic] = useState(false);
  const [annotationUnderline, setAnnotationUnderline] = useState(false);
  const nextAddedTextIdRef = useRef(1);


  const currentPage = pages[pageNumber - 1];

  const selectedText = currentPage?.items?.find(
    (item) => item.id === selectedTextId
  );
  const selectedAddedText = addedTexts.find(
    (item) =>
      item.id === selectedAddedTextId &&
      item.pageIndex === pageNumber - 1
  );
  const selectedAnnotation = annotations.find(
    (item) =>
      item.id === selectedAnnotationId &&
      item.pageIndex === pageNumber - 1
  );

  const resetMessages = () => {
    setError("");
  };

  const resetEditor = () => {
    pageRenderTasksRef.current.forEach((task) => task.cancel());
    pageRenderTasksRef.current.clear();

    destroyPdfDocument(pdfJsDocumentRef.current);
    pdfJsDocumentRef.current = null;

    originalBytesRef.current = null;
    pageRecordsRef.current = [];
    editCounterRef.current = 0;

    setFile(null);
    setPages([]);
    editHistoryRef.current = [];
    editRedoHistoryRef.current = [];
    setHistoryVersion((version) => version + 1);
    setPageNumber(1);
    setZoom(1);
    setSelectedTextId(null);
    setSelectedAnnotationId(null);
    setEditingText("");
    setFontSize(12);
    setTextColor("#000000");
    setError("");
    setSearch("");
    setAnnotations([]);
    setAddedTexts([]);
  };

  const loadPdf = async (selectedFile) => {
    resetMessages();

    if (!selectedFile) return;

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a valid PDF file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("This file is larger than 50 MB. Please choose a smaller PDF.");
      return;
    }

    // Close the previous PDF document before loading another one.
    if (pdfJsDocumentRef.current) {
      destroyPdfDocument(pdfJsDocumentRef.current);
      pdfJsDocumentRef.current = null;
    }

    setLoading(true);
    setFile(selectedFile);
    setPages([]);
    setAnnotations([]);
    setAddedTexts([]);
    setSelectedAnnotationId(null);
    setSelectedTextId(null);
    setPageNumber(1);

    originalBytesRef.current = null;
    pageRecordsRef.current = [];
    editCounterRef.current = 0;

    try {
      const buffer = await selectedFile.arrayBuffer();
      const originalBytes = new Uint8Array(buffer);

      originalBytesRef.current = originalBytes.slice();


      const loadingTask = pdfjsLib.getDocument({
        data: originalBytes.slice(),
        fontExtraProperties: true,
      });


      const pdf = await loadingTask.promise;

      console.log("PDF DOCUMENT INFO:", {
        pages: pdf.numPages,
        fingerprint: pdf.fingerprints,
      });

      console.log(
        "PDF PAGE FONT INFO:",
        await pdf.getPage(1).then(async (page) => {
          const operatorList = await page.getOperatorList();

          return {
            pageNumber: page.pageNumber,
            operatorCount: operatorList.fnArray.length,
            textStyles: (await page.getTextContent()).styles,
          };
        })
      );

      pdfJsDocumentRef.current = pdf;

      const records = [];

      for (let index = 1; index <= pdf.numPages; index += 1) {
        const pdfPage = await pdf.getPage(index);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const content = await pdfPage.getTextContent();
        const styles = content.styles || {};
        console.log("PDF TEXT STYLES:", content.styles);

        const items = content.items
          .filter(
            (item) =>
              typeof item.str === "string" &&
              item.str.trim().length > 0 &&
              Array.isArray(item.transform)
          )
          .map((item) => {
            const bounds = getItemBounds(item, viewport);
            const style = styles[item.fontName] || {};

            let pdfFont = null;

            try {
              pdfFont = pdfPage.commonObjs.get(item.fontName);

              console.log("FONT METADATA CHECK:", {
                text: item.str,
                fontName: item.fontName,
                fontExtraProperties: pdfFont?.fontExtraProperties,
                name: pdfFont?.name,
                fallbackName: pdfFont?.fallbackName,
                loadedName: pdfFont?.loadedName,
                bold: pdfFont?.bold,
                black: pdfFont?.black,
                italic: pdfFont?.italic,
                cssFontInfo: pdfFont?.cssFontInfo,
              });

              console.log("FONT INSPECTION:", {
                text: item.str,
                fontName: item.fontName,
                fontExtraProperties: pdfFont?.fontExtraProperties,
                cssFontInfo: pdfFont?.cssFontInfo,
                bbox: pdfFont?.bbox,
              });
              if (pdfFont && item.str.includes("DEPARTMENT")) {
                console.log("FONT EXTRA PROPERTIES:", pdfFont.fontExtraProperties);
                console.log("FONT CSS INFO:", pdfFont.cssFontInfo);
                console.log("FONT BBOX:", pdfFont.bbox);
                console.log("FONT DATA:", pdfFont.data);
              }
            } catch {
              // Font metadata is not available for every PDF.
            }

            const fontStyle = detectFontStyle(
              item.fontName || "",
              style.fontFamily || "",
              pdfFont,
              style
            );


            console.log("PDF FONT FULL OBJECT:", pdfFont);

            console.log("PDF FONT PROPERTIES:", {
              boldValue: pdfFont?.bold,
              blackValue: pdfFont?.black,
              italicValue: pdfFont?.italic,
              text: item.str,
              fontName: item.fontName,
              keys: pdfFont ? Object.keys(pdfFont) : [],
              name: pdfFont?.name,
              fallbackName: pdfFont?.fallbackName,
              loadedName: pdfFont?.loadedName,
              isSerifFont: pdfFont?.isSerifFont,
              isSymbolicFont: pdfFont?.isSymbolicFont,
              isMonospaced: pdfFont?.isMonospaced,
              isType3Font: pdfFont?.isType3Font,
              fontMatrix: pdfFont?.fontMatrix,
              ascent: pdfFont?.ascent,
              descent: pdfFont?.descent,
            });


            console.log("PDF FONT CHECK:", {
              text: item.str,
              fontName: item.fontName,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              detectedBold: fontStyle.isBold,
              detectedItalic: fontStyle.isItalic,
            });

            const originalSize = Math.max(
              5,
              Math.min(
                96,
                Math.hypot(item.transform[2], item.transform[3]) || 12
              )
            );

            return {
              id: `p${index}-t${editCounterRef.current++}`,
              pageIndex: index - 1,
              originalText: item.str,
              replacementText: item.str,
              fontName: item.fontName || "",
              fontFamily: style.fontFamily || "",
              fontFamilyKey: fontStyle.familyKey,
              fontSize: originalSize,
              originalFontSize: originalSize,
              originalColor: "#000000",
              width: Math.max(bounds.width, 8),
              height: Math.max(bounds.height, originalSize),
              left: bounds.left,
              top: bounds.top,
              color: "#000000",
              transform: [...item.transform],
              edited: false,
              editing: false,
              isBold: fontStyle.isBold,
              isItalic: fontStyle.isItalic,
              originalFontFamily: style.fontFamily || "",
              originalFontFamilyKey: fontStyle.familyKey,
              originalIsBold: fontStyle.isBold,
              originalIsItalic: fontStyle.isItalic,
              originalIsUnderline: false,
              originalAlignment: "left",
            };
          });

        records.push({
          pageNumber: index,
          width: viewport.width,
          height: viewport.height,
          rotation: pdfPage.rotate || 0,
          items,
          edits: [],
        });

        pdfPage.cleanup();
      }

      pageRecordsRef.current = records;
      setPages(records);

      const editableCount = records.reduce(
        (total, page) => total + page.items.length,
        0
      );

      if (editableCount === 0) {
        setError(
          "No selectable text was detected. This may be a scanned PDF. OCR support is not included in this version."
        );
      }
      editHistoryRef.current = [];
      editRedoHistoryRef.current = [];
      setHistoryVersion((version) => version + 1);
    } catch (loadError) {
      console.error("Edit PDF load error:", loadError);

      setError(
        "We couldn't read this PDF. It may be damaged or password-protected."
      );

      setFile(null);
      setPages([]);
      originalBytesRef.current = null;
      pageRecordsRef.current = [];
    } finally {
      setLoading(false);
    }
  };

  const renderPages = useCallback(async () => {
    const pdfDocument = pdfJsDocumentRef.current;
    if (!pdfDocument || pages.length === 0) return;

    pageRenderTasksRef.current.forEach((task) => task.cancel());
    pageRenderTasksRef.current.clear();

    await Promise.all(
      pages.map(async (pageRecord) => {
        const canvas = pageCanvasRefsRef.current.get(pageRecord.pageNumber);
        if (!canvas) return;

        try {
          const pdfPage = await pdfDocument.getPage(pageRecord.pageNumber);
          const viewport = pdfPage.getViewport({ scale: zoom });
          const context = canvas.getContext("2d");
          if (!context) return;

          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.ceil(viewport.width * ratio);
          canvas.height = Math.ceil(viewport.height * ratio);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const task = pdfPage.render({
            canvasContext: context,
            viewport,
            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
          });
          pageRenderTasksRef.current.set(pageRecord.pageNumber, task);
          await task.promise;

          if (pageRenderTasksRef.current.get(pageRecord.pageNumber) === task) {
            pageRenderTasksRef.current.delete(pageRecord.pageNumber);
          }
        } catch (renderError) {
          if (renderError?.name !== "RenderingCancelledException") {
            console.error(
              `Edit PDF page ${pageRecord.pageNumber} render error:`,
              renderError
            );
            setError(`Page ${pageRecord.pageNumber} could not be displayed.`);
          }
        }
      })
    );
  }, [pages, zoom]);

  useEffect(() => {
    renderPages();
  }, [renderPages]);

  useEffect(() => {
    return () => {
      pageRenderTasksRef.current.forEach((task) => task.cancel());
      pageRenderTasksRef.current.clear();

      if (pdfJsDocumentRef.current) {
        destroyPdfDocument(pdfJsDocumentRef.current);
      }
    };
  }, []);

  const updatePageItem = (itemId, changes, targetPageNumber = pageNumber) => {
    setPages((previousPages) => {
      const nextPages = previousPages.map((page) => {
        if (page.pageNumber !== targetPageNumber) return page;

        return {
          ...page,
          items: page.items.map((item) =>
            item.id === itemId ? { ...item, ...changes } : item
          ),
        };
      });

      pageRecordsRef.current = nextPages;

      return nextPages;
    });
  };

  const addTextAtPosition = (event, targetPage) => {
    if (!addTextMode || !targetPage) return;

    // Ignore clicks on existing text controls.
    if (event.target.closest(".edit-pdf-text-hitbox, .edit-pdf-added-text")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / zoom;
    const y = (event.clientY - bounds.top) / zoom;

    const newItem = {
      id: `new-text-${nextAddedTextIdRef.current++}`,
      pageIndex: targetPage.pageNumber - 1,
      text: newTextValue || "New text",
      left: clamp(x, 0, targetPage.width - 10),
      top: clamp(y, 0, targetPage.height - 10),
      fontSize: clamp(Number(newTextSize) || 36, 5, 96),
      color: newTextColor,
      fontFamily: annotationFontFamily,
      isBold: newTextBold,
      isItalic: newTextItalic,
      isUnderline: annotationUnderline,
      width: Math.min(260, Math.max(24, targetPage.width - x)),
      highlightEnabled: newTextHighlight,
      highlightColor: newTextHighlightColor,
      opacity: newTextOpacity,
      alignment: newTextAlignment,
    };

    setAddedTexts((previous) => [...previous, newItem]);
    setPageNumber(targetPage.pageNumber);
    setSelectedAddedTextId(newItem.id);
    setNewTextValue(newItem.text);
    setAddTextMode(false);
    setShowTextEditor(true);
    setError("");
  };

  const updateAddedText = (id, changes) => {
    setAddedTexts((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  };

  const deleteAddedText = (id) => {
    setAddedTexts((previous) => previous.filter((item) => item.id !== id));

    if (selectedAddedTextId === id) {
      setSelectedAddedTextId(null);
    }

  };
  const updateAnnotation = (id, changes) => {
    setAnnotations((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  };

  const changeAnnotationStrokeColor = (strokeColor) => {
    setAnnotationColor(strokeColor);
    if (selectedAnnotation) {
      updateAnnotation(selectedAnnotation.id, { strokeColor });
    }
  };

  const changeAnnotationFillColor = (fillColor) => {
    setAnnotationFillColor(fillColor);
    if (selectedAnnotation) {
      updateAnnotation(selectedAnnotation.id, { fillColor });
    }
  };

  const changeAnnotationWidth = (strokeWidth) => {
    setAnnotationLineWidth(strokeWidth);
    if (selectedAnnotation) {
      updateAnnotation(selectedAnnotation.id, { strokeWidth });
    }
  };

  const changeAnnotationOpacity = (opacity) => {
    setAnnotationOpacity(opacity);
    if (selectedAnnotation) updateAnnotation(selectedAnnotation.id, { opacity });
  };

  const changeAnnotationStrokeStyle = (strokeStyle) => {
    setAnnotationStrokeStyle(strokeStyle);
    if (selectedAnnotation) {
      updateAnnotation(selectedAnnotation.id, { strokeStyle });
    }
  };

  const changeAnnotationSymbol = (symbol) => {
    setAnnotationSymbol(symbol);
    if (selectedAnnotation?.shape === "symbol") {
      updateAnnotation(selectedAnnotation.id, { symbol });
    }
  };

  const deleteAnnotation = (id) => {
    setAnnotations((previous) => previous.filter((item) => item.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const handleImageUpload = async (event) => {
    const imageFile = event.target.files?.[0];
    event.target.value = "";
    if (!imageFile) return;

    if (!["image/png", "image/jpeg"].includes(imageFile.type)) {
      setError("Choose a PNG or JPEG image.");
      return;
    }

    if (imageFile.size > 20 * 1024 * 1024) {
      setError("Images must be smaller than 20 MB.");
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The image could not be read."));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(imageFile);
      });
      const dimensions = await new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onerror = () => reject(new Error("The image could not be decoded."));
        image.onload = () =>
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.src = dataUrl;
      });
      const page = pages[pageNumber - 1];
      if (!page) throw new Error("Upload a PDF page before adding an image.");

      const sizeScale = Math.min(
        1,
        220 / dimensions.width,
        180 / dimensions.height
      );
      const width = Math.max(12, dimensions.width * sizeScale);
      const height = Math.max(12, dimensions.height * sizeScale);
      const imageAnnotation = {
        id: `annotation-${nextAnnotationIdRef.current++}`,
        type: "image",
        pageIndex: pageNumber - 1,
        x: Math.max(0, (page.width - width) / 2),
        y: Math.max(0, (page.height - height) / 2),
        width,
        height,
        naturalWidth: dimensions.width,
        naturalHeight: dimensions.height,
        dataUrl,
        mimeType: imageFile.type,
        opacity: annotationOpacity,
        rotation: 0,
      };

      setAnnotations((previous) => [...previous, imageAnnotation]);
      setSelectedAnnotationId(imageAnnotation.id);
      setSelectedAddedTextId(null);
      setSelectedTextId(null);
      setAnnotationTool("image");
      setPanMode(false);
      setAddTextMode(false);
      setShowTextEditor(false);
      setError("");
    } catch (imageError) {
      console.error("Edit PDF image upload error:", imageError);
      setError(imageError.message || "The selected image could not be added.");
    }
  };

  const handleAnnotationPointerDown = (event, targetPage) => {
    if (panMode || !targetPage) return;
    const isDrawing = annotationTool === "draw";
    const isShaping = annotationTool === "shape";
    if (!isDrawing && !isShaping) return;

    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - bounds.left) / zoom, 0, targetPage.width);
    const y = clamp((event.clientY - bounds.top) / zoom, 0, targetPage.height);

    if (isShaping && activeShape === "symbol") {
      const size = 44;
      const symbolAnnotation = {
        id: `annotation-${nextAnnotationIdRef.current++}`,
        type: "shape",
        shape: "symbol",
        pageIndex: targetPage.pageNumber - 1,
        x: clamp(x - size / 2, 0, targetPage.width - size),
        y: clamp(y - size / 2, 0, targetPage.height - size),
        width: size,
        height: size,
        symbol: annotationSymbol,
        strokeColor: annotationColor,
        fillColor: annotationFillColor,
        strokeWidth: annotationLineWidth,
        opacity: annotationOpacity,
        strokeStyle: annotationStrokeStyle,
        rotation: 0,
      };
      setAnnotations((previous) => [...previous, symbolAnnotation]);
      setSelectedAnnotationId(symbolAnnotation.id);
      return;
    }

    const annotation = {
      id: `annotation-${nextAnnotationIdRef.current++}`,
      type: isDrawing ? "draw" : "shape",
      shape: isDrawing ? "draw" : activeShape,
      pageIndex: targetPage.pageNumber - 1,
      x,
      y,
      width: 1,
      height: 1,
      points: isDrawing ? [{ x: 0, y: 0 }] : undefined,
      rawPoints: isDrawing ? [{ x, y }] : undefined,
      strokeColor: annotationColor,
      fillColor: annotationFillColor,
      strokeWidth: annotationLineWidth,
      opacity: annotationOpacity,
      strokeStyle: annotationStrokeStyle,
      rotation: 0,
      flipX: false,
      flipY: false,
    };

    setAnnotations((previous) => [...previous, annotation]);
    setSelectedAnnotationId(annotation.id);
    setSelectedAddedTextId(null);
    setSelectedTextId(null);
    annotationGestureRef.current = {
      pointerId: event.pointerId,
      annotationId: annotation.id,
      page: targetPage,
      startX: x,
      startY: y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAnnotationPointerMove = (event) => {
    const gesture = annotationGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = clamp(
      (event.clientX - bounds.left) / zoom,
      0,
      gesture.page.width
    );
    const y = clamp(
      (event.clientY - bounds.top) / zoom,
      0,
      gesture.page.height
    );
    const dx = x - gesture.startX;
    const dy = y - gesture.startY;
    if (Math.hypot(dx, dy) > 2) gesture.moved = true;

    setAnnotations((previous) =>
      previous.map((item) => {
        if (item.id !== gesture.annotationId) return item;

        if (item.type === "draw") {
          const rawPoints = [...(item.rawPoints || []), { x, y }];
          const minX = Math.min(...rawPoints.map((point) => point.x));
          const minY = Math.min(...rawPoints.map((point) => point.y));
          const maxX = Math.max(...rawPoints.map((point) => point.x));
          const maxY = Math.max(...rawPoints.map((point) => point.y));
          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            rawPoints,
            points: rawPoints.map((point) => ({
              x: point.x - minX,
              y: point.y - minY,
            })),
          };
        }

        return {
          ...item,
          x: Math.min(gesture.startX, x),
          y: Math.min(gesture.startY, y),
          width: Math.max(Math.abs(dx), 1),
          height: Math.max(Math.abs(dy), 1),
          flipX: dx < 0,
          flipY: dy < 0,
        };
      })
    );
  };

  const finishAnnotationPointer = (event) => {
    const gesture = annotationGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    annotationGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setAnnotations((previous) =>
      previous.filter((item) => {
        if (item.id !== gesture.annotationId) return true;
        if (item.type === "draw") return gesture.moved && item.points.length > 1;
        if (item.shape === "line") return item.width > 3 || item.height > 3;
        return item.width > 3 && item.height > 3;
      })
    );
    if (!gesture.moved) setSelectedAnnotationId(null);
  };

  const beginAnnotationTransform = (event, item, mode = "move") => {
    if (
      panMode ||
      (annotationTool !== "select" && selectedAnnotationId !== item.id)
    ) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedAnnotationId(item.id);
    setSelectedAddedTextId(null);
    setSelectedTextId(null);
    if (item.type === "shape") setActiveShape(item.shape);

    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { ...item };
    const targetPage = pages[item.pageIndex];

    const handleMove = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      if (mode === "move") {
        updateAnnotation(item.id, {
          x: clamp(initial.x + dx, 0, Math.max(0, targetPage.width - initial.width)),
          y: clamp(initial.y + dy, 0, Math.max(0, targetPage.height - initial.height)),
        });
        return;
      }

      let x = initial.x;
      let y = initial.y;
      let width = initial.width;
      let height = initial.height;
      if (mode.includes("e")) width = clamp(initial.width + dx, 12, targetPage.width - x);
      if (mode.includes("s")) height = clamp(initial.height + dy, 12, targetPage.height - y);
      if (mode.includes("w")) {
        const shift = clamp(dx, -initial.x, initial.width - 12);
        x = initial.x + shift;
        width = initial.width - shift;
      }
      if (mode.includes("n")) {
        const shift = clamp(dy, -initial.y, initial.height - 12);
        y = initial.y + shift;
        height = initial.height - shift;
      }

      if ((item.type === "image" || item.shape === "symbol") && mode.length === 2) {
        const ratio = initial.width / Math.max(initial.height, 1);
        if (mode.includes("e") || mode.includes("w")) {
          height = width / ratio;
          if (mode.includes("n")) y = initial.y + initial.height - height;
        } else {
          width = height * ratio;
          if (mode.includes("w")) x = initial.x + initial.width - width;
        }
        const fitScale = Math.min(
          1,
          targetPage.width / width,
          targetPage.height / height
        );
        width *= fitScale;
        height *= fitScale;
        x = clamp(x, 0, targetPage.width - width);
        y = clamp(y, 0, targetPage.height - height);
      }
      const changes = { x, y, width, height };
      if (item.type === "draw") {
        const scaleX = width / Math.max(initial.width, 1);
        const scaleY = height / Math.max(initial.height, 1);
        changes.points = (initial.points || []).map((point) => ({
          x: point.x * scaleX,
          y: point.y * scaleY,
        }));
      }
      updateAnnotation(item.id, changes);
    };

    const handleUp = (upEvent) => {
      if (upEvent.pointerId !== event.pointerId) return;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };


  const handleAddedTextPointerDown = (event, item, targetPage) => {
    if (
      panMode ||
      addTextMode ||
      (selectedAddedTextId === item.id && showTextEditor)
    ) return;

    event.preventDefault();
    event.stopPropagation();

    setSelectedAddedTextId(item.id);
    setDraggingAddedTextId(item.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const originalLeft = item.left;
    const originalTop = item.top;

    const pageWidth = targetPage.width || 1;
    const pageHeight = targetPage.height || 1;

    const handleMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;

      updateAddedText(item.id, {
        left: clamp(originalLeft + deltaX, 0, pageWidth - 10),
        top: clamp(originalTop + deltaY, 0, pageHeight - 10),
      });
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setDraggingAddedTextId(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  };

  const handleTextResizePointerDown = (event, item, targetPage, handle) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { ...item };

    const handleMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      let left = initial.left;
      let top = initial.top;
      let width = initial.width;
      let height = initial.height;
      if (handle.includes("e")) width = clamp(initial.width + dx, 12, targetPage.width - left);
      if (handle.includes("s")) height = clamp(initial.height + dy, 8, targetPage.height - top);
      if (handle.includes("w")) {
        const shift = clamp(dx, -initial.left, initial.width - 12);
        left = initial.left + shift;
        width = initial.width - shift;
      }
      if (handle.includes("n")) {
        const shift = clamp(dy, -initial.top, initial.height - 8);
        top = initial.top + shift;
        height = initial.height - shift;
      }
      updatePageItem(item.id, { left, top, width, height }, targetPage.pageNumber);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  };


  const beginEditing = (item, targetPage) => {
    if (selectedText && selectedText.id !== item.id && showTextEditor) {
      applyEdit();
    }

    setPageNumber(targetPage.pageNumber);
    setTextBold(Boolean(item.isBold));
    setTextItalic(Boolean(item.isItalic));
    setSelectedTextId(item.id);
    setSelectedAnnotationId(null);
    setSelectedAddedTextId(null);
    setEditingText(item.replacementText);
    setFontSize(Math.round(item.fontSize * 10) / 10);
    setTextColor(item.color || "#000000");
    setTextUnderline(Boolean(item.isUnderline));
    setTextAlignment(item.alignment || "left");
    setTextFontFamily(item.fontFamilyKey === "times" ? "Times New Roman" : item.fontFamilyKey === "courier" ? "Courier New" : item.fontFamilyKey === "calibri" ? "Calibri" : "Arial");
    setSelectedTextLink(item.linkUrl || "");
    setShowLinkEditor(false);
    setShowTextEditor(true);
    setError("");
  };

  const closeInlineEditor = () => {
    setShowTextEditor(false);
    setSelectedTextId(null);
    setSelectedAnnotationId(null);
    setSelectedAddedTextId(null);
    setEditingText("");
    setError("");
  };

  const clonePages = (sourcePages) =>
    sourcePages.map((page) => ({
      ...page,
      items: page.items.map((item) => ({ ...item })),
    }));

  const recordEditHistory = () => {
    editHistoryRef.current.push(clonePages(pages));
    editRedoHistoryRef.current = [];
    setHistoryVersion((version) => version + 1);
  };

  const undoPdfEdit = () => {
    if (!editHistoryRef.current.length) return;
    editRedoHistoryRef.current.push(clonePages(pages));
    const previousPages = editHistoryRef.current.pop();
    pageRecordsRef.current = previousPages;
    setPages(previousPages);
    setSelectedTextId(null);
    setShowTextEditor(false);
    setEditingText("");
    setHistoryVersion((version) => version + 1);
  };

  const redoPdfEdit = () => {
    if (!editRedoHistoryRef.current.length) return;
    editHistoryRef.current.push(clonePages(pages));
    const nextPages = editRedoHistoryRef.current.pop();
    pageRecordsRef.current = nextPages;
    setPages(nextPages);
    setSelectedTextId(null);
    setShowTextEditor(false);
    setEditingText("");
    setHistoryVersion((version) => version + 1);
  };

  const buildPagesWithCurrentEdit = () => {
    if (!selectedText) return;

    if (!editingText.trim()) {
      setError(
        "Replacement text cannot be empty. Use Restore original text to undo."
      );
      return null;
    }

    if (selectedTextLink) {
      try {
        const parsedLink = new URL(selectedTextLink);
        if (!["https:", "http:", "mailto:"].includes(parsedLink.protocol)) {
          throw new Error("Unsupported link protocol.");
        }
      } catch {
        setError("Enter a valid HTTP, HTTPS, or email link.");
        return null;
      }
    }

    const nextFontSize = clamp(
      Number(fontSize) || selectedText.originalFontSize,
      5,
      96
    );
    const nextColor = textColor || selectedText.originalColor;
    const updatedPages = clonePages(pages);
    const targetPage = updatedPages[pageNumber - 1];
    if (!targetPage) return null;
    targetPage.items = targetPage.items.map((item) =>
      item.id === selectedText.id
        ? {
            ...item,
            replacementText: editingText,
            fontSize: nextFontSize,
            color: nextColor,
            isBold: Boolean(textBold),
            isItalic: Boolean(textItalic),
            isUnderline: Boolean(textUnderline),
            alignment: textAlignment,
            fontFamily: textFontFamily,
            fontFamilyKey: getFontFamilyKey(textFontFamily, textFontFamily),
            linkUrl: selectedTextLink,
            edited:
              editingText !== selectedText.originalText ||
              nextFontSize !== selectedText.originalFontSize ||
              nextColor !== selectedText.originalColor ||
              Boolean(textBold) !== Boolean(selectedText.originalIsBold) ||
              Boolean(textItalic) !== Boolean(selectedText.originalIsItalic) ||
              Boolean(textUnderline) !== Boolean(item.originalIsUnderline) ||
              textAlignment !== (item.originalAlignment || "left") ||
              selectedTextLink !== (selectedText.linkUrl || "") ||
              getFontFamilyKey(textFontFamily, textFontFamily) !==
                (item.originalFontFamilyKey || getFontFamilyKey(item.fontFamily, item.fontName)),
          }
        : item
    );
    return updatedPages;
  };

  const applyEdit = () => {
    if (!selectedText) return;
    const updatedPages = buildPagesWithCurrentEdit();
    if (!updatedPages) return;
    recordEditHistory();
    pageRecordsRef.current = updatedPages;
    setPages(updatedPages);
    setSelectedTextId(null);
    setShowTextEditor(false);
    setEditingText("");
    setError("");
  };

  const saveChanges = async () => {
    if (selectedText) {
      const updatedPages = buildPagesWithCurrentEdit();
      if (!updatedPages) return;
      recordEditHistory();
      pageRecordsRef.current = updatedPages;
      setPages(updatedPages);
      setSelectedTextId(null);
      setShowTextEditor(false);
      setEditingText("");
      await exportPdf(updatedPages);
      return;
    }
    await exportPdf();
  };

  const undoSelectedEdit = () => {
    if (!selectedText) return;
    recordEditHistory();

    const originalBold = Boolean(selectedText.originalIsBold);
    const originalItalic = Boolean(selectedText.originalIsItalic);

    updatePageItem(selectedText.id, {
      replacementText: selectedText.originalText,
      fontSize: selectedText.originalFontSize,
      color: selectedText.originalColor,
      isBold: originalBold,
      isItalic: originalItalic,
      isUnderline: Boolean(selectedText.originalIsUnderline),
      alignment: selectedText.originalAlignment || "left",
      fontFamilyKey: selectedText.originalFontFamilyKey || selectedText.fontFamilyKey,
      fontFamily: selectedText.originalFontFamily || selectedText.fontFamily,
      linkUrl: "",
      edited: false,
    });

    setSelectedTextId(null);
    setShowTextEditor(false);
    setEditingText("");
    setFontSize(selectedText.originalFontSize);
    setTextColor(selectedText.originalColor);
    setTextBold(originalBold);
    setTextItalic(originalItalic);
    setTextUnderline(Boolean(selectedText.originalIsUnderline));
    setTextAlignment(selectedText.originalAlignment || "left");
    setTextFontFamily(selectedText.originalFontFamilyKey === "times" ? "Times New Roman" : selectedText.originalFontFamilyKey === "courier" ? "Courier New" : selectedText.originalFontFamilyKey === "calibri" ? "Calibri" : "Arial");
    setSelectedTextLink("");
    setError("");
  };

  const deleteSelectedText = () => {
    if (!selectedText) return;
    recordEditHistory();
    updatePageItem(
      selectedText.id,
      { replacementText: "", edited: true },
      pageNumber
    );
    setSelectedTextId(null);
    setShowTextEditor(false);
    setEditingText("");
  };

  const copyTextColor = async () => {
    try {
      await navigator.clipboard.writeText(textColor);
    } catch (clipboardError) {
      console.error("Could not copy the selected text colour:", clipboardError);
      setError("The text colour could not be copied.");
    }
  };

  const addCustomTextColor = (event) => {
    const color = event.target.value;
    setCustomTextColors((previous) =>
      previous.includes(color) ? previous : [...previous, color]
    );
    setTextColor(color);
  };


  const changePage = (nextPage) => {
    const targetPageNumber = clamp(nextPage, 1, pages.length || 1);
    setPageNumber(targetPageNumber);
    setSelectedTextId(null);
    setSelectedAnnotationId(null);
    setSelectedAddedTextId(null);
    setShowTextEditor(false);
    setEditingText("");
    const scrollElement = canvasScrollRef.current;
    const targetPage = pageWrapperRefsRef.current.get(targetPageNumber);
    if (scrollElement && targetPage) {
      scrollElement.scrollTop = targetPage.offsetTop - scrollElement.offsetTop;
    }
  };

  const updateActivePageFromScroll = () => {
    const scrollElement = canvasScrollRef.current;
    if (!scrollElement || pages.length === 0) return;

    const scrollBounds = scrollElement.getBoundingClientRect();
    const targetY = scrollBounds.top + scrollElement.clientHeight * 0.35;
    let activePage = pages[0];
    let nearestDistance = Number.POSITIVE_INFINITY;

    pages.forEach((page) => {
      const wrapper = pageWrapperRefsRef.current.get(page.pageNumber);
      if (!wrapper) return;
      const pageBounds = wrapper.getBoundingClientRect();
      const distance = Math.abs(pageBounds.top - targetY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        activePage = page;
      }
    });

    setPageNumber((current) =>
      current === activePage.pageNumber ? current : activePage.pageNumber
    );
  };

  const selectAddedText = (item) => {
    const targetPageNumber = item.pageIndex + 1;
    setPageNumber(targetPageNumber);
    setSelectedAddedTextId(item.id);
    setSelectedTextId(null);
    setPanMode(false);
    setWorkspaceMode("annotate");
    setAnnotationTool("text");
    setAddTextMode(false);
    setShowTextEditor(true);
    const scrollElement = canvasScrollRef.current;
    const targetPage = pageWrapperRefsRef.current.get(targetPageNumber);
    if (scrollElement && targetPage) {
      scrollElement.scrollTop = targetPage.offsetTop - scrollElement.offsetTop;
    }
  };

  const fitPageToViewer = () => {
    if (!currentPage || !canvasScrollRef.current) return;
    const viewer = canvasScrollRef.current;
    const widthScale = (viewer.clientWidth - 48) / currentPage.width;
    const heightScale = (viewer.clientHeight - 100) / currentPage.height;
    setZoom(clamp(Math.min(widthScale, heightScale), 0.2, 2));
  };

  const fitWidthToViewer = () => {
    if (!currentPage || !canvasScrollRef.current) return;
    const viewer = canvasScrollRef.current;
    setZoom(clamp((viewer.clientWidth - 48) / currentPage.width, 0.2, 2));
  };

  const startCanvasPan = (event) => {
    if (!panMode || annotationTool !== "select" || event.button !== 0) return;
    if (
      event.target.closest(
        "button, textarea, input, select"
      )
    ) {
      return;
    }

    const scrollElement = canvasScrollRef.current;
    if (!scrollElement) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("is-panning");
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scrollElement.scrollLeft,
      scrollTop: scrollElement.scrollTop,
    };
  };

  const moveCanvasPan = (event) => {
    const drag = panDragRef.current;
    const scrollElement = canvasScrollRef.current;
    if (!drag || !scrollElement || drag.pointerId !== event.pointerId) return;

    scrollElement.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
    scrollElement.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
  };

  const stopCanvasPan = (event) => {
    if (panDragRef.current?.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    event.currentTarget.classList.remove("is-panning");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const exportPdf = async (pagesToExport = pages) => {
    if (!originalBytesRef.current || !pagesToExport.length) {
      setError("Upload a PDF before exporting.");
      return;
    }

    resetMessages();
    setSaving(true);

    try {
      const pdfDoc = await PDFDocument.load(
        originalBytesRef.current.slice(),
        { updateMetadata: false }
      );

      pdfDoc.registerFontkit(fontkit);

      const pdfPages = pdfDoc.getPages();

      // Cache embedded fonts to avoid embedding the same font repeatedly.
      const embeddedFonts = new Map();

      for (const pageRecord of pagesToExport) {
        const pdfPage = pdfPages[pageRecord.pageNumber - 1];

        if (!pdfPage) continue;

        const { width: pageWidth, height: pageHeight } = pdfPage.getSize();

        const scaleX = pageWidth / pageRecord.width;
        const scaleY = pageHeight / pageRecord.height;

        for (const item of pageRecord.items) {
          if (!item.edited) {
            continue;
          }

          const x = item.left * scaleX;
          const boxTop = item.top * scaleY;
          const boxWidth = Math.max(item.width * scaleX, 4);
          const boxHeight = Math.max(item.height * scaleY, 5);
          const y = pageHeight - boxTop - boxHeight;

          // Visually cover the original text before drawing the replacement.
          // This is not secure redaction: the original content may remain
          // recoverable from the PDF.
          pdfPage.drawRectangle({
            x: Math.max(0, x - 0.5),
            y: Math.max(0, y - 0.8),
            width: Math.max(
              1,
              Math.min(boxWidth + 1, pageWidth - Math.max(0, x - 0.5))
            ),
            height: Math.max(
              1,
              Math.min(boxHeight + 1.6, pageHeight - Math.max(0, y - 0.8))
            ),
            color: getPageBackgroundColor(),
            borderWidth: 0,
          });

          const replacement = item.replacementText || "";
          if (!replacement.trim()) continue;

          const fontKey = [
            "existing-text",
            item.fontFamilyKey || getFontFamilyKey(item.fontFamily, item.fontName),
            getFontVariant(item.isBold, item.isItalic),
          ].join("|");

          let font = embeddedFonts.get(fontKey);

          if (!font) {
            font = await embedEditorFont(
              pdfDoc,
              item.fontFamily || item.fontFamilyKey,
              item.fontName,
              item.isBold,
              item.isItalic
            );

            embeddedFonts.set(fontKey, font);
          }

          const fontSizeForPdf = clamp(
            item.fontSize * scaleY,
            4,
            100
          );

          const availableWidth = Math.max(boxWidth, 1);
          let finalFontSize = fontSizeForPdf;
          const textLines = replacement.split(/\r?\n/);
          const maxLineWidth = Math.max(
            ...textLines.map((line) => font.widthOfTextAtSize(line, finalFontSize))
          );

          // Keep text within the original text item's width.
          if (maxLineWidth > availableWidth && maxLineWidth > 0) {
            finalFontSize *= availableWidth / maxLineWidth;
            finalFontSize = Math.max(finalFontSize, 4);
          }

          const fontMetrics = font.heightAtSize(finalFontSize, {
            descender: true,
          });

          const textY = y + (boxHeight - fontMetrics) / 2;
          textLines.forEach((line, lineIndex) => {
            const lineWidth = Math.min(
              font.widthOfTextAtSize(line, finalFontSize),
              availableWidth
            );
            const lineX =
              item.alignment === "center"
                ? x + Math.max(0, (availableWidth - lineWidth) / 2)
                : item.alignment === "right"
                ? x + Math.max(0, availableWidth - lineWidth)
                : x;
            const lineY = textY - lineIndex * finalFontSize * 1.15;
            pdfPage.drawText(line, {
              x: Math.max(0, lineX),
              y: Math.max(0, lineY),
              size: finalFontSize,
              font,
              color: hexToRgb(item.color),
              maxWidth: availableWidth,
              lineHeight: finalFontSize * 1.15,
            });
            if (item.isUnderline && lineWidth > 0) {
              pdfPage.drawLine({
                start: { x: lineX, y: lineY - finalFontSize * 0.12 },
                end: { x: lineX + lineWidth, y: lineY - finalFontSize * 0.12 },
                thickness: Math.max(0.5, finalFontSize / 18),
                color: hexToRgb(item.color),
              });
            }
          });

          if (item.linkUrl) {
            const linkRef = pdfDoc.context.register(
              pdfDoc.context.obj({
                Type: PDFName.of("Annot"),
                Subtype: PDFName.of("Link"),
                Rect: [
                  Math.max(0, x),
                  Math.max(0, y),
                  Math.min(pageWidth, x + availableWidth),
                  Math.min(pageHeight, y + boxHeight),
                ],
                Border: [0, 0, 0],
                A: {
                  Type: PDFName.of("Action"),
                  S: PDFName.of("URI"),
                  URI: PDFString.of(item.linkUrl),
                },
              })
            );
            pdfPage.node.addAnnot(linkRef);
          }
        }
      }

      for (const item of addedTexts) {
        const pageRecord = pagesToExport[item.pageIndex];
        const pdfPage = pdfPages[item.pageIndex];

        if (!pageRecord || !pdfPage || !item.text.trim()) continue;

        const { width: pageWidth, height: pageHeight } = pdfPage.getSize();

        const scaleX = pageWidth / pageRecord.width;
        const scaleY = pageHeight / pageRecord.height;

        const fontKey = [
          "added-text",
          getFontFamilyKey(item.fontFamily, item.fontFamily),
          getFontVariant(item.isBold, item.isItalic),
        ].join("|");

        let font = embeddedFonts.get(fontKey);

        if (!font) {
          font = await embedEditorFont(
            pdfDoc,
            item.fontFamily,
            item.fontFamily,
            item.isBold,
            item.isItalic
          );

          embeddedFonts.set(fontKey, font);
        }

        const size = clamp(item.fontSize * scaleY, 5, 96);
        const x = clamp(item.left * scaleX, 0, pageWidth);
        const textWidth = Math.min(
          Math.max(1, (item.width || 260) * scaleX),
          pageWidth - x
        );
        const y = clamp(
          pageHeight - item.top * scaleY - size,
          0,
          pageHeight
        );
        const textLines = item.text.split(/\r?\n/);
        const opacity = (item.opacity ?? 100) / 100;

        textLines.forEach((line, index) => {
          const lineWidth = Math.min(
            font.widthOfTextAtSize(line, size),
            textWidth
          );
          const lineX =
            item.alignment === "center"
              ? x + Math.max(0, (textWidth - lineWidth) / 2)
              : item.alignment === "right"
              ? x + Math.max(0, textWidth - lineWidth)
              : x;
          const lineY = y - index * size * 1.2;
          if (item.highlightEnabled && lineWidth > 0) {
            pdfPage.drawRectangle({
              x: lineX,
              y: lineY - size * 0.18,
              width: lineWidth,
              height: size * 1.2,
              color: hexToRgb(item.highlightColor || "#fff2a8"),
              opacity,
            });
          }
          pdfPage.drawText(line, {
            x: lineX,
            y: lineY,
            size,
            font,
            color: hexToRgb(item.color),
            opacity,
            maxWidth: textWidth,
            lineHeight: size * 1.2,
          });
        });

        if (item.isUnderline) {
          textLines.forEach((line, index) => {
            if (!line) return;

            const lineWidth = Math.min(
              font.widthOfTextAtSize(line, size),
              textWidth
            );
            const lineY = y - Math.max(1, size * 0.12) - index * size * 1.2;
            const lineX =
              item.alignment === "center"
                ? x + Math.max(0, (textWidth - lineWidth) / 2)
                : item.alignment === "right"
                ? x + Math.max(0, textWidth - lineWidth)
                : x;

            pdfPage.drawLine({
              start: { x: lineX, y: lineY },
              end: { x: lineX + lineWidth, y: lineY },
              thickness: Math.max(0.5, size / 18),
              color: hexToRgb(item.color),
              opacity,
            });
          });
        }
      }

      for (const item of annotations) {
        const pageRecord = pagesToExport[item.pageIndex];
        const pdfPage = pdfPages[item.pageIndex];
        if (!pageRecord || !pdfPage) continue;

        const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
        const scaleX = pageWidth / pageRecord.width;
        const scaleY = pageHeight / pageRecord.height;
        const x = item.x * scaleX;
        const y = pageHeight - (item.y + item.height) * scaleY;
        const width = Math.max(1, item.width * scaleX);
        const height = Math.max(1, item.height * scaleY);
        const opacity = clamp(item.opacity ?? 100, 0, 100) / 100;
        const strokeWidth = Math.max(
          0.5,
          (item.strokeWidth || 1) * ((scaleX + scaleY) / 2)
        );
        const rotation = degrees(item.rotation || 0);
        const borderDashArray =
          item.strokeStyle === "dashed" ? [6 * scaleX, 4 * scaleX] : undefined;

        if (item.type === "image" || item.shape === "symbol") {
          const imageData =
            item.type === "image"
              ? item.dataUrl
              : createSymbolDataUrl(item.symbol || "🙂");
          const image =
            item.type === "image" && item.mimeType === "image/jpeg"
              ? await pdfDoc.embedJpg(imageData)
              : await pdfDoc.embedPng(imageData);
          pdfPage.drawImage(image, {
            x,
            y,
            width,
            height,
            opacity,
            rotate: rotation,
          });
          continue;
        }

        if (item.type === "draw") {
          const points = item.points || [];
          for (let index = 1; index < points.length; index += 1) {
            const start = points[index - 1];
            const end = points[index];
            pdfPage.drawLine({
              start: {
                x: x + start.x * scaleX,
                y: pageHeight - (item.y + start.y) * scaleY,
              },
              end: {
                x: x + end.x * scaleX,
                y: pageHeight - (item.y + end.y) * scaleY,
              },
              thickness: strokeWidth,
              color: hexToRgb(item.strokeColor),
              opacity,
            });
          }
          continue;
        }

        if (item.shape === "line") {
          const startX = item.flipX ? x + width : x;
          const endX = item.flipX ? x : x + width;
          const topY = pageHeight - (item.y * scaleY);
          const bottomY = pageHeight - ((item.y + item.height) * scaleY);
          const startY = item.flipY ? bottomY : topY;
          const endY = item.flipY ? topY : bottomY;
          pdfPage.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            thickness: strokeWidth,
            color: hexToRgb(item.strokeColor),
            opacity,
          });
        } else if (item.shape === "circle") {
          pdfPage.drawEllipse({
            x: x + width / 2,
            y: y + height / 2,
            xScale: width / 2,
            yScale: height / 2,
            color: hexToRgb(item.fillColor),
            opacity,
            borderColor: hexToRgb(item.strokeColor),
            borderWidth: item.strokeStyle === "none" ? 0 : strokeWidth,
            borderOpacity: opacity,
            borderDashArray,
            rotate: rotation,
          });
        } else {
          pdfPage.drawRectangle({
            x,
            y,
            width,
            height,
            color: hexToRgb(item.fillColor),
            opacity,
            borderColor: hexToRgb(item.strokeColor),
            borderWidth: item.strokeStyle === "none" ? 0 : strokeWidth,
            borderOpacity: opacity,
            borderDashArray,
            rotate: rotation,
          });
        }
      }

      const bytes = await pdfDoc.save();

      const blob = new Blob([bytes], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const baseName = (file?.name || "document.pdf").replace(
        /\.pdf$/i,
        ""
      );

      link.href = url;
      link.download = `${baseName}-edited.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Delay revoking the URL to give the browser time to start downloading.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (exportError) {
      console.error("Edit PDF export error:", exportError);

      setError(
        "The edited PDF could not be exported. Try another PDF or shorter replacement text."
      );
    } finally {
      setSaving(false);
    }
  };

  const visibleItems = (currentPage?.items || []).filter((item) =>
    item.replacementText.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="edit-pdf-page epui">
      <Link to="/" className="edit-pdf-back">
        <ArrowLeft size={17} />
        Back to all tools
      </Link>

      <section className="edit-pdf-heading">
        <div className="edit-pdf-heading-icon">
          <Pencil size={23} />
        </div>

        <div>
          <span className="edit-pdf-eyebrow">PDF TOOL</span>
          <h1>Edit PDF</h1>
          <p>
            Select existing text, make your changes, and download the edited PDF.
          </p>
        </div>
      </section>


      {!file && (
        <section className="edit-pdf-upload-card">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) loadPdf(selected);
              event.target.value = "";
            }}
          />

          <div className="edit-pdf-card-heading">
            <span className="edit-pdf-eyebrow">EDIT YOUR DOCUMENT</span>
            <h2>Make changes to your PDF</h2>
            <p>
              Select a PDF to edit existing text or add new text to your document.
            </p>
          </div>

          <button
            type="button"
            className="edit-pdf-dropzone"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label="Choose a PDF file to edit"
          >
            <span className="edit-pdf-upload-art">
              {loading ? (
                <LoaderCircle className="edit-pdf-spin" size={30} />
              ) : (
                <Upload size={30} />
              )}
            </span>

            <strong>
              {loading ? "Loading your PDF…" : "Choose a PDF file"}
            </strong>

            <span className="edit-pdf-upload-description">
              Select a document from your computer to get started.
            </span>

            <span className="edit-pdf-browse-button">
              <Upload size={17} />
              Select PDF file
            </span>

            <span className="edit-pdf-file-limit">
              PDF files only · Maximum 50 MB
            </span>
          </button>

          <div className="merge-footer edit-pdf-preupload-footer">
            <button
              type="button"
              className="merge-clear-button"
              disabled
            >
              Clear all
            </button>

            <button
              type="button"
              className="merge-submit-button"
              disabled
            >
              <FileText size={18} />
              Edit PDF
              <Download size={17} />
            </button>
          </div>

          <div className="edit-pdf-privacy-note">
            <ShieldCheck size={18} />
            <span>
              <strong>Your files stay private.</strong>{" "}
              Processing happens in your browser; your documents are not uploaded to a server.
            </span>
          </div>
        </section>
      )}


      {file && pages.length > 0 && (
        <section className="edit-pdf-workspace">

          <header className="edit-pdf-toolbar epui-header">
            <div className="edit-pdf-file-title">
              <FileText size={19} />
              <span title={file.name}>{file.name}</span>
            </div>

            <div className="edit-pdf-toolbar-actions">
              <div className="edit-pdf-mode-switch" role="group" aria-label="Workspace mode">
                <button
                  type="button"
                  className={workspaceMode === "annotate" ? "is-active" : ""}
                  onClick={() => {
                    setWorkspaceMode("annotate");
                    setAnnotationTool("select");
                    setPanMode(false);
                    setAddTextMode(false);
                    setSelectedTextId(null);
                    setShowTextEditor(false);
                  }}
                >
                  <PenLine size={16} />
                  <span>Annotate</span>
                </button>
                <button
                  type="button"
                  className={workspaceMode === "edit" ? "is-active" : ""}
                  onClick={() => {
                    setWorkspaceMode("edit");
                    setAnnotationTool("select");
                    setPanMode(false);
                    setAddTextMode(false);
                    setSelectedAddedTextId(null);
                    setSelectedAnnotationId(null);
                    setShowTextEditor(false);
                  }}
                >
                  <AlignLeft size={17} />
                  <span>Edit</span>
                  <Crown className="edit-pdf-mode-premium" size={16} />
                </button>
              </div>

              <div className="edit-pdf-toolbar-divider" />

              <div className="edit-pdf-tool-group" role="group" aria-label="Annotation tools">
                <button type="button" className={`edit-pdf-tool-button ${annotationTool === "select" && !panMode ? "is-active" : ""}`}
                  onClick={() => { setAnnotationTool("select"); setPanMode(false); setAddTextMode(false); setShowTextEditor(false); }}
                  title="Select and resize annotations" aria-label="Select annotations">
                  <MousePointer2 size={20} /><span>Select</span>
                </button>
                <button type="button" className={`edit-pdf-tool-button ${panMode ? "is-active" : ""}`}
                  onClick={() => {
                    setAnnotationTool("select");
                    setPanMode((active) => !active);
                    setAddTextMode(false);
                    setShowTextEditor(false);
                  }}
                  title={panMode ? "Turn hand tool off" : "Drag pages with the hand tool"}
                  aria-label={panMode ? "Turn hand tool off" : "Turn hand tool on"}
                  aria-pressed={panMode}>
                  <Hand size={21} /><span>Hand</span>
                </button>
                <button type="button" className={`edit-pdf-tool-button ${annotationTool === "text" ? "is-active" : ""}`}
                  onClick={() => { setWorkspaceMode("annotate"); setAnnotationTool("text"); setPanMode(false); setAddTextMode(true); setSelectedAddedTextId(null); setSelectedTextId(null); setShowTextEditor(false); }}
                  title="Add text" aria-label="Add text">
                  <Type size={24} /><span>Text</span>
                </button>
                <button type="button" className={`edit-pdf-tool-button ${annotationTool === "image" ? "is-active" : ""}`}
                  onClick={() => { setAnnotationTool("image"); setPanMode(false); setAddTextMode(false); setSelectedAnnotationId(null); imageInputRef.current?.click(); }}
                  title="Add image" aria-label="Add image">
                  <Image size={23} /><span>Image</span>
                </button>
                <button type="button" className={`edit-pdf-tool-button ${annotationTool === "draw" ? "is-active" : ""}`}
                  onClick={() => { setAnnotationTool("draw"); setPanMode(false); setAddTextMode(false); setSelectedAnnotationId(null); }}
                  title="Draw on the page" aria-label="Pencil">
                  <PenLine size={21} /><span>Pencil</span>
                </button>
                <button type="button" className={`edit-pdf-tool-button ${annotationTool === "shape" ? "is-active" : ""}`}
                  onClick={() => { setAnnotationTool("shape"); setActiveShape("line"); setPanMode(false); setAddTextMode(false); setSelectedAnnotationId(null); }}
                  title="Add a shape" aria-label="Add shape">
                  <Shapes size={23} /><span>Shapes</span>
                </button>
              </div>

              <div className="edit-pdf-toolbar-divider" />

              <button type="button" className="edit-pdf-tool-button" onClick={() => setZoom((value) => clamp(value - 0.1, 0.2, 2))} disabled={zoom <= 0.2} title="Zoom out">
                <ZoomOut size={17} />
              </button>
              <span className="edit-pdf-zoom-value">{Math.round(zoom * 100)}%</span>
              <button type="button" className="edit-pdf-tool-button" onClick={() => setZoom((value) => clamp(value + 0.1, 0.2, 2))} disabled={zoom >= 2} title="Zoom in">
                <ZoomIn size={17} />
              </button>
              <button type="button" className="edit-pdf-tool-button" onClick={() => setZoom(1)} title="Reset zoom"><RotateCcw size={16} /></button>
              <div className="edit-pdf-toolbar-divider" />
              <button type="button" className="edit-pdf-tool-button edit-pdf-open-button" onClick={() => fileInputRef.current?.click()} title="Open another PDF">
                <Upload size={17} /><span>Open</span>
              </button>
            </div>
          </header>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={handleImageUpload}
          />

          {!panMode &&
            (annotationTool !== "select" ||
              selectedAddedTextId ||
              selectedAnnotationId) && (
          <div className={`edit-pdf-annotation-context edit-pdf-context-${annotationTool}`}>
            {annotationTool === "select" && selectedAnnotation ? (
              <>
                <span className="edit-pdf-context-label">
                  {selectedAnnotation.type === "image"
                    ? "IMAGE"
                    : selectedAnnotation.shape === "draw"
                    ? "PENCIL"
                    : String(selectedAnnotation.shape).toUpperCase()}
                </span>
                {selectedAnnotation.type === "draw" ||
                selectedAnnotation.shape === "line" ? (
                  <>
                    <label className="edit-pdf-context-color" title="Line colour">
                      <input type="color" aria-label="Line colour" value={selectedAnnotation.strokeColor} onChange={(event) => changeAnnotationStrokeColor(event.target.value)} />
                    </label>
                    <select aria-label="Line width" value={selectedAnnotation.strokeWidth} onChange={(event) => changeAnnotationWidth(Number(event.target.value))}>
                      <option value={1}>1 pt</option><option value={2}>2 pt</option><option value={4}>4 pt</option><option value={6}>6 pt</option><option value={8}>8 pt</option>
                    </select>
                  </>
                ) : selectedAnnotation.shape === "rectangle" ||
                  selectedAnnotation.shape === "circle" ? (
                  <>
                    <label className="edit-pdf-context-color" title="Shape fill colour">
                      <input type="color" aria-label="Shape fill colour" value={selectedAnnotation.fillColor} onChange={(event) => changeAnnotationFillColor(event.target.value)} />
                    </label>
                    <select aria-label="Shape opacity" value={selectedAnnotation.opacity} onChange={(event) => changeAnnotationOpacity(Number(event.target.value))}>
                      <option value={100}>100%</option><option value={75}>75%</option><option value={50}>50%</option><option value={25}>25%</option>
                    </select>
                    <select aria-label="Border style" value={selectedAnnotation.strokeStyle} onChange={(event) => changeAnnotationStrokeStyle(event.target.value)}>
                      <option value="solid">Solid border</option><option value="dashed">Dashed border</option><option value="none">No border</option>
                    </select>
                    <select aria-label="Border width" value={selectedAnnotation.strokeWidth} onChange={(event) => changeAnnotationWidth(Number(event.target.value))}>
                      <option value={1}>1 pt</option><option value={2}>2 pt</option><option value={4}>4 pt</option><option value={6}>6 pt</option><option value={8}>8 pt</option>
                    </select>
                    {selectedAnnotation.shape === "rectangle" && (
                      <>
                        <button type="button" aria-label="Rotate shape left" title="Rotate left" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation - 15 + 360) % 360 })}><RotateCcw size={16} /></button>
                        <button type="button" aria-label="Rotate shape right" title="Rotate right" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation + 15) % 360 })}><RotateCw size={16} /></button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {selectedAnnotation.shape === "symbol" && (
                      <>
                        <select aria-label="Symbol opacity" value={selectedAnnotation.opacity} onChange={(event) => changeAnnotationOpacity(Number(event.target.value))}>
                          <option value={100}>100%</option><option value={75}>75%</option><option value={50}>50%</option><option value={25}>25%</option>
                        </select>
                        <button type="button" aria-label="Rotate symbol left" title="Rotate left" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation - 15 + 360) % 360 })}><RotateCcw size={16} /></button>
                        <button type="button" aria-label="Rotate symbol right" title="Rotate right" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation + 15) % 360 })}><RotateCw size={16} /></button>
                      </>
                    )}
                    {selectedAnnotation.type === "image" && (
                      <>
                        <select aria-label="Image opacity" value={selectedAnnotation.opacity} onChange={(event) => changeAnnotationOpacity(Number(event.target.value))}>
                          <option value={100}>100%</option><option value={75}>75%</option><option value={50}>50%</option><option value={25}>25%</option>
                        </select>
                        <button type="button" aria-label="Rotate image left" title="Rotate left" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation - 15 + 360) % 360 })}><RotateCcw size={16} /></button>
                        <button type="button" aria-label="Rotate image right" title="Rotate right" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation + 15) % 360 })}><RotateCw size={16} /></button>
                      </>
                    )}
                  </>
                )}
                <span className="edit-pdf-context-hint">
                  Drag to move; use the blue handles to resize.
                </span>
                <button
                  type="button"
                  aria-label="Delete selected annotation"
                  title="Delete selected annotation"
                  onClick={() => deleteAnnotation(selectedAnnotation.id)}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </>
            ) : annotationTool === "text" ? (
              <div className="edit-pdf-text-format-toolbar" role="toolbar" aria-label="Text formatting">
                <span className="edit-pdf-text-format-mark">T</span>
                  <select
                    value={selectedAddedText?.fontFamily || annotationFontFamily}
                    onChange={(event) => {
                      const fontFamily = event.target.value;
                      setAnnotationFontFamily(fontFamily);
                      if (selectedAddedText) {
                        updateAddedText(selectedAddedText.id, { fontFamily });
                      }
                    }}
                    aria-label="Font family"
                  >
                    <option>Arial</option><option>Calibri</option><option>Times New Roman</option>
                  </select>
                  <span className="edit-pdf-format-divider" />
                  <Type className="edit-pdf-format-size-icon" size={18} aria-hidden="true" />
                  <input
                    aria-label="Font size"
                    type="number"
                    min="5"
                    max="96"
                    value={selectedAddedText?.fontSize ?? newTextSize}
                    onChange={(event) => {
                      const fontSize = clamp(Number(event.target.value) || 36, 5, 96);
                      setNewTextSize(fontSize);
                      if (selectedAddedText) {
                        updateAddedText(selectedAddedText.id, { fontSize });
                      }
                    }}
                  />
                  <span className="edit-pdf-format-divider" />
                  <button
                    type="button"
                    className={(selectedAddedText?.isBold ?? annotationBold) ? "is-active" : ""}
                    onClick={() => {
                      const isBold = !(selectedAddedText?.isBold ?? annotationBold);
                      setAnnotationBold(isBold);
                      setNewTextBold(isBold);
                      if (selectedAddedText) {
                        updateAddedText(selectedAddedText.id, { isBold });
                      }
                    }}
                    title="Bold"
                  ><Bold size={16}/></button>
                  <button
                    type="button"
                    className={(selectedAddedText?.isItalic ?? annotationItalic) ? "is-active" : ""}
                    onClick={() => {
                      const isItalic = !(selectedAddedText?.isItalic ?? annotationItalic);
                      setAnnotationItalic(isItalic);
                      setNewTextItalic(isItalic);
                      if (selectedAddedText) {
                        updateAddedText(selectedAddedText.id, { isItalic });
                      }
                    }}
                    title="Italic"
                  ><Italic size={16}/></button>
                  <button
                    type="button"
                    className={(selectedAddedText?.isUnderline ?? annotationUnderline) ? "is-active" : ""}
                    onClick={() => {
                      const isUnderline = !(selectedAddedText?.isUnderline ?? annotationUnderline);
                      setAnnotationUnderline(isUnderline);
                      if (selectedAddedText) {
                        updateAddedText(selectedAddedText.id, { isUnderline });
                      }
                    }}
                    title="Underline"
                  ><Underline size={16}/></button>
                  <div className="edit-pdf-format-popover-anchor">
                    <button
                      type="button"
                      className="edit-pdf-format-menu-trigger"
                      aria-label="Text color"
                      aria-expanded={textColorMenuOpen}
                      title="Text color"
                      onClick={() => {
                        setTextColorMenuOpen((open) => !open);
                        setHighlightColorMenuOpen(false);
                      }}
                    >
                      <span className="edit-pdf-format-text-color-mark">A</span>
                      <ChevronDown size={14} />
                      <span
                        className="edit-pdf-format-color-underline"
                        style={{ backgroundColor: selectedAddedText?.color || newTextColor }}
                      />
                    </button>
                    {textColorMenuOpen && (
                      <div className="edit-pdf-format-color-popover" role="group" aria-label="Text color palette">
                        {["#ffffff", "#000000", ...textFormatPalette].map((color) => (
                          <button
                            type="button"
                            key={color}
                            aria-label={`Set text color ${color}`}
                            title={color}
                            className={(selectedAddedText?.color || newTextColor) === color ? "is-selected" : ""}
                            style={{ "--palette-color": color }}
                            onClick={() => {
                              setNewTextColor(color);
                              if (selectedAddedText) {
                                updateAddedText(selectedAddedText.id, { color });
                              }
                              setTextColorMenuOpen(false);
                            }}
                          >
                            {(selectedAddedText?.color || newTextColor) === color && (
                              <Check size={14} aria-hidden="true" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="edit-pdf-format-popover-anchor">
                    <button
                      type="button"
                      className={`edit-pdf-format-menu-trigger edit-pdf-highlight-trigger ${
                        (selectedAddedText?.highlightEnabled ?? newTextHighlight) ? "is-active" : ""
                      }`}
                      aria-label="Highlight color and fill"
                      aria-expanded={highlightColorMenuOpen}
                      title="Highlight color and fill"
                      onClick={() => {
                        setHighlightColorMenuOpen((open) => !open);
                        setTextColorMenuOpen(false);
                      }}
                    >
                      <Highlighter size={17} />
                      <ChevronDown size={14} />
                    </button>
                    {highlightColorMenuOpen && (
                      <div className="edit-pdf-format-color-popover edit-pdf-highlight-popover" role="group" aria-label="Highlight color palette">
                        <div className="edit-pdf-highlight-presets">
                          <button
                            type="button"
                            className={`edit-pdf-highlight-transparent ${
                              !(selectedAddedText?.highlightEnabled ?? newTextHighlight)
                                ? "is-selected"
                                : ""
                            }`}
                            aria-label="No highlight"
                            title="No highlight"
                            onClick={() => {
                              setNewTextHighlight(false);
                              if (selectedAddedText) {
                                updateAddedText(selectedAddedText.id, { highlightEnabled: false });
                              }
                              setHighlightColorMenuOpen(false);
                            }}
                          >
                            <span />
                          </button>
                          {["#ffffff", "#000000"].map((color) => (
                            <button
                              type="button"
                              key={color}
                              aria-label={`Set highlight color ${color}`}
                              title={color}
                              className={(selectedAddedText?.highlightColor || newTextHighlightColor) === color && (selectedAddedText?.highlightEnabled ?? newTextHighlight) ? "is-selected" : ""}
                              style={{ "--palette-color": color }}
                              onClick={() => {
                                setNewTextHighlightColor(color);
                                setNewTextHighlight(true);
                                if (selectedAddedText) {
                                  updateAddedText(selectedAddedText.id, {
                                    highlightColor: color,
                                    highlightEnabled: true,
                                  });
                                }
                                setHighlightColorMenuOpen(false);
                              }}
                            >
                              {(selectedAddedText?.highlightColor || newTextHighlightColor) === color && (selectedAddedText?.highlightEnabled ?? newTextHighlight) && (
                                <Check size={14} aria-hidden="true" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="edit-pdf-highlight-color-grid">
                          {textFormatPalette.map((color) => (
                            <button
                              type="button"
                              key={color}
                              aria-label={`Set highlight color ${color}`}
                              title={color}
                              className={(selectedAddedText?.highlightColor || newTextHighlightColor) === color && (selectedAddedText?.highlightEnabled ?? newTextHighlight) ? "is-selected" : ""}
                              style={{ "--palette-color": color }}
                              onClick={() => {
                                setNewTextHighlightColor(color);
                                setNewTextHighlight(true);
                                if (selectedAddedText) {
                                  updateAddedText(selectedAddedText.id, {
                                    highlightColor: color,
                                    highlightEnabled: true,
                                  });
                                }
                                setHighlightColorMenuOpen(false);
                              }}
                            >
                              {(selectedAddedText?.highlightColor || newTextHighlightColor) === color && (selectedAddedText?.highlightEnabled ?? newTextHighlight) && (
                                <Check size={14} aria-hidden="true" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="edit-pdf-format-divider" />
                  <label className="edit-pdf-format-alignment">
                    {(selectedAddedText?.alignment || newTextAlignment) === "center" ? (
                      <AlignCenter size={18} />
                    ) : (selectedAddedText?.alignment || newTextAlignment) === "right" ? (
                      <AlignRight size={18} />
                    ) : (
                      <AlignLeft size={18} />
                    )}
                    <ChevronDown size={14} />
                    <select
                      aria-label="Text alignment"
                      value={selectedAddedText?.alignment || newTextAlignment}
                      onChange={(event) => {
                        const alignment = event.target.value;
                        setNewTextAlignment(alignment);
                        if (selectedAddedText) {
                          updateAddedText(selectedAddedText.id, { alignment });
                        }
                      }}
                    >
                      <option value="left">Align left</option>
                      <option value="center">Align center</option>
                      <option value="right">Align right</option>
                    </select>
                  </label>
                  <span className="edit-pdf-format-divider" />
                  <span className="edit-pdf-transparency-icon" aria-hidden="true" />
                  <select
                    className="edit-pdf-text-opacity"
                    aria-label="Text and highlight transparency"
                    title="Text and highlight transparency"
                    value={selectedAddedText?.opacity ?? newTextOpacity}
                    onChange={(event) => {
                      const opacity = Number(event.target.value);
                      setNewTextOpacity(opacity);
                      if (selectedAddedText) {
                        updateAddedText(selectedAddedText.id, { opacity });
                      }
                    }}
                  >
                    <option value={100}>100%</option>
                    <option value={75}>75%</option>
                    <option value={50}>50%</option>
                    <option value={25}>25%</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Delete added text"
                    title={selectedAddedText ? "Delete added text" : "Select text to delete"}
                    disabled={!selectedAddedText}
                    onClick={() => {
                      deleteAddedText(selectedAddedText.id);
                      setShowTextEditor(false);
                    }}
                    className="edit-pdf-text-format-delete"
                  ><Trash2 size={16}/></button>
                  <span className="edit-pdf-text-format-hint">
                    {selectedAddedText
                      ? "Edit the selected text on the page."
                      : "Click on the page to place text"}
                  </span>
              </div>
            ) : annotationTool === "image" ? (
              <>
                <span className="edit-pdf-context-label">IMAGE</span>
                <button type="button" onClick={() => imageInputRef.current?.click()}>
                  <Upload size={15} /> Upload image
                </button>
                {selectedAnnotation?.type === "image" && (
                  <>
                    <button
                      type="button"
                      title="Rotate image left"
                      aria-label="Rotate image left"
                      onClick={() => updateAnnotation(selectedAnnotation.id, {
                        rotation: (selectedAnnotation.rotation - 15 + 360) % 360,
                      })}
                    ><RotateCcw size={16} /></button>
                    <button
                      type="button"
                      title="Rotate image right"
                      aria-label="Rotate image right"
                      onClick={() => updateAnnotation(selectedAnnotation.id, {
                        rotation: (selectedAnnotation.rotation + 15) % 360,
                      })}
                    ><RotateCw size={16} /></button>
                    <select
                      aria-label="Image opacity"
                      value={selectedAnnotation.opacity ?? annotationOpacity}
                      onChange={(event) => changeAnnotationOpacity(Number(event.target.value))}
                    >
                      <option value={100}>100%</option><option value={75}>75%</option>
                      <option value={50}>50%</option><option value={25}>25%</option>
                    </select>
                    <button
                      type="button"
                      aria-label="Delete selected image"
                      onClick={() => deleteAnnotation(selectedAnnotation.id)}
                    ><Trash2 size={16} /></button>
                  </>
                )}
                <span className="edit-pdf-context-hint">
                  {selectedAnnotation?.type === "image"
                    ? "Drag the image or resize it with the handles."
                    : "Choose a PNG or JPEG to add it to the current page."}
                </span>
              </>
            ) : annotationTool === "draw" ? (
              <>
                <span className="edit-pdf-context-label">PENCIL</span>
                <label className="edit-pdf-context-color" title="Pencil colour">
                  <input type="color" value={selectedAnnotation?.type === "draw" ? selectedAnnotation.strokeColor : annotationColor} onChange={(event) => changeAnnotationStrokeColor(event.target.value)} />
                </label>
                <label className="edit-pdf-context-width">
                  <select aria-label="Pencil width" value={selectedAnnotation?.type === "draw" ? selectedAnnotation.strokeWidth : annotationLineWidth} onChange={(event) => changeAnnotationWidth(Number(event.target.value))}>
                    <option value={1}>1 pt</option><option value={2}>2 pt</option><option value={4}>4 pt</option>
                    <option value={6}>6 pt</option><option value={8}>8 pt</option>
                  </select>
                </label>
                <button type="button" aria-label="Delete selected drawing" title="Delete selected drawing" disabled={selectedAnnotation?.type !== "draw"} onClick={() => deleteAnnotation(selectedAnnotation.id)}><Trash2 size={16} /></button>
                <span className="edit-pdf-context-hint">Drag on the page to draw.</span>
              </>
            ) : annotationTool === "shape" ? (
              <>
                <span className="edit-pdf-context-label">SHAPES</span>
                <div className="edit-pdf-shape-picker" role="group" aria-label="Shape type">
                  <button type="button" className={activeShape === "line" ? "is-active" : ""} onClick={() => { setActiveShape("line"); setSelectedAnnotationId(null); }} title="Line"><Minus size={17} /><span>Line</span></button>
                  <button type="button" className={activeShape === "rectangle" ? "is-active" : ""} onClick={() => { setActiveShape("rectangle"); setSelectedAnnotationId(null); }} title="Rectangle"><Square size={17} /><span>Rectangle</span></button>
                  <button type="button" className={activeShape === "circle" ? "is-active" : ""} onClick={() => { setActiveShape("circle"); setSelectedAnnotationId(null); }} title="Circle"><Circle size={17} /><span>Circle</span></button>
                  <button type="button" className={activeShape === "symbol" ? "is-active" : ""} onClick={() => { setActiveShape("symbol"); setSelectedAnnotationId(null); }} title="Symbol"><span aria-hidden="true">☺</span><span>Symbol</span></button>
                </div>
                {activeShape === "symbol" ? (
                  <>
                    <div className="edit-pdf-symbol-picker" role="group" aria-label="Choose a symbol">
                      {annotationSymbols.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          className={annotationSymbol === symbol ? "is-active" : ""}
                          aria-label={`Choose symbol ${symbol}`}
                          aria-pressed={annotationSymbol === symbol}
                          onClick={() => changeAnnotationSymbol(symbol)}
                        >{symbol}</button>
                      ))}
                    </div>
                    <select aria-label="Symbol opacity" value={selectedAnnotation?.shape === "symbol" ? selectedAnnotation.opacity : annotationOpacity} onChange={(event) => changeAnnotationOpacity(Number(event.target.value))}>
                      <option value={100}>100%</option><option value={75}>75%</option><option value={50}>50%</option><option value={25}>25%</option>
                    </select>
                    {selectedAnnotation?.shape === "symbol" && (
                      <>
                        <button type="button" aria-label="Rotate symbol left" title="Rotate left" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation - 15 + 360) % 360 })}><RotateCcw size={16} /></button>
                        <button type="button" aria-label="Rotate symbol right" title="Rotate right" onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation + 15) % 360 })}><RotateCw size={16} /></button>
                      </>
                    )}
                    <button type="button" aria-label="Delete selected symbol" title="Delete selected symbol" disabled={selectedAnnotation?.shape !== "symbol"} onClick={() => deleteAnnotation(selectedAnnotation.id)}><Trash2 size={16} /></button>
                    <span className="edit-pdf-context-hint">Click on the page to place the selected symbol.</span>
                  </>
                ) : activeShape === "line" ? (
                  <>
                    <label className="edit-pdf-context-color" title="Line colour">
                      <input type="color" value={selectedAnnotation?.shape === "line" ? selectedAnnotation.strokeColor : annotationColor} onChange={(event) => changeAnnotationStrokeColor(event.target.value)} />
                    </label>
                    <label className="edit-pdf-context-width">
                      <select aria-label="Line width" value={selectedAnnotation?.shape === "line" ? selectedAnnotation.strokeWidth : annotationLineWidth} onChange={(event) => changeAnnotationWidth(Number(event.target.value))}>
                        <option value={1}>1 pt</option><option value={2}>2 pt</option><option value={4}>4 pt</option><option value={6}>6 pt</option><option value={8}>8 pt</option>
                      </select>
                    </label>
                    <button type="button" aria-label="Delete selected line" title="Delete selected line" disabled={selectedAnnotation?.shape !== "line"} onClick={() => deleteAnnotation(selectedAnnotation.id)}><Trash2 size={16} /></button>
                    <span className="edit-pdf-context-hint">Drag on the page to draw a line.</span>
                  </>
                ) : (
                  <>
                    <label className="edit-pdf-context-color" title="Shape fill colour">
                      <input type="color" value={selectedAnnotation?.shape === activeShape ? selectedAnnotation.fillColor : annotationFillColor} onChange={(event) => changeAnnotationFillColor(event.target.value)} />
                    </label>
                    <label className="edit-pdf-context-border" title="Border style">
                      <select aria-label="Border style" value={selectedAnnotation?.shape === activeShape ? selectedAnnotation.strokeStyle : annotationStrokeStyle} onChange={(event) => changeAnnotationStrokeStyle(event.target.value)}>
                        <option value="solid">Solid border</option><option value="dashed">Dashed border</option><option value="none">No border</option>
                      </select>
                    </label>
                    {activeShape === "rectangle" && (
                      <>
                        <button type="button" aria-label="Rotate shape left" title="Rotate left" disabled={!selectedAnnotation || selectedAnnotation.shape !== activeShape} onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation - 15 + 360) % 360 })}><RotateCcw size={16} /></button>
                        <button type="button" aria-label="Rotate shape right" title="Rotate right" disabled={!selectedAnnotation || selectedAnnotation.shape !== activeShape} onClick={() => updateAnnotation(selectedAnnotation.id, { rotation: (selectedAnnotation.rotation + 15) % 360 })}><RotateCw size={16} /></button>
                      </>
                    )}
                    <select aria-label="Shape opacity" value={selectedAnnotation?.shape === activeShape ? selectedAnnotation.opacity : annotationOpacity} onChange={(event) => changeAnnotationOpacity(Number(event.target.value))}>
                      <option value={100}>100%</option><option value={75}>75%</option><option value={50}>50%</option><option value={25}>25%</option>
                    </select>
                    <label className="edit-pdf-context-width">
                      <select aria-label="Border width" value={selectedAnnotation?.shape === activeShape ? selectedAnnotation.strokeWidth : annotationLineWidth} onChange={(event) => changeAnnotationWidth(Number(event.target.value))}>
                        <option value={1}>1 pt</option><option value={2}>2 pt</option><option value={4}>4 pt</option><option value={6}>6 pt</option><option value={8}>8 pt</option>
                      </select>
                    </label>
                    <button type="button" aria-label={`Delete selected ${activeShape}`} title={`Delete selected ${activeShape}`} disabled={selectedAnnotation?.shape !== activeShape} onClick={() => deleteAnnotation(selectedAnnotation.id)}><Trash2 size={16} /></button>
                    <span className="edit-pdf-context-hint">Drag on the page to draw a {activeShape}.</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="edit-pdf-context-label">{workspaceMode === "edit" ? "EDIT PDF" : "ANNOTATE"}</span>
                <span className="edit-pdf-context-hint">{workspaceMode === "edit" ? "Select existing text on the page to edit it." : "Choose a tool above, then click the page to annotate."}</span>
              </>
            )}
          </div>
          )}

          <div className="edit-pdf-workspace-body epui-workspace">
            <aside className="edit-pdf-page-strip epui-left-sidebar">
              <div className="edit-pdf-page-strip-heading">
                Pages
                <span>{pages.length}</span>
              </div>

              {pages.map((page, index) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  title={`Go to page ${page.pageNumber}`}
                    className={`edit-pdf-page-thumb ${
                      pageNumber === page.pageNumber ? "is-active" : ""
                  }`}
                  onClick={() => changePage(page.pageNumber)}
                  aria-label={`Go to page ${page.pageNumber}`}
                  aria-current={
                    pageNumber === page.pageNumber ? "page" : undefined
                  }
                >
                  <span className="edit-pdf-page-thumb-paper">
                    <span className="edit-pdf-thumb-title-line" />

                    {Array.from({ length: 12 }, (_, lineIndex) => (
                      <span
                        key={lineIndex}
                        className={`edit-pdf-thumb-line ${
                          lineIndex === 3 || lineIndex === 8
                            ? "is-heading"
                            : lineIndex % 4 === 1
                            ? "is-short"
                            : lineIndex % 3 === 0
                            ? "is-medium"
                            : ""
                        }`}
                      />
                    ))}
                  </span>

                  <span className="edit-pdf-page-thumb-number">
                    Page {page.pageNumber}
                  </span>
                </button>
              ))}
            </aside>
            <div className="edit-pdf-document-area epui-viewer">
              <div
                ref={canvasScrollRef}
                className={`edit-pdf-canvas-scroll epui-canvas ${
                  panMode ? "is-pan-mode" : ""
                }`}
                onScroll={updateActivePageFromScroll}
                onPointerDown={startCanvasPan}
                onPointerMove={moveCanvasPan}
                onPointerUp={stopCanvasPan}
                onPointerCancel={stopCanvasPan}
              >
                {pages.map((currentPage) => (
                <div
                  key={currentPage.pageNumber}
                  ref={(element) => {
                    if (element) {
                      pageWrapperRefsRef.current.set(currentPage.pageNumber, element);
                    } else {
                      pageWrapperRefsRef.current.delete(currentPage.pageNumber);
                    }
                  }}
                  className="edit-pdf-canvas-wrap"
                  data-page-number={currentPage.pageNumber}
                  style={{
                    width: currentPage.width * zoom,
                    height: currentPage.height * zoom,
                  }}
                >
                  <canvas
                    ref={(element) => {
                      if (element) {
                        pageCanvasRefsRef.current.set(currentPage.pageNumber, element);
                      } else {
                        pageCanvasRefsRef.current.delete(currentPage.pageNumber);
                      }
                    }}
                  />

                  {currentPage && (

                    <div
                      className={`edit-pdf-text-overlay ${addTextMode ? "is-add-text-mode" : ""} ${
                        workspaceMode === "edit" ? "is-text-edit-mode" : ""
                      } ${annotationTool === "draw" ? "is-drawing-mode" : ""} ${
                        annotationTool === "shape" ? "is-shape-mode" : ""
                      }`}
                      style={{
                        width: currentPage.width * zoom,
                        height: currentPage.height * zoom,
                      }}
                      onPointerDown={(event) =>
                        handleAnnotationPointerDown(event, currentPage)
                      }
                      onPointerMove={handleAnnotationPointerMove}
                      onPointerUp={finishAnnotationPointer}
                      onPointerCancel={finishAnnotationPointer}
                      onClick={(event) => {
                        if (
                          workspaceMode === "edit" &&
                          showTextEditor &&
                          selectedText
                        ) {
                          if (
                            event.target.closest(
                              "textarea, .edit-pdf-text-hitbox, .edit-pdf-text-resize-handle"
                            )
                          ) {
                            return;
                          }
                          applyEdit();
                          return;
                        }

                        if (
                          workspaceMode === "annotate" &&
                          annotationTool === "text"
                        ) {
                          addTextAtPosition(event, currentPage);
                        }
                      }}
                    >

                      {annotations
                        .filter(
                          (item) => item.pageIndex === currentPage.pageNumber - 1
                        )
                        .map((item) => {
                          const selected =
                            selectedAnnotationId === item.id;
                          const strokeWidth = item.strokeWidth || 1;
                          const dashArray =
                            item.strokeStyle === "dashed" ? "6 4" : undefined;
                          const shapeWidth = Math.max(item.width, 1);
                          const shapeHeight = Math.max(item.height, 1);
                          const lineStartX = item.flipX ? shapeWidth : 0;
                          const lineEndX = item.flipX ? 0 : shapeWidth;
                          const lineStartY = item.flipY ? shapeHeight : 0;
                          const lineEndY = item.flipY ? 0 : shapeHeight;
                          const opacity = (item.opacity ?? 100) / 100;
                          const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

                          return (
                            <div
                              key={item.id}
                              className={`edit-pdf-annotation-item ${selected ? "is-selected" : ""} ${item.type === "image" ? "is-image" : ""}`}
                              style={{
                                left: `${item.x * zoom}px`,
                                top: `${item.y * zoom}px`,
                                width: `${shapeWidth * zoom}px`,
                                height: `${shapeHeight * zoom}px`,
                                transform: `rotate(${item.rotation || 0}deg)`,
                                zIndex: selected ? 8 : 5,
                                pointerEvents: "auto",
                                cursor: annotationTool === "select" ? "move" : "default",
                              }}
                              onPointerDown={(event) =>
                                beginAnnotationTransform(event, item)
                              }
                              aria-label={`${item.type === "image" ? "Image" : item.shape === "draw" ? "Pencil drawing" : `${item.shape} annotation`}`}
                            >
                              {item.type === "image" ? (
                                <img
                                  className="edit-pdf-annotation-image"
                                  src={item.dataUrl}
                                  alt="Added to PDF"
                                  draggable="false"
                                  style={{ opacity }}
                                />
                              ) : item.shape === "symbol" ? (
                                <span
                                  className="edit-pdf-annotation-symbol"
                                  style={{
                                    fontSize: `${Math.min(shapeWidth, shapeHeight) * 0.88 * zoom}px`,
                                    opacity,
                                  }}
                                >{item.symbol}</span>
                              ) : (
                                <svg
                                  className="edit-pdf-annotation-svg"
                                  viewBox={`0 0 ${shapeWidth} ${shapeHeight}`}
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                >
                                  {item.type === "draw" ? (
                                    <polyline
                                      points={(item.points || [])
                                        .map((point) => `${point.x},${point.y}`)
                                        .join(" ")}
                                      fill="none"
                                      stroke={item.strokeColor}
                                      strokeWidth={strokeWidth}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeOpacity={opacity}
                                    />
                                  ) : item.shape === "line" ? (
                                    <line
                                      x1={lineStartX}
                                      y1={lineStartY}
                                      x2={lineEndX}
                                      y2={lineEndY}
                                      stroke={item.strokeColor}
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={dashArray}
                                      strokeLinecap="round"
                                      strokeOpacity={opacity}
                                    />
                                  ) : item.shape === "circle" ? (
                                    <ellipse
                                      cx={shapeWidth / 2}
                                      cy={shapeHeight / 2}
                                      rx={Math.max(0, shapeWidth / 2 - strokeWidth / 2)}
                                      ry={Math.max(0, shapeHeight / 2 - strokeWidth / 2)}
                                      fill={item.fillColor}
                                      fillOpacity={opacity}
                                      stroke={item.strokeStyle === "none" ? "none" : item.strokeColor}
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={dashArray}
                                    />
                                  ) : (
                                    <rect
                                      x={strokeWidth / 2}
                                      y={strokeWidth / 2}
                                      width={Math.max(0, shapeWidth - strokeWidth)}
                                      height={Math.max(0, shapeHeight - strokeWidth)}
                                      fill={item.fillColor}
                                      fillOpacity={opacity}
                                      stroke={item.strokeStyle === "none" ? "none" : item.strokeColor}
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={dashArray}
                                    />
                                  )}
                                </svg>
                              )}
                              {selected && handles.map((handle) => (
                                <button
                                  key={handle}
                                  type="button"
                                  className={`edit-pdf-annotation-resize-handle is-${handle}`}
                                  aria-label={`Resize annotation ${handle}`}
                                  onPointerDown={(event) =>
                                    beginAnnotationTransform(event, item, handle)
                                  }
                                />
                              ))}
                            </div>
                          );
                        })}

                      {currentPage.items.map((item) => {
                        const selected = selectedTextId === item.id;

                        const previewing =
                          selected &&
                          editingText !== item.originalText;

                        const displayedText = selected
                          ? editingText
                          : item.replacementText;

                        const previewFontSize = selected
                          ? clamp(
                            Number(fontSize) || item.fontSize,
                            5,
                            96
                          )
                          : item.fontSize;

                        const previewColor = selected
                          ? textColor
                          : item.color;

                        const previewWidth = selected
                          ? Math.max(item.width, 24)
                          : Math.max(
                              item.width,
                              estimateTextWidth(
                                displayedText,
                                previewFontSize * zoom,
                                item.fontFamily,
                                item.isBold,
                                item.isItalic
                              ) / zoom
                            );

                        const remainingWidth = Math.max(
                          24,
                          (currentPage.width - item.left) * zoom
                        );
                        const editorWidth = Math.min(
                          Math.max(previewWidth * zoom, selected ? 60 : 150),
                          remainingWidth
                        );
                        const editorHeight = Math.max(
                          item.height * zoom,
                          previewFontSize * zoom * 1.5,
                          30
                        );
                        const editorTop = item.top * zoom;
                        return (
                          <React.Fragment key={item.id}>
                            {workspaceMode === "edit" && selected && showTextEditor ? (
                              <>
                                <textarea
                                  className="edit-pdf-inline-textarea"
                                  autoFocus
                                  aria-label="Edit text on PDF page"
                                  value={editingText}
                                  style={{
                                    left: `${item.left * zoom}px`,
                                    top: `${editorTop}px`,
                                    width: `${editorWidth}px`,
                                    minHeight: `${Math.max(
                                      item.height * zoom,
                                      previewFontSize * zoom * 1.5,
                                      30
                                    )}px`,
                                    color: textColor,
                                    fontFamily: getBrowserFontFamily(
                                      selected ? textFontFamily : item.fontFamily || item.fontFamilyKey
                                    ),
                                    fontWeight: textBold ? 700 : 400,
                                    fontStyle: textItalic ? "italic" : "normal",
                                    textDecoration: textUnderline ? "underline" : "none",
                                    textAlign: textAlignment,
                                    fontSize: `${previewFontSize * zoom}px`,
                                    lineHeight: 1.2,
                                  }}
                                  onChange={(event) => {
                                    setEditingText(event.target.value);
                                    setError("");
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      closeInlineEditor();
                                    } else if (
                                      event.key === "Enter" &&
                                      (event.ctrlKey || event.metaKey)
                                    ) {
                                      event.preventDefault();
                                      applyEdit();
                                    }
                                  }}
                                />
                                <div
                                  className="edit-pdf-text-selection-frame"
                                  style={{
                                    left: `${item.left * zoom}px`,
                                    top: `${editorTop}px`,
                                    width: `${editorWidth}px`,
                                    height: `${editorHeight}px`,
                                  }}
                                  aria-label="Selected PDF text bounds"
                                >
                                  {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
                                    <button
                                      key={handle}
                                      type="button"
                                      className={`edit-pdf-text-resize-handle is-${handle}`}
                                      aria-label={`Resize selected text ${handle}`}
                                      onPointerDown={(event) =>
                                        handleTextResizePointerDown(
                                          event,
                                          item,
                                          currentPage,
                                          handle
                                        )
                                      }
                                    />
                                  ))}
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                className={[
                                  "edit-pdf-text-hitbox",
                                  selected ? "is-selected" : "",
                                  item.edited || previewing
                                    ? "has-edit"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={{
                                  left: `${item.left * zoom}px`,
                                  top: `${item.top * zoom}px`,
                                  width: `${previewWidth * zoom}px`,
                                  height: `${Math.max(
                                    item.height,
                                    previewFontSize * 1.25
                                  ) * zoom}px`,
                                  background:
                                    item.edited || previewing
                                      ? "#ffffff"
                                      : undefined,
                                  color:
                                    item.edited || previewing
                                      ? previewColor
                                      : "transparent",
                                  fontFamily: getBrowserFontFamily(
                                    selected ? textFontFamily : item.fontFamily || item.fontFamilyKey
                                  ),
                                  fontWeight:
                                    (selected ? textBold : item.isBold)
                                      ? 700
                                      : 400,
                                  fontStyle:
                                    (selected ? textItalic : item.isItalic)
                                      ? "italic"
                                      : "normal",
                                  fontSize: `${previewFontSize * zoom}px`,
                                  lineHeight: 1.1,
                                  textDecoration: selected && textUnderline ? "underline" : "none",
                                  textAlign: selected ? textAlignment : item.alignment || "left",
                                  zIndex: selected ? 2 : 1,
                                  pointerEvents:
                                    workspaceMode === "edit" ? "auto" : "none",
                                }}
                                onClick={
                                  workspaceMode === "edit"
                                    ? () => beginEditing(item, currentPage)
                                    : undefined
                                }
                                tabIndex={workspaceMode === "edit" ? 0 : -1}
                                aria-hidden={workspaceMode !== "edit"}
                                title={workspaceMode === "edit" ? `Edit: ${displayedText}` : undefined}
                                aria-label={workspaceMode === "edit" ? `Edit text: ${displayedText}` : undefined}
                              >
                                <span>{displayedText}</span>
                              </button>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {addedTexts
                        .filter(
                          (item) => item.pageIndex === currentPage.pageNumber - 1
                        )
                        .map((item) => {
                          const isEditingAddedText =
                            showTextEditor && selectedAddedTextId === item.id;
                          const addedTextWidth = Math.min(
                            Math.max(
                              item.width
                                ? item.width * zoom
                                : estimateTextWidth(
                                    item.text,
                                    item.fontSize * zoom,
                                    item.fontFamily,
                                    item.isBold,
                                    item.isItalic
                                  ) + 16,
                              120
                            ),
                            Math.max(24, (currentPage.width - item.left) * zoom)
                          );
                          return (
                            <React.Fragment key={item.id}>
                              <div
                                className={`edit-pdf-added-text ${
                                  selectedAddedTextId === item.id
                                    ? "is-selected"
                                    : ""
                                } ${
                                  isEditingAddedText ? "is-editing" : ""
                                }`}
                                style={{
                                  left: `${item.left * zoom}px`,
                                  top: `${item.top * zoom}px`,
                                  width: `${addedTextWidth}px`,
                                  fontSize: `${item.fontSize * zoom}px`,
                                  color: item.color,
                                  backgroundColor: "transparent",
                                  opacity: (item.opacity ?? 100) / 100,
                                  textAlign: item.alignment || "left",
                                  fontFamily: getBrowserFontFamily(
                                    item.fontFamily
                                  ),
                                  fontWeight: item.isBold ? 700 : 400,
                                  fontStyle: item.isItalic ? "italic" : "normal",
                                  textDecoration: item.isUnderline
                                    ? "underline"
                                    : "none",
                                  fontSynthesis: "style",
                                  cursor: panMode
                                    ? "grab"
                                    : addTextMode
                                    ? "crosshair"
                                    : "default",
                                }}
                                onPointerDown={
                                  isEditingAddedText
                                    ? undefined
                                    : (event) =>
                                        handleAddedTextPointerDown(
                                          event,
                                          item,
                                          currentPage
                                        )
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (panMode) return;
                                  setSelectedAddedTextId(item.id);
                                  setSelectedTextId(null);
                                  setPageNumber(currentPage.pageNumber);
                                  setShowTextEditor(true);
                                  setWorkspaceMode("annotate");
                                  setAnnotationTool("text");
                                  setPanMode(false);
                                  setAddTextMode(false);
                                }}
                                title="Select or drag added text"
                              >
                                {isEditingAddedText ? (
                                  <textarea
                                    className="edit-pdf-inline-added-input"
                                    autoFocus
                                    aria-label="Edit added text on PDF page"
                                    value={item.text}
                                    style={{ textAlign: item.alignment || "left" }}
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    onChange={(event) =>
                                      updateAddedText(item.id, {
                                        text: event.target.value,
                                      })
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        setShowTextEditor(false);
                                      } else if (
                                        event.key === "Enter" &&
                                        (event.ctrlKey || event.metaKey)
                                      ) {
                                        event.preventDefault();
                                        setShowTextEditor(false);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span
                                    className="edit-pdf-added-text-content"
                                    style={{
                                      backgroundColor: item.highlightEnabled
                                        ? item.highlightColor || "#fff2a8"
                                        : "transparent",
                                      WebkitBoxDecorationBreak: "clone",
                                      boxDecorationBreak: "clone",
                                    }}
                                  >
                                    {item.text}
                                  </span>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        })}

                    </div>
                  )}
                </div>
                ))}
              </div>
              <div className="edit-pdf-floating-navigation" role="group" aria-label="PDF page and zoom controls">
                <button
                  type="button"
                  aria-label="Previous page"
                  title="Previous page"
                  onClick={() => changePage(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                >
                  <ChevronUp size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  title="Next page"
                  onClick={() => changePage(pageNumber + 1)}
                  disabled={pageNumber >= pages.length}
                >
                  <ChevronDown size={17} />
                </button>
                <input
                  type="number"
                  min="1"
                  max={pages.length}
                  aria-label="Current page"
                  value={pageNumber}
                  onChange={(event) => {
                    if (event.target.value !== "") {
                      changePage(Number(event.target.value));
                    }
                  }}
                />
                <span className="edit-pdf-floating-page-total">/ {pages.length}</span>
                <span className="edit-pdf-floating-divider" />
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  onClick={() => setZoom((value) => clamp(value - 0.1, 0.2, 2))}
                  disabled={zoom <= 0.2}
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  onClick={() => setZoom((value) => clamp(value + 0.1, 0.2, 2))}
                  disabled={zoom >= 2}
                >
                  <ZoomIn size={18} />
                </button>
                <select
                  aria-label="Zoom level"
                  value={String(zoom)}
                  onChange={(event) => setZoom(Number(event.target.value))}
                >
                  {!Array.from({ length: 19 }, (_, index) =>
                    (index + 2) / 10
                  ).some((value) => Math.abs(value - zoom) < 0.001) && (
                    <option value={zoom}>{Math.round(zoom * 100)}%</option>
                  )}
                  {Array.from({ length: 19 }, (_, index) => {
                    const value = (index + 2) / 10;
                    return (
                      <option key={value} value={value}>
                        {Math.round(value * 100)}%
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  aria-label="Fit page width"
                  title="Fit page width"
                  onClick={fitWidthToViewer}
                >
                  <MoveHorizontal size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Fit page to viewer"
                  title="Fit page to viewer"
                  onClick={fitPageToViewer}
                >
                  <Maximize size={17} />
                </button>
                <div className="edit-pdf-view-settings">
                  <button
                    type="button"
                    aria-label="View settings"
                    title="View settings"
                    aria-expanded={showViewSettings}
                    onClick={() => setShowViewSettings((open) => !open)}
                  >
                    <Settings size={17} />
                  </button>
                  {showViewSettings && (
                    <div className="edit-pdf-view-settings-menu" role="menu" aria-label="View settings">
                      <button type="button" role="menuitem" onClick={() => { fitWidthToViewer(); setShowViewSettings(false); }}>
                        Fit width
                      </button>
                      <button type="button" role="menuitem" onClick={() => { fitPageToViewer(); setShowViewSettings(false); }}>
                        Fit page
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setZoom(1); setShowViewSettings(false); }}>
                        Reset zoom
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="edit-pdf-sidebar epui-right-sidebar">
              {workspaceMode === "edit" ? (
                <div className="edit-pdf-edit-sidebar">
                  <h2>Text Styles</h2>
                  <div className="edit-pdf-style-selectors">
                    <select
                      aria-label="Text font"
                      value={selectedText ? textFontFamily : ""}
                      disabled={!selectedText}
                      onChange={(event) => setTextFontFamily(event.target.value)}
                    >
                      <option value="" disabled>Font</option>
                      <option value="Arial">Arial</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                    <select
                      aria-label="Text size"
                      value={fontSize}
                      disabled={!selectedText}
                      onChange={(event) =>
                        setFontSize(clamp(Number(event.target.value), 5, 96))
                      }
                    >
                      {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                      {!([8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].includes(Math.round(fontSize))) && (
                        <option value={fontSize}>{fontSize}</option>
                      )}
                    </select>
                  </div>

                  <div className="edit-pdf-style-button-row" role="toolbar" aria-label="Text formatting">
                    <button type="button" className={textBold ? "is-active" : ""} aria-label="Bold" disabled={!selectedText} onClick={() => setTextBold((value) => !value)}><Bold size={20} /></button>
                    <button type="button" className={textItalic ? "is-active" : ""} aria-label="Italic" disabled={!selectedText} onClick={() => setTextItalic((value) => !value)}><Italic size={20} /></button>
                    <button type="button" className={textUnderline ? "is-active" : ""} aria-label="Underline" disabled={!selectedText} onClick={() => setTextUnderline((value) => !value)}><Underline size={20} /></button>
                    <label className="edit-pdf-style-color-button" title="Text colour">
                      <span>A</span>
                      <input type="color" aria-label="Text colour" value={textColor} disabled={!selectedText} onChange={(event) => setTextColor(event.target.value)} />
                    </label>
                  </div>

                  <div className="edit-pdf-style-button-row edit-pdf-style-alignments" role="group" aria-label="Text alignment">
                    <button type="button" className={textAlignment === "left" ? "is-active" : ""} aria-label="Align left" disabled={!selectedText} onClick={() => setTextAlignment("left")}><AlignLeft size={20} /></button>
                    <button type="button" className={textAlignment === "center" ? "is-active" : ""} aria-label="Align center" disabled={!selectedText} onClick={() => setTextAlignment("center")}><AlignCenter size={20} /></button>
                    <button type="button" className={textAlignment === "right" ? "is-active" : ""} aria-label="Align right" disabled={!selectedText} onClick={() => setTextAlignment("right")}><AlignRight size={20} /></button>
                  </div>

                  <div className="edit-pdf-style-link">
                    <button type="button" aria-label="Add link" disabled={!selectedText} className={showLinkEditor ? "is-active" : ""} onClick={() => setShowLinkEditor((open) => !open)}><Link2 size={20} /></button>
                    {showLinkEditor && (
                      <input
                        type="url"
                        aria-label="Selected text link"
                        placeholder="https://example.com"
                        value={selectedTextLink}
                        disabled={!selectedText}
                        onChange={(event) => setSelectedTextLink(event.target.value)}
                      />
                    )}
                  </div>

                  <div className="edit-pdf-style-divider" />
                  <h3>Current Color</h3>
                  <div className="edit-pdf-current-color-row">
                    <button type="button" className="edit-pdf-color-swatch is-current" aria-label={`Current color ${textColor}`} style={{ "--swatch-color": textColor }} disabled={!selectedText} onClick={() => setTextColor(textColor)} />
                    <button type="button" aria-label="Copy current color" title="Copy current color" disabled={!selectedText} onClick={copyTextColor}><Copy size={18} /></button>
                  </div>

                  <h3>Custom Colors</h3>
                  <div className="edit-pdf-custom-color-row">
                    {customTextColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`edit-pdf-color-swatch ${textColor === color ? "is-current" : ""}`}
                        aria-label={`Select custom color ${color}`}
                        style={{ "--swatch-color": color }}
                        disabled={!selectedText}
                        onClick={() => setTextColor(color)}
                      />
                    ))}
                    <button type="button" aria-label="Add custom color" title="Add custom color" disabled={!selectedText} onClick={() => customColorInputRef.current?.click()}><PlusCircle size={21} /></button>
                    <input ref={customColorInputRef} className="edit-pdf-hidden-color-input" type="color" aria-label="Choose a custom color" onChange={addCustomTextColor} />
                    <button type="button" aria-label="Remove current custom color" title="Remove current custom color" disabled={!selectedText || !customTextColors.includes(textColor)} onClick={() => setCustomTextColors((colors) => colors.filter((color) => color !== textColor))}><Trash2 size={19} /></button>
                  </div>

                  <div className="edit-pdf-style-divider" />
                  <div className="edit-pdf-style-history" role="group" aria-label="Edit history">
                    <button type="button" aria-label="Undo edit" title="Undo" disabled={!editHistoryRef.current.length} onClick={undoPdfEdit}><Undo2 size={22} /></button>
                    <button type="button" aria-label="Redo edit" title="Redo" disabled={!editRedoHistoryRef.current.length} onClick={redoPdfEdit}><Redo2 size={22} /></button>
                  </div>
                  {selectedText && (
                    <div className="edit-pdf-selected-text-actions" role="group" aria-label="Selected text actions">
                      <button type="button" aria-label="Restore original text" title="Restore original text" onClick={undoSelectedEdit}><RotateCcw size={16} /></button>
                      <button type="button" aria-label="Cancel text edit" title="Cancel text edit" onClick={closeInlineEditor}><X size={16} /></button>
                      <button type="button" aria-label="Delete selected text" title="Delete selected text" onClick={deleteSelectedText}><Trash2 size={16} /></button>
                    </div>
                  )}
                  <span className="edit-pdf-visually-hidden" aria-live="polite">{historyVersion}</span>
                  <button
                    type="button"
                    className="edit-pdf-save-changes"
                    onClick={saveChanges}
                    disabled={saving || loading}
                  >
                    {saving ? "Preparing download…" : "Download PDF"}
                    {!saving && <Download size={20} />}
                  </button>
                </div>
              ) : (
                <div className="edit-pdf-default-sidebar">
                  <h2>Edit PDF</h2>
                  <div className="edit-pdf-text-sidebar-note">
                    <Info size={18} />
                    <span>Use the toolbar to modify or add text, upload images, and annotate with ease.</span>
                  </div>
                  <button
                    type="button"
                    className="edit-pdf-save-changes"
                    onClick={saveChanges}
                    disabled={saving || loading}
                  >
                    {saving ? "Preparing download…" : "Download PDF"}
                    {!saving && <Download size={20} />}
                  </button>
                </div>
              )}
</aside>
          </div>
        </section>
      )}

      {error && (
        <div className="edit-pdf-message is-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {file && (
        <div className="edit-pdf-bottom-actions">
          <button
            type="button"
            className="edit-pdf-secondary-button"
            onClick={resetEditor}
            disabled={saving || loading}
          >
            <RotateCcw size={16} />
            Start over
          </button>
        </div>
      )}

      <section className="edit-pdf-how">
        <h2>How to edit existing PDF text</h2>

        <div className="edit-pdf-steps">
          <article>
            <span>01</span>
            <h3>Upload your PDF</h3>
            <p>Choose a text-based PDF from your device.</p>
          </article>

          <article>
            <span>02</span>
            <h3>Select the text</h3>
            <p>Click the text on the page or choose it from the text list.</p>
          </article>

          <article>
            <span>03</span>
            <h3>Apply and download</h3>
            <p>Replace the text and export your edited PDF.</p>
          </article>
        </div>
      </section>

      <p className="edit-pdf-disclaimer">
        <ShieldCheck size={16} />
        Processing is done in your browser. Scanned PDFs need OCR, and edits
        are visual replacements rather than secure redactions.
      </p>
    </main>
  );
}

export default EditPDF;