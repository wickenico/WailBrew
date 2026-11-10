import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useModalA11y } from "../hooks/useModalA11y";

interface SnapshotNameDialogProps {
    open: boolean;
    onConfirm: (label: string) => void;
    onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem",
    fontSize: "1rem",
    border: "1px solid #444",
    borderRadius: "4px",
    backgroundColor: "#1e293b",
    color: "#fff",
    outline: "none",
};

const SnapshotNameDialog: React.FC<SnapshotNameDialogProps> = ({ open, onConfirm, onCancel }) => {
    const { t } = useTranslation();
    const [label, setLabel] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);

    useModalA11y(open, onCancel, boxRef);

    useEffect(() => {
        if (!open) {
            setLabel("");
        }
    }, [open]);

    const handleConfirm = () => {
        onConfirm(label.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
        }
    };

    if (!open) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a pointer convenience, keyboard users close the dialog with Escape (useModalA11y)
        <div role="presentation" className="confirm-overlay" onClick={handleOverlayClick}>
            <div
                className="confirm-box"
                ref={boxRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="snapshot-name-title"
                tabIndex={-1}
            >
                <p id="snapshot-name-title" style={{ marginBottom: "1rem" }}>
                    {t("dialogs.newSnapshotTitle")}
                </p>
                <div style={{ marginBottom: "1rem" }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t("dialogs.newSnapshotPlaceholder")}
                        style={inputStyle}
                    />
                    <p
                        style={{
                            fontSize: "0.75rem",
                            color: "#888",
                            marginTop: "0.5rem",
                            marginBottom: 0,
                        }}
                    >
                        {t("dialogs.newSnapshotHint")}
                    </p>
                </div>
                <div className="confirm-actions">
                    <button type="button" onClick={handleConfirm}>
                        {t("buttons.newSnapshot")}
                    </button>
                    <button type="button" onClick={onCancel}>
                        {t("buttons.cancel")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SnapshotNameDialog;
