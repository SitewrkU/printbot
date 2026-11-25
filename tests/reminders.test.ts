import { describe, expect, it } from "vitest";
import {
  isRemindableStatus,
  minutesLeft,
  remainingCooldownMs,
} from "../src/domain/reminders.js";

const now = new Date("2026-11-25T12:00:00.000Z");

describe("reminder cooldown", () => {
  it("без попереднього нагадування дозволяє одразу", () => {
    expect(remainingCooldownMs(null, now)).toBe(0);
  });

  it("після 10 хвилин лишає 20", () => {
    const last = new Date(now.getTime() - 10 * 60_000);
    expect(remainingCooldownMs(last, now)).toBe(20 * 60_000);
  });

  it("після 30 хвилин не блокує", () => {
    const last = new Date(now.getTime() - 30 * 60_000);
    expect(remainingCooldownMs(last, now)).toBe(0);
  });
});

describe("minutesLeft", () => {
  it("округляє вгору й не показує 0", () => {
    expect(minutesLeft(1)).toBe(1);
    expect(minutesLeft(60_000)).toBe(1);
    expect(minutesLeft(60_001)).toBe(2);
  });
});

describe("remindable statuses", () => {
  it("дозволяє лише активні статуси", () => {
    expect(isRemindableStatus("QUEUED")).toBe(true);
    expect(isRemindableStatus("IN_PROGRESS")).toBe(true);
    expect(isRemindableStatus("ON_HOLD")).toBe(true);
    expect(isRemindableStatus("READY")).toBe(false);
    expect(isRemindableStatus("CLOSED")).toBe(false);
    expect(isRemindableStatus("CANCELLED")).toBe(false);
  });
});
