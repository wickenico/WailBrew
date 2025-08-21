import React from "react";
import { useTranslation } from "react-i18next";
import { SetLanguage } from "../../wailsjs/go/main/App";
import appIcon from "../assets/images/appicon_256.png";

interface SidebarProps {
    view: "installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor";
    setView: (view: "installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor") => void;
    packagesCount: number;
    updatableCount: number;
    allCount: number;
    leavesCount: number;
    repositoriesCount: number;
    appVersion: string;
    onClearSelection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    view,
    setView,
    packagesCount,
    updatableCount,
    allCount,
    leavesCount,
    repositoriesCount,
    appVersion,
    onClearSelection,
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
        <div className="version-badge">
            v{appVersion}
        </div>
        <div className="sidebar-section">
            <h4>{t('sidebar.formulas')}</h4>
            <ul>
                <li className={view === "installed" ? "active" : ""} onClick={() => { setView("installed"); onClearSelection(); }}>
                    <span>📦 {t('sidebar.installed')}</span>
                    <span className="badge">{packagesCount}</span>
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
            </ul>
        </div>
        <div className="sidebar-section language-switcher">
            <h4>{t('language.switchLanguage')}</h4>
            <ul>
                <li 
                    className={i18n.language === 'en' ? 'active' : ''} 
                    onClick={() => changeLanguage('en')}
                >
                    <span>🇺🇸 {t('language.english')}</span>
                </li>
                <li 
                    className={i18n.language === 'de' ? 'active' : ''} 
                    onClick={() => changeLanguage('de')}
                >
                    <span>🇩🇪 {t('language.german')}</span>
                </li>
            </ul>
        </div>
    </nav>
    );
};

export default Sidebar; 