/// <reference types="react" />
import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { SetLanguage } from "../../wailsjs/go/main/App";
import appIcon from "../assets/images/appicon_256.png";

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
}) => {
    const { t, i18n } = useTranslation();
    
    // Detect if user is on Mac
    const isMac = typeof navigator !== 'undefined' && 
        (navigator.userAgent.includes('Mac') || navigator.userAgent.includes('macOS'));
    const cmdKey = isMac ? '⌘' : 'Ctrl+';

    const changeLanguage = async (lng: string) => {
        i18n.changeLanguage(lng);
        // Also update the backend menu language
        try {
            await SetLanguage(lng);
        } catch (error) {
            console.error('Failed to update backend language:', error);
        }
    };

    // Language options with flags
    const languageOptions = {
        en: { flag: '🇺🇸', name: t('language.english') },
        de: { flag: '🇩🇪', name: t('language.german') },
        fr: { flag: '🇫🇷', name: t('language.french') },
        tr: { flag: '🇹🇷', name: t('language.turkish') },
        zhCN: { flag: '🇨🇳', name: t('language.simplified_chinese') },
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
                <li className={view === "settings" ? "active" : ""} onClick={() => { setView("settings"); onClearSelection(); }}>
                    <span className="sidebar-shortcut">{cmdKey}9</span>
                    <span>⚙️ {t('sidebar.settings')}</span>
                </li>
            </ul>
        </div>
        <div className="sidebar-section language-switcher">
            <div className="language-dropdown-wrapper">
                <select 
                    className="language-dropdown"
                    value={i18n.language}
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