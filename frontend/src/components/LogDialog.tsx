import React, { useEffect, useRef } from "react";

interface LogDialogProps {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
}

const LogDialog: React.FC<LogDialogProps> = ({ open, title, log, onClose }) => {
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
                <p><strong>{title}</strong></p>
                <pre className="log-output" ref={logRef}>{log}</pre>
                <div className="confirm-actions">
                    <button onClick={onClose}>Ok</button>
                </div>
            </div>
        </div>
    );
};

export default LogDialog; 