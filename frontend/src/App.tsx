import React, { useState, useEffect } from "react";
import "./style.css";
import "./App.css";
import {
    GetBrewPackages,
    GetBrewUpdatablePackages,
    GetBrewPackageInfo,
    GetBrewPackageInfoAsJson,
    RemoveBrewPackage,
    UpdateBrewPackage,
    RunBrewDoctor,
    GetAllBrewPackages,
    GetBrewLeaves,
    GetBrewTaps,
} from "../wailsjs/go/main/App";
import appIcon from "./assets/images/appicon_256.png";
import packageJson from "../package.json";
import { EventsOn } from "../wailsjs/runtime";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
    isInstalled?: boolean;
}

interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
}

const WailBrewApp = () => {
    const [packages, setPackages] = useState<PackageEntry[]>([]);
    const [updatablePackages, setUpdatablePackages] = useState<PackageEntry[]>([]);
    const [allPackages, setAllPackages] = useState<PackageEntry[]>([]);
    const [leavesPackages, setLeavesPackages] = useState<PackageEntry[]>([]);
    const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor">("installed");
    const [selectedPackage, setSelectedPackage] = useState<PackageEntry | null>(null);
    const [selectedRepository, setSelectedRepository] = useState<RepositoryEntry | null>(null);
    const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);
    const [packageCache, setPackageCache] = useState<Map<string, PackageEntry>>(new Map());
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showConfirm, setShowConfirm] = useState<boolean>(false);
    const [showUpdateConfirm, setShowUpdateConfirm] = useState<boolean>(false);
    const [updateLogs, setUpdateLogs] = useState<string | null>(null);
    const [infoLogs, setInfoLogs] = useState<string | null>(null);
    const [doctorLog, setDoctorLog] = useState<string>("");
    const appVersion = packageJson.version;

    useEffect(() => {
        setLoading(true);
        Promise.all([GetBrewPackages(), GetBrewUpdatablePackages(), GetAllBrewPackages(), GetBrewLeaves(), GetBrewTaps()])
            .then(([installed, updatable, all, leaves, repos]) => {
                const installedFormatted = installed.map(([name, installedVersion]) => ({
                    name,
                    installedVersion,
                    isInstalled: true,
                }));
                const updatableFormatted = updatable.map(([name, installedVersion, latestVersion]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    isInstalled: true,
                }));
                const installedNames = new Set(installedFormatted.map(pkg => pkg.name));
                const allFormatted = all.map(([name]) => ({
                    name,
                    installedVersion: "",
                    isInstalled: installedNames.has(name),
                }));

                // Format leaves packages with their versions from installed packages
                const installedMap = new Map(installedFormatted.map(pkg => [pkg.name, pkg.installedVersion]));
                const leavesFormatted = leaves.map((name) => ({
                    name,
                    installedVersion: installedMap.get(name) || "Unknown",
                    isInstalled: true,
                }));

                // Format repositories
                const reposFormatted = repos.map(([name, status]) => ({
                    name,
                    status,
                    desc: "--",
                }));

                setPackages(installedFormatted);
                setUpdatablePackages(updatableFormatted);
                setAllPackages(allFormatted);
                setLeavesPackages(leavesFormatted);
                setRepositories(reposFormatted);
                setLoading(false);
            })
            .catch(() => {
                setError("❌ Fehler beim Laden der Formeln!");
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const unlisten = EventsOn("setView", (data) => {
            setView(data as any);
            setSelectedPackage(null);
            setSelectedRepository(null);
        });
        const unlistenRefresh = EventsOn("refreshPackages", () => {
            window.location.reload();
        });
        return () => {
            unlisten();
            unlistenRefresh();
        };
    }, []);

    const getActivePackages = () => {
        switch (view) {
            case "installed":
                return packages;
            case "updatable":
                return updatablePackages;
            case "all":
                return allPackages;
            case "leaves":
                return leavesPackages;
            default:
                return [];
        }
    };

    const getActiveRepositories = () => {
        return repositories;
    };

    const activePackages = getActivePackages();
    const activeRepositories = getActiveRepositories();

    const filteredPackages = activePackages.filter((pkg) =>
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredRepositories = activeRepositories.filter((repo) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = async (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setSelectedRepository(null);

        if (packageCache.has(pkg.name)) {
            setSelectedPackage(packageCache.get(pkg.name)!);
            return;
        }

        setLoadingDetailsFor(pkg.name);
        const info = await GetBrewPackageInfoAsJson(pkg.name);

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

    const handleRepositorySelect = (repo: RepositoryEntry) => {
        setSelectedRepository(repo);
        setSelectedPackage(null);
    };

    const handleRemoveConfirmed = async () => {
        if (!selectedPackage) return;
        setShowConfirm(false);
        setLoading(true);
        const result = await RemoveBrewPackage(selectedPackage.name);
        alert(result);

        // Refresh all package lists
        const [updated, leaves] = await Promise.all([GetBrewPackages(), GetBrewLeaves()]);
        const formatted = updated.map(([name, installedVersion]) => ({
            name,
            installedVersion,
            isInstalled: true,
        }));
        const installedMap = new Map(formatted.map(pkg => [pkg.name, pkg.installedVersion]));
        const leavesFormatted = leaves.map((name) => ({
            name,
            installedVersion: installedMap.get(name) || "Unknown",
            isInstalled: true,
        }));

        setPackages(formatted);
        setLeavesPackages(leavesFormatted);
        setSelectedPackage(null);
        setLoading(false);
    };

    const handleUpdateConfirmed = async () => {
        if (!selectedPackage) return;
        setShowUpdateConfirm(false);
        setUpdateLogs(`Aktualisiere "${selectedPackage.name}"...\nBitte warten...`);

        const result = await UpdateBrewPackage(selectedPackage.name);
        setUpdateLogs(result);

        const updated = await GetBrewUpdatablePackages();
        const formatted = updated.map(([name, installedVersion, latestVersion]) => ({
            name,
            installedVersion,
            latestVersion,
            isInstalled: true,
        }));
        setUpdatablePackages(formatted);
    };

    const handleShowInfoLogs = async (pkg: PackageEntry) => {
        if (!pkg) return;

        setInfoLogs(`Hole Informationen für "${pkg.name}"...\nBitte warten...`);

        const info = await GetBrewPackageInfo(pkg.name);

        setInfoLogs(info);
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
                    WailBrew
                </div>
                <div className="sidebar-section">
                    <h4>Formeln</h4>
                    <ul>
                        <li
                            className={view === "installed" ? "active" : ""}
                            onClick={() => {
                                setView("installed");
                                setSelectedPackage(null);
                                setSelectedRepository(null);
                            }}
                        >
                            <span>📦 Installiert</span>
                            <span className="badge">{packages.length}</span>
                        </li>
                        <li
                            className={view === "updatable" ? "active" : ""}
                            onClick={() => {
                                setView("updatable");
                                setSelectedPackage(null);
                                setSelectedRepository(null);
                            }}
                        >
                            <span>🔄 Veraltet</span>
                            <span className="badge">{updatablePackages.length}</span>
                        </li>
                        <li
                            className={view === "all" ? "active" : ""}
                            onClick={() => {
                                setView("all");
                                setSelectedPackage(null);
                                setSelectedRepository(null);
                            }}
                        >
                            <span>📚 Alle Formeln</span>
                            <span className="badge">{allPackages.length}</span>
                        </li>
                        <li
                            className={view === "leaves" ? "active" : ""}
                            onClick={() => {
                                setView("leaves");
                                setSelectedPackage(null);
                                setSelectedRepository(null);
                            }}
                        >
                            <span>🍃 Blätter</span>
                            <span className="badge">{leavesPackages.length}</span>
                        </li>
                        <li
                            className={view === "repositories" ? "active" : ""}
                            onClick={() => {
                                setView("repositories");
                                setSelectedPackage(null);
                                setSelectedRepository(null);
                            }}
                        >
                            <span>📂 Repositories</span>
                            <span className="badge">{repositories.length}</span>
                        </li>
                    </ul>
                </div>
                <div className="sidebar-section">
                    <h4>Werkzeuge</h4>
                    <ul>
                        <li
                            className={view === "doctor" ? "active" : ""}
                            onClick={() => {
                                setView("doctor");
                                setSelectedPackage(null);
                                setSelectedRepository(null);
                            }}
                        >
                            <span>🩺 Doctor</span>
                        </li>
                        {/*<li><span>⬆️ Aktualisieren</span></li>*/}
                    </ul>
                </div>
                <div style={{
                    marginTop: "20px",
                    marginBottom: "10px",
                    fontSize: "10px",
                    color: "#777",
                    paddingTop: "1px"
                }}>
                    v{appVersion}
                </div>
            </nav>

            <main className="content">
                {/* Installed */}
                {view === "installed" && (
                    <>
                        <div className="header-row">
                            <div className="header-title">
                                <h3>Installierte Formeln ({packages.length})</h3>
                            </div>
                            <div className="header-actions">
                                {selectedPackage && (
                                    <>
                                        <button
                                            className="trash-button"
                                            onClick={() => setShowConfirm(true)}
                                            title={`"${selectedPackage.name}" deinstallieren`}
                                        >
                                            ❌️
                                        </button>
                                        <button
                                            className="trash-button"
                                            onClick={() => handleShowInfoLogs(selectedPackage)}
                                            title={`Infos zu "${selectedPackage.name}" anzeigen`}
                                        >
                                            ℹ️
                                        </button>
                                    </>
                                )}
                            </div>
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
                                Diese Formeln sind bereits auf Ihrem System installiert.
                            </div>
                        </div>
                    </>
                )}

                {/* Updatable */}
                {view === "updatable" && (
                    <>
                        <div className="header-row">
                            <div className="header-title">
                                <h3>Veraltete Formeln ({updatablePackages.length})</h3>
                            </div>
                            <div className="header-actions">
                                {selectedPackage && (
                                    <>
                                        <button
                                            className="trash-button"
                                            onClick={() => setShowUpdateConfirm(true)}
                                            title={`"${selectedPackage.name}" aktualisieren`}
                                        >
                                            🔄
                                        </button>
                                        <button
                                            className="trash-button"
                                            onClick={() => handleShowInfoLogs(selectedPackage)}
                                            title={`Infos zu "${selectedPackage.name}" anzeigen`}
                                        >
                                            ℹ️
                                        </button>
                                    </>
                                )}
                            </div>
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
                                        <th>Aktuellste Version</th>
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
                                            <td>{pkg.latestVersion}</td>
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
                                Einige Formeln können aktualisiert werden.
                            </div>
                        </div>
                    </>
                )}

                {/* All Formulas */}
                {view === "all" && (
                    <>
                        <div className="header-row">
                            <div className="header-title">
                                <h3>Alle Formeln ({allPackages.length})</h3>
                            </div>
                            <div className="header-actions">
                                {selectedPackage && (
                                    <>
                                        <button
                                            className="trash-button"
                                            onClick={() => handleShowInfoLogs(selectedPackage)}
                                            title={`Infos zu "${selectedPackage.name}" anzeigen`}
                                        >
                                            ℹ️
                                        </button>
                                    </>
                                )}
                            </div>
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
                                        <th>Status</th>
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
                                            <td>
                                                {pkg.isInstalled ? (
                                                    <span style={{ color: "green" }}>✓ Installiert</span>
                                                ) : (
                                                    <span style={{ color: "#888" }}>Nicht installiert</span>
                                                )}
                                            </td>
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
                                <p>Status: {selectedPackage?.isInstalled ? "Installiert" : "Nicht installiert"}</p>
                                <p>Abhängigkeiten: {selectedPackage?.dependencies?.join(", ") || "--"}</p>
                                <p>Konflikte: {selectedPackage?.conflicts?.join(", ") || "--"}</p>
                            </div>
                            <div className="package-footer">
                                Alle verfügbaren Homebrew-Formeln. Grüne Markierung zeigt installierte Formeln an.
                            </div>
                        </div>
                    </>
                )}

                {/* Leaves */}
                {view === "leaves" && (
                    <>
                        <div className="header-row">
                            <div className="header-title">
                                <h3>Blätter ({leavesPackages.length})</h3>
                            </div>
                            <div className="header-actions">
                                {selectedPackage && (
                                    <>
                                        <button
                                            className="trash-button"
                                            onClick={() => setShowConfirm(true)}
                                            title={`"${selectedPackage.name}" deinstallieren`}
                                        >
                                            ❌️
                                        </button>
                                        <button
                                            className="trash-button"
                                            onClick={() => handleShowInfoLogs(selectedPackage)}
                                            title={`Infos zu "${selectedPackage.name}" anzeigen`}
                                        >
                                            ℹ️
                                        </button>
                                    </>
                                )}
                            </div>
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
                                Blätter sind Formeln, die nicht als Abhängigkeit von anderen installierten Formeln
                                benötigt werden.
                            </div>
                        </div>
                    </>
                )}

                {/* Repositories */}
                {view === "repositories" && (
                    <>
                        <div className="header-row">
                            <div className="header-title">
                                <h3>Repositories ({repositories.length})</h3>
                            </div>
                            <div className="header-actions">
                                {/* Repository actions could be added here in the future */}
                            </div>
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
                                    <div className="loading-text">Repositories werden geladen…</div>
                                </div>
                            )}

                            {filteredRepositories.length > 0 && (
                                <table className="package-table">
                                    <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Status</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filteredRepositories.map((repo) => (
                                        <tr
                                            key={repo.name}
                                            className={selectedRepository?.name === repo.name ? "selected" : ""}
                                            onClick={() => handleRepositorySelect(repo)}
                                        >
                                            <td>{repo.name}</td>
                                            <td>
                                                <span style={{ color: "green" }}>✓ {repo.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )}

                            {!loading && filteredRepositories.length === 0 && (
                                <div className="result">Keine passenden Ergebnisse.</div>
                            )}
                        </div>

                        <div className="info-footer-container">
                            <div className="package-info">
                                <p>
                                    <strong>{selectedRepository?.name || "Kein Repository ausgewählt"}</strong>
                                </p>
                                <p>Status: {selectedRepository?.status || "--"}</p>
                                <p>Beschreibung: {selectedRepository?.desc || "Homebrew Tap Repository"}</p>
                            </div>
                            <div className="package-footer">
                                Repositories (Taps) sind Quellen für Formeln. Diese enthalten zusätzliche Pakete neben dem Standard-Repository.
                            </div>
                        </div>
                    </>
                )}

                {/* Doctor */}
                {view === "doctor" && (
                    <>
                    <div className="header-row">
                        <div className="header-title">
                            <h3>Homebrew Doctor</h3>
                        </div>
                        <div className="header-actions">
                            <button
                                className="doctor-button"
                                onClick={() => setDoctorLog("")}
                            >
                                Log leeren
                            </button>
                            <button
                                className="doctor-button"
                                onClick={async () => {
                                    setDoctorLog("Führe brew doctor aus…\nBitte warten...");
                                    const result = await RunBrewDoctor();
                                    setDoctorLog(result);
                                }}
                            >
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
                                )}

                        {showConfirm && (
                            <div className="confirm-overlay">
                                <div className="confirm-box">
                                    <p>Möchten Sie <strong>{selectedPackage?.name}</strong> wirklich deinstallieren?</p>
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
                                    <p>Möchten Sie <strong>{selectedPackage?.name}</strong> wirklich aktualisieren?</p>
                                    <div className="confirm-actions">
                                        <button onClick={handleUpdateConfirmed}>Ja, aktualisieren</button>
                                        <button onClick={() => setShowUpdateConfirm(false)}>Abbrechen</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {updateLogs !== null && (
                            <div className="confirm-overlay">
                                <div className="confirm-box" style={{ maxWidth: "700px" }}>
                                    <p><strong>Update-Logs für {selectedPackage?.name}</strong></p>
                                    <pre className="log-output">{updateLogs}</pre>
                                    <div className="confirm-actions">
                                        <button onClick={() => setUpdateLogs(null)}>Ok</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {infoLogs && (
                            <div className="confirm-overlay">
                                <div className="confirm-box" style={{ maxWidth: "700px" }}>
                                    <p><strong>Info für {selectedPackage?.name}</strong></p>
                                    <pre className="log-output">{infoLogs}</pre>
                                    <div className="confirm-actions">
                                        <button onClick={() => setInfoLogs(null)}>Ok</button>
                                    </div>
                                </div>
                            </div>
                        )}
            </main>
                    </div>
                );
                };

                export default WailBrewApp;