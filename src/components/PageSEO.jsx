import { useEffect } from "react";
import {
  createPageSchema,
  DEFAULT_ROBOTS,
  HOME_PAGE_METADATA,
  SEO_ROUTES,
  SITE_URL,
} from "../seo/routes.js";

const SITE_NAME = "QuickTools";

export default function PageSEO({
  title = HOME_PAGE_METADATA.title,
  description = HOME_PAGE_METADATA.description,
  path,
  robots = DEFAULT_ROBOTS,
}) {
  const routeMetadata =
    path === "/" ? HOME_PAGE_METADATA : SEO_ROUTES.find((route) => route.path === path);
  const pageTitle = routeMetadata?.title ?? title;
  const pageDescription = routeMetadata?.description ?? description;
  const pageRobots = routeMetadata?.robots ?? robots;

  useEffect(() => {
    const canonicalUrl = new URL(path, SITE_URL).href;
    const previousTitle = document.title;
    document.title = pageTitle;

    const metaValues = [
      { attribute: "name", key: "description", content: pageDescription },
      { attribute: "name", key: "robots", content: pageRobots },
      { attribute: "property", key: "og:type", content: "website" },
      { attribute: "property", key: "og:site_name", content: SITE_NAME },
      { attribute: "property", key: "og:title", content: pageTitle },
      { attribute: "property", key: "og:description", content: pageDescription },
      { attribute: "property", key: "og:url", content: canonicalUrl },
      { attribute: "name", key: "twitter:card", content: "summary" },
      { attribute: "name", key: "twitter:title", content: pageTitle },
      { attribute: "name", key: "twitter:description", content: pageDescription },
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

    schema.textContent = JSON.stringify(
      createPageSchema({ path, title: pageTitle, description: pageDescription })
    );

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
  }, [pageDescription, pageRobots, pageTitle, path]);

  return null;
}
