"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DifficultWord } from "@/types";

/**
 * Editor for the difficultWords list inside the Edit Question modal.
 * Renders a list of word/definition rows; each row is editable in-place.
 * Rows can be added or removed. Parent owns the state via value/onChange.
 */
export function DifficultWordsEditor({
  value,
  onChange,
}: {
  value: DifficultWord[];
  onChange: (words: DifficultWord[]) => void;
}) {
  function addWord() {
    onChange([...value, { word: "", definition: "" }]);
  }

  function removeWord(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function updateWord(index: number, field: keyof DifficultWord, text: string) {
    onChange(
      value.map((w, i) => (i === index ? { ...w, [field]: text } : w))
    );
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No difficult words added yet. Click &ldquo;Add word&rdquo; to define terms that
          will appear as tooltip highlights in the answer.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((dw, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_2fr_auto] items-start gap-2"
            >
              <div className="space-y-1">
                {i === 0 && (
                  <Label className="text-[11px] text-muted-foreground">
                    Word / phrase
                  </Label>
                )}
                <Input
                  value={dw.word}
                  onChange={(e) => updateWord(i, "word", e.target.value)}
                  placeholder="e.g. closure"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                {i === 0 && (
                  <Label className="text-[11px] text-muted-foreground">
                    Definition
                  </Label>
                )}
                <Input
                  value={dw.definition}
                  onChange={(e) => updateWord(i, "definition", e.target.value)}
                  placeholder="Short definition shown on hover"
                  className="h-8 text-sm"
                />
              </div>
              <div className={i === 0 ? "pt-5" : ""}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeWord(i)}
                  aria-label="Remove word"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addWord}
        className="h-7 text-xs"
      >
        <Plus className="size-3.5" />
        Add word
      </Button>
    </div>
  );
}
