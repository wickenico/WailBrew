import { CheckCircle2 } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { RestartApp } from "../../wailsjs/go/main/App";
import { useModalA11y } from "../hooks/useModalA11y";

interface RestartDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const RestartDialog: React.FC<RestartDialogProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);

    useModalA11y(isOpen, onClose, dialogRef);

    const handleRestart = async () => {
        try {
            await RestartApp();
        } catch (err) {
            console.error("Failed to restart app:", err);
        }
    };

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="about-overlay" onClick={handleOverlayClick}>
            <div
                className="about-dialog"
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="restart-dialog-title"
                tabIndex={-1}
            >
                <div className="about-header">
                    <h2 id="restart-dialog-title">{t("restartDialog.title")}</h2>
                </div>

                <div className="about-content">
                    <div style={{ textAlign: "center", width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                            <CheckCircle2 size={64} color="#4CAF50" strokeWidth={2} />
                        </div>
                        <h3>{t("restartDialog.message")}</h3>
                        <p style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>{t("restartDialog.description")}</p>
                    </div>
                </div>

                <div className="about-footer">
                    <div className="action-buttons">
                        <button className="btn btn-secondary" onClick={onClose}>
                            {t("restartDialog.later")}
                        </button>
                        <button className="btn btn-primary" onClick={handleRestart}>
                            {t("restartDialog.restartNow")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestartDialog;
