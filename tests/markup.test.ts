import { describe, expect, it } from "vitest";
import {
  applyMarkupKop,
  markupForClient,
  markupNote,
  orderHasMarkup,
  pricePerPageWithMarkup,
} from "../src/domain/markup.js";

describe("markupForClient", () => {
  it("знаходить Оксану за Telegram ID", () => {
    const markup = markupForClient({ telegramId: 6687170291n, fullName: null });
    expect(markup?.percent).toBe(50);
  });

  it("знаходить тіньову копію для пранк-замовлень", () => {
    const markup = markupForClient({
      telegramId: -1000000000000012n,
      fullName: "Оксана Левицька",
    });
    expect(markup?.percent).toBe(50);
  });

  it("знаходить за іменем, незалежно від регістру та пробілів", () => {
    const markup = markupForClient({
      telegramId: 1n,
      fullName: "  оксана   левицька ",
    });
    expect(markup?.percent).toBe(50);
  });

  it("не чіпає інших клієнтів", () => {
    expect(
      markupForClient({ telegramId: 1n, fullName: "Іван Петренко" }),
    ).toBeNull();
  });
});

describe("markup arithmetic", () => {
  const markup = { percent: 50, name: "Оксана" };

  it("додає 50% до ціни за сторінку", () => {
    expect(pricePerPageWithMarkup(300, markup)).toBe(450);
    expect(pricePerPageWithMarkup(300, null)).toBe(300);
  });

  it("додає 50% до суми з округленням", () => {
    expect(applyMarkupKop(1000, markup)).toBe(1500);
    expect(applyMarkupKop(333, markup)).toBe(500);
  });

  it("розпізнає замовлення з націнкою за сумою", () => {
    const marked = { pagesTotal: 2, copies: 1, amountKop: 900 };
    const normal = { pagesTotal: 2, copies: 1, amountKop: 600 };

    expect(orderHasMarkup(marked, markup, 300)).toBe(true);
    expect(orderHasMarkup(normal, markup, 300)).toBe(false);
  });

  it("пояснює націнку в дужках", () => {
    expect(markupNote(markup)).toBe(
      "(ціна на 50% більша, бо вона Оксана)",
    );
  });
});
