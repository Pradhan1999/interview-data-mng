"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { DifficultWord } from "@/types";

interface TooltipState {
  word: string;
  definition: string;
  rect: DOMRect;
}

/**
 * Builds a case-insensitive regex that matches the word/phrase at a text
 * boundary. Lookbehind / lookahead on non-letter/digit so hyphens inside
 * phrases work correctly (e.g. "dynamically-typed").
 */
function buildWordRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, "gi");
}

/**
 * Walks text nodes inside `root`, finds occurrences of `word` via `regex`,
 * and wraps each match in a <mark> element.
 *
 * NOTE: Annotation runs on all text nodes, including those inside inline
 * <code> and <kbd> elements. For <pre> fenced code blocks (Shiki-tokenised),
 * matches that span multiple syntax-token spans won't be found, but
 * single-word terms will highlight correctly.
 */
function annotateWord(root: HTMLElement, word: string, regex: RegExp): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      regex.lastIndex = 0;
      if (!node.textContent || !regex.test(node.textContent)) {
        regex.lastIndex = 0;
        return NodeFilter.FILTER_SKIP;
      }
      regex.lastIndex = 0;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const mark = document.createElement("mark");
      mark.className = "glossary-term";
      mark.dataset.word = word;
      mark.textContent = match[0];
      frag.appendChild(mark);
      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }

    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

/**
 * Renders sanitized answer HTML and highlights difficult words with a dotted
 * underline. Hovering over a highlighted word shows a floating definition
 * tooltip. Words inside code/pre/kbd nodes are not highlighted.
 *
 * KEY DESIGN: We intentionally do NOT use dangerouslySetInnerHTML. Instead,
 * we set el.innerHTML directly inside the useEffect (before annotation).
 * This prevents React's reconciler from ever "correcting" the div's innerHTML
 * back to the un-annotated HTML string during re-renders — which would remove
 * our <mark> elements and break mouseleave, causing the tooltip to stick open.
 */
export function AnswerWithGlossary({
  html,
  difficultWords,
  className,
}: {
  html: string;
  difficultWords: DifficultWord[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── 1. (Re-)set the HTML content ─────────────────────────────────────────
    // Done here — NOT via dangerouslySetInnerHTML — so React never manages
    // this div's innerHTML and cannot overwrite our <mark> annotations on
    // subsequent re-renders.
    el.innerHTML = html;

    if (!html || difficultWords.length === 0) return;

    // ── 2. Annotate each difficult word ──────────────────────────────────────
    for (const dw of difficultWords) {
      if (!dw.word.trim()) continue;
      annotateWord(el, dw.word, buildWordRegex(dw.word));
    }

    // ── 3. Attach listeners directly to each <mark> ──────────────────────────
    // We use native mouseenter/mouseleave on each mark (not React synthetic
    // delegation) to avoid cross-boundary firing issues with the portal tooltip.
    const marks = el.querySelectorAll<HTMLElement>("mark.glossary-term");
    const cleanups: (() => void)[] = [];

    marks.forEach((mark) => {
      const wordKey = mark.dataset.word ?? "";
      const entry = difficultWords.find(
        (dw) => dw.word.toLowerCase() === wordKey.toLowerCase()
      );
      if (!entry) return;

      const onEnter = () => {
        setTooltip({
          word: entry.word,
          definition: entry.definition,
          rect: mark.getBoundingClientRect(),
        });
      };
      const onLeave = () => setTooltip(null);

      mark.addEventListener("mouseenter", onEnter);
      mark.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        mark.removeEventListener("mouseenter", onEnter);
        mark.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [html, difficultWords]);

  if (!html) {
    return (
      <p className={cn("text-sm italic text-muted-foreground", className)}>
        (empty)
      </p>
    );
  }

  return (
    <>
      {/* Empty div — innerHTML is set by the effect above, never by React. */}
      <div ref={containerRef} className={cn("md", className)} />
      {tooltip &&
        createPortal(
          <GlossaryTooltip
            word={tooltip.word}
            definition={tooltip.definition}
            triggerRect={tooltip.rect}
          />,
          document.body
        )}
    </>
  );
}

/** Floating definition card positioned above (or below) the hovered word. */
function GlossaryTooltip({
  word,
  definition,
  triggerRect,
}: {
  word: string;
  definition: string;
  triggerRect: DOMRect;
}) {
  const OFFSET = 8;
  const leftEdge = Math.max(8, triggerRect.left);
  const style: CSSProperties = {
    position: "fixed",
    left: leftEdge,
    zIndex: 9999,
    maxWidth: Math.min(300, window.innerWidth - leftEdge - 8),
    // pointer-events: none ensures the tooltip element never intercepts mouse
    // events, preventing any interaction between the tooltip appearing and the
    // mark's mouseleave firing.
    pointerEvents: "none",
    // Show above the word; show below only when very close to the top edge.
    ...(triggerRect.top > 100
      ? { bottom: window.innerHeight - triggerRect.top + OFFSET }
      : { top: triggerRect.bottom + OFFSET }),
  };

  return (
    <div
      style={style}
      className="rounded-lg border bg-popover px-3 py-2.5 shadow-lg"
    >
      <p className="mb-0.5 text-xs font-semibold text-foreground">{word}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {definition || <span className="italic">No definition provided.</span>}
      </p>
    </div>
  );
}
