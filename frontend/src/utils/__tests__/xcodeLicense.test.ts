import { describe, expect, it } from "vitest";
import { isXcodeLicenseError } from "../xcodeLicense";

describe("isXcodeLicenseError", () => {
    it.each(["brew list --formula --versions", "brew outdated --json=v2 --greedy-auto-updates", "brew update"])(
        "recognizes the issue #461 diagnostic from %s",
        (command) => {
            expect(
                isXcodeLicenseError(
                    `[2026-09-15 21:52:06] ERROR: ${command} failed: exit status 1\n` +
                        "Output: Error: You have not agreed to the Xcode license. Please resolve this by running:\n" +
                        "  sudo xcodebuild -license accept\n",
                ),
            ).toBe(true);
        },
    );

    it.each([
        "Error: You have not agreed to the Xcode license.",
        "exit status 1: error: you have not agreed to the Xcode license. Please resolve this by running:",
    ])("recognizes errors without a session log prefix", (message) => {
        expect(isXcodeLicenseError(message)).toBe(true);
    });

    it.each([
        undefined,
        null,
        {},
        "",
        "ERROR: brew update failed: exit status 1",
        "Error: Your Xcode is too outdated.",
        "Error: No developer tools installed.",
        "Error: Refusing to load cask from untrusted tap example/cask.",
        "License: MIT",
        "SUCCESS: brew update completed",
    ])("does not confuse unrelated output with an unaccepted license: %s", (message) => {
        expect(isXcodeLicenseError(message)).toBe(false);
    });
});
