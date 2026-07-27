import { useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FileUploaderProps {
  label?: string;
  accept?: string;
  variant?: "photo" | "document";
  hint?: string;
  onFile?: (file: File | null) => void;
  maxSizeBytes?: number;
}

export function FileUploader({
  label = "Upload file",
  accept = "image/*",
  variant = "photo",
  hint,
  onFile,
  maxSizeBytes,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && maxSizeBytes && f.size > maxSizeBytes) {
      toast.error(`File must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)} MB`);
      e.target.value = "";
      return;
    }
    setFile(f);
    onFile?.(f);
    if (f && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
    if (f) toast.success(`${f.name} attached`);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    onFile?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePick}
        className={`relative w-full ${variant === "photo" ? "aspect-square" : "min-h-24"} rounded-xl border-2 border-dashed bg-muted/30 grid place-items-center text-xs text-muted-foreground hover:bg-muted/50 transition overflow-hidden`}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="absolute inset-0 h-full w-full object-cover" />
        ) : file ? (
          <div className="flex flex-col items-center gap-2 p-4">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-xs font-medium text-foreground truncate max-w-full">{file.name}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            <Upload className="h-6 w-6" />
            <span>{label}</span>
          </div>
        )}
        {(preview || file) && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 h-7 w-7 rounded-full"
            onClick={clear}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}
