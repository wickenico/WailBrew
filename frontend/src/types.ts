// Shared domain types used across App.tsx and its child components.
// Single source of truth to avoid the same shape being redefined per file.

export interface PackageEntry {
    name: string;
    fullName?: string;
    installedVersion: string;
    installReason?: "on_request" | "dependency" | "unknown";
    latestVersion?: string;
    size?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
    isInstalled?: boolean;
    warning?: string;
    isCask?: boolean;
    isFavorite?: boolean;
    isPinned?: boolean;
    vulnerabilityCount?: number;
    vulnerabilitySeverity?: VulnerabilitySeverity | string;
}

export type PackageDetails = Pick<PackageEntry, "desc" | "homepage" | "dependencies" | "conflicts">;

export interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
    // Homebrew 6 tap trust: true = trusted, false = untrusted, undefined = unknown
    trusted?: boolean;
}

export interface SnapshotEntry {
    fileName: string;
    label: string;
    createdAt: string; // RFC3339
    size: number;
}

export type VulnerabilitySeverity = "critical" | "high" | "medium" | "low" | "unknown";

export interface Vulnerability {
    id: string;
    severity: VulnerabilitySeverity | string;
    summary: string;
    aliases: string[];
    fixedVersions: string[];
    fixAvailable: boolean;
}

export interface FormulaFindings {
    formula: string;
    version: string;
    repoUrl: string;
    vulnerabilities: Vulnerability[];
}

export interface VulnerabilityReport {
    findings: FormulaFindings[];
    skippedFormulae: string[];
    checked: number;
    complete: boolean;
    outdatedWithoutSbom: string[];
    unscannedFormulae: Record<string, string>;
}

export type AdoptMatchKind = "app" | "bundleId" | "name";
export type AdoptVersionStatus = "same" | "older" | "newer" | "unknown";
export type AdoptStatus = "ready" | "versionMismatch" | "uncertain";

export interface AdoptCandidate {
    token: string;
    fullToken: string;
    name: string;
    desc: string;
    homepage: string;
    version: string;
    autoUpdates: boolean;
    deprecated: boolean;
    matchKind: AdoptMatchKind;
    versionStatus: AdoptVersionStatus;
}

export interface AdoptableApp {
    appName: string;
    path: string;
    bundleId: string;
    version: string;
    status: AdoptStatus;
    candidates: AdoptCandidate[];
}

export interface UnmatchedApp {
    appName: string;
    path: string;
    bundleId: string;
    version: string;
}

export interface AdoptScanResult {
    appDir: string;
    apps: AdoptableApp[];
    unmatched: UnmatchedApp[];
    managedCount: number;
    appStoreApps: string[];
    systemCount: number;
    catalogStale: boolean;
}

export type View =
    | "installed"
    | "casks"
    | "updatable"
    | "all"
    | "allCasks"
    | "adoptable"
    | "leaves"
    | "repositories"
    | "services"
    | "homebrew"
    | "doctor"
    | "security"
    | "cleanup"
    | "snapshots"
    | "dashboard"
    | "settings";
