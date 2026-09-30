"use client";

import { useRef, useState, type DragEvent } from "react";
import { upload } from "@vercel/blob/client";
import { Check, FileText, ImageIcon, LoaderCircle, UploadCloud, X } from "lucide-react";
import type { StudioLimits, UploadKind, UploadRecord } from "@/lib/contracts";
import { api, formatBytes } from "./studio-context";

export interface SelectedUpload { key: string; name: string; size: number; progress: number; record?: UploadRecord; error?: string }
const kinds = { prd: ".pdf,.md,.txt", asset: ".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm", reference: ".mp4,.mov,.webm" };
const mimes: Record<string, string> = { pdf: "application/pdf", md: "text/markdown", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

export function UploadField({ kind, files, onChange, limits, disabled = false, otherFiles = [] }: { kind: UploadKind; files: SelectedUpload[]; onChange: (files: SelectedUpload[]) => void; limits: StudioLimits; disabled?: boolean; otherFiles?: SelectedUpload[] }) {
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(files); latest.current = files;
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const multiple = kind === "asset";
  const maxBytes = kind === "prd" ? limits.maxPrdBytes : kind === "reference" ? limits.maxReferenceBytes : limits.maxFileBytes;
  function update(key: string, values: Partial<SelectedUpload>) { latest.current = latest.current.map((item) => item.key === key ? { ...item, ...values } : item); onChange(latest.current); }
  async function send(file: File, key: string) {
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const contentType = mimes[extension] || file.type;
      const prepared = await api<{ upload: UploadRecord & { pathname: string } }>("/api/uploads/prepare", { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType, kind }) });
      await upload(prepared.upload.pathname, file, { access: "private", contentType: prepared.upload.contentType, handleUploadUrl: "/api/uploads", clientPayload: JSON.stringify({ uploadId: prepared.upload.id }), multipart: file.size > 5_000_000, onUploadProgress: ({ percentage }) => update(key, { progress: Math.min(99, Math.round(percentage)) }) });
      const completed = await api<{ upload: UploadRecord }>("/api/uploads/complete", { method: "POST", body: JSON.stringify({ uploadId: prepared.upload.id }) });
      update(key, { record: completed.upload, progress: 100 });
    } catch (error) { update(key, { error: error instanceof Error ? error.message : "Upload failed. Remove this file and try again." }); }
  }
  function addFiles(picked: File[]) {
    if (disabled || !picked.length) return;
    setError(null);
    if (!multiple && (picked.length > 1 || latest.current.length)) { setError("Remove the current file before choosing another."); return; }
    if (latest.current.length + otherFiles.length + picked.length > limits.maxFiles) { setError(`You can add up to ${limits.maxFiles} files in total.`); return; }
    const total = [...latest.current, ...otherFiles].reduce((sum, item) => sum + item.size, 0) + picked.reduce((sum, item) => sum + item.size, 0);
    if (total > limits.maxTotalBytes) { setError(`Keep all uploads under ${formatBytes(limits.maxTotalBytes)} in total.`); return; }
    for (const file of picked) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!kinds[kind].split(",").includes(extension)) { setError(`${file.name}: choose a supported ${kind === "prd" ? "PDF, Markdown, or text file" : kind === "reference" ? "MP4, MOV, or WebM video" : "image or screen recording"}.`); return; }
      if (file.size === 0 || file.size > maxBytes) { setError(`${file.name}: the file must be nonempty and under ${formatBytes(maxBytes)}.`); return; }
    }
    const newItems = picked.map((file) => ({ key: crypto.randomUUID(), name: file.name, size: file.size, progress: 0 }));
    latest.current = [...latest.current, ...newItems]; onChange(latest.current);
    picked.forEach((file, index) => { void send(file, newItems[index].key); });
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }
  return <div className="upload-field"><input ref={input} type="file" className="visually-hidden" aria-label={kind === "prd" ? "Choose a product brief" : kind === "reference" ? "Choose a reference video" : "Choose product images or recordings"} accept={kinds[kind]} multiple={multiple} disabled={disabled} tabIndex={-1} onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }}/>
    {(multiple || files.length === 0) && <button type="button" disabled={disabled} className={`upload-zone${dragging ? " dragging" : ""}${kind === "prd" ? " upload-zone-large" : ""}`} onClick={() => input.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><span className="upload-icon">{kind === "prd" ? <FileText size={22} strokeWidth={1.5}/> : <UploadCloud size={22} strokeWidth={1.5}/>}</span><span><strong>{kind === "prd" ? "Drop your product brief here" : kind === "reference" ? "Drop a reference video here" : "Add images or screen recordings"}</strong><span className="upload-caption">or <u>browse files</u> · {kind === "prd" ? "PDF, MD, TXT" : kind === "reference" ? "MP4, MOV, WebM" : "PNG, JPG, WebP, MP4, MOV, WebM"}</span></span></button>}
    {files.length > 0 && <ul className="upload-list">{files.map((item) => <li key={item.key} className={item.error ? "upload-error" : ""}><span className="file-symbol">{kind === "prd" ? <FileText size={18}/> : <ImageIcon size={18}/>}</span><span className="file-details"><strong title={item.name}>{item.name}</strong><span>{item.error || `${formatBytes(item.size)} · ${item.record ? "Ready" : item.progress === 99 ? "Checking file…" : `Uploading ${item.progress}%`}`}</span>{!item.record && !item.error && <span className="upload-progress"><span style={{ width: `${item.progress}%` }}/></span>}</span>{item.record ? <Check className="upload-check" size={17}/> : !item.error && <LoaderCircle className="spin" size={17}/>}<button type="button" className="icon-button" aria-label={`Remove ${item.name}`} disabled={disabled || (!item.record && !item.error)} onClick={() => { latest.current = latest.current.filter((file) => file.key !== item.key); onChange(latest.current); }}><X size={16}/></button></li>)}</ul>}
    {error && <p className="form-error" role="alert">{error}</p>}<p className="field-hint upload-limit">Up to {formatBytes(maxBytes)} per file{kind === "asset" ? ` · recordings up to ${Math.floor(limits.maxSourceDurationSeconds / 60)} min` : kind === "reference" ? ` · up to ${Math.floor(limits.maxReferenceDurationSeconds / 60)} min` : " · text-based documents"}.</p>
  </div>;
}
