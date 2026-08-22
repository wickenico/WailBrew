import React from "react";
import { useTranslation } from "react-i18next";
import { CircleX } from "lucide-react";
import PackageInfo from "./PackageInfo";
import type { PackageEntry } from "../types";

interface DoctorViewProps {
    doctorLog: string;
    deprecatedFormulae: string[];
    selectedDeprecatedPackage: PackageEntry | null;
    loadingDetailsFor: string | null;
    onClearLog: () => void;
    onRunDoctor: () => void;
    onSelectDeprecated: (formula: string) => void;
    onSelectDependency: (dependencyName: string) => void;
    onUninstallDeprecated: (formula: string) => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({ 
    doctorLog, 
    deprecatedFormulae, 
    selectedDeprecatedPackage,
    loadingDetailsFor,
    onClearLog, 
    onRunDoctor,
    onSelectDeprecated,
    onSelectDependency,
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
                            <div
                                key={formula}
                                className={`deprecated-formula-item ${selectedDeprecatedPackage?.name === formula ? "selected" : ""}`}
                                onClick={() => onSelectDeprecated(formula)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelectDeprecated(formula);
                                    }
                                }}
                            >
                                <span className="deprecated-formula-name">{formula}</span>
                                <button
                                    className="deprecated-uninstall-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUninstallDeprecated(formula);
                                    }}
                                    title={t('buttons.uninstallDeprecated', { name: formula })}
                                >
                                    <CircleX size={18} />
                                    {t('buttons.uninstall', { name: formula })}
                                </button>
                            </div>
                        ))}
                    </div>
                    {selectedDeprecatedPackage && (
                        <div className="doctor-package-info">
                            <PackageInfo
                                packageEntry={selectedDeprecatedPackage}
                                loadingDetailsFor={loadingDetailsFor}
                                view="installed"
                                onSelectDependency={onSelectDependency}
                            />
                        </div>
                    )}
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
