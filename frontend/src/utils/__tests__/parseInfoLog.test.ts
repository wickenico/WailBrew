import { describe, expect, it } from "vitest";
import { parseInfoLog } from "../parseInfoLog";

// Raw output from `brew info wailbrew` (cask, no Caveats section)
const WAILBREW_INFO = `
==> wailbrew ✔ (WailBrew): 0.9.21
Manage Homebrew packages with a UI
https://github.com/wickenico/WailBrew
Installed (on request)
/opt/homebrew/Caskroom/wailbrew/0.9.21 (21.9MB)
  Installed using the formulae.brew.sh API on 2026-05-03 at 23:44:49
From: https://github.com/Homebrew/homebrew-cask/blob/HEAD/Casks/w/wailbrew.rb
==> Requirements
Required: macOS >= 11 ✔
==> Artifacts
WailBrew.app (App)
==> Downloading https://formulae.brew.sh/api/cask/wailbrew.json
==> Analytics
install: 687 (30 days), 2,593 (90 days), 8,397 (365 days)
`;

// Raw output from `brew info rustup` (formula, has Caveats section)
const RUSTUP_INFO = `
==> rustup ✔: stable 1.29.0 (bottled), HEAD [keg-only]
Rust toolchain installer
https://rust-lang.github.io/rustup/
Old Names: rustup-init
Installed (on request)
From: https://github.com/Homebrew/homebrew-core/blob/HEAD/Formula/r/rustup.rb
License: Apache-2.0 OR MIT
==> Installed Kegs and Versions
rustup ✔ 1.29.0_2 (44 files, 11.4MB)
==> Options
--HEAD
        Install HEAD version
==> Caveats
To use rustup, ensure you have "$(brew --prefix rustup)/bin" in your $PATH:
  https://rust-lang.github.io/rustup/installation/already-installed-rust.html

This formula no longer provides \`rustup-init\`.

rustup is keg-only, which means it was not symlinked into /opt/homebrew,
because it conflicts with rust.

If you need to have rustup first in your PATH, run:
  echo 'export PATH="/opt/homebrew/opt/rustup/bin:$PATH"' >> ~/.zshrc
==> Analytics
install: 4,666 (30 days), 15,611 (90 days), 68,597 (365 days)
install-on-request: 3,383 (30 days), 12,820 (90 days), 58,778 (365 days)
build-error: 2 (30 days)
`;

describe("parseInfoLog", () => {
    it("returns null for null input", () => {
        expect(parseInfoLog(null)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parseInfoLog("")).toBeNull();
    });

    describe("wailbrew (no Caveats)", () => {
        it("extracts the headline from the first ==> line", () => {
            const result = parseInfoLog(WAILBREW_INFO);
            expect(result?.headline).toBe("wailbrew ✔ (WailBrew): 0.9.21");
        });

        it("extracts the description from the first non-colon, non-URL line", () => {
            const result = parseInfoLog(WAILBREW_INFO);
            expect(result?.description).toBe("Manage Homebrew packages with a UI");
        });

        it("extracts the homepage URL", () => {
            const result = parseInfoLog(WAILBREW_INFO);
            expect(result?.homepage).toBe("https://github.com/wickenico/WailBrew");
        });

        it("includes the install path as a Path entry", () => {
            const result = parseInfoLog(WAILBREW_INFO);
            const pathEntry = result?.entries.find((e) => e.label === "Path");
            expect(pathEntry?.value).toContain("/opt/homebrew/Caskroom/wailbrew/0.9.21");
        });

        it("parses the From: key-value entry", () => {
            const result = parseInfoLog(WAILBREW_INFO);
            const fromEntry = result?.entries.find((e) => e.label === "From");
            expect(fromEntry?.value).toContain("homebrew-cask");
        });

        it("parses the Analytics install entry", () => {
            const result = parseInfoLog(WAILBREW_INFO);
            const installEntry = result?.entries.find((e) => e.label === "install");
            expect(installEntry?.value).toBe("687 (30 days), 2,593 (90 days), 8,397 (365 days)");
        });
    });

    describe("rustup (with Caveats section)", () => {
        it("extracts the headline", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            expect(result?.headline).toBe("rustup ✔: stable 1.29.0 (bottled), HEAD [keg-only]");
        });

        it("extracts the description", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            expect(result?.description).toBe("Rust toolchain installer");
        });

        it("extracts the real homepage, not a URL from within Caveats", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            expect(result?.homepage).toBe("https://rust-lang.github.io/rustup/");
        });

        it("does not include Caveats prose as entries", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            const values = result?.entries.map((e) => e.value) ?? [];
            // These strings appear exclusively inside the Caveats block
            expect(values.some((v) => v.includes("already-installed-rust"))).toBe(false);
            expect(values.some((v) => v.includes("no longer provides"))).toBe(false);
            expect(values.some((v) => v.includes("conflicts with rust"))).toBe(false);
        });

        it("does not leak the Caveats URL as the homepage", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            expect(result?.homepage).not.toContain("already-installed-rust");
        });

        it("parses the License entry correctly", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            const licenseEntry = result?.entries.find((e) => e.label === "License");
            expect(licenseEntry?.value).toBe("Apache-2.0 OR MIT");
        });

        it("parses all three Analytics install lines correctly", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            const entries = result?.entries ?? [];

            const installEntry = entries.find((e) => e.label === "install");
            expect(installEntry?.value).toBe("4,666 (30 days), 15,611 (90 days), 68,597 (365 days)");

            const onRequestEntry = entries.find((e) => e.label === "install-on-request");
            expect(onRequestEntry?.value).toBe("3,383 (30 days), 12,820 (90 days), 58,778 (365 days)");

            const buildErrorEntry = entries.find((e) => e.label === "build-error");
            expect(buildErrorEntry?.value).toBe("2 (30 days)");
        });

        it("does not produce entries with garbled PATH variable content from Caveats", () => {
            const result = parseInfoLog(RUSTUP_INFO);
            const garbledEntry = result?.entries.find(
                (e) => e.label.includes("echo") || e.value.includes("$PATH")
            );
            expect(garbledEntry).toBeUndefined();
        });
    });
});
