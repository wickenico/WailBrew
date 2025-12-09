import React, { ReactNode, useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search, Clock, Trash2 } from "lucide-react";

interface HeaderRowProps {
    title: string;
    actions?: ReactNode;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    placeholder?: string;
}

const MAX_SEARCH_HISTORY = 10;
const SEARCH_HISTORY_KEY = 'wailbrew_search_history';

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
    const [showHistory, setShowHistory] = useState<boolean>(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<number | null>(null);
    
    // Detect if user is on Mac
    const isMac = typeof navigator !== 'undefined' && 
        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'));
    const shortcutKey = isMac ? '⌘S' : 'Ctrl+S';
    
    const searchPlaceholder = placeholder || t('search.placeholder');

    // Load search history from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
            if (stored) {
                const history = JSON.parse(stored);
                if (Array.isArray(history) && history.length > 0) {
                    setSearchHistory(history);
                }
            }
        } catch {
            // Silently fail if localStorage is not available or quota exceeded
        }
    }, []);

    // Save search to history
    const saveToHistory = useCallback((query: string) => {
        if (!query.trim()) return;
        
        try {
            setSearchHistory(prevHistory => {
                const updatedHistory = [
                    query.trim(),
                    ...prevHistory.filter(item => item !== query.trim())
                ].slice(0, MAX_SEARCH_HISTORY);
                
                localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
                return updatedHistory;
            });
        } catch {
            // Silently fail if localStorage is not available or quota exceeded
        }
    }, []);

    // Handle search change
    const handleSearchChange = (value: string) => {
        onSearchChange(value);
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Show history dropdown when typing if there's history
        if (searchHistory.length > 0) {
            setShowHistory(true);
        }
        
        // Save to history after user stops typing (debounced)
        if (value.trim().length > 0) {
            saveTimeoutRef.current = setTimeout(() => {
                saveToHistory(value.trim());
            }, 800); // Wait 800ms after user stops typing
        }
    };

    // Handle search submit (Enter key)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            // Clear any pending timeout and save immediately
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            saveToHistory(searchQuery.trim());
            setShowHistory(false);
        } else if (e.key === 'Escape') {
            setShowHistory(false);
            searchInputRef.current?.blur();
        } else if (e.key === 'ArrowDown' && showHistory && searchHistory.length > 0) {
            e.preventDefault();
            // Focus first history item
            const firstItem = containerRef.current?.querySelector('.search-history-item') as HTMLElement;
            firstItem?.focus();
        }
    };

    // Handle selecting a history item
    const handleSelectHistory = (item: string) => {
        // Clear any pending timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        onSearchChange(item);
        saveToHistory(item);
        setShowHistory(false);
        searchInputRef.current?.focus();
    };
    
    // Handle removing a history item
    const handleRemoveHistory = (e: React.MouseEvent, item: string) => {
        e.stopPropagation(); // Prevent selecting the item
        e.preventDefault(); // Prevent any default behavior
        try {
            setSearchHistory(prevHistory => {
                const updatedHistory = prevHistory.filter(h => h !== item);
                localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
                // Keep dropdown open if there are still items, or close if empty
                if (updatedHistory.length === 0) {
                    setShowHistory(false);
                }
                return updatedHistory;
            });
        } catch {
            // Silently fail if localStorage is not available or quota exceeded
        }
    };
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Handle focus
    const handleFocus = () => {
        // Show history dropdown if there's any history
        if (searchHistory.length > 0) {
            setShowHistory(true);
        }
    };

    // Handle blur (with delay to allow clicking on history items)
    const handleBlur = (e: React.FocusEvent) => {
        // Use setTimeout to allow click events on history items to fire
        setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
                setShowHistory(false);
            }
        }, 200);
    };

    // Global keyboard shortcut handler
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Cmd+S (Mac) or Ctrl+S (Windows/Linux)
            // Explicitly ignore if Shift is pressed (Cmd+Shift+S is for shortcuts dialog)
            if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === 's') {
                event.preventDefault(); // Prevent browser's save dialog
                searchInputRef.current?.focus();
                if (searchHistory.length > 0) {
                    setShowHistory(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [searchHistory.length]);

    // Close history when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };

        if (showHistory) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showHistory]);
    
    return (
    <div className="header-row">
        <div className="header-title">
            <h3>{title}</h3>
        </div>
        <div className="header-actions">{actions}</div>
        <div className="search-container-wrapper" ref={containerRef}>
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
                    onChange={e => handleSearchChange(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
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
            {showHistory && searchHistory.length > 0 && (
                <div className="search-history-dropdown">
                    <div className="search-history-header">
                        <Clock size={14} />
                        <span>{t('search.recentSearches')}</span>
                    </div>
                    {searchHistory
                        .filter(item => !searchQuery || item.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((item, index) => (
                        <button
                            key={`${item}-${index}`}
                            type="button"
                            className="search-history-item"
                            onClick={() => handleSelectHistory(item)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelectHistory(item);
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const next = e.currentTarget.nextElementSibling as HTMLElement;
                                    next?.focus();
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prev = e.currentTarget.previousElementSibling as HTMLElement;
                                    prev?.focus();
                                    if (!prev) {
                                        searchInputRef.current?.focus();
                                    }
                                }
                            }}
                        >
                            <Search size={14} />
                            <span className="search-history-item-text">{item}</span>
                            <button
                                type="button"
                                className="search-history-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleRemoveHistory(e, item);
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleRemoveHistory(e as any, item);
                                    }
                                }}
                                title={t('search.removeFromHistory', { item })}
                            >
                                <Trash2 size={14} />
                            </button>
                        </button>
                    ))}
                </div>
            )}
        </div>
    </div>
    );
};

export default HeaderRow; 