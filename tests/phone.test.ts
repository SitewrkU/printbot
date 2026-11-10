import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "../src/domain/phone.js";

describe("normalizePhone", () => {
  it("приймає міжнародний формат", () => {
    expect(normalizePhone("+380501234567")).toBe("+380501234567");
  });

  it("приймає номер без плюса", () => {
    expect(normalizePhone("380501234567")).toBe("+380501234567");
  });

  it("приймає номер з нулем на початку", () => {
    expect(normalizePhone("0501234567")).toBe("+380501234567");
  });

  it("приймає номер з 80 на початку", () => {
    expect(normalizePhone("80501234567")).toBe("+380501234567");
  });

  it("ігнорує пробіли, дужки й дефіси", () => {
    expect(normalizePhone("+380 (50) 123-45-67")).toBe("+380501234567");
  });

  it("відхиляє короткі та сторонні номери", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1 555 010 0000")).toBeNull();
    expect(normalizePhone("не номер")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("форматує український номер для показу", () => {
    expect(formatPhone("+380501234567")).toBe("+380 50 123 45 67");
  });

  it("повертає номер без змін, якщо формат невідомий", () => {
    expect(formatPhone("+123456789")).toBe("+123456789");
  });
});
