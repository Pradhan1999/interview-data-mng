"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerWithGlossary } from "./AnswerWithGlossary";
import type { DifficultWord } from "@/types";

/**
 * Answer is hidden by default; clicking "Show Answer" (or pressing Space)
 * reveals the pre-rendered, highlighted markdown. Difficult words are
 * annotated with dotted underlines and a hover definition tooltip.
 */
export function AnswerReveal({
  answerHtml,
  revealed,
  onToggle,
  difficultWords,
}: {
  answerHtml: string;
  revealed: boolean;
  onToggle: () => void;
  difficultWords: DifficultWord[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Answer
        </p>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {revealed ? (
            <>
              <EyeOff className="size-4" /> Hide
            </>
          ) : (
            <>
              <Eye className="size-4" /> Show Answer
            </>
          )}
        </Button>
      </div>

      {revealed ? (
        <div className="text-[15px]">
          <AnswerWithGlossary html={answerHtml} difficultWords={difficultWords} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="group flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-muted/30 py-12 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <Eye className="size-5 opacity-50 transition-opacity group-hover:opacity-100" />
          <span>
            Answer hidden — click or press{" "}
            <kbd className="rounded border bg-background px-1 text-xs">
              Space
            </kbd>
          </span>
        </button>
      )}
    </div>
  );
}
