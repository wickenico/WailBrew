import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheckBig, CircleX, ArrowUp, ArrowDown, Info } from "lucide-react";

interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
}

interface RepositoryTableProps {
    repositories: RepositoryEntry[];
    selectedRepository: RepositoryEntry | null;
    loading: boolean;
    onSelect: (repo: RepositoryEntry) => void;
    onUntap?: (repo: RepositoryEntry) => void;
    onShowInfo?: (repo: RepositoryEntry) => void;
}

const RepositoryTable: React.FC<RepositoryTableProps> = ({
    repositories,
    selectedRepository,
    loading,
    onSelect,
    onUntap,
    onShowInfo,
}) => {
    const { t } = useTranslation();
    const [sortKey, setSortKey] = useState<string | null>('name'); // Default sort by name
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const columns = [
        { key: "name", label: t('tableColumns.name'), sortable: true },
        { key: "status", label: t('tableColumns.status'), sortable: false },
    ];

    if (onUntap || onShowInfo) {
        columns.push({ key: "actions", label: t('tableColumns.actions'), sortable: false });
    }

    const getColumnWidth = (key: string): string => {
        if (key === 'name') return 'auto';
        if (key === 'status') return '150px';
        if (key === 'actions') return '100px';
        return 'auto';
    };

    // Handle column header click for sorting
    const handleSort = (key: string, sortable: boolean = true) => {
        // Don't sort on non-sortable columns
        if (!sortable) return;
        
        if (sortKey === key) {
            // Toggle direction if same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to ascending
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    // Sort repositories based on current sort state
    const sortedRepositories = useMemo(() => {
        if (!sortKey) return repositories;
        
        return [...repositories].sort((a, b) => {
            let aValue: any = (a as any)[sortKey];
            let bValue: any = (b as any)[sortKey];
            
            // Handle undefined/null values
            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';
            
            // Compare
            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;
            
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [repositories, sortKey, sortDirection]);

    const renderCellContent = (repo: RepositoryEntry, col: { key: string; label: string }) => {
        if (col.key === "actions") {
            return (
                <div className="action-buttons">
                    {onShowInfo && (
                        <button
                            className="action-button info-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInfo(repo);
                            }}
                            title={t('buttons.showInfo', { name: repo.name })}
                        >
                            <Info size={20} />
                        </button>
                    )}
                    {onUntap && (
                        <button
                            className="action-button uninstall-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUntap(repo);
                            }}
                            title={t('buttons.untap', { name: repo.name })}
                        >
                            <CircleX size={20} />
                        </button>
                    )}
                </div>
            );
        }
        if (col.key === "status") {
            return (
                <span style={{ color: "green", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CircleCheckBig size={16} />
                    {t('repository.active')}
                </span>
            );
        }
        return (repo as any)[col.key];
    };
    
    return (
    <div className="table-container">
        {loading && (
            <div className="table-loading-overlay">
                <div className="spinner"></div>
                <div className="loading-text">{t('table.loadingRepositories')}</div>
            </div>
        )}
        {repositories.length > 0 && (
            <div className="table-split-wrapper">
                <table className="package-table package-table-header">
                    <colgroup>
                        {columns.map((col) => (
                            <col key={`header-col-${col.key}`} style={{ width: getColumnWidth(col.key) }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            {columns.map(col => {
                                const isSortable = col.sortable !== false && col.key !== 'actions';
                                const isCurrentSort = sortKey === col.key;
                                
                                return (
                                    <th 
                                        key={col.key}
                                        onClick={() => handleSort(col.key, isSortable)}
                                        style={{ 
                                            cursor: isSortable ? 'pointer' : 'default',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {col.label}
                                            {isSortable && !isCurrentSort && (
                                                <div style={{ opacity: 0.3 }}>
                                                    <ArrowUp size={14} />
                                                </div>
                                            )}
                                            {isSortable && isCurrentSort && sortDirection === 'asc' && (
                                                <ArrowUp size={14} />
                                            )}
                                            {isSortable && isCurrentSort && sortDirection === 'desc' && (
                                                <ArrowDown size={14} />
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                </table>
                <div className="table-body-scroll">
                    <table className="package-table package-table-body">
                        <colgroup>
                            {columns.map((col) => (
                                <col key={`body-col-${col.key}`} style={{ width: getColumnWidth(col.key) }} />
                            ))}
                        </colgroup>
                        <tbody>
                            {sortedRepositories.map(repo => (
                                <tr
                                    key={repo.name}
                                    className={selectedRepository?.name === repo.name ? "selected" : ""}
                                    onClick={() => onSelect(repo)}
                                >
                                    {columns.map(col => (
                                        <td key={col.key}>
                                            {renderCellContent(repo, col)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-footer">
                    <div className="table-footer-content">
                        {repositories.length} {repositories.length === 1 ? t('table.repository') : t('table.repositories')}
                    </div>
                </div>
            </div>
        )}
        {!loading && repositories.length === 0 && (
            <div className="result">{t('table.noResults')}</div>
        )}
    </div>
    );
};

export default RepositoryTable; 