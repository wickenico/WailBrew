import React from "react";
import { useTranslation } from "react-i18next";
import { CircleX } from "lucide-react";

interface DoctorViewProps {
    doctorLog: string;
    deprecatedFormulae: string[];
    onClearLog: () => void;
    onRunDoctor: () => void;
    onUninstallDeprecated: (formula: string) => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({ 
    doctorLog, 
    deprecatedFormulae, 
    onClearLog, 
    onRunDoctor,
    onUninstallDeprecated 
}) => {
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
            {deprecatedFormulae && deprecatedFormulae.length > 0 && (
                <div className="deprecated-formulae-section">
                    <div className="deprecated-formulae-header">
                        <h4>{t('headers.deprecatedFormulae')}</h4>
                        <span className="deprecated-count">{deprecatedFormulae.length}</span>
                    </div>
                    <div className="deprecated-formulae-list">
                        {(deprecatedFormulae || []).map((formula) => (
                            <div key={formula} className="deprecated-formula-item">
                                <span className="deprecated-formula-name">{formula}</span>
                                <button
                                    className="deprecated-uninstall-button"
                                    onClick={() => onUninstallDeprecated(formula)}
                                    title={t('buttons.uninstallDeprecated', { name: formula })}
                                >
                                    <CircleX size={18} />
                                    {t('buttons.uninstall', { name: formula })}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
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