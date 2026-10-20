import { ExternalLink, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import type { VulnerabilityReport } from "../types";
import {
    type FixFilter,
    filterFindings,
    highestSeverity,
    osvUrl,
    type SeverityFilter,
    vulnerabilityErrorKind,
} from "../utils/vulnerabilities";

interface SecurityViewProps {
    report: VulnerabilityReport | null;
    error: string | null;
    scanning: boolean;
    onScan: () => void;
    onOpenFormula: (name: string) => void;
}

const SEVERITY_FILTERS: SeverityFilter[] = ["all", "low", "medium", "high", "critical"];
const FIX_FILTERS: FixFilter[] = ["all", "available", "unavailable"];

const SecurityView: React.FC<SecurityViewProps> = ({ report, error, scanning, onScan, onOpenFormula }) => {
    const { t } = useTranslation();
    const [severity, setSeverity] = useState<SeverityFilter>("all");
    const [fix, setFix] = useState<FixFilter>("all");

    const findings = useMemo(
        () => (report ? filterFindings(report.findings, severity, fix) : []),
        [report, severity, fix],
    );
    const findingCount = findings.reduce((total, finding) => total + finding.vulnerabilities.length, 0);

    const unscannedNames = report
        ? Object.entries(report.unscannedFormulae).map(([name, reason]) => (reason ? `${name} (${reason})` : name))
        : [];

    return (
        <div className="security-view">
            <div className="header-row">
                <div className="header-title">
                    <h3>{t("headers.security")}</h3>
                </div>
                <div className="header-actions">
                    <button type="button" className="doctor-button" onClick={onScan} disabled={scanning}>
                        {scanning ? <LoaderCircle className="security-spinner" size={16} /> : <ShieldAlert size={16} />}
                        {scanning ? t("security.scanning") : t("security.scan")}
                    </button>
                </div>
            </div>

            <div className="security-body">
                {scanning && (
                    <div className="security-status" role="status">
                        <LoaderCircle className="security-spinner" size={18} />
                        <p>{t("security.scanningDetail")}</p>
                    </div>
                )}

                {error && !scanning && (
                    <div className="security-error" role="alert">
                        <h4>{t(`security.errors.${vulnerabilityErrorKind(error)}`)}</h4>
                        <p>{error}</p>
                    </div>
                )}

                {!report && !scanning && !error && (
                    <div className="security-empty">
                        <ShieldAlert size={36} strokeWidth={1.5} />
                        <p>{t("security.intro")}</p>
                    </div>
                )}

                {report && !scanning && (
                    <>
                        <div className="security-summary" role="status">
                            <span>
                                {t("security.summary", {
                                    count: findingCount,
                                    packages: findings.length,
                                })}
                            </span>
                            <span>{t("security.checked", { count: report.checked })}</span>
                        </div>

                        <div className="security-filters">
                            <label>
                                {t("security.filterSeverity")}
                                <select
                                    value={severity}
                                    onChange={(event) => setSeverity(event.target.value as SeverityFilter)}
                                >
                                    {SEVERITY_FILTERS.map((value) => (
                                        <option key={value} value={value}>
                                            {t(`security.severityFilter.${value}`)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                {t("security.filterFix")}
                                <select value={fix} onChange={(event) => setFix(event.target.value as FixFilter)}>
                                    {FIX_FILTERS.map((value) => (
                                        <option key={value} value={value}>
                                            {t(`security.fixFilter.${value}`)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {!report.complete && (
                            <div className="security-incomplete" role="status">
                                <p>{t("security.incomplete")}</p>
                                {report.outdatedWithoutSbom.length > 0 && (
                                    <p>
                                        {t("security.outdatedWithoutSbom", {
                                            names: report.outdatedWithoutSbom.join(", "),
                                        })}
                                    </p>
                                )}
                                {report.skippedFormulae.length > 0 && (
                                    <p>{t("security.skipped", { names: report.skippedFormulae.join(", ") })}</p>
                                )}
                                {unscannedNames.length > 0 && (
                                    <p>{t("security.unscanned", { names: unscannedNames.join(", ") })}</p>
                                )}
                            </div>
                        )}

                        {findings.length === 0 ? (
                            <div className="security-empty">
                                <ShieldCheck size={36} strokeWidth={1.5} />
                                <p>{report.findings.length === 0 ? t("security.none") : t("security.filteredEmpty")}</p>
                            </div>
                        ) : (
                            <div className="security-list">
                                {findings.map((finding) => (
                                    <section className="security-formula" key={finding.formula}>
                                        <div className="security-formula-header">
                                            <button type="button" onClick={() => onOpenFormula(finding.formula)}>
                                                {finding.formula}
                                            </button>
                                            <span
                                                className={`vuln-badge vuln-${highestSeverity(finding.vulnerabilities)}`}
                                            >
                                                {t(`security.severityName.${highestSeverity(finding.vulnerabilities)}`)}
                                            </span>
                                            {finding.version && (
                                                <span className="security-version">
                                                    {t("security.installedVersion", { version: finding.version })}
                                                </span>
                                            )}
                                        </div>
                                        <ul>
                                            {finding.vulnerabilities.map((vulnerability) => (
                                                <li key={vulnerability.id}>
                                                    <div className="security-advisory">
                                                        <span className={`vuln-badge vuln-${vulnerability.severity}`}>
                                                            {t(`security.severityName.${vulnerability.severity}`, {
                                                                defaultValue: vulnerability.severity,
                                                            })}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="security-advisory-link"
                                                            onClick={() => BrowserOpenURL(osvUrl(vulnerability.id))}
                                                            aria-label={t("security.openAdvisory", {
                                                                id: vulnerability.id,
                                                            })}
                                                        >
                                                            {vulnerability.id}
                                                            <ExternalLink size={12} />
                                                        </button>
                                                        <span className="security-fix">
                                                            {vulnerability.fixAvailable
                                                                ? t("security.fixedIn", {
                                                                      versions: vulnerability.fixedVersions.join(", "),
                                                                  })
                                                                : t("security.noFix")}
                                                        </span>
                                                    </div>
                                                    {vulnerability.summary && <p>{vulnerability.summary}</p>}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="package-footer">{t("footers.security")}</div>
        </div>
    );
};

export default SecurityView;
