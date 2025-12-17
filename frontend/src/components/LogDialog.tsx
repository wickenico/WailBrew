import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";

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
            return <pre className="log-output" ref={logRef as any}>{log}</pre>;
        }

        // Split log into lines and process each line
        const lines = log.split('\n');
        return (
            <div className="log-output" ref={logRef} style={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                maxHeight: '400px',
                overflowY: 'auto',
                padding: '10px',
                backgroundColor: '#1e293b',
                borderRadius: '4px',
                color: '#fff'
            }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <p style={{ margin: 0, flex: 1 }}><strong>{title}</strong></p>
                    {isRunning && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            padding: '4px 12px',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            border: '1px solid rgba(76, 175, 80, 0.3)',
                            borderRadius: '12px',
                            fontSize: '13px',
                            color: '#4CAF50'
                        }}>
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
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            padding: '4px 12px',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            border: '1px solid rgba(33, 150, 243, 0.3)',
                            borderRadius: '12px',
                            fontSize: '13px',
                            color: '#2196F3'
                        }}>
                            <span>✓</span>
                            <span>{t('logDialog.completed')}</span>
                        </div>
                    )}
                </div>
                {renderLogContent()}
                <div className="confirm-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    {log && (
                        <button 
                            onClick={handleCopyLogs}
                            className="copy-logs-button"
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                            }}
                            title={t('logDialog.copyToClipboard')}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(80, 180, 255, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(80, 180, 255, 0.3)';
                                e.currentTarget.style.color = 'var(--accent)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <Copy size={16} />
                            {t('logDialog.copy')}
                        </button>
                    )}
                    <button onClick={onClose}>{t('buttons.ok')}</button>
                </div>
            </div>
        </div>
    );
};

export default LogDialog; 