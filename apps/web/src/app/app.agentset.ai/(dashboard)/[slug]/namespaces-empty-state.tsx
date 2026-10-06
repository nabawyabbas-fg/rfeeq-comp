import { FoldersIcon, PlusIcon } from "lucide-react";

import { Button } from "@agentset/ui/button";

/**
 * Shown when an organisation has no namespaces yet.
 *
 * Previously this also offered three "sample data" templates that created a
 * namespace and ingested demo PDFs from an external CDN. That feature is gone:
 * the documents were hosted by another product, and a corpus-specific app has
 * no use for namespaces full of academic papers and quarterly reports.
 */
export function NamespacesEmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-10 md:px-6 md:py-16">
      <FoldersIcon className="text-muted-foreground mb-4 size-10" />
      <h3 className="text-center text-lg font-medium text-balance">
        Create your first namespace
      </h3>
      <p className="text-muted-foreground mt-0.5 text-center text-sm text-pretty">
        Create a new namespace to start uploading your data
      </p>
      <Button variant="outline" className="mt-4" onClick={onCreateClick}>
        <PlusIcon className="size-4" />
        Create Namespace
      </Button>
    </div>
  );
}
