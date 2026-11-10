import { pino } from "pino";
import { config } from "../app-config.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: "printbot" },
  redact: {
    paths: ["phone", "*.phone", "phoneSnapshot", "*.phoneSnapshot", "fullName", "*.fullName"],
    censor: "[redacted]",
  },
});
