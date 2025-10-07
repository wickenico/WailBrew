import React, { ReactNode } from "react";
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
    const searchPlaceholder = placeholder || t('search.placeholder');
    
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
                type="text"
                className="search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
            />
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