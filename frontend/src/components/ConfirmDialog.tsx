import React from "react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, message, onConfirm, onCancel, confirmLabel, cancelLabel, destructive }) => {
    const { t } = useTranslation();
    
    if (!open) return null;
    
    const defaultConfirmLabel = confirmLabel || t('buttons.yes');
    const defaultCancelLabel = cancelLabel || t('buttons.cancel');
    
    return (
        <div className="confirm-overlay">
            <div className="confirm-box">
                <p>{message}</p>
                <div className="confirm-actions">
                    <button 
                        className={destructive ? "destructive" : ""}
                        onClick={onConfirm}
                    >
                        {defaultConfirmLabel}
                    </button>
                    <button onClick={onCancel}>{defaultCancelLabel}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog; 