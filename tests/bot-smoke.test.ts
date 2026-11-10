import { beforeAll, describe, expect, it } from "vitest";

describe("збірка бота", () => {
  beforeAll(() => {
    process.env.BOT_TOKEN = "123456789:TEST_TOKEN_FOR_UNIT_TESTS";
    process.env.DATABASE_URL = "postgresql://printbot:printbot@localhost:5432/printbot";
    process.env.ADMIN_TELEGRAM_IDS = "6590468340";
  });

  it("створює екземпляр бота без мережі", async () => {
    const { createBot } = await import("../src/bot/index.js");
    const bot = createBot();

    expect(bot).toBeDefined();
    expect(bot.api.token).toBe(process.env.BOT_TOKEN);
  });

  it("меню клієнта не містить черги й адмінки", async () => {
    const { mainMenuKeyboard } = await import("../src/bot/keyboards.js");
    const data = mainMenuKeyboard("client")
      .inline_keyboard.flat()
      .map((button) => button.callback_data);

    expect(data).toContain("menu:new");
    expect(data).not.toContain("menu:queue");
    expect(data).not.toContain("menu:admin");
  });

  it("меню адміна містить чергу й адмінку", async () => {
    const { mainMenuKeyboard } = await import("../src/bot/keyboards.js");
    const data = mainMenuKeyboard("admin")
      .inline_keyboard.flat()
      .map((button) => button.callback_data);

    expect(data).toContain("menu:queue");
    expect(data).toContain("menu:admin");
  });
});
