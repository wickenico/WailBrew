import type { AdoptableApp, AdoptCandidate, AdoptStatus } from "../types";

/**
 * Cask versions may carry build metadata after a comma
 * ("6.6395.0,d71a2005...", "2026.3,263.7307.200"); only the first part is
 * meaningful to users.
 */
export function displayCaskVersion(version: string): string {
    return version.split(",")[0];
}

export type AdoptStatusFilter = "all" | AdoptStatus;

export const ADOPT_STATUS_FILTERS: AdoptStatusFilter[] = ["all", "ready", "versionMismatch", "uncertain"];

/**
 * Mirrors the backend's adoptStatus so the badge follows the cask the user
 * picks in the variant dropdown. `brew install --cask --adopt` keeps the
 * existing app only when its version matches the cask or the cask updates
 * itself (auto_updates); otherwise Homebrew refuses.
 */
export function adoptStatusFor(candidate: AdoptCandidate): AdoptStatus {
    if (candidate.matchKind === "name") return "uncertain";
    if (candidate.autoUpdates || candidate.versionStatus === "same") return "ready";
    return "versionMismatch";
}

/** The candidate currently chosen for an app, falling back to the recommended one. */
export function selectedCandidate(app: AdoptableApp, selection: Record<string, string>): AdoptCandidate {
    const token = selection[app.path];
    return app.candidates.find((candidate) => candidate.token === token) ?? app.candidates[0];
}

export function filterAdoptableApps(
    apps: AdoptableApp[],
    query: string,
    status: AdoptStatusFilter,
    selection: Record<string, string>,
): AdoptableApp[] {
    const needle = query.trim().toLowerCase();
    return apps.filter((app) => {
        if (status !== "all" && adoptStatusFor(selectedCandidate(app, selection)) !== status) return false;
        if (!needle) return true;
        return (
            app.appName.toLowerCase().includes(needle) ||
            app.bundleId.toLowerCase().includes(needle) ||
            app.candidates.some(
                (candidate) =>
                    candidate.token.toLowerCase().includes(needle) || candidate.name.toLowerCase().includes(needle),
            )
        );
    });
}

/** Counts apps per status (by their selected candidate) for the filter labels. */
export function countAdoptStatuses(
    apps: AdoptableApp[],
    selection: Record<string, string>,
): Record<AdoptStatusFilter, number> {
    const counts: Record<AdoptStatusFilter, number> = { all: apps.length, ready: 0, versionMismatch: 0, uncertain: 0 };
    for (const app of apps) {
        counts[adoptStatusFor(selectedCandidate(app, selection))]++;
    }
    return counts;
}
