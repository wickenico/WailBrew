import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpCircle, CirclePlus, Info, CircleX, CircleCheckBig, ArrowUp, ArrowDown } from "lucide-react";

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
}

interface PackageTableProps {
    packages: PackageEntry[];
    selectedPackage: PackageEntry | null;
    loading: boolean;
    onSelect: (pkg: PackageEntry) => void;
    columns: Array<{ key: string; label: string; sortable?: boolean }>;
    onUninstall?: (pkg: PackageEntry) => void;
    onShowInfo?: (pkg: PackageEntry) => void;
    onUpdate?: (pkg: PackageEntry) => void;
    onInstall?: (pkg: PackageEntry) => void;
}

// Helper function to parse size strings for sorting (e.g., "10M", "2.5G", "1K")
const parseSizeToBytes = (size?: string): number => {
    if (!size || size === "Unknown" || size === "") return 0;
    
    const match = size.match(/^([\d.]+)([KMGT]?)B?$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: Record<string, number> = {
        '': 1,
        'K': 1024,
        'M': 1024 * 1024,
        'G': 1024 * 1024 * 1024,
        'T': 1024 * 1024 * 1024 * 1024,
    };
    
    return value * (multipliers[unit] || 1);
};

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
    const [sortKey, setSortKey] = useState<string | null>('name'); // Default sort by name
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Scroll to selected row when selectedPackage changes
    useEffect(() => {
        if (selectedRowRef.current && selectedPackage) {
            selectedRowRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [selectedPackage]);
    
    // Handle column header click for sorting
    const handleSort = (key: string, sortable: boolean = true) => {
        // Don't sort on non-sortable columns
        if (!sortable) return;
        
        if (sortKey === key) {
            // Toggle direction if same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to ascending
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    // Sort packages based on current sort state
    const sortedPackages = React.useMemo(() => {
        if (!sortKey) return packages;
        
        return [...packages].sort((a, b) => {
            let aValue: any = (a as any)[sortKey];
            let bValue: any = (b as any)[sortKey];
            
            // Special handling for size column
            if (sortKey === 'size') {
                aValue = parseSizeToBytes(aValue);
                bValue = parseSizeToBytes(bValue);
            }
            
            // Handle undefined/null values
            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';
            
            // Handle boolean values
            if (typeof aValue === 'boolean') {
                aValue = aValue ? 1 : 0;
                bValue = bValue ? 1 : 0;
            }
            
            // Compare
            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;
            
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [packages, sortKey, sortDirection]);
    
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
                        {columns.map(col => {
                            const isSortable = col.sortable !== false && col.key !== 'actions';
                            const isCurrentSort = sortKey === col.key;
                            
                            return (
                                <th 
                                    key={col.key}
                                    onClick={() => handleSort(col.key, isSortable)}
                                    style={{ 
                                        cursor: isSortable ? 'pointer' : 'default',
                                        userSelect: 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {col.label}
                                        {isSortable && !isCurrentSort && (
                                            <div style={{ opacity: 0.3 }}>
                                                <ArrowUp size={14} />
                                            </div>
                                        )}
                                        {isSortable && isCurrentSort && sortDirection === 'asc' && (
                                            <ArrowUp size={14} />
                                        )}
                                        {isSortable && isCurrentSort && sortDirection === 'desc' && (
                                            <ArrowDown size={14} />
                                        )}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sortedPackages.map(pkg => (
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