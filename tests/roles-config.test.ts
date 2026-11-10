import { describe, expect, it } from "vitest";
import { canManageWorkers, isStaff, resolveRole } from "../src/domain/roles.js";
import { loadConfig } from "../src/config.js";

describe("ролі", () => {
  it("адмін визначається тільки конфігом", () => {
    expect(resolveRole("6590468340", ["6590468340"])).toBe("admin");
    expect(resolveRole("111", ["6590468340"])).toBe("client");
  });

  it("працівник і адмін належать до персоналу", () => {
    expect(isStaff("worker")).toBe(true);
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("client")).toBe(false);
  });

  it("керувати працівниками може лише адмін", () => {
    expect(canManageWorkers("admin")).toBe(true);
    expect(canManageWorkers("worker")).toBe(false);
    expect(canManageWorkers("client")).toBe(false);
  });
});

describe("конфігурація", () => {
  const base = {
    BOT_TOKEN: "123:test",
    DATABASE_URL: "postgresql://localhost:5432/printbot",
  } as NodeJS.ProcessEnv;

  it("підставляє значення за замовчуванням", () => {
    const config = loadConfig(base);

    expect(config.PORT).toBe(3000);
    expect(config.PRICE_PER_PAGE_KOP).toBe(300);
    expect(config.PRINT_NAME).toBe("Друкарська, 48б");
    expect(config.CARD_TRANSFER_ENABLED).toBe(true);
    expect(config.adminTelegramIds).toEqual([]);
  });

  it("розбирає список адмінів і вимикає переказ", () => {
    const config = loadConfig({
      ...base,
      ADMIN_TELEGRAM_IDS: "6590468340, 42 ,,",
      CARD_TRANSFER_ENABLED: "false",
    } as NodeJS.ProcessEnv);

    expect(config.adminTelegramIds).toEqual(["6590468340", "42"]);
    expect(config.CARD_TRANSFER_ENABLED).toBe(false);
  });

  it("падає без токена", () => {
    expect(() => loadConfig({ DATABASE_URL: base.DATABASE_URL } as NodeJS.ProcessEnv)).toThrow(
      /BOT_TOKEN/,
    );
  });
});
