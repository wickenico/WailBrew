import { ArrowRight, HardDrive, Package, RefreshCw } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { GetBrewPath, GetHomebrewVersion } from "../../wailsjs/go/main/App";
import { mapToSupportedLanguage } from "../i18n/languageUtils";
import type { PackageEntry, View } from "../types";
import "./DashboardView.css";

interface DashboardViewProps {
    formulae: PackageEntry[];
    casks: PackageEntry[];
    updatablePackages: PackageEntry[];
    securityCount: number;
    loading: boolean;
    onNavigate: (view: View) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
    formulae,
    casks,
    updatablePackages,
    securityCount,
    loading,
    onNavigate,
}) => {
    const { t, i18n } = useTranslation();
    const total = formulae.length + casks.length;
    const [brewVersion, setBrewVersion] = useState("");
    const [brewPath, setBrewPath] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([GetHomebrewVersion(), GetBrewPath()])
            .then(([version, path]) => {
                if (active) {
                    setBrewVersion(version || "");
                    setBrewPath(path || "");
                }
            })
            .catch((error) => console.error("Failed to load Homebrew dashboard details:", error));
        return () => {
            active = false;
        };
    }, []);

    const appLanguage = mapToSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);
    const numberLocale =
        appLanguage === "zhCN"
            ? "zh-CN"
            : appLanguage === "zhTW"
              ? "zh-TW"
              : appLanguage === "pt_BR"
                ? "pt-BR"
                : appLanguage;
    const percentFormat = new Intl.NumberFormat(numberLocale, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const formatPercent = (value: number): string =>
        total === 0 ? percentFormat.format(0) : percentFormat.format(value / total);
    const slices = [
        { key: "formulae", label: t("dashboard.formulae"), value: formulae.length, color: "var(--accent)" },
        { key: "casks", label: t("dashboard.casks"), value: casks.length, color: "var(--dashboard-casks, #f59e0b)" },
    ];

    const requestCount = formulae.filter((pkg) => pkg.installReason === "on_request").length;
    const dependencyCount = formulae.filter((pkg) => pkg.installReason === "dependency").length;
    const sizedPackages = [...formulae, ...casks].filter((pkg) => pkg.size && pkg.size !== "Unknown");
    const sizePending = sizedPackages.length < total;
    const topPackages = [...sizedPackages]
        .sort((a, b) => sizeToBytes(b.size || "") - sizeToBytes(a.size || ""))
        .slice(0, 5);

    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3>{t("headers.dashboard")}</h3>
                </div>
                <button className="dashboard-refresh" type="button" onClick={() => onNavigate("updatable")}>
                    <RefreshCw size={15} /> {t("dashboard.viewUpdates")} <ArrowRight size={15} />
                </button>
            </div>
            <div className="table-container">
                {loading && (
                    <div className="table-loading-overlay">
                        <div className="spinner"></div>
                        <div className="loading-text">{t("dashboard.loading")}</div>
                    </div>
                )}
                {!loading && total === 0 && <div className="dashboard-empty">{t("dashboard.empty")}</div>}
                {!loading && total > 0 && (
                    <div className="dashboard-content">
                        <div className="dashboard-stats">
                            <button className="dashboard-stat" type="button" onClick={() => onNavigate("installed")}>
                                <Package size={22} />
                                <span className="dashboard-stat-copy">
                                    <strong>{total}</strong>
                                    <span>{t("dashboard.installed")}</span>
                                </span>
                            </button>
                            <button
                                className="dashboard-stat dashboard-stat-attention"
                                type="button"
                                onClick={() => onNavigate("updatable")}
                            >
                                <ArrowRight size={22} />
                                <span className="dashboard-stat-copy">
                                    <strong>{updatablePackages.length}</strong>
                                    <span>{t("dashboard.updatesAvailable")}</span>
                                </span>
                            </button>
                            <div className="dashboard-stat">
                                <HardDrive size={22} />
                                <span className="dashboard-stat-copy">
                                    <strong>{brewVersion || "—"}</strong>
                                    <span>{brewPath || t("dashboard.homebrew")}</span>
                                </span>
                            </div>
                        </div>

                        {updatablePackages.length > 0 && (
                            <section className="dashboard-card dashboard-updates">
                                <div className="dashboard-card-heading">
                                    <h4>{t("dashboard.updatesAvailable")}</h4>
                                    <button
                                        type="button"
                                        className="dashboard-link"
                                        onClick={() => onNavigate("updatable")}
                                    >
                                        {t("dashboard.viewAll")} <ArrowRight size={15} />
                                    </button>
                                </div>
                                <ul>
                                    {updatablePackages.slice(0, 5).map((pkg) => (
                                        <li key={`${pkg.name}-${pkg.isCask ? "cask" : "formula"}`}>
                                            <span>{pkg.name}</span>
                                            <span className="dashboard-package-kind">
                                                {pkg.isCask ? t("dashboard.casks") : t("dashboard.formulae")}
                                            </span>
                                            <span className="dashboard-version">
                                                {pkg.installedVersion} <ArrowRight size={13} />{" "}
                                                {pkg.latestVersion || "—"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <div className="dashboard-grid">
                            <section className="dashboard-card" aria-labelledby="dashboard-composition-title">
                                <h4 id="dashboard-composition-title">{t("dashboard.composition")}</h4>
                                <div className="dashboard-composition">
                                    <div
                                        className="dashboard-chart"
                                        role="img"
                                        aria-label={slices
                                            .map((s) => `${s.label}: ${s.value} (${formatPercent(s.value)})`)
                                            .join(", ")}
                                    >
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={slices}
                                                    dataKey="value"
                                                    nameKey="label"
                                                    innerRadius="62%"
                                                    outerRadius="92%"
                                                    paddingAngle={slices.every((s) => s.value > 0) ? 2 : 0}
                                                    stroke="none"
                                                    startAngle={90}
                                                    endAngle={-270}
                                                >
                                                    {slices.map((slice) => (
                                                        <Cell key={slice.key} fill={slice.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value, name) => [
                                                        `${value} (${formatPercent(Number(value))})`,
                                                        name,
                                                    ]}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="dashboard-chart-center" aria-hidden="true">
                                            <span className="dashboard-total">{total}</span>
                                            <span className="dashboard-total-label">
                                                {t("dashboard.totalPackages")}
                                            </span>
                                        </div>
                                    </div>
                                    <ul className="dashboard-legend">
                                        {slices.map((slice) => (
                                            <li key={slice.key}>
                                                <span
                                                    className="dashboard-legend-swatch"
                                                    style={{ background: slice.color }}
                                                    aria-hidden="true"
                                                />
                                                <span className="dashboard-legend-label">{slice.label}</span>
                                                <span className="dashboard-legend-value">
                                                    {slice.value}
                                                    <span className="dashboard-legend-percent">
                                                        {formatPercent(slice.value)}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>

                            <section className="dashboard-card">
                                <h4>{t("dashboard.installReason")}</h4>
                                <div className="dashboard-category-summary">
                                    <div>
                                        <span>{t("dashboard.onRequest")}</span>
                                        <strong>
                                            {requestCount}
                                            <small>
                                                {formulae.length
                                                    ? percentFormat.format(requestCount / formulae.length)
                                                    : percentFormat.format(0)}
                                            </small>
                                        </strong>
                                    </div>
                                    <div>
                                        <span>{t("dashboard.dependencies")}</span>
                                        <strong>
                                            {dependencyCount}
                                            <small>
                                                {formulae.length
                                                    ? percentFormat.format(dependencyCount / formulae.length)
                                                    : percentFormat.format(0)}
                                            </small>
                                        </strong>
                                    </div>
                                    <p>{t("dashboard.installReasonHint")}</p>
                                </div>
                            </section>
                        </div>

                        <section className="dashboard-card dashboard-storage">
                            <div className="dashboard-card-heading">
                                <h4>
                                    <HardDrive size={16} /> {t("dashboard.storage")}
                                </h4>
                                <span>
                                    {sizePending
                                        ? t("dashboard.storagePartial", { count: sizedPackages.length, total })
                                        : t("dashboard.storageMeasured", { count: total })}
                                </span>
                            </div>
                            {topPackages.length ? (
                                <ul>
                                    {topPackages.map((pkg) => (
                                        <li key={`${pkg.name}-${pkg.isCask ? "cask" : "formula"}`}>
                                            <span>{pkg.name}</span>
                                            <span>{pkg.size}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>{t("dashboard.storageUnavailable")}</p>
                            )}
                        </section>

                        <section className="dashboard-attention-row">
                            <button type="button" onClick={() => onNavigate("security")}>
                                <span>{t("dashboard.securityFindings")}</span>
                                <strong>{securityCount >= 0 ? securityCount : "—"}</strong>
                                <ArrowRight size={15} />
                            </button>
                            <button type="button" onClick={() => onNavigate("cleanup")}>
                                <span>{t("dashboard.cleanup")}</span>
                                <ArrowRight size={15} />
                            </button>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
};

function sizeToBytes(value: string): number {
    const match = value.trim().match(/^([\d.]+)\s*([KMGT]?)B?$/i);
    if (!match) return -1;
    const unit = match[2].toUpperCase();
    const power = unit ? "KMGT".indexOf(unit) + 1 : 0;
    return Number(match[1]) * 1024 ** power;
}

export default DashboardView;
