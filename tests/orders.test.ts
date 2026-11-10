import { describe, expect, it } from "vitest";
import {
  formatOrderCode,
  orderAmountKop,
  totalPages,
} from "../src/domain/orders.js";

describe("formatOrderCode", () => {
  it("додає префікс і нулі", () => {
    expect(formatOrderCode(1n)).toBe("PB-0001");
    expect(formatOrderCode(7n)).toBe("PB-0007");
    expect(formatOrderCode(1234n)).toBe("PB-1234");
  });

  it("працює з числом", () => {
    expect(formatOrderCode(42)).toBe("PB-0042");
  });

  it("відхиляє нуль і від'ємні значення", () => {
    expect(() => formatOrderCode(0n)).toThrow(RangeError);
    expect(() => formatOrderCode(-5)).toThrow(RangeError);
  });
});

describe("підрахунок замовлення", () => {
  const files = [{ pages: 5 }, { pages: 7 }, { pages: 2 }];

  it("сумує сторінки всіх файлів", () => {
    expect(totalPages(files)).toBe(14);
  });

  it("множить сторінки на копії та ціну", () => {
    expect(orderAmountKop(files, 2, 300)).toBe(8400);
  });

  it("кидає помилку на порожньому списку", () => {
    expect(() => orderAmountKop([], 1, 300)).toThrow(RangeError);
  });
});
