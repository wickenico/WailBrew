import React from "react";
import { useTranslation } from "react-i18next";

interface CleanupViewProps {
    cleanupLog: string;
    onClearLog: () => void;
    onRunCleanup: () => void;
}

const CleanupView: React.FC<CleanupViewProps> = ({ cleanupLog, onClearLog, onRunCleanup }) => {
    const { t } = useTranslation();
    
    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3>{t('headers.homebrewCleanup')}</h3>
                </div>
                <div className="header-actions">
                    <button className="doctor-button" onClick={onClearLog}>
                        {t('buttons.clearLog')}
                    </button>
                    <button className="doctor-button" onClick={onRunCleanup}>
                        {t('buttons.runCleanup')}
                    </button>
                </div>
            </div>
            <pre className="doctor-log">
                {cleanupLog || t('dialogs.noCleanupOutput')}
            </pre>
            <div className="package-footer">
                {t('footers.cleanup')}
            </div>
        </>
    );
};

export default CleanupView;
