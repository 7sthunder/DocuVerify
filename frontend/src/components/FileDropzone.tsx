import { useRef, useState } from "react";
import type { DragEvent } from "react";

interface FileDropzoneProps {
  file: File | null;
  onSelect: (file: File | null) => void;
  label: string;
  hint?: string;
  accent?: boolean;
  onRemove?: () => void;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png";

export default function FileDropzone({
  file,
  onSelect,
  label,
  hint,
  accent,
  onRemove,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (list && list.length > 0) onSelect(list[0]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="border rounded-lg p-4">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-2 w-full cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragging
            ? "border-slate-900 bg-slate-50"
            : file
              ? "border-slate-300 bg-slate-50"
              : accent
                ? "border-slate-400 bg-white hover:border-slate-900 hover:bg-slate-50"
                : "border-slate-300 bg-white hover:border-slate-900 hover:bg-slate-50"
        }`}
      >
        {file ? (
          <p className="font-medium text-slate-800">
            <span className="text-emerald-600">✓</span> {file.name}
          </p>
        ) : (
          <>
            <p className="font-medium text-slate-700">Drop a file here</p>
            <p className="mt-1 text-xs text-slate-400">or click to browse (PDF, JPG, PNG)</p>
          </>
        )}
      </div>
      {file && onRemove && (
        <button onClick={onRemove} className="mt-1 text-xs text-red-500 hover:underline">
          Remove
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}