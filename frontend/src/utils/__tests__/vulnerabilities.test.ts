import { describe, expect, it } from "vitest";
import type { FormulaFindings, VulnerabilityReport } from "../../types";
import {
    annotatePackage,
    filterFindings,
    highestSeverity,
    openVulnerabilities,
    vulnerabilityErrorKind,
} from "../vulnerabilities";

const curl: FormulaFindings = {
    formula: "curl",
    version: "8.7.1",
    repoUrl: "https://github.com/curl/curl",
    vulnerabilities: [
        {
            id: "CVE-LOW",
            severity: "low",
            summary: "minor",
            aliases: [],
            fixedVersions: ["8.8.0"],
            fixAvailable: true,
        },
        {
            id: "CVE-CRIT",
            severity: "critical",
            summary: "serious",
            aliases: [],
            fixedVersions: [],
            fixAvailable: false,
        },
    ],
};

const wget: FormulaFindings = {
    formula: "wget",
    version: "1.21",
    repoUrl: "",
    vulnerabilities: [
        {
            id: "CVE-MED",
            severity: "medium",
            summary: "medium",
            aliases: [],
            fixedVersions: ["1.22"],
            fixAvailable: true,
        },
    ],
};

const report: VulnerabilityReport = {
    findings: [wget, curl],
    skippedFormulae: [],
    checked: 2,
    complete: true,
    outdatedWithoutSbom: [],
    unscannedFormulae: {},
};

describe("filterFindings", () => {
    it("keeps advisories at or above the selected severity and sorts critical first", () => {
        const filtered = filterFindings([wget, curl], "high", "all");

        expect(filtered.map((finding) => finding.formula)).toEqual(["curl"]);
        expect(filtered[0].vulnerabilities.map((vulnerability) => vulnerability.id)).toEqual(["CVE-CRIT"]);
    });

    it("filters by whether a released fix exists", () => {
        const filtered = filterFindings([curl], "all", "available");

        expect(filtered[0].vulnerabilities.map((vulnerability) => vulnerability.id)).toEqual(["CVE-LOW"]);
    });

    it("drops a formula when every advisory is filtered out", () => {
        expect(filterFindings([wget], "critical", "all")).toEqual([]);
    });
});

describe("annotatePackage", () => {
    it("marks an installed formula with its highest severity", () => {
        const annotated = annotatePackage({ name: "curl", installedVersion: "8.7.1", isInstalled: true }, report);

        expect(annotated.vulnerabilityCount).toBe(2);
        expect(annotated.vulnerabilitySeverity).toBe("critical");
        expect(highestSeverity(curl.vulnerabilities)).toBe("critical");
    });

    it("matches a tap-qualified formula to its short name", () => {
        const annotated = annotatePackage(
            { name: "curl", installedVersion: "8.7.1", isInstalled: true },
            {
                ...report,
                findings: [{ ...curl, formula: "example/tap/curl" }],
            },
        );

        expect(annotated.vulnerabilityCount).toBe(2);
    });

    it("leaves casks unmarked", () => {
        const annotated = annotatePackage({ name: "firefox", installedVersion: "120", isCask: true }, report);

        expect(annotated.vulnerabilityCount).toBeUndefined();
        expect(openVulnerabilities(report, annotated)).toBeUndefined();
    });
});

describe("vulnerabilityErrorKind", () => {
    it("classifies an old Homebrew and an OSV outage", () => {
        expect(vulnerabilityErrorKind("brew vulns is not available in this Homebrew")).toBe("unavailable");
        expect(vulnerabilityErrorKind("OSV API request to https://api.osv.dev failed (curl exit 28)")).toBe("offline");
        expect(vulnerabilityErrorKind("command timed out after 5m0s")).toBe("timeout");
    });
});
