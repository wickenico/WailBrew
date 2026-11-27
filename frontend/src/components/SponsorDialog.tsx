import { Browser } from "@wailsio/runtime";
import { Heart } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useModalA11y } from "../hooks/useModalA11y";

const SPONSOR_URL = "https://github.com/sponsors/wickenico";
const KOFI_URL = "https://ko-fi.com/wickenico";

interface SponsorDialogProps {
    isOpen: boolean;
    updatedCount: number;
    onClose: () => void;
}

const SponsorDialog: React.FC<SponsorDialogProps> = ({ isOpen, updatedCount, onClose }) => {
    const { t } = useTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);

    useModalA11y(isOpen, onClose, dialogRef);

    if (!isOpen) return null;

    const open = (url: string) => {
        Browser.OpenURL(url);
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a pointer convenience, keyboard users close the dialog with Escape (useModalA11y)
        <div role="presentation" className="about-overlay" onClick={handleOverlayClick}>
            <div
                className="about-dialog"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="sponsor-dialog-title"
                tabIndex={-1}
            >
                <div className="about-header">
                    <h2 id="sponsor-dialog-title">{t("sponsorDialog.title")}</h2>
                </div>

                <div className="about-content">
                    <div style={{ textAlign: "center", width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                            <Heart size={56} color="#db61a2" fill="#db61a2" strokeWidth={2} />
                        </div>
                        <h3>{t("sponsorDialog.message", { count: updatedCount })}</h3>
                        <p style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>{t("sponsorDialog.description")}</p>
                    </div>
                </div>

                <div className="about-footer">
                    <div className="action-buttons" style={{ flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            {t("sponsorDialog.later")}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => open(KOFI_URL)}>
                            {t("sponsorDialog.kofi")}
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => open(SPONSOR_URL)}>
                            {t("sponsorDialog.sponsor")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SponsorDialog;
