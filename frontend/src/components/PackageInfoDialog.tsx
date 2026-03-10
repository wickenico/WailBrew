import { Copy } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface PackageInfoDialogProps {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
    isRunning?: boolean;
}

type InfoTab = "log" | "parsed";

interface ParsedInfo {
    headline: string;
    description?: string;
    homepage?: string;
    entries: Array<{ label: string; value: string }>;
}

const parseInfoLog = (log: string | null): ParsedInfo | null => {
    if (!log) return null;

    const lines = log.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const entries: Array<{ label: string; value: string }> = [];
    let headline = "";
    let description = "";
    let homepage = "";

    for (const line of lines) {
        if (!headline && line.startsWith("==>")) {
            headline = line.replace(/^==>\s*/, "");
            continue;
        }

        if (!homepage && /^https?:\/\//i.test(line)) {
            homepage = line;
            continue;
        }

        if (!description && !line.includes(":") && !line.startsWith("/")) {
            description = line;
            continue;
        }

        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
            entries.push({
                label: match[1].trim(),
                value: match[2].trim(),
            });
            continue;
        }

        if (line.startsWith("/")) {
            entries.push({ label: "Path", value: line });
            continue;
        }

        if (line.startsWith("==>")) {
            entries.push({
                label: "Section",
                value: line.replace(/^==>\s*/, ""),
            });
        }
    }

    if (!headline && entries.length === 0 && !description && !homepage) {
        return null;
    }

    return { headline: headline || "Package Information", description, homepage, entries };
};

const PackageInfoDialog: React.FC<PackageInfoDialogProps> = ({
    open,
    title,
    log,
    onClose,
    isRunning = false,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<InfoTab>("log");
    const parsed = useMemo(() => parseInfoLog(log), [log]);

    useEffect(() => {
        if (open) {
            setActiveTab("parsed");
        }
    }, [open]);

    const handleCopy = async () => {
        if (!log) return;

        try {
            await navigator.clipboard.writeText(log);
            toast.success(t("logDialog.copiedToClipboard"), {
                duration: 2000,
                position: "bottom-center",
            });
        } catch (err) {
            console.error("Failed to copy package info:", err);
            toast.error(t("logDialog.copyFailed"), {
                duration: 2000,
                position: "bottom-center",
            });
        }
    };

    if (!open) return null;

    return (
        <div className="confirm-overlay">
            <div className="confirm-box log-dialog-box">
                <div className="log-dialog-header">
                    <p style={{ margin: 0 }}><strong>{title}</strong></p>
                    {isRunning && (
                        <div className="log-dialog-badge running">
                            <span className="spinner" style={{
                                display: "inline-block",
                                width: "12px",
                                height: "12px",
                                border: "2px solid rgba(76, 175, 80, 0.3)",
                                borderTopColor: "#4CAF50",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite"
                            }}></span>
                            <span>{t("logDialog.running")}</span>
                        </div>
                    )}
                    {!isRunning && log && (
                        <div className="log-dialog-badge completed">
                            <span>✓</span>
                            <span>{t("logDialog.completed")}</span>
                        </div>
                    )}
                </div>

                <div className="package-info-tabs" role="tablist" aria-label="Package info views">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "log"}
                        className={`package-info-tab ${activeTab === "log" ? "active" : ""}`}
                        onClick={() => setActiveTab("log")}
                    >
                        Log
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "parsed"}
                        className={`package-info-tab ${activeTab === "parsed" ? "active" : ""}`}
                        onClick={() => setActiveTab("parsed")}
                    >
                        Parsed <span className="package-info-beta-badge">Beta</span>
                    </button>
                </div>

                <div className="log-content-wrapper">
                    {activeTab === "log" && (
                        <div className="log-output">{log}</div>
                    )}

                    {activeTab === "parsed" && (
                        <div className="log-output package-info-parsed">
                            {parsed ? (
                                <div className="package-info-parsed-grid">
                                    <div className="package-info-parsed-header">
                                        <div className="package-info-parsed-title">{parsed.headline}</div>
                                        {parsed.description && (
                                            <div className="package-info-parsed-subtitle">{parsed.description}</div>
                                        )}
                                        {parsed.homepage && (
                                            <a
                                                href={parsed.homepage}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                className="package-info-parsed-link"
                                            >
                                                {parsed.homepage}
                                            </a>
                                        )}
                                    </div>
                                    <div className="package-info-parsed-list">
                                        {parsed.entries.map((entry, idx) => (
                                            <div className="package-info-parsed-row" key={`${entry.label}-${idx}`}>
                                                <div className="package-info-parsed-label">{entry.label}</div>
                                                <div className="package-info-parsed-value">{entry.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>{log}</div>
                            )}
                        </div>
                    )}

                    {log && (
                        <button
                            onClick={handleCopy}
                            className="log-copy-button"
                            title={t("logDialog.copyToClipboard")}
                        >
                            <Copy size={16} />
                            {t("logDialog.copy")}
                        </button>
                    )}
                </div>

                <div className="confirm-actions log-dialog-actions">
                    <button onClick={onClose} className="log-dialog-btn">{t("buttons.ok")}</button>
                </div>
            </div>
        </div>
    );
};

export default PackageInfoDialog;
