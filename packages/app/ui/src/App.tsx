import { useLocale } from "./locale.js";
import { errorKey, UiError, type MessageKey } from "./messages.js";
import { useEffect, useRef, useState } from "react";

import { fetchProfiles, judgeAsset } from "./api";
import { DropZone } from "./components/DropZone";
import { ProfilePicker } from "./components/ProfilePicker";
import { VerdictPanel } from "./components/VerdictPanel";
import type { JudgeFailure, JudgeReport, ProfileSummary } from "./types";

type ResultState =
  | { kind: "idle" }
  | { kind: "ok"; report: JudgeReport; serialized: string }
  | { kind: "infra"; failure: JudgeFailure }
  | { kind: "error"; message: MessageKey };

export function App() {
  const { locale, setLocale, t } = useLocale();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [profileFile, setProfileFile] = useState("web-commerce.json");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [bootError, setBootError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);

  const [attempt, setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setBootError(null);
    void (async () => {
      try {
        const list = await fetchProfiles(controller.signal);
        if (list.length === 0) throw new UiError("noProfiles");
        setProfiles(list);
        const preferred =
          list.find((p) => p.filename === "web-commerce.json") ?? list[0];
        if (preferred !== undefined) {
          setProfileFile(preferred.filename);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setBootError(errorKey(error));
      }
    })();
    return () => {
      controller.abort();
    };
  }, [attempt]);

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  async function runJudge(): Promise<void> {
    if (file === null || pending || profiles.length === 0) {
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setResult({ kind: "idle" });
    setPending(true);
    try {
      const response = await judgeAsset(file, profileFile, controller.signal);
      if (response.ok) {
        setResult({
          kind: "ok",
          report: response.report,
          serialized: response.serialized,
        });
      } else {
        setResult({ kind: "infra", failure: response });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setResult({
          kind: "error",
          message: "cancelled",
        });
        return;
      }
      setResult({
        kind: "error",
        message: errorKey(error),
      });
    } finally {
      active.current = null;
      setPending(false);
    }
  }

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />

      <header className="brand">
        <div className="brand__identity">
          <p className="brand__mark">judg3d</p>
          <p className="brand__tag">{t.tagline}</p>
        </div>
        <label className="field language-picker">
          <span className="field__label">{t.language}</span>
          <select
            className="field__control"
            value={locale}
            onChange={(event) => {
              setLocale(event.target.value === "pt-BR" ? "pt-BR" : "en");
            }}
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="pt-BR" lang="pt-BR">
              Português (Brasil)
            </option>
          </select>
        </label>
      </header>

      <main className="stage" aria-busy={pending}>
        <section className="compose">
          <DropZone
            file={file}
            disabled={pending}
            onFile={(next) => {
              setFile(next);
              setResult({ kind: "idle" });
            }}
          />

          <div className="compose__rail">
            <ProfilePicker
              profiles={profiles}
              value={profileFile}
              disabled={pending}
              onChange={(value) => {
                setProfileFile(value);
                setResult({ kind: "idle" });
              }}
            />

            <button
              type="button"
              className="btn btn--primary"
              disabled={
                file === null ||
                pending ||
                bootError !== null ||
                profiles.length === 0
              }
              onClick={() => {
                void runJudge();
              }}
            >
              {pending ? t.judging : t.judge}
            </button>

            <p className="compose__coverage">
              {t.checks}:{" "}
              {profiles
                .find((profile) => profile.filename === profileFile)
                ?.layers.join(" · ") ?? t.loading}
              .
              <br />
              {t.scope}
            </p>
            {pending ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  active.current?.abort();
                }}
              >
                {t.cancel}
              </button>
            ) : null}
            {bootError !== null ? (
              <p className="banner banner--warn" role="alert">
                {t[bootError]}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setAttempt((value) => value + 1);
                  }}
                >
                  {t.reconnect}
                </button>
              </p>
            ) : null}
          </div>
        </section>

        {result.kind === "ok" ? (
          <VerdictPanel
            key={`${result.report.asset.sha256}:${result.report.profile.sha256}`}
            report={result.report}
            serialized={result.serialized}
          />
        ) : null}

        {result.kind === "infra" ? (
          <section className="banner banner--infra" role="alert">
            <strong>{t.infra}</strong>
            <p>{t[result.failure.code]}</p>
            {result.failure.detail !== undefined ? (
              <pre>{result.failure.detail}</pre>
            ) : null}
            <p className="banner__note">{t.infraNote}</p>
          </section>
        ) : null}

        {result.kind === "error" ? (
          <section className="banner banner--warn" role="alert">
            {t[result.message]}
          </section>
        ) : null}
      </main>

      <footer className="foot">
        <span>{t.local}</span>
        <span>{t.privacy}</span>
      </footer>
    </div>
  );
}
