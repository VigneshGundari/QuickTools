
import { useEffect } from "react";

export default function PageSEO({
  title,
  description,
  path,
}) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector(
      'meta[name="description"]'
    );
    const previousDescription =
      descriptionTag?.getAttribute("content");

    document.title = title;

    if (descriptionTag) {
      descriptionTag.setAttribute("content", description);
    }

    let canonical = document.querySelector(
      'link[rel="canonical"]'
    );

    const canonicalWasPresent = Boolean(canonical);
    const previousCanonical = canonical?.getAttribute("href");

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }

    canonical.href = `https://quicktools-roan.vercel.app${path}`;

    return () => {
      document.title = previousTitle;

      if (descriptionTag && previousDescription !== null) {
        descriptionTag.setAttribute(
          "content",
          previousDescription
        );
      }

      if (canonicalWasPresent) {
        canonical.href = previousCanonical;
      } else {
        canonical.remove();
      }
    };
  }, [title, description, path]);

  return null;
}
