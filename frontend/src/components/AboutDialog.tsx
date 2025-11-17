import React from "react";
import { useTranslation } from "react-i18next";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import appIcon from "../assets/images/appicon_256.png";

interface AboutDialogProps {
    open: boolean;
    onClose: () => void;
    appVersion: string;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ open, onClose, appVersion }) => {
    const { t } = useTranslation();
    
    const handleLinkClick = (url: string) => {
        BrowserOpenURL(url);
    };

    const handleKeyDown = (e: React.KeyboardEvent, url: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            BrowserOpenURL(url);
        }
    };
    
    if (!open) return null;

    return (
        <div className="about-overlay" onClick={onClose}>
            <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="about-header">
                    <h2>{t('about.title')}</h2>
                </div>
                
                <div className="about-content">
                    <div className="about-app-section">
                        <h1>{t('about.appName')}</h1>
                        <p className="about-version">v{appVersion}</p>
                        
                        <div className="about-icon">
                            <img src={appIcon} alt="WailBrew" />
                        </div>
                        
                        <div className="about-description">
                            <h3>{t('about.subtitle')}</h3>
                            <p>{t('about.createdBy')}</p>
                            <p>
                                Developed with{' '}
                                <span 
                                    className="clickable-link"
                                    onClick={() => handleLinkClick("https://wails.io")}
                                    onKeyDown={(e) => handleKeyDown(e, "https://wails.io")}
                                    role="button"
                                    tabIndex={0}
                                >
                                    Wails
                                </span>
                                {' '}and React
                            </p>
                        </div>
                        
                        <div className="about-info">
                            <p>{t('about.description')}</p>
                        </div>
                        
                        <div className="about-links">
                            <h4>{t('about.links')}</h4>
                            <ul>
                                <li>
                                    <span 
                                        className="clickable-link"
                                        onClick={() => handleLinkClick("https://wailbrew.app")}
                                        onKeyDown={(e) => handleKeyDown(e, "https://wailbrew.app")}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {t('about.wailbrewWebsite')}
                                    </span>
                                </li>
                                <li>
                                    <span 
                                        className="clickable-link"
                                        onClick={() => handleLinkClick("https://github.com/wickenico/WailBrew")}
                                        onKeyDown={(e) => handleKeyDown(e, "https://github.com/wickenico/WailBrew")}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {t('about.githubRepo')}
                                    </span>
                                </li>
                                <li>
                                    <span 
                                        className="clickable-link"
                                        onClick={() => handleLinkClick("https://brew.sh")}
                                        onKeyDown={(e) => handleKeyDown(e, "https://brew.sh")}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        {t('about.homebrewWebsite')}
                                    </span>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="about-acknowledgments">
                            <h4>{t('about.acknowledgments')}</h4>
                            <p>
                                Inspired by{' '}
                                <span 
                                    className="clickable-link"
                                    onClick={() => handleLinkClick("https://github.com/brunophilipe/Cakebrew")}
                                    onKeyDown={(e) => handleKeyDown(e, "https://github.com/brunophilipe/Cakebrew")}
                                    role="button"
                                    tabIndex={0}
                                >
                                    Cakebrew
                                </span>
                                {' '}by Bruno Philipe.
                                <br />
                                Thanks for the great work on the original Homebrew GUI!
                            </p>
                        </div>
                        
                        <div className="about-translations">
                            <h4>{t('about.translationTitle')}</h4>
                            <p>{t('about.translationThanks')}</p>
                            <p className="about-contributors">
                                egesucu, ultrazg, viniciusmi00, appleboy
                            </p>
                            <p style={{ marginTop: '12px' }}>
                                <span 
                                    className="clickable-link"
                                    onClick={() => handleLinkClick("https://github.com/wickenico/WailBrew/discussions/129")}
                                    onKeyDown={(e) => handleKeyDown(e, "https://github.com/wickenico/WailBrew/discussions/129")}
                                    role="button"
                                    tabIndex={0}
                                >
                                    {t('about.improveTranslations')}
                                </span>
                            </p>
                        </div>
                        
                        <div className="about-copyright">
                            <p>{t('about.copyright')}</p>
                        </div>
                    </div>
                </div>
                
                <div className="about-footer">
                    <button onClick={onClose} className="about-close-button">
                        {t('buttons.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AboutDialog; 