import { ArrowDown, ArrowUp, ArrowUpCircle, CheckSquare, CircleCheckBig, CirclePlus, CircleX, Info, Square, TriangleAlert } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
    isCask?: boolean;
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
    onTogglePackageSelect?: (packageName: string) => void;
    onSelectAllPackages?: () => void;
    onDeselectAllPackages?: () => void;
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
    onTogglePackageSelect,
    onSelectAllPackages,
    onDeselectAllPackages,
}, ref) => {
    const { t } = useTranslation();
    const selectedRowRef = useRef<HTMLTableRowElement>(null);
    const firstRowRef = useRef<HTMLTableRowElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
    const isKeyboardNavigating = useRef<boolean>(false);

    // Helper function to get column width based on key
    const getColumnWidth = (key: string): string => {
        if (key === 'name') return '30%';
        if (key === 'installedVersion') return '160px';
        if (key === 'latestVersion') return '160px';
        if (key === 'actions') return '150px';
        if (key === 'size') return '100px';
        return 'auto';
    };

    const [sortKey, setSortKey] = useState<string | null>('name'); // Default sort by name
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

    // Column resizing
    const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
    const didDragRef = useRef<boolean>(false);
    const suppressNextClickRef = useRef<boolean>(false);
    const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => {
        const widths: Record<string, string> = {};
        columns.forEach(col => { widths[col.key] = getColumnWidth(col.key); });
        return widths;
    });

    // Reset column widths when the column set changes (e.g. switching views)
    const columnsKey = columns.map(c => c.key).join(',');
    useEffect(() => {
        const widths: Record<string, string> = {};
        columns.forEach(col => { widths[col.key] = getColumnWidth(col.key); });
        setColumnWidths(widths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnsKey]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent, colKey: string) => {
        e.preventDefault();
        e.stopPropagation();
        const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
        const startWidth = th.getBoundingClientRect().width;
        resizingRef.current = { colKey, startX: e.clientX, startWidth };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!resizingRef.current) return;
            const delta = moveEvent.clientX - resizingRef.current.startX;
            if (Math.abs(delta) > 2) didDragRef.current = true;
            const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
            setColumnWidths(prev => ({ ...prev, [resizingRef.current!.colKey]: `${newWidth}px` }));
        };

        const onMouseUp = () => {
            const dragged = didDragRef.current;
            resizingRef.current = null;
            didDragRef.current = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            if (dragged) {
                suppressNextClickRef.current = true;
                setTimeout(() => { suppressNextClickRef.current = false; }, 0);
            }
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

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

    // Handle column header click for sorting
    const handleSort = (key: string, sortable: boolean = true) => {
        // Don't sort on non-sortable columns
        if (!sortable) return;
        // Ignore the synthetic click that follows a column-resize drag
        if (suppressNextClickRef.current) return;

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
    const allVisibleSelected = multiSelectMode && sortedPackages.length > 0 && sortedPackages.every(pkg => selectedPackages.has(pkg.name));

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
        if (col.key === "name") {
            const typeIcon = pkg.isCask !== undefined ? (
                <span
                    title={pkg.isCask ? "Cask" : "Formula"}
                    style={{ display: "inline-flex", alignItems: "center", fontSize: "14px", flexShrink: 0 }}
                >
                    {pkg.isCask ? "🖥️" : "📦"}
                </span>
            ) : null;
            if (pkg.warning || typeIcon) {
                return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {typeIcon}
                        <span>{pkg.name}</span>
                        {pkg.warning && (
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
                        )}
                    </div>
                );
            }
            return pkg.name;
        }
        if (col.key === "installedVersion" || col.key === "latestVersion" || col.key === "size") {
            const value = ((pkg as any)[col.key] ?? "") as string;
            return <span title={value}>{value}</span>;
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
                    <div className="table-scroll-x">
                    <table className="package-table">
                        <colgroup>
                            {multiSelectMode && <col style={{ width: '50px' }} />}
                            {columns.map((col) => (
                                <col key={`col-${col.key}`} style={{ width: columnWidths[col.key] ?? getColumnWidth(col.key) }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                {multiSelectMode && (
                                    <th style={{ textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (allVisibleSelected) {
                                                    onDeselectAllPackages?.();
                                                } else {
                                                    onSelectAllPackages?.();
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', margin: '0 auto', padding: 0 }}
                                            title={allVisibleSelected ? t('buttons.deselectAll') : t('buttons.selectAll')}
                                        >
                                            {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} style={{ opacity: 0.7 }} />}
                                        </button>
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
                                                userSelect: 'none',
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
                                            {col.key !== 'actions' && (
                                                <div
                                                    className="col-resize-handle"
                                                    onMouseDown={(e) => handleResizeMouseDown(e, col.key)}
                                                />
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
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
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onTogglePackageSelect?.(pkg.name);
                                                        }}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', margin: '0 auto', padding: 0 }}
                                                        title={selectedPackages.has(pkg.name) ? t('buttons.deselectAll') : t('buttons.selectAll')}
                                                    >
                                                        {selectedPackages.has(pkg.name) ? (
                                                            <CheckSquare size={20} color={isSelected ? "#ffffff" : "#4fc3f7"} />
                                                        ) : (
                                                            <Square size={20} color={isSelected ? "#ffffff" : undefined} style={{ opacity: isSelected ? 0.8 : 0.6 }} />
                                                        )}
                                                    </button>
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
