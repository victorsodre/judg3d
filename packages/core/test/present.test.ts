import { describe, expect, it } from "vitest";

import { formatBytes, shortHash, violationDetail } from "../src/present.js";
import type { Violation } from "../src/contract.js";

/**
 * Este modulo existe para que CLI e app local nao divirjam. Os testes cobrem
 * o comportamento; a garantia de que ninguem volta a duplicar e o fato de as
 * duas superficies importarem daqui.
 */

describe("formatBytes", () => {
  it("defaults to English and supports explicit pt-BR formatting", () => {
    expect(formatBytes(1638)).toBe("1.6 KB");
    expect(formatBytes(1638, "pt-BR")).toBe("1,6 KB");
  });
  it("uses a comma when pt-BR is explicitly selected", () => {
    expect(formatBytes(1638, "pt-BR")).toBe("1,6 KB");
    expect(formatBytes(2_202_010, "pt-BR")).toBe("2,1 MB");
  });

  it("nao decora bytes crus abaixo de 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("vira KB exatamente em 1024, nao antes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("shortHash", () => {
  it("corta em 12 caracteres", () => {
    expect(shortHash("a".repeat(64))).toBe("a".repeat(12));
  });

  it("nao estoura em hash curto", () => {
    expect(shortHash("abc")).toBe("abc");
  });
});

describe("violationDetail", () => {
  const base = {
    kind: "PROFILE",
    code: "MATERIALS_OVER_BUDGET",
    severity: "error",
  } as const;

  it("prefere a mensagem que a camada escreveu", () => {
    const violation: Violation = {
      ...base,
      kind: "SCHEMA",
      code: "ACCESSOR_INDEX_OOB",
      got: { severity: "Error", message: "Indice fora do intervalo." },
      want: { conformance: "glTF 2.0" },
    };
    expect(violationDetail(violation)).toBe("Indice fora do intervalo.");
  });

  it("sem mensagem, monta got/want — o caso que expos o buraco", () => {
    const violation: Violation = {
      ...base,
      got: { metric: "materials", value: 45 },
      want: { metric: "materials", max: 20 },
    };
    // `metric` aparece uma vez so: repetido nos dois lados nao e contraste.
    expect(violationDetail(violation)).toBe(
      "metric materials · value 45  →  expected max 20",
    );
  });

  it("achata lista no lado esperado", () => {
    const violation: Violation = {
      ...base,
      code: "EXTERNAL_RESOURCE",
      got: { storage: "external", uri: "cena.bin" },
      want: { storage: ["glb", "buffer-view", "data-uri"] },
    };
    expect(violationDetail(violation)).toBe(
      "storage external · uri cena.bin  →  expected storage glb, buffer-view, data-uri",
    );
  });

  it("nao imprime [object Object] diante de valor exotico", () => {
    const violation: Violation = {
      ...base,
      got: { alvo: new Map([["a", 1]]) },
      want: {},
    };
    // Nao imprimir e melhor que imprimir lixo com cara de informacao.
    expect(violationDetail(violation)).toBe("alvo —");
  });

  it("devolve undefined quando nao ha nada a dizer", () => {
    const violation: Violation = { ...base, got: {}, want: {} };
    expect(violationDetail(violation)).toBeUndefined();
  });
});
