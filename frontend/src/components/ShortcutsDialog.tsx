import { Keyboard, X } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useModalA11y } from "../hooks/useModalA11y";

interface ShortcutsDialogProps {
    open: boolean;
    onClose: () => void;
}

interface ShortcutSection {
    title: string;
    shortcuts: Array<{
        action: string;
        keys: string;
    }>;
}

const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);

    useModalA11y(open, onClose, dialogRef);

    // Detect if user is on Mac
    const isMac =
        typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Mac") || navigator.userAgent.includes("macOS"));
    const cmdKey = isMac ? "⌘" : "Ctrl";
    const shiftKey = isMac ? "⇧" : "Shift";

    const sections: ShortcutSection[] = [
        {
            title: t("shortcuts.menu.title"),
            shortcuts: [
                { action: t("shortcuts.menu.shortcuts"), keys: `${cmdKey}${shiftKey}S` },
                { action: t("shortcuts.menu.settings"), keys: `${cmdKey},` },
                { action: t("shortcuts.menu.quit"), keys: `${cmdKey}Q` },
            ],
        },
        {
            title: t("shortcuts.navigation.title"),
            shortcuts: [
                { action: t("shortcuts.navigation.installed"), keys: `${cmdKey}1` },
                { action: t("shortcuts.navigation.casks"), keys: `${cmdKey}2` },
                { action: t("shortcuts.navigation.outdated"), keys: `${cmdKey}3` },
                { action: t("shortcuts.navigation.leaves"), keys: `${cmdKey}4` },
                { action: t("shortcuts.navigation.repositories"), keys: `${cmdKey}5` },
                { action: t("shortcuts.navigation.all"), keys: `${cmdKey}6` },
                { action: t("shortcuts.navigation.allCasks"), keys: `${cmdKey}7` },
                { action: t("shortcuts.navigation.homebrew"), keys: `${cmdKey}8` },
                { action: t("shortcuts.navigation.doctor"), keys: `${cmdKey}9` },
                { action: t("shortcuts.navigation.cleanup"), keys: `${cmdKey}0` },
            ],
        },
        {
            title: t("shortcuts.table.title"),
            shortcuts: [
                { action: t("shortcuts.table.focus"), keys: `${cmdKey}T` },
                { action: t("shortcuts.table.select"), keys: t("shortcuts.table.enter") },
                {
                    action: t("shortcuts.table.navigate"),
                    keys: `${t("shortcuts.table.arrowUp")} / ${t("shortcuts.table.arrowDown")}`,
                },
                { action: t("shortcuts.table.multiSelect"), keys: `${cmdKey}${shiftKey}M` },
            ],
        },
        {
            title: t("shortcuts.actions.title"),
            shortcuts: [
                { action: t("shortcuts.actions.refresh"), keys: `${cmdKey}${shiftKey}R` },
                { action: t("shortcuts.actions.exportBrewfile"), keys: `${cmdKey}E` },
            ],
        },
        {
            title: t("shortcuts.dialogs.title"),
            shortcuts: [
                { action: t("shortcuts.dialogs.close"), keys: t("shortcuts.dialogs.escape") },
                { action: t("shortcuts.dialogs.confirm"), keys: t("shortcuts.dialogs.enter") },
            ],
        },
    ];

    if (!open) return null;

    return (
        <div className="shortcuts-dialog-overlay" onClick={onClose}>
            <div
                className="shortcuts-dialog"
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t("shortcuts.title")}
                tabIndex={-1}
            >
                <div className="shortcuts-dialog-header">
                    <div className="shortcuts-dialog-header-content">
                        <Keyboard size={20} />
                        <h2>{t("shortcuts.title")}</h2>
                    </div>
                    <button className="shortcuts-dialog-close" onClick={onClose} aria-label={t("buttons.close")}>
                        <X size={20} />
                    </button>
                </div>
                <div className="shortcuts-dialog-content">
                    {sections.map((section) => (
                        <div key={section.title} className="shortcuts-section">
                            <h3 className="shortcuts-section-title">{section.title}</h3>
                            <div className="shortcuts-list">
                                {section.shortcuts.map((shortcut) => (
                                    <div key={shortcut.action} className="shortcut-item">
                                        <span className="shortcut-action">{shortcut.action}</span>
                                        <div className="shortcut-keys">
                                            {shortcut.keys.split(" ").map((key) => {
                                                // Handle special keys
                                                if (key === "/") {
                                                    return (
                                                        <span key={`sep-${key}`} className="shortcut-separator">
                                                            {key}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <kbd key={key} className="shortcut-key">
                                                        {key}
                                                    </kbd>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ShortcutsDialog;
