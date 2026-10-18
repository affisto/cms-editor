"use client";
import * as React from "react";
import { CMSEditor, CMSRenderer } from "cms-editor-react";
import {
  getBlockChoices,
  type EditorInstance,
  type SelectedBlock,
} from "cms-editor-core/browser";
import {
  createDocument,
  documentTemplate,
  parseDocument,
  type CMSDocument,
} from "cms-editor-core";
import { CMSForm, FormKit } from "cms-editor-form/react";
import { collectFields, formTemplate, type Submission } from "cms-editor-form";
const extensions = [FormKit];
const blockChoices = getBlockChoices(extensions);
import {
  browserStorage,
  downloadJSON,
  loadResponses,
  listDocuments,
  readImage,
  saveResponse,
} from "./storage";
function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    panels: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16M16 4v16" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    file: (
      <>
        <path d="M14 2H5v20h14V7Z" />
        <path d="M14 2v5h5M8 12h8m-8 4h8" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    back: <path d="m14 5-7 7 7 7" />,
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.file}
    </svg>
  );
}
export default function Studio() {
  const [doc, setDoc] = React.useState<CMSDocument | null>(null),
    [mode, setMode] = React.useState<"edit" | "preview" | "read">("edit"),
    [status, setStatus] = React.useState("불러오는 중"),
    [error, setError] = React.useState(""),
    [query, setQuery] = React.useState(""),
    [tab, setTab] = React.useState<"blocks" | "outline">("blocks"),
    [selected, setSelected] = React.useState<SelectedBlock | null>(null),
    [mobile, setMobile] = React.useState(false),
    [responseCount, setResponseCount] = React.useState(0),
    [menu, setMenu] = React.useState(false),
    [newMenu, setNewMenu] = React.useState(false),
    [saved, setSaved] = React.useState(true),
    [saveEnabled, setSaveEnabled] = React.useState(true);
  const [drafts, setDrafts] = React.useState<CMSDocument[]>([]);
  const [showPanels, setShowPanels] = React.useState(false);
  const editor = React.useRef<EditorInstance | null>(null),
    inspector = React.useRef<HTMLElement>(null),
    file = React.useRef<HTMLInputElement>(null),
    drag = React.useRef<number | null>(null);
  React.useEffect(() => {
    try {
      setShowPanels(localStorage.getItem("cms-editor:panels") === "visible");
    } catch {
      /* preference is optional */
    }
  }, []);
  React.useEffect(() => {
    if (mode !== "edit") editor.current?.closeInspector();
  }, [mode]);
  const togglePanels = () => {
    const next = !showPanels;
    setShowPanels(next);
    try {
      localStorage.setItem("cms-editor:panels", next ? "visible" : "hidden");
    } catch {
      /* preference is optional */
    }
  };
  React.useEffect(() => {
    try {
      const loaded = browserStorage.load() || formTemplate();
      setDoc(loaded);
      setStatus("이 브라우저에 저장됨");
      setResponseCount(loadResponses(loaded.id).length);
      setDrafts(listDocuments());
      setSaved(false);
    } catch (reason) {
      setError(
        `저장된 문서를 열지 못했습니다. ${reason instanceof Error ? reason.message : ""} 새 문서를 선택하거나 JSON을 가져와 복구하세요.`,
      );
      setSaveEnabled(false);
      setDoc(formTemplate());
      setStatus("복구 필요");
    }
  }, []);
  React.useEffect(() => {
    if (!doc || !saveEnabled || saved) return;
    const timer = setTimeout(() => {
      try {
        browserStorage.save(doc);
        setStatus("이 브라우저에 저장됨");
        setSaved(true);
        setDrafts(listDocuments());
      } catch {
        setStatus("저장하지 못함");
        setError(
          "브라우저 저장 공간이 부족하거나 사용할 수 없습니다. JSON 내보내기로 문서를 보관하세요.",
        );
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [doc, saved, saveEnabled]);
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  const change = React.useCallback((value: CMSDocument) => {
    setDoc(value);
    setSaved(false);
    setStatus("저장 중…");
  }, []);
  const replace = (value: CMSDocument) => {
    if (doc && saveEnabled) {
      try {
        browserStorage.save(doc);
      } catch {
        setError(
          "현재 문서를 보관하지 못했습니다. JSON으로 내보낸 뒤 다시 시도하세요.",
        );
        return;
      }
    }
    setDoc(value);
    editor.current?.setDocument(value);
    setSaveEnabled(true);
    setSaved(false);
    setStatus("저장 중…");
    setError("");
    setMode("edit");
    setNewMenu(false);
    try {
      setResponseCount(loadResponses(value.id).length);
    } catch {
      setResponseCount(0);
    }
  };
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = event.target.files?.[0];
    if (!incoming) return;
    try {
      if (incoming.size > 8 * 1024 * 1024)
        throw new Error("문서 파일은 8MB 이하여야 합니다.");
      replace(parseDocument(await incoming.text(), extensions));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "문서를 가져오지 못했습니다.",
      );
    }
    event.target.value = "";
  }
  async function submit(submission: Submission) {
    saveResponse(submission);
    setResponseCount(loadResponses(submission.documentId).length);
  }
  const insert = (type: string, attrs?: Record<string, unknown>) => {
    setMode("edit");
    if (editor.current) editor.current.insert(type, attrs);
  };
  const exportResponses = () => {
    if (doc)
      try {
        downloadJSON(loadResponses(doc.id), "responses.json");
      } catch {
        setError("응답을 내보내지 못했습니다.");
      }
  };
  const fields = doc ? collectFields(doc) : [],
    blocks = doc?.content.content || [];
  return (
    <div className="studio">
      <header className="studio-header">
        <a href="/" className="wordmark" aria-label="Blockroom 홈">
          <span className="brand-mark">b.</span>
          <span>blockroom</span>
        </a>
        <span className="workspace-label">
          내 작업 공간 <span>/</span> 폼 만들기
        </span>
        <div className="header-actions">
          {mode === "edit" && (
            <button
              className="secondary-button panel-toggle"
              onClick={togglePanels}
              aria-label="사이드 패널"
              aria-pressed={showPanels}
              aria-controls="block-library block-settings"
              title={showPanels ? "사이드 패널 숨기기" : "사이드 패널 표시"}
            >
              <Icon name="panels" />
              <span>패널</span>
            </button>
          )}
          <span
            className={`save-state ${saved ? "" : "pending"}`}
            role="status"
          >
            <Icon name="check" />
            {status}
          </span>
          <div className="menu-anchor">
            <button
              className="quiet-button"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              aria-label="문서 메뉴"
            >
              ···
            </button>
            {menu && (
              <div className="action-menu">
                <button
                  onClick={() => {
                    if (doc) downloadJSON(doc, "document.json");
                    setMenu(false);
                  }}
                >
                  문서 JSON 내보내기
                </button>
                <button
                  onClick={() => {
                    file.current?.click();
                    setMenu(false);
                  }}
                >
                  문서 JSON 가져오기
                </button>
                <button
                  onClick={() => {
                    exportResponses();
                    setMenu(false);
                  }}
                >
                  응답 내보내기 ({responseCount})
                </button>
              </div>
            )}
          </div>
          <button
            className={mode === "edit" ? "primary-button" : "secondary-button"}
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
          >
            <Icon name={mode === "edit" ? "eye" : "back"} />
            {mode === "edit" ? "미리보기" : "편집으로"}
          </button>
        </div>
      </header>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={importFile}
      />
      {error && (
        <div className="studio-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}
      <div
        className="studio-body"
        data-panels={showPanels && mode === "edit" ? "visible" : "hidden"}
      >
        <aside
          id="block-library"
          className="library-panel"
          hidden={!showPanels || mode !== "edit"}
        >
          <div className="library-heading">
            <span className="eyebrow">블록 도구</span>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="블록 도구">
            <button
              role="tab"
              aria-selected={tab === "blocks"}
              onClick={() => setTab("blocks")}
            >
              블록 추가
            </button>
            <button
              role="tab"
              aria-selected={tab === "outline"}
              onClick={() => setTab("outline")}
            >
              문서 구조 <span>{blocks.length}</span>
            </button>
          </div>
          {tab === "blocks" ? (
            <>
              <label className="block-search">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="블록 찾기"
                  aria-label="블록 찾기"
                />
                <kbd>/</kbd>
              </label>
              <div className="library-groups">
                {(["질문", "문서"] as const).map((group) => (
                  <section key={group}>
                    <h2>
                      {group === "질문"
                        ? "답변을 받는 블록"
                        : "내용을 전하는 블록"}
                    </h2>
                    <div className="block-library">
                      {blockChoices
                        .filter(
                          (c) => c.group === group && c.label.includes(query),
                        )
                        .map((c) => (
                          <button
                            key={`${c.type}-${c.attrs?.kind || ""}`}
                            onClick={() => insert(c.type, c.attrs)}
                            disabled={mode !== "edit" || !doc}
                            aria-label={`${c.label} 추가`}
                          >
                            <span className="block-icon">{c.icon}</span>
                            <span>{c.label}</span>
                            <span className="block-add">+</span>
                          </button>
                        ))}
                    </div>
                  </section>
                ))}
                {!blockChoices.some((c) => c.label.includes(query)) && (
                  <p className="empty-message">검색 결과가 없습니다.</p>
                )}
              </div>
            </>
          ) : (
            <div className="outline-list">
              <p>끌어서 순서를 바꾸세요.</p>
              {blocks.map((block, index) => (
                <button
                  key={String(block.attrs?.id)}
                  draggable={mode === "edit"}
                  onDragStart={() => {
                    drag.current = index;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag.current !== null)
                      editor.current?.moveBlock(drag.current, index);
                    drag.current = null;
                  }}
                  onClick={() => {
                    if (mode === "edit") {
                      editor.current?.selectBlock(index);
                      editor.current?.view.dispatch(
                        editor.current.view.state.tr.scrollIntoView(),
                      );
                    }
                  }}
                  className={selected?.index === index ? "active" : ""}
                >
                  <span className="drag-handle">⠿</span>
                  <span>
                    {String(
                      block.attrs?.label ||
                        block.content?.[0]?.text ||
                        blockChoices.find((c) => c.type === block.type)
                          ?.label ||
                        block.type,
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="library-foot">
            <span className="tiny-mark">↳</span>
            <p>
              질문과 이야기를
              <br />
              하나의 문서 안에.
            </p>
          </div>
        </aside>
        <main className="canvas-area">
          <div className="document-controls">
            <div className="library-heading">
              <span className="eyebrow">만들기</span>
              <div className="menu-anchor">
                <button
                  className="new-button"
                  onClick={() => setNewMenu(!newMenu)}
                  aria-expanded={newMenu}
                >
                  <Icon name="plus" />새 문서
                </button>
                {newMenu && (
                  <div className="action-menu">
                    <p>현재 문서는 내 문서에 보관됩니다.</p>
                    <button
                      onClick={() => replace(createDocument("새로운 폼"))}
                    >
                      빈 문서
                    </button>
                    <button onClick={() => replace(formTemplate())}>
                      모임 신청 폼
                    </button>
                    <button onClick={() => replace(documentTemplate())}>
                      팀 작업 노트
                    </button>
                  </div>
                )}
              </div>
            </div>
            <label className="draft-select">
              <span>내 문서</span>
              <select
                aria-label="내 문서"
                value={doc?.id || ""}
                onChange={(event) => {
                  const draft = drafts.find((d) => d.id === event.target.value);
                  if (draft) replace(draft);
                }}
              >
                {doc && !drafts.some((d) => d.id === doc.id) && (
                  <option value={doc.id}>
                    {doc.title || "제목 없는 문서"}
                  </option>
                )}
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.id === doc?.id
                      ? doc.title
                      : draft.title || "제목 없는 문서"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="canvas-header">
            <div>
              <span className="eyebrow">
                {mode === "edit"
                  ? "폼 편집"
                  : mode === "preview"
                    ? "응답 미리보기"
                    : "게시 문서"}
              </span>
              <p>
                {mode === "edit"
                  ? "블록을 추가하고, 나만의 흐름을 만드세요."
                  : "작성한 내용을 방문자의 시선으로 확인하세요."}
              </p>
            </div>
            <span className="document-badge">
              <Icon name="file" />
              {fields.length}개 질문
            </span>
          </div>
          {mode !== "edit" && (
            <div className="preview-controls">
              <div className="segmented">
                <button
                  className={mode === "preview" ? "active" : ""}
                  onClick={() => setMode("preview")}
                >
                  응답 화면
                </button>
                <button
                  className={mode === "read" ? "active" : ""}
                  onClick={() => setMode("read")}
                >
                  게시 문서
                </button>
              </div>
              <button
                className="secondary-button"
                onClick={() => setMobile(!mobile)}
              >
                {mobile ? "전체 너비" : "모바일 너비"}
              </button>
            </div>
          )}
          <div
            className={`paper ${mobile && mode !== "edit" ? "mobile-paper" : ""}`}
          >
            <div className="paper-meta">
              <span className="paper-accent" />
              <span>{mode === "edit" ? "DRAFT" : "PREVIEW"}</span>
              <span className="paper-meta-note">
                {mode === "edit"
                  ? "마음껏 수정해보세요"
                  : "이 브라우저에서만 실행되는 미리보기"}
              </span>
            </div>
            <label className="document-name">
              <span>문서 이름</span>
              <input
                aria-label="문서 이름"
                value={doc?.title || ""}
                maxLength={500}
                readOnly={mode !== "edit"}
                onChange={(e) => {
                  editor.current?.setTitle(e.target.value);
                }}
              />
            </label>
            <div hidden={mode !== "edit"}>
              {doc ? (
                <CMSEditor
                  extensions={extensions}
                  document={doc}
                  onChange={change}
                  onReady={(instance) => {
                    editor.current = instance;
                  }}
                  onSelection={setSelected}
                  inspectorRef={inspector}
                  inspectorMode={showPanels ? "inline" : "popover"}
                  uploadImage={readImage}
                  onError={(reason) => setError(reason.message)}
                />
              ) : (
                <p className="loading-message">문서를 준비하고 있습니다.</p>
              )}
            </div>
            {doc && mode === "preview" && (
              <div className="preview-content">
                <CMSForm
                  document={doc}
                  onSubmit={submit}
                  successMessage="신청이 완료되었습니다. 이 미리보기의 응답은 현재 브라우저에 저장됩니다."
                />
              </div>
            )}
            {doc && mode === "read" && (
              <div className="preview-content">
                <CMSRenderer extensions={extensions} document={doc} />
              </div>
            )}
          </div>
          <footer className="canvas-footer">
            <span>
              {mode === "edit"
                ? "/ 블록 추가 · 질문 문구 바로 수정 · 왼쪽 핸들로 순서 변경"
                : "미리보기 응답은 상단 문서 메뉴에서 내보낼 수 있어요."}
            </span>
            <span>blockroom / 0.1</span>
          </footer>
        </main>
        <aside
          id="block-settings"
          className="settings-panel"
          hidden={!showPanels || mode !== "edit"}
        >
          <div className="settings-top">
            <span className="eyebrow">세부 설정</span>
            <span className="settings-dot" />
          </div>
          <div
            ref={inspector as React.RefObject<HTMLDivElement>}
            className="inspector-host"
          />
          <div className="settings-tip">
            <strong>어디부터 시작할까요?</strong>
            <p>
              질문 제목, 설명과 선택지는 본문에서 바로 수정하세요. 필수 여부도
              블록 안에서 바꿀 수 있어요.
            </p>
            <p>이곳에서는 블록을 복제하거나 순서를 바꿀 수 있어요.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
