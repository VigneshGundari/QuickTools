import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Pencil,
  LoaderCircle,
  AlertCircle,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
  if (isBold) return "bold";
  if (isItalic) return "italic";

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

function EditPDF() {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfJsDocumentRef = useRef(null);
  const originalBytesRef = useRef(null);
  const pageRecordsRef = useRef([]);
  const editCounterRef = useRef(0);

  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [textColor, setTextColor] = useState("#000000");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showTextList, setShowTextList] = useState(true);

  const currentPage = pages[pageNumber - 1];

  const selectedText = currentPage?.items?.find(
    (item) => item.id === selectedTextId
  );

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const resetEditor = () => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // The render may already have completed.
      }

      renderTaskRef.current = null;
    }

    if (pdfJsDocumentRef.current) {
      pdfJsDocumentRef.current.destroy().catch(() => {});
      pdfJsDocumentRef.current = null;
    }

    originalBytesRef.current = null;
    pageRecordsRef.current = [];
    editCounterRef.current = 0;

    setFile(null);
    setPages([]);
    setPageNumber(1);
    setZoom(1);
    setSelectedTextId(null);
    setEditingText("");
    setFontSize(12);
    setTextColor("#000000");
    setError("");
    setSuccess("");
    setSearch("");
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
      try {
        await pdfJsDocumentRef.current.destroy();
      } catch {
        // Ignore errors from closing the previous document.
      }

      pdfJsDocumentRef.current = null;
    }

    setLoading(true);
    setFile(selectedFile);
    setPages([]);
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
      } else {
        setSuccess(
          `PDF loaded. Found ${editableCount} text items across ${records.length} page${records.length === 1 ? "" : "s"}. Click a text item to edit it.`
        );
      }
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

  const renderCurrentPage = useCallback(async () => {
    if (!pdfJsDocumentRef.current || !currentPage || !canvasRef.current) {
      return;
    }

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // The previous render may already have completed.
      }

      renderTaskRef.current = null;
    }

    try {
      const pdfPage = await pdfJsDocumentRef.current.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
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
        transform:
          ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
      });

      renderTaskRef.current = task;

      await task.promise;

      if (renderTaskRef.current === task) {
        renderTaskRef.current = null;
      }
    } catch (renderError) {
      if (renderError?.name !== "RenderingCancelledException") {
        console.error("Edit PDF render error:", renderError);
        setError("This PDF page could not be displayed.");
      }
    }
  }, [currentPage, pageNumber, zoom]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cleanup errors.
        }
      }

      if (pdfJsDocumentRef.current) {
        pdfJsDocumentRef.current.destroy().catch(() => {});
      }
    };
  }, []);

  const updatePageItem = (itemId, changes) => {
    setPages((previousPages) => {
      const nextPages = previousPages.map((page) => {
        if (page.pageNumber !== pageNumber) return page;

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

  const beginEditing = (item) => {
    setSelectedTextId(item.id);
    setEditingText(item.replacementText);
    setFontSize(Math.round(item.fontSize * 10) / 10);
    setTextColor(item.color || "#000000");
    setError("");
    setSuccess("");
  };

  const cancelEditing = () => {
    setSelectedTextId(null);
    setEditingText("");
  };

  const applyEdit = () => {
    if (!selectedText) return;

    if (!editingText.trim()) {
      setError(
        "Replacement text cannot be empty. Use Undo to keep the original."
      );
      return;
    }

    updatePageItem(selectedText.id, {
      replacementText: editingText,
      fontSize: clamp(
        Number(fontSize) || selectedText.fontSize,
        5,
        96
      ),
      color: textColor,
      edited: editingText !== selectedText.originalText,
    });

    setSelectedTextId(null);
    setEditingText("");
    setError("");
    setSuccess("Text change applied. Export the PDF to save your edits.");
  };

  const undoSelectedEdit = () => {
    if (!selectedText) return;

    updatePageItem(selectedText.id, {
      replacementText: selectedText.originalText,
      fontSize: selectedText.fontSize,
      color: "#000000",
      edited: false,
    });

    setSelectedTextId(null);
    setEditingText("");
    setError("");
    setSuccess("The selected text was restored to its original value.");
  };

  const changePage = (nextPage) => {
    setPageNumber(clamp(nextPage, 1, pages.length || 1));
    setSelectedTextId(null);
    setEditingText("");
  };

  const exportPdf = async () => {
    if (!originalBytesRef.current || !pages.length) {
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

      for (const pageRecord of pages) {
        const pdfPage = pdfPages[pageRecord.pageNumber - 1];

        if (!pdfPage) continue;

        const { width: pageWidth, height: pageHeight } = pdfPage.getSize();

        const scaleX = pageWidth / pageRecord.width;
        const scaleY = pageHeight / pageRecord.height;

        for (const item of pageRecord.items) {
          if (!item.edited || item.replacementText === item.originalText) {
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

          const fontKey = [
            item.fontFamilyKey || "",
            item.fontFamily || "",
            item.fontName || "",
            item.isBold ? "bold" : "regular",
            item.isItalic ? "italic" : "normal",
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

          const replacement = item.replacementText;
          const availableWidth = Math.max(boxWidth, 1);

          let finalFontSize = fontSizeForPdf;
          let textWidth = font.widthOfTextAtSize(
            replacement,
            finalFontSize
          );

          // Keep text within the original text item's width.
          if (textWidth > availableWidth && textWidth > 0) {
            finalFontSize *= availableWidth / textWidth;
            finalFontSize = Math.max(finalFontSize, 4);

            textWidth = font.widthOfTextAtSize(
              replacement,
              finalFontSize
            );
          }

          const fontMetrics = font.heightAtSize(finalFontSize, {
            descender: true,
          });

          const textY = y + (boxHeight - fontMetrics) / 2;

          pdfPage.drawText(replacement, {
            x: Math.max(0, x),
            y: Math.max(0, textY),
            size: finalFontSize,
            font,
            color: hexToRgb(item.color),
            maxWidth: availableWidth,
            lineHeight: finalFontSize * 1.15,
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

      setSuccess("Your edited PDF has been exported.");
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
    <main className="edit-pdf-page">
      <section className="edit-pdf-heading">
        <div className="edit-pdf-heading-icon">
          <Pencil size={23} />
        </div>

        <div>
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

          <button
            type="button"
            className="edit-pdf-dropzone"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="edit-pdf-spin" size={38} />
            ) : (
              <Upload size={38} />
            )}

            <strong>
              {loading ? "Loading your PDF…" : "Select a PDF file"}
            </strong>

            <span>
              Choose a PDF from your computer · Maximum 50 MB
            </span>

            <span className="edit-pdf-browse-label">Browse files</span>
          </button>

          <div className="edit-pdf-privacy-note">
            <ShieldCheck size={19} />
            <span>Your PDF is processed in your browser.</span>
          </div>
        </section>
      )}

      {file && pages.length > 0 && (
        <section className="edit-pdf-workspace">
          <header className="edit-pdf-toolbar">
            <div className="edit-pdf-file-title">
              <FileText size={19} />
              <span title={file.name}>{file.name}</span>
            </div>

            <div className="edit-pdf-toolbar-actions">
              <button
                type="button"
                className="edit-pdf-tool-button"
                onClick={() =>
                  setZoom((value) => clamp(value - 0.1, 0.5, 2))
                }
                disabled={zoom <= 0.5}
                title="Zoom out"
              >
                <ZoomOut size={17} />
              </button>

              <span className="edit-pdf-zoom-value">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                className="edit-pdf-tool-button"
                onClick={() =>
                  setZoom((value) => clamp(value + 0.1, 0.5, 2))
                }
                disabled={zoom >= 2}
                title="Zoom in"
              >
                <ZoomIn size={17} />
              </button>

              <button
                type="button"
                className="edit-pdf-tool-button"
                onClick={() => fileInputRef.current?.click()}
                title="Open another PDF"
              >
                <Upload size={17} />
              </button>

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

              <button
                type="button"
                className="edit-pdf-export-button"
                onClick={exportPdf}
                disabled={saving || loading}
              >
                {saving ? (
                  <LoaderCircle className="edit-pdf-spin" size={17} />
                ) : (
                  <Download size={17} />
                )}

                {saving ? "Exporting…" : "Download PDF"}
              </button>
            </div>
          </header>

          <div className="edit-pdf-workspace-body">
            <div className="edit-pdf-document-area">
              <div className="edit-pdf-page-navigation">
                <button
                  type="button"
                  className="edit-pdf-tool-button"
                  onClick={() => changePage(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                  title="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                <span>
                  Page <strong>{pageNumber}</strong> of {pages.length}
                </span>

                <button
                  type="button"
                  className="edit-pdf-tool-button"
                  onClick={() => changePage(pageNumber + 1)}
                  disabled={pageNumber >= pages.length}
                  title="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="edit-pdf-canvas-scroll">
                <div
                  className="edit-pdf-canvas-wrap"
                  style={{
                    width: currentPage
                      ? currentPage.width * zoom
                      : "auto",
                    height: currentPage
                      ? currentPage.height * zoom
                      : "auto",
                  }}
                >
                  <canvas ref={canvasRef} />

                  {currentPage && (
                    <div
                      className="edit-pdf-text-overlay"
                      style={{
                        width: currentPage.width * zoom,
                        height: currentPage.height * zoom,
                      }}
                    >
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

                        const previewWidth = Math.max(
                          item.width,
                          estimateTextWidth(
                            displayedText,
                            previewFontSize * zoom,
                            item.fontFamily,
                            item.isBold,
                            item.isItalic
                          ) / zoom
                        );

                        return (
                          <button
                            key={item.id}
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
                              height: `${
                                Math.max(
                                  item.height,
                                  previewFontSize * 1.25
                                ) * zoom
                              }px`,
                              background:
                                item.edited || previewing
                                  ? "#ffffff"
                                  : undefined,
                              color:
                                item.edited || previewing
                                  ? previewColor
                                  : "transparent",
                              fontFamily: getBrowserFontFamily(
                                item.fontFamily || item.fontFamilyKey
                              ),
                              fontWeight: item.isBold ? 700 : 400,
                              fontStyle: item.isItalic
                                ? "italic"
                                : "normal",
                              fontSize: `${previewFontSize * zoom}px`,
                              lineHeight: 1.1,
                              zIndex: selected ? 2 : 1,
                            }}
                            onClick={() => beginEditing(item)}
                            title={`Edit: ${displayedText}`}
                            aria-label={`Edit text: ${displayedText}`}
                          >
                            <span>{displayedText}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="edit-pdf-canvas-help">
                <MousePointer2 size={16} />
                Click an existing text item on the page to edit it.
              </div>
            </div>

            <aside className="edit-pdf-sidebar">
              {selectedText ? (
                <div className="edit-pdf-edit-panel">
                  <div className="edit-pdf-panel-heading">
                    <div>
                      <span className="edit-pdf-eyebrow">
                        TEXT EDITOR
                      </span>
                      <h2>Edit selected text</h2>
                    </div>

                    <button
                      type="button"
                      className="edit-pdf-icon-button"
                      onClick={cancelEditing}
                      title="Close editor"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <label
                    className="edit-pdf-field-label"
                    htmlFor="edit-pdf-text"
                  >
                    Replacement text
                  </label>

                  <textarea
                    id="edit-pdf-text"
                    className="edit-pdf-textarea"
                    value={editingText}
                    onChange={(event) => {
                      const value = event.target.value;

                      setEditingText(value);

                      updatePageItem(selectedText.id, {
                        replacementText: value,
                        fontSize: clamp(
                          Number(fontSize) || selectedText.fontSize,
                          5,
                          96
                        ),
                        color: textColor,
                        edited: value !== selectedText.originalText,
                      });

                      setError("");
                      setSuccess("");
                    }}
                    rows={4}
                    autoFocus
                  />

                  <div className="edit-pdf-field-row">
                    <div>
                      <label
                        className="edit-pdf-field-label"
                        htmlFor="edit-pdf-font-size"
                      >
                        Font size
                      </label>

                      <input
                        id="edit-pdf-font-size"
                        className="edit-pdf-input"
                        type="number"
                        min="5"
                        max="96"
                        step="0.5"
                        value={fontSize}
                        onChange={(event) => {
                          const value = event.target.value;

                          setFontSize(
                            value === "" ? "" : Number(value)
                          );

                          const numericSize = Number(value);

                          if (
                            value !== "" &&
                            Number.isFinite(numericSize) &&
                            numericSize >= 5 &&
                            numericSize <= 96
                          ) {
                            updatePageItem(selectedText.id, {
                              fontSize: numericSize,
                              color: textColor,
                              replacementText: editingText,
                              edited:
                                editingText !== selectedText.originalText,
                            });
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label
                        className="edit-pdf-field-label"
                        htmlFor="edit-pdf-text-color"
                      >
                        Text color
                      </label>

                      <input
                        id="edit-pdf-text-color"
                        className="edit-pdf-color-input"
                        type="color"
                        value={textColor}
                        onChange={(event) => {
                          const value = event.target.value;

                          setTextColor(value);

                          updatePageItem(selectedText.id, {
                            color: value,
                            fontSize: clamp(
                              Number(fontSize) ||
                                selectedText.fontSize,
                              5,
                              96
                            ),
                            replacementText: editingText,
                            edited:
                              editingText !== selectedText.originalText,
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="edit-pdf-original-box">
                    <span>Original text</span>
                    <p>{selectedText.originalText}</p>
                  </div>

                  <button
                    type="button"
                    className="edit-pdf-primary-button"
                    onClick={applyEdit}
                  >
                    <Check size={17} />
                    Apply change
                  </button>

                  <button
                    type="button"
                    className="edit-pdf-secondary-button"
                    onClick={undoSelectedEdit}
                  >
                    <RotateCcw size={16} />
                    Restore original text
                  </button>

                  <p className="edit-pdf-small-note">
                    This editor replaces the selected text visually. It does
                    not reflow nearby paragraphs automatically.
                  </p>
                </div>
              ) : (
                <>
                  <div className="edit-pdf-panel-heading">
                    <div>
                      <span className="edit-pdf-eyebrow">
                        DOCUMENT
                      </span>
                      <h2>Text on this page</h2>
                    </div>

                    <button
                      type="button"
                      className="edit-pdf-icon-button"
                      onClick={() =>
                        setShowTextList((value) => !value)
                      }
                      title={
                        showTextList
                          ? "Hide text list"
                          : "Show text list"
                      }
                    >
                      {showTextList ? (
                        <X size={17} />
                      ) : (
                        <Pencil size={17} />
                      )}
                    </button>
                  </div>

                  <div className="edit-pdf-search">
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Find text on this page"
                      aria-label="Find text on this page"
                    />
                  </div>

                  <div className="edit-pdf-item-count">
                    {visibleItems.length} text item
                    {visibleItems.length === 1 ? "" : "s"}

                    {currentPage?.items.some((item) => item.edited) && (
                      <span>
                        {
                          currentPage.items.filter((item) => item.edited)
                            .length
                        }{" "}
                        changed
                      </span>
                    )}
                  </div>

                  {showTextList && (
                    <div className="edit-pdf-text-list">
                      {visibleItems.length ? (
                        visibleItems.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className={[
                              "edit-pdf-text-list-item",
                              item.edited ? "has-edit" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => beginEditing(item)}
                          >
                            <span>{item.replacementText}</span>
                            {item.edited && <Check size={15} />}
                          </button>
                        ))
                      ) : (
                        <p className="edit-pdf-empty-list">
                          No matching text on this page.
                        </p>
                      )}
                    </div>
                  )}
                </>
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

      {success && (
        <div className="edit-pdf-message is-success" role="status">
          <Check size={18} />
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
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