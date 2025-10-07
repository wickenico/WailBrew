import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpCircle, CirclePlus, Info, CircleX, CircleCheckBig } from "lucide-react";

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
    onInstall?: (pkg: PackageEntry) => void;
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
    onInstall,
}) => {
    const { t } = useTranslation();
    const selectedRowRef = useRef<HTMLTableRowElement>(null);

    // Scroll to selected row when selectedPackage changes
    useEffect(() => {
        if (selectedRowRef.current && selectedPackage) {
            selectedRowRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [selectedPackage]);
    
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
                            <ArrowUpCircle size={20} />
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
                            <CircleX size={20} />
                        </button>
                    )}
                    {onInstall && !pkg.isInstalled && (
                        <button
                            className="action-button install-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onInstall(pkg);
                            }}
                            title={t('buttons.install', { name: pkg.name })}
                        >
                            <CirclePlus size={20} />
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
                            <Info size={20} />
                        </button>
                    )}
                </div>
            );
        }
        if (col.key === "isInstalled") {
            return pkg.isInstalled
                ? <span style={{ color: "green", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CircleCheckBig size={16} />
                    {t('table.installedStatus')}
                  </span>
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
                            ref={selectedPackage?.name === pkg.name ? selectedRowRef : null}
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