export const SITE_URL = "https://quicktools-roan.vercel.app";
export const DEFAULT_ROBOTS = "index, follow, max-image-preview:large";

export const HOME_PAGE_METADATA = {
  path: "/",
  title: "Free Online PDF Tools: Edit, Merge, Compress & Convert | QuickTools",
  description:
    "Edit, merge, split, compress, sign, and convert PDFs online with QuickTools. Use free PDF, image, and document tools in one simple workspace.",
};

export const SEO_ROUTES = [
  {
    path: "/merge-pdf",
    title: "Merge PDF Files Online for Free | QuickTools",
    description:
      "Combine multiple PDF files into one document online with QuickTools. Arrange your files, merge them, and download the result.",
  },
  {
    path: "/split-pdf",
    title: "Split PDF Pages Online for Free | QuickTools",
    description:
      "Split a PDF into separate files or extract selected pages with QuickTools. Choose the pages you need and download your PDFs.",
  },
  {
    path: "/compress-pdf",
    title: "Compress PDF Online for Free | QuickTools",
    description:
      "Reduce PDF file size online with QuickTools. Upload a PDF, choose compression options, and download a smaller file.",
  },
  {
    path: "/pdf-to-word",
    title: "Convert PDF to Word Online | QuickTools",
    description:
      "Convert PDF documents to editable Word files online with QuickTools. Upload a PDF and download the converted document.",
  },
  {
    path: "/word-to-pdf",
    title: "Convert Word to PDF Online | QuickTools",
    description:
      "Convert Word documents to PDF online with QuickTools. Upload a DOC or DOCX file and download a shareable PDF.",
  },
  {
    path: "/rotate-pdf",
    title: "Rotate PDF Pages Online for Free | QuickTools",
    description:
      "Rotate PDF pages to the correct orientation with QuickTools. Adjust your document and download the updated PDF.",
  },
  {
    path: "/organize-pdf",
    title: "Organize PDF Pages Online | QuickTools",
    description:
      "Reorder, remove, and arrange PDF pages online with QuickTools, then download your organized document.",
  },
  {
    path: "/pdf-to-jpg",
    title: "Convert PDF to JPG Online | QuickTools",
    description:
      "Convert PDF pages to JPG images online with QuickTools. Create image files from your document pages.",
  },
  {
    path: "/jpg-to-pdf",
    title: "Convert JPG to PDF Online | QuickTools",
    description:
      "Turn JPG images into a PDF document with QuickTools. Add images and download them together as a PDF.",
  },
  {
    path: "/sign-pdf",
    title: "Sign PDF Online for Free | QuickTools",
    description:
      "Add your signature to a PDF document online with QuickTools, then save and download the signed file.",
  },
  {
    path: "/protect-pdf",
    title: "Protect PDF with a Password | QuickTools",
    description:
      "Protect PDF documents with password encryption using QuickTools to help restrict unauthorized access to your files.",
  },
  {
    path: "/watermark-pdf",
    title: "Add a Watermark to a PDF Online | QuickTools",
    description:
      "Add a text or image watermark to PDF pages with QuickTools. Customize the watermark and download your document.",
  },
  {
    path: "/edit-pdf",
    title: "Edit PDF Online for Free | QuickTools",
    description:
      "Edit a PDF by adding text, notes, and shapes with QuickTools. Make changes to your document and download the result.",
  },
  {
    path: "/edit-pdf-ui",
    title: "PDF Editor Interface Preview | QuickTools",
    description: "Preview the QuickTools PDF editor interface.",
    robots: "noindex, nofollow",
  },
  {
    path: "/text-case-converter",
    title: "Text Case Converter Online | QuickTools",
    description:
      "Convert text to uppercase, lowercase, title case, sentence case, or alternating case in your browser.",
  },
  {
    path: "/qr-code-generator",
    title: "Free QR Code Generator | QuickTools",
    description:
      "Create a QR code from a link or text with QuickTools. Customize its size and colors, then download as PNG or SVG.",
  },
  {
    path: "/text-to-pdf",
    title: "Convert Text to PDF Online | QuickTools",
    description:
      "Turn plain text into a formatted PDF with QuickTools. Choose page size and margins, then download your document.",
  },
  {
    path: "/resize-image",
    title: "Resize Images Online for Free | QuickTools",
    description:
      "Resize one or more images to the dimensions you need with QuickTools. Process your images in your browser.",
  },
  {
    path: "/compress-image",
    title: "Compress Images Online for Free | QuickTools",
    description:
      "Reduce the file size of your images in a few clicks with QuickTools. Process and download images in your browser.",
  },
  {
    path: "/crop-image",
    title: "Crop Images Online for Free | QuickTools",
    description:
      "Select and crop the part of each image you want to keep with QuickTools. Process images in your browser.",
  },
  {
    path: "/convert-image",
    title: "Convert Images to PNG, JPG, or WebP | QuickTools",
    description:
      "Convert images to PNG, JPG, or WebP format with QuickTools. Process your images locally in your browser.",
  },
  {
    path: "/add-text-to-image",
    title: "Add Text to Images Online | QuickTools",
    description:
      "Add a caption to your images and download the finished files with QuickTools. Image processing runs in your browser.",
  },
  {
    path: "/remove-background",
    title: "Remove a Solid Image Background | QuickTools",
    description:
      "Make a plain, solid-color image background transparent with QuickTools. Best results come from simple backgrounds.",
  },
  {
    path: "/excel-to-pdf",
    title: "Convert Excel to PDF Online | QuickTools",
    description:
      "Convert Excel spreadsheets to PDF for easy sharing and printing with QuickTools.",
  },
  {
    path: "/powerpoint-to-pdf",
    title: "Convert PowerPoint to PDF Online | QuickTools",
    description:
      "Convert PowerPoint presentations to PDF slides that are easy to share with QuickTools.",
  },
  {
    path: "/support",
    title: "Help & Support | QuickTools",
    description:
      "Get help using QuickTools PDF tools, troubleshoot common file issues, and find answers to frequently asked questions.",
  },
  {
    path: "/privacy",
    title: "Privacy | QuickTools",
    description:
      "Learn how QuickTools handles files, conversion requests, signature data, analytics, and browser preferences.",
  },
];

export const RELATED_TOOLS = {
  "/merge-pdf": ["/split-pdf"],
  "/split-pdf": ["/organize-pdf"],
  "/compress-pdf": ["/merge-pdf"],
  "/pdf-to-word": ["/word-to-pdf"],
  "/word-to-pdf": ["/pdf-to-word"],
  "/organize-pdf": ["/split-pdf"],
  "/pdf-to-jpg": ["/jpg-to-pdf"],
  "/jpg-to-pdf": ["/pdf-to-jpg"],
  "/text-to-pdf": ["/word-to-pdf"],
  "/sign-pdf": ["/protect-pdf"],
  "/protect-pdf": ["/sign-pdf"],
  "/watermark-pdf": ["/edit-pdf"],
  "/edit-pdf": ["/watermark-pdf"],
  "/resize-image": ["/crop-image", "/compress-image"],
  "/compress-image": ["/resize-image", "/convert-image"],
  "/crop-image": ["/resize-image"],
  "/convert-image": ["/compress-image"],
  "/add-text-to-image": ["/convert-image"],
  "/remove-background": ["/convert-image"],
  "/excel-to-pdf": ["/powerpoint-to-pdf"],
  "/powerpoint-to-pdf": ["/excel-to-pdf"],
};

export function createPageSchema({ path, title, description }) {
  if (path === "/") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "QuickTools",
          url: `${SITE_URL}/`,
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "QuickTools",
          url: `${SITE_URL}/`,
          publisher: { "@id": `${SITE_URL}/#organization` },
          description,
        },
        {
          "@type": "WebApplication",
          "@id": `${SITE_URL}/#webapplication`,
          name: "QuickTools",
          url: `${SITE_URL}/`,
          description,
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any",
        },
      ],
    };
  }

  const pageName = title.split("|")[0].trim();
  const relatedTools = (RELATED_TOOLS[path] ?? []).map((relatedPath) => {
    const relatedPage = SEO_ROUTES.find((route) => route.path === relatedPath);
    return {
      "@type": "ListItem",
      position: (RELATED_TOOLS[path] ?? []).indexOf(relatedPath) + 1,
      name: relatedPage?.title.split("|")[0].trim() ?? relatedPath,
      item: new URL(relatedPath, SITE_URL).href,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageName,
    description,
    url: new URL(path, SITE_URL).href,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: pageName,
          item: new URL(path, SITE_URL).href,
        },
      ],
    },
    ...(relatedTools.length
      ? {
          relatedLink: relatedTools.map(({ item }) => item),
        }
      : {}),
  };
}
