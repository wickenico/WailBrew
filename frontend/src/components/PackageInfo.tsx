import React from "react";
import { useTranslation } from "react-i18next";

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
}

const PackageInfo: React.FC<PackageInfoProps> = ({ packageEntry, loadingDetailsFor, view }) => {
    const { t } = useTranslation();
    
    const name = packageEntry?.name || t('common.notAvailable');
    const desc = packageEntry?.desc || t('common.notAvailable');
    const homepage = packageEntry?.homepage || t('common.notAvailable');
    const version = packageEntry?.installedVersion || t('common.notAvailable');
    const status = packageEntry ? (packageEntry.isInstalled ? t('packageInfo.installed') : t('packageInfo.notInstalled')) : t('common.notAvailable');
    const dependencies = packageEntry?.dependencies?.length ? packageEntry.dependencies.join(", ") : t('common.notAvailable');
    const conflicts = packageEntry?.conflicts?.length ? packageEntry.conflicts.join(", ") : t('common.notAvailable');
    
    return (
        <>
            <p>
                <strong>{name}</strong>{" "}
                {packageEntry && loadingDetailsFor === packageEntry.name && (
                    <span style={{ fontSize: "12px", color: "#888" }}>{t('packageInfo.loading')}</span>
                )}
            </p>
            <p>{t('packageInfo.description')}: {desc}</p>
            <p>{t('packageInfo.homepage')}: {homepage}</p>
            {view === "all" ? (
                <p>{t('packageInfo.status')}: {status}</p>
            ) : (
                <p>{t('packageInfo.version')}: {version}</p>
            )}
            <p>{t('packageInfo.dependencies')}: {dependencies}</p>
            <p>{t('packageInfo.conflicts')}: {conflicts}</p>
        </>
    );
};

export default PackageInfo; 