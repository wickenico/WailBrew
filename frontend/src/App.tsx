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
    GetAppVersion,
} from "../wailsjs/go/main/App";
import appIcon from "./assets/images/appicon_256.png";
import { EventsOn } from "../wailsjs/runtime";

import Sidebar from "./components/Sidebar";
import HeaderRow from "./components/HeaderRow";
import PackageTable from "./components/PackageTable";
import RepositoryTable from "./components/RepositoryTable";
import PackageInfo from "./components/PackageInfo";
import RepositoryInfo from "./components/RepositoryInfo";
import DoctorView from "./components/DoctorView";
import ConfirmDialog from "./components/ConfirmDialog";
import LogDialog from "./components/LogDialog";
import AboutDialog from "./components/AboutDialog";
import UpdateDialog from "./components/UpdateDialog";

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
    const [showAbout, setShowAbout] = useState<boolean>(false);
    const [showUpdate, setShowUpdate] = useState<boolean>(false);
    const [appVersion, setAppVersion] = useState<string>("0.5.0");

    useEffect(() => {
        // Get app version from backend
        GetAppVersion().then(version => {
            setAppVersion(version);
        }).catch(err => {
            console.error("Failed to get app version:", err);
        });

        setLoading(true);
        Promise.all([GetBrewPackages(), GetBrewUpdatablePackages(), GetAllBrewPackages(), GetBrewLeaves(), GetBrewTaps()])
            .then(([installed, updatable, all, leaves, repos]) => {
                // Ensure all responses are arrays, default to empty arrays if null/undefined
                const safeInstalled = installed || [];
                const safeUpdatable = updatable || [];
                const safeAll = all || [];
                const safeLeaves = leaves || [];
                const safeRepos = repos || [];

                // Check for errors in the responses
                if (safeInstalled.length === 1 && safeInstalled[0][0] === "Error") {
                    throw new Error(`Failed to get installed packages: ${safeInstalled[0][1]}`);
                }
                if (safeUpdatable.length === 1 && safeUpdatable[0][0] === "Error") {
                    throw new Error(`Failed to get updatable packages: ${safeUpdatable[0][1]}`);
                }
                if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                    throw new Error(`Failed to get all packages: ${safeAll[0][1]}`);
                }
                if (safeLeaves.length === 1 && safeLeaves[0] && safeLeaves[0].startsWith("Fehler: ")) {
                    throw new Error(`Failed to get leaves: ${safeLeaves[0]}`);
                }
                if (safeRepos.length === 1 && safeRepos[0][0] === "Fehler") {
                    throw new Error(`Failed to get repositories: ${safeRepos[0][1]}`);
                }

                const installedFormatted = safeInstalled.map(([name, installedVersion]) => ({
                    name,
                    installedVersion,
                    isInstalled: true,
                }));
                const updatableFormatted = safeUpdatable.map(([name, installedVersion, latestVersion]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    isInstalled: true,
                }));
                const installedNames = new Set(installedFormatted.map(pkg => pkg.name));
                const allFormatted = safeAll.map(([name]) => ({
                    name,
                    installedVersion: "",
                    isInstalled: installedNames.has(name),
                }));

                // Format leaves packages with their versions from installed packages
                const installedMap = new Map(installedFormatted.map(pkg => [pkg.name, pkg.installedVersion]));
                const leavesFormatted = safeLeaves.map((name) => ({
                    name,
                    installedVersion: installedMap.get(name) || "Unknown",
                    isInstalled: true,
                }));

                // Format repositories
                const reposFormatted = safeRepos.map(([name, status]) => ({
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
            .catch((err) => {
                console.error("Error loading packages:", err);
                // Set empty arrays for all package types to show empty tables instead of crashing
                setPackages([]);
                setUpdatablePackages([]);
                setAllPackages([]);
                setLeavesPackages([]);
                setRepositories([]);
                setError("❌ Fehler beim Laden der Formeln!" + (err.message || err));
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const unlisten = EventsOn("setView", (data) => {
            setView(data as any);
            clearSelection();
        });
        const unlistenRefresh = EventsOn("refreshPackages", () => {
            window.location.reload();
        });
        const unlistenAbout = EventsOn("showAbout", () => {
            setShowAbout(true);
        });
        const unlistenUpdate = EventsOn("checkForUpdates", () => {
            setShowUpdate(true);
        });
        return () => {
            unlisten();
            unlistenRefresh();
            unlistenAbout();
            unlistenUpdate();
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

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageUpdateProgress", (progress: string) => {
            setUpdateLogs(prevLogs => {
                if (!prevLogs) {
                    return `Update-Logs für ${selectedPackage.name}\n${progress}`;
                }
                return prevLogs + '\n' + progress;
            });
        });

        const completeListener = EventsOn("packageUpdateComplete", async (finalMessage: string) => {
            // Update the package list after successful update
            const updated = await GetBrewUpdatablePackages();
            const formatted = updated.map(([name, installedVersion, latestVersion]) => ({
                name,
                installedVersion,
                latestVersion,
                isInstalled: true,
            }));
            setUpdatablePackages(formatted);
            
            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the update process
        await UpdateBrewPackage(selectedPackage.name);
    };

    const handleShowInfoLogs = async (pkg: PackageEntry) => {
        if (!pkg) return;

        setInfoLogs(`Hole Informationen für "${pkg.name}"...\nBitte warten...`);

        const info = await GetBrewPackageInfo(pkg.name);

        setInfoLogs(info);
    };

    // Helper for clearing selection
    const clearSelection = () => {
        setSelectedPackage(null);
        setSelectedRepository(null);
    };

    // Table columns config
    const columnsInstalled = [
        { key: "name", label: "Name" },
        { key: "installedVersion", label: "Version" },
    ];
    const columnsUpdatable = [
        { key: "name", label: "Name" },
        { key: "installedVersion", label: "Version" },
        { key: "latestVersion", label: "Aktuellste Version" },
    ];
    const columnsAll = [
        { key: "name", label: "Name" },
        { key: "isInstalled", label: "Status" },
    ];
    const columnsLeaves = columnsInstalled;

    return (
        <div className="wailbrew-container">
            <Sidebar
                view={view}
                setView={setView}
                packagesCount={packages.length}
                updatableCount={updatablePackages.length}
                allCount={allPackages.length}
                leavesCount={leavesPackages.length}
                repositoriesCount={repositories.length}
                appVersion={appVersion}
                onClearSelection={clearSelection}
            />
            <main className="content">
                {view === "installed" && (
                    <>
                        <HeaderRow
                            title={`Installierte Formeln (${packages.length})`}
                            actions={selectedPackage && (
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
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading}
                            onSelect={handleSelect}
                            columns={columnsInstalled}
                        />
                        <div className="info-footer-container">
                            <div className="package-info">
                                <PackageInfo
                                    packageEntry={selectedPackage}
                                    loadingDetailsFor={loadingDetailsFor}
                                    view={view}
                                />
                            </div>
                            <div className="package-footer">
                                Diese Formeln sind bereits auf Ihrem System installiert.
                            </div>
                        </div>
                    </>
                )}
                {view === "updatable" && (
                    <>
                        <HeaderRow
                            title={`Veraltete Formeln (${updatablePackages.length})`}
                            actions={selectedPackage && (
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
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading}
                            onSelect={handleSelect}
                            columns={columnsUpdatable}
                        />
                        <div className="info-footer-container">
                            <div className="package-info">
                                <PackageInfo
                                    packageEntry={selectedPackage}
                                    loadingDetailsFor={loadingDetailsFor}
                                    view={view}
                                />
                            </div>
                            <div className="package-footer">
                                Einige Formeln können aktualisiert werden.
                            </div>
                        </div>
                    </>
                )}
                {view === "all" && (
                    <>
                        <HeaderRow
                            title={`Alle Formeln (${allPackages.length})`}
                            actions={selectedPackage && (
                                <button
                                    className="trash-button"
                                    onClick={() => handleShowInfoLogs(selectedPackage)}
                                    title={`Infos zu "${selectedPackage.name}" anzeigen`}
                                >
                                    ℹ️
                                </button>
                            )}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading}
                            onSelect={handleSelect}
                            columns={columnsAll}
                        />
                        <div className="info-footer-container">
                            <div className="package-info">
                                <PackageInfo
                                    packageEntry={selectedPackage}
                                    loadingDetailsFor={loadingDetailsFor}
                                    view={view}
                                />
                            </div>
                            <div className="package-footer">
                                Alle verfügbaren Homebrew-Formeln. Grüne Markierung zeigt installierte Formeln an.
                            </div>
                        </div>
                    </>
                )}
                {view === "leaves" && (
                    <>
                        <HeaderRow
                            title={`Blätter (${leavesPackages.length})`}
                            actions={selectedPackage && (
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
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading}
                            onSelect={handleSelect}
                            columns={columnsLeaves}
                        />
                        <div className="info-footer-container">
                            <div className="package-info">
                                <PackageInfo
                                    packageEntry={selectedPackage}
                                    loadingDetailsFor={loadingDetailsFor}
                                    view={view}
                                />
                            </div>
                            <div className="package-footer">
                                Blätter sind Formeln, die nicht als Abhängigkeit von anderen installierten Formeln benötigt werden.
                            </div>
                        </div>
                    </>
                )}
                {view === "repositories" && (
                    <>
                        <HeaderRow
                            title={`Repositories (${repositories.length})`}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <RepositoryTable
                            repositories={filteredRepositories}
                            selectedRepository={selectedRepository}
                            loading={loading}
                            onSelect={handleRepositorySelect}
                        />
                        <div className="info-footer-container">
                            <div className="package-info">
                                <RepositoryInfo repository={selectedRepository} />
                            </div>
                            <div className="package-footer">
                                Repositories (Taps) sind Quellen für Formeln. Diese enthalten zusätzliche Pakete neben dem Standard-Repository.
                            </div>
                        </div>
                    </>
                )}
                {view === "doctor" && (
                    <DoctorView
                        doctorLog={doctorLog}
                        onClearLog={() => setDoctorLog("")}
                        onRunDoctor={async () => {
                            setDoctorLog("Führe brew doctor aus…\nBitte warten...");
                            const result = await RunBrewDoctor();
                            setDoctorLog(result);
                        }}
                    />
                )}
                <ConfirmDialog
                    open={showConfirm}
                    message={`Möchten Sie "${selectedPackage?.name}" wirklich deinstallieren?`}
                    onConfirm={handleRemoveConfirmed}
                    onCancel={() => setShowConfirm(false)}
                    confirmLabel="Ja, deinstallieren"
                />
                <ConfirmDialog
                    open={showUpdateConfirm}
                    message={`Möchten Sie "${selectedPackage?.name}" wirklich aktualisieren?`}
                    onConfirm={handleUpdateConfirmed}
                    onCancel={() => setShowUpdateConfirm(false)}
                    confirmLabel="Ja, aktualisieren"
                />
                <LogDialog
                    open={updateLogs !== null}
                    title={`Update-Logs für ${selectedPackage?.name}`}
                    log={updateLogs}
                    onClose={() => setUpdateLogs(null)}
                />
                <LogDialog
                    open={!!infoLogs}
                    title={`Info für ${selectedPackage?.name}`}
                    log={infoLogs}
                    onClose={() => setInfoLogs(null)}
                />
                <AboutDialog
                    open={showAbout}
                    onClose={() => setShowAbout(false)}
                    appVersion={appVersion}
                />
                <UpdateDialog
                    isOpen={showUpdate}
                    onClose={() => setShowUpdate(false)}
                />
            </main>
        </div>
    );
};

export default WailBrewApp;