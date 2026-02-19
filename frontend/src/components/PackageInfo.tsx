import { BarChart3, Calendar, ChevronDown, ExternalLink, GitBranch, TrendingUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GetInstalledDependencies, GetInstalledDependents } from "../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
    size?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
    isInstalled?: boolean;
    isCask?: boolean;
}

interface PackageInfoProps {
    packageEntry: PackageEntry | null;
    loadingDetailsFor: string | null;
    view: string;
    onSelectDependency?: (dependencyName: string) => void;
}

interface AnalyticsData {
    install: {
        "30d": { [key: string]: number };
        "90d": { [key: string]: number };
        "365d": { [key: string]: number };
    };
}

// Session-level cache: survives re-renders, reset on page reload
interface CacheEntry { analytics: AnalyticsData | null; brewPageUrl: string | null; }
const analyticsCache = new Map<string, CacheEntry>();

const PackageInfo: React.FC<PackageInfoProps> = ({ packageEntry, loadingDetailsFor, view, onSelectDependency }) => {
    const { t } = useTranslation();
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [brewPageUrl, setBrewPageUrl] = useState<string | null>(null);
    const [showInstalledDeps, setShowInstalledDeps] = useState(false);
    const [installedDeps, setInstalledDeps] = useState<string[]>([]);
    const [loadingInstalledDeps, setLoadingInstalledDeps] = useState(false);
    const [showInstalledDependents, setShowInstalledDependents] = useState(false);
    const [installedDependents, setInstalledDependents] = useState<string[]>([]);
    const [loadingInstalledDependents, setLoadingInstalledDependents] = useState(false);

    const dependencies = packageEntry?.dependencies || [];
    const conflicts = packageEntry?.conflicts?.filter(Boolean) || [];

    const isValidUrl = (url: string) =>
        url && (url.startsWith('http://') || url.startsWith('https://'));

    const shortenUrl = (url: string) => {
        try {
            const u = new URL(url);
            return u.hostname + (u.pathname !== '/' ? u.pathname : '');
        } catch {
            return url;
        }
    };

    // Analytics fetch — with cache + isCask-aware endpoint selection
    const fetchRef = useRef<string | null>(null);
    useEffect(() => {
        if (!packageEntry?.name) {
            setAnalytics(null);
            setBrewPageUrl(null);
            return;
        }

        const name = packageEntry.name;

        // Cache hit → instant, no network needed
        if (analyticsCache.has(name)) {
            const cached = analyticsCache.get(name)!;
            setAnalytics(cached.analytics);
            setBrewPageUrl(cached.brewPageUrl);
            return;
        }

        fetchRef.current = name;
        setLoadingAnalytics(true);

        const fetchAnalytics = async () => {
            try {
                let analytics: AnalyticsData | null = null;
                let brewPageUrl: string | null = null;

                if (packageEntry.isCask === true) {
                    // Known cask → single targeted request
                    const res = await fetch(`https://formulae.brew.sh/api/cask/${name}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        analytics = data.analytics?.install ? data.analytics : null;
                        brewPageUrl = `https://formulae.brew.sh/cask/${name}`;
                    }
                } else if (packageEntry.isCask === false) {
                    // Known formula → single targeted request
                    const res = await fetch(`https://formulae.brew.sh/api/formula/${name}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        analytics = data.analytics?.install ? data.analytics : null;
                        brewPageUrl = `https://formulae.brew.sh/formula/${name}`;
                    }
                } else {
                    // Unknown type → fetch both in parallel, use whichever responds OK first
                    const [formulaRes, caskRes] = await Promise.all([
                        fetch(`https://formulae.brew.sh/api/formula/${name}.json`),
                        fetch(`https://formulae.brew.sh/api/cask/${name}.json`),
                    ]);
                    if (formulaRes.ok) {
                        const data = await formulaRes.json();
                        analytics = data.analytics?.install ? data.analytics : null;
                        brewPageUrl = `https://formulae.brew.sh/formula/${name}`;
                    } else if (caskRes.ok) {
                        const data = await caskRes.json();
                        analytics = data.analytics?.install ? data.analytics : null;
                        brewPageUrl = `https://formulae.brew.sh/cask/${name}`;
                    }
                }

                // Only apply if this fetch is still the current one (no stale updates)
                if (fetchRef.current !== name) return;

                analyticsCache.set(name, { analytics, brewPageUrl });
                setAnalytics(analytics);
                setBrewPageUrl(brewPageUrl);
            } catch {
                if (fetchRef.current !== name) return;
                analyticsCache.set(name, { analytics: null, brewPageUrl: null });
                setAnalytics(null);
                setBrewPageUrl(null);
            } finally {
                if (fetchRef.current === name) setLoadingAnalytics(false);
            }
        };

        fetchAnalytics();
    }, [packageEntry?.name, packageEntry?.isCask]);

    // Reset installed deps/dependents when package changes
    useEffect(() => {
        setShowInstalledDeps(false);
        setInstalledDeps([]);
        setShowInstalledDependents(false);
        setInstalledDependents([]);
    }, [packageEntry?.name]);

    // Fetch installed dependencies when panel is opened
    useEffect(() => {
        if (!showInstalledDeps || !packageEntry?.name) return;
        setLoadingInstalledDeps(true);
        GetInstalledDependencies(packageEntry.name)
            .then(deps => setInstalledDeps(deps ?? []))
            .catch(() => setInstalledDeps([]))
            .finally(() => setLoadingInstalledDeps(false));
    }, [showInstalledDeps, packageEntry?.name]);

    // Fetch installed dependents (brew uses --installed) when panel is opened
    useEffect(() => {
        if (!showInstalledDependents || !packageEntry?.name) return;
        setLoadingInstalledDependents(true);
        GetInstalledDependents(packageEntry.name)
            .then(deps => setInstalledDependents(deps ?? []))
            .catch(() => setInstalledDependents([]))
            .finally(() => setLoadingInstalledDependents(false));
    }, [showInstalledDependents, packageEntry?.name]);

    const formatNumber = (num: number): string => num.toLocaleString();

    const getInstallCount = (period: "30d" | "90d" | "365d"): number => {
        if (!analytics?.install?.[period]) return 0;
        const periodData = analytics.install[period];
        const mainPackage = Object.keys(periodData).find(key => !key.includes('--HEAD'));
        return mainPackage ? periodData[mainPackage] : 0;
    };

    // ── Empty state ──────────────────────────────────────────────
    if (!packageEntry) {
        return (
            <div className="pi-container">
                <div className="pi-empty">
                    <span className="pi-empty-icon">📦</span>
                    <span className="pi-empty-text">{t('packageInfo.noSelection')}</span>
                </div>
            </div>
        );
    }

    const isLoading = loadingDetailsFor === packageEntry.name;
    const typeLabel = packageEntry.isCask ? 'Cask' : 'Formula';
    const typeBadgeClass = packageEntry.isCask ? 'pi-type-badge cask' : 'pi-type-badge formula';

    return (
        <div className="pi-container">
            {/* ── Left: main info ──────────────────────────────── */}
            <div className="pi-main">

                {/* Header — always visible immediately */}
                <div className="pi-header">
                    <div className="pi-header-left">
                        <span className="pi-name">{packageEntry.name}</span>
                        {packageEntry.isCask !== undefined && (
                            <span className={typeBadgeClass}>{typeLabel}</span>
                        )}
                        {packageEntry.isInstalled && (
                            <span className="pi-installed-badge">{t('packageInfo.installed')}</span>
                        )}
                        {view !== 'all' && packageEntry.installedVersion && (
                            <span className="pi-version-badge">{packageEntry.installedVersion}</span>
                        )}
                    </div>
                </div>

                {/* Description — skeleton while loading */}
                {isLoading ? (
                    <div className="pi-skel pi-skel-desc" />
                ) : packageEntry.desc ? (
                    <p className="pi-desc">{packageEntry.desc}</p>
                ) : null}

                {/* Meta rows — always show structure, skeleton values while loading */}
                <div className="pi-meta">
                    {/* Version/Status row */}
                    {view === 'all' ? (
                        <div className="pi-row">
                            <span className="pi-row-label">{t('packageInfo.status')}</span>
                            <span className={`pi-status-value ${packageEntry.isInstalled ? 'installed' : 'not-installed'}`}>
                                {packageEntry.isInstalled ? t('packageInfo.installed') : t('packageInfo.notInstalled')}
                            </span>
                        </div>
                    ) : packageEntry.latestVersion && packageEntry.latestVersion !== packageEntry.installedVersion ? (
                        <div className="pi-row">
                            <span className="pi-row-label">{t('packageInfo.labelLatest')}</span>
                            <span className="pi-latest-badge standalone">→ {packageEntry.latestVersion}</span>
                        </div>
                    ) : null}

                    {/* Homepage */}
                    <div className="pi-row">
                        <span className="pi-row-label">{t('packageInfo.labelHomepage')}</span>
                        {isLoading ? (
                            <span className="pi-skel pi-skel-url" />
                        ) : packageEntry.homepage && isValidUrl(packageEntry.homepage) ? (
                            <span
                                className="pi-link"
                                onClick={() => BrowserOpenURL(packageEntry.homepage!)}
                                title={packageEntry.homepage}
                            >
                                {shortenUrl(packageEntry.homepage)}
                                <ExternalLink size={10} className="pi-link-icon" />
                            </span>
                        ) : <span className="pi-row-value" style={{ opacity: 0.35 }}>--</span>}
                    </div>

                    {/* Brew page */}
                    <div className="pi-row">
                        <span className="pi-row-label">{t('packageInfo.labelBrewPage')}</span>
                        {loadingAnalytics ? (
                            <span className="pi-skel pi-skel-url" />
                        ) : brewPageUrl ? (
                            <span
                                className="pi-link"
                                onClick={() => BrowserOpenURL(brewPageUrl)}
                                title={brewPageUrl}
                            >
                                {shortenUrl(brewPageUrl)}
                                <ExternalLink size={10} className="pi-link-icon" />
                            </span>
                        ) : <span className="pi-row-value" style={{ opacity: 0.35 }}>--</span>}
                    </div>
                </div>

                {/* ── Dependencies — skeleton chips while loading ── */}
                <div className="pi-section">
                    <div className="pi-chips-row">
                        <span className="pi-chips-label">{t('packageInfo.labelDeps')}</span>
                        <div className="pi-chips">
                            {isLoading ? (
                                <>
                                    <span className="pi-skel pi-skel-chip" style={{ width: '52px' }} />
                                    <span className="pi-skel pi-skel-chip" style={{ width: '72px' }} />
                                    <span className="pi-skel pi-skel-chip" style={{ width: '40px' }} />
                                </>
                            ) : dependencies.length > 0 ? (
                                dependencies.map(dep => (
                                    onSelectDependency ? (
                                        <span
                                            key={dep}
                                            className="pi-chip clickable"
                                            onClick={() => onSelectDependency(dep)}
                                            title={dep}
                                        >{dep}</span>
                                    ) : (
                                        <span key={dep} className="pi-chip" title={dep}>{dep}</span>
                                    )
                                ))
                            ) : (
                                <span className="pi-chip" style={{ opacity: 0.35 }}>--</span>
                            )}
                        </div>
                    </div>

                    {!isLoading && conflicts.length > 0 && (
                        <div className="pi-chips-row">
                            <span className="pi-chips-label">{t('packageInfo.labelConflicts')}</span>
                            <div className="pi-chips">
                                {conflicts.map(c => (
                                    onSelectDependency ? (
                                        <span
                                            key={c}
                                            className="pi-chip conflict clickable"
                                            onClick={() => onSelectDependency(c)}
                                            title={c}
                                        >{c}</span>
                                    ) : (
                                        <span key={c} className="pi-chip conflict" title={c}>{c}</span>
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Installed deps / dependents toggles ── */}
                {packageEntry.isInstalled && !packageEntry.isCask && (
                    <div className="installed-deps-row">
                        {/* Dependencies: brew deps --installed */}
                        <div className="installed-deps-section">
                            <button
                                className={`installed-deps-toggle${showInstalledDeps ? ' open' : ''}`}
                                onClick={() => {
                                    setShowInstalledDeps(prev => !prev);
                                    setShowInstalledDependents(false);
                                }}
                            >
                                <GitBranch size={11} />
                                <span>{t('packageInfo.installedDepsTitle')}</span>
                                <ChevronDown size={11} className={`installed-deps-chevron${showInstalledDeps ? ' rotated' : ''}`} />
                            </button>

                            {showInstalledDeps && (
                                <div className="installed-deps-list">
                                    {loadingInstalledDeps ? (
                                        <span className="installed-dep-loading">{t('common.loading')}</span>
                                    ) : installedDeps.length === 0 ? (
                                        <span className="installed-dep-none">{t('packageInfo.installedDepsNone')}</span>
                                    ) : (
                                        installedDeps.map(dep => (
                                            <span
                                                key={dep}
                                                className="installed-dep-chip"
                                                onClick={() => onSelectDependency?.(dep)}
                                                title={dep}
                                            >
                                                {dep}
                                            </span>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Dependents: brew uses --installed */}
                        <div className="installed-deps-section">
                            <button
                                className={`installed-deps-toggle${showInstalledDependents ? ' open' : ''}`}
                                onClick={() => {
                                    setShowInstalledDependents(prev => !prev);
                                    setShowInstalledDeps(false);
                                }}
                            >
                                <GitBranch size={11} style={{ transform: 'scaleY(-1)' }} />
                                <span>{t('packageInfo.installedDependentsTitle')}</span>
                                <ChevronDown size={11} className={`installed-deps-chevron${showInstalledDependents ? ' rotated' : ''}`} />
                            </button>

                            {showInstalledDependents && (
                                <div className="installed-deps-list">
                                    {loadingInstalledDependents ? (
                                        <span className="installed-dep-loading">{t('common.loading')}</span>
                                    ) : installedDependents.length === 0 ? (
                                        <span className="installed-dep-none">{t('packageInfo.installedDependentsNone')}</span>
                                    ) : (
                                        installedDependents.map(dep => (
                                            <span
                                                key={dep}
                                                className="installed-dep-chip"
                                                onClick={() => onSelectDependency?.(dep)}
                                                title={dep}
                                            >
                                                {dep}
                                            </span>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right: Analytics (layout unchanged) ─────────── */}
            <div className="package-analytics">
                {loadingAnalytics ? (
                    <div className="analytics-loading">{t('packageInfo.loadingAnalytics')}</div>
                ) : (
                    <>
                        <div className="analytics-header">
                            <BarChart3 size={16} />
                            <span>{t('packageInfo.downloadStatistics')}</span>
                        </div>
                        <div className="analytics-stats">
                            {(["30d", "90d", "365d"] as const).map((period, i) => {
                                const count = getInstallCount(period);
                                const isPlaceholder = !analytics;
                                const icons = [<Calendar size={18} />, <TrendingUp size={18} />, <BarChart3 size={18} />];
                                const labels = [t('packageInfo.last30Days'), t('packageInfo.last90Days'), t('packageInfo.last365Days')];
                                return (
                                    <div key={period} className={`analytics-stat${isPlaceholder ? ' analytics-stat-placeholder' : ''}`}>
                                        <div className="stat-icon">{icons[i]}</div>
                                        <div className="stat-content">
                                            <div className="stat-label">{labels[i]}</div>
                                            <div className="stat-value">{isPlaceholder ? '--' : formatNumber(count)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PackageInfo;
