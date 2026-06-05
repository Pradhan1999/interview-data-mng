"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";
import { foldersApi } from "@/lib/api-client";
import type {
  FolderTreeNode,
  QuestionListFilters,
  QuestionListItem,
} from "@/types";
import { FolderSidebar } from "@/components/folders/FolderSidebar";
import { QuestionListPanel } from "@/components/questions/QuestionListPanel";
import { StudyPanel } from "@/components/study/StudyPanel";
import { PasteMapDialog } from "@/components/paste/PasteMapDialog";

export interface WorkspaceContextValue {
  selectedFolderId: string | null;
  filters: QuestionListFilters;
}

export function Workspace({
  initialTree,
}: {
  initialTree: FolderTreeNode[];
}) {
  const [tree, setTree] = useState<FolderTreeNode[]>(initialTree);
  // Default to the first root folder if one exists.
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    initialTree[0]?._id ?? null
  );
  const [filters, setFilters] = useState<
    Omit<QuestionListFilters, "folderId" | "cursor">
  >({ subtree: true });
  const [selectedQuestion, setSelectedQuestion] =
    useState<QuestionListItem | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  // Bumped to force the question list to refetch (after bulk save, delete...).
  const [listRefreshKey, setListRefreshKey] = useState(0);
  // The questions currently loaded in the list panel — drives prev/next nav.
  const [loadedItems, setLoadedItems] = useState<QuestionListItem[]>([]);

  const selectedIndex = selectedQuestion
    ? loadedItems.findIndex((q) => q._id === selectedQuestion._id)
    : -1;

  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedQuestion(loadedItems[selectedIndex - 1]);
  }, [selectedIndex, loadedItems]);

  const goNext = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < loadedItems.length - 1)
      setSelectedQuestion(loadedItems[selectedIndex + 1]);
  }, [selectedIndex, loadedItems]);

  const refreshTree = useCallback(async () => {
    try {
      setTree(await foldersApi.tree());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load folders");
    }
  }, []);

  const refreshList = useCallback(() => {
    setListRefreshKey((k) => k + 1);
  }, []);

  const effectiveFilters: QuestionListFilters = useMemo(
    () => ({ ...filters, folderId: selectedFolderId ?? undefined }),
    [filters, selectedFolderId]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="20" minSize="14" maxSize="32" className="min-w-0 overflow-hidden">
          <FolderSidebar
            tree={tree}
            selectedFolderId={selectedFolderId}
            onSelectFolder={(id) => {
              setSelectedFolderId(id);
              setSelectedQuestion(null);
            }}
            onRefreshTree={refreshTree}
            onOpenPaste={() => setPasteOpen(true)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="42" minSize="28" className="min-w-0 overflow-hidden">
          <QuestionListPanel
            key={`${selectedFolderId}-${listRefreshKey}`}
            filters={effectiveFilters}
            tree={tree}
            selectedQuestionId={selectedQuestion?._id ?? null}
            onSelectQuestion={setSelectedQuestion}
            onFiltersChange={setFilters}
            currentFilters={filters}
            onItemsLoaded={setLoadedItems}
            onMutated={(deletedId) => {
              if (deletedId && selectedQuestion?._id === deletedId) {
                setSelectedQuestion(null);
              }
              refreshTree();
            }}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="38" minSize="24" className="min-w-0 overflow-hidden">
          <StudyPanel
            tree={tree}
            selected={selectedQuestion}
            position={
              selectedIndex >= 0
                ? { index: selectedIndex, total: loadedItems.length }
                : null
            }
            onPrev={goPrev}
            onNext={goNext}
            onChanged={() => {
              refreshList();
              refreshTree();
            }}
            onDeleted={() => {
              setSelectedQuestion(null);
              refreshList();
              refreshTree();
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <PasteMapDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        tree={tree}
        defaultFolderId={selectedFolderId}
        onSaved={() => {
          refreshList();
          refreshTree();
        }}
      />
    </div>
  );
}
