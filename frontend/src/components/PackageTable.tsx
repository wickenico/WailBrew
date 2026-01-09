import { ArrowDown, ArrowUp, ArrowUpCircle, CheckSquare, CircleCheckBig, CirclePlus, CircleX, Info, Square, TriangleAlert } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
    warning?: string;
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
    multiSelectMode?: boolean;
    selectedPackages?: Set<string>;
}

export interface PackageTableRef {
    focus: () => void;
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

const PackageTable = React.forwardRef<PackageTableRef, PackageTableProps>(({
    packages,
    selectedPackage,
    loading,
    onSelect,
    columns,
    onUninstall,
    onShowInfo,
    onUpdate,
    onInstall,
    multiSelectMode = false,
    selectedPackages = new Set(),
}, ref) => {
    const { t } = useTranslation();
    const selectedRowRef = useRef<HTMLTableRowElement>(null);
    const firstRowRef = useRef<HTMLTableRowElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
    const isKeyboardNavigating = useRef<boolean>(false);
    const [sortKey, setSortKey] = useState<string | null>('name'); // Default sort by name
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

    // Expose focus method via ref
    React.useImperativeHandle(ref, () => ({
        focus: () => {
            if (sortedPackages.length > 0) {
                setFocusedRowIndex(0);
                const firstRow = rowRefs.current.get(0);
                if (firstRow) {
                    firstRow.focus();
                    firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    } as any));

    // Handle arrow key navigation
    const handleArrowKeyNavigation = (currentIndex: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        // Don't go beyond boundaries
        if (newIndex < 0 || newIndex >= sortedPackages.length) {
            return;
        }

        isKeyboardNavigating.current = true;
        setFocusedRowIndex(newIndex);
        const targetRow = rowRefs.current.get(newIndex);
        if (targetRow) {
            targetRow.focus();
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        // Reset flag after a short delay to allow scroll to complete
        setTimeout(() => {
            isKeyboardNavigating.current = false;
        }, 300);
    };

    // Helper function to get column width based on key
    const getColumnWidth = (key: string): string => {
        if (key === 'name') return '30%';
        if (key === 'actions') return '120px';
        if (key === 'size') return '100px';
        return 'auto';
    };

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

    // Scroll to selected row when selectedPackage changes (but not during keyboard navigation)
    const prevSelectedPackageRef = useRef<PackageEntry | null>(null);
    useEffect(() => {
        // Only scroll if selectedPackage actually changed (not just sortedPackages)
        const selectedPackageChanged = prevSelectedPackageRef.current?.name !== selectedPackage?.name;

        if (selectedPackage && sortedPackages.length > 0 && selectedPackageChanged && !isKeyboardNavigating.current) {
            const selectedIndex = sortedPackages.findIndex(pkg => pkg.name === selectedPackage.name);
            if (selectedIndex >= 0) {
                setFocusedRowIndex(selectedIndex);
                const selectedRow = rowRefs.current.get(selectedIndex);
                if (selectedRow) {
                    selectedRow.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    });
                }
            }
        }
        prevSelectedPackageRef.current = selectedPackage;
    }, [selectedPackage, sortedPackages]);

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
                ? <span className="status-installed">
                    <CircleCheckBig size={16} />
                    {t('table.installedStatus')}
                </span>
                : <span className="status-not-installed">{t('table.notInstalledStatus')}</span>;
        }
        if (col.key === "name" && pkg.warning) {
            return (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>{pkg.name}</span>
                    <span
                        className="warning-icon-wrapper"
                        title={pkg.warning}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            cursor: "help",
                        }}
                    >
                        <TriangleAlert size={16} className="warning-icon" />
                    </span>
                </div>
            );
        }
        return (pkg as any)[col.key];
    };

    return (
        <div className="table-container" ref={tableContainerRef}>
            {loading && (
                <div className="table-loading-overlay">
                    <div className="spinner"></div>
                    <div className="loading-text">{t('table.loadingFormulas')}</div>
                </div>
            )}
            {packages.length > 0 && (
                <div className="table-split-wrapper">
                    <table className="package-table package-table-header">
                        <colgroup>
                            {multiSelectMode && <col style={{ width: '50px' }} />}
                            {columns.map((col) => (
                                <col key={`header-col-${col.key}`} style={{ width: getColumnWidth(col.key) }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                {multiSelectMode && (
                                    <th style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <CheckSquare size={16} style={{ opacity: 0.6 }} />
                                        </div>
                                    </th>
                                )}
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
                    </table>
                    <div className="table-body-scroll">
                        <table className="package-table package-table-body">
                            <colgroup>
                                {multiSelectMode && <col style={{ width: '50px' }} />}
                                {columns.map((col) => (
                                    <col key={`body-col-${col.key}`} style={{ width: getColumnWidth(col.key) }} />
                                ))}
                            </colgroup>
                            <tbody>
                                {sortedPackages.map((pkg, index) => {
                                    const isSelected = multiSelectMode ? selectedPackages.has(pkg.name) : selectedPackage?.name === pkg.name;
                                    const isFocused = focusedRowIndex === index;
                                    return (
                                        <tr
                                            key={pkg.name}
                                            ref={(el) => {
                                                if (el) {
                                                    rowRefs.current.set(index, el);
                                                    if (index === 0) {
                                                        firstRowRef.current = el;
                                                    }
                                                    if (!multiSelectMode && selectedPackage?.name === pkg.name) {
                                                        selectedRowRef.current = el;
                                                    }
                                                } else {
                                                    rowRefs.current.delete(index);
                                                }
                                            }}
                                            className={isSelected ? "selected" : ""}
                                            onClick={() => {
                                                setFocusedRowIndex(index);
                                                onSelect(pkg);
                                            }}
                                            tabIndex={isFocused ? 0 : -1}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setFocusedRowIndex(index);
                                                    onSelect(pkg);
                                                } else if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    handleArrowKeyNavigation(index, 'down');
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    handleArrowKeyNavigation(index, 'up');
                                                }
                                            }}
                                            onFocus={() => setFocusedRowIndex(index)}
                                        >
                                            {multiSelectMode && (
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {selectedPackages.has(pkg.name) ? (
                                                            <CheckSquare size={20} color={isSelected ? "#ffffff" : "#4fc3f7"} />
                                                        ) : (
                                                            <Square size={20} color={isSelected ? "#ffffff" : undefined} style={{ opacity: isSelected ? 0.8 : 0.6 }} />
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            {columns.map(col => (
                                                <td key={col.key}>
                                                    {renderCellContent(pkg, col)}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-footer">
                        <div className="table-footer-content">
                            <span>{packages.length} {packages.length === 1 ? t('table.package') : t('table.packages')}</span>
                            {packages.length > 0 && (
                                <span className="table-footer-shortcut">
                                    {typeof navigator !== 'undefined' &&
                                        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'))
                                        ? '⌘T'
                                        : 'Ctrl+T'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {!loading && packages.length === 0 && (
                <div className="result">{t('table.noResults')}</div>
            )}
        </div>
    );
});

PackageTable.displayName = 'PackageTable';

export default PackageTable; 