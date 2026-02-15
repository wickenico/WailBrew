import { BarChart3, Calendar, ExternalLink, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

const PackageInfo: React.FC<PackageInfoProps> = ({ packageEntry, loadingDetailsFor, view, onSelectDependency }) => {
    const { t } = useTranslation();
    const [isHomepageHovered, setIsHomepageHovered] = useState(false);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [brewPageUrl, setBrewPageUrl] = useState<string | null>(null);

    const name = packageEntry?.name || t('common.notAvailable');
    const desc = packageEntry?.desc || t('common.notAvailable');
    const homepage = packageEntry?.homepage || t('common.notAvailable');
    const version = packageEntry?.installedVersion || t('common.notAvailable');
    const status = packageEntry ? (packageEntry.isInstalled ? t('packageInfo.installed') : t('packageInfo.notInstalled')) : t('common.notAvailable');
    const dependencies = packageEntry?.dependencies || [];
    const conflicts = packageEntry?.conflicts?.length ? packageEntry.conflicts.join(", ") : t('common.notAvailable');

    const isValidUrl = (url: string) => {
        return url && url !== t('common.notAvailable') && (url.startsWith('http://') || url.startsWith('https://'));
    };

    const handleHomepageClick = () => {
        if (packageEntry?.homepage && isValidUrl(packageEntry.homepage)) {
            BrowserOpenURL(packageEntry.homepage);
        }
    };

    // Fetch analytics data from Homebrew API
    useEffect(() => {
        if (!packageEntry?.name) {
            setAnalytics(null);
            setBrewPageUrl(null);
            return;
        }

        const fetchAnalytics = async () => {
            setLoadingAnalytics(true);
            try {
                // Try formula first, then cask if formula fails
                let response = await fetch(`https://formulae.brew.sh/api/formula/${packageEntry.name}.json`);
                let packageType: "formula" | "cask" | null = null;

                if (response.ok) {
                    packageType = "formula";
                } else {
                    // Try cask API
                    response = await fetch(`https://formulae.brew.sh/api/cask/${packageEntry.name}.json`);
                    if (response.ok) {
                        packageType = "cask";
                    }
                }

                if (response.ok && packageType) {
                    const data = await response.json();
                    if (data.analytics?.install) {
                        setAnalytics(data.analytics);
                    } else {
                        setAnalytics(null);
                    }
                    setBrewPageUrl(`https://formulae.brew.sh/${packageType}/${packageEntry.name}`);
                } else {
                    setAnalytics(null);
                    setBrewPageUrl(null);
                }
            } catch (error) {
                console.error('Failed to fetch analytics:', error);
                setAnalytics(null);
                setBrewPageUrl(null);
            } finally {
                setLoadingAnalytics(false);
            }
        };

        fetchAnalytics();
    }, [packageEntry?.name]);

    const formatNumber = (num: number): string => {
        return num.toLocaleString();
    };

    const getInstallCount = (period: "30d" | "90d" | "365d"): number => {
        if (!analytics?.install?.[period]) return 0;
        const periodData = analytics.install[period];
        const mainPackage = Object.keys(periodData).find(key => !key.includes('--HEAD'));
        return mainPackage ? periodData[mainPackage] : 0;
    };

    return (
        <div className="package-info-container">
            <div className="package-info-main">
                <p>
                    <strong>{name}</strong>{" "}
                    {packageEntry && loadingDetailsFor === packageEntry.name && (
                        <span style={{ fontSize: "12px", color: "#888" }}>{t('packageInfo.loading')}</span>
                    )}
                </p>
                <p>{t('packageInfo.description')}: {desc}</p>
                <p>
                    {t('packageInfo.homepage')}:{" "}
                    {isValidUrl(homepage) ? (
                        <span
                            onClick={handleHomepageClick}
                            className="text-link"
                            title={homepage}
                        >
                            {homepage}
                            {isHomepageHovered && (
                                <ExternalLink size={14} className="link-icon" />
                            )}
                        </span>
                    ) : (
                        <span>{homepage}</span>
                    )}
                </p>
                <p>
                    {t('packageInfo.brewPage')}:{" "}
                    {brewPageUrl ? (
                        <span
                            onClick={() => BrowserOpenURL(brewPageUrl)}
                            className="text-link"
                            title={brewPageUrl}
                        >
                            {brewPageUrl}
                        </span>
                    ) : (
                        <span>{t('common.notAvailable')}</span>
                    )}
                </p>
                {view === "all" ? (
                    <p>{t('packageInfo.status')}: {status}</p>
                ) : (
                    <p>{t('packageInfo.version')}: {version}</p>
                )}
                <p>
                    {t('packageInfo.dependencies')}:{" "}
                    {dependencies.length > 0 ? (
                        dependencies.map((dep, index) => (
                            <React.Fragment key={dep}>
                                {onSelectDependency ? (
                                    <span
                                        onClick={() => onSelectDependency(dep)}
                                        className="text-link"
                                        title={`Click to view ${dep}`}
                                    >
                                        {dep}
                                    </span>
                                ) : (
                                    <span>{dep}</span>
                                )}
                                {index < dependencies.length - 1 && ", "}
                            </React.Fragment>
                        ))
                    ) : (
                        <span>{t('common.notAvailable')}</span>
                    )}
                </p>
                <p>{t('packageInfo.conflicts')}: {conflicts}</p>
            </div>

            <div className="package-analytics">
                {loadingAnalytics ? (
                    <div className="analytics-loading">{t('packageInfo.loadingAnalytics')}</div>
                ) : analytics ? (
                    <>
                        <div className="analytics-header">
                            <BarChart3 size={16} />
                            <span>{t('packageInfo.downloadStatistics')}</span>
                        </div>
                        <div className="analytics-stats">
                            <div className="analytics-stat">
                                <div className="stat-icon">
                                    <Calendar size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-label">{t('packageInfo.last30Days')}</div>
                                    <div className="stat-value">{formatNumber(getInstallCount("30d"))}</div>
                                </div>
                            </div>
                            <div className="analytics-stat">
                                <div className="stat-icon">
                                    <TrendingUp size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-label">{t('packageInfo.last90Days')}</div>
                                    <div className="stat-value">{formatNumber(getInstallCount("90d"))}</div>
                                </div>
                            </div>
                            <div className="analytics-stat">
                                <div className="stat-icon">
                                    <BarChart3 size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-label">{t('packageInfo.last365Days')}</div>
                                    <div className="stat-value">{formatNumber(getInstallCount("365d"))}</div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="analytics-header">
                            <BarChart3 size={16} />
                            <span>{t('packageInfo.downloadStatistics')}</span>
                        </div>
                        <div className="analytics-stats">
                            <div className="analytics-stat analytics-stat-placeholder">
                                <div className="stat-icon">
                                    <Calendar size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-label">{t('packageInfo.last30Days')}</div>
                                    <div className="stat-value">--</div>
                                </div>
                            </div>
                            <div className="analytics-stat analytics-stat-placeholder">
                                <div className="stat-icon">
                                    <TrendingUp size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-label">{t('packageInfo.last90Days')}</div>
                                    <div className="stat-value">--</div>
                                </div>
                            </div>
                            <div className="analytics-stat analytics-stat-placeholder">
                                <div className="stat-icon">
                                    <BarChart3 size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-label">{t('packageInfo.last365Days')}</div>
                                    <div className="stat-value">--</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PackageInfo; 