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

export function messageFromGot(got: unknown): string | undefined {
  if (typeof got === "object" && got !== null && "message" in got) {
    const { message } = got;
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function shortHash(hex: string): string {
  return hex.slice(0, 12);
}
