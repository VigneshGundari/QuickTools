import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createPageSchema,
  DEFAULT_ROBOTS,
  HOME_PAGE_METADATA,
  SEO_ROUTES,
  SITE_URL,
} from "../src/seo/routes.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function upsertMeta(html, attribute, name, content) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagPattern = new RegExp(
    `<meta\\s+${attribute}="${escapedName}"[^>]*>`,
    "i"
  );
  const tag = `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`;

  if (tagPattern.test(html)) {
    return html.replace(tagPattern, tag);
  }

  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function applyRouteMetadata(template, route) {
  const canonicalUrl = new URL(route.path, SITE_URL).href;
  const robots = route.robots ?? DEFAULT_ROBOTS;
  let html = template.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(route.title)}</title>`
  );

  html = upsertMeta(html, "name", "description", route.description);
  html = upsertMeta(html, "name", "robots", robots);
  html = upsertMeta(html, "property", "og:type", "website");
  html = upsertMeta(html, "property", "og:site_name", "QuickTools");
  html = upsertMeta(html, "property", "og:title", route.title);
  html = upsertMeta(html, "property", "og:description", route.description);
  html = upsertMeta(html, "property", "og:url", canonicalUrl);
  html = upsertMeta(html, "name", "twitter:card", "summary");
  html = upsertMeta(html, "name", "twitter:title", route.title);
  html = upsertMeta(html, "name", "twitter:description", route.description);

  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
  const canonicalPattern = /<link\s+rel="canonical"[^>]*>/i;
  if (canonicalPattern.test(html)) {
    html = html.replace(canonicalPattern, canonicalTag);
  } else {
    html = html.replace("</head>", `    ${canonicalTag}\n  </head>`);
  }

  const schemaJson = JSON.stringify(createPageSchema(route)).replaceAll("<", "\\u003c");
  const schemaTag =
    `<script id="quicktools-page-schema" type="application/ld+json">${schemaJson}</script>`;
  const schemaPattern = /<script\s+id="quicktools-page-schema"[^>]*>[\s\S]*?<\/script>/i;
  if (schemaPattern.test(html)) {
    html = html.replace(schemaPattern, schemaTag);
  } else {
    html = html.replace("</head>", `    ${schemaTag}\n  </head>`);
  }

  return html;
}

export function prerenderRoutes() {
  let outDir;
  let projectRoot;
  let configFile;

  return {
    name: "quicktools-route-html",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      projectRoot = config.root;
      configFile = config.configFile;
    },
    async closeBundle() {
      const [{ createServer }, React, { renderToStaticMarkup }] = await Promise.all([
        import("vite"),
        import("react"),
        import("react-dom/server"),
      ]);
      const templatePath = resolve(outDir, "index.html");
      const template = await readFile(templatePath, "utf8");
      const ssrServer = await createServer({
        configFile,
        root: projectRoot,
        appType: "custom",
        server: { middlewareMode: true },
        optimizeDeps: { noDiscovery: true, include: [] },
        resolve: {
          alias: [{ find: "react-router-dom", replacement: "react-router" }],
        },
      });

      try {
        const [app, router] = await Promise.all([
          ssrServer.ssrLoadModule("/src/main.jsx"),
          ssrServer.ssrLoadModule("react-router-dom"),
        ]);
        const routes = [HOME_PAGE_METADATA, ...SEO_ROUTES];

        await Promise.all(
          routes.map(async (route) => {
            const pageMarkup = renderToStaticMarkup(
              React.createElement(
                router.StaticRouter,
                { location: route.path },
                React.createElement(app.AppRoutes)
              )
            );
            const html = applyRouteMetadata(template, route).replace(
              /<div id="root"><\/div>/,
              `<div id="root">${pageMarkup}</div>`
            );
            const outputPath =
              route.path === "/"
                ? templatePath
                : resolve(outDir, route.path.slice(1), "index.html");

            if (html === applyRouteMetadata(template, route)) {
              throw new Error(`Could not find the React root for route ${route.path}.`);
            }

            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, html);
          })
        );
      } finally {
        await ssrServer.close();
      }
    },
  };
}
