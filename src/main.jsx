import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Command, FileArchive,
  FileImage, FilePenLine, FilePlus2, FileText, Files, Github, Grid2X2, Heart,
  Image, Layers, LockKeyhole, Menu, Moon, Search, ShieldCheck, Sparkles,
  Sun, UploadCloud, WandSparkles, X, Zap, Scissors, RotateCw, Stamp, PenLine,
  FileOutput, FileInput, Shield, ScanText, Combine, Maximize2, QrCode, Type,
  Eraser, Download, CircleHelp, ChevronRight ,
} from "lucide-react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import "./styles.css";
import MergePDF from "./pages/MergePDF";
import SplitPDF from "./pages/SplitPDF";
import CompressPDF from "./pages/CompressPDF";
import PDFToWord from "./pages/PDFToWord.jsx";
import WordToPDF from "./pages/WordToPDF";
import RotatePDF from "./pages/RotatePDF";
import PDFToJPG from "./pages/PDFToJPG";
import JPGToPDF from "./pages/JPGToPDF";
import OrganizePDF from "./pages/OrganizePDF";
import SignPDF from "./pages/SignPDF";
import ProtectPDF from "./pages/ProtectPDF";
import WatermarkPDF from "./pages/WatermarkPDF";
import { Analytics } from "@vercel/analytics/react";

const tools = [
  { name: "Edit PDF", desc: "Add text, notes and shapes to your PDF.", category: "PDF", icon: FilePenLine, tint: "pink", featured: true },
  { name: "Merge PDF", desc: "Combine multiple PDFs into one file.", category: "PDF", icon: Combine, tint: "purple", featured: true },
  { name: "Split PDF", desc: "Separate pages or extract what you need.", category: "PDF", icon: Scissors, tint: "blue", featured: true },
  { name: "Compress PDF", desc: "Reduce PDF file size with less hassle.", category: "PDF", icon: FileArchive, tint: "green", featured: true },
  { name: "PDF to Word", desc: "Turn PDF documents into editable Word files.", category: "PDF", icon: FileOutput, tint: "blue" },
  { name: "Word to PDF", desc: "Convert Word documents into PDFs.", category: "PDF", icon: FileInput, tint: "orange" },
  { name: "Rotate PDF", desc: "Rotate pages and save them the right way up.", category: "PDF", icon: RotateCw, tint: "purple" },
  { name: "Organize PDF", desc: "Reorder, remove and arrange PDF pages.", category: "PDF", icon: Layers, tint: "pink" },
  { name: "Sign PDF", desc: "Add your signature to a PDF document.", category: "PDF", icon: PenLine, tint: "green" },
  { name: "Protect PDF", desc: "Add password protection to a PDF.", category: "PDF", icon: LockKeyhole, tint: "orange" },
  { name: "Watermark PDF", desc: "Place text or an image watermark on pages.", category: "PDF", icon: Stamp, tint: "blue" },
  { name: "PDF to JPG", desc: "Convert PDF pages into image files.", category: "PDF", icon: FileImage, tint: "pink" },
  { name: "Resize Image", desc: "Change image dimensions in a few clicks.", category: "Image", icon: Maximize2, tint: "purple" },
  { name: "Compress Image", desc: "Make image files smaller for sharing.", category: "Image", icon: Image, tint: "green" },
  { name: "Crop Image", desc: "Crop an image to the exact area you need.", category: "Image", icon: ScanText, tint: "orange" },
  { name: "Convert Image", desc: "Convert PNG, JPG and WebP formats.", category: "Image", icon: FileImage, tint: "blue" },
  { name: "Add Text to Image", desc: "Add a caption or simple text overlay.", category: "Image", icon: Type, tint: "pink" },
  { name: "Remove Background", desc: "Prepare a clean cutout from an image.", category: "Image", icon: Eraser, tint: "purple" },
  { name: "Excel to PDF", desc: "Save spreadsheets as shareable PDFs.", category: "Document", icon: FileText, tint: "green" },
  { name: "PowerPoint to PDF", desc: "Convert slides into a PDF document.", category: "Document", icon: Files, tint: "orange" },
  { name: "JPG to PDF", desc: "Convert images into a PDF document.", category: "Document", icon: FilePlus2, tint: "pink" },
  { name: "Text to PDF", desc: "Turn plain text into a clean PDF file.", category: "Document", icon: FileText, tint: "blue" },
  { name: "QR Code Generator", desc: "Create a QR code from a link or text.", category: "Everyday", icon: QrCode, tint: "purple" },
  { name: "Text Case Converter", desc: "Switch text between common letter cases.", category: "Everyday", icon: Type, tint: "orange" },
];
const categories = ["All tools", "PDF", "Image", "Document", "Everyday"];

const availableToolNames = new Set([
  "Merge PDF",
  "Split PDF",
  "Compress PDF",
  "PDF to Word",
  "Word to PDF",
  "Rotate PDF",
  "Organize PDF",
  "PDF to JPG",
  "JPG to PDF",
  "Sign PDF",
  "Protect PDF",
]);

const isToolAvailable = (tool) => availableToolNames.has(tool.name);


function App() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("qt-theme") || "light");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tools");
  const [activeTool, setActiveTool] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const changeTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("qt-theme", next);
  };

  const filteredTools = useMemo(() => tools.filter(t => {
    const matchesCategory = category === "All tools" || t.category === category;
    const matchesSearch = `${t.name} ${t.desc} ${t.category}`.toLowerCase().includes(query.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  }), [query, category]);

  const openTool = (tool) => {
    if (!isToolAvailable(tool)) return;

    setQuery("");

    if (tool.name === "Merge PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/merge-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Split PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/split-pdf");
      return;
    }
    if (tool.name === "Compress PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/compress-pdf");
      return;
    }
    if (tool.name === "PDF to Word") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/pdf-to-word");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Word to PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/word-to-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Rotate PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/rotate-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Organize PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/organize-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "PDF to JPG") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/pdf-to-jpg");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "JPG to PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/jpg-to-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Sign PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/sign-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Protect PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/protect-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tool.name === "Watermark PDF") {
      setActiveTool(null);
      setSelectedFile(null);
      navigate("/watermark-pdf");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setActiveTool(tool);
    setSelectedFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
  };

  const home = () => {
    setActiveTool(null);
    setSelectedFile(null);
    setCategory("All tools");
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={`app ${theme}`}>
      <header className="topbar">
        <div className="nav-wrap">
          <button className="brand" onClick={home} aria-label="QuickTools home">
            <span className="brand-mark"><Zap size={21} fill="currentColor" /></span>
            <span>quick<span className="brand-accent">tools</span><small>MAKE IT SIMPLE</small></span>
          </button>
          <nav className={`nav-links ${mobileMenu ? "nav-open" : ""}`}>
            <button onClick={() => { home(); document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth"}); }}>All tools</button>
            <button onClick={() => { setCategory("PDF"); setActiveTool(null); document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth"}); }}>PDF tools</button>
            <button onClick={() => { setCategory("Image"); setActiveTool(null); document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth"}); }}>Image tools</button>
            <button onClick={() => { setCategory("Document"); setActiveTool(null); document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth"}); }}>Converters</button>
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={changeTheme} aria-label="Toggle color theme">
              {theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}
            </button>
            <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">
              {mobileMenu ? <X size={20}/> : <Menu size={20}/>}
            </button>
            <button className="nav-cta" onClick={() => { home(); document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth"}); }}>Explore tools <ArrowRight size={16}/></button>
          </div>
        </div>
      </header>

      {activeTool ? (
        <main className="tool-page">
          <div className="tool-page-inner">
            <button className="back-link" onClick={home}><ArrowLeft size={16}/> Back to all tools</button>
            <div className="tool-heading">
              <span className={`tool-icon large ${activeTool.tint}`}><activeTool.icon size={29}/></span>
              <div>
                <div className="eyebrow">{activeTool.category} TOOL</div>
                <h1>{activeTool.name}</h1>
                <p>{activeTool.desc}</p>
              </div>
            </div>
            <div className="upload-panel">
              {!selectedFile ? <>
                <div className="upload-art"><UploadCloud size={36}/></div>
                <h2>Choose a file to get started</h2>
                <p>Drop your file here, or browse from your device.</p>
                <button className="primary-btn" onClick={() => fileRef.current?.click()}>Select file <ArrowRight size={17}/></button>
                <input ref={fileRef} type="file" hidden accept={activeTool.category === "Image" ? "image/*" : activeTool.name.includes("Word") ? ".doc,.docx,.pdf" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt"} onChange={e => chooseFile(e.target.files?.[0])}/>
                <div className="upload-note"><ShieldCheck size={15}/> Your files are handled with care</div>
              </> : <>
                <div className="file-ready"><span className="file-ready-icon"><FileText size={25}/></span><div className="file-info"><strong>{selectedFile.name}</strong><span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · File selected</span></div><button className="icon-button" onClick={() => setSelectedFile(null)} aria-label="Remove file"><X size={18}/></button></div>
                <div className="notice"><CircleHelp size={18}/><span>This is the UI preview stage. Processing for this tool will be connected in the next development stage.</span></div>
                <button className="primary-btn" onClick={() => alert("The interface is ready. Real file processing will be connected in the next stage.")}>Continue <ArrowRight size={17}/></button>
              </>}
            </div>
            <div className="privacy-row"><ShieldCheck size={18}/><span><strong>Simple and secure.</strong> No account is needed to try the interface.</span></div>
            <div className="how-section"><h2>How it works</h2><div className="steps-grid"><div><span>01</span><h3>Upload your file</h3><p>Select a file from your device.</p></div><div><span>02</span><h3>Make it yours</h3><p>Choose the options you need.</p></div><div><span>03</span><h3>Download</h3><p>Get your finished file when processing is connected.</p></div></div></div>
          </div>
        </main>
      ) : (
        <main>
          <section className="hero">
            <div className="hero-glow glow-one"></div><div className="hero-glow glow-two"></div>
            <div className="hero-inner">
              <div className="hero-copy">
                <div className="hero-badge"><Sparkles size={14}/> YOUR EVERYDAY TOOLKIT</div>
                <h1>Small tasks.<br/><span>Big time saved.</span></h1>
                <p className="hero-subtitle">Everything you need to work with PDFs, images and documents — in one simple place.</p>
                <div className="hero-search">
                  <Search size={20}/>
                  <input value={query} onChange={e => {setQuery(e.target.value); if(e.target.value) document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth",block:"start"});}} placeholder="What would you like to do?" aria-label="Search tools"/>
                  <kbd><Command size={12}/> K</kbd>
                </div>
                <div className="hero-meta"><span><Check size={15}/> Easy to use</span><span><Check size={15}/> No clutter</span><span><Check size={15}/> Made for everyone</span></div>
              </div>
              <div className="hero-visual" aria-hidden="true">
                <div className="float-card card-pdf"><div className="mini-file pdf"><FileText size={25}/></div><div><b>PDF tools</b><small>Edit, merge, convert</small></div><span className="mini-check"><Check size={13}/></span></div>
                <div className="float-card card-image"><div className="mini-file image-file"><Image size={25}/></div><div><b>Image tools</b><small>Resize, crop, optimize</small></div><span className="mini-check"><Check size={13}/></span></div>
                <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
                <div className="hero-center"><div className="hero-center-mark"><Zap size={45} fill="currentColor"/></div><div className="hero-center-label">QUICKTOOLS</div><div className="hero-center-sub">GET IT DONE.</div></div>
                <div className="sparkle sparkle-a"><Sparkles size={21}/></div><div className="sparkle sparkle-b"><WandSparkles size={25}/></div>
              </div>
            </div>
            <div className="hero-bottom"><span>ONE SIMPLE WORKSPACE</span><span className="hero-bottom-line"></span><span>MADE TO GET THINGS DONE</span></div>
          </section>

          <section className="quick-strip">
            <div className="quick-strip-inner">
              <div className="strip-label"><span className="strip-dot"></span> POPULAR RIGHT NOW</div>
              
                {tools.filter(t => t.featured).map(t => {
                  const available = isToolAvailable(t);

                  return (
                    <button
                      key={t.name}
                      className={`quick-link ${available ? "" : "quick-link-locked"}`}
                      onClick={() => openTool(t)}
                      disabled={!available}
                      title={available ? t.name : "Coming Soon!"}
                    >
                      <t.icon size={16} />
                      {t.name}
                      {available ? (
                        <ArrowRight size={13} />
                      ) : (
                        <LockKeyhole size={13} />
                      )}
                      {!available && (
                        <span className="quick-coming-soon">Coming Soon!</span>
                      )}
                    </button>
                  );
                })}

            </div>
          </section>

          <section className="tool-library section-wrap" id="tool-library">
            <div className="section-heading">
              <div><div className="eyebrow">THE TOOLBOX</div><h2>What can we help you <span>get done?</span></h2><p>Useful tools, right where you need them.</p></div>
              <div className="tool-count"><Grid2X2 size={16}/><strong>{filteredTools.length}</strong> tools</div>
            </div>
            <div className="library-controls">
              <div className="category-tabs">{categories.map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>
              <div className="small-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a tool..."/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14}/></button>}</div>
            </div>
            {filteredTools.length ? <div className="tool-grid">{filteredTools.map((tool) => <ToolCard key={tool.name} tool={tool} onClick={() => openTool(tool)}/>)}</div> : <div className="empty-state"><Search size={28}/><h3>No tools found</h3><p>Try another search or choose a different category.</p><button className="secondary-btn" onClick={() => {setQuery("");setCategory("All tools");}}>Clear filters</button></div>}
            <div className="library-footer"><span>Showing {filteredTools.length} of {tools.length} tools</span><button onClick={() => {setCategory("All tools");setQuery("");}}>Browse everything <ArrowRight size={15}/></button></div>
          </section>

          <section className="feature-band">
            <div className="feature-band-inner"><div className="feature-symbol"><ShieldCheck size={30}/></div><div><div className="eyebrow">BUILT AROUND YOU</div><h2>Useful tools. Less fuss.</h2><p>A straightforward workspace designed to help you finish everyday tasks without a learning curve.</p></div><div className="feature-points"><span><Check size={16}/> Clear and simple</span><span><Check size={16}/> Works across devices</span><span><Check size={16}/> Light and dark themes</span></div></div>
          </section>
        </main>
      )}

      <footer className="footer">
        <div className="footer-main"><button className="brand footer-brand" onClick={home}><span className="brand-mark"><Zap size={20} fill="currentColor"/></span><span>quick<span className="brand-accent">tools</span><small>MAKE IT SIMPLE</small></span></button><p>Your everyday toolkit for files, images and little tasks.</p><div className="footer-links"><button onClick={() => {home();document.getElementById("tool-library")?.scrollIntoView({behavior:"smooth"});}}>Explore tools</button><button onClick={() => alert("Help and support pages will be added before launch.")}>Help & support</button><button onClick={() => alert("Privacy details will be published before file-processing tools launch.")}>Privacy</button></div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} QuickTools. Made to keep things simple.</span><span className="footer-status"><span></span> UI preview</span></div>
      </footer>
    </div>
  );
}


function ToolCard({ tool, onClick }) {
  const available = isToolAvailable(tool);

  return (
    <button
      className={`tool-card ${available ? "" : "tool-card-locked"}`}
      onClick={available ? onClick : undefined}
      disabled={!available}
      title={available ? tool.name : "Coming Soon!"}
      aria-label={
        available ? tool.name : `${tool.name} — Coming Soon`
      }
    >
      <span className={`tool-icon ${tool.tint}`}>
        <tool.icon size={23} />
      </span>

      <span className="tool-card-content">
        <strong>{tool.name}</strong>
        <span>{tool.desc}</span>

        {!available && (
          <span className="tool-coming-soon">
            <LockKeyhole size={12} />
            Coming Soon!
          </span>
        )}
      </span>

      <span className="tool-arrow">
        {available ? (
          <ArrowRight size={17} />
        ) : (
          <LockKeyhole size={16} />
        )}
      </span>
    </button>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={17} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/merge-pdf" element={<MergePDF />} />
        <Route path="/split-pdf" element={<SplitPDF />} />
        <Route path="/compress-pdf" element={<CompressPDF />} />
        <Route path="/pdf-to-word" element={<PDFToWord />} />
        <Route path="/word-to-pdf" element={<WordToPDF />} />
        <Route path="/rotate-pdf" element={<RotatePDF />} />
        <Route path="/organize-pdf" element={<OrganizePDF />} />
        <Route path="/pdf-to-jpg" element={<PDFToJPG />} />
        <Route path="/jpg-to-pdf" element={<JPGToPDF />} />
        <Route path="/sign-pdf" element={<SignPDF />} />
        <Route path="/protect-pdf" element={<ProtectPDF />} />
        <Route
          path="/watermark-pdf"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
    <Analytics />
  </React.StrictMode>
);
