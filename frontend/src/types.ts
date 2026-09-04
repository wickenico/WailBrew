// Shared domain types used across App.tsx and its child components.
// Single source of truth to avoid the same shape being redefined per file.

export interface PackageEntry {
    name: string;
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
}

export interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
    // Homebrew 6 tap trust: true = trusted, false = untrusted, undefined = unknown
    trusted?: boolean;
}

export type View =
    | "installed"
    | "casks"
    | "updatable"
    | "all"
    | "allCasks"
    | "leaves"
    | "repositories"
    | "services"
    | "homebrew"
    | "doctor"
    | "cleanup"
    | "settings";
