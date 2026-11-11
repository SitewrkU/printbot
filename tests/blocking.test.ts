import { describe, expect, it } from "vitest";
import { normalizeBlockReason } from "../src/domain/blocking.js";

describe("normalizeBlockReason", () => {
  it("обрізає пробіли та згортає повторні", () => {
    expect(normalizeBlockReason("  спамить   замовленнями  ")).toBe(
      "спамить замовленнями",
    );
  });

  it("відхиляє занадто коротку причину", () => {
    expect(normalizeBlockReason("  ok ")).toBeNull();
    expect(normalizeBlockReason("")).toBeNull();
  });

  it("відхиляє причину довшу за 200 символів", () => {
    expect(normalizeBlockReason("а".repeat(201))).toBeNull();
    expect(normalizeBlockReason("а".repeat(200))).toHaveLength(200);
  });
});
