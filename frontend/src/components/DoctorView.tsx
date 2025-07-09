import React from "react";

interface DoctorViewProps {
    doctorLog: string;
    onClearLog: () => void;
    onRunDoctor: () => void;
}

const DoctorView: React.FC<DoctorViewProps> = ({ doctorLog, onClearLog, onRunDoctor }) => (
    <>
        <div className="header-row">
            <div className="header-title">
                <h3>Homebrew Doctor</h3>
            </div>
            <div className="header-actions">
                <button className="doctor-button" onClick={onClearLog}>
                    Log leeren
                </button>
                <button className="doctor-button" onClick={onRunDoctor}>
                    Doctor ausführen
                </button>
            </div>
        </div>
        <pre className="doctor-log">
            {doctorLog || "Noch keine Ausgabe. Klicken Sie auf „Doctor ausführen“."}
        </pre>
        <div className="package-footer">
            Doctor ist ein Feature von Homebrew, welches die häufigsten Fehlerursachen erkennen kann.
        </div>
    </>
);

export default DoctorView; 