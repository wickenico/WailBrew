import React from "react";

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
}) => (
    <div className="table-container">
        {loading && (
            <div className="table-loading-overlay">
                <div className="spinner"></div>
                <div className="loading-text">Formeln werden geladen…</div>
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
                                            ? <span style={{ color: "green" }}>✓ Installiert</span>
                                            : <span style={{ color: "#888" }}>Nicht installiert</span>
                                        : (pkg as any)[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
        {!loading && packages.length === 0 && (
            <div className="result">Keine passenden Ergebnisse.</div>
        )}
    </div>
);

export default PackageTable; 