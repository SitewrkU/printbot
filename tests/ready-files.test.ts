import { describe, expect, it } from "vitest";
import {
  READY_FILES,
  findReadyFileByTag,
  readyFileTag,
} from "../src/domain/ready-files.js";

describe("ready files", () => {
  it("містить широку та вузьку рамки по одній сторінці", () => {
    expect(READY_FILES).toHaveLength(2);

    const wide = READY_FILES.find((file) => file.id === "frame-wide");
    const narrow = READY_FILES.find((file) => file.id === "frame-narrow");

    expect(wide?.label).toBe("Широка рамка");
    expect(wide?.fileName).toBe("ramka-40.doc");
    expect(narrow?.label).toBe("Вузька рамка");
    expect(narrow?.fileName).toBe("ramka-15.doc");

    for (const file of READY_FILES) {
      expect(file.pages).toBe(1);
      expect(file.sizeBytes).toBeGreaterThan(0);
      expect(file.sha256).toHaveLength(64);
    }

    expect(wide?.sha256).not.toBe(narrow?.sha256);
  });

  it("знаходить файл за тегом із бази", () => {
    expect(findReadyFileByTag(readyFileTag("frame-wide"))?.fileName).toBe(
      "ramka-40.doc",
    );
    expect(findReadyFileByTag("ready:unknown")).toBeUndefined();
    expect(findReadyFileByTag("telegram-file-id")).toBeUndefined();
  });
});
