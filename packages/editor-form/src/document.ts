import type { CMSDocument, JSONNode } from "cms-editor-core";
export type Answers = Record<string, string | string[]>;
export interface Submission {
  documentId: string;
  schemaVersion: 1;
  answers: Answers;
}
export function collectFields(doc: CMSDocument): JSONNode[] {
  const fields: JSONNode[] = [];
  const walk = (n: JSONNode) => {
    if (n.type === "field") fields.push(n);
    n.content?.forEach(walk);
  };
  walk(doc.content);
  return fields;
}
export function validateAnswers(
  doc: CMSDocument,
  answers: Answers,
): Record<string, string> {
  const errors: Record<string, string> = Object.create(null);
  for (const field of collectFields(doc)) {
    const a = field.attrs!,
      key = String(a.fieldId),
      value = Object.prototype.hasOwnProperty.call(answers, key)
        ? answers[key]
        : undefined;
    const missing =
      value === undefined ||
      (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && value.length === 0);
    if (missing) {
      if (a.required) errors[key] = "필수 질문에 답해주세요.";
      continue;
    }
    if (a.kind === "checkbox") {
      if (
        !Array.isArray(value) ||
        !value.every((x) => (a.options as string[]).includes(x)) ||
        new Set(value).size !== value.length
      )
        errors[key] = "올바른 선택지를 선택하세요.";
    } else if (typeof value !== "string")
      errors[key] = "올바른 답변을 입력하세요.";
    else if (value.length > 100000) errors[key] = "답변이 너무 깁니다.";
    else if (a.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      errors[key] = "이메일 주소를 확인하세요.";
    else if (
      ["radio", "select"].includes(String(a.kind)) &&
      !(a.options as string[]).includes(value)
    )
      errors[key] = "올바른 선택지를 선택하세요.";
    else if (a.kind === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) errors[key] = "숫자를 입력하세요.";
      else if (a.min !== null && number < Number(a.min))
        errors[key] = `${a.min} 이상 입력하세요.`;
      else if (a.max !== null && number > Number(a.max))
        errors[key] = `${a.max} 이하 입력하세요.`;
    }
  }
  return errors;
}
export function createSubmission(
  doc: CMSDocument,
  answers: Answers,
): Submission {
  if (Object.keys(validateAnswers(doc, answers)).length)
    throw new Error("답변을 확인해주세요.");
  const clean: Answers = Object.create(null);
  for (const f of collectFields(doc)) {
    const key = String(f.attrs!.fieldId);
    if (Object.prototype.hasOwnProperty.call(answers, key))
      clean[key] = Array.isArray(answers[key])
        ? [...answers[key]]
        : answers[key];
  }
  return { documentId: doc.id, schemaVersion: 1, answers: clean };
}
