/// <reference types="react" />
import React from "react";
import { useTranslation } from "react-i18next";
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
        <div className="sidebar-section language-switcher" style={{ marginTop: 'auto', paddingTop: '8px' }}>
            <ul style={{ display: 'flex', gap: '8px', justifyContent: 'center', padding: '0' }}>
                <li 
                    className={i18n.language === 'en' ? 'active' : ''} 
                    onClick={() => changeLanguage('en')}
                    style={{ flex: '0 0 auto', minWidth: 'auto', padding: '6px 10px', cursor: 'pointer' }}
                    title={t('language.english')}
                >
                    <span>🇺🇸</span>
                </li>
                <li 
                    className={i18n.language === 'de' ? 'active' : ''} 
                    onClick={() => changeLanguage('de')}
                    style={{ flex: '0 0 auto', minWidth: 'auto', padding: '6px 10px', cursor: 'pointer' }}
                    title={t('language.german')}
                >
                    <span>🇩🇪</span>
                </li>
                <li 
                    className={i18n.language === 'fr' ? 'active' : ''} 
                    onClick={() => changeLanguage('fr')}
                    style={{ flex: '0 0 auto', minWidth: 'auto', padding: '6px 10px', cursor: 'pointer' }}
                    title={t('language.french')}
                >
                    <span>🇫🇷</span>
                </li>
                <li 
                    className={i18n.language === 'tr' ? 'active' : ''} 
                    onClick={() => changeLanguage('tr')}
                    style={{ flex: '0 0 auto', minWidth: 'auto', padding: '6px 10px', cursor: 'pointer' }}
                    title={t('language.turkish')}
                >
                    <span>🇹🇷</span>
                </li>
                <li 
                    className={i18n.language === 'zhCN' ? 'active' : ''} 
                    onClick={() => changeLanguage('zhCN')}
                    style={{ flex: '0 0 auto', minWidth: 'auto', padding: '6px 10px', cursor: 'pointer' }}
                    title={t('language.simplified_chinese')}
                >
                    <span>🇨🇳</span>
                </li>
            </ul>
        </div>
    </nav>
    );
};

export default Sidebar; 