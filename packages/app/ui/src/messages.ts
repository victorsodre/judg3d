export const messages = {
  en: {
    language: "Language",
    tagline: "Local asset validation. Same profile rules, same verdict.",
    asset: "Asset",
    profile: "Profile",
    dropTitle: "Drop your GLB here",
    dropHint: "or click to choose · .glb / .gltf · up to 64 MB",
    changeFile: "click to change",
    fileTooLarge: "Choose a file no larger than 64 MB.",
    noProfiles: "No profiles available. Configure a profile to get started.",
    judge: "Judge asset",
    judging: "Judging…",
    cancel: "Cancel analysis",
    cancelled: "Analysis cancelled. No verdict was produced.",
    reconnect: "Reconnect",
    loading: "loading…",
    checks: "Checks",
    scope: "Appearance, geometry and semantics are not evaluated yet.",
    infra: "Analysis could not be completed",
    infraNote: "No verdict was produced (exit code 2).",
    network: "Could not reach the local API. Try reconnecting.",
    invalidJson: "The local API did not return valid JSON. Try reconnecting.",
    invalidProfiles: "The API returned an invalid profile list.",
    invalidReport:
      "The API returned an invalid result. No verdict was accepted.",
    reportMismatch: "The downloadable report differs from the received result.",
    local: "Local processing · SCHEMA and PROFILE",
    privacy: "your file stays on this computer",
    pass: "Passed",
    fail: "Failed",
    error: "error",
    errors: "errors",
    warning: "warning",
    warnings: "warnings",
    verified: "Checked",
    skipped: "Not evaluated",
    none: "none",
    triangles: "triangles",
    vertices: "vertices",
    materials: "materials",
    drawCalls: "draw calls",
    textures: "textures",
    dimensions: "dimensions",
    upTo: "up to",
    download: "Download judge-report.json",
    noViolations: "No violations in the checks performed.",
    filter: "Filter by code, location or message",
    of: "of",
    occurrences: "occurrences",
    page: "page",
    pages: "Violation pages",
    previous: "Previous",
    next: "Next",
    document: "Entire document",
    diagnostics: "Technical diagnostics and downloaded JSON remain in English.",
    ORIGIN_REJECTED: "This request origin is not allowed.",
    BUSY: "Files are already being processed. Try again shortly.",
    UPLOAD_TOO_LARGE: "The upload exceeds the size limit.",
    ROUTE_NOT_FOUND: "The requested route was not found.",
    INVALID_MULTIPART: "The upload form is invalid. Please try again.",
    ASSET_REQUIRED: "Choose a GLB or glTF file to analyze.",
    INVALID_PROFILE: "The profile name is invalid.",
    PROFILE_NOT_FOUND: "The profile was not found or is invalid.",
    ANALYSIS_FAILED:
      "Could not complete analysis with this profile. Check its rules or try a smaller file.",
    INTERNAL_ERROR: "An unexpected error prevented analysis. Please try again.",
    PROFILES_UNAVAILABLE: "Could not load profiles. Try reconnecting.",
  },
  "pt-BR": {
    language: "Idioma",
    tagline:
      "Juiz de aceitação local. Mesmas regras do perfil, mesmo veredito.",
    asset: "Asset",
    profile: "Perfil",
    dropTitle: "Solte o GLB aqui",
    dropHint: "ou clique para escolher · .glb / .gltf · até 64 MB",
    changeFile: "clique para trocar",
    fileTooLarge: "Escolha um arquivo de até 64 MB.",
    noProfiles: "Nenhum perfil disponível. Configure um perfil para começar.",
    judge: "Julgar asset",
    judging: "Julgando…",
    cancel: "Cancelar análise",
    cancelled: "Análise cancelada. Nenhum veredito foi produzido.",
    reconnect: "Reconectar",
    loading: "carregando…",
    checks: "Verificações",
    scope: "Aparência, geometria e semântica ainda não são avaliadas.",
    infra: "Não foi possível concluir a análise",
    infraNote: "Nenhum veredito foi produzido (código de saída 2).",
    network: "Não foi possível acessar a API local. Tente reconectar.",
    invalidJson: "A API local não retornou JSON válido. Tente reconectar.",
    invalidProfiles: "A API retornou uma lista de perfis inválida.",
    invalidReport:
      "A API retornou um resultado inválido. Nenhum veredito foi aceito.",
    reportMismatch: "O relatório para download diverge do resultado recebido.",
    local: "Processamento local · SCHEMA e PROFILE",
    privacy: "seu arquivo permanece neste computador",
    pass: "Aprovado",
    fail: "Reprovado",
    error: "erro",
    errors: "erros",
    warning: "aviso",
    warnings: "avisos",
    verified: "Verificado",
    skipped: "Não avaliado",
    none: "nenhuma",
    triangles: "triângulos",
    vertices: "vértices",
    materials: "materiais",
    drawCalls: "draw calls",
    textures: "texturas",
    dimensions: "dimensões",
    upTo: "até",
    download: "Baixar judge-report.json",
    noViolations: "Nenhuma violação nas verificações executadas.",
    filter: "Filtrar por código, local ou mensagem",
    of: "de",
    occurrences: "ocorrências",
    page: "página",
    pages: "Páginas de violações",
    previous: "Anterior",
    next: "Próxima",
    document: "Documento inteiro",
    diagnostics:
      "Os diagnósticos técnicos e o JSON baixado permanecem em inglês.",
    ORIGIN_REJECTED: "A origem desta requisição não é permitida.",
    BUSY: "Já há arquivos em processamento. Tente novamente em instantes.",
    UPLOAD_TOO_LARGE: "O upload excede o limite de tamanho.",
    ROUTE_NOT_FOUND: "A rota solicitada não foi encontrada.",
    INVALID_MULTIPART: "O formulário de upload é inválido. Tente novamente.",
    ASSET_REQUIRED: "Escolha um arquivo GLB ou glTF para analisar.",
    INVALID_PROFILE: "O nome do perfil é inválido.",
    PROFILE_NOT_FOUND: "O perfil não foi encontrado ou é inválido.",
    ANALYSIS_FAILED:
      "Não foi possível concluir a análise com este perfil. Confira as regras ou tente um arquivo menor.",
    INTERNAL_ERROR: "Um erro inesperado impediu a análise. Tente novamente.",
    PROFILES_UNAVAILABLE:
      "Não foi possível carregar os perfis. Tente reconectar.",
  },
} as const;

export type MessageKey = keyof typeof messages.en;
export type Locale = keyof typeof messages;
export type Translation = Record<MessageKey, string>;

// Both dictionaries must remain complete when a message is added.
const translations: Record<Locale, Translation> = messages;
export function translate(locale: Locale): Translation {
  return translations[locale];
}

export function resolveLocale(value: unknown): Locale {
  return value === "pt-BR" ? "pt-BR" : "en";
}

export class UiError extends Error {
  constructor(readonly key: MessageKey) {
    super(messages.en[key]);
  }
}

export function errorKey(error: unknown): MessageKey {
  return error instanceof UiError ? error.key : "network";
}
