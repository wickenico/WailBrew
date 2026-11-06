import { describe, expect, it } from "vitest";
import type { PackageDetails, PackageEntry } from "../../types";
import {
    carryOverSizes,
    installedCaskEntries,
    installedFormulaEntries,
    markInstalled,
    packageDetails,
    packageTarget,
    updatablePackageEntries,
} from "../packages";

describe("installedFormulaEntries", () => {
    it("maps install reason and pin state", () => {
        expect(
            installedFormulaEntries([
                ["wget", "1.21", "", "on_request", "true"],
                ["openssl@3", "3.3.0", "", "", "false"],
            ]),
        ).toEqual([
            {
                name: "wget",
                installedVersion: "1.21",
                size: "",
                installReason: "on_request",
                isInstalled: true,
                isPinned: true,
            },
            {
                name: "openssl@3",
                installedVersion: "3.3.0",
                size: "",
                installReason: "unknown",
                isInstalled: true,
                isPinned: false,
            },
        ]);
    });
});

describe("carryOverSizes", () => {
    it("keeps sizes of unchanged packages and measures new or upgraded ones", () => {
        const previous: PackageEntry[] = [
            { name: "firefox", installedVersion: "120.0", size: "300M" },
            { name: "slack", installedVersion: "4.40", size: "500M" },
            { name: "zoom", installedVersion: "6.0", size: "200M" },
        ];
        const next: PackageEntry[] = [
            { name: "discord", installedVersion: "0.0.300", size: "" },
            { name: "firefox", installedVersion: "120.0", size: "" },
            { name: "slack", installedVersion: "4.41", size: "" },
        ];

        const { entries, needsSize } = carryOverSizes(previous, next);

        expect(entries.map((pkg) => [pkg.name, pkg.size])).toEqual([
            ["discord", ""],
            ["firefox", "300M"],
            ["slack", ""],
        ]);
        expect(needsSize).toEqual(["discord", "slack"]);
    });

    it("measures packages whose size was never loaded", () => {
        const { needsSize } = carryOverSizes(
            [{ name: "wget", installedVersion: "1.21", size: "" }],
            [{ name: "wget", installedVersion: "1.21", size: "" }],
        );
        expect(needsSize).toEqual(["wget"]);
    });
});

describe("markInstalled", () => {
    it("updates only entries whose state changed", () => {
        const unchanged: PackageEntry = { name: "firefox", installedVersion: "", isInstalled: true };
        const catalog: PackageEntry[] = [
            unchanged,
            { name: "discord", installedVersion: "", isInstalled: false },
            { name: "zoom", installedVersion: "", isInstalled: true },
        ];

        const result = markInstalled(catalog, new Set(["firefox", "discord"]));

        expect(result.map((pkg) => [pkg.name, pkg.isInstalled])).toEqual([
            ["firefox", true],
            ["discord", true],
            ["zoom", false],
        ]);
        expect(result[0]).toBe(unchanged);
    });
});

describe("installedCaskEntries", () => {
    it("full names and pins", () => {
        expect(
            installedCaskEntries([
                ["orca", "1.4.224", "794M", "false", "stablyai/orca/orca"],
                ["firefox", "120.0", "300M", "true", "firefox"],
            ]),
        ).toEqual([
            {
                name: "orca",
                fullName: "stablyai/orca/orca",
                installedVersion: "1.4.224",
                size: "794M",
                isInstalled: true,
                isCask: true,
                isPinned: false,
            },
            {
                name: "firefox",
                fullName: "firefox",
                installedVersion: "120.0",
                size: "300M",
                isInstalled: true,
                isCask: true,
                isPinned: true,
            },
        ]);
    });
});

describe("updatablePackageEntries", () => {
    it("cask and formula names", () => {
        const packages = updatablePackageEntries([
            ["orca", "1.4.224", "1.4.226", "794M", "auto updates", "cask", "stablyai/orca/orca"],
            ["wget", "1.0", "2.0", "", "", "formula"],
        ]);
        expect(packages[0]).toMatchObject({
            name: "orca",
            fullName: "stablyai/orca/orca",
            warning: "auto updates",
            isCask: true,
        });
        expect(packages[1]).toMatchObject({ name: "wget", isCask: false });
        expect(packages.map(packageTarget)).toEqual(["stablyai/orca/orca", "wget"]);
    });
});

describe("packageDetails", () => {
    const installed: PackageEntry = {
        name: "orca",
        fullName: "stablyai/orca/orca",
        installedVersion: "1.4.226",
        size: "794M",
        isInstalled: true,
        isCask: true,
        isPinned: true,
    };
    const catalog: PackageEntry = {
        name: "stablyai/orca/orca",
        installedVersion: "",
        isInstalled: true,
        isCask: true,
    };
    const details = {
        desc: "IDE for orchestrating AI coding agents across terminals and worktrees",
        homepage: "https://onorca.dev/",
        dependencies: [],
        conflicts: [],
    };

    it.each([
        { view: "installed to catalog", source: installed, current: catalog },
        { view: "catalog to installed", source: catalog, current: installed },
    ])("$view", ({ source, current }) => {
        const cache = new Map<string, PackageDetails>();
        cache.set(packageTarget(source), packageDetails({ ...source, ...details, conflicts_with: [] }, "N/A"));

        const cached = cache.get(packageTarget(current));
        expect(cached).toEqual(details);
        expect({ ...current, ...cached }).toEqual({ ...current, ...details });
    });

    it("empty details", () => {
        expect(packageDetails({}, "N/A")).toEqual({
            desc: "N/A",
            homepage: "N/A",
            dependencies: [],
            conflicts: [],
        });
    });
});
