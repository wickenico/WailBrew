import React, { useState, useEffect } from "react";
import "./style.css";
import "./app.css";
import {
    GetBrewPackages,
    GetBrewUpdatablePackages,
    GetBrewPackageInfo,
} from "../wailsjs/go/main/App";

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
    const [loading, setLoading] = useState<boolean>(true); // nur initial true
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "updatable">("installed");
    const [selectedPackage, setSelectedPackage] = useState<PackageEntry | null>(null);
    const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);
    const [packageCache, setPackageCache] = useState<Map<string, PackageEntry>>(new Map());

    // ⬇️ Einmal beim Start
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

    return (
        <div className="wailbrew-container">
            <nav className="sidebar">
                <h2 className="sidebar-title">Wailbrew</h2>
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

                {error && <div className="result error">{error}</div>}

                <div className="table-container">
                    {loading && (
                        <div className="table-loading-overlay">
                            <div className="spinner"></div>
                            <div className="loading-text">Formeln werden geladen…</div>
                        </div>
                    )}

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
                        <p>
                            Beschreibung:{" "}
                            {selectedPackage?.desc !== undefined
                                ? selectedPackage.desc
                                : "--"}
                        </p>
                        <p>
                            Homepage:{" "}
                            {selectedPackage?.homepage !== undefined
                                ? selectedPackage.homepage
                                : "--"}
                        </p>
                        <p>
                            Version:{" "}
                            {selectedPackage?.installedVersion !== undefined
                                ? selectedPackage.installedVersion
                                : "--"}
                        </p>
                        <p>
                            Abhängigkeiten:{" "}
                            {selectedPackage?.dependencies !== undefined
                                ? selectedPackage.dependencies.join(", ") || "--"
                                : "--"}
                        </p>
                        <p>
                            Konflikte:{" "}
                            {selectedPackage?.conflicts !== undefined
                                ? selectedPackage.conflicts.join(", ") || "--"
                                : "--"}
                        </p>
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
