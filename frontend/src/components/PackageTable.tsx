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
}

const PackageTable: React.FC<PackageTableProps> = ({
    packages,
    selectedPackage,
    loading,
    onSelect,
    columns,
}) => {
    const { t } = useTranslation();
    
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
                                    {col.key === "isInstalled"
                                        ? pkg.isInstalled
                                            ? <span style={{ color: "green" }}>{t('table.installedStatus')}</span>
                                            : <span style={{ color: "#888" }}>{t('table.notInstalledStatus')}</span>
                                        : (pkg as any)[col.key]}
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