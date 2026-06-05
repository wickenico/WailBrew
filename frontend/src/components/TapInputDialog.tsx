import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface TapInputDialogProps {
    open: boolean;
    onConfirm: (tapName: string, tapURL: string) => void;
    onCancel: () => void;
}

const tapNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
const tapURLPattern = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/|rsync:\/\/).+/;

const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '0.5rem',
    fontSize: '1rem',
    border: hasError ? '2px solid #dc2626' : '1px solid #444',
    borderRadius: '4px',
    backgroundColor: '#1e293b',
    color: '#fff',
    outline: 'none',
});

const TapInputDialog: React.FC<TapInputDialogProps> = ({ open, onConfirm, onCancel }) => {
    const { t } = useTranslation();
    const [tapName, setTapName] = useState("");
    const [tapURL, setTapURL] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [urlError, setUrlError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            setTapName("");
            setTapURL("");
            setNameError(null);
            setUrlError(null);
        }
    }, [open]);

    const handleConfirm = () => {
        const trimmedName = tapName.trim();
        const trimmedURL = tapURL.trim();

        setNameError(null);
        setUrlError(null);

        if (!trimmedName) {
            setNameError(t('dialogs.tapInputEmpty'));
            return;
        }

        if (!tapNamePattern.test(trimmedName)) {
            setNameError(t('dialogs.tapInputInvalid'));
            return;
        }

        if (trimmedURL && !tapURLPattern.test(trimmedURL)) {
            setUrlError(t('dialogs.tapInputUrlInvalid'));
            return;
        }

        onConfirm(trimmedName, trimmedURL);
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
                            setNameError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={t('dialogs.tapInputPlaceholder')}
                        style={inputStyle(!!nameError)}
                    />
                    {nameError && (
                        <p style={{ 
                            color: '#dc2626', 
                            fontSize: '0.875rem', 
                            marginTop: '0.5rem',
                            marginBottom: 0
                        }}>
                            {nameError}
                        </p>
                    )}
                    <p style={{ 
                        fontSize: '0.75rem', 
                        color: '#888', 
                        marginTop: '0.5rem',
                        marginBottom: '0.75rem'
                    }}>
                        {t('dialogs.tapInputHint')}
                    </p>
                    <input
                        type="text"
                        value={tapURL}
                        onChange={(e) => {
                            setTapURL(e.target.value);
                            setUrlError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={t('dialogs.tapInputUrlPlaceholder')}
                        style={inputStyle(!!urlError)}
                    />
                    {urlError && (
                        <p style={{ 
                            color: '#dc2626', 
                            fontSize: '0.875rem', 
                            marginTop: '0.5rem',
                            marginBottom: 0
                        }}>
                            {urlError}
                        </p>
                    )}
                    <p style={{ 
                        fontSize: '0.75rem', 
                        color: '#888', 
                        marginTop: '0.5rem',
                        marginBottom: 0
                    }}>
                        {t('dialogs.tapInputUrlHint')}
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
