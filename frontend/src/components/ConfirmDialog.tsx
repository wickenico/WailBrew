import { Copy } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { PreviewBrewCommand } from "../../wailsjs/go/main/App";

export interface CommandSpec {
    action: "install" | "uninstall" | "upgrade" | "upgrade-selected" | "upgrade-all" | "tap" | "untap" | "trust";
    targets: string[];
    isCask?: boolean;
    zap?: boolean;
}

interface ConfirmDialogProps {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    dependents?: string[];
    checkboxLabel?: string;
    checkboxHint?: string;
    checkboxChecked?: boolean;
    onCheckboxChange?: (checked: boolean) => void;
    commandSpec?: CommandSpec;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
    destructive,
    dependents,
    checkboxLabel,
    checkboxHint,
    checkboxChecked,
    onCheckboxChange,
    commandSpec,
}) => {
    const { t } = useTranslation();
    const [command, setCommand] = useState<string>("");

    const action = commandSpec?.action;
    const targets = commandSpec?.targets;
    const isCask = commandSpec?.isCask ?? false;
    const zap = commandSpec?.zap ?? false;
    // Serialized so the effect compares target values instead of array identity.
    const targetKey = targets ? targets.join("\u0000") : "";

    useEffect(() => {
        if (!open || !action) {
            setCommand("");
            return;
        }

        let cancelled = false;
        const resolvedTargets = targetKey === "" ? [] : targetKey.split("\u0000");
        Promise.resolve()
            .then(() => PreviewBrewCommand(action, resolvedTargets, isCask, zap))
            .then((preview) => {
                if (!cancelled) setCommand(preview);
            })
            .catch(() => {
                if (!cancelled) setCommand("");
            });

        return () => {
            cancelled = true;
        };
    }, [open, action, targetKey, isCask, zap]);

    if (!open) return null;

    const defaultConfirmLabel = confirmLabel || t("buttons.yes");
    const defaultCancelLabel = cancelLabel || t("buttons.cancel");

    const handleCopyCommand = async () => {
        try {
            await navigator.clipboard.writeText(command);
            toast.success(t("dialogs.commandCopied"), {
                duration: 2000,
                position: "bottom-center",
            });
        } catch (err) {
            console.error("Failed to copy command:", err);
            toast.error(t("logDialog.copyFailed"), {
                duration: 2000,
                position: "bottom-center",
            });
        }
    };

    return (
        <div className="confirm-overlay">
            <div className="confirm-box">
                <p>{message}</p>
                {dependents && dependents.length > 0 && (
                    <div className="confirm-dependents-warning">
                        <span className="confirm-dependents-title">
                            ⚠ {t("dialogs.dependentsWarning", { count: dependents.length })}
                        </span>
                        <div className="confirm-dependents-chips">
                            {dependents.map((dep) => (
                                <span key={dep} className="confirm-dependent-chip">
                                    {dep}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {checkboxLabel && onCheckboxChange && (
                    <div className="confirm-checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={!!checkboxChecked}
                                onChange={(e) => onCheckboxChange(e.target.checked)}
                            />
                            <span>{checkboxLabel}</span>
                        </label>
                        {checkboxHint && <span className="confirm-checkbox-hint">{checkboxHint}</span>}
                    </div>
                )}
                {command && (
                    <div className="confirm-command">
                        <span className="confirm-command-label">{t("dialogs.commandPreview")}</span>
                        <div className="confirm-command-row">
                            <code className="confirm-command-text" dir="ltr">
                                {command}
                            </code>
                            <button
                                type="button"
                                className="confirm-command-copy"
                                onClick={handleCopyCommand}
                                title={t("dialogs.copyCommand")}
                                aria-label={t("dialogs.copyCommand")}
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                )}
                <div className="confirm-actions">
                    <button className={destructive ? "destructive" : ""} onClick={onConfirm}>
                        {defaultConfirmLabel}
                    </button>
                    <button onClick={onCancel}>{defaultCancelLabel}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
