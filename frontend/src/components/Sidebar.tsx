/// <reference types="react" />
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2, Clock } from "lucide-react";
import appIcon from "../assets/images/appicon_256.png";
import { mapToSupportedLanguage } from "../i18n/languageUtils";

interface SidebarProps {
    view: "installed" | "casks" | "updatable" | "all" | "leaves" | "repositories" | "doctor" | "cleanup" | "settings";
    setView: (view: "installed" | "casks" | "updatable" | "all" | "leaves" | "repositories" | "doctor" | "cleanup" | "settings") => void;
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
                    {showTooltip && formatTimeUntilNextCheck && (
                        <div
                            className="background-check-tooltip"
                            style={{
                                position: "absolute",
                                top: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                marginTop: "8px",
                                padding: "4px 8px",
                                background: "rgba(30, 34, 40, 0.95)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "normal",
                                whiteSpace: "nowrap",
                                zIndex: 1000,
                                pointerEvents: "none",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                            }}
                        >
                            {formatTimeUntilNextCheck(timeUntilNextCheck)}
                        </div>
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
                    <span className="badge">{allCount}</span>
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
                <li className={view === "doctor" ? "active" : ""} onClick={() => { setView("doctor"); onClearSelection(); }}>
                    <span className="sidebar-shortcut">{cmdKey}7</span>
                    <span>🩺 {t('sidebar.doctor')}</span>
                </li>
                <li className={view === "cleanup" ? "active" : ""} onClick={() => { setView("cleanup"); onClearSelection(); }}>
                    <span className="sidebar-shortcut">{cmdKey}8</span>
                    <span>🧹 {t('sidebar.cleanup')}</span>
                </li>
            </ul>
        </div>
        <div className="sidebar-section language-switcher">
            <div className="language-dropdown-wrapper">
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
        </div>
    </nav>
    );
};

export default Sidebar; 
