import React from "react";
import { useTranslation } from "react-i18next";

interface DoctorViewProps {
    doctorLog: string;
    onClearLog: () => void;
    onRunDoctor: () => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({ doctorLog, onClearLog, onRunDoctor }) => {
    const { t } = useTranslation();
    
    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3>{t('headers.homebrewDoctor')}</h3>
                </div>
                <div className="header-actions">
                    <button className="doctor-button" onClick={onClearLog}>
                        {t('buttons.clearLog')}
                    </button>
                    <button className="doctor-button" onClick={onRunDoctor}>
                        {t('buttons.runDoctor')}
                    </button>
                </div>
            </div>
            <pre className="doctor-log">
                {doctorLog || t('dialogs.noDoctorOutput')}
            </pre>
            <div className="package-footer">
                {t('footers.doctor')}
            </div>
        </>
    );
};

export default DoctorView; 