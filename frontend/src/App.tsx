import React, { useState, useEffect } from "react";
import "./style.css";
import "./app.css";
import {
    GetBrewPackages,
    GetBrewUpdatablePackages,
    GetBrewPackageInfo,
    RemoveBrewPackage,
    UpdateBrewPackage,
} from "../wailsjs/go/main/App";
import appIcon from "./assets/images/appicon_256.png";
import packageJson from "../package.json";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
}

const WailBrewApp = () => {
    const [packages, setPackages] = useState<PackageEntry[]>([]);
    const [updatablePackages, setUpdatablePackages] = useState<PackageEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "updatable">("installed");
    const [selectedPackage, setSelectedPackage] = useState<PackageEntry | null>(null);
    const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);
    const [packageCache, setPackageCache] = useState<Map<string, PackageEntry>>(new Map());
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showConfirm, setShowConfirm] = useState<boolean>(false);
    const [showUpdateConfirm, setShowUpdateConfirm] = useState<boolean>(false);
    const [updateLogs, setUpdateLogs] = useState<string | null>(null);
    const appVersion = packageJson.version;

    useEffect(() => {
        setLoading(true);
        Promise.all([GetBrewPackages(), GetBrewUpdatablePackages()])
            .then(([installed, updatable]) => {
                const installedFormatted = installed.map(([name, installedVersion]) => ({
                    name,
                    installedVersion,
                }));
                const updatableFormatted = updatable.map(([name, installedVersion, latestVersion]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                }));
                setPackages(installedFormatted);
                setUpdatablePackages(updatableFormatted);
                setLoading(false);
            })
            .catch(() => {
                setError("❌ Fehler beim Laden der Formeln!");
                setLoading(false);
            });
    }, []);

    const activePackages = view === "installed" ? packages : updatablePackages;

    const filteredPackages = activePackages.filter((pkg) =>
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = async (pkg: PackageEntry) => {
        setSelectedPackage(pkg);

        if (packageCache.has(pkg.name)) {
            setSelectedPackage(packageCache.get(pkg.name)!);
            return;
        }

        setLoadingDetailsFor(pkg.name);
        const info = await GetBrewPackageInfo(pkg.name);

        const enriched: PackageEntry = {
            ...pkg,
            desc: (info["desc"] as string) || "--",
            homepage: (info["homepage"] as string) || "--",
            dependencies: (info["dependencies"] as string[]) || [],
            conflicts: (info["conflicts_with"] as string[]) || [],
        };

        setPackageCache(new Map(packageCache.set(pkg.name, enriched)));
        setSelectedPackage(enriched);
        setLoadingDetailsFor(null);
    };

    const handleRemoveConfirmed = async () => {
        if (!selectedPackage) return;
        setShowConfirm(false);
        setLoading(true);
        const result = await RemoveBrewPackage(selectedPackage.name);
        alert(result);

        const updated = await GetBrewPackages();
        const formatted = updated.map(([name, installedVersion]) => ({
            name,
            installedVersion,
        }));
        setPackages(formatted);
        setSelectedPackage(null);
        setLoading(false);
    };

    const handleUpdateConfirmed = async () => {
        if (!selectedPackage) return;
        setShowUpdateConfirm(false);

        // Zuerst das Log-Fenster anzeigen, aber leer
        setUpdateLogs(`Aktualisiere "${selectedPackage.name}"...\nBitte warten...`);

        // Starte das Update
        const result = await UpdateBrewPackage(selectedPackage.name);

        // Ersetze den Inhalt durch das echte Log
        setUpdateLogs(result);

        // (optional) Nach dem Update die Liste aktualisieren
        const updated = await GetBrewUpdatablePackages();
        const formatted = updated.map(([name, installedVersion, latestVersion]) => ({
            name,
            installedVersion,
            latestVersion,
        }));
        setUpdatablePackages(formatted);
    };

    return (
        <div className="wailbrew-container">
            <nav className="sidebar">
                <div className="sidebar-title">
                    <img
                        src={appIcon}
                        alt="Logo"
                        style={{
                            width: "28px",
                            height: "28px",
                            marginRight: "8px",
                            verticalAlign: "middle",
                        }}
                    />
                    Wailbrew
                </div>
                <div className="sidebar-section">
                    <h4>Formeln</h4>
                    <ul>
                        <li
                            className={view === "installed" ? "active" : ""}
                            onClick={() => setView("installed")}
                        >
                            <span>📦 Installiert</span>
                            <span className="badge">{packages.length}</span>
                        </li>
                        <li
                            className={view === "updatable" ? "active" : ""}
                            onClick={() => setView("updatable")}
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
                <div style={{ marginTop: "20px", marginBottom: "10px", fontSize: "10px", color: "#777", paddingTop: "1px" }}>
                    Version {appVersion}
                </div>
            </nav>

            <main className="content">
                <div className="header-row">
                    <h3>
                        {view === "installed"
                            ? `Installierte Formeln (${packages.length})`
                            : `Veraltete Formeln (${updatablePackages.length})`}
                    </h3>

                    {selectedPackage && view === "installed" && (
                        <button
                            className="trash-button"
                            onClick={() => setShowConfirm(true)}
                            title={`"${selectedPackage.name}" deinstallieren`}
                        >
                            ❌️
                        </button>
                    )}

                    {selectedPackage && view === "updatable" && (
                        <button
                            className="trash-button"
                            onClick={() => setShowUpdateConfirm(true)}
                            title={`"${selectedPackage.name}" aktualisieren`}
                        >
                            🔄
                        </button>
                    )}

                    <div className="search-container">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Suchen"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <span
                                className="clear-icon"
                                onClick={() => setSearchQuery("")}
                                title="Suche zurücksetzen"
                            >
                                ✕
                            </span>
                        )}
                    </div>
                </div>

                {error && <div className="result error">{error}</div>}

                <div className="table-container">
                    {loading && (
                        <div className="table-loading-overlay">
                            <div className="spinner"></div>
                            <div className="loading-text">Formeln werden geladen…</div>
                        </div>
                    )}

                    {filteredPackages.length > 0 && (
                        <table className="package-table">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Version</th>
                                {view === "updatable" && <th>Aktuellste Version</th>}
                            </tr>
                            </thead>
                            <tbody>
                            {filteredPackages.map((pkg) => (
                                <tr
                                    key={pkg.name}
                                    className={selectedPackage?.name === pkg.name ? "selected" : ""}
                                    onClick={() => handleSelect(pkg)}
                                >
                                    <td>{pkg.name}</td>
                                    <td>{pkg.installedVersion}</td>
                                    {view === "updatable" && <td>{pkg.latestVersion}</td>}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}

                    {!loading && filteredPackages.length === 0 && (
                        <div className="result">Keine passenden Ergebnisse.</div>
                    )}
                </div>

                <div className="info-footer-container">
                    <div className="package-info">
                        <p>
                            <strong>{selectedPackage?.name || "Kein Paket ausgewählt"}</strong>{" "}
                            {loadingDetailsFor === selectedPackage?.name && (
                                <span style={{ fontSize: "12px", color: "#888" }}>
                                    (Lade…)
                                </span>
                            )}
                        </p>
                        <p>Beschreibung: {selectedPackage?.desc || "--"}</p>
                        <p>Homepage: {selectedPackage?.homepage || "--"}</p>
                        <p>Version: {selectedPackage?.installedVersion || "--"}</p>
                        <p>Abhängigkeiten: {selectedPackage?.dependencies?.join(", ") || "--"}</p>
                        <p>Konflikte: {selectedPackage?.conflicts?.join(", ") || "--"}</p>
                    </div>
                    <div className="package-footer">
                        {view === "installed" && "Diese Formeln sind bereits auf Ihrem System installiert."}
                        {view === "updatable" && "Einige Formeln können aktualisiert werden."}
                    </div>
                </div>

                {showConfirm && (
                    <div className="confirm-overlay">
                        <div className="confirm-box">
                            <p>
                                Möchten Sie <strong>{selectedPackage?.name}</strong> wirklich deinstallieren?
                            </p>
                            <div className="confirm-actions">
                                <button onClick={handleRemoveConfirmed}>Ja, deinstallieren</button>
                                <button onClick={() => setShowConfirm(false)}>Abbrechen</button>
                            </div>
                        </div>
                    </div>
                )}

                {showUpdateConfirm && (
                    <div className="confirm-overlay">
                        <div className="confirm-box">
                            <p>
                                Möchten Sie <strong>{selectedPackage?.name}</strong> wirklich aktualisieren?
                            </p>
                            <div className="confirm-actions">
                                <button onClick={handleUpdateConfirmed}>Ja, aktualisieren</button>
                                <button onClick={() => setShowUpdateConfirm(false)}>Abbrechen</button>
                            </div>
                        </div>
                    </div>
                )}

                {updateLogs && (
                    <div className="confirm-overlay">
                        <div className="confirm-box" style={{ maxWidth: "700px" }}>
                            <p>
                                <strong>Aktualisiere Formel: {selectedPackage?.name}</strong>
                            </p>
                            <pre style={{
                                textAlign: "left",
                                background: "#111",
                                color: "#ccc",
                                padding: "10px",
                                borderRadius: "4px",
                                maxHeight: "400px",
                                overflowY: "auto"
                            }}>
                                {updateLogs}
                            </pre>
                            <div className="confirm-actions">
                                <button onClick={() => setUpdateLogs(null)}>Ok</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WailBrewApp;
