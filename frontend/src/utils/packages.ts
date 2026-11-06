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

export function installedFormulaEntries(rows: string[][]): PackageEntry[] {
    return rows.map(([name, installedVersion, size, installReason, pinned]) => ({
        name,
        installedVersion,
        size,
        installReason: (installReason as PackageEntry["installReason"]) || "unknown",
        isInstalled: true,
        isPinned: pinned === "true",
    }));
}

/**
 * Carries measured sizes over from a previous installed list into a freshly
 * loaded one. An entry keeps its size only when the same package is still
 * installed at the same version; everything else is returned in `needsSize`
 * so the caller can measure just those packages.
 */
export function carryOverSizes(
    previous: PackageEntry[],
    next: PackageEntry[],
): { entries: PackageEntry[]; needsSize: string[] } {
    const previousByName = new Map(previous.map((pkg) => [pkg.name, pkg]));
    const needsSize: string[] = [];
    const entries = next.map((pkg) => {
        const old = previousByName.get(pkg.name);
        if (old?.size && old.installedVersion === pkg.installedVersion) {
            return { ...pkg, size: old.size };
        }
        needsSize.push(pkg.name);
        return pkg;
    });
    return { entries, needsSize };
}

/** Re-marks which catalog entries are installed, keeping unchanged entries as-is. */
export function markInstalled(catalog: PackageEntry[], installedNames: Set<string>): PackageEntry[] {
    return catalog.map((pkg) => {
        const isInstalled = installedNames.has(pkg.name);
        return pkg.isInstalled === isInstalled ? pkg : { ...pkg, isInstalled };
    });
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
