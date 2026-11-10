import { FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { SnapshotEntry } from "../types";

interface SnapshotsViewProps {
    snapshots: SnapshotEntry[];
    loading: boolean;
    creating: boolean;
    onNew: () => void;
    onRestore: (entry: SnapshotEntry) => void;
    onDelete: (entry: SnapshotEntry) => void;
    onReveal: (entry: SnapshotEntry) => void;
}

const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const formatCreatedAt = (isoDate: string): string => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const SnapshotsView: React.FC<SnapshotsViewProps> = ({
    snapshots,
    loading,
    creating,
    onNew,
    onRestore,
    onDelete,
    onReveal,
}) => {
    const { t } = useTranslation();

    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3>{t("headers.snapshots", { count: snapshots.length })}</h3>
                </div>
                <div className="header-actions">
                    <button type="button" className="doctor-button" onClick={onNew} disabled={creating}>
                        {creating ? t("snapshots.creating") : t("buttons.newSnapshot")}
                    </button>
                </div>
            </div>
            <div className="table-container">
                {loading && (
                    <div className="table-loading-overlay">
                        <div className="spinner"></div>
                        <div className="loading-text">{t("table.loadingSnapshots")}</div>
                    </div>
                )}
                {snapshots.length > 0 && (
                    <div className="table-split-wrapper">
                        <div className="table-scroll-x">
                            <table className="package-table">
                                <colgroup>
                                    <col style={{ width: "auto" }} />
                                    <col style={{ width: "220px" }} />
                                    <col style={{ width: "100px" }} />
                                    <col style={{ width: "180px" }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>{t("snapshots.label")}</th>
                                        <th>{t("snapshots.created")}</th>
                                        <th>{t("snapshots.size")}</th>
                                        <th>{t("tableColumns.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {snapshots.map((snapshot) => (
                                        <tr key={snapshot.fileName}>
                                            <td>{snapshot.label || <em>{t("snapshots.untitled")}</em>}</td>
                                            <td>{formatCreatedAt(snapshot.createdAt)}</td>
                                            <td>{formatSize(snapshot.size)}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="action-button install-button"
                                                        onClick={() => onRestore(snapshot)}
                                                        title={t("snapshots.buttons.restore", {
                                                            name: snapshot.label || snapshot.fileName,
                                                        })}
                                                    >
                                                        <RotateCcw size={20} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-button info-button"
                                                        onClick={() => onReveal(snapshot)}
                                                        title={t("snapshots.buttons.reveal", {
                                                            name: snapshot.label || snapshot.fileName,
                                                        })}
                                                    >
                                                        <FolderOpen size={20} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-button uninstall-button"
                                                        onClick={() => onDelete(snapshot)}
                                                        title={t("snapshots.buttons.delete", {
                                                            name: snapshot.label || snapshot.fileName,
                                                        })}
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-footer">
                            <div className="table-footer-content">
                                {snapshots.length}{" "}
                                {snapshots.length === 1 ? t("snapshots.snapshot") : t("snapshots.snapshots")}
                            </div>
                        </div>
                    </div>
                )}
                {!loading && snapshots.length === 0 && <div className="result">{t("table.noSnapshots")}</div>}
            </div>
            <div className="package-footer">{t("footers.snapshots")}</div>
        </>
    );
};

export default SnapshotsView;
