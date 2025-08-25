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

interface PackageTableProps {
    packages: PackageEntry[];
    selectedPackage: PackageEntry | null;
    loading: boolean;
    onSelect: (pkg: PackageEntry) => void;
    columns: Array<{ key: string; label: string }>;
    onUninstall?: (pkg: PackageEntry) => void;
    onShowInfo?: (pkg: PackageEntry) => void;
    onUpdate?: (pkg: PackageEntry) => void;
}

const PackageTable: React.FC<PackageTableProps> = ({
    packages,
    selectedPackage,
    loading,
    onSelect,
    columns,
    onUninstall,
    onShowInfo,
    onUpdate,
}) => {
    const { t } = useTranslation();
    
    const renderCellContent = (pkg: PackageEntry, col: { key: string; label: string }) => {
        if (col.key === "actions") {
            return (
                <div className="action-buttons">
                    {onUpdate && (
                        <button
                            className="action-button update-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdate(pkg);
                            }}
                            title={t('buttons.update', { name: pkg.name })}
                        >
                            ⬆️
                        </button>
                    )}
                    {onUninstall && (
                        <button
                            className="action-button uninstall-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUninstall(pkg);
                            }}
                            title={t('buttons.uninstall', { name: pkg.name })}
                        >
                            ❌
                        </button>
                    )}
                    {onShowInfo && (
                        <button
                            className="action-button info-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInfo(pkg);
                            }}
                            title={t('buttons.showInfo', { name: pkg.name })}
                        >
                            ℹ️
                        </button>
                    )}
                </div>
            );
        }
        if (col.key === "isInstalled") {
            return pkg.isInstalled
                ? <span style={{ color: "green" }}>{t('table.installedStatus')}</span>
                : <span style={{ color: "#888" }}>{t('table.notInstalledStatus')}</span>;
        }
        return (pkg as any)[col.key];
    };
    
    return (
    <div className="table-container">
        {loading && (
            <div className="table-loading-overlay">
                <div className="spinner"></div>
                <div className="loading-text">{t('table.loadingFormulas')}</div>
            </div>
        )}
        {packages.length > 0 && (
            <table className="package-table">
                <thead>
                    <tr>
                        {columns.map(col => (
                            <th key={col.key}>{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {packages.map(pkg => (
                        <tr
                            key={pkg.name}
                            className={selectedPackage?.name === pkg.name ? "selected" : ""}
                            onClick={() => onSelect(pkg)}
                        >
                            {columns.map(col => (
                                <td key={col.key}>
                                    {renderCellContent(pkg, col)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
        {!loading && packages.length === 0 && (
            <div className="result">{t('table.noResults')}</div>
        )}
    </div>
    );
};

export default PackageTable; 