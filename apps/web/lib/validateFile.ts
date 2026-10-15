import { MAX_FILE_BYTES } from "./contracts";

const ACCEPTED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Client-side mirror of the server multer check (docs/PRD.md §5.1). */
export function validateFile(file: File): string | null {
  if (!ACCEPTED.has(file.type)) {
    return "That file type isn't supported. Upload a PDF, JPG, PNG, DOC or DOCX.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) {
    return `That file is too big (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.`;
  }
  return null;
}
