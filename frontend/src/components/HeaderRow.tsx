import React, { ReactNode, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";

interface HeaderRowProps {
    title: string;
    actions?: ReactNode;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    placeholder?: string;
}

const HeaderRow: React.FC<HeaderRowProps> = ({
    title,
    actions,
    searchQuery,
    onSearchChange,
    onClearSearch,
    placeholder,
}) => {
    const { t } = useTranslation();
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    // Detect if user is on Mac
    const isMac = typeof navigator !== 'undefined' && 
        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'));
    const shortcutKey = isMac ? '⌘S' : 'Ctrl+S';
    
    const searchPlaceholder = placeholder || t('search.placeholder');

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Cmd+S (Mac) or Ctrl+S (Windows/Linux)
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault(); // Prevent browser's save dialog
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
    
    return (
    <div className="header-row">
        <div className="header-title">
            <h3>{title}</h3>
        </div>
        <div className="header-actions">{actions}</div>
        <div className="search-container">
            <span className="search-icon">
                <Search size={16} />
            </span>
            <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
            />
            {!searchQuery && (
                <span className="search-shortcut-hint">
                    {shortcutKey}
                </span>
            )}
            {searchQuery && (
                <span className="clear-icon" onClick={onClearSearch} title={t('search.clearSearch')}>
                    <X size={16} />
                </span>
            )}
        </div>
    </div>
    );
};

export default HeaderRow; 