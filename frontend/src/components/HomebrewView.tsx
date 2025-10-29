import React from "react";
import { useTranslation } from "react-i18next";

interface HomebrewViewProps {
    homebrewLog: string;
    homebrewVersion: string;
    isUpToDate: boolean | null;
    latestVersion: string | null;
    onClearLog: () => void;
    onUpdateHomebrew: () => void;
}

const HomebrewView: React.FC<HomebrewViewProps> = ({ 
    homebrewLog, 
    homebrewVersion,
    isUpToDate,
    latestVersion,
    onClearLog, 
    onUpdateHomebrew 
}) => {
    const { t } = useTranslation();
    
    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3>{t('headers.homebrew')}</h3>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                        {t('homebrew.currentVersion')}: <strong>{homebrewVersion || t('common.loading')}</strong>
                        {isUpToDate !== null && (
                            <span style={{ marginLeft: '1rem' }}>
                                {isUpToDate ? (
                                    <span style={{ color: '#22C55E' }}>✓ {t('homebrew.upToDate')}</span>
                                ) : (
                                    <span style={{ color: '#F59E0B' }}>
                                        {t('homebrew.updateAvailable', { version: latestVersion || '' })}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
                <div className="header-actions">
                    <button className="doctor-button" onClick={onClearLog}>
                        {t('buttons.clearLog')}
                    </button>
                    <button className="doctor-button" onClick={onUpdateHomebrew}>
                        {t('buttons.updateHomebrew')}
                    </button>
                </div>
            </div>
            <pre className="doctor-log">
                {homebrewLog || t('dialogs.noHomebrewOutput')}
            </pre>
            <div className="package-footer">
                {t('footers.homebrew')}
            </div>
        </>
    );
};

export default HomebrewView;

