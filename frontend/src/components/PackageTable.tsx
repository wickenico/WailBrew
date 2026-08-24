import { useVirtualizer } from "@tanstack/react-virtual";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpCircle,
    CheckSquare,
    CircleCheckBig,
    CirclePlus,
    CircleX,
    Info,
    Square,
    Star,
    TriangleAlert,
} from "lucide-react";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import type { PackageEntry } from "../types";

// Estimated row height in px, used as a starting point before rows are measured.
const ESTIMATED_ROW_HEIGHT = 41;

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
    onToggleFavorite?: (pkg: PackageEntry) => void;
    sortFavoritesToTop?: boolean;
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
        "": 1,
        K: 1024,
        M: 1024 * 1024,
        G: 1024 * 1024 * 1024,
        T: 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
};

interface WarningIconTooltipProps {
    warning: string;
}

const WarningIconTooltip: React.FC<WarningIconTooltipProps> = ({ warning }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({
        position: "fixed",
        top: -9999,
        left: 0,
        zIndex: 99999,
    });
    const iconRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!showTooltip || !iconRef.current || !tooltipRef.current) return;

        const rect = iconRef.current.getBoundingClientRect();
        const tipRect = tooltipRef.current.getBoundingClientRect();
        const gap = 8;
        const padding = 8;

        const placeAbove = rect.top >= tipRect.height + gap;
        let top = placeAbove ? rect.top - tipRect.height - gap : rect.bottom + gap;
        top = Math.max(padding, Math.min(top, window.innerHeight - tipRect.height - padding));

        let left = rect.left + rect.width / 2;
        const halfWidth = tipRect.width / 2;
        left = Math.max(padding + halfWidth, Math.min(left, window.innerWidth - padding - halfWidth));

        setTooltipStyle({
            position: "fixed",
            top,
            left,
            transform: "translateX(-50%)",
            zIndex: 99999,
        });
    }, [showTooltip, warning]);

    return (
        <>
            <span
                ref={iconRef}
                className="warning-icon-wrapper"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "help",
                }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => {
                    setShowTooltip(false);
                    setTooltipStyle({
                        position: "fixed",
                        top: -9999,
                        left: 0,
                        zIndex: 99999,
                    });
                }}
            >
                <TriangleAlert size={16} className="warning-icon" />
            </span>
            {showTooltip &&
                ReactDOM.createPortal(
                    <div ref={tooltipRef} className="warning-tooltip" style={tooltipStyle} role="tooltip">
                        {warning}
                    </div>,
                    document.body,
                )}
        </>
    );
};

const PackageTable = React.forwardRef<PackageTableRef, PackageTableProps>(
    (
        {
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
            onToggleFavorite,
            sortFavoritesToTop = false,
        },
        ref,
    ) => {
        const { t } = useTranslation();
        const selectedRowRef = useRef<HTMLTableRowElement>(null);
        const firstRowRef = useRef<HTMLTableRowElement>(null);
        const tableContainerRef = useRef<HTMLDivElement>(null);
        const scrollContainerRef = useRef<HTMLDivElement>(null);
        const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
        const isKeyboardNavigating = useRef<boolean>(false);
        // Pending focus request for a row that may not be mounted yet (virtualized list)
        const pendingFocusIndexRef = useRef<number | null>(null);

        // Helper function to get column width based on key
        const getColumnWidth = (key: string): string => {
            if (key === "favorite") return "40px";
            if (key === "name") return "30%";
            if (key === "installedVersion") return "160px";
            if (key === "latestVersion") return "160px";
            if (key === "actions") return "150px";
            if (key === "size") return "100px";
            return "auto";
        };

        const [sortKey, setSortKey] = useState<string | null>("name"); // Default sort by name
        const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
        const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

        // Column resizing
        const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
        const didDragRef = useRef<boolean>(false);
        const suppressNextClickRef = useRef<boolean>(false);
        const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => {
            const widths: Record<string, string> = {};
            columns.forEach((col) => {
                widths[col.key] = getColumnWidth(col.key);
            });
            return widths;
        });

        // Reset column widths when the column set changes (e.g. switching views)
        const columnsKey = columns.map((c) => c.key).join(",");
        useEffect(() => {
            const widths: Record<string, string> = {};
            columns.forEach((col) => {
                widths[col.key] = getColumnWidth(col.key);
            });
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
                setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.colKey]: `${newWidth}px` }));
            };

            const onMouseUp = () => {
                const dragged = didDragRef.current;
                resizingRef.current = null;
                didDragRef.current = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                if (dragged) {
                    suppressNextClickRef.current = true;
                    setTimeout(() => {
                        suppressNextClickRef.current = false;
                    }, 0);
                }
            };

            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        }, []);

        const handleResizeKeyDown = useCallback((e: React.KeyboardEvent, colKey: string) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const step = e.key === "ArrowRight" ? 10 : -10;
            setColumnWidths((prev) => {
                const current = prev[colKey] ?? getColumnWidth(colKey);
                const currentPx = current.endsWith("px") ? Number.parseFloat(current) : 150;
                return { ...prev, [colKey]: `${Math.max(60, currentPx + step)}px` };
            });
        }, []);

        // Handle column header click for sorting
        const handleSort = (key: string, sortable: boolean = true) => {
            // Don't sort on non-sortable columns
            if (!sortable) return;
            // Ignore the synthetic click that follows a column-resize drag
            if (suppressNextClickRef.current) return;

            if (sortKey === key) {
                // Toggle direction if same column
                setSortDirection(sortDirection === "asc" ? "desc" : "asc");
            } else {
                // New column, default to ascending
                setSortKey(key);
                setSortDirection("asc");
            }
        };

        // Sort packages based on current sort state
        const sortedPackages = React.useMemo(() => {
            const sortWithinGroup = (list: PackageEntry[]) => {
                if (!sortKey) return list;

                return [...list].sort((a, b) => {
                    let aValue: any = (a as any)[sortKey];
                    let bValue: any = (b as any)[sortKey];

                    // Special handling for size column
                    if (sortKey === "size") {
                        aValue = parseSizeToBytes(aValue);
                        bValue = parseSizeToBytes(bValue);
                    }

                    // Handle undefined/null values
                    if (aValue === undefined || aValue === null) aValue = "";
                    if (bValue === undefined || bValue === null) bValue = "";

                    // Handle boolean values
                    if (typeof aValue === "boolean") {
                        aValue = aValue ? 1 : 0;
                        bValue = bValue ? 1 : 0;
                    }

                    // Compare
                    let comparison = 0;
                    if (aValue < bValue) comparison = -1;
                    if (aValue > bValue) comparison = 1;

                    return sortDirection === "asc" ? comparison : -comparison;
                });
            };

            if (!sortFavoritesToTop) return sortWithinGroup(packages);

            const favorites = packages.filter((pkg) => pkg.isFavorite);
            const others = packages.filter((pkg) => !pkg.isFavorite);
            return [...sortWithinGroup(favorites), ...sortWithinGroup(others)];
        }, [packages, sortKey, sortDirection, sortFavoritesToTop]);
        const allVisibleSelected =
            multiSelectMode &&
            sortedPackages.length > 0 &&
            sortedPackages.every((pkg) => selectedPackages.has(pkg.name));

        // Virtualize rows so only the visible slice of a potentially huge (thousands of
        // formulae) list is mounted in the DOM at any time.
        const rowVirtualizer = useVirtualizer({
            count: sortedPackages.length,
            getScrollElement: () => scrollContainerRef.current,
            estimateSize: () => ESTIMATED_ROW_HEIGHT,
            overscan: 12,
        });

        // Focus a row by index, scrolling it into view first if it isn't mounted yet.
        // Virtualized rows may not exist in the DOM, so the actual .focus() call happens
        // either immediately (row already mounted) or from the row's ref callback once it mounts.
        const focusRow = useCallback(
            (index: number, align: "auto" | "center" | "start" | "end" = "auto") => {
                pendingFocusIndexRef.current = index;
                rowVirtualizer.scrollToIndex(index, { align });
                const row = rowRefs.current.get(index);
                if (row) {
                    row.focus();
                    pendingFocusIndexRef.current = null;
                }
            },
            [rowVirtualizer],
        );

        // Expose focus method via ref
        React.useImperativeHandle(
            ref,
            () =>
                ({
                    focus: () => {
                        if (sortedPackages.length > 0) {
                            setFocusedRowIndex(0);
                            focusRow(0, "center");
                        }
                    },
                }) as any,
        );

        // Handle arrow key navigation
        const handleArrowKeyNavigation = (currentIndex: number, direction: "up" | "down") => {
            const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

            // Don't go beyond boundaries
            if (newIndex < 0 || newIndex >= sortedPackages.length) {
                return;
            }

            isKeyboardNavigating.current = true;
            setFocusedRowIndex(newIndex);
            focusRow(newIndex, "auto");
            // Reset flag after a short delay to allow scroll to complete
            setTimeout(() => {
                isKeyboardNavigating.current = false;
            }, 300);
        };

        // Scroll to selected row when selectedPackage changes (but not during keyboard navigation)
        const prevSelectedPackageRef = useRef<PackageEntry | null>(null);
        useEffect(() => {
            // Only scroll if selectedPackage actually changed (not just sortedPackages)
            const selectedPackageChanged = prevSelectedPackageRef.current?.name !== selectedPackage?.name;

            if (
                selectedPackage &&
                sortedPackages.length > 0 &&
                selectedPackageChanged &&
                !isKeyboardNavigating.current
            ) {
                const selectedIndex = sortedPackages.findIndex((pkg) => pkg.name === selectedPackage.name);
                if (selectedIndex >= 0) {
                    setFocusedRowIndex(selectedIndex);
                    rowVirtualizer.scrollToIndex(selectedIndex, { align: "center" });
                }
            }
            prevSelectedPackageRef.current = selectedPackage;
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selectedPackage, sortedPackages]);

        const virtualRows = rowVirtualizer.getVirtualItems();
        const columnCount = multiSelectMode ? columns.length + 1 : columns.length;
        const bottomSpacerHeight =
            virtualRows.length > 0
                ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
                : 0;

        const renderCellContent = (pkg: PackageEntry, col: { key: string; label: string }) => {
            if (col.key === "favorite") {
                return (
                    <button
                        type="button"
                        className="action-button favorite-button"
                        style={pkg.isFavorite ? { color: "#ffc107" } : undefined}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(pkg);
                        }}
                        title={
                            pkg.isFavorite
                                ? t("buttons.unfavorite", { name: pkg.name })
                                : t("buttons.favorite", { name: pkg.name })
                        }
                    >
                        <Star size={16} fill={pkg.isFavorite ? "currentColor" : "none"} />
                    </button>
                );
            }
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
                                title={t("buttons.update", { name: pkg.name })}
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
                                title={t("buttons.uninstall", { name: pkg.name })}
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
                                title={t("buttons.install", { name: pkg.name })}
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
                                title={t("buttons.showInfo", { name: pkg.name })}
                            >
                                <Info size={20} />
                            </button>
                        )}
                    </div>
                );
            }
            if (col.key === "isInstalled") {
                return pkg.isInstalled ? (
                    <span className="status-installed">
                        <CircleCheckBig size={16} />
                        {t("table.installedStatus")}
                    </span>
                ) : (
                    <span className="status-not-installed">{t("table.notInstalledStatus")}</span>
                );
            }
            if (col.key === "name") {
                const typeIcon =
                    pkg.isCask !== undefined ? (
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
                            {pkg.warning && <WarningIconTooltip warning={pkg.warning} />}
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
                        <div className="loading-text">{t("table.loadingFormulas")}</div>
                    </div>
                )}
                {packages.length > 0 && (
                    <div className="table-split-wrapper">
                        <div className="table-scroll-x" ref={scrollContainerRef}>
                            <table className="package-table">
                                <colgroup>
                                    {multiSelectMode && <col style={{ width: "50px" }} />}
                                    {columns.map((col) => (
                                        <col
                                            key={`col-${col.key}`}
                                            style={{ width: columnWidths[col.key] ?? getColumnWidth(col.key) }}
                                        />
                                    ))}
                                </colgroup>
                                <thead>
                                    <tr>
                                        {multiSelectMode && (
                                            <th style={{ textAlign: "center" }}>
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
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        background: "none",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        margin: "0 auto",
                                                        padding: 0,
                                                    }}
                                                    title={
                                                        allVisibleSelected
                                                            ? t("buttons.deselectAll")
                                                            : t("buttons.selectAll")
                                                    }
                                                >
                                                    {allVisibleSelected ? (
                                                        <CheckSquare size={16} />
                                                    ) : (
                                                        <Square size={16} style={{ opacity: 0.7 }} />
                                                    )}
                                                </button>
                                            </th>
                                        )}
                                        {columns.map((col) => {
                                            const isSortable =
                                                col.sortable !== false &&
                                                col.key !== "actions" &&
                                                col.key !== "favorite";
                                            const isCurrentSort = sortKey === col.key;

                                            return (
                                                <th
                                                    key={col.key}
                                                    onClick={() => handleSort(col.key, isSortable)}
                                                    aria-sort={
                                                        isSortable
                                                            ? isCurrentSort
                                                                ? sortDirection === "asc"
                                                                    ? "ascending"
                                                                    : "descending"
                                                                : "none"
                                                            : undefined
                                                    }
                                                    style={{
                                                        cursor: isSortable ? "pointer" : "default",
                                                        userSelect: "none",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                        {col.label}
                                                        {isSortable && !isCurrentSort && (
                                                            <div style={{ opacity: 0.3 }}>
                                                                <ArrowUp size={14} />
                                                            </div>
                                                        )}
                                                        {isSortable && isCurrentSort && sortDirection === "asc" && (
                                                            <ArrowUp size={14} />
                                                        )}
                                                        {isSortable && isCurrentSort && sortDirection === "desc" && (
                                                            <ArrowDown size={14} />
                                                        )}
                                                    </div>
                                                    {col.key !== "actions" && col.key !== "favorite" && (
                                                        <div
                                                            className="col-resize-handle"
                                                            onMouseDown={(e) => handleResizeMouseDown(e, col.key)}
                                                            role="separator"
                                                            aria-orientation="vertical"
                                                            aria-label={`Resize ${col.label} column`}
                                                            aria-valuenow={
                                                                Number.parseFloat(
                                                                    columnWidths[col.key] ?? getColumnWidth(col.key),
                                                                ) || 150
                                                            }
                                                            tabIndex={0}
                                                            onKeyDown={(e) => handleResizeKeyDown(e, col.key)}
                                                        />
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {virtualRows.length > 0 && virtualRows[0].start > 0 && (
                                        <tr aria-hidden="true" className="virtual-row-spacer">
                                            <td colSpan={columnCount} style={{ height: virtualRows[0].start, padding: 0, border: "none" }} />
                                        </tr>
                                    )}
                                    {virtualRows.map((virtualRow) => {
                                        const index = virtualRow.index;
                                        const pkg = sortedPackages[index];
                                        const isSelected = multiSelectMode
                                            ? selectedPackages.has(pkg.name)
                                            : selectedPackage?.name === pkg.name;
                                        const isFocused = focusedRowIndex === index;
                                        return (
                                            <tr
                                                key={pkg.name}
                                                data-index={index}
                                                ref={(el) => {
                                                    if (el) {
                                                        rowVirtualizer.measureElement(el);
                                                        rowRefs.current.set(index, el);
                                                        if (index === 0) {
                                                            firstRowRef.current = el;
                                                        }
                                                        if (!multiSelectMode && selectedPackage?.name === pkg.name) {
                                                            selectedRowRef.current = el;
                                                        }
                                                        if (pendingFocusIndexRef.current === index) {
                                                            el.focus();
                                                            pendingFocusIndexRef.current = null;
                                                        }
                                                    } else {
                                                        rowRefs.current.delete(index);
                                                    }
                                                }}
                                                className={`${isSelected ? "selected" : ""} ${index % 2 === 1 ? "row-stripe" : ""}`.trim()}
                                                onClick={() => {
                                                    setFocusedRowIndex(index);
                                                    onSelect(pkg);
                                                }}
                                                tabIndex={isFocused ? 0 : -1}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        setFocusedRowIndex(index);
                                                        onSelect(pkg);
                                                    } else if (e.key === "ArrowDown") {
                                                        e.preventDefault();
                                                        handleArrowKeyNavigation(index, "down");
                                                    } else if (e.key === "ArrowUp") {
                                                        e.preventDefault();
                                                        handleArrowKeyNavigation(index, "up");
                                                    }
                                                }}
                                                onFocus={() => setFocusedRowIndex(index)}
                                            >
                                                {multiSelectMode && (
                                                    <td style={{ textAlign: "center" }}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onTogglePackageSelect?.(pkg.name);
                                                            }}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                background: "none",
                                                                border: "none",
                                                                cursor: "pointer",
                                                                margin: "0 auto",
                                                                padding: 0,
                                                            }}
                                                            title={
                                                                selectedPackages.has(pkg.name)
                                                                    ? t("buttons.deselectAll")
                                                                    : t("buttons.selectAll")
                                                            }
                                                        >
                                                            {selectedPackages.has(pkg.name) ? (
                                                                <CheckSquare
                                                                    size={20}
                                                                    color={isSelected ? "#ffffff" : "#4fc3f7"}
                                                                />
                                                            ) : (
                                                                <Square
                                                                    size={20}
                                                                    color={isSelected ? "#ffffff" : undefined}
                                                                    style={{ opacity: isSelected ? 0.8 : 0.6 }}
                                                                />
                                                            )}
                                                        </button>
                                                    </td>
                                                )}
                                                {columns.map((col) => (
                                                    <td key={col.key}>{renderCellContent(pkg, col)}</td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                    {virtualRows.length > 0 && bottomSpacerHeight > 0 && (
                                        <tr aria-hidden="true" className="virtual-row-spacer">
                                            <td colSpan={columnCount} style={{ height: bottomSpacerHeight, padding: 0, border: "none" }} />
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-footer">
                            <div className="table-footer-content">
                                <span>
                                    {packages.length} {packages.length === 1 ? t("table.package") : t("table.packages")}
                                </span>
                                {packages.length > 0 && (
                                    <span className="table-footer-shortcut">
                                        {typeof navigator !== "undefined" &&
                                        (navigator.userAgent.includes("Mac") || navigator.userAgent.includes("macOS"))
                                            ? "⌘T"
                                            : "Ctrl+T"}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {!loading && packages.length === 0 && <div className="result">{t("table.noResults")}</div>}
            </div>
        );
    },
);

PackageTable.displayName = "PackageTable";

export default PackageTable;
