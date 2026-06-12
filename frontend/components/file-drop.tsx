"use client";
import { Upload, FileText, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function FileDrop({ file, onFileChange, disabled }: FileDropProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setError(null);
      if (rejections.length) {
        setError(rejections[0].errors[0]?.message || "file rejected");
        return;
      }
      if (accepted.length) onFileChange(accepted[0]);
    },
    [onFileChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    maxSize: 25 * 1024 * 1024,
    accept: {
      "application/pdf": [".pdf"],
      "application/epub+zip": [".epub"],
      "text/markdown": [".md", ".markdown"],
      "text/html": [".html", ".htm"],
      "text/plain": [".txt"],
    },
  });

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB - ready to upload
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onFileChange(null)}
          disabled={disabled}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </span>
        <p className="mt-4 font-medium">
          {isDragActive ? "Drop your file here" : "Drop a file or click to choose"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, EPUB, Markdown, HTML, or plain text - up to 25 MB
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
