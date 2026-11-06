import { describe, expect, it } from "vitest";
import { formatShortcut } from "../shortcuts";

describe("formatShortcut", () => {
    it("uses Apple modifier order on macOS", () => {
        expect(formatShortcut("S", { mac: true })).toBe("⌘S");
        expect(formatShortcut("R", { shift: true, mac: true })).toBe("⇧⌘R");
    });

    it("joins modifiers with + on other platforms", () => {
        expect(formatShortcut("S", { mac: false })).toBe("Ctrl+S");
        expect(formatShortcut("R", { shift: true, mac: false })).toBe("Ctrl+Shift+R");
    });
});
