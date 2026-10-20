import type { FormulaFindings, PackageEntry, Vulnerability, VulnerabilityReport } from "../types";

export type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";
export type FixFilter = "all" | "available" | "unavailable";

const SEVERITY_RANK: Record<string, number> = {
    unknown: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

export function severityRank(severity: string): number {
    return SEVERITY_RANK[severity] ?? 0;
}

export function highestSeverity(vulnerabilities: Vulnerability[]): string {
    return vulnerabilities.reduce(
        (best, vulnerability) =>
            severityRank(vulnerability.severity) > severityRank(best) ? vulnerability.severity : best,
        "unknown",
    );
}

export function osvUrl(id: string): string {
    return `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;
}

export function vulnerabilityErrorKind(message: string): "unavailable" | "offline" | "timeout" | "generic" {
    const text = message.toLowerCase();
    if (text.includes("not available") || text.includes("unknown command") || text.includes("invalid command")) {
        return "unavailable";
    }
    if (text.includes("timed out") || text.includes("timeout") || text.includes("deadline exceeded")) {
        return "timeout";
    }
    if (
        text.includes("osv api") ||
        text.includes("osv.dev") ||
        text.includes("could not resolve") ||
        text.includes("network") ||
        text.includes("connection") ||
        text.includes("offline") ||
        text.includes("curl exit") ||
        text.includes("failed to connect") ||
        text.includes("no route") ||
        text.includes("temporary failure")
    ) {
        return "offline";
    }
    return "generic";
}

export function filterFindings(
    findings: FormulaFindings[],
    severity: SeverityFilter,
    fix: FixFilter,
): FormulaFindings[] {
    const minimum = severity === "all" ? 0 : severityRank(severity);
    return findings
        .map((finding) => ({
            ...finding,
            vulnerabilities: finding.vulnerabilities
                .filter((vulnerability) => {
                    if (severity !== "all" && severityRank(vulnerability.severity) < minimum) {
                        return false;
                    }
                    if (fix === "available" && !vulnerability.fixAvailable) {
                        return false;
                    }
                    if (fix === "unavailable" && vulnerability.fixAvailable) {
                        return false;
                    }
                    return true;
                })
                .sort((left, right) => severityRank(right.severity) - severityRank(left.severity)),
        }))
        .filter((finding) => finding.vulnerabilities.length > 0)
        .sort((left, right) => {
            const bySeverity =
                severityRank(highestSeverity(right.vulnerabilities)) -
                severityRank(highestSeverity(left.vulnerabilities));
            if (bySeverity !== 0) {
                return bySeverity;
            }
            return left.formula.localeCompare(right.formula);
        });
}

function findingForPackage(report: VulnerabilityReport, name: string): FormulaFindings | undefined {
    const exact = report.findings.find((item) => item.formula === name);
    if (exact) {
        return exact;
    }
    const suffix = report.findings.filter((item) => item.formula.endsWith(`/${name}`));
    return suffix.length === 1 ? suffix[0] : undefined;
}

export function annotatePackage(pkg: PackageEntry, report: VulnerabilityReport | null): PackageEntry {
    if (!report || pkg.isCask) {
        return clearVulnerability(pkg);
    }
    const finding = findingForPackage(report, pkg.name);
    if (!finding || finding.vulnerabilities.length === 0) {
        return clearVulnerability(pkg);
    }
    const severity = highestSeverity(finding.vulnerabilities);
    if (pkg.vulnerabilityCount === finding.vulnerabilities.length && pkg.vulnerabilitySeverity === severity) {
        return pkg;
    }
    return {
        ...pkg,
        vulnerabilityCount: finding.vulnerabilities.length,
        vulnerabilitySeverity: severity,
    };
}

export function openVulnerabilities(
    report: VulnerabilityReport | null,
    pkg: PackageEntry | null,
): Vulnerability[] | undefined {
    if (!report || !pkg || pkg.isCask) {
        return undefined;
    }
    return findingForPackage(report, pkg.name)?.vulnerabilities;
}

function clearVulnerability(pkg: PackageEntry): PackageEntry {
    if (pkg.vulnerabilityCount === undefined && pkg.vulnerabilitySeverity === undefined) {
        return pkg;
    }
    const { vulnerabilityCount: _count, vulnerabilitySeverity: _severity, ...rest } = pkg;
    return rest;
}
