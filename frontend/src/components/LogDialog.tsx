import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface LogDialogProps {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
    isRunning?: boolean;
}

const LogDialog: React.FC<LogDialogProps> = ({ open, title, log, onClose, isRunning = false }) => {
    const { t } = useTranslation();
    const logRef = useRef<HTMLPreElement>(null);

    // Auto-scroll to bottom when log content changes
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [log]);

    if (!open) return null;
    
    return (
        <div className="confirm-overlay">
            <div className="confirm-box log-dialog-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <p style={{ margin: 0 }}><strong>{title}</strong></p>
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
                <pre className="log-output" ref={logRef}>{log}</pre>
                <div className="confirm-actions">
                    <button onClick={onClose}>{t('buttons.ok')}</button>
                </div>
            </div>
        </div>
    );
};

export default LogDialog; 