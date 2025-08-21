import React from "react";
import { useTranslation } from "react-i18next";
import appIcon from "../assets/images/appicon_256.png";

interface AboutDialogProps {
    open: boolean;
    onClose: () => void;
    appVersion: string;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ open, onClose, appVersion }) => {
    const { t } = useTranslation();
    
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
                            <p>{t('about.developedWith', { 
                                wails: '<a href="https://wails.io" target="_blank" rel="noopener noreferrer">Wails</a>',
                                interpolation: { escapeValue: false }
                            })}</p>
                        </div>
                        
                        <div className="about-info">
                            <p>{t('about.description')}</p>
                        </div>
                        
                        <div className="about-links">
                            <h4>{t('about.links')}</h4>
                            <ul>
                                <li>
                                    <a href="https://github.com/wickenico/WailBrew" target="_blank" rel="noopener noreferrer">
                                        {t('about.githubRepo')}
                                    </a>
                                </li>
                                <li>
                                    <a href="https://brew.sh" target="_blank" rel="noopener noreferrer">
                                        {t('about.homebrewWebsite')}
                                    </a>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="about-acknowledgments">
                            <h4>{t('about.acknowledgments')}</h4>
                            <p>
                                {t('about.acknowledgmentText', { 
                                    cakebrew: '<a href="https://github.com/brunophilipe/Cakebrew" target="_blank" rel="noopener noreferrer">Cakebrew</a>',
                                    interpolation: { escapeValue: false }
                                })}
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