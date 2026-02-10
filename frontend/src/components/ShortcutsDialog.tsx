import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Keyboard } from "lucide-react";

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
    
    // Detect if user is on Mac
    const isMac = typeof navigator !== 'undefined' && 
        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'));
    const cmdKey = isMac ? '⌘' : 'Ctrl';
    const shiftKey = isMac ? '⇧' : 'Shift';

    // Handle ESC key to close dialog
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        globalThis.addEventListener('keydown', handleKeyDown);
        return () => {
            globalThis.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    const sections: ShortcutSection[] = [
        {
            title: t('shortcuts.menu.title'),
            shortcuts: [
                { action: t('shortcuts.menu.commandPalette'), keys: `${cmdKey}K` },
                { action: t('shortcuts.menu.shortcuts'), keys: `${cmdKey}${shiftKey}S` },
                { action: t('shortcuts.menu.settings'), keys: `${cmdKey},` },
                { action: t('shortcuts.menu.quit'), keys: `${cmdKey}Q` },
            ],
        },
        {
            title: t('shortcuts.navigation.title'),
            shortcuts: [
                { action: t('shortcuts.navigation.installed'), keys: `${cmdKey}1` },
                { action: t('shortcuts.navigation.casks'), keys: `${cmdKey}2` },
                { action: t('shortcuts.navigation.outdated'), keys: `${cmdKey}3` },
                { action: t('shortcuts.navigation.leaves'), keys: `${cmdKey}4` },
                { action: t('shortcuts.navigation.repositories'), keys: `${cmdKey}5` },
                { action: t('shortcuts.navigation.all'), keys: `${cmdKey}6` },
                { action: t('shortcuts.navigation.allCasks'), keys: `${cmdKey}7` },
                { action: t('shortcuts.navigation.homebrew'), keys: `${cmdKey}8` },
                { action: t('shortcuts.navigation.doctor'), keys: `${cmdKey}9` },
                { action: t('shortcuts.navigation.cleanup'), keys: `${cmdKey}0` },
            ],
        },
        {
            title: t('shortcuts.table.title'),
            shortcuts: [
                { action: t('shortcuts.table.focus'), keys: `${cmdKey}T` },
                { action: t('shortcuts.table.select'), keys: t('shortcuts.table.enter') },
                { action: t('shortcuts.table.navigate'), keys: `${t('shortcuts.table.arrowUp')} / ${t('shortcuts.table.arrowDown')}` },
                { action: t('shortcuts.table.multiSelect'), keys: `${cmdKey}${shiftKey}M` },
            ],
        },
        {
            title: t('shortcuts.actions.title'),
            shortcuts: [
                { action: t('shortcuts.actions.refresh'), keys: `${cmdKey}${shiftKey}R` },
                { action: t('shortcuts.actions.exportBrewfile'), keys: `${cmdKey}E` },
            ],
        },
        {
            title: t('shortcuts.dialogs.title'),
            shortcuts: [
                { action: t('shortcuts.dialogs.close'), keys: t('shortcuts.dialogs.escape') },
                { action: t('shortcuts.dialogs.confirm'), keys: t('shortcuts.dialogs.enter') },
            ],
        },
    ];

    if (!open) return null;

    return (
        <div 
            className="shortcuts-dialog-overlay" 
            onClick={onClose}
            role="button"
            tabIndex={-1}
            aria-label={t('buttons.close')}
        >
            <div 
                className="shortcuts-dialog" 
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t('shortcuts.title')}
            >
                <div className="shortcuts-dialog-header">
                    <div className="shortcuts-dialog-header-content">
                        <Keyboard size={20} />
                        <h2>{t('shortcuts.title')}</h2>
                    </div>
                    <button
                        className="shortcuts-dialog-close"
                        onClick={onClose}
                        aria-label={t('buttons.close')}
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
                                            {shortcut.keys.split(' ').map((key) => {
                                                // Handle special keys
                                                if (key === '/') {
                                                    return <span key={`sep-${key}`} className="shortcut-separator">{key}</span>;
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

