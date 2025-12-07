import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface TapInputDialogProps {
    open: boolean;
    onConfirm: (tapName: string) => void;
    onCancel: () => void;
}

const TapInputDialog: React.FC<TapInputDialogProps> = ({ open, onConfirm, onCancel }) => {
    const { t } = useTranslation();
    const [tapName, setTapName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when dialog opens
    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setTapName("");
            setError(null);
        }
    }, [open]);

    const validateTapName = (name: string): boolean => {
        // Tap name should be in format: user/repo
        // Examples: homebrew/cask, user/tap-name
        const tapPattern = /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
        return tapPattern.test(name);
    };

    const handleConfirm = () => {
        const trimmedName = tapName.trim();
        
        if (!trimmedName) {
            setError(t('dialogs.tapInputEmpty'));
            return;
        }

        if (!validateTapName(trimmedName)) {
            setError(t('dialogs.tapInputInvalid'));
            return;
        }

        setError(null);
        onConfirm(trimmedName);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    if (!open) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div 
            className="confirm-overlay" 
            onClick={handleOverlayClick}
            onKeyDown={handleOverlayKeyDown}
            role="dialog"
            tabIndex={-1}
        >
            <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                <p style={{ marginBottom: '1rem' }}>{t('dialogs.tapInputTitle')}</p>
                <div style={{ marginBottom: '1rem' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={tapName}
                        onChange={(e) => {
                            setTapName(e.target.value);
                            setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={t('dialogs.tapInputPlaceholder')}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            fontSize: '1rem',
                            border: error ? '2px solid #dc2626' : '1px solid #444',
                            borderRadius: '4px',
                            backgroundColor: '#1e293b',
                            color: '#fff',
                            outline: 'none',
                        }}
                    />
                    {error && (
                        <p style={{ 
                            color: '#dc2626', 
                            fontSize: '0.875rem', 
                            marginTop: '0.5rem',
                            marginBottom: 0
                        }}>
                            {error}
                        </p>
                    )}
                    <p style={{ 
                        fontSize: '0.75rem', 
                        color: '#888', 
                        marginTop: '0.5rem',
                        marginBottom: 0
                    }}>
                        {t('dialogs.tapInputHint')}
                    </p>
                </div>
                <div className="confirm-actions">
                    <button onClick={handleConfirm}>
                        {t('buttons.tap')}
                    </button>
                    <button onClick={onCancel}>{t('buttons.cancel')}</button>
                </div>
            </div>
        </div>
    );
};

export default TapInputDialog;

