import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAppLocale, setAppLocale } from "../src/main/locale";
import { DEFAULT_ACTIVE_LOCALE, getLocale, setLocale } from "../src/shared/i18n";

// Mock the shared i18n module
vi.mock("../src/shared/i18n", () => {
  return {
    DEFAULT_ACTIVE_LOCALE: "en",
    getLocale: vi.fn(),
    setLocale: vi.fn(),
  };
});

describe("Main Locale", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getAppLocale", () => {
    it("should return the locale from shared i18n when it is set", () => {
      vi.mocked(getLocale).mockReturnValue("es");
      expect(getAppLocale()).toBe("es");
      expect(getLocale).toHaveBeenCalledTimes(1);
    });

    it("should return DEFAULT_ACTIVE_LOCALE when shared i18n returns a falsy value", () => {
      vi.mocked(getLocale).mockReturnValue(undefined as any);
      expect(getAppLocale()).toBe("en"); // Matches the mocked DEFAULT_ACTIVE_LOCALE
      expect(getLocale).toHaveBeenCalledTimes(1);
    });
  });

  describe("setAppLocale", () => {
    it("should call setSharedLocale with the provided locale and return its result", () => {
      vi.mocked(setLocale).mockReturnValue("zh-CN");
      const result = setAppLocale("zh-CN");

      expect(setLocale).toHaveBeenCalledWith("zh-CN");
      expect(setLocale).toHaveBeenCalledTimes(1);
      expect(result).toBe("zh-CN");
    });
  });
});
