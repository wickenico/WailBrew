import { CircleX, LoaderCircle, Play } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { PackageEntry } from "../types";
import { parseDoctorLogLine } from "../utils/parseDoctorLog";
import PackageInfo from "./PackageInfo";

interface DoctorViewProps {
    doctorLog: string;
    deprecatedFormulae: string[];
    selectedDeprecatedPackage: PackageEntry | null;
    loadingDetailsFor: string | null;
    runningCommand: string | null;
    onClearLog: () => void;
    onRunDoctor: () => void;
    onRunCommand: (command: string) => void;
    onSelectDeprecated: (formula: string) => void;
    onSelectDependency: (dependencyName: string) => void;
    onUninstallDeprecated: (formula: string) => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({
    doctorLog,
    deprecatedFormulae,
    selectedDeprecatedPackage,
    loadingDetailsFor,
    runningCommand,
    onClearLog,
    onRunDoctor,
    onRunCommand,
    onSelectDeprecated,
    onSelectDependency,
    onUninstallDeprecated,
}) => {
    const { t } = useTranslation();

    return (
        <>
            <div className="header-row">
                <div className="header-title">
                    <h3>{t("headers.homebrewDoctor")}</h3>
                </div>
                <div className="header-actions">
                    <button type="button" className="doctor-button" onClick={onClearLog}>
                        {t("buttons.clearLog")}
                    </button>
                    <button type="button" className="doctor-button" onClick={onRunDoctor}>
                        {t("buttons.runDoctor")}
                    </button>
                </div>
            </div>
            {deprecatedFormulae && deprecatedFormulae.length > 0 && (
                <div className="deprecated-formulae-section">
                    <div className="deprecated-formulae-header">
                        <h4>{t("headers.deprecatedFormulae")}</h4>
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
                                    type="button"
                                    className="deprecated-uninstall-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUninstallDeprecated(formula);
                                    }}
                                    title={t("buttons.uninstallDeprecated", { name: formula })}
                                >
                                    <CircleX size={18} />
                                    {t("buttons.uninstall", { name: formula })}
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
            <div className="doctor-log" role="log" aria-live="polite">
                {(doctorLog || t("dialogs.noDoctorOutput")).split("\n").map((line, lineIndex) => (
                    <div className="doctor-log-line" key={`${lineIndex}-${line}`}>
                        {parseDoctorLogLine(line).map((part, partIndex) =>
                            part.type === "command" ? (
                                <button
                                    type="button"
                                    className="doctor-command"
                                    disabled={runningCommand !== null}
                                    key={`${partIndex}-${part.value}`}
                                    onClick={() => onRunCommand(part.value)}
                                    title={t("buttons.runDoctorCommand", { command: part.value })}
                                >
                                    {runningCommand === part.value ? (
                                        <LoaderCircle className="doctor-command-spinner" size={15} />
                                    ) : (
                                        <Play size={14} fill="currentColor" />
                                    )}
                                    <code>{part.value}</code>
                                </button>
                            ) : (
                                <span key={`${partIndex}-${part.value}`}>{part.value}</span>
                            ),
                        )}
                        {line.length === 0 && "\u00a0"}
                    </div>
                ))}
            </div>
            <div className="package-footer">{t("footers.doctor")}</div>
        </>
    );
};

export default DoctorView;
