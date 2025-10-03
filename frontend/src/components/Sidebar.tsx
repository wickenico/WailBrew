/// <reference types="react" />
import React from "react";
import { useTranslation } from "react-i18next";
import { SetLanguage } from "../../wailsjs/go/main/App";
import { Moon, Sun } from "lucide-react";
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
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
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
    theme,
    onToggleTheme,
}) => {
    const { t, i18n } = useTranslation();

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
    <nav className="sidebar">
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
                    <span>📦 {t('sidebar.installed')}</span>
                    <span className="badge">{packagesCount}</span>
                </li>
                <li className={view === "casks" ? "active" : ""} onClick={() => { setView("casks"); onClearSelection(); }}>
                    <span>🖥️ {t('sidebar.casks')}</span>
                    <span className="badge">{casksCount}</span>
                </li>
                <li className={view === "updatable" ? "active" : ""} onClick={() => { setView("updatable"); onClearSelection(); }}>
                    <span>🔄 {t('sidebar.outdated')}</span>
                    <span className="badge">{updatableCount}</span>
                </li>
                <li className={view === "all" ? "active" : ""} onClick={() => { setView("all"); onClearSelection(); }}>
                    <span>📚 {t('sidebar.all')}</span>
                    <span className="badge">{allCount}</span>
                </li>
                <li className={view === "leaves" ? "active" : ""} onClick={() => { setView("leaves"); onClearSelection(); }}>
                    <span>🍃 {t('sidebar.leaves')}</span>
                    <span className="badge">{leavesCount}</span>
                </li>
                <li className={view === "repositories" ? "active" : ""} onClick={() => { setView("repositories"); onClearSelection(); }}>
                    <span>📂 {t('sidebar.repositories')}</span>
                    <span className="badge">{repositoriesCount}</span>
                </li>
            </ul>
        </div>
        <div className="sidebar-section">
            <h4>{t('sidebar.tools')}</h4>
            <ul>
                <li className={view === "doctor" ? "active" : ""} onClick={() => { setView("doctor"); onClearSelection(); }}>
                    <span>🩺 {t('sidebar.doctor')}</span>
                </li>
                <li className={view === "cleanup" ? "active" : ""} onClick={() => { setView("cleanup"); onClearSelection(); }}>
                    <span>🧹 {t('sidebar.cleanup')}</span>
                </li>
                <li className={view === "settings" ? "active" : ""} onClick={() => { setView("settings"); onClearSelection(); }}>
                    <span>⚙️ {t('sidebar.settings')}</span>
                </li>
            </ul>
        </div>
        <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                <button
                    onClick={onToggleTheme}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        padding: '10px',
                        cursor: 'pointer',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all var(--transition)',
                        width: '42px',
                        height: '42px',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(80, 180, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
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
            </ul>
        </div>
    </nav>
    );
};

export default Sidebar; 