import type React from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import "./DashboardView.css";

interface DashboardViewProps {
    formulaeCount: number;
    casksCount: number;
    loading: boolean;
}

interface CompositionSlice {
    key: "formulae" | "casks";
    label: string;
    value: number;
    color: string;
}

const DashboardView: React.FC<DashboardViewProps> = ({ formulaeCount, casksCount, loading }) => {
    const { t, i18n } = useTranslation();

    const total = formulaeCount + casksCount;
    const percentFormat = new Intl.NumberFormat(i18n.language, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const formatPercent = (value: number): string =>
        total === 0 ? percentFormat.format(0) : percentFormat.format(value / total);

    const slices: CompositionSlice[] = [
        { key: "formulae", label: t("dashboard.formulae"), value: formulaeCount, color: "var(--accent)" },
        { key: "casks", label: t("dashboard.casks"), value: casksCount, color: "var(--dashboard-casks, #f59e0b)" },
    ];

    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {t("headers.dashboard")}
                        <span className="settings-badge">BETA</span>
                    </h3>
                </div>
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
                                                contentStyle={{
                                                    background: "var(--bg-secondary-strong)",
                                                    border: "1px solid var(--glass-border)",
                                                    borderRadius: 8,
                                                    color: "var(--text-main)",
                                                }}
                                                itemStyle={{ color: "var(--text-main)" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="dashboard-chart-center" aria-hidden="true">
                                        <span className="dashboard-total">{total}</span>
                                        <span className="dashboard-total-label">{t("dashboard.totalPackages")}</span>
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
                    </div>
                )}
            </div>
        </>
    );
};

export default DashboardView;
