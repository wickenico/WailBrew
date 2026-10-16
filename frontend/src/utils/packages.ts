import type { PackageDetails, PackageEntry } from "../types";

export const packageTarget = (pkg: PackageEntry): string => pkg.fullName || pkg.name;

export function packageDetails(info: Record<string, unknown>, unavailable: string): PackageDetails {
    return {
        desc: (info.desc as string) || unavailable,
        homepage: (info.homepage as string) || unavailable,
        dependencies: (info.dependencies as string[]) || [],
        conflicts: (info.conflicts_with as string[]) || [],
    };
}

export function installedCaskEntries(rows: string[][]): PackageEntry[] {
    return rows.map(([name, installedVersion, size, pinned, fullName]) => ({
        name,
        fullName,
        installedVersion,
        size,
        isInstalled: true,
        isCask: true,
        isPinned: pinned === "true",
    }));
}

export function updatablePackageEntries(rows: string[][]): PackageEntry[] {
    return rows.map(([name, installedVersion, latestVersion, size, warning, type, fullName]) => ({
        name,
        fullName,
        installedVersion,
        latestVersion,
        size,
        warning: warning || undefined,
        isInstalled: true,
        isCask: type === "cask",
    }));
}
