/// <reference types="react" />
import { ChevronDown, Clock, Loader2 } from "lucide-react";
import React, { useRef, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import appIcon from "../assets/images/appicon_256.png";
import { mapToSupportedLanguage } from "../i18n/languageUtils";
import ThemeToggle from "./ThemeToggle";

interface SidebarProps {
    view: "installed" | "casks" | "updatable" | "all" | "leaves" | "repositories" | "homebrew" | "doctor" | "cleanup" | "settings";
    setView: (view: "installed" | "casks" | "updatable" | "all" | "leaves" | "repositories" | "homebrew" | "doctor" | "cleanup" | "settings") => void;
    packagesCount: number;
    casksCount: number;
    updatableCount: number;
    allCount: number;
    leavesCount: number;
    repositoriesCount: number;
    onClearSelection: () => void;
    sidebarWidth?: number;
    sidebarRef?: React.RefObject<HTMLElement | null>;
    isBackgroundCheckRunning?: boolean;
    timeUntilNextCheck?: number;
    formatTimeUntilNextCheck?: (seconds: number) => string;
}

const Sidebar: React.FC<SidebarProps> = ({
    view,
    setView,
    packagesCount,
    casksCount,
    updatableCount,
    allCount,
    leavesCount,
    repositoriesCount,
    onClearSelection,
    sidebarWidth,
    sidebarRef,
    isBackgroundCheckRunning = false,
    timeUntilNextCheck = 0,
    formatTimeUntilNextCheck,
}) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = mapToSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const iconRef = useRef<HTMLDivElement>(null);

    // Update tooltip position when showing
    useEffect(() => {
        if (showTooltip && iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
            });
        }
    }, [showTooltip]);

    // Detect if user is on Mac
    const isMac = typeof navigator !== 'undefined' &&
        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'));
    const cmdKey = isMac ? '⌘' : 'Ctrl+';

    const changeLanguage = async (lng: string) => {
        const normalized = mapToSupportedLanguage(lng);
        try {
            await i18n.changeLanguage(normalized);
        } catch (error) {
            console.error('Failed to change frontend language:', error);
        }
    };

    // Language options with flags
    const languageOptions = {
        en: { flag: '🇺🇸', name: t('language.english') },
        de: { flag: '🇩🇪', name: t('language.german') },
        fr: { flag: '🇫🇷', name: t('language.french') },
        tr: { flag: '🇹🇷', name: t('language.turkish') },
        zhCN: { flag: '🇨🇳', name: t('language.simplified_chinese') },
        zhTW: { flag: '🇹🇼', name: t('language.traditional_chinese') },
        pt_BR: { flag: '🇧🇷', name: t('language.brazilian_portuguese') },
        ru: { flag: '🇷🇺', name: t('language.russian') },
        ko: { flag: '🇰🇷', name: t('language.korean') },
        he: { flag: '🇮🇱', name: t('language.hebrew') },
    };

    return (
        <nav
            className="sidebar"
            ref={sidebarRef}
            style={sidebarWidth ? { width: `${sidebarWidth}px` } : undefined}
        >
            <div className="sidebar-title">
                <img
                    src={appIcon}
                    alt="Logo"
                    style={{ width: "28px", height: "28px", marginRight: "8px", verticalAlign: "middle" }}
                />
                WailBrew
                {isBackgroundCheckRunning !== undefined && (
                    <div
                        ref={iconRef}
                        className="background-check-icon"
                        style={{
                            position: "relative",
                            display: "inline-block",
                            marginLeft: "8px",
                            verticalAlign: "middle",
                        }}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        {isBackgroundCheckRunning ? (
                            <Loader2
                                size={16}
                                style={{
                                    color: "#3B82F6",
                                    animation: "spin 1s linear infinite"
                                }}
                            />
                        ) : (
                            <Clock
                                size={16}
                                style={{
                                    color: "#3B82F6",
                                    opacity: 0.7,
                                }}
                            />
                        )}
                        {showTooltip && formatTimeUntilNextCheck && ReactDOM.createPortal(
                                <div
                                    className="background-check-tooltip"
                                    style={{
                                        position: "fixed",
                                        top: tooltipPosition.top,
                                        left: tooltipPosition.left,
                                        transform: "translateX(-50%)",
                                        zIndex: 99999,
                                    }}
                                >
                                    {formatTimeUntilNextCheck(timeUntilNextCheck)}
                                </div>,
                                document.body
                            )}
                        </div>
                    )}
                </div>
            <div className="sidebar-section">
                <h4>{t('sidebar.formulas')}</h4>
                <ul>
                    <li className={view === "installed" ? "active" : ""} onClick={() => { setView("installed"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}1</span>
                        <span>📦 {t('sidebar.installed')}</span>
                        <span className="badge">{packagesCount}</span>
                    </li>
                    <li className={view === "casks" ? "active" : ""} onClick={() => { setView("casks"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}2</span>
                        <span>🖥️ {t('sidebar.casks')}</span>
                        <span className="badge">{casksCount}</span>
                    </li>
                    <li className={view === "updatable" ? "active" : ""} onClick={() => { setView("updatable"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}3</span>
                        <span>🔄 {t('sidebar.outdated')}</span>
                        <span className="badge">{updatableCount}</span>
                    </li>
                    <li className={view === "all" ? "active" : ""} onClick={() => { setView("all"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}4</span>
                        <span>📚 {t('sidebar.all')}</span>
                        <span className="badge">{allCount === -1 ? "—" : allCount}</span>
                    </li>
                    <li className={view === "leaves" ? "active" : ""} onClick={() => { setView("leaves"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}5</span>
                        <span>🍃 {t('sidebar.leaves')}</span>
                        <span className="badge">{leavesCount}</span>
                    </li>
                    <li className={view === "repositories" ? "active" : ""} onClick={() => { setView("repositories"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}6</span>
                        <span>📂 {t('sidebar.repositories')}</span>
                        <span className="badge">{repositoriesCount}</span>
                    </li>
                </ul>
            </div>
            <div className="sidebar-section">
                <h4>{t('sidebar.tools')}</h4>
                <ul>
                    <li className={view === "homebrew" ? "active" : ""} onClick={() => { setView("homebrew"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}7</span>
                        <span>🍺 {t('sidebar.homebrew')}</span>
                    </li>
                    <li className={view === "doctor" ? "active" : ""} onClick={() => { setView("doctor"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}8</span>
                        <span>🩺 {t('sidebar.doctor')}</span>
                    </li>
                    <li className={view === "cleanup" ? "active" : ""} onClick={() => { setView("cleanup"); onClearSelection(); }}>
                        <span className="sidebar-shortcut">{cmdKey}9</span>
                        <span>🧹 {t('sidebar.cleanup')}</span>
                    </li>
                </ul>
            </div>
            <div className="sidebar-section keyboard-hints">
                <div className="keyboard-hint">
                    <span className="keyboard-hint-label">{t('sidebar.refresh')}</span>
                    <span className="keyboard-hint-shortcut">{cmdKey}⇧R</span>
                </div>
                <div className="keyboard-hint">
                    <span className="keyboard-hint-label">{t('sidebar.commandPalette')}</span>
                    <span className="keyboard-hint-shortcut">{cmdKey}K</span>
                </div>
            </div>
            <div className="sidebar-section language-switcher">
                <div className="language-dropdown-wrapper">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <select
                                className="language-dropdown"
                                value={currentLanguage}
                                onChange={(e) => changeLanguage(e.target.value)}
                                aria-label={t('language.switchLanguage')}
                            >
                                {Object.entries(languageOptions).map(([code, { flag, name }]) => (
                                    <option key={code} value={code}>
                                        {flag} {name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="language-dropdown-arrow" size={16} strokeWidth={2} />
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Sidebar;
