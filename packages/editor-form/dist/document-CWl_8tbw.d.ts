import { CMSDocument, JSONNode } from 'cms-editor-core';

type Answers = Record<string, string | string[]>;
interface Submission {
    documentId: string;
    schemaVersion: 1;
    answers: Answers;
}
declare function collectFields(doc: CMSDocument): JSONNode[];
declare function validateAnswers(doc: CMSDocument, answers: Answers): Record<string, string>;
declare function createSubmission(doc: CMSDocument, answers: Answers): Submission;

export { type Answers as A, type Submission as S, createSubmission as a, collectFields as c, validateAnswers as v };
