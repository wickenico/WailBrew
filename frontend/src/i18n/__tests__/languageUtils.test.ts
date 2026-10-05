import { describe, expect, it } from "vitest";
import i18n from "../index";
import { mapToSupportedLanguage } from "../languageUtils";

describe("mapToSupportedLanguage", () => {
    it("maps Italian locale codes to the Italian translation", () => {
        expect(mapToSupportedLanguage("it")).toBe("it");
        expect(mapToSupportedLanguage("it-IT")).toBe("it");
        expect(mapToSupportedLanguage("it_IT")).toBe("it");
    });

    it("maps other Italian regional variants to Italian", () => {
        expect(mapToSupportedLanguage("it-CH")).toBe("it");
    });

    it("loads the Italian translation resources", async () => {
        const previousLanguage = i18n.resolvedLanguage ?? i18n.language;

        try {
            await i18n.changeLanguage("it");

            expect(i18n.resolvedLanguage).toBe("it");
            expect(i18n.t("sidebar.packages")).toBe("Pacchetti");
            expect(i18n.t("language.italian")).toBe("Italiano");
        } finally {
            await i18n.changeLanguage(previousLanguage);
        }
    });
});
