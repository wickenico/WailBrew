import { describe, expect, it } from "vitest";
import type { AdoptableApp, AdoptCandidate } from "../../types";
import {
    adoptStatusFor,
    countAdoptStatuses,
    displayCaskVersion,
    filterAdoptableApps,
    selectedCandidate,
} from "../adopt";

const candidate = (overrides: Partial<AdoptCandidate>): AdoptCandidate => ({
    token: "x",
    fullToken: "x",
    name: "X",
    desc: "",
    homepage: "",
    version: "1.0",
    autoUpdates: false,
    deprecated: false,
    matchKind: "app",
    versionStatus: "same",
    ...overrides,
});

const iterm: AdoptableApp = {
    appName: "iTerm",
    path: "/Applications/iTerm.app",
    bundleId: "com.googlecode.iterm2",
    version: "3.7.7",
    status: "ready",
    candidates: [
        candidate({ token: "iterm2", name: "iTerm2", version: "3.7.7" }),
        candidate({ token: "iterm2@beta", name: "iTerm2", version: "3.7.8beta2", versionStatus: "older" }),
    ],
};

const tunnelblick: AdoptableApp = {
    appName: "Tunnelblick",
    path: "/Applications/Tunnelblick.app",
    bundleId: "net.tunnelblick.tunnelblick",
    version: "8.0.2",
    status: "versionMismatch",
    candidates: [candidate({ token: "tunnelblick", name: "Tunnelblick", version: "10.0.3", versionStatus: "older" })],
};

const notes: AdoptableApp = {
    appName: "Obscure Notes",
    path: "/Applications/Obscure Notes.app",
    bundleId: "",
    version: "",
    status: "uncertain",
    candidates: [candidate({ token: "obscure", name: "Obscure Notes", matchKind: "name", versionStatus: "unknown" })],
};

describe("adoptStatusFor", () => {
    it("classifies candidates like brew --adopt", () => {
        expect(adoptStatusFor(candidate({}))).toBe("ready");
        expect(adoptStatusFor(candidate({ versionStatus: "older", autoUpdates: true }))).toBe("ready");
        expect(adoptStatusFor(candidate({ versionStatus: "newer" }))).toBe("versionMismatch");
        expect(adoptStatusFor(candidate({ versionStatus: "unknown" }))).toBe("versionMismatch");
        expect(adoptStatusFor(candidate({ matchKind: "name" }))).toBe("uncertain");
        expect(adoptStatusFor(candidate({ matchKind: "bundleId" }))).toBe("ready");
    });
});

describe("selectedCandidate", () => {
    it("falls back to the recommended candidate", () => {
        expect(selectedCandidate(iterm, {}).token).toBe("iterm2");
        expect(selectedCandidate(iterm, { [iterm.path]: "iterm2@beta" }).token).toBe("iterm2@beta");
        expect(selectedCandidate(iterm, { [iterm.path]: "unknown" }).token).toBe("iterm2");
    });
});

describe("filterAdoptableApps", () => {
    const apps = [iterm, tunnelblick, notes];

    it("searches app name, bundle id and casks", () => {
        expect(filterAdoptableApps(apps, "TUNNEL", "all", {})).toEqual([tunnelblick]);
        expect(filterAdoptableApps(apps, "googlecode", "all", {})).toEqual([iterm]);
        expect(filterAdoptableApps(apps, "iterm2@beta", "all", {})).toEqual([iterm]);
        expect(filterAdoptableApps(apps, "  ", "all", {})).toEqual(apps);
    });

    it("filters by the status of the selected candidate", () => {
        expect(filterAdoptableApps(apps, "", "ready", {})).toEqual([iterm]);
        expect(filterAdoptableApps(apps, "", "versionMismatch", { [iterm.path]: "iterm2@beta" })).toEqual([
            iterm,
            tunnelblick,
        ]);
        expect(filterAdoptableApps(apps, "", "uncertain", {})).toEqual([notes]);
    });
});

describe("countAdoptStatuses", () => {
    it("counts per status", () => {
        expect(countAdoptStatuses([iterm, tunnelblick, notes], {})).toEqual({
            all: 3,
            ready: 1,
            versionMismatch: 1,
            uncertain: 1,
        });
    });
});

describe("displayCaskVersion", () => {
    it("drops build metadata after the comma", () => {
        expect(displayCaskVersion("6.6395.0,d71a20056be3b25708751e98bef60759ea1f441b")).toBe("6.6395.0");
        expect(displayCaskVersion("3.7.7")).toBe("3.7.7");
    });
});
