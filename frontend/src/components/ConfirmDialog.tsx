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
    dependents?: string[];
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, message, onConfirm, onCancel, confirmLabel, cancelLabel, destructive, dependents }) => {
    const { t } = useTranslation();

    if (!open) return null;

    const defaultConfirmLabel = confirmLabel || t('buttons.yes');
    const defaultCancelLabel = cancelLabel || t('buttons.cancel');

    return (
        <div className="confirm-overlay">
            <div className="confirm-box">
                <p>{message}</p>
                {dependents && dependents.length > 0 && (
                    <div className="confirm-dependents-warning">
                        <span className="confirm-dependents-title">
                            ⚠ {t('dialogs.dependentsWarning', { count: dependents.length })}
                        </span>
                        <div className="confirm-dependents-chips">
                            {dependents.map(dep => (
                                <span key={dep} className="confirm-dependent-chip">{dep}</span>
                            ))}
                        </div>
                    </div>
                )}
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