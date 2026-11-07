import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  ArrowDownToLine,
  Check,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import QuickToolPage from "../components/QuickToolPage";

const IMAGE_TOOLS = {
  "resize-image": {
    title: "Resize Image",
    description: "Resize one or more images to the dimensions you need.",
    intro: "Resize your images",
    action: "Resize images",
  },
  "compress-image": {
    title: "Compress Image",
    description: "Reduce the file size of your images in a few clicks.",
    intro: "Compress your images",
    action: "Compress images",
  },
  "crop-image": {
    title: "Crop Image",
    description: "Select the part of each image you want to keep.",
    intro: "Crop your images",
    action: "Crop images",
  },
  "convert-image": {
    title: "Convert Image",
    description: "Convert images to PNG, JPG, or WebP format.",
    intro: "Convert your images",
    action: "Convert images",
  },
  "add-text-to-image": {
    title: "Add Text to Image",
    description: "Add a caption to your images and download the finished files.",
    intro: "Add text to your images",
    action: "Add text",
  },
  "remove-background": {
    title: "Remove Background",
    description: "Make a plain, solid-color background transparent.",
    intro: "Remove image backgrounds",
    action: "Remove background",
  },
};

const IMAGE_STEPS = [
  { title: "Upload images", description: "Select or drag in one or more images from your device." },
  { title: "Choose your settings", description: "Adjust the options for this tool and preview the changes." },
  { title: "Process and download", description: "Process your images and download them individually or together." },
];

const IMAGE_FAQS = [
  { question: "Can I process more than one image?", answer: "Yes. Add up to 20 images and apply the same settings to the whole batch. Download the finished files one by one or together as a ZIP." },
  { question: "Are image files uploaded?", answer: "No. Image processing happens locally in your browser. Your selected images are not sent to QuickTools." },
  { question: "What is the maximum file size?", answer: "Each image can be up to 25 MB and 25 megapixels. Larger images may use too much memory in your browser." },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_BATCH_SIZE = 20;
const FORMATS = {
  png: { mime: "image/png", extension: "png" },
  jpg: { mime: "image/jpeg", extension: "jpg" },
  webp: { mime: "image/webp", extension: "webp" },
};

function makeId(file) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not open ${file.name}. Try another image.`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The image could not be exported in that format.")),
      mime,
      quality
    );
  });
}

function safeStem(filename) {
  return filename.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-") || "quicktools-image";
}

function averageColor(data, width, x, y) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  const height = Math.floor(data.length / 4 / width);
  for (let row = y; row < Math.min(y + 5, height); row += 1) {
    for (let column = x; column < Math.min(x + 5, width); column += 1) {
      const offset = (row * width + column) * 4;
      red += data[offset];
      green += data[offset + 1];
      blue += data[offset + 2];
      count += 1;
    }
  }
  return [red / count, green / count, blue / count];
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function cropFromPoints(start, end, dimensions, aspect) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  let width = Math.abs(end.x - start.x);
  let height = Math.abs(end.y - start.y);
  if (aspect) {
    const desired = Number(aspect);
    height = width * dimensions.width / (desired * dimensions.height);
    if (height > 100 - top) {
      height = 100 - top;
      width = height * dimensions.height * desired / dimensions.width;
    }
    if (width > 100 - left) {
      width = 100 - left;
      height = width * dimensions.width / (desired * dimensions.height);
    }
  }
  return {
    x: Math.max(0, Math.min(100, left)),
    y: Math.max(0, Math.min(100, top)),
    width: Math.max(0, Math.min(width, 100 - left)),
    height: Math.max(0, Math.min(height, 100 - top)),
  };
}

export default function ImageTools({ tool }) {
  const config = IMAGE_TOOLS[tool];
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const dragStartRef = useRef(null);
  const objectUrlsRef = useRef(new Set());
  const [files, setFiles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [results, setResults] = useState([]);
  const [percent, setPercent] = useState(50);
  const [customDimensions, setCustomDimensions] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(75);
  const [compressionPreset, setCompressionPreset] = useState("balanced");
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [cropAspect, setCropAspect] = useState("");
  const [caption, setCaption] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(48);
  const [textPosition, setTextPosition] = useState("bottom");
  const [sensitivity, setSensitivity] = useState(45);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedFile = files.find((item) => item.id === selectedId) || files[0];
  const selectedFormat = tool === "compress-image" || tool === "remove-background" ? "png" : format;
  const compressionQuality = compressionPreset === "smallest"
    ? 48
    : compressionPreset === "best-quality"
      ? 90
      : quality;

  useEffect(() => () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
  }, []);

  function createTrackedUrl(blob) {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  }

  function revokeTrackedUrl(url) {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }

  function revokeResultUrls(items) {
    for (const item of items) {
      if (item.url) revokeTrackedUrl(item.url);
    }
  }

  function clearResults() {
    revokeResultUrls(results);
    setResults([]);
    setProgress("");
    setMessage("");
  }

  function chooseFiles(fileList) {
    const candidates = Array.from(fileList || []);
    if (!candidates.length) return;
    setError("");
    clearResults();
    const additions = [];
    const rejected = [];
    for (const file of candidates) {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name}: unsupported file type`);
      } else if (!file.size || file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: must be between 1 byte and 25 MB`);
      } else if (files.length + additions.length >= MAX_BATCH_SIZE) {
        rejected.push(`${file.name}: a maximum of ${MAX_BATCH_SIZE} images is allowed`);
      } else if (files.some((item) => item.file.name === file.name && item.file.size === file.size) ||
        additions.some((item) => item.file.name === file.name && item.file.size === file.size)) {
        rejected.push(`${file.name}: already added`);
      } else {
        additions.push({ id: makeId(file), file, url: createTrackedUrl(file), width: 0, height: 0 });
      }
    }
    if (additions.length) {
      setFiles((previous) => [...previous, ...additions]);
      setSelectedId((previous) => previous || additions[0].id);
      if (selectedId) setSelectedId(selectedId);
      setCrop({ x: 0, y: 0, width: 100, height: 100 });
      setCropAspect("");
    }
    if (rejected.length) {
      setError(`${rejected.slice(0, 3).join(". ")}${rejected.length > 3 ? `. And ${rejected.length - 3} more file(s) were skipped.` : "."}`);
    }
  }

  function removeFile(id) {
    const removed = files.find((item) => item.id === id);
    if (removed) revokeTrackedUrl(removed.url);
    const remaining = files.filter((item) => item.id !== id);
    setFiles(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id || "");
    setError("");
    clearResults();
  }

  function clearFiles() {
    for (const item of files) revokeTrackedUrl(item.url);
    setFiles([]);
    setSelectedId("");
    setWidth("");
    setHeight("");
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
    setError("");
    clearResults();
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleImageLoaded(id, event) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight || naturalWidth * naturalHeight > MAX_IMAGE_PIXELS) {
      const filename = files.find((item) => item.id === id)?.file.name || "This image";
      removeFile(id);
      setError(`${filename} exceeds the 25-megapixel browser processing limit.`);
      return;
    }
    setFiles((previous) => previous.map((item) => item.id === id
      ? { ...item, width: naturalWidth, height: naturalHeight }
      : item));
    if (selectedId === id) {
      setWidth(String(naturalWidth));
      setHeight(String(naturalHeight));
    }
  }

  function selectFile(item) {
    setSelectedId(item.id);
    setWidth(String(item.width || ""));
    setHeight(String(item.height || ""));
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
    setError("");
  }

  function updateWidth(value) {
    setWidth(value);
    if (keepRatio && selectedFile?.width && value && Number.isFinite(Number(value))) {
      setHeight(String(Math.max(1, Math.round(Number(value) * selectedFile.height / selectedFile.width))));
    }
  }

  function updateHeight(value) {
    setHeight(value);
    if (keepRatio && selectedFile?.height && value && Number.isFinite(Number(value))) {
      setWidth(String(Math.max(1, Math.round(Number(value) * selectedFile.width / selectedFile.height))));
    }
  }

  function updateCropFromPointer(event) {
    if (!dragStartRef.current || !selectedFile?.width || !dropRef.current) return;
    const rect = dropRef.current.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)),
    };
    setCrop(cropFromPoints(dragStartRef.current, point, selectedFile, cropAspect));
  }

  function startCrop(event) {
    if (!selectedFile?.width) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)),
    };
    dragStartRef.current = point;
    setCrop({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  async function processOne(item, index) {
    const image = await loadImage(item.file);
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
      throw new Error(`${item.file.name} exceeds the 25-megapixel processing limit.`);
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: tool === "remove-background" });
    if (!context) throw new Error("Your browser could not prepare the image for editing.");
    const outputFormat = tool === "compress-image"
      ? "webp"
      : tool === "remove-background"
        ? "png"
        : format;
    const paintJpegBackground = () => {
      if (outputFormat === "jpg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    if (tool === "resize-image") {
      let outputWidth;
      let outputHeight;
      if (customDimensions) {
        outputWidth = Number(width);
        outputHeight = keepRatio
          ? Math.round(outputWidth * image.naturalHeight / image.naturalWidth)
          : Number(height);
      } else {
        outputWidth = Math.round(image.naturalWidth * percent / 100);
        outputHeight = Math.round(image.naturalHeight * percent / 100);
      }
      if (![outputWidth, outputHeight].every(Number.isInteger) || outputWidth < 1 || outputHeight < 1) {
        throw new Error("Enter valid output dimensions in pixels.");
      }
      if (outputWidth * outputHeight > MAX_IMAGE_PIXELS) {
        throw new Error(`${item.file.name}: output must be 25 megapixels or smaller.`);
      }
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      paintJpegBackground();
      context.drawImage(image, 0, 0, outputWidth, outputHeight);
    } else if (tool === "crop-image") {
      const left = Math.round(crop.x / 100 * image.naturalWidth);
      const top = Math.round(crop.y / 100 * image.naturalHeight);
      const cropWidth = Math.round(crop.width / 100 * image.naturalWidth);
      const cropHeight = Math.round(crop.height / 100 * image.naturalHeight);
      if (cropWidth < 1 || cropHeight < 1) throw new Error("Drag over the preview to select an area to crop.");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      paintJpegBackground();
      context.drawImage(image, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    } else {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      paintJpegBackground();
      context.drawImage(image, 0, 0);

      if (tool === "add-text-to-image") {
        if (!caption.trim()) throw new Error("Enter a caption before processing your images.");
        const fontSize = Math.min(Number(textSize), Math.max(12, canvas.width / 2));
        context.font = `700 ${fontSize}px Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineJoin = "round";
        context.strokeStyle = "rgba(0, 0, 0, 0.55)";
        context.lineWidth = Math.max(2, fontSize / 12);
        const x = canvas.width / 2;
        const y = textPosition === "top"
          ? fontSize * 1.5
          : textPosition === "center"
            ? canvas.height / 2
            : canvas.height - fontSize * 1.5;
        context.strokeText(caption, x, y, canvas.width * 0.9);
        context.fillStyle = textColor;
        context.fillText(caption, x, y, canvas.width * 0.9);
      } else if (tool === "remove-background") {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const corners = [
          averageColor(pixels, canvas.width, 0, 0),
          averageColor(pixels, canvas.width, Math.max(0, canvas.width - 5), 0),
          averageColor(pixels, canvas.width, 0, Math.max(0, canvas.height - 5)),
          averageColor(pixels, canvas.width, Math.max(0, canvas.width - 5), Math.max(0, canvas.height - 5)),
        ];
        const threshold = sensitivity * 2.2;
        const thresholdSquared = threshold * threshold;
        const featherLimit = threshold + 22;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          let nearestDistanceSquared = Infinity;
          for (const [red, green, blue] of corners) {
            const redDifference = pixels[offset] - red;
            const greenDifference = pixels[offset + 1] - green;
            const blueDifference = pixels[offset + 2] - blue;
            const distanceSquared = redDifference * redDifference +
              greenDifference * greenDifference + blueDifference * blueDifference;
            if (distanceSquared < nearestDistanceSquared) nearestDistanceSquared = distanceSquared;
          }
          if (nearestDistanceSquared <= thresholdSquared) {
            pixels[offset + 3] = 0;
          } else if (nearestDistanceSquared < featherLimit * featherLimit) {
            pixels[offset + 3] = Math.round(pixels[offset + 3] *
              (Math.sqrt(nearestDistanceSquared) - threshold) / 22);
          }
        }
        context.putImageData(imageData, 0, 0);
      }
    }

    const quality = tool === "compress-image" ? compressionQuality : 90;
    const blob = await canvasToBlob(
      canvas,
      FORMATS[outputFormat].mime,
      outputFormat === "png" ? undefined : quality / 100
    );
    if (blob.type !== FORMATS[outputFormat].mime) {
      throw new Error(`Your browser cannot export ${outputFormat.toUpperCase()} images. Choose another format.`);
    }
    const suffix = tool === "compress-image" ? "compressed" : tool;
    return {
      id: item.id,
      name: `${safeStem(item.file.name)}-${suffix}${files.length > 1 ? `-${index + 1}` : ""}.${FORMATS[outputFormat].extension}`,
      blob,
      url: createTrackedUrl(blob),
      originalSize: item.file.size,
    };
  }

  async function processImages() {
    if (!files.length || processing) return;
    clearResults();
    setProcessing(true);
    setError("");
    const completed = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        setProgress(`Processing image ${index + 1} of ${files.length}…`);
        completed.push(await processOne(files[index], index));
      }
      setResults(completed);
      setProgress("");
      setMessage(`${completed.length} ${completed.length === 1 ? "image is" : "images are"} ready to download.`);
    } catch (processingError) {
      revokeResultUrls(completed);
      setResults([]);
      setProgress("");
      setError(processingError.message || "The images could not be processed.");
    } finally {
      setProcessing(false);
    }
  }

  async function downloadAll() {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].name);
      return;
    }
    const zip = new JSZip();
    for (const result of results) zip.file(result.name, result.blob);
    const archive = await zip.generateAsync({ type: "blob", compression: "STORE" });
    downloadBlob(archive, `${tool}-images.zip`);
  }

  function downloadOne(result) {
    downloadBlob(result.blob, result.name);
  }

  const previewScale = selectedFile?.width
    ? Math.min(1, 680 / selectedFile.width, 460 / selectedFile.height)
    : 1;
  const canProcess = files.length > 0 &&
    (tool !== "add-text-to-image" || caption.trim()) &&
    (tool !== "crop-image" || crop.width >= 1 && crop.height >= 1);

  return (
    <QuickToolPage
      title={config.title}
      description={config.description}
      path={`/${tool}`}
      icon={ImageIcon}
      steps={IMAGE_STEPS}
      faqs={IMAGE_FAQS}
    >
      <section className="quick-utility-workspace quick-image-tool">
        <div className="quick-tool-step-heading">
          <span>1</span>
          <div>
            <h2>{files.length ? `${files.length} ${files.length === 1 ? "image" : "images"} selected` : config.intro}</h2>
            <p>{files.length ? "Add more images or select one below to preview it." : "Select images from your device or drag them into the upload area."}</p>
          </div>
        </div>

        {!files.length ? (
          <button
            type="button"
            className="quick-image-upload"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); chooseFiles(event.dataTransfer.files); }}
          >
            <UploadCloud size={34} />
            <strong>Select images</strong>
            <span>or drop them here · PNG, JPG, WebP, GIF · up to 20 files</span>
          </button>
        ) : (
          <>
            <div className="quick-image-file-list">
              {files.map((item) => (
                <div
                  key={item.id}
                  className={`quick-image-file-chip ${selectedId === item.id ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="quick-image-file-select"
                    onClick={() => selectFile(item)}
                    disabled={processing}
                    title={item.file.name}
                    aria-pressed={selectedId === item.id}
                  >
                    <img src={item.url} alt="" onLoad={(event) => handleImageLoaded(item.id, event)} />
                    <span>{item.file.name}</span>
                    {item.width > 0 && <small>{item.width} × {item.height}</small>}
                  </button>
                  {!processing && <button
                    type="button"
                    className="quick-image-remove-file"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => removeFile(item.id)}
                  ><X size={14} /></button>}
                </div>
              ))}
              {files.length < MAX_BATCH_SIZE && (
                <button type="button" className="quick-image-add-more" onClick={() => inputRef.current?.click()} disabled={processing}>
                  <Plus size={19} />
                  <span>Add images</span>
                </button>
              )}
              <button type="button" className="quick-image-clear-all" onClick={clearFiles} disabled={processing}>Remove all</button>
            </div>

            <div className="quick-tool-step-heading quick-tool-step-options">
              <span>2</span>
              <div><h2>Settings</h2><p>Preview: {selectedFile?.file.name || "selected image"}</p></div>
            </div>

            <div className={`quick-image-workspace ${tool === "crop-image" ? "quick-image-crop-workspace" : ""}`}>
              <div className="quick-image-preview">
                {tool === "crop-image" && selectedFile?.width ? (
                  <div
                    ref={dropRef}
                    className="quick-crop-frame"
                    style={{
                      width: `${selectedFile.width * previewScale}px`,
                      height: `${selectedFile.height * previewScale}px`,
                    }}
                    onPointerDown={startCrop}
                    onPointerMove={updateCropFromPointer}
                    onPointerUp={() => { dragStartRef.current = null; }}
                    onPointerCancel={() => { dragStartRef.current = null; }}
                  >
                    <img src={selectedFile.url} alt={`Crop preview for ${selectedFile.file.name}`} draggable="false" />
                    <span
                      className="quick-crop-selection"
                      style={{
                        left: `${crop.x}%`,
                        top: `${crop.y}%`,
                        width: `${crop.width}%`,
                        height: `${crop.height}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="quick-image-preview-stage">
                    <img src={selectedFile?.url} alt={`Preview of ${selectedFile?.file.name || "selected image"}`} />
                    {tool === "add-text-to-image" && caption.trim() && (
                      <span
                        className="quick-image-caption-preview"
                        style={{
                          top: textPosition === "top" ? "12%" : textPosition === "center" ? "50%" : "88%",
                          color: textColor,
                          fontSize: `${Math.min(42, Math.max(12, textSize * previewScale))}px`,
                        }}
                      >{caption}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="quick-image-settings">
                {tool === "resize-image" && <>
                  <div className="quick-image-mode-tabs" role="group" aria-label="Resize mode">
                    <button type="button" className={!customDimensions ? "active" : ""} onClick={() => setCustomDimensions(false)}>By percentage</button>
                    <button type="button" className={customDimensions ? "active" : ""} onClick={() => setCustomDimensions(true)}>By dimensions</button>
                  </div>
                  {!customDimensions ? <>
                    <label className="quick-utility-label" htmlFor="image-resize-percent">Resize to: {percent}%</label>
                    <input id="image-resize-percent" className="quick-image-range" type="range" min="10" max="200" step="5" value={percent} onChange={(event) => setPercent(Number(event.target.value))} />
                    <div className="quick-image-presets">
                      {[25, 50, 75, 100, 150].map((value) => <button type="button" key={value} className={percent === value ? "active" : ""} onClick={() => setPercent(value)}>{value}%</button>)}
                    </div>
                  </> : <>
                    <div className="quick-pdf-controls">
                      <label><span className="quick-utility-label">Width (px)</span><input type="number" min="1" max="25000" value={width} onChange={(event) => updateWidth(event.target.value)} /></label>
                      <label><span className="quick-utility-label">Height (px)</span><input type="number" min="1" max="25000" value={height} onChange={(event) => updateHeight(event.target.value)} disabled={keepRatio} /></label>
                    </div>
                    <label className="quick-image-checkbox"><input type="checkbox" checked={keepRatio} onChange={(event) => setKeepRatio(event.target.checked)} /> Keep aspect ratio</label>
                  </>}
                  <label><span className="quick-utility-label">Output format</span><select className="quick-color-control" value={format} onChange={(event) => setFormat(event.target.value)}><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label>
                </>}

                {tool === "compress-image" && <>
                  <span className="quick-utility-label">Compression level</span>
                  <div className="quick-image-mode-tabs quick-image-compression-levels" role="group" aria-label="Compression level">
                    <button type="button" className={compressionPreset === "smallest" ? "active" : ""} onClick={() => setCompressionPreset("smallest")}><strong>Smallest size</strong><small>More compression</small></button>
                    <button type="button" className={compressionPreset === "balanced" ? "active" : ""} onClick={() => setCompressionPreset("balanced")}><strong>Recommended</strong><small>Good balance</small></button>
                    <button type="button" className={compressionPreset === "best-quality" ? "active" : ""} onClick={() => setCompressionPreset("best-quality")}><strong>Best quality</strong><small>Less compression</small></button>
                  </div>
                  {compressionPreset === "balanced" && <>
                    <label className="quick-utility-label" htmlFor="image-quality">Quality: {quality}%</label>
                    <input id="image-quality" className="quick-image-range" type="range" min="35" max="90" value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
                  </>}
                  <p className="quick-utility-help">Images are compressed to WebP locally. Results depend on the original image.</p>
                </>}

                {tool === "crop-image" && <>
                  <span className="quick-utility-label">Drag on the image to choose the crop area</span>
                  <label><span className="quick-utility-label">Aspect ratio</span>
                    <select className="quick-color-control" value={cropAspect} onChange={(event) => {
                      const nextAspect = event.target.value;
                      setCropAspect(nextAspect);
                      if (nextAspect && selectedFile?.width) {
                        setCrop(cropFromPoints(
                          { x: crop.x, y: crop.y },
                          { x: crop.x + crop.width, y: crop.y + crop.height },
                          selectedFile,
                          nextAspect
                        ));
                      }
                    }}>
                      <option value="">Free</option><option value="1">Square (1:1)</option><option value="1.333333">Landscape (4:3)</option><option value="1.777778">Wide (16:9)</option><option value="0.75">Portrait (3:4)</option>
                    </select>
                  </label>
                  <button type="button" className="quick-utility-secondary" onClick={() => setCrop({ x: 0, y: 0, width: 100, height: 100 })}><RotateCcw size={15} /> Reset crop</button>
                  <p className="quick-utility-help">The crop selection is applied at the same relative position to all images in this batch.</p>
                  <label><span className="quick-utility-label">Output format</span><select className="quick-color-control" value={format} onChange={(event) => setFormat(event.target.value)}><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label>
                </>}

                {tool === "convert-image" && <>
                  <label><span className="quick-utility-label">Convert to</span><select className="quick-color-control" value={format} onChange={(event) => setFormat(event.target.value)}><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label>
                  <p className="quick-utility-help">Transparent areas are filled with white when converting to JPG.</p>
                </>}

                {tool === "add-text-to-image" && <>
                  <label><span className="quick-utility-label">Text to add</span><input className="quick-color-control" value={caption} maxLength={160} onChange={(event) => setCaption(event.target.value)} placeholder="Type a caption..." /></label>
                  <div className="quick-pdf-controls">
                    <label><span className="quick-utility-label">Text size</span><input type="number" min="12" max="240" value={textSize} onChange={(event) => setTextSize(Math.max(12, Number(event.target.value)))} /></label>
                    <label><span className="quick-utility-label">Position</span><select className="quick-color-control" value={textPosition} onChange={(event) => setTextPosition(event.target.value)}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
                  </div>
                  <label><span className="quick-utility-label">Text color</span><input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
                  <label><span className="quick-utility-label">Output format</span><select className="quick-color-control" value={format} onChange={(event) => setFormat(event.target.value)}><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label>
                </>}

                {tool === "remove-background" && <>
                  <label className="quick-utility-label" htmlFor="background-sensitivity">Background color sensitivity: {sensitivity}</label>
                  <input id="background-sensitivity" className="quick-image-range" type="range" min="5" max="100" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} />
                  <p className="quick-utility-help">Works best with a plain, solid-color background. This color-keying tool is not AI subject detection.</p>
                </>}
              </div>
            </div>
          </>
        )}

        {error && <p className="quick-utility-error" role="alert">{error}</p>}
        {message && <p className="quick-utility-message" role="status">{message}</p>}
        {progress && <p className="quick-utility-message" role="status">{progress}</p>}

        {files.length > 0 && !results.length && (
          <div className="quick-utility-actions quick-image-submit">
            <button type="button" className="quick-utility-primary" onClick={processImages} disabled={!canProcess || processing}>
              {processing ? <LoaderCircle size={17} className="quick-image-spinner" /> : <ImageIcon size={17} />}
              {processing ? "Processing…" : config.action}
            </button>
          </div>
        )}

        {results.length > 0 && (
          <section className="quick-image-results" aria-live="polite">
            <div className="quick-tool-step-heading">
              <span><Check size={17} /></span>
              <div><h2>Your images are ready</h2><p>{results.length} processed {results.length === 1 ? "image" : "images"}</p></div>
            </div>
            <div className="quick-image-result-list">
              {results.map((result) => (
                <article className="quick-image-result-row" key={result.id}>
                  <img src={result.url} alt="" />
                  <div><strong>{result.name}</strong><small>{formatBytes(result.blob.size)}{tool === "compress-image" ? ` · from ${formatBytes(result.originalSize)}` : ""}</small></div>
                  <button type="button" className="quick-utility-secondary" onClick={() => downloadOne(result)} aria-label={`Download ${result.name}`}><ArrowDownToLine size={16} /> Download</button>
                </article>
              ))}
            </div>
            <div className="quick-utility-actions">
              <button type="button" className="quick-utility-primary" onClick={downloadAll}><ArrowDownToLine size={17} />{results.length > 1 ? "Download all as ZIP" : "Download image"}</button>
              <button type="button" className="quick-utility-secondary" onClick={() => { clearResults(); }}>Edit settings</button>
            </div>
          </section>
        )}

        <p className="quick-utility-privacy">Your images stay on your device and are processed in this browser. Maximum 20 images, 25 MB per image.</p>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { chooseFiles(event.target.files); event.target.value = ""; }} />
      </section>
    </QuickToolPage>
  );
}
