import React from "react";

interface ConfirmDialogProps {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, message, onConfirm, onCancel, confirmLabel = "Ja", cancelLabel = "Abbrechen" }) => {
    if (!open) return null;
    return (
        <div className="confirm-overlay">
            <div className="confirm-box">
                <p>{message}</p>
                <div className="confirm-actions">
                    <button onClick={onConfirm}>{confirmLabel}</button>
                    <button onClick={onCancel}>{cancelLabel}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog; 