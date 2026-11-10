import { describe, expect, it } from "vitest";
import {
  calcAmountKop,
  formatUah,
  parsePriceInput,
} from "../src/domain/pricing.js";

const PRICE = 300;

describe("calcAmountKop", () => {
  it("рахує сторінки × копії × ціну", () => {
    expect(calcAmountKop(12, 2, PRICE)).toBe(7200);
  });

  it("одна сторінка коштує 3 грн", () => {
    expect(calcAmountKop(1, 1, PRICE)).toBe(300);
  });

  it("кидає помилку на нульових або від'ємних значеннях", () => {
    expect(() => calcAmountKop(0, 1, PRICE)).toThrow(RangeError);
    expect(() => calcAmountKop(1, 0, PRICE)).toThrow(RangeError);
    expect(() => calcAmountKop(1, 1, -PRICE)).toThrow(RangeError);
  });

  it("не приймає дробові сторінки", () => {
    expect(() => calcAmountKop(1.5, 1, PRICE)).toThrow(RangeError);
  });
});

describe("formatUah", () => {
  it("форматує гривні з копійками", () => {
    expect(formatUah(7200)).toBe("72,00 грн");
    expect(formatUah(305)).toBe("3,05 грн");
    expect(formatUah(0)).toBe("0,00 грн");
  });
});

describe("parsePriceInput", () => {
  it("читає суму в гривнях", () => {
    expect(parsePriceInput("45")).toEqual({
      amountKop: 4500,
      reason: "багато кольору / заливки",
    });
    expect(parsePriceInput("45.50")).toEqual({
      amountKop: 4550,
      reason: "багато кольору / заливки",
    });
  });

  it("приймає кому та причину через риску", () => {
    expect(parsePriceInput("60,25 | багато чорного")).toEqual({
      amountKop: 6025,
      reason: "багато чорного",
    });
  });

  it("відхиляє нуль, від'ємні та завеликі суми", () => {
    expect(parsePriceInput("0")).toBeNull();
    expect(parsePriceInput("-5")).toBeNull();
    expect(parsePriceInput("1001")).toBeNull();
    expect(parsePriceInput("abc")).toBeNull();
  });
});
