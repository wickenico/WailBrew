import { Keyboard, X } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useModalA11y } from "../hooks/useModalA11y";
import { formatShortcut } from "../utils/shortcuts";

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

    const sections: ShortcutSection[] = [
        {
            title: t("shortcuts.menu.title"),
            shortcuts: [
                { action: t("shortcuts.menu.shortcuts"), keys: formatShortcut("S", { shift: true }) },
                { action: t("shortcuts.menu.settings"), keys: formatShortcut(",") },
                { action: t("shortcuts.menu.quit"), keys: formatShortcut("Q") },
            ],
        },
        {
            title: t("shortcuts.navigation.title"),
            shortcuts: [
                { action: t("shortcuts.navigation.installed"), keys: formatShortcut("1") },
                { action: t("shortcuts.navigation.casks"), keys: formatShortcut("2") },
                { action: t("shortcuts.navigation.outdated"), keys: formatShortcut("3") },
                { action: t("shortcuts.navigation.leaves"), keys: formatShortcut("4") },
                { action: t("shortcuts.navigation.repositories"), keys: formatShortcut("5") },
                { action: t("shortcuts.navigation.all"), keys: formatShortcut("6") },
                { action: t("shortcuts.navigation.allCasks"), keys: formatShortcut("7") },
                { action: t("shortcuts.navigation.homebrew"), keys: formatShortcut("8") },
                { action: t("shortcuts.navigation.doctor"), keys: formatShortcut("9") },
                { action: t("shortcuts.navigation.security"), keys: formatShortcut("V", { shift: true }) },
                { action: t("shortcuts.navigation.cleanup"), keys: formatShortcut("0") },
                { action: t("shortcuts.navigation.snapshots"), keys: formatShortcut("B") },
                { action: t("shortcuts.navigation.dashboard"), keys: formatShortcut("D") },
            ],
        },
        {
            title: t("shortcuts.table.title"),
            shortcuts: [
                { action: t("shortcuts.table.focus"), keys: formatShortcut("T") },
                { action: t("shortcuts.table.select"), keys: t("shortcuts.table.enter") },
                {
                    action: t("shortcuts.table.navigate"),
                    keys: `${t("shortcuts.table.arrowUp")} / ${t("shortcuts.table.arrowDown")}`,
                },
                { action: t("shortcuts.table.multiSelect"), keys: formatShortcut("M", { shift: true }) },
            ],
        },
        {
            title: t("shortcuts.actions.title"),
            shortcuts: [
                { action: t("shortcuts.actions.refresh"), keys: formatShortcut("R", { shift: true }) },
                { action: t("shortcuts.actions.exportBrewfile"), keys: formatShortcut("E") },
                { action: t("shortcuts.actions.importBrewfile"), keys: formatShortcut("I", { shift: true }) },
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
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is a pointer convenience, keyboard users close the dialog with Escape (useModalA11y)
        <div
            className="shortcuts-dialog-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="shortcuts-dialog"
                ref={dialogRef}
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
                    <button
                        type="button"
                        className="shortcuts-dialog-close"
                        onClick={onClose}
                        aria-label={t("buttons.close")}
                    >
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
