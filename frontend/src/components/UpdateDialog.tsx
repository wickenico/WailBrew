import { ArrowRight, CheckCircle2, CircleArrowUp, ExternalLink, PartyPopper, TriangleAlert } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckForUpdates } from "../../wailsjs/go/main/App";
import type { main } from "../../wailsjs/go/models";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useModalA11y } from "../hooks/useModalA11y";
import "./UpdateDialog.css";

interface UpdateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Starts `brew upgrade --cask wailbrew` through the regular update flow. */
    onUpdateNow: () => void;
    /** Reports each check's result, so the title bar button stays in sync. */
    onChecked?: (info: main.UpdateInfo) => void;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose, onUpdateNow, onChecked }) => {
    const { t } = useTranslation();
    const [updateInfo, setUpdateInfo] = useState<main.UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useModalA11y(isOpen, onClose, dialogRef);

    const checkForUpdates = async () => {
        setIsChecking(true);
        setError(null);
        try {
            const info = await CheckForUpdates();
            setUpdateInfo(info);
            onChecked?.(info);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsChecking(false);
        }
    };

    // Check on every open: the result may be stale (e.g. the title bar button
    // appeared after a background check found a new version).
    // biome-ignore lint/correctness/useExhaustiveDependencies: run only when the dialog opens
    useEffect(() => {
        if (isOpen) checkForUpdates();
    }, [isOpen]);

    if (!isOpen) return null;

    const isAvailable = !isChecking && !error && updateInfo?.available === true;
    const canUpdateInApp = isAvailable && updateInfo?.installedViaHomebrew === true;
    const openReleasePage = () => {
        if (updateInfo?.releaseUrl) BrowserOpenURL(updateInfo.releaseUrl);
    };

    const renderContent = () => {
        if (isChecking) {
            return (
                <div className="update-dialog-state">
                    <div className="loading-spinner"></div>
                    <p className="update-dialog-muted">{t("updateDialog.checking")}</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="update-dialog-state update-dialog-error">
                    <TriangleAlert size={44} strokeWidth={1.75} className="update-dialog-error-icon" />
                    <h3>{t("updateDialog.error")}</h3>
                    <p className="update-dialog-muted">{error}</p>
                </div>
            );
        }

        if (!updateInfo) return null;

        if (!updateInfo.available) {
            return (
                <div className="update-dialog-state">
                    <CheckCircle2 size={52} strokeWidth={1.75} className="update-dialog-ok-icon" />
                    <h3>{t("updateDialog.upToDate")}</h3>
                    <p className="update-dialog-muted">
                        {t("updateDialog.currentVersionIs", { version: updateInfo.currentVersion })}
                    </p>
                </div>
            );
        }

        return (
            <div className="update-dialog-state">
                <PartyPopper size={40} strokeWidth={1.75} className="update-dialog-accent-icon" />
                <h3>{t("updateDialog.available")}</h3>

                <div className="update-dialog-versions">
                    <div className="update-dialog-version">
                        <span className="update-dialog-version-label">{t("updateDialog.currentVersion")}</span>
                        <span className="update-dialog-version-number">{updateInfo.currentVersion}</span>
                    </div>
                    <ArrowRight size={22} className="update-dialog-version-arrow" aria-hidden="true" />
                    <div className="update-dialog-version update-dialog-version-latest">
                        <span className="update-dialog-version-label">{t("updateDialog.newVersion")}</span>
                        <span className="update-dialog-version-number">{updateInfo.latestVersion}</span>
                    </div>
                </div>

                <p className="update-dialog-muted">
                    {updateInfo.installedViaHomebrew
                        ? t("updateDialog.updateNowHint")
                        : t("updateDialog.notInstalledViaHomebrew")}
                </p>

                {updateInfo.releaseUrl && updateInfo.installedViaHomebrew && (
                    <button type="button" className="update-dialog-link" onClick={openReleasePage}>
                        <ExternalLink size={14} />
                        {t("updateDialog.releaseNotes", { version: updateInfo.latestVersion })}
                    </button>
                )}
            </div>
        );
    };

    const renderFooter = () => {
        if (error) {
            return (
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        {t("buttons.close")}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={checkForUpdates}>
                        {t("updateDialog.tryAgain")}
                    </button>
                </>
            );
        }
        if (canUpdateInApp) {
            return (
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        {t("updateDialog.later")}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={onUpdateNow}>
                        <CircleArrowUp size={16} />
                        {t("updateDialog.updateNow")}
                    </button>
                </>
            );
        }
        if (isAvailable && updateInfo?.releaseUrl) {
            return (
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        {t("buttons.close")}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={openReleasePage}>
                        <ExternalLink size={16} />
                        {t("updateDialog.openReleasePage")}
                    </button>
                </>
            );
        }
        return (
            <button type="button" className="btn btn-primary" onClick={onClose}>
                {t("buttons.close")}
            </button>
        );
    };

    return (
        <div className="update-dialog-overlay" onClick={onClose}>
            <div
                className="update-dialog"
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="update-dialog-title"
                tabIndex={-1}
            >
                <div className="update-dialog-header">
                    <h2 id="update-dialog-title">{t("updateDialog.title")}</h2>
                </div>
                <div className="update-dialog-content">{renderContent()}</div>
                <div className="update-dialog-footer">{renderFooter()}</div>
            </div>
        </div>
    );
};

export default UpdateDialog;
