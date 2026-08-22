import type { JudgeResponse, ProfileSummary } from "./types";

export async function fetchProfiles(): Promise<ProfileSummary[]> {
  const res = await fetch("/api/profiles");
  if (!res.ok) {
    throw new Error(`Falha ao listar profiles (${String(res.status)}).`);
  }
  const body = (await res.json()) as { profiles: ProfileSummary[] };
  return body.profiles;
}

export async function judgeAsset(
  file: File,
  profileFilename: string,
): Promise<JudgeResponse> {
  const form = new FormData();
  form.set("asset", file, file.name);
  form.set("profile", profileFilename);

  const res = await fetch("/api/judge", {
    method: "POST",
    body: form,
  });

  const body = (await res.json()) as JudgeResponse;
  return body;
}

// `messageFromGot`, `formatBytes` e `shortHash` viviam aqui, duplicados. Agora
// vem de `@judg3d/core/present`, que e o unico modulo do core sem `node:` e
// existe exatamente para ser importado pelo browser.
export {
  formatBytes,
  shortHash,
  violationDetail,
} from "@judg3d/core/present";
