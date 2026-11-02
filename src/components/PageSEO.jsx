import { useEffect } from "react";

const SITE_URL = "https://quicktools-roan.vercel.app";
const SITE_NAME = "QuickTools";

export default function PageSEO({
  title,
  description,
  path,
  robots = "index, follow, max-image-preview:large",
}) {
  useEffect(() => {
    const canonicalUrl = new URL(path, SITE_URL).href;
    const previousTitle = document.title;
    document.title = title;

    const metaValues = [
      { attribute: "name", key: "description", content: description },
      { attribute: "name", key: "robots", content: robots },
      { attribute: "property", key: "og:type", content: "website" },
      { attribute: "property", key: "og:site_name", content: SITE_NAME },
      { attribute: "property", key: "og:title", content: title },
      { attribute: "property", key: "og:description", content: description },
      { attribute: "property", key: "og:url", content: canonicalUrl },
      { attribute: "name", key: "twitter:card", content: "summary" },
      { attribute: "name", key: "twitter:title", content: title },
      { attribute: "name", key: "twitter:description", content: description },
    ];

    const previousMetaValues = metaValues.map(({ attribute, key, content }) => {
      let element = document.head.querySelector(
        `meta[${attribute}="${key}"]`
      );
      const wasPresent = Boolean(element);

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }

      const previousContent = element.getAttribute("content");
      element.setAttribute("content", content);
      return { element, wasPresent, previousContent };
    });

    let canonical = document.head.querySelector('link[rel="canonical"]');
    const canonicalWasPresent = Boolean(canonical);
    const previousCanonical = canonical?.getAttribute("href");

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }

    canonical.href = canonicalUrl;

    let schema = document.getElementById("quicktools-page-schema");
    const schemaWasPresent = Boolean(schema);
    const previousSchema = schema?.textContent;

    if (!schema) {
      schema = document.createElement("script");
      schema.id = "quicktools-page-schema";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }

    const pageSchema =
      path === "/"
        ? {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: SITE_NAME,
                url: `${SITE_URL}/`,
              },
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                name: SITE_NAME,
                url: `${SITE_URL}/`,
                publisher: { "@id": `${SITE_URL}/#organization` },
                description,
              },
              {
                "@type": "WebApplication",
                "@id": `${SITE_URL}/#webapplication`,
                name: SITE_NAME,
                url: `${SITE_URL}/`,
                description,
                applicationCategory: "UtilitiesApplication",
                operatingSystem: "Any",
              },
            ],
          }
        : {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            description,
            url: canonicalUrl,
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
                  name: title.split("|")[0].trim(),
                  item: canonicalUrl,
                },
              ],
            },
          };

    schema.textContent = JSON.stringify(pageSchema);

    return () => {
      document.title = previousTitle;

      previousMetaValues.forEach(
        ({ element, wasPresent, previousContent }) => {
          if (wasPresent) {
            if (previousContent === null) {
              element.removeAttribute("content");
            } else {
              element.setAttribute("content", previousContent);
            }
          } else {
            element.remove();
          }
        }
      );

      if (canonicalWasPresent) {
        if (previousCanonical === null) {
          canonical.removeAttribute("href");
        } else {
          canonical.href = previousCanonical;
        }
      } else {
        canonical.remove();
      }

      if (schemaWasPresent) {
        schema.textContent = previousSchema;
      } else {
        schema.remove();
      }
    };
  }, [description, path, robots, title]);

  return null;
}
