import React from "react";
import { useTranslation } from "react-i18next";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
    isInstalled?: boolean;
}

interface PackageInfoProps {
    packageEntry: PackageEntry | null;
    loadingDetailsFor: string | null;
    view: string;
    onSelectDependency?: (dependencyName: string) => void;
}

const PackageInfo: React.FC<PackageInfoProps> = ({ packageEntry, loadingDetailsFor, view, onSelectDependency }) => {
    const { t } = useTranslation();
    
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

    return (
        <>
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
                        style={{
                            color: '#4a9eff',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#6bb3ff';
                            e.currentTarget.style.textDecoration = 'none';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#4a9eff';
                            e.currentTarget.style.textDecoration = 'underline';
                        }}
                        title={homepage}
                    >
                        {homepage}
                    </span>
                ) : (
                    <span>{homepage}</span>
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
                                    style={{
                                        color: '#4a9eff',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = '#6bb3ff';
                                        e.currentTarget.style.textDecoration = 'none';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = '#4a9eff';
                                        e.currentTarget.style.textDecoration = 'underline';
                                    }}
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
        </>
    );
};

export default PackageInfo; 