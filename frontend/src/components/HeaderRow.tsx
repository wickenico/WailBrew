import React, { ReactNode } from "react";

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
    placeholder = "Suchen",
}) => (
    <div className="header-row">
        <div className="header-title">
            <h3>{title}</h3>
        </div>
        <div className="header-actions">{actions}</div>
        <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
                type="text"
                className="search-input"
                placeholder={placeholder}
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
            />
            {searchQuery && (
                <span className="clear-icon" onClick={onClearSearch} title="Suche zurücksetzen">✕</span>
            )}
        </div>
    </div>
);

export default HeaderRow; 