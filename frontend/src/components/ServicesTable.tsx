import React, { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown, Play, Square, RotateCw, Bug, Info } from "lucide-react";

export interface ServiceEntry {
    name: string;
    status: string;
    user?: string;
    pid?: number;
}

interface ServicesTableProps {
    services: ServiceEntry[];
    selectedService: ServiceEntry | null;
    loading: boolean;
    onSelect: (service: ServiceEntry) => void;
    onStart?: (service: ServiceEntry) => void;
    onStop?: (service: ServiceEntry) => void;
    onRestart?: (service: ServiceEntry) => void;
    onRun?: (service: ServiceEntry) => void;
    onShowInfo?: (service: ServiceEntry) => void;
}

// Map a Homebrew service status to a dot color.
const statusColor = (status: string): string => {
    switch (status) {
        case "started":
            return "#3ba55d";
        case "error":
            return "#e53935";
        case "scheduled":
            return "#3B82F6";
        case "stopped":
        case "none":
            return "#9aa0a6";
        default:
            return "#e0a000";
    }
};

const ServicesTable: React.FC<ServicesTableProps> = ({
    services,
    selectedService,
    loading,
    onSelect,
    onStart,
    onStop,
    onRestart,
    onRun,
    onShowInfo,
}) => {
    const { t } = useTranslation();
    const [sortKey, setSortKey] = useState<string | null>("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const hasActions = !!(onStart || onStop || onRestart || onRun || onShowInfo);

    const columns = [
        { key: "name", label: t("tableColumns.name"), sortable: true },
        { key: "status", label: t("tableColumns.status"), sortable: true },
        { key: "user", label: t("services.user"), sortable: true },
    ];

    if (hasActions) {
        columns.push({ key: "actions", label: t("tableColumns.actions"), sortable: false });
    }

    const getColumnWidth = (key: string): string => {
        if (key === "name") return "auto";
        if (key === "status") return "160px";
        if (key === "user") return "140px";
        if (key === "actions") return "180px";
        return "auto";
    };

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

    const handleSort = (key: string, sortable: boolean = true) => {
        if (!sortable) return;
        if (suppressNextClickRef.current) return;

        if (sortKey === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const sortedServices = useMemo(() => {
        if (!sortKey) return services;

        return [...services].sort((a, b) => {
            let aValue: any = (a as any)[sortKey];
            let bValue: any = (b as any)[sortKey];

            if (aValue === undefined || aValue === null) aValue = "";
            if (bValue === undefined || bValue === null) bValue = "";

            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;

            return sortDirection === "asc" ? comparison : -comparison;
        });
    }, [services, sortKey, sortDirection]);

    const statusLabel = (status: string): string => {
        const known = ["started", "stopped", "error", "scheduled", "none", "other", "unknown"];
        return known.includes(status) ? t(`services.status.${status}`) : status;
    };

    const renderCellContent = (service: ServiceEntry, col: { key: string; label: string }) => {
        if (col.key === "status") {
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <span
                        style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: statusColor(service.status),
                            display: "inline-block",
                            flexShrink: 0,
                        }}
                    />
                    {statusLabel(service.status)}
                </span>
            );
        }
        if (col.key === "user") {
            return service.user || t("common.notAvailable");
        }
        if (col.key === "actions") {
            const isStarted = service.status === "started";
            // A service that is started, errored, or scheduled is registered
            // with launchd and can therefore be stopped (booted out) — this is
            // how an error state gets cleared.
            const canStop = isStarted || service.status === "error" || service.status === "scheduled";
            const canRestart = isStarted || service.status === "error";
            return (
                <div className="action-buttons">
                    {onStart && !isStarted && (
                        <button
                            className="action-button install-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStart(service);
                            }}
                            title={t("services.buttons.start", { name: service.name })}
                        >
                            <Play size={20} />
                        </button>
                    )}
                    {onStop && canStop && (
                        <button
                            className="action-button uninstall-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStop(service);
                            }}
                            title={t("services.buttons.stop", { name: service.name })}
                        >
                            <Square size={20} />
                        </button>
                    )}
                    {onRestart && canRestart && (
                        <button
                            className="action-button info-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRestart(service);
                            }}
                            title={t("services.buttons.restart", { name: service.name })}
                        >
                            <RotateCw size={20} />
                        </button>
                    )}
                    {onRun && (
                        <button
                            className="action-button info-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRun(service);
                            }}
                            title={t("services.buttons.run", { name: service.name })}
                        >
                            <Bug size={20} />
                        </button>
                    )}
                    {onShowInfo && (
                        <button
                            className="action-button info-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInfo(service);
                            }}
                            title={t("services.buttons.info", { name: service.name })}
                        >
                            <Info size={20} />
                        </button>
                    )}
                </div>
            );
        }
        return (service as any)[col.key];
    };

    return (
        <div className="table-container">
            {loading && (
                <div className="table-loading-overlay">
                    <div className="spinner"></div>
                    <div className="loading-text">{t("table.loadingServices")}</div>
                </div>
            )}
            {services.length > 0 && (
                <div className="table-split-wrapper">
                    <div className="table-scroll-x">
                        <table className="package-table">
                            <colgroup>
                                {columns.map((col) => (
                                    <col key={`col-${col.key}`} style={{ width: columnWidths[col.key] ?? getColumnWidth(col.key) }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr>
                                    {columns.map((col) => {
                                        const isSortable = col.sortable !== false && col.key !== "actions";
                                        const isCurrentSort = sortKey === col.key;

                                        return (
                                            <th
                                                key={col.key}
                                                onClick={() => handleSort(col.key, isSortable)}
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
                                                    {isSortable && isCurrentSort && sortDirection === "asc" && <ArrowUp size={14} />}
                                                    {isSortable && isCurrentSort && sortDirection === "desc" && <ArrowDown size={14} />}
                                                </div>
                                                {col.key !== "actions" && (
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
                                {sortedServices.map((service) => (
                                    <tr
                                        key={service.name}
                                        className={selectedService?.name === service.name ? "selected" : ""}
                                        onClick={() => onSelect(service)}
                                    >
                                        {columns.map((col) => (
                                            <td key={col.key}>{renderCellContent(service, col)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-footer">
                        <div className="table-footer-content">
                            {services.length} {services.length === 1 ? t("table.service") : t("table.services")}
                        </div>
                    </div>
                </div>
            )}
            {!loading && services.length === 0 && <div className="result">{t("table.noServices")}</div>}
        </div>
    );
};

export default ServicesTable;
