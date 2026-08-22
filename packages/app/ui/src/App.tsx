import { useEffect, useState } from "react";

import { fetchProfiles, judgeAsset } from "./api";
import { DropZone } from "./components/DropZone";
import { ProfilePicker } from "./components/ProfilePicker";
import { VerdictPanel } from "./components/VerdictPanel";
import type { JudgeFailure, JudgeReport, ProfileSummary } from "./types";

type ResultState =
  | { kind: "idle" }
  | { kind: "ok"; report: JudgeReport; serialized: string }
  | { kind: "infra"; failure: JudgeFailure }
  | { kind: "error"; message: string };

export function App() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [profileFile, setProfileFile] = useState("web-commerce.json");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [bootError, setBootError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchProfiles();
        setProfiles(list);
        const preferred =
          list.find((p) => p.filename === "web-commerce.json") ?? list[0];
        if (preferred !== undefined) {
          setProfileFile(preferred.filename);
        }
      } catch (error) {
        setBootError(
          error instanceof Error
            ? error.message
            : "Nao consegui falar com a API local.",
        );
      }
    })();
  }, []);

  async function runJudge(): Promise<void> {
    if (file === null || pending) {
      return;
    }
    setPending(true);
    try {
      const response = await judgeAsset(file, profileFile);
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
      setResult({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Falha de rede ao chamar /api/judge.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />

      <header className="brand">
        <p className="brand__mark">judg3d</p>
        <p className="brand__tag">
          Juiz de aceitação local. Mesmas regras do profile, mesmo veredito.
        </p>
      </header>

      <main className="stage">
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
              onChange={setProfileFile}
            />

            <button
              type="button"
              className="btn btn--primary"
              disabled={file === null || pending || bootError !== null}
              onClick={() => {
                void runJudge();
              }}
            >
              {pending ? "Julgando…" : "Julgar asset"}
            </button>

            {bootError !== null ? (
              <p className="banner banner--warn" role="alert">
                {bootError} Suba a API com <code>pnpm app:dev</code>.
              </p>
            ) : null}
          </div>
        </section>

        {result.kind === "ok" ? (
          <VerdictPanel report={result.report} serialized={result.serialized} />
        ) : null}

        {result.kind === "infra" ? (
          <section className="banner banner--infra" role="alert">
            <strong>Falha de infraestrutura</strong>
            <p>{result.failure.message}</p>
            {result.failure.detail !== undefined ? (
              <pre>{result.failure.detail}</pre>
            ) : null}
            <p className="banner__note">
              Isto não é reprovação do asset (equivalente a exit 2).
            </p>
          </section>
        ) : null}

        {result.kind === "error" ? (
          <section className="banner banner--warn" role="alert">
            {result.message}
          </section>
        ) : null}
      </main>

      <footer className="foot">
        <span>L1 SCHEMA via Khronos · profile-as-code</span>
        <span>relatório sem timestamp por padrão</span>
      </footer>
    </div>
  );
}
