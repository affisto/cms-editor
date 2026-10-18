import { FormKit, type Submission } from "cms-editor-form";
import {
  parseDocument as parseCoreDocument,
  type CMSDocument,
} from "cms-editor-core";
export interface DocumentStorage {
  load(): CMSDocument | null;
  save(document: CMSDocument): void;
}
const key = "cms-editor:document:v1";
const archivePrefix = "cms-editor:draft:";
export function listDocuments(): CMSDocument[] {
  const documents: CMSDocument[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i);
    if (!name?.startsWith(archivePrefix)) continue;
    // A broken draft must not prevent access to other drafts. Its bytes remain untouched.
    try {
      documents.push(parseDocument(localStorage.getItem(name)));
    } catch {
      /* recover via browser storage export */
    }
  }
  return documents;
}
export const browserStorage: DocumentStorage = {
  load() {
    const value = localStorage.getItem(key);
    return value ? parseDocument(value) : null;
  },
  save(document) {
    localStorage.setItem(archivePrefix + document.id, JSON.stringify(document));
    localStorage.setItem(key, JSON.stringify(document));
  },
};
export function saveResponse(submission: Submission) {
  const key = `cms-editor:responses:${submission.documentId}`;
  const previous = JSON.parse(localStorage.getItem(key) || "[]") as unknown;
  if (!Array.isArray(previous))
    throw new Error("저장된 응답을 읽을 수 없습니다.");
  localStorage.setItem(
    key,
    JSON.stringify([
      ...previous,
      { ...submission, submittedAt: new Date().toISOString() },
    ]),
  );
}
export function loadResponses(documentId: string): unknown[] {
  const raw: unknown = JSON.parse(
    localStorage.getItem(`cms-editor:responses:${documentId}`) || "[]",
  );
  if (!Array.isArray(raw)) throw new Error("응답 데이터가 올바르지 않습니다.");
  return raw;
}
export function readImage(
  file: File,
  signal: AbortSignal,
): Promise<{ src: string; alt: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener("abort", abort, { once: true });
    const clean = () => signal.removeEventListener("abort", abort);
    reader.onload = () => {
      clean();
      resolve({ src: String(reader.result), alt: file.name });
    };
    reader.onerror = () => {
      clean();
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    reader.onabort = () => {
      clean();
      reject(new Error("이미지 업로드가 취소되었습니다."));
    };
    if (signal.aborted) {
      clean();
      reject(new Error("이미지 업로드가 취소되었습니다."));
      return;
    }
    reader.readAsDataURL(file);
  });
}
export function downloadJSON(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseDocument(value: unknown) {
  return parseCoreDocument(value, [FormKit]);
}
