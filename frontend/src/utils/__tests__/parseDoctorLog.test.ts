import { describe, expect, it } from "vitest";
import { parseDoctorLogLine } from "../parseDoctorLog";

describe("parseDoctorLogLine", () => {
    it("finds an inline backtick command", () => {
        expect(parseDoctorLogLine("Run `brew missing` for more details.")).toEqual([
            { type: "text", value: "Run " },
            { type: "command", value: "brew missing" },
            { type: "text", value: " for more details." },
        ]);
    });

    it("finds an indented standalone command", () => {
        expect(parseDoctorLogLine("    brew install libassuan libgpg-error pinentry-mac")).toEqual([
            { type: "text", value: "    " },
            { type: "command", value: "brew install libassuan libgpg-error pinentry-mac" },
        ]);
    });

    it("does not offer an incomplete install command", () => {
        expect(parseDoctorLogLine("You should `brew install` the missing dependencies:")).toEqual([
            { type: "text", value: "You should " },
            { type: "text", value: "`brew install`" },
            { type: "text", value: " the missing dependencies:" },
        ]);
    });

    it("still offers brew subcommands that need no target", () => {
        expect(parseDoctorLogLine("Run `brew missing` for more details.")).toContainEqual({
            type: "command",
            value: "brew missing",
        });
    });

    it("leaves ordinary output untouched", () => {
        expect(parseDoctorLogLine("Warning: Something needs attention.")).toEqual([
            { type: "text", value: "Warning: Something needs attention." },
        ]);
    });

    it("does not offer non-brew commands", () => {
        expect(parseDoctorLogLine("    sudo rm -rf /tmp/example")).toEqual([
            { type: "text", value: "    sudo rm -rf /tmp/example" },
        ]);
    });
});
