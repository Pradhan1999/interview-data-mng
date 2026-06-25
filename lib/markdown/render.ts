import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

type Processor = ReturnType<typeof buildProcessor>;

/**
 * Cache the unified processor on globalThis. Building it (and the shiki
 * highlighter inside rehype-pretty-code) is expensive, and Next HMR would
 * otherwise rebuild it on every change.
 */
declare global {
  var _mdProcessor: Processor | undefined;
  var _mdRenderCache: Map<string, string> | undefined;
}

const RENDER_CACHE_MAX = 2000;

function getRenderCache(): Map<string, string> {
  if (!globalThis._mdRenderCache) globalThis._mdRenderCache = new Map();
  return globalThis._mdRenderCache;
}

// Sanitization schema extended to keep the attributes rehype-pretty-code emits
// for syntax highlighting (inline styles + data-* on code/pre/span/figure).
const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      "className",
      "style",
      ["dataLanguage", /.*/],
      ["dataTheme", /.*/],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      "className",
      "style",
      ["dataLanguage", /.*/],
      ["dataTheme", /.*/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
      "style",
      ["dataLine", /.*/],
    ],
    figure: [
      ...(defaultSchema.attributes?.figure ?? []),
      ["dataRehypePrettyCodeFigure", /.*/],
    ],
  },
};

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      // Dual themes: light token colors render by default; .dark overrides
      // via the CSS in globals.css using --shiki-dark variables.
      theme: { light: "github-light", dark: "github-dark" },
      keepBackground: false,
    })
    .use(rehypeSanitize, schema)
    .use(rehypeStringify);
}

function getProcessor(): Processor {
  if (!globalThis._mdProcessor) {
    globalThis._mdProcessor = buildProcessor();
  }
  return globalThis._mdProcessor;
}

/** Render raw markdown to sanitized, syntax-highlighted HTML (server only). */
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown?.trim()) return "";
  const cache = getRenderCache();
  const hit = cache.get(markdown);
  if (hit !== undefined) return hit;
  const html = String(await getProcessor().process(markdown));
  // Simple LRU: evict oldest (insertion-order) entry when full.
  if (cache.size >= RENDER_CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(markdown, html);
  return html;
}
