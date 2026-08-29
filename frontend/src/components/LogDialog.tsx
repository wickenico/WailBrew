import { Bug, Check, Copy } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { BrowserOpenURL, Environment } from "../../wailsjs/runtime";
import { useModalA11y } from "../hooks/useModalA11y";

// GitHub silently truncates very long prefilled issue bodies, so the embedded
// log is capped and cut from the end (the most recent, most relevant entries).
const MAX_BUG_REPORT_LOG_CHARS = 3000;
const WAILBREW_ISSUES_URL = "https://github.com/wickenico/WailBrew/issues/new";

// encodeURIComponent deliberately leaves ! ~ * ' ( ) unescaped (they're valid
// unreserved URI characters), but Wails' BrowserOpenURL rejects any of them
// outright as shell metacharacters before shelling out to `open`. Escape them
// too so a log entry or template containing one doesn't break the whole link.
const strictEncodeURIComponent = (value: string): string =>
    encodeURIComponent(value).replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

interface LogDialogProps {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
    isRunning?: boolean;
    clickablePackages?: string[];
    onPackageClick?: (packageName: string) => void;
    /** When provided, each entry is rendered in its own hoverable, individually copyable row. */
    entries?: string[];
    /** Shown alongside the session log when reporting a bug from `entries`. */
    appVersion?: string;
}

// Session log entries look like "[2026-08-24 12:00:00] ERROR: ...". Classify
// by the marker right after the timestamp so rows can be color-coded.
const getEntrySeverity = (entry: string): "error" | "success" | "cache" | "info" => {
    const afterTimestamp = entry.replace(/^\[[^\]]*\]\s*/, "");
    if (afterTimestamp.startsWith("ERROR:")) return "error";
    if (afterTimestamp.startsWith("SUCCESS:")) return "success";
    if (afterTimestamp.startsWith("CACHE HIT:")) return "cache";
    return "info";
};

const LogDialog: React.FC<LogDialogProps> = ({
    open,
    title,
    log,
    onClose,
    isRunning = false,
    clickablePackages = [],
    onPackageClick,
    entries,
    appVersion,
}) => {
    const { t } = useTranslation();
    const logRef = useRef<HTMLDivElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const [copiedEntryIndex, setCopiedEntryIndex] = useState<number | null>(null);
    const [copiedLogs, setCopiedLogs] = useState(false);

    useModalA11y(open, onClose, boxRef);

    const handleReportBug = async () => {
        const fullLog = (entries ?? []).join("\n");
        const truncated = fullLog.length > MAX_BUG_REPORT_LOG_CHARS;
        const logExcerpt = truncated ? fullLog.slice(-MAX_BUG_REPORT_LOG_CHARS) : fullLog;

        let platformLine = "";
        try {
            const env = await Environment();
            platformLine = `- Platform: ${env.platform} (${env.arch})\n`;
        } catch {
            // Environment info is a nice-to-have; proceed without it if it fails.
        }

        const body = [
            "### Description",
            "<!-- What happened? What did you expect to happen? -->",
            "",
            "### Environment",
            appVersion ? `- WailBrew version: ${appVersion}\n${platformLine}` : platformLine,
            "### Session Log",
            truncated ? `_(showing the last ${MAX_BUG_REPORT_LOG_CHARS} characters)_` : "",
            "```",
            logExcerpt,
            "```",
        ]
            .filter(Boolean)
            .join("\n");

        const url = `${WAILBREW_ISSUES_URL}?title=${strictEncodeURIComponent("Bug: ")}&body=${strictEncodeURIComponent(body)}`;
        BrowserOpenURL(url);
    };

    // Auto-scroll to bottom when log content changes
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [log]);

    const handleCopyEntry = async (entry: string, index: number) => {
        try {
            await navigator.clipboard.writeText(entry);
            setCopiedEntryIndex(index);
            setTimeout(() => setCopiedEntryIndex((current) => (current === index ? null : current)), 2000);
            toast.success(t("logDialog.copiedToClipboard"), {
                duration: 2000,
                position: "bottom-center",
            });
        } catch (err) {
            console.error("Failed to copy log entry:", err);
            toast.error(t("logDialog.copyFailed"), {
                duration: 2000,
                position: "bottom-center",
            });
        }
    };

    // Render each session log entry in its own hoverable, individually copyable row
    const renderEntries = () => {
        if (!entries || entries.length === 0) {
            return <div className="log-output">{t("logDialog.noLogs")}</div>;
        }

        return (
            <div className="log-output" ref={logRef}>
                {entries.map((entry, index) => (
                    <div
                        className={`log-entry log-entry--${getEntrySeverity(entry)}`}
                        key={`entry-${index}-${entry.substring(0, 32)}`}
                    >
                        <span className="log-entry-text">{entry}</span>
                        <button
                            type="button"
                            className="log-entry-copy-btn"
                            onClick={() => handleCopyEntry(entry, index)}
                            title={t("logDialog.copyEntry")}
                            aria-label={t("logDialog.copyEntry")}
                        >
                            {copiedEntryIndex === index ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    // Render log with clickable package links
    const renderLogContent = () => {
        if (entries) return renderEntries();

        if (!log) return null;

        // If no clickable packages, render as plain text
        if (clickablePackages.length === 0 || !onPackageClick) {
            return (
                <div className="log-output" ref={logRef as any}>
                    {log}
                </div>
            );
        }

        // Split log into lines and process each line
        const lines = log.split("\n");
        return (
            <div className="log-output" ref={logRef}>
                {lines.map((line, lineIndex) => {
                    let lastIndex = 0;
                    const elements: React.ReactNode[] = [];

                    // Find all package names in this line
                    for (const packageName of clickablePackages) {
                        const index = line.indexOf(packageName, lastIndex);
                        if (index !== -1) {
                            // Add text before the package name
                            if (index > lastIndex) {
                                elements.push(line.substring(lastIndex, index));
                            }
                            // Add clickable package link
                            elements.push(
                                <button
                                    key={`${lineIndex}-${packageName}-${index}`}
                                    type="button"
                                    onClick={() => onPackageClick(packageName)}
                                    style={{
                                        color: "#60a5fa",
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                        fontWeight: 500,
                                        background: "none",
                                        border: "none",
                                        padding: 0,
                                        margin: 0,
                                        font: "inherit",
                                        display: "inline",
                                        textAlign: "left",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "#93c5fd";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "#60a5fa";
                                    }}
                                >
                                    {packageName}
                                </button>,
                            );
                            lastIndex = index + packageName.length;
                        }
                    }

                    // Add remaining text after last package
                    if (lastIndex < line.length) {
                        elements.push(line.substring(lastIndex));
                    }

                    // If no packages found, just add the line as-is
                    if (elements.length === 0) {
                        elements.push(line);
                    }

                    return <div key={`line-${lineIndex}-${line.substring(0, 20)}`}>{elements}</div>;
                })}
            </div>
        );
    };

    const handleCopyLogs = async () => {
        if (!log) return;

        try {
            await navigator.clipboard.writeText(log);
            setCopiedLogs(true);
            setTimeout(() => setCopiedLogs(false), 2000);
            toast.success(t("logDialog.copiedToClipboard"), {
                duration: 2000,
                position: "bottom-center",
            });
        } catch (err) {
            console.error("Failed to copy logs:", err);
            toast.error(t("logDialog.copyFailed"), {
                duration: 2000,
                position: "bottom-center",
            });
        }
    };

    if (!open) return null;

    return (
        <div className="confirm-overlay">
            <div
                className="confirm-box log-dialog-box"
                ref={boxRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="log-dialog-title"
                tabIndex={-1}
            >
                {/* Title and badge - left aligned with badge beside */}
                <div className="log-dialog-header">
                    <p id="log-dialog-title" style={{ margin: 0 }}>
                        <strong>{title}</strong>
                    </p>
                    {isRunning && (
                        <div className="log-dialog-badge running">
                            <span
                                className="spinner"
                                style={{
                                    display: "inline-block",
                                    width: "12px",
                                    height: "12px",
                                    border: "2px solid rgba(76, 175, 80, 0.3)",
                                    borderTopColor: "#4CAF50",
                                    borderRadius: "50%",
                                    animation: "spin 1s linear infinite",
                                }}
                            ></span>
                            <span>{t("logDialog.running")}</span>
                        </div>
                    )}
                    {!isRunning && log && (
                        <div className="log-dialog-badge completed">
                            <span>✓</span>
                            <span>{t("logDialog.completed")}</span>
                        </div>
                    )}
                    {entries && entries.length > 0 && (
                        <button
                            type="button"
                            onClick={handleReportBug}
                            className="log-report-bug-button"
                            title={t("logDialog.reportBug")}
                        >
                            <Bug size={14} />
                            {t("logDialog.reportBug")}
                        </button>
                    )}
                </div>

                {/* Log content with copy button in bottom right */}
                <div className="log-content-wrapper">
                    {renderLogContent()}
                    {log && (
                        <button
                            type="button"
                            onClick={handleCopyLogs}
                            className={`log-copy-button${copiedLogs ? " copied" : ""}`}
                            title={copiedLogs ? t("logDialog.copiedToClipboard") : t("logDialog.copyToClipboard")}
                            aria-label={copiedLogs ? t("logDialog.copiedToClipboard") : t("logDialog.copyToClipboard")}
                        >
                            {copiedLogs ? <Check size={16} /> : <Copy size={16} />}
                            {t("logDialog.copy")}
                        </button>
                    )}
                </div>

                {/* OK button centered */}
                <div className="confirm-actions log-dialog-actions">
                    <button onClick={onClose} className="log-dialog-btn">
                        {t("buttons.ok")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogDialog;
