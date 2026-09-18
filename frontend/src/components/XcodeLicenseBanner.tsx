import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { XCODE_LICENSE_COMMAND } from "../utils/xcodeLicense";

export default function XcodeLicenseBanner({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
    const { t } = useTranslation();

    const copyCommand = async () => {
        try {
            await navigator.clipboard.writeText(XCODE_LICENSE_COMMAND);
            toast.success(t("dialogs.commandCopied"));
        } catch {
            toast.error(t("logDialog.copyFailed"));
        }
    };

    return (
        <section className="brew-location-banner xcode-license-banner" role="alert">
            <div className="brew-location-banner-text">
                <strong>{t("xcodeLicense.title")}</strong>
                <span>{t("xcodeLicense.message")}</span>
                <div className="confirm-command-row">
                    <code className="confirm-command-text" dir="ltr">
                        {XCODE_LICENSE_COMMAND}
                    </code>
                    <button
                        type="button"
                        className="confirm-command-copy"
                        onClick={copyCommand}
                        title={t("dialogs.copyCommand")}
                        aria-label={t("dialogs.copyCommand")}
                    >
                        <Copy size={16} />
                    </button>
                </div>
                <span>{t("xcodeLicense.retryHint")}</span>
            </div>
            <div className="brew-location-banner-actions">
                <button type="button" className="brew-location-switch-btn" onClick={onRetry} disabled={loading}>
                    {t("xcodeLicense.retry")}
                </button>
            </div>
        </section>
    );
}
