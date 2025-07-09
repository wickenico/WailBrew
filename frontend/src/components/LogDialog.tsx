import React from "react";

interface LogDialogProps {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
}

const LogDialog: React.FC<LogDialogProps> = ({ open, title, log, onClose }) => {
    if (!open) return null;
    return (
        <div className="confirm-overlay">
            <div className="confirm-box log-dialog-box">
                <p><strong>{title}</strong></p>
                <pre className="log-output">{log}</pre>
                <div className="confirm-actions">
                    <button onClick={onClose}>Ok</button>
                </div>
            </div>
        </div>
    );
};

export default LogDialog; 