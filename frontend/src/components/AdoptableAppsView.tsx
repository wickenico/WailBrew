import {
    AppWindow,
    ChevronDown,
    ChevronRight,
    CircleCheck,
    ExternalLink,
    LoaderCircle,
    PackagePlus,
    RefreshCw,
    TriangleAlert,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GetAppIcon } from "../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import type { AdoptableApp, AdoptCandidate, AdoptScanResult, AdoptStatus } from "../types";
import {
    ADOPT_STATUS_FILTERS,
    type AdoptStatusFilter,
    adoptStatusFor,
    countAdoptStatuses,
    displayCaskVersion,
    filterAdoptableApps,
    selectedCandidate,
} from "../utils/adopt";
import HeaderRow from "./HeaderRow";
import "./AdoptableAppsView.css";

interface AdoptableAppsViewProps {
    result: AdoptScanResult | null;
    error: string | null;
    scanning: boolean;
    adoptDisabled: boolean;
    onScan: () => void;
    onAdopt: (app: AdoptableApp, candidate: AdoptCandidate) => void;
}

const STATUS_ICON: Record<AdoptStatus, React.ReactNode> = {
    ready: <CircleCheck size={12} />,
    versionMismatch: <TriangleAlert size={12} />,
    uncertain: <TriangleAlert size={12} />,
};

const AppIcon: React.FC<{ path: string }> = ({ path }) => {
    const [icon, setIcon] = useState<string>("");

    useEffect(() => {
        let cancelled = false;
        GetAppIcon(path)
            .then((dataUrl) => {
                if (!cancelled) setIcon(dataUrl);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [path]);

    return icon ? (
        <img className="adopt-app-icon" src={icon} alt="" />
    ) : (
        <span className="adopt-app-icon adopt-app-icon-fallback">
            <AppWindow size={18} />
        </span>
    );
};

const AdoptableAppsView: React.FC<AdoptableAppsViewProps> = ({
    result,
    error,
    scanning,
    adoptDisabled,
    onScan,
    onAdopt,
}) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<AdoptStatusFilter>("all");
    const [selection, setSelection] = useState<Record<string, string>>({});
    const [showUnmatched, setShowUnmatched] = useState(false);

    const apps = result?.apps ?? [];
    const visible = useMemo(
        () => filterAdoptableApps(apps, query, status, selection),
        [apps, query, status, selection],
    );
    const counts = useMemo(() => countAdoptStatuses(apps, selection), [apps, selection]);

    const statusDetail = (app: AdoptableApp, candidate: AdoptCandidate): string => {
        switch (adoptStatusFor(candidate)) {
            case "ready":
                return candidate.versionStatus === "same"
                    ? t("adoptable.detail.readySame", { version: displayCaskVersion(candidate.version) })
                    : t("adoptable.detail.readyAutoUpdates", {
                          installed: app.version || "?",
                          version: displayCaskVersion(candidate.version),
                      });
            case "versionMismatch":
                return t("adoptable.detail.versionMismatch", {
                    installed: app.version || "?",
                    version: displayCaskVersion(candidate.version),
                });
            default:
                return t("adoptable.detail.uncertain");
        }
    };

    const actions = (
        <button type="button" className="doctor-button" onClick={onScan} disabled={scanning}>
            {scanning ? <LoaderCircle className="security-spinner" size={16} /> : <RefreshCw size={16} />}
            {scanning ? t("adoptable.scanning") : t("adoptable.rescan")}
        </button>
    );

    return (
        <div className="adopt-view">
            <HeaderRow
                title={t("headers.adoptable")}
                actions={actions}
                searchQuery={query}
                onSearchChange={setQuery}
                onClearSearch={() => setQuery("")}
                placeholder={t("adoptable.searchPlaceholder")}
            />

            <div className="adopt-body">
                {scanning && !result && (
                    <div className="security-status" role="status">
                        <LoaderCircle className="security-spinner" size={18} />
                        <p>{t("adoptable.scanningDetail")}</p>
                    </div>
                )}

                {error && !scanning && (
                    <div className="security-error" role="alert">
                        <h4>{t("adoptable.error")}</h4>
                        <p>{error}</p>
                    </div>
                )}

                {result && (
                    <>
                        <p className="adopt-intro">{t("adoptable.intro", { dir: result.appDir })}</p>

                        {result.catalogStale && (
                            <div className="security-incomplete" role="status">
                                <p>{t("adoptable.catalogStale")}</p>
                            </div>
                        )}

                        <div className="adopt-filters" role="tablist" aria-label={t("adoptable.filterLabel")}>
                            {ADOPT_STATUS_FILTERS.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={status === value}
                                    className={`adopt-filter${status === value ? " active" : ""}`}
                                    onClick={() => setStatus(value)}
                                >
                                    {t(`adoptable.filter.${value}`)}
                                    <span className="adopt-filter-count">{counts[value]}</span>
                                </button>
                            ))}
                        </div>

                        {visible.length === 0 ? (
                            <div className="security-empty">
                                <CircleCheck size={36} strokeWidth={1.5} />
                                <p>{apps.length === 0 ? t("adoptable.none") : t("adoptable.filteredEmpty")}</p>
                            </div>
                        ) : (
                            <ul className="adopt-list">
                                {visible.map((app) => {
                                    const candidate = selectedCandidate(app, selection);
                                    const appStatus = adoptStatusFor(candidate);
                                    return (
                                        <li className="adopt-item" key={app.path}>
                                            <AppIcon path={app.path} />
                                            <div className="adopt-item-main">
                                                <div className="adopt-item-title">
                                                    <span className="adopt-app-name">{app.appName}</span>
                                                    {app.version && (
                                                        <span className="adopt-app-version">{app.version}</span>
                                                    )}
                                                    <span className={`adopt-badge adopt-badge-${appStatus}`}>
                                                        {STATUS_ICON[appStatus]}
                                                        {t(`adoptable.status.${appStatus}`)}
                                                    </span>
                                                </div>
                                                <p className="adopt-item-detail">{statusDetail(app, candidate)}</p>
                                                {(candidate.desc || candidate.homepage) && (
                                                    <p className="adopt-item-desc">
                                                        {candidate.desc}
                                                        {candidate.homepage && (
                                                            <button
                                                                type="button"
                                                                className="adopt-homepage"
                                                                onClick={() => BrowserOpenURL(candidate.homepage)}
                                                                aria-label={t("adoptable.openHomepage", {
                                                                    name: candidate.name,
                                                                })}
                                                            >
                                                                <ExternalLink size={12} />
                                                            </button>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="adopt-item-actions">
                                                {app.candidates.length > 1 ? (
                                                    <select
                                                        className="adopt-cask-select"
                                                        value={candidate.token}
                                                        aria-label={t("adoptable.chooseCask", { name: app.appName })}
                                                        onChange={(event) =>
                                                            setSelection((prev) => ({
                                                                ...prev,
                                                                [app.path]: event.target.value,
                                                            }))
                                                        }
                                                    >
                                                        {app.candidates.map((option) => (
                                                            <option key={option.token} value={option.token}>
                                                                {option.token} ({displayCaskVersion(option.version)})
                                                                {option.deprecated
                                                                    ? ` · ${t("adoptable.deprecated")}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="adopt-cask-token">
                                                        {candidate.token}
                                                        {candidate.deprecated && ` · ${t("adoptable.deprecated")}`}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    className="adopt-button"
                                                    disabled={adoptDisabled}
                                                    onClick={() => onAdopt(app, candidate)}
                                                >
                                                    <PackagePlus size={14} />
                                                    {t("adoptable.adopt")}
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {result.unmatched.length > 0 && (
                            <section className="adopt-unmatched">
                                <button
                                    type="button"
                                    className="adopt-unmatched-toggle"
                                    aria-expanded={showUnmatched}
                                    onClick={() => setShowUnmatched((prev) => !prev)}
                                >
                                    {showUnmatched ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {t("adoptable.unmatched", { count: result.unmatched.length })}
                                </button>
                                {showUnmatched && (
                                    <ul>
                                        {result.unmatched.map((app) => (
                                            <li key={app.path}>
                                                {app.appName}
                                                {app.version && <span> {app.version}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>

            <div className="package-footer">
                {result
                    ? [
                          t("adoptable.footer.managed", { count: result.managedCount }),
                          result.appStoreApps.length > 0
                              ? t("adoptable.footer.appStore", { names: result.appStoreApps.join(", ") })
                              : null,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                    : t("adoptable.footer.idle")}
            </div>
        </div>
    );
};

export default AdoptableAppsView;
