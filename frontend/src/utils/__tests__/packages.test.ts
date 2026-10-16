import { describe, expect, it } from "vitest";
import type { PackageDetails, PackageEntry } from "../../types";
import { installedCaskEntries, packageDetails, packageTarget, updatablePackageEntries } from "../packages";

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
