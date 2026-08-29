import { Check, CheckCircle2, Copy, PartyPopper, TriangleAlert } from "lucide-react";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckForUpdates } from "../../wailsjs/go/main/App";
import type { main } from "../../wailsjs/go/models";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useModalA11y } from "../hooks/useModalA11y";

interface UpdateDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [updateInfo, setUpdateInfo] = useState<main.UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    useModalA11y(isOpen, onClose, dialogRef);

    const checkForUpdates = async () => {
        setIsChecking(true);
        setError(null);

        try {
            const info = await CheckForUpdates();
            setUpdateInfo(info);
        } catch (err) {
            let errorMessage = "Failed to check for updates";

            if (err instanceof Error) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setIsChecking(false);
        }
    };

    const _handleLinkClick = (url: string) => {
        BrowserOpenURL(url);
    };

    const _handleKeyDown = (e: React.KeyboardEvent, url: string) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            BrowserOpenURL(url);
        }
    };

    const copyBrewCommand = async () => {
        const command = "brew update\nbrew upgrade --cask wailbrew";
        try {
            await navigator.clipboard.writeText(command);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error("Failed to copy to clipboard:", err);
        }
    };

    const _formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
    };

    const _formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    React.useEffect(() => {
        if (isOpen && !updateInfo) {
            checkForUpdates();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="about-overlay" onClick={onClose}>
            <div
                className="about-dialog update-dialog"
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="update-dialog-title"
                tabIndex={-1}
            >
                <div className="about-header">
                    <h2 id="update-dialog-title">{t("updateDialog.title")}</h2>
                </div>

                <div className="about-content">
                    {isChecking && (
                        <div className="update-checking">
                            <div className="loading-spinner"></div>
                            <p>{t("updateDialog.checking")}</p>
                        </div>
                    )}

                    {error && (
                        <div className="update-error">
                            <div className="error-icon">
                                <TriangleAlert size={52} strokeWidth={1.75} />
                            </div>
                            <div>
                                <h3>{t("updateDialog.error")}</h3>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {updateInfo && !isChecking && !error && (
                        <div className="update-info">
                            {updateInfo.available ? (
                                <div className="update-available">
                                    <div className="update-icon">
                                        <PartyPopper size={36} strokeWidth={1.75} />
                                    </div>
                                    <div className="update-details">
                                        <h3>{t("updateDialog.available")}</h3>
                                        <div className="version-comparison">
                                            <div className="version-boxes">
                                                <div className="version-box current">
                                                    <span className="version-label">
                                                        {t("updateDialog.currentVersion")}
                                                    </span>
                                                    <span className="version-number">{updateInfo.currentVersion}</span>
                                                </div>
                                                <div className="version-arrow">→</div>
                                                <div className="version-box latest">
                                                    <span className="version-label">
                                                        {t("updateDialog.newVersion")}
                                                    </span>
                                                    <span className="version-number">{updateInfo.latestVersion}</span>
                                                </div>
                                            </div>
                                            <div className="release-info">
                                                <div className="release-info-item">
                                                    <div
                                                        className="release-info-label"
                                                        style={{ fontStyle: "italic", opacity: 0.8 }}
                                                    >
                                                        {t("updateDialog.availableViaHomebrew")}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="brew-command-section">
                                            <h4>{t("updateDialog.manualUpdate")}:</h4>
                                            <p className="update-instruction">{t("updateDialog.instruction")}</p>
                                            <div className="command-container">
                                                <code className="brew-command">
                                                    brew update
                                                    <br />
                                                    brew upgrade --cask wailbrew
                                                </code>
                                                <button
                                                    className="copy-button"
                                                    onClick={copyBrewCommand}
                                                    title={t("updateDialog.copyCommand")}
                                                >
                                                    {copySuccess ? <Check size={18} /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                            {copySuccess && <p className="copy-success">{t("updateDialog.copied")}</p>}
                                        </div>

                                        {updateInfo.releaseNotes && (
                                            <div className="release-notes">
                                                <div className="release-notes-content">
                                                    <h4>{t("updateDialog.changes")}:</h4>
                                                    {updateInfo.releaseNotes
                                                        .split("\n")
                                                        .map((line: string, index: number) => (
                                                            <p key={index}>{line}</p>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="update-current">
                                    <div
                                        className="update-icon"
                                        style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}
                                    >
                                        <CheckCircle2 size={64} color="#4CAF50" strokeWidth={2} />
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <h3>{t("updateDialog.upToDate")}</h3>
                                        <p style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
                                            {t("updateDialog.currentVersionIs", { version: updateInfo.currentVersion })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="about-footer">
                    {error ? (
                        <div className="action-buttons">
                            <button className="btn btn-secondary" onClick={onClose}>
                                {t("buttons.close")}
                            </button>
                            <button className="btn btn-primary" onClick={checkForUpdates}>
                                {t("updateDialog.tryAgain")}
                            </button>
                        </div>
                    ) : updateInfo?.available ? (
                        <div className="action-buttons">
                            <button className="btn btn-secondary" onClick={onClose}>
                                {t("updateDialog.gotIt")}
                            </button>
                        </div>
                    ) : (
                        <button onClick={onClose} className="about-close-button">
                            {t("buttons.close")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdateDialog;
