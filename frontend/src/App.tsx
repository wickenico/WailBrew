import React, { useState } from "react";
import "./style.css";
import "./app.css";
import {
    GetBrewPackages,
    GetBrewUpdatablePackages,
} from "../wailsjs/go/main/App";
import packageJson from "../package.json";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
}

const WailBrewApp = () => {
    const [packages, setPackages] = useState<PackageEntry[]>([]);
    const [updatablePackages, setUpdatablePackages] = useState<PackageEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "updatable">("installed");
    const [selectedPackage, setSelectedPackage] = useState<PackageEntry | null>(null);

    const fetchPackages = () => {
        setLoading(true);
        setError("");
        GetBrewPackages()
            .then((result: string[][]) => {
                const formatted = result.map(([name, installedVersion]) => ({
                    name,
                    installedVersion,
                }));
                setPackages(formatted);
                setSelectedPackage(null);
                setLoading(false);
            })
            .catch(() => {
                setError("❌ Error fetching packages!");
                setLoading(false);
            });
    };

    const fetchUpdatablePackages = () => {
        setLoading(true);
        setError("");
        GetBrewUpdatablePackages()
            .then((result: string[][]) => {
                const formatted = result.map(([name, installedVersion, latestVersion]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                }));
                setUpdatablePackages(formatted);
                setSelectedPackage(null);
                setLoading(false);
            })
            .catch(() => {
                setError("❌ Error fetching updatable packages!");
                setLoading(false);
            });
    };

    const activePackages = view === "installed" ? packages : updatablePackages;

    return (
        <div className="wailbrew-container">
            <nav className="sidebar">
                <h2 className="sidebar-title">Wailbrew</h2>
                <div className="sidebar-section">
                    <h4>Formeln</h4>
                    <ul>
                        <li
                            className={view === "installed" ? "active" : ""}
                            onClick={() => {
                                fetchPackages();
                                setView("installed");
                            }}
                        >
                            <span>📦 Installiert</span>
                            <span className="badge">{packages.length}</span>
                        </li>
                        <li
                            className={view === "updatable" ? "active" : ""}
                            onClick={() => {
                                fetchUpdatablePackages();
                                setView("updatable");
                            }}
                        >
                            <span>🔄 Veraltet</span>
                            <span className="badge">{updatablePackages.length}</span>
                        </li>
                        <li>
                            <span>📚 Alle Formeln</span>
                            <span className="badge">7877</span>
                        </li>
                        <li>
                            <span>🍃 Blätter</span>
                            <span className="badge">17</span>
                        </li>
                        <li>
                            <span>📂 Repositorys</span>
                            <span className="badge">5</span>
                        </li>
                    </ul>
                </div>
                <div className="sidebar-section">
                    <h4>Werkzeuge</h4>
                    <ul>
                        <li><span>🩺 Doctor</span></li>
                        <li><span>⬆️ Aktualisieren</span></li>
                    </ul>
                </div>
            </nav>

            <main className="content">
                <div className="header-row">
                    <h3>
                        {view === "installed"
                            ? `Installierte Formeln (${packages.length})`
                            : `Veraltete Formeln (${updatablePackages.length})`}
                    </h3>
                    <div className="search-container">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Suchen"
                            disabled
                        />
                    </div>
                </div>

                {loading && <div className="result">Lade Daten…</div>}
                {error && <div className="result error">{error}</div>}

                <div className="table-container">
                    {activePackages.length > 0 && (
                        <table className="package-table">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Version</th>
                                {view === "updatable" && <th>Aktuellste Version</th>}
                            </tr>
                            </thead>
                            <tbody>
                            {activePackages.map((pkg) => (
                                <tr
                                    key={pkg.name}
                                    className={selectedPackage?.name === pkg.name ? "selected" : ""}
                                    onClick={() => setSelectedPackage(pkg)}
                                >
                                    <td>{pkg.name}</td>
                                    <td>{pkg.installedVersion}</td>
                                    {view === "updatable" && <td>{pkg.latestVersion}</td>}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="info-footer-container">
                    <div className="package-info">
                        <p><strong>Informationen über die ausgewählte Formel</strong></p>
                        <p>Beschreibung: --</p>
                        <p>Ort: --</p>
                        <p>Version: {selectedPackage ? selectedPackage.installedVersion : "--"}</p>
                        <p>Abhängigkeiten: --</p>
                        <p>Konflikte: --</p>
                    </div>
                    <div className="package-footer">
                        Diese Formeln sind bereits auf Ihrem System installiert.
                    </div>
                </div>
            </main>
        </div>
    );
};

export default WailBrewApp;
