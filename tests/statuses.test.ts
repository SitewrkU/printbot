import { describe, expect, it } from "vitest";
import {
  canTransition,
  isOrderStatus,
  statusLabel,
  type OrderStatus,
} from "../src/domain/statuses.js";

describe("переходи статусів", () => {
  it("дозволяє основний шлях замовлення", () => {
    expect(canTransition("QUEUED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "READY")).toBe(true);
    expect(canTransition("READY", "CLOSED")).toBe(true);
  });

  it("не дозволяє перескочити етапи", () => {
    expect(canTransition("QUEUED", "READY")).toBe(false);
    expect(canTransition("QUEUED", "CLOSED")).toBe(false);
  });

  it("не дозволяє змінювати фінальні статуси", () => {
    const finals: OrderStatus[] = ["CLOSED", "CANCELLED", "EXPIRED"];
    for (const status of finals) {
      expect(canTransition(status, "IN_PROGRESS")).toBe(false);
      expect(canTransition(status, "QUEUED")).toBe(false);
    }
  });

  it("дозволяє скасувати тільки до початку друку", () => {
    expect(canTransition("QUEUED", "CANCELLED")).toBe(true);
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canTransition("READY", "CANCELLED")).toBe(false);
  });

  it("повертає замовлення з ON_HOLD у роботу", () => {
    expect(canTransition("ON_HOLD", "IN_PROGRESS")).toBe(true);
  });
});

describe("підписи", () => {
  it("розпізнає відомі статуси", () => {
    expect(isOrderStatus("READY")).toBe(true);
    expect(isOrderStatus("DONE")).toBe(false);
    expect(statusLabel("READY")).toBe("готово до видачі");
  });

  it("повертає сирий статус, якщо він невідомий", () => {
    expect(statusLabel("SOMETHING")).toBe("SOMETHING");
  });
});
