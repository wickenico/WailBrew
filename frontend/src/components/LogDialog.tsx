import { Copy } from "lucide-react";
import React, { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface LogDialogProps {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
    isRunning?: boolean;
    clickablePackages?: string[];
    onPackageClick?: (packageName: string) => void;
}

const LogDialog: React.FC<LogDialogProps> = ({
    open,
    title,
    log,
    onClose,
    isRunning = false,
    clickablePackages = [],
    onPackageClick
}) => {
    const { t } = useTranslation();
    const logRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when log content changes
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [log]);

    // Render log with clickable package links
    const renderLogContent = () => {
        if (!log) return null;

        // If no clickable packages, render as plain text
        if (clickablePackages.length === 0 || !onPackageClick) {
            return <div className="log-output" ref={logRef as any}>{log}</div>;
        }

        // Split log into lines and process each line
        const lines = log.split('\n');
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
                                        color: '#60a5fa',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        margin: 0,
                                        font: 'inherit',
                                        display: 'inline',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = '#93c5fd';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = '#60a5fa';
                                    }}
                                >
                                    {packageName}
                                </button>
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

                    return (
                        <div key={`line-${lineIndex}-${line.substring(0, 20)}`}>
                            {elements}
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleCopyLogs = async () => {
        if (!log) return;

        try {
            await navigator.clipboard.writeText(log);
            toast.success(t('logDialog.copiedToClipboard'), {
                duration: 2000,
                position: 'bottom-center',
            });
        } catch (err) {
            console.error('Failed to copy logs:', err);
            toast.error(t('logDialog.copyFailed'), {
                duration: 2000,
                position: 'bottom-center',
            });
        }
    };

    if (!open) return null;

    return (
        <div className="confirm-overlay">
            <div className="confirm-box log-dialog-box">
                {/* Title and badge - left aligned with badge beside */}
                <div className="log-dialog-header">
                    <p style={{ margin: 0 }}><strong>{title}</strong></p>
                    {isRunning && (
                        <div className="log-dialog-badge running">
                            <span className="spinner" style={{
                                display: 'inline-block',
                                width: '12px',
                                height: '12px',
                                border: '2px solid rgba(76, 175, 80, 0.3)',
                                borderTopColor: '#4CAF50',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></span>
                            <span>{t('logDialog.running')}</span>
                        </div>
                    )}
                    {!isRunning && log && (
                        <div className="log-dialog-badge completed">
                            <span>✓</span>
                            <span>{t('logDialog.completed')}</span>
                        </div>
                    )}
                </div>

                {/* Log content with copy button in bottom right */}
                <div className="log-content-wrapper">
                    {renderLogContent()}
                    {log && (
                        <button
                            onClick={handleCopyLogs}
                            className="log-copy-button"
                            title={t('logDialog.copyToClipboard')}
                        >
                            <Copy size={16} />
                            {t('logDialog.copy')}
                        </button>
                    )}
                </div>

                {/* OK button centered */}
                <div className="confirm-actions log-dialog-actions">
                    <button onClick={onClose} className="log-dialog-btn">{t('buttons.ok')}</button>
                </div>
            </div>
        </div>
    );
};

export default LogDialog; 