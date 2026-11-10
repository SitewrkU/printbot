import { describe, expect, it } from "vitest";
import { isValidRoom, normalizeRoom } from "../src/domain/rooms.js";

describe("normalizeRoom", () => {
  it("приймає номер + б/п", () => {
    expect(normalizeRoom("25б")).toBe("25б");
    expect(normalizeRoom("33п")).toBe("33п");
    expect(normalizeRoom("7Б")).toBe("7б");
  });

  it("прибирає пробіли та приймає латинські b/p", () => {
    expect(normalizeRoom(" 25 б ")).toBe("25б");
    expect(normalizeRoom("33 P")).toBe("33п");
  });

  it("відхиляє некоректні кімнати", () => {
    expect(normalizeRoom("25")).toBeNull();
    expect(normalizeRoom("25г")).toBeNull();
    expect(normalizeRoom("123б")).toBeNull();
    expect(normalizeRoom("0п")).toBeNull();
    expect(normalizeRoom("")).toBeNull();
  });
});

describe("isValidRoom", () => {
  it("перевіряє збережене значення", () => {
    expect(isValidRoom("11б")).toBe(true);
    expect(isValidRoom("4 корпус, 415")).toBe(false);
    expect(isValidRoom(null)).toBe(false);
  });
});
