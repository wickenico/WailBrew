import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast, { Toaster } from 'react-hot-toast';
import "./style.css";
import "./App.css";
import {
    GetBrewPackages,
    GetBrewUpdatablePackages,
    GetBrewPackageInfo,
    GetBrewPackageInfoAsJson,
    RemoveBrewPackage,
    InstallBrewPackage,
    UpdateBrewPackage,
    UpdateAllBrewPackages,
    RunBrewDoctor,
    RunBrewCleanup,
    GetAllBrewPackages,
    GetBrewLeaves,
    GetBrewTaps,
    GetAppVersion,
    SetLanguage,
    CheckForUpdates,
} from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime";

import Sidebar from "./components/Sidebar";
import HeaderRow from "./components/HeaderRow";
import PackageTable from "./components/PackageTable";
import RepositoryTable from "./components/RepositoryTable";
import PackageInfo from "./components/PackageInfo";
import RepositoryInfo from "./components/RepositoryInfo";
import DoctorView from "./components/DoctorView";
import CleanupView from "./components/CleanupView";
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
    const { t, i18n } = useTranslation();
    const [packages, setPackages] = useState<PackageEntry[]>([]);
    const [updatablePackages, setUpdatablePackages] = useState<PackageEntry[]>([]);
    const [allPackages, setAllPackages] = useState<PackageEntry[]>([]);
    const [leavesPackages, setLeavesPackages] = useState<PackageEntry[]>([]);
    const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor" | "cleanup">("installed");
    const [selectedPackage, setSelectedPackage] = useState<PackageEntry | null>(null);
    const [selectedRepository, setSelectedRepository] = useState<RepositoryEntry | null>(null);
    const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);
    const [packageCache, setPackageCache] = useState<Map<string, PackageEntry>>(new Map());
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showConfirm, setShowConfirm] = useState<boolean>(false);
    const [showInstallConfirm, setShowInstallConfirm] = useState<boolean>(false);
    const [showUpdateConfirm, setShowUpdateConfirm] = useState<boolean>(false);
    const [showUpdateAllConfirm, setShowUpdateAllConfirm] = useState<boolean>(false);
    const [updateLogs, setUpdateLogs] = useState<string | null>(null);
    const [installLogs, setInstallLogs] = useState<string | null>(null);
    const [uninstallLogs, setUninstallLogs] = useState<string | null>(null);
    const [infoLogs, setInfoLogs] = useState<string | null>(null);
    const [infoPackage, setInfoPackage] = useState<PackageEntry | null>(null);
    const [doctorLog, setDoctorLog] = useState<string>("");
    const [cleanupLog, setCleanupLog] = useState<string>("");
    const [showAbout, setShowAbout] = useState<boolean>(false);
    const [showUpdate, setShowUpdate] = useState<boolean>(false);
    const [appVersion, setAppVersion] = useState<string>("0.5.0");
    const updateCheckDone = useRef<boolean>(false);

    useEffect(() => {
        // Get app version from backend
        GetAppVersion().then(version => {
            setAppVersion(version);
        }).catch(err => {
            console.error("Failed to get app version:", err);
        });

        // Initialize backend language with current frontend language
        SetLanguage(i18n.language).catch(err => {
            console.error("Failed to set initial backend language:", err);
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
                    throw new Error(`${t('errors.failedInstalledPackages')}: ${safeInstalled[0][1]}`);
                }
                if (safeUpdatable.length === 1 && safeUpdatable[0][0] === "Error") {
                    throw new Error(`${t('errors.failedUpdatablePackages')}: ${safeUpdatable[0][1]}`);
                }
                if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                    throw new Error(`${t('errors.failedAllPackages')}: ${safeAll[0][1]}`);
                }
                if (safeLeaves.length === 1 && safeLeaves[0]?.startsWith("Error: ")) {
                    throw new Error(`${t('errors.failedLeaves')}: ${safeLeaves[0]}`);
                }
                if (safeRepos.length === 1 && safeRepos[0][0] === "Error") {
                    throw new Error(`${t('errors.failedRepositories')}: ${safeRepos[0][1]}`);
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
                    installedVersion: installedMap.get(name) || t('common.notAvailable'),
                    isInstalled: true,
                }));

                // Format repositories
                const reposFormatted = safeRepos.map(([name, status]) => ({
                    name,
                    status,
                    desc: t('common.notAvailable'),
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
                setError(t('errors.loadingFormulas') + (err.message || err));
                setLoading(false);
            });
        
        // Check for app updates on startup
        checkAppUpdatesOnStartup();
    }, []);

    const checkAppUpdatesOnStartup = async () => {
        // Prevent duplicate calls
        if (updateCheckDone.current) return;
        updateCheckDone.current = true;
        
        try {
            // Wait a bit to let the app fully load first
            setTimeout(async () => {
                const updateInfo = await CheckForUpdates();
                
                if (updateInfo.available) {
                    toast(
                        () => (
                            <div>
                                <div style={{ fontWeight: 600 }}>{t('toast.updateAvailable')}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    {t('toast.versionReady', { version: updateInfo.latestVersion })}
                                </div>
                            </div>
                        ),
                        {
                            icon: '🎉',
                            duration: 4000,
                            position: 'bottom-center',
                        }
                    );
                } else {
                    toast.success(t('toast.upToDate'), {
                        duration: 4000,
                        position: 'bottom-center',
                    });
                }
            }, 2000); // Delay 2 seconds after app load
        } catch (error) {
            // Silently fail - don't show error toasts for update checks on startup
            console.log('Update check failed:', error);
        }
    };

    useEffect(() => {
        const unlisten = EventsOn("setView", (data: string) => {
            setView(data as "installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor" | "cleanup");
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
            desc: (info["desc"] as string) || t('common.notAvailable'),
            homepage: (info["homepage"] as string) || t('common.notAvailable'),
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
        setUninstallLogs(t('dialogs.uninstalling', { name: selectedPackage.name }));

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageUninstallProgress", (progress: string) => {
            setUninstallLogs(prevLogs => {
                if (!prevLogs) {
                    return `${t('dialogs.uninstallLogs', { name: selectedPackage.name })}\n${progress}`;
                }
                return prevLogs + '\n' + progress;
            });
        });

        const completeListener = EventsOn("packageUninstallComplete", async (finalMessage: string) => {
            // Update the package list after successful uninstall
            await handleRefreshPackages();

            setUninstallLogs(prevLogs => prevLogs + '\n' + finalMessage);
            
            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the uninstall process
        await RemoveBrewPackage(selectedPackage.name);
    };

    const handleUpdate = (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setShowUpdateConfirm(true);
    };

    const handleUpdateConfirmed = async () => {
        if (!selectedPackage) return;
        setShowUpdateConfirm(false);
        setUpdateLogs(t('dialogs.updating', { name: selectedPackage.name }));

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageUpdateProgress", (progress: string) => {
            setUpdateLogs(prevLogs => {
                if (!prevLogs) {
                    return `${t('dialogs.updateLogs', { name: selectedPackage.name })}\n${progress}`;
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

    const handleUpdateAllConfirmed = async () => {
        setShowUpdateAllConfirm(false);
        setUpdateLogs(t('dialogs.updatingAll'));

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageUpdateProgress", (progress: string) => {
            setUpdateLogs(prevLogs => {
                if (!prevLogs) {
                    return `${t('dialogs.updateAllLogs')}\n${progress}`;
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

        // Start the update all process
        await UpdateAllBrewPackages();
    };

    const handleShowInfoLogs = async (pkg: PackageEntry) => {
        if (!pkg) return;

        setInfoPackage(pkg);
        setInfoLogs(t('dialogs.gettingInfo', { name: pkg.name }));

        const info = await GetBrewPackageInfo(pkg.name);

        setInfoLogs(info);
    };

    // Helper for clearing selection
    const clearSelection = () => {
        setSelectedPackage(null);
        setSelectedRepository(null);
    };

    const handleUninstallPackage = (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setShowConfirm(true);
    };

    const handleInstallPackage = (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setShowInstallConfirm(true);
    };

    const handleInstallConfirmed = async () => {
        if (!selectedPackage) return;
        setShowInstallConfirm(false);
        setInstallLogs(t('dialogs.installing', { name: selectedPackage.name }));

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageInstallProgress", (progress: string) => {
            setInstallLogs(prevLogs => {
                if (!prevLogs) {
                    return `${t('dialogs.installLogs', { name: selectedPackage.name })}\n${progress}`;
                }
                return prevLogs + '\n' + progress;
            });
        });

        const completeListener = EventsOn("packageInstallComplete", async (finalMessage: string) => {
            // Update the package list after successful install
            await handleRefreshPackages();

            setInstallLogs(prevLogs => prevLogs + '\n' + finalMessage);
            
            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the install process
        await InstallBrewPackage(selectedPackage.name);
    };

    const handleShowPackageInfo = (pkg: PackageEntry) => {
        handleShowInfoLogs(pkg);
    };

    const handleRefreshPackages = async () => {
        setLoading(true);
        setError("");
        
        try {
            const [installed, updatable, all, leaves, repos] = await Promise.all([
                GetBrewPackages(), 
                GetBrewUpdatablePackages(), 
                GetAllBrewPackages(), 
                GetBrewLeaves(), 
                GetBrewTaps()
            ]);
            
            // Process the data same as in useEffect
            const safeInstalled = installed || [];
            const safeUpdatable = updatable || [];
            const safeAll = all || [];
            const safeLeaves = leaves || [];
            const safeRepos = repos || [];

            if (safeInstalled.length === 1 && safeInstalled[0][0] === "Error") {
                setError(safeInstalled[0][1]);
                setPackages([]);
            } else {
                const formatted = safeInstalled.map(([name, installedVersion]) => ({
                    name,
                    installedVersion,
                    isInstalled: true,
                }));
                setPackages(formatted);
            }

            if (safeUpdatable.length === 1 && safeUpdatable[0][0] === "Error") {
                setUpdatablePackages([]);
            } else {
                const formatted = safeUpdatable.map(([name, installedVersion, latestVersion]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    isInstalled: true,
                }));
                setUpdatablePackages(formatted);
            }

            if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                setAllPackages([]);
            } else {
                const installedMap = new Map(safeInstalled.map(([name]) => [name, true]));
                const formatted = safeAll.map(([name, desc]) => ({
                    name,
                    installedVersion: t('common.notAvailable'),
                    desc,
                    isInstalled: installedMap.has(name),
                }));
                setAllPackages(formatted);
            }

            if (safeLeaves.length === 1 && safeLeaves[0] === "Error") {
                setLeavesPackages([]);
            } else {
                const installedMap = new Map(safeInstalled.map(([name, installedVersion]) => [name, installedVersion]));
                const formatted = safeLeaves.map((name) => ({
                    name,
                    installedVersion: installedMap.get(name) || t('common.notAvailable'),
                    isInstalled: true,
                }));
                setLeavesPackages(formatted);
            }

            if (safeRepos.length === 1 && safeRepos[0][0] === "Error") {
                setRepositories([]);
            } else {
                const formatted = safeRepos.map(([name, status]) => ({
                    name,
                    status,
                }));
                setRepositories(formatted);
            }
        } catch (error) {
            console.error('Error refreshing packages:', error);
            setError('Failed to refresh packages');
        } finally {
            setLoading(false);
        }
    };

    // Table columns config
    const columnsInstalled = [
        { key: "name", label: t('tableColumns.name') },
        { key: "installedVersion", label: t('tableColumns.version') },
        { key: "actions", label: t('tableColumns.actions') },
    ];
    const columnsUpdatable = [
        { key: "name", label: t('tableColumns.name') },
        { key: "installedVersion", label: t('tableColumns.version') },
        { key: "latestVersion", label: t('tableColumns.latestVersion') },
        { key: "actions", label: t('tableColumns.actions') },
    ];
    const columnsAll = [
        { key: "name", label: t('tableColumns.name') },
        { key: "isInstalled", label: t('tableColumns.status') },
        { key: "actions", label: t('tableColumns.actions') },
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
                            title={t('headers.installedFormulas', { count: packages.length })}
                            actions={
                                <button
                                    className="refresh-button"
                                    onClick={handleRefreshPackages}
                                    disabled={loading}
                                    title={t('buttons.refresh')}
                                >
                                    🔄
                                </button>
                            }
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
                            onUninstall={handleUninstallPackage}
                            onShowInfo={handleShowPackageInfo}
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
                                {t('footers.installedFormulas')}
                            </div>
                        </div>
                    </>
                )}
                {view === "updatable" && (
                    <>
                        <HeaderRow
                            title={t('headers.outdatedFormulas', { count: updatablePackages.length })}
                            actions={
                                <>
                                    {updatablePackages.length > 0 && (
                                        <button
                                            className="update-all-button"
                                            onClick={() => setShowUpdateAllConfirm(true)}
                                            title={t('buttons.updateAll')}
                                        >
                                            ⬆️ {t('buttons.updateAll')}
                                        </button>
                                    )}
                                </>
                            }
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
                            onUninstall={handleUninstallPackage}
                            onShowInfo={handleShowInfoLogs}
                            onUpdate={handleUpdate}
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
                                {t('footers.outdatedFormulas')}
                            </div>
                        </div>
                    </>
                )}
                {view === "all" && (
                    <>
                        <HeaderRow
                            title={t('headers.allFormulas', { count: allPackages.length })}
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
                            onShowInfo={handleShowInfoLogs}
                            onInstall={handleInstallPackage}
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
                                {t('footers.allFormulas')}
                            </div>
                        </div>
                    </>
                )}
                {view === "leaves" && (
                    <>
                        <HeaderRow
                            title={t('headers.leaves', { count: leavesPackages.length })}
                            actions={selectedPackage && (
                                <>
                                    <button
                                        className="trash-button"
                                        onClick={() => setShowConfirm(true)}
                                        title={t('buttons.uninstall', { name: selectedPackage.name })}
                                    >
                                        ❌️
                                    </button>
                                    <button
                                        className="trash-button"
                                        onClick={() => handleShowInfoLogs(selectedPackage)}
                                        title={t('buttons.showInfo', { name: selectedPackage.name })}
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
                                {t('footers.leaves')}
                            </div>
                        </div>
                    </>
                )}
                {view === "repositories" && (
                    <>
                        <HeaderRow
                            title={t('headers.repositories', { count: repositories.length })}
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
                                {t('footers.repositories')}
                            </div>
                        </div>
                    </>
                )}
                {view === "doctor" && (
                    <DoctorView
                        doctorLog={doctorLog}
                        onClearLog={() => setDoctorLog("")}
                        onRunDoctor={async () => {
                            setDoctorLog(t('dialogs.runningDoctor'));
                            const result = await RunBrewDoctor();
                            setDoctorLog(result);
                        }}
                    />
                )}
                {view === "cleanup" && (
                    <CleanupView
                        cleanupLog={cleanupLog}
                        onClearLog={() => setCleanupLog("")}
                        onRunCleanup={async () => {
                            setCleanupLog(t('dialogs.runningCleanup'));
                            const result = await RunBrewCleanup();
                            setCleanupLog(result);
                        }}
                    />
                )}
                <ConfirmDialog
                    open={showConfirm}
                    message={t('dialogs.confirmUninstall', { name: selectedPackage?.name })}
                    onConfirm={handleRemoveConfirmed}
                    onCancel={() => setShowConfirm(false)}
                    confirmLabel={t('buttons.yesUninstall')}
                    destructive={true}
                />
                <ConfirmDialog
                    open={showInstallConfirm}
                    message={t('dialogs.confirmInstall', { name: selectedPackage?.name })}
                    onConfirm={handleInstallConfirmed}
                    onCancel={() => setShowInstallConfirm(false)}
                    confirmLabel={t('buttons.yesInstall')}
                />
                <ConfirmDialog
                    open={showUpdateConfirm}
                    message={t('dialogs.confirmUpdate', { name: selectedPackage?.name })}
                    onConfirm={handleUpdateConfirmed}
                    onCancel={() => setShowUpdateConfirm(false)}
                    confirmLabel={t('buttons.yesUpdate')}
                />
                <ConfirmDialog
                    open={showUpdateAllConfirm}
                    message={t('dialogs.confirmUpdateAll')}
                    onConfirm={handleUpdateAllConfirmed}
                    onCancel={() => setShowUpdateAllConfirm(false)}
                    confirmLabel={t('buttons.yesUpdateAll')}
                />
                <LogDialog
                    open={updateLogs !== null}
                    title={selectedPackage ? t('dialogs.updateLogs', { name: selectedPackage.name }) : t('dialogs.updateAllLogs')}
                    log={updateLogs}
                    onClose={() => setUpdateLogs(null)}
                />
                <LogDialog
                    open={installLogs !== null}
                    title={selectedPackage ? t('dialogs.installLogs', { name: selectedPackage.name }) : t('dialogs.installLogs')}
                    log={installLogs}
                    onClose={() => setInstallLogs(null)}
                />
                <LogDialog
                    open={uninstallLogs !== null}
                    title={selectedPackage ? t('dialogs.uninstallLogs', { name: selectedPackage.name }) : t('dialogs.uninstallLogs')}
                    log={uninstallLogs}
                    onClose={() => setUninstallLogs(null)}
                />
                <LogDialog
                    open={!!infoLogs}
                    title={t('dialogs.packageInfo', { name: infoPackage?.name })}
                    log={infoLogs}
                    onClose={() => {
                        setInfoLogs(null);
                        setInfoPackage(null);
                    }}
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
                <Toaster
                    position="bottom-center"
                    reverseOrder={false}
                    gutter={8}
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: 'rgba(40, 44, 52, 0.95)',
                            color: '#fff',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                        },
                        success: {
                            iconTheme: {
                                primary: '#4CAF50',
                                secondary: '#fff',
                            },
                        },
                    }}
                />
            </main>
        </div>
    );
};

export default WailBrewApp;