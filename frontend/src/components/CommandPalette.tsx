import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Package, Box, RefreshCw, Database, Home, Stethoscope, Trash2, Settings, ArrowRight } from "lucide-react";

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    packages: Array<{ name: string; installedVersion?: string; desc?: string; isInstalled?: boolean }>;
    casks: Array<{ name: string; installedVersion?: string; desc?: string }>;
    repositories: Array<{ name: string; desc?: string }>;
    onSelectPackage: (pkg: { name: string; installedVersion?: string; desc?: string; isInstalled?: boolean; latestVersion?: string; size?: string; homepage?: string; dependencies?: string[]; conflicts?: string[]; warning?: string }) => void;
    onSelectRepository: (repo: { name: string; desc?: string }) => void;
    onNavigateToView: (view: "installed" | "casks" | "updatable" | "all" | "allCasks" | "leaves" | "repositories" | "homebrew" | "doctor" | "cleanup" | "settings") => void;
}

interface CommandItem {
    id: string;
    type: 'package' | 'cask' | 'repository' | 'view';
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    action: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
    open,
    onClose,
    packages,
    casks,
    repositories,
    onSelectPackage,
    onSelectRepository,
    onNavigateToView,
}) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    
    // Detect if user is on Mac
    const isMac = typeof navigator !== 'undefined' && 
        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'));
    const cmdKey = isMac ? '⌘' : 'Ctrl';

    const commands: CommandItem[] = useMemo(() => {
        const items: CommandItem[] = [];
        const lowerQuery = query.toLowerCase();

        // Views
        if (lowerQuery.length === 0 || 'installed'.includes(lowerQuery) || t('sidebar.installed').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-installed',
                type: 'view',
                title: t('sidebar.installed'),
                subtitle: `${cmdKey}1`,
                icon: <Package size={16} />,
                action: () => {
                    onNavigateToView('installed');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'casks'.includes(lowerQuery) || t('sidebar.casks').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-casks',
                type: 'view',
                title: t('sidebar.casks'),
                subtitle: `${cmdKey}2`,
                icon: <Box size={16} />,
                action: () => {
                    onNavigateToView('casks');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'outdated'.includes(lowerQuery) || t('sidebar.outdated').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-updatable',
                type: 'view',
                title: t('sidebar.outdated'),
                subtitle: `${cmdKey}3`,
                icon: <RefreshCw size={16} />,
                action: () => {
                    onNavigateToView('updatable');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'leaves'.includes(lowerQuery) || t('sidebar.leaves').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-leaves',
                type: 'view',
                title: t('sidebar.leaves'),
                subtitle: `${cmdKey}4`,
                icon: <Package size={16} />,
                action: () => {
                    onNavigateToView('leaves');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'repositories'.includes(lowerQuery) || t('sidebar.repositories').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-repositories',
                type: 'view',
                title: t('sidebar.repositories'),
                subtitle: `${cmdKey}5`,
                icon: <Database size={16} />,
                action: () => {
                    onNavigateToView('repositories');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'all'.includes(lowerQuery) || 'formulae'.includes(lowerQuery) || t('sidebar.allFormulae').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-all',
                type: 'view',
                title: t('sidebar.allFormulae'),
                subtitle: `${cmdKey}6`,
                icon: <Database size={16} />,
                action: () => {
                    onNavigateToView('all');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'all casks'.includes(lowerQuery) || t('sidebar.allCasks').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-allCasks',
                type: 'view',
                title: t('sidebar.allCasks'),
                subtitle: `${cmdKey}7`,
                icon: <Box size={16} />,
                action: () => {
                    onNavigateToView('allCasks');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'homebrew'.includes(lowerQuery) || t('sidebar.homebrew').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-homebrew',
                type: 'view',
                title: t('sidebar.homebrew'),
                subtitle: `${cmdKey}8`,
                icon: <Home size={16} />,
                action: () => {
                    onNavigateToView('homebrew');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'doctor'.includes(lowerQuery) || t('sidebar.doctor').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-doctor',
                type: 'view',
                title: t('sidebar.doctor'),
                subtitle: `${cmdKey}9`,
                icon: <Stethoscope size={16} />,
                action: () => {
                    onNavigateToView('doctor');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'cleanup'.includes(lowerQuery) || t('sidebar.cleanup').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-cleanup',
                type: 'view',
                title: t('sidebar.cleanup'),
                subtitle: `${cmdKey}0`,
                icon: <Trash2 size={16} />,
                action: () => {
                    onNavigateToView('cleanup');
                    onClose();
                },
            });
        }
        if (lowerQuery.length === 0 || 'settings'.includes(lowerQuery) || t('view.settings').toLowerCase().includes(lowerQuery)) {
            items.push({
                id: 'view-settings',
                type: 'view',
                title: t('view.settings'),
                subtitle: `${cmdKey},`,
                icon: <Settings size={16} />,
                action: () => {
                    onNavigateToView('settings');
                    onClose();
                },
            });
        }

        // Packages
        packages
            .filter(pkg => pkg.name.toLowerCase().includes(lowerQuery) || pkg.desc?.toLowerCase().includes(lowerQuery))
            .slice(0, 10)
            .forEach(pkg => {
                items.push({
                    id: `package-${pkg.name}`,
                    type: 'package',
                    title: pkg.name,
                    subtitle: pkg.desc || (pkg.isInstalled ? pkg.installedVersion : ''),
                    icon: <Package size={16} />,
                    action: () => {
                        onSelectPackage(pkg);
                        onClose();
                    },
                });
            });

        // Casks
        casks
            .filter(cask => cask.name.toLowerCase().includes(lowerQuery) || cask.desc?.toLowerCase().includes(lowerQuery))
            .slice(0, 10)
            .forEach(cask => {
                items.push({
                    id: `cask-${cask.name}`,
                    type: 'cask',
                    title: cask.name,
                    subtitle: cask.desc || cask.installedVersion,
                    icon: <Box size={16} />,
                    action: () => {
                        onSelectPackage(cask);
                        onClose();
                    },
                });
            });

        // Repositories
        repositories
            .filter(repo => repo.name.toLowerCase().includes(lowerQuery) || repo.desc?.toLowerCase().includes(lowerQuery))
            .slice(0, 10)
            .forEach(repo => {
                items.push({
                    id: `repo-${repo.name}`,
                    type: 'repository',
                    title: repo.name,
                    subtitle: repo.desc,
                    icon: <Database size={16} />,
                    action: () => {
                        onSelectRepository(repo);
                        onClose();
                    },
                });
            });

        return items;
    }, [query, packages, casks, repositories, t, cmdKey, onSelectPackage, onSelectRepository, onNavigateToView, onClose]);

    useEffect(() => {
        if (open) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    useEffect(() => {
        if (selectedIndex >= commands.length) {
            setSelectedIndex(Math.max(0, commands.length - 1));
        }
    }, [commands.length, selectedIndex]);

    useEffect(() => {
        if (listRef.current && selectedIndex >= 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % commands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
        } else if (e.key === 'Enter' && commands[selectedIndex]) {
            e.preventDefault();
            commands[selectedIndex].action();
        }
    };

    if (!open) return null;

    return (
        <div 
            className="command-palette-overlay" 
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            }}
            tabIndex={-1}
        >
            <div 
                className="command-palette" 
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t('commandPalette.placeholder')}
            >
                <div className="command-palette-header">
                    <Search size={20} />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            className="command-palette-input"
                            placeholder={t('commandPalette.placeholder')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <span className="beta-tag">BETA</span>
                    </div>
                    <div className="command-palette-shortcut">
                        <kbd>{cmdKey}</kbd>
                        <kbd>K</kbd>
                    </div>
                </div>
                <div className="command-palette-results" ref={listRef}>
                    {commands.length === 0 ? (
                        <div className="command-palette-empty">
                            {t('commandPalette.noResults')}
                        </div>
                    ) : (
                        commands.map((command, index) => (
                            <button
                                key={command.id}
                                type="button"
                                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => command.action()}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        command.action();
                                    }
                                }}
                            >
                                <div className="command-palette-item-icon">
                                    {command.icon}
                                </div>
                                <div className="command-palette-item-content">
                                    <div className="command-palette-item-title">{command.title}</div>
                                    {command.subtitle && command.type !== 'view' && (
                                        <div className="command-palette-item-subtitle">{command.subtitle}</div>
                                    )}
                                </div>
                                {command.subtitle && command.type === 'view' && (
                                    <div className="command-palette-item-shortcut">
                                        {command.subtitle}
                                    </div>
                                )}
                                {index === selectedIndex && (
                                    <ArrowRight size={16} className="command-palette-item-arrow" />
                                )}
                            </button>
                        ))
                    )}
                </div>
                {commands.length > 0 && (
                    <div className="command-palette-footer">
                        <div className="command-palette-hints">
                            <span className="command-palette-hint">
                                <kbd>↩</kbd> {t('commandPalette.toSelect')}
                            </span>
                            <span className="command-palette-hint">
                                <kbd>↓</kbd> <kbd>↑</kbd> {t('commandPalette.toNavigate')}
                            </span>
                            <span className="command-palette-hint">
                                <kbd>esc</kbd> {t('commandPalette.toClose')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommandPalette;

