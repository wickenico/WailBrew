import { CheckSquare, Copy, PartyPopper, RefreshCw, Sparkles, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import {
    CheckHomebrewUpdate,
    ClearBrewCache,
    GetAllBrewCasks,
    GetAllBrewPackages,
    GetAppVersion,
    GetBrewCasks,
    GetBrewCaskSizes,
    GetBrewCleanupDryRun,
    GetBrewPackages,
    GetBrewPackageInfo,
    GetBrewPackageInfoAsJson,
    GetBrewPackageSizes,
    GetBrewTapInfo,
    GetBrewUpdatablePackages,
    GetBrewUpdatablePackagesWithUpdate,
    GetDeprecatedFormulae,
    GetHomebrewVersion,
    GetSessionLogs,
    GetStartupDataWithUpdate,
    InstallBrewPackage,
    RemoveBrewPackage,
    RunBrewCleanup,
    RunBrewCleanupDryRun,
    RunBrewDoctor,
    SetDockBadgeCount,
    SetDockBadgeCountSync,
    SetLanguage,
    TapBrewRepository,
    UntapBrewRepository,
    UpdateAllBrewPackages,
    UpdateBrewPackage,
    UpdateHomebrew,
    UpdateSelectedBrewPackages
} from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime";
import "./App.css";
import "./style.css";

import AboutDialog from "./components/AboutDialog";
import CleanupView from "./components/CleanupView";
import CommandPalette from "./components/CommandPalette";
import ConfirmDialog from "./components/ConfirmDialog";
import DoctorView from "./components/DoctorView";
import HeaderRow from "./components/HeaderRow";
import HomebrewView from "./components/HomebrewView";
import LogDialog from "./components/LogDialog";
import PackageInfo from "./components/PackageInfo";
import PackageTable from "./components/PackageTable";
import RepositoryInfo from "./components/RepositoryInfo";
import RepositoryTable from "./components/RepositoryTable";
import RestartDialog from "./components/RestartDialog";
import SettingsView from "./components/SettingsView";
import ShortcutsDialog from "./components/ShortcutsDialog";
import Sidebar from "./components/Sidebar";
import TapInputDialog from "./components/TapInputDialog";
import UpdateDialog from "./components/UpdateDialog";
import { mapToSupportedLanguage } from "./i18n/languageUtils";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
    size?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
    isInstalled?: boolean;
    warning?: string;
    isCask?: boolean;
}

interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
}

const WailBrewApp = () => {
    const { t, i18n } = useTranslation();
    const [packages, setPackages] = useState<PackageEntry[]>([]);
    const [casks, setCasks] = useState<PackageEntry[]>([]);
    const [updatablePackages, setUpdatablePackages] = useState<PackageEntry[]>([]);
    const [allPackages, setAllPackages] = useState<PackageEntry[]>([]);
    const [allPackagesLoaded, setAllPackagesLoaded] = useState<boolean>(false);
    const [loadingAllPackages, setLoadingAllPackages] = useState<boolean>(false);
    const [allCasksAll, setAllCasksAll] = useState<PackageEntry[]>([]);
    const [allCasksLoaded, setAllCasksLoaded] = useState<boolean>(false);
    const [loadingAllCasks, setLoadingAllCasks] = useState<boolean>(false);
    const [leavesPackages, setLeavesPackages] = useState<PackageEntry[]>([]);
    const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "casks" | "updatable" | "all" | "allCasks" | "leaves" | "repositories" | "homebrew" | "doctor" | "cleanup" | "settings">("installed");
    const [selectedPackage, setSelectedPackage] = useState<PackageEntry | null>(null);
    const [selectedRepository, setSelectedRepository] = useState<RepositoryEntry | null>(null);
    const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);
    const [packageCache, setPackageCache] = useState<Map<string, PackageEntry>>(new Map());
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showConfirm, setShowConfirm] = useState<boolean>(false);
    const [showInstallConfirm, setShowInstallConfirm] = useState<boolean>(false);
    const [showUpdateConfirm, setShowUpdateConfirm] = useState<boolean>(false);
    const [showUpdateAllConfirm, setShowUpdateAllConfirm] = useState<boolean>(false);
    const [showUntapConfirm, setShowUntapConfirm] = useState<boolean>(false);
    const [showTapInput, setShowTapInput] = useState<boolean>(false);
    const [untapLogPackages, setUntapLogPackages] = useState<string[]>([]);
    const [updateLogs, setUpdateLogs] = useState<string | null>(null);
    const [isUpdateAllOperation, setIsUpdateAllOperation] = useState<boolean>(false);
    const [currentlyUpdatingPackage, setCurrentlyUpdatingPackage] = useState<string | null>(null);
    const [installLogs, setInstallLogs] = useState<string | null>(null);
    const [uninstallLogs, setUninstallLogs] = useState<string | null>(null);
    const [untapLogs, setUntapLogs] = useState<string | null>(null);
    const [tapLogs, setTapLogs] = useState<string | null>(null);
    const [tappingRepository, setTappingRepository] = useState<string | null>(null);
    const [infoLogs, setInfoLogs] = useState<string | null>(null);
    const [repositoryInfoLogs, setRepositoryInfoLogs] = useState<string | null>(null);
    const [showRepositoryInfo, setShowRepositoryInfo] = useState<boolean>(false);
    const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
    const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
    const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
    const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
    const [showUpdateSelectedConfirm, setShowUpdateSelectedConfirm] = useState<boolean>(false);
    const [infoPackage, setInfoPackage] = useState<PackageEntry | null>(null);
    const [doctorLog, setDoctorLog] = useState<string>("");
    const [deprecatedFormulae, setDeprecatedFormulae] = useState<string[]>([]);
    const [homebrewLog, setHomebrewLog] = useState<string>("");
    const [homebrewVersion, setHomebrewVersion] = useState<string>("");
    const [homebrewUpdateStatus, setHomebrewUpdateStatus] = useState<{ isUpToDate: boolean | null, latestVersion: string | null }>({ isUpToDate: null, latestVersion: null });
    const [isUpdateRunning, setIsUpdateRunning] = useState<boolean>(false);
    const [isInstallRunning, setIsInstallRunning] = useState<boolean>(false);
    const [isUninstallRunning, setIsUninstallRunning] = useState<boolean>(false);
    const [cleanupLog, setCleanupLog] = useState<string>("");
    const [cleanupEstimate, setCleanupEstimate] = useState<string>("");
    const [showAbout, setShowAbout] = useState<boolean>(false);
    const [showUpdate, setShowUpdate] = useState<boolean>(false);
    const [showRestart, setShowRestart] = useState<boolean>(false);
    const [showSessionLogs, setShowSessionLogs] = useState<boolean>(false);
    const [sessionLogs, setSessionLogs] = useState<string>("");
    const [appVersion, setAppVersion] = useState<string>("0.5.0");
    const updateCheckDone = useRef<boolean>(false);
    const lastSyncedLanguage = useRef<string>("en");
    const isInitialLoad = useRef<boolean>(true);

    // Loading timer for development
    const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
    const [loadingElapsedTime, setLoadingElapsedTime] = useState<number>(0);
    const loadingTimerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const loadingStartTimeRef = useRef<number | null>(null);

    // Background update checking state
    const [isBackgroundCheckRunning, setIsBackgroundCheckRunning] = useState<boolean>(false);
    const lastKnownOutdatedCount = useRef<number>(0);
    const backgroundCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const nextCheckTime = useRef<number>(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Track update event listeners for cleanup (prevents duplicate listeners bug)
    const updateListenersRef = useRef<{ progress: (() => void) | null; complete: (() => void) | null }>({
        progress: null,
        complete: null
    });

    // Track info request to prevent reopening dialog after close
    const infoRequestIdRef = useRef<number>(0);

    // Sidebar resize state
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 220;
    });
    const [isResizing, setIsResizing] = useState<boolean>(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const customToastStyle = {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: 0,
    } as const;

    useEffect(() => {
        // Get app version from backend
        GetAppVersion().then(version => {
            setAppVersion(version);
        }).catch(err => {
            console.error("Failed to get app version:", err);
        });

        setLoading(true);
        // Start loading timer
        const startTime = Date.now();
        loadingStartTimeRef.current = startTime;
        setLoadingStartTime(startTime);
        setLoadingElapsedTime(0);

        // Update timer every 100ms
        loadingTimerInterval.current = setInterval(() => {
            if (loadingStartTimeRef.current) {
                setLoadingElapsedTime(Date.now() - loadingStartTimeRef.current);
            }
        }, 100);

        // Use single optimized startup call with database update for fresh outdated packages
        // Database update runs in parallel with other fetches to minimize startup time
        GetStartupDataWithUpdate()
            .then((startupData) => {
                // Ensure all responses are arrays, default to empty arrays if null/undefined
                const safeInstalled = startupData.packages || [];
                const safeInstalledCasks = startupData.casks || [];
                const safeUpdatable = startupData.updatable || [];
                const safeLeaves = startupData.leaves || [];
                const safeRepos = startupData.taps || [];

                // Check for errors in the responses
                if (safeInstalled.length === 1 && safeInstalled[0][0] === "Error") {
                    throw new Error(`${t('errors.failedInstalledPackages')}: ${safeInstalled[0][1]}`);
                }
                if (safeInstalledCasks.length === 1 && safeInstalledCasks[0][0] === "Error") {
                    throw new Error(`${t('errors.failedInstalledCasks')}: ${safeInstalledCasks[0][1]}`);
                }
                if (safeUpdatable.length === 1 && safeUpdatable[0][0] === "Error") {
                    throw new Error(`${t('errors.failedUpdatablePackages')}: ${safeUpdatable[0][1]}`);
                }
                if (safeLeaves.length === 1 && safeLeaves[0]?.startsWith("Error: ")) {
                    throw new Error(`${t('errors.failedLeaves')}: ${safeLeaves[0]}`);
                }
                if (safeRepos.length === 1 && safeRepos[0][0] === "Error") {
                    throw new Error(`${t('errors.failedRepositories')}: ${safeRepos[0][1]}`);
                }

                const installedFormatted = safeInstalled.map(([name, installedVersion, size]) => ({
                    name,
                    installedVersion,
                    size,
                    isInstalled: true,
                }));
                const casksFormatted = safeInstalledCasks.map(([name, installedVersion, size]) => ({
                    name,
                    installedVersion,
                    size,
                    isInstalled: true,
                }));
                const updatableFormatted = safeUpdatable.map(([name, installedVersion, latestVersion, size, warning, type]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    size,
                    isInstalled: true,
                    warning: warning || undefined,
                    isCask: type === "cask",
                }));
                // Format leaves packages with their versions and sizes from installed packages
                const installedMap = new Map(installedFormatted.map(pkg => [pkg.name, { installedVersion: pkg.installedVersion, size: pkg.size }]));
                const leavesFormatted = safeLeaves.map((name) => {
                    const data = installedMap.get(name);
                    return {
                        name,
                        installedVersion: data?.installedVersion || t('common.notAvailable'),
                        size: data?.size,
                        isInstalled: true,
                    };
                });

                // Format repositories
                const reposFormatted = safeRepos.map(([name, status]) => ({
                    name,
                    status,
                    desc: t('common.notAvailable'),
                }));

                setPackages(installedFormatted);
                setCasks(casksFormatted);
                setUpdatablePackages(updatableFormatted);
                setLeavesPackages(leavesFormatted);
                setRepositories(reposFormatted);
                // Note: allPackages are loaded lazily when user switches to "all" view

                // Stop loading timer
                if (loadingTimerInterval.current) {
                    clearInterval(loadingTimerInterval.current);
                    loadingTimerInterval.current = null;
                }
                if (loadingStartTimeRef.current) {
                    const finalTime = Date.now() - loadingStartTimeRef.current;
                    setLoadingElapsedTime(finalTime);
                    loadingStartTimeRef.current = null;
                }

                setLoading(false);

                // Keep timer visible for 5 seconds after loading completes
                setTimeout(() => {
                    setLoadingStartTime(null);
                }, 5000);

                // Initialize last known outdated count
                lastKnownOutdatedCount.current = updatableFormatted.length;

                // Mark initial load as complete after a short delay to allow backend events to fire
                setTimeout(() => {
                    isInitialLoad.current = false;
                }, 3000);

                // Lazy load sizes in the background
                if (installedFormatted.length > 0) {
                    const packageNames = installedFormatted.map(pkg => pkg.name);
                    GetBrewPackageSizes(packageNames)
                        .then((sizes: Record<string, string>) => {
                            setPackages(prevPackages =>
                                prevPackages.map(pkg => ({
                                    ...pkg,
                                    size: sizes[pkg.name] || pkg.size || ""
                                }))
                            );
                            // Update leaves packages if they include this package
                            setLeavesPackages(prevLeaves =>
                                prevLeaves.map(pkg => {
                                    if (sizes[pkg.name]) {
                                        return { ...pkg, size: sizes[pkg.name] };
                                    }
                                    return pkg;
                                })
                            );
                        })
                        .catch((err: unknown) => {
                            console.error("Error loading package sizes:", err);
                        });
                }

                if (casksFormatted.length > 0) {
                    const caskNames = casksFormatted.map(cask => cask.name);
                    GetBrewCaskSizes(caskNames)
                        .then((sizes: Record<string, string>) => {
                            setCasks(prevCasks =>
                                prevCasks.map(cask => ({
                                    ...cask,
                                    size: sizes[cask.name] || cask.size || ""
                                }))
                            );
                        })
                        .catch((err: unknown) => {
                            console.error("Error loading cask sizes:", err);
                        });
                }
            })
            .catch((err) => {
                console.error("Error loading packages:", err);
                // Set empty arrays for all package types to show empty tables instead of crashing
                setPackages([]);
                setUpdatablePackages([]);
                setAllPackages([]);
                setLeavesPackages([]);
                setRepositories([]);

                let errorMessage = t('errors.loadingFormulas') + (err.message || err);

                // Provide helpful error message for common issues on fresh installations
                if (errorMessage.includes("validation failed") || errorMessage.includes("not found")) {
                    errorMessage += "\n\n💡 This commonly happens on fresh Homebrew installations. Please:\n" +
                        "• Make sure Homebrew is properly installed\n" +
                        "• Try running 'brew doctor' in Terminal to check for issues\n" +
                        "• Wait a few minutes for Homebrew to finish setting up, then refresh\n" +
                        "• On first use, Homebrew may need to download formula data which can take time";
                }

                setError(errorMessage);

                // Stop loading timer on error
                if (loadingTimerInterval.current) {
                    clearInterval(loadingTimerInterval.current);
                    loadingTimerInterval.current = null;
                }
                if (loadingStartTimeRef.current) {
                    const finalTime = Date.now() - loadingStartTimeRef.current;
                    setLoadingElapsedTime(finalTime);
                    loadingStartTimeRef.current = null;
                }

                setLoading(false);

                // Keep timer visible for 5 seconds after error
                setTimeout(() => {
                    setLoadingStartTime(null);
                }, 5000);
            });

        // Start background update checking
        startBackgroundUpdateCheck();

        // Cleanup on unmount
        return () => {
            if (backgroundCheckInterval.current) {
                clearInterval(backgroundCheckInterval.current);
            }
            if (loadingTimerInterval.current) {
                clearInterval(loadingTimerInterval.current);
            }
        };
    }, []);

    useEffect(() => {
        const normalizedLanguage = mapToSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);
        if (lastSyncedLanguage.current === normalizedLanguage) {
            return;
        }

        let cancelled = false;
        const syncLanguage = async () => {
            try {
                await SetLanguage(normalizedLanguage);
                if (!cancelled) {
                    lastSyncedLanguage.current = normalizedLanguage;
                }
            } catch (err) {
                console.error("Failed to sync backend language:", err);
            }
        };

        void syncLanguage();
        return () => {
            cancelled = true;
        };
    }, [i18n.language, i18n.resolvedLanguage]);

    // Load all packages when user switches to "all" view
    useEffect(() => {
        if (view === "all" && !allPackagesLoaded && !loadingAllPackages) {
            loadAllPackages();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, allPackagesLoaded, loadingAllPackages]);

    // Apply pending dependency selection once allPackages has finished loading
    useEffect(() => {
        if (!allPackagesLoaded || !pendingDependencyRef.current) return;
        const name = pendingDependencyRef.current;
        pendingDependencyRef.current = null;
        const pkg =
            allPackages.find(p => p.name === name) ||
            packages.find(p => p.name === name) || {
                name,
                installedVersion: "",
                isInstalled: false,
            };
        // Small tick to let the table render its rows before scrolling
        setTimeout(() => handleSelect(pkg), 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allPackagesLoaded, allPackages]);

    // Load all casks when user switches to "allCasks" view
    useEffect(() => {
        if (view === "allCasks" && !allCasksLoaded && !loadingAllCasks) {
            loadAllCasks();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, allCasksLoaded, loadingAllCasks]);

    // Update Dock badge when updatable packages count changes
    useEffect(() => {
        const updateBadge = async () => {
            const count = updatablePackages.length;
            console.log(`[WailBrew] Updating dock badge to: ${count}`);
            
            try {
                // Try async version first
                await SetDockBadgeCount(count);
                console.log(`[WailBrew] Dock badge set successfully (async)`);
            } catch (err) {
                console.error("[WailBrew] Failed to update dock badge (async):", err);
                
                // Try sync version as fallback
                try {
                    await SetDockBadgeCountSync(count);
                    console.log(`[WailBrew] Dock badge set successfully (sync fallback)`);
                } catch (error_) {
                    console.error("[WailBrew] Failed to update dock badge (sync):", error_);
                }
            }
        };
        
        updateBadge();
    }, [updatablePackages.length]);

    // Background update checking function
    const performBackgroundUpdateCheck = async () => {
        if (isBackgroundCheckRunning) return;

        setIsBackgroundCheckRunning(true);
        try {
            // Use the "with update" version to ensure fresh data for background checks
            const updatable = await GetBrewUpdatablePackagesWithUpdate();

            // Check for errors
            if (updatable.length === 1 && updatable[0][0] === "Error") {
                console.error("Background check failed:", updatable[0][1]);
                return;
            }

            const currentCount = updatable.length;
            const previousCount = lastKnownOutdatedCount.current;

            // If there are new outdated packages (increase in count)
            if (currentCount > previousCount) {
                const newPackagesCount = currentCount - previousCount;

                // Update the state
                const formatted = updatable.map(([name, installedVersion, latestVersion, size, warning, type]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    size,
                    isInstalled: true,
                    warning: warning || undefined,
                    isCask: type === "cask",
                }));
                setUpdatablePackages(formatted);

                // Show toast notification
                toast(
                    (t_obj) => (
                        <div className="toast-notification">
                            <div className="toast-leading-icon">
                                <RefreshCw size={20} color="var(--accent)" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                                    {newPackagesCount === 1
                                        ? t('toast.newOutdatedPackages_one', { count: newPackagesCount })
                                        : t('toast.newOutdatedPackages_other', { count: newPackagesCount })
                                    }
                                </div>
                                <button
                                    onClick={() => {
                                        setView("updatable");
                                        toast.dismiss(t_obj.id);
                                    }}
                                    className="toast-action-btn"
                                >
                                    {t('toast.viewOutdated')}
                                </button>
                            </div>
                            <button
                                onClick={() => toast.dismiss(t_obj.id)}
                                className="toast-dismiss-btn"
                                title="Dismiss"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ),
                    {
                        id: 'startup-outdated-discovered',
                        duration: 8000,
                        position: 'bottom-center',
                        style: customToastStyle,
                    }
                );
            }

            // Update last known count
            lastKnownOutdatedCount.current = currentCount;
        } catch (error) {
            console.error("Background update check error:", error);
        } finally {
            setIsBackgroundCheckRunning(false);
            // Update next check time
            nextCheckTime.current = Date.now() + 15 * 60 * 1000;
        }
    };

    // Start background update checking
    const startBackgroundUpdateCheck = () => {
        // Perform initial check after a short delay
        setTimeout(() => {
            performBackgroundUpdateCheck();
        }, 2000);

        // Set up interval for checking every 15 minutes
        backgroundCheckInterval.current = setInterval(() => {
            performBackgroundUpdateCheck();
        }, 15 * 60 * 1000); // 15 minutes
    };

    // Get seconds until next background check (computed on demand, no re-renders)
    const getSecondsUntilNextCheck = (): number => {
        const timeRemaining = Math.max(0, nextCheckTime.current - Date.now());
        return Math.floor(timeRemaining / 1000);
    };

    // Check if WailBrew itself is outdated by looking at the updatable packages list.
    // This runs reactively once updatablePackages are loaded, avoiding a separate backend call.
    useEffect(() => {
        if (updateCheckDone.current || updatablePackages.length === 0 && loading) return;
        updateCheckDone.current = true;

        const wailbrewPackage = updatablePackages.find(pkg => pkg.name.toLowerCase() === "wailbrew");

        if (wailbrewPackage) {
            toast.dismiss('startup-up-to-date');
            const upgradeCommand = 'brew update\nbrew upgrade --cask wailbrew';

            toast(
                (t_obj) => {
                    const handleNavigateToOutdated = () => {
                        setView("updatable");
                        handleSelect(wailbrewPackage);
                        toast.dismiss(t_obj.id);
                    };

                    return (
                        <div className="toast-notification">
                            <div className="toast-leading-icon">
                                <Sparkles size={20} color="#FFD700" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{t('toast.updateAvailable')}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                                    {t('toast.versionReady', { version: wailbrewPackage.latestVersion })}
                                </div>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginTop: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontFamily: 'monospace',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        outline: 'none',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(upgradeCommand);
                                        toast.success('Copied to clipboard!', { duration: 2000 });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(upgradeCommand);
                                            toast.success('Copied to clipboard!', { duration: 2000 });
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                                    }}
                                    title="Click to copy"
                                >
                                    <code style={{ flex: 1, fontSize: '0.8rem' }}>{upgradeCommand}</code>
                                    <Copy size={16} style={{ opacity: 0.7 }} />
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleNavigateToOutdated();
                                    }}
                                    style={{
                                        marginTop: '0.75rem',
                                        padding: '0.5rem 1rem',
                                        background: 'rgba(80, 180, 255, 0.2)',
                                        border: '1px solid rgba(80, 180, 255, 0.4)',
                                        borderRadius: '6px',
                                        color: 'var(--accent)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        transition: 'all 0.2s',
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(80, 180, 255, 0.3)';
                                        e.currentTarget.style.borderColor = 'rgba(80, 180, 255, 0.6)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(80, 180, 255, 0.2)';
                                        e.currentTarget.style.borderColor = 'rgba(80, 180, 255, 0.4)';
                                    }}
                                >
                                    <RefreshCw size={16} />
                                    {t('toast.viewOutdated')}
                                </button>
                            </div>
                            <button
                                onClick={() => toast.dismiss(t_obj.id)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.2s',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                                }}
                                title="Dismiss"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    );
                },
                {
                    id: 'startup-wailbrew-update',
                    duration: 6000,
                    position: 'bottom-center',
                    style: customToastStyle,
                }
            );
        } else {
            toast.dismiss('startup-wailbrew-update');
            toast(
                (t_obj) => (
                    <div className="toast-notification">
                        <div className="toast-leading-icon">
                            <CheckSquare size={20} color="#4CAF50" />
                        </div>
                        <span style={{ flex: 1 }}>{t('toast.upToDate')}</span>
                        <button
                            onClick={() => toast.dismiss(t_obj.id)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255, 255, 255, 0.6)',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s',
                                flexShrink: 0,
                                marginLeft: 'auto',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                            }}
                            title="Dismiss"
                        >
                            <X size={18} />
                        </button>
                    </div>
                ),
                {
                    id: 'startup-up-to-date',
                    duration: 4000,
                    position: 'bottom-center',
                    style: customToastStyle,
                }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updatablePackages, loading]);

    // Refs for PackageTable components to focus on Cmd+T
    const packageTableRef = useRef<import('./components/PackageTable').PackageTableRef | null>(null);

    // Pending dependency selection: set when allPackages isn't loaded yet
    const pendingDependencyRef = useRef<string | null>(null);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux) - Command Palette
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setShowCommandPalette(prev => !prev);
            }
            // Check for Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux) - Shortcuts
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                setShowShortcuts(prev => !prev);
            }
            // Check for Cmd+T (Mac) or Ctrl+T (Windows/Linux) - Focus table
            if ((event.metaKey || event.ctrlKey) && event.key === 't') {
                // Don't trigger if user is typing in an input field
                const target = event.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
                event.preventDefault();
                if (packageTableRef.current) {
                    packageTableRef.current.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        const unlisten = EventsOn("setView", (data: string) => {
            setView(data as "installed" | "casks" | "updatable" | "all" | "allCasks" | "leaves" | "repositories" | "homebrew" | "doctor" | "cleanup" | "settings");
            clearSelection();
        });
        const unlistenRefresh = EventsOn("refreshPackages", () => {
            window.location.reload();
        });
        const unlistenRefreshPackages = EventsOn("refreshPackagesData", () => {
            handleRefreshPackages();
        });
        const unlistenAbout = EventsOn("showAbout", () => {
            setShowAbout(true);
        });
        const unlistenUpdate = EventsOn("checkForUpdates", () => {
            setShowUpdate(true);
        });
        const unlistenWailbrewUpdated = EventsOn("wailbrewUpdated", () => {
            setShowRestart(true);
        });
        const unlistenCommandPalette = EventsOn("showCommandPalette", () => {
            setShowCommandPalette(prev => !prev);
        });
        const unlistenShortcuts = EventsOn("showShortcuts", () => {
            setShowShortcuts(prev => !prev);
        });
        const unlistenSessionLogs = EventsOn("showSessionLogs", async () => {
            try {
                const logs = await GetSessionLogs();
                setSessionLogs(logs || "No logs available.");
                setShowSessionLogs(true);
            } catch (error) {
                console.error("Failed to get session logs:", error);
                setSessionLogs("Failed to load session logs.");
                setShowSessionLogs(true);
            }
        });
        const unlistenNewPackages = EventsOn("newPackagesDiscovered", (data: string) => {
            try {
                const packageInfo = JSON.parse(data);
                const { newFormulae = [], newCasks = [] } = packageInfo;
                const totalNew = newFormulae.length + newCasks.length;

                // Only show toast on initial app load, not on manual refresh
                if (totalNew > 0 && isInitialLoad.current) {
                    // Dismiss any existing new packages toast to prevent duplicates
                    toast.dismiss('newPackagesDiscovered');

                    const formulaeText = newFormulae.length > 0
                        ? `${newFormulae.length} ${t('toast.newFormula', { count: newFormulae.length })}`
                        : '';
                    const casksText = newCasks.length > 0
                        ? `${newCasks.length} ${t('toast.newCask', { count: newCasks.length })}`
                        : '';
                    const message = [formulaeText, casksText].filter(Boolean).join(t('toast.and'));

                    toast(
                        (t_obj) => (
                            <div className="toast-notification">
                                <div className="toast-leading-icon">
                                    <Sparkles size={20} color="#22C55E" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                                        {t('toast.newPackagesDiscovered', { count: totalNew, message })}
                                    </div>
                                    {(newFormulae.length > 0 || newCasks.length > 0) && (
                                        <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
                                            {newFormulae.length > 0 && (
                                                <div style={{ marginBottom: '0.25rem' }}>
                                                    <strong>{t('toast.newFormulaeLabel')}</strong> {newFormulae.slice(0, 5).join(', ')}
                                                    {newFormulae.length > 5 && ` ${t('toast.andMore', { count: newFormulae.length - 5 })}`}
                                                </div>
                                            )}
                                            {newCasks.length > 0 && (
                                                <div>
                                                    <strong>{t('toast.newCasksLabel')}</strong> {newCasks.slice(0, 5).join(', ')}
                                                    {newCasks.length > 5 && ` ${t('toast.andMore', { count: newCasks.length - 5 })}`}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setView("all");
                                            toast.dismiss(t_obj.id);
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: 'rgba(34, 197, 94, 0.8)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(34, 197, 94, 1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(34, 197, 94, 0.8)';
                                        }}
                                    >
                                        {t('toast.viewAllPackages')}
                                    </button>
                                </div>
                                <button
                                    onClick={() => toast.dismiss(t_obj.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'color 0.2s',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                                    }}
                                    title="Dismiss"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ),
                        {
                            id: 'newPackagesDiscovered',
                            duration: 10000,
                            position: 'bottom-center',
                            style: customToastStyle,
                        }
                    );
                }
            } catch (error) {
                console.error("Failed to parse new packages data:", error);
            }
        });
        return () => {
            unlisten();
            unlistenRefresh();
            unlistenAbout();
            unlistenUpdate();
            unlistenWailbrewUpdated();
            unlistenCommandPalette();
            unlistenShortcuts();
            unlistenSessionLogs();
            unlistenNewPackages();
        };
    }, []);

    // Clear search query when view changes
    useEffect(() => {
        setSearchQuery("");
    }, [view]);

    // Check Homebrew version when homebrew view is opened
    useEffect(() => {
        if (view === "homebrew") {
            const checkVersion = async () => {
                try {
                    const version = await GetHomebrewVersion();
                    setHomebrewVersion(version);

                    // Check if update is available
                    const updateInfo = await CheckHomebrewUpdate();
                    if (updateInfo) {
                        setHomebrewUpdateStatus({
                            isUpToDate: updateInfo.isUpToDate as boolean,
                            latestVersion: updateInfo.latestVersion as string,
                        });
                        // Refresh version if it was updated
                        if (!updateInfo.isUpToDate) {
                            const newVersion = await GetHomebrewVersion();
                            setHomebrewVersion(newVersion);
                        }
                    }
                } catch (error) {
                    console.error("Failed to check Homebrew version:", error);
                    setHomebrewVersion("N/A");
                }
            };
            checkVersion();
        }
    }, [view, t]);

    // Sidebar resize handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const newWidth = e.clientX;
            if (newWidth >= 180 && newWidth <= 400) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                localStorage.setItem('sidebarWidth', sidebarWidth.toString());
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, sidebarWidth]);

    const handleResizeStart = () => {
        setIsResizing(true);
    };

    const getActivePackages = () => {
        switch (view) {
            case "installed":
                return packages;
            case "casks":
                return casks;
            case "updatable":
                return updatablePackages;
            case "all":
                return allPackages;
            case "allCasks":
                return allCasksAll;
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

    const handleSelectDependency = async (dependencyName: string) => {
        // Clear search first to ensure package is visible
        setSearchQuery("");

        // Switch to "all" view
        setView("all");

        if (allPackagesLoaded) {
            // Packages already loaded — find & select immediately
            const pkg =
                allPackages.find(p => p.name === dependencyName) ||
                packages.find(p => p.name === dependencyName) || {
                    name: dependencyName,
                    installedVersion: "",
                    isInstalled: false,
                };
            // Small tick so the table has rendered after the view switch
            setTimeout(() => handleSelect(pkg), 50);
        } else {
            // allPackages not loaded yet — store name and let the effect handle it
            // once loadAllPackages() finishes (triggered by the view === "all" effect above)
            pendingDependencyRef.current = dependencyName;
        }
    };

    const handleRemoveConfirmed = async () => {
        if (!selectedPackage) return;
        setShowConfirm(false);
        setUninstallLogs(t('dialogs.uninstalling', { name: selectedPackage.name }));
        setIsUninstallRunning(true);

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

            // If we're on the doctor view, refresh deprecated formulae
            if (view === "doctor" && doctorLog) {
                const deprecated = await GetDeprecatedFormulae(doctorLog);
                setDeprecatedFormulae(deprecated || []);
            }

            setIsUninstallRunning(false);

            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the uninstall process
        await RemoveBrewPackage(selectedPackage.name);
    };

    const handleUntapPackageClick = async (packageName: string) => {
        // Close the log dialog
        setUntapLogs(null);
        setUntapLogPackages([]);

        // Navigate to the package in "installed" view
        setSearchQuery("");

        // Try to find the package in installed packages first
        let pkg = packages.find(p => p.name === packageName);

        // If not found in installed packages, check all packages
        if (!pkg) {
            pkg = allPackages.find(p => p.name === packageName);
        }

        if (!pkg) {
            // Create a minimal package entry if not found
            pkg = {
                name: packageName,
                installedVersion: "",
                isInstalled: false,
            };
        }

        // Switch to "installed" view to show installed packages
        setView("installed");

        // Use setTimeout to ensure view renders and then select & scroll to package
        setTimeout(async () => {
            await handleSelect(pkg!);
        }, 200);
    };

    const handleUpdate = (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setShowUpdateConfirm(true);
    };

    const handleUpdateConfirmed = async () => {
        if (!selectedPackage) return;
        
        // Clean up any existing listeners first (prevents duplicate listeners bug)
        if (updateListenersRef.current.progress) updateListenersRef.current.progress();
        if (updateListenersRef.current.complete) updateListenersRef.current.complete();
        
        setShowUpdateConfirm(false);
        setIsUpdateAllOperation(false);
        setUpdateLogs(t('dialogs.updating', { name: selectedPackage.name }));
        setIsUpdateRunning(true);

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
            // Clear cache and update the package list after successful update
            await ClearBrewCache();
            const updated = await GetBrewUpdatablePackages();
            const formatted = updated.map(([name, installedVersion, latestVersion, size, warning, type]) => ({
                name,
                installedVersion,
                latestVersion,
                size,
                isInstalled: true,
                warning: warning || undefined,
                isCask: type === "cask",
            }));
            setUpdatablePackages(formatted);
            setIsUpdateRunning(false);

            // Clean up event listeners
            updateListenersRef.current.progress?.();
            updateListenersRef.current.complete?.();
            updateListenersRef.current = { progress: null, complete: null };
        });

        // Store cleanup functions in ref for cleanup on dialog close
        updateListenersRef.current = { progress: progressListener, complete: completeListener };

        // Start the update process
        await UpdateBrewPackage(selectedPackage.name);
    };

    const handleUpdateAllConfirmed = async () => {
        // Clean up any existing listeners first (prevents duplicate listeners bug)
        if (updateListenersRef.current.progress) updateListenersRef.current.progress();
        if (updateListenersRef.current.complete) updateListenersRef.current.complete();
        
        setShowUpdateAllConfirm(false);
        setIsUpdateAllOperation(true);
        setCurrentlyUpdatingPackage(null);
        setUpdateLogs(t('dialogs.updatingAll'));
        setIsUpdateRunning(true);

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageUpdateProgress", (progress: string) => {
            // Parse the progress message to detect which package is being updated
            // Brew typically outputs lines like "==> Upgrading <package>" or "==> Downloading <package>"
            const upgradingRegex = /==> (?:Upgrading|Pouring|Installing|Downloading) ([^\s]+)/;
            const upgradingMatch = upgradingRegex.exec(progress);
            const packageNameWithVersion = upgradingMatch?.[1];
            if (packageNameWithVersion) {
                const packageName = packageNameWithVersion.split(/[@\s]/)[0]; // Remove version info if present
                setCurrentlyUpdatingPackage(packageName);
            }

            setUpdateLogs(prevLogs => {
                if (!prevLogs) {
                    return `${t('dialogs.updateAllLogs')}\n${progress}`;
                }
                return prevLogs + '\n' + progress;
            });
        });

        const completeListener = EventsOn("packageUpdateComplete", async (finalMessage: string) => {
            // Update all package lists after successful update
            await handleRefreshPackages();
            setIsUpdateRunning(false);
            setCurrentlyUpdatingPackage(null);

            // Clean up event listeners
            updateListenersRef.current.progress?.();
            updateListenersRef.current.complete?.();
            updateListenersRef.current = { progress: null, complete: null };
        });

        // Store cleanup functions in ref for cleanup on dialog close
        updateListenersRef.current = { progress: progressListener, complete: completeListener };

        // Start the update all process
        await UpdateAllBrewPackages();
    };

    const handleShowInfoLogs = async (pkg: PackageEntry) => {
        if (!pkg) return;

        // Increment request ID to track this specific request
        const currentRequestId = ++infoRequestIdRef.current;

        setInfoPackage(pkg);
        setInfoLogs(t('dialogs.gettingInfo', { name: pkg.name }));

        const info = await GetBrewPackageInfo(pkg.name);

        // Only update if this request is still the current one (dialog wasn't closed)
        if (currentRequestId === infoRequestIdRef.current) {
            setInfoLogs(info);
        }
    };

    // Multi-select handlers
    const toggleMultiSelectMode = () => {
        setMultiSelectMode(!multiSelectMode);
        setSelectedPackages(new Set());
        if (multiSelectMode) {
            // Exiting multi-select mode, restore normal selection
            setSelectedPackage(null);
        }
    };

    const togglePackageSelection = (packageName: string) => {
        const newSelected = new Set(selectedPackages);
        if (newSelected.has(packageName)) {
            newSelected.delete(packageName);
        } else {
            newSelected.add(packageName);
        }
        setSelectedPackages(newSelected);
    };

    const selectAllPackages = () => {
        const allNames = new Set(filteredPackages.map(pkg => pkg.name));
        setSelectedPackages(allNames);
    };

    const deselectAllPackages = () => {
        setSelectedPackages(new Set());
    };

    const handleUpdateSelected = () => {
        if (selectedPackages.size === 0) return;
        setShowUpdateSelectedConfirm(true);
    };

    const handleUpdateSelectedConfirmed = async () => {
        // Clean up any existing listeners first (prevents duplicate listeners bug)
        if (updateListenersRef.current.progress) updateListenersRef.current.progress();
        if (updateListenersRef.current.complete) updateListenersRef.current.complete();
        
        setShowUpdateSelectedConfirm(false);
        setIsUpdateAllOperation(true);

        const packageNames = Array.from(selectedPackages);
        setUpdateLogs(t('dialogs.updatingSelected', { count: packageNames.length }));
        setIsUpdateRunning(true);

        // Set up event listeners for live progress
        const progressListener = EventsOn("packageUpdateProgress", (progress: string) => {
            setUpdateLogs(prevLogs => {
                if (!prevLogs) {
                    return progress;
                }
                return `${prevLogs}\n${progress}`;
            });
        });

        const completeListener = EventsOn("packageUpdateComplete", async (finalMessage: string) => {
            // Update the package list after successful update
            await handleRefreshPackages();

            setIsUpdateRunning(false);

            // Clear selections after successful update
            setSelectedPackages(new Set());
            setMultiSelectMode(false);

            // Clean up event listeners
            updateListenersRef.current.progress?.();
            updateListenersRef.current.complete?.();
            updateListenersRef.current = { progress: null, complete: null };
        });

        // Store cleanup functions in ref for cleanup on dialog close
        updateListenersRef.current = { progress: progressListener, complete: completeListener };

        // Start the update process for selected packages
        await UpdateSelectedBrewPackages(packageNames);
    };

    // Helper for clearing selection and closing contextual dialogs
    const clearSelection = () => {
        setSelectedPackage(null);
        setSelectedRepository(null);

        // Close contextual dialogs when navigating to a different view
        // Info logs are specific to a package in a view, so close them
        setInfoLogs(null);
        setInfoPackage(null);

        // Close confirmation dialogs as they're contextual to the current view
        setShowConfirm(false);
        setShowInstallConfirm(false);
        setShowUpdateConfirm(false);

        // Clear multi-select state when changing views
        setMultiSelectMode(false);
        setSelectedPackages(new Set());
        setShowUpdateAllConfirm(false);

        // Note: We keep update/install/uninstall logs open if operations are running
        // as these are long-running operations that users may want to monitor
    };

    // Helper to determine the update log dialog title
    const getUpdateLogTitle = () => {
        if (isUpdateAllOperation && currentlyUpdatingPackage) {
            return t('dialogs.updateLogs', { name: currentlyUpdatingPackage });
        }
        if (selectedPackage) {
            return t('dialogs.updateLogs', { name: selectedPackage.name });
        }
        return t('dialogs.updateAllLogs');
    };

    const handleUninstallPackage = (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setShowConfirm(true);
    };

    const handleUntapRepository = (repo: RepositoryEntry) => {
        setSelectedRepository(repo);
        setShowUntapConfirm(true);
    };

    const handleUntapConfirmed = async () => {
        if (!selectedRepository) return;
        setShowUntapConfirm(false);
        setUntapLogs(t('dialogs.untapping', { name: selectedRepository.name }));

        // Use a ref to accumulate logs for error checking
        const logsRef = { current: t('dialogs.untapping', { name: selectedRepository.name }) };

        // Set up event listeners for live progress
        const progressListener = EventsOn("repositoryUntapProgress", (progress: string) => {
            setUntapLogs(prevLogs => {
                const newLogs = prevLogs ? prevLogs + '\n' + progress : `${t('dialogs.untapLogs', { name: selectedRepository.name })}\n${progress}`;
                logsRef.current = newLogs;
                return newLogs;
            });
        });

        const completeListener = EventsOn("repositoryUntapComplete", async (finalMessage: string) => {
            // Get the final accumulated logs including the final message
            const allLogs = logsRef.current + '\n' + finalMessage;

            // Check if untap failed due to installed packages
            const isError = allLogs.includes("❌") || allLogs.includes("failed") || allLogs.includes("Error:");
            const hasInstalledPackages = allLogs.includes("contains the following installed") ||
                allLogs.includes("installed formulae or casks");

            if (isError && hasInstalledPackages) {
                // Parse the error message to extract package names
                const packages: string[] = [];
                const lines = allLogs.split('\n');
                let inPackageList = false;

                for (const line of lines) {
                    const trimmed = line.trim();
                    // Look for the error message that indicates installed packages
                    if (trimmed.includes("contains the following installed")) {
                        inPackageList = true;
                        continue;
                    }
                    // Extract package names (they appear after the error message, usually indented or with warning icons)
                    if (inPackageList && trimmed.length > 0) {
                        // Remove emoji/icon prefixes and extract package name
                        const cleanName = trimmed
                            .replace(/^⚠️\s*/, '')
                            .replace(/^▲\s*/, '')
                            .replace(/^🗑️\s*/, '')
                            .replace(/^❌\s*/, '')
                            .trim();
                        // Skip if it's still an error message line
                        if (!cleanName.includes("Error:") &&
                            !cleanName.includes("failed") &&
                            cleanName.length > 0 &&
                            !cleanName.includes("exit status") &&
                            !cleanName.includes("Refusing to untap") &&
                            !cleanName.includes("because it contains")) {
                            packages.push(cleanName);
                        }
                    }
                    // Stop if we hit the final error message
                    if (trimmed.includes("failed:") || trimmed.includes("exit status")) {
                        break;
                    }
                }

                if (packages.length > 0) {
                    // Make packages clickable in the log dialog
                    setUntapLogPackages(packages);
                    // Keep the log dialog open so user can click on package links

                    // Clean up event listeners
                    progressListener();
                    completeListener();
                    return;
                }
            }

            // Update the repository list after successful untap
            await handleRefreshPackages();
            setUntapLogs(null);
            setUntapLogPackages([]);

            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the untap process
        await UntapBrewRepository(selectedRepository.name);
    };

    const handleTapRepository = () => {
        setShowTapInput(true);
    };

    const handleShowRepositoryInfo = async (repo: RepositoryEntry) => {
        setShowRepositoryInfo(true);
        setRepositoryInfoLogs(t('dialogs.gettingInfo', { name: repo.name }));

        try {
            const info = await GetBrewTapInfo(repo.name);
            setRepositoryInfoLogs(info);
        } catch (error) {
            setRepositoryInfoLogs(t('dialogs.packageInfo') + `\nError: ${error}`);
        }
    };

    const handleTapConfirmed = async (tapName: string) => {
        setShowTapInput(false);
        setTappingRepository(tapName);
        setTapLogs(t('dialogs.tapping', { name: tapName }));

        // Store current package lists before tapping
        const [oldAllPackages, oldCasks] = await Promise.all([
            GetAllBrewPackages(),
            GetBrewCasks()
        ]);

        const oldAllPackagesSet = new Set(oldAllPackages.map(([name]: string[]) => name));
        const oldCasksSet = new Set(oldCasks.map(([name]: string[]) => name));

        // Set up event listeners for live progress
        const progressListener = EventsOn("repositoryTapProgress", (progress: string) => {
            setTapLogs(prevLogs => {
                if (!prevLogs) {
                    return `${t('dialogs.tapLogs', { name: tapName })}\n${progress}`;
                }
                return prevLogs + '\n' + progress;
            });
        });

        const completeListener = EventsOn("repositoryTapComplete", async (finalMessage: string) => {
            // Check if tap was successful (not an error message)
            const isSuccess = !finalMessage.includes("❌") && !finalMessage.includes("failed");

            if (isSuccess) {
                // Get new package lists after tapping
                const [newAllPackages, newCasks] = await Promise.all([
                    GetAllBrewPackages(),
                    GetBrewCasks()
                ]);

                // Find new packages
                const newFormulae: string[] = [];
                const newCasksList: string[] = [];

                newAllPackages.forEach(([name]: string[]) => {
                    if (!oldAllPackagesSet.has(name)) {
                        newFormulae.push(name);
                    }
                });

                newCasks.forEach(([name]: string[]) => {
                    if (!oldCasksSet.has(name)) {
                        newCasksList.push(name);
                    }
                });

                const totalNew = newFormulae.length + newCasksList.length;

                // Show toast notification if new packages were discovered
                if (totalNew > 0) {
                    toast.dismiss('newPackagesDiscovered');

                    const formulaeText = newFormulae.length > 0
                        ? `${newFormulae.length} ${t('toast.newFormula', { count: newFormulae.length })}`
                        : '';
                    const casksText = newCasksList.length > 0
                        ? `${newCasksList.length} ${t('toast.newCask', { count: newCasksList.length })}`
                        : '';
                    const message = [formulaeText, casksText].filter(Boolean).join(t('toast.and'));

                    toast(
                        (t_obj) => (
                            <div className="toast-notification">
                                <div className="toast-leading-icon">
                                    <Sparkles size={20} color="#22C55E" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                                        {t('toast.newPackagesDiscovered', { count: totalNew, message })}
                                    </div>
                                    {(newFormulae.length > 0 || newCasksList.length > 0) && (
                                        <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
                                            {newFormulae.length > 0 && (
                                                <div style={{ marginBottom: '0.25rem' }}>
                                                    <strong>{t('toast.newFormulaeLabel')}</strong> {newFormulae.slice(0, 5).join(', ')}
                                                    {newFormulae.length > 5 && ` ${t('toast.andMore', { count: newFormulae.length - 5 })}`}
                                                </div>
                                            )}
                                            {newCasksList.length > 0 && (
                                                <div>
                                                    <strong>{t('toast.newCasksLabel')}</strong> {newCasksList.slice(0, 5).join(', ')}
                                                    {newCasksList.length > 5 && ` ${t('toast.andMore', { count: newCasksList.length - 5 })}`}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setView("all");
                                            toast.dismiss(t_obj.id);
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: 'rgba(34, 197, 94, 0.8)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(34, 197, 94, 1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(34, 197, 94, 0.8)';
                                        }}
                                    >
                                        {t('toast.viewAllPackages')}
                                    </button>
                                </div>
                                <button
                                    onClick={() => toast.dismiss(t_obj.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'color 0.2s',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                                    }}
                                    title="Dismiss"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ),
                        {
                            id: 'newPackagesDiscovered',
                            duration: 10000,
                            position: 'bottom-center',
                            style: customToastStyle,
                        }
                    );
                }
            }

            // Update the repository list after tap completion
            await handleRefreshPackages();
            setTapLogs(null);
            setTappingRepository(null);

            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the tap process
        await TapBrewRepository(tapName);
    };

    const handleInstallPackage = (pkg: PackageEntry) => {
        setSelectedPackage(pkg);
        setShowInstallConfirm(true);
    };

    const handleInstallConfirmed = async () => {
        if (!selectedPackage) return;
        setShowInstallConfirm(false);
        setInstallLogs(t('dialogs.installing', { name: selectedPackage.name }));
        setIsInstallRunning(true);

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

            setIsInstallRunning(false);

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

    // Function to load all packages (lazy loaded)
    const loadAllPackages = async () => {
        if (loadingAllPackages) return; // Prevent duplicate loads

        setLoadingAllPackages(true);
        try {
            // Fetch both all available and currently installed packages from backend
            const [all, installed] = await Promise.all([
                GetAllBrewPackages(),
                GetBrewPackages(),
            ]);
            const safeAll = all || [];

            if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                setError(`${t('errors.failedAllPackages')}: ${safeAll[0][1]}`);
                setAllPackages([]);
                setAllPackagesLoaded(false);
            } else {
                const installedNames = new Set(
                    (installed || [])
                        .filter(pkg => pkg.length > 0 && pkg[0] !== "Error")
                        .map(pkg => pkg[0])
                );
                const formatted = safeAll.map(([name, desc, size]) => ({
                    name,
                    installedVersion: "",
                    desc,
                    size,
                    isInstalled: installedNames.has(name),
                }));
                setAllPackages(formatted);
                setAllPackagesLoaded(true);
            }
        } catch (err) {
            console.error("Error loading all packages:", err);
            setAllPackages([]);
            setAllPackagesLoaded(false);
        } finally {
            setLoadingAllPackages(false);
        }
    };

    // Function to load all casks (lazy loaded)
    const loadAllCasks = async () => {
        if (loadingAllCasks) return; // Prevent duplicate loads

        setLoadingAllCasks(true);
        try {
            // Fetch both all available and currently installed casks from backend
            const [all, installed] = await Promise.all([
                GetAllBrewCasks(),
                GetBrewCasks(),
            ]);
            const safeAll = all || [];

            if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                setError(`${t('errors.failedAllCasks')}: ${safeAll[0][1]}`);
                setAllCasksAll([]);
                setAllCasksLoaded(false);
            } else {
                const installedNames = new Set(
                    (installed || [])
                        .filter(pkg => pkg.length > 0 && pkg[0] !== "Error")
                        .map(pkg => pkg[0])
                );
                const formatted = safeAll.map(([name, desc, size]) => ({
                    name,
                    installedVersion: "",
                    desc,
                    size,
                    isInstalled: installedNames.has(name),
                }));
                setAllCasksAll(formatted);
                setAllCasksLoaded(true);
            }
        } catch (err) {
            console.error("Error loading all casks:", err);
            setAllCasksAll([]);
            setAllCasksLoaded(false);
        } finally {
            setLoadingAllCasks(false);
        }
    };

    const handleRefreshPackages = async () => {
        setLoading(true);
        setError("");

        // Clear existing data to show clean loading state
        setPackages([]);
        setCasks([]);
        setUpdatablePackages([]);
        setAllPackages([]);
        setAllPackagesLoaded(false);
        setAllCasksAll([]);
        setAllCasksLoaded(false);
        setLeavesPackages([]);
        setRepositories([]);

        try {
            // Clear cache to ensure fresh data on manual refresh
            await ClearBrewCache();

            // Use single optimized startup call with database update for fresh data
            const startupData = await GetStartupDataWithUpdate();

            // Process the data same as in useEffect
            const safeInstalled = startupData.packages || [];
            const safeInstalledCasks = startupData.casks || [];
            const safeUpdatable = startupData.updatable || [];
            const safeLeaves = startupData.leaves || [];
            const safeRepos = startupData.taps || [];

            if (safeInstalled.length === 1 && safeInstalled[0][0] === "Error") {
                setError(safeInstalled[0][1]);
                setPackages([]);
            } else {
                const formatted = safeInstalled.map(([name, installedVersion, size]) => ({
                    name,
                    installedVersion,
                    size,
                    isInstalled: true,
                }));
                setPackages(formatted);

                // Lazy load package sizes in the background
                if (formatted.length > 0) {
                    const packageNames = formatted.map(pkg => pkg.name);
                    GetBrewPackageSizes(packageNames)
                        .then((sizes: Record<string, string>) => {
                            setPackages(prevPackages =>
                                prevPackages.map(pkg => ({
                                    ...pkg,
                                    size: sizes[pkg.name] || pkg.size || ""
                                }))
                            );
                            // Update leaves packages if they include this package
                            setLeavesPackages(prevLeaves =>
                                prevLeaves.map(pkg => {
                                    if (sizes[pkg.name]) {
                                        return { ...pkg, size: sizes[pkg.name] };
                                    }
                                    return pkg;
                                })
                            );
                        })
                        .catch((err: unknown) => {
                            console.error("Error loading package sizes:", err);
                        });
                }
            }

            let casksFormatted: PackageEntry[] = [];
            if (safeInstalledCasks.length === 1 && safeInstalledCasks[0][0] === "Error") {
                setCasks([]);
            } else {
                casksFormatted = safeInstalledCasks.map(([name, installedVersion, size]) => ({
                    name,
                    installedVersion,
                    size,
                    isInstalled: true,
                }));
                setCasks(casksFormatted);

                // Lazy load cask sizes in the background
                if (casksFormatted.length > 0) {
                    const caskNames = casksFormatted.map(cask => cask.name);
                    GetBrewCaskSizes(caskNames)
                        .then((sizes: Record<string, string>) => {
                            setCasks(prevCasks =>
                                prevCasks.map(cask => ({
                                    ...cask,
                                    size: sizes[cask.name] || cask.size || ""
                                }))
                            );
                        })
                        .catch((err: unknown) => {
                            console.error("Error loading cask sizes:", err);
                        });
                }
            }

            if (safeUpdatable.length === 1 && safeUpdatable[0][0] === "Error") {
                setUpdatablePackages([]);
            } else {
                const formatted = safeUpdatable.map(([name, installedVersion, latestVersion, size, warning, type]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    size,
                    isInstalled: true,
                    warning: warning || undefined,
                    isCask: type === "cask",
                }));
                setUpdatablePackages(formatted);
            }

            // Note: allPackages are loaded lazily when user switches to "all" view

            if (safeLeaves.length === 1 && safeLeaves[0] === "Error") {
                setLeavesPackages([]);
            } else {
                const installedMap = new Map(safeInstalled.map(([name, installedVersion, size]) => [name, { installedVersion, size }]));
                const formatted = safeLeaves.map((name) => {
                    const data = installedMap.get(name);
                    return {
                        name,
                        installedVersion: data?.installedVersion || t('common.notAvailable'),
                        size: data?.size,
                        isInstalled: true,
                    };
                });
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
        { key: "name", label: t('tableColumns.name'), sortable: true },
        { key: "installedVersion", label: t('tableColumns.version'), sortable: false },
        { key: "size", label: t('tableColumns.size'), sortable: true },
        { key: "actions", label: t('tableColumns.actions'), sortable: false },
    ];
    const columnsUpdatable = [
        { key: "name", label: t('tableColumns.name'), sortable: true },
        { key: "installedVersion", label: t('tableColumns.version'), sortable: false },
        { key: "latestVersion", label: t('tableColumns.latestVersion'), sortable: false },
        { key: "size", label: t('tableColumns.size'), sortable: true },
        { key: "actions", label: t('tableColumns.actions'), sortable: false },
    ];
    const columnsAll = [
        { key: "name", label: t('tableColumns.name'), sortable: true },
        { key: "isInstalled", label: t('tableColumns.status'), sortable: true },
        { key: "actions", label: t('tableColumns.actions'), sortable: false },
    ];
    const columnsLeaves = columnsInstalled;

    return (
        <div className="wailbrew-container">
            <Sidebar
                view={view}
                setView={setView}
                packagesCount={packages.length}
                casksCount={casks.length}
                updatableCount={updatablePackages.length}
                allCount={allPackagesLoaded ? allPackages.length : -1}
                allCasksCount={allCasksLoaded ? allCasksAll.length : -1}
                leavesCount={leavesPackages.length}
                repositoriesCount={repositories.length}
                onClearSelection={clearSelection}
                sidebarWidth={sidebarWidth}
                sidebarRef={sidebarRef}
                isBackgroundCheckRunning={isBackgroundCheckRunning}
                getSecondsUntilNextCheck={getSecondsUntilNextCheck}
            />
            <div
                className="sidebar-resize-handle"
                onMouseDown={handleResizeStart}
            />
            <main className="content">
                {/* Loading timer for development only */}
                {import.meta.env.DEV && loadingStartTime !== null && (
                    <div className="loading-timer">
                        ⏱️ {loadingElapsedTime > 0 ? (loadingElapsedTime / 1000).toFixed(2) : '0.00'}s
                    </div>
                )}
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
                                    <RefreshCw size={18} />
                                </button>
                            }
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            ref={view === "installed" ? packageTableRef : null}
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
                                    onSelectDependency={handleSelectDependency}
                                />
                            </div>
                            <div className="package-footer">
                                {t('footers.installedFormulas')}
                            </div>
                        </div>
                    </>
                )}
                {view === "casks" && (
                    <>
                        <HeaderRow
                            title={t('headers.installedCasks', { count: casks.length })}
                            actions={
                                <button
                                    className="refresh-button"
                                    onClick={handleRefreshPackages}
                                    disabled={loading}
                                    title={t('buttons.refresh')}
                                >
                                    <RefreshCw size={18} />
                                </button>
                            }
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            ref={view === "casks" ? packageTableRef : null}
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
                                    onSelectDependency={handleSelectDependency}
                                />
                            </div>
                            <div className="package-footer">
                                {t('footers.installedCasks')}
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
                                        <>
                                            <button
                                                className={multiSelectMode ? "multi-select-button active" : "multi-select-button"}
                                                onClick={toggleMultiSelectMode}
                                                title={multiSelectMode ? t('buttons.exitMultiSelect') : t('buttons.multiSelect')}
                                            >
                                                {multiSelectMode ? <CheckSquare size={20} /> : <Square size={20} />}
                                                {multiSelectMode ? t('buttons.exitMultiSelect') : t('buttons.multiSelect')}
                                            </button>
                                            {multiSelectMode && selectedPackages.size > 0 && (
                                                <button
                                                    className="update-selected-button"
                                                    onClick={handleUpdateSelected}
                                                    title={t('buttons.updateSelected', { count: selectedPackages.size })}
                                                >
                                                    {t('buttons.updateSelected', { count: selectedPackages.size })}
                                                </button>
                                            )}
                                            {!multiSelectMode && (
                                                <button
                                                    className="update-all-button"
                                                    onClick={() => setShowUpdateAllConfirm(true)}
                                                    title={t('buttons.updateAll')}
                                                >
                                                    {t('buttons.updateAll')}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            }
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {multiSelectMode && updatablePackages.length > 0 && (
                            <div className="multi-select-controls">
                                <button
                                    className="select-control-button"
                                    onClick={selectAllPackages}
                                    disabled={selectedPackages.size === filteredPackages.length}
                                >
                                    {t('buttons.selectAll')}
                                </button>
                                <button
                                    className="select-control-button"
                                    onClick={deselectAllPackages}
                                    disabled={selectedPackages.size === 0}
                                >
                                    {t('buttons.deselectAll')}
                                </button>
                                <span className="selection-count">
                                    {t('multiSelect.selectedCount', { count: selectedPackages.size, total: filteredPackages.length })}
                                </span>
                            </div>
                        )}
                        {error && <div className="result error">{error}</div>}
                        {updatablePackages.length === 0 && !loading ? (
                            <div className="all-up-to-date">
                                <PartyPopper size={48} strokeWidth={1.5} />
                                <p>{t('table.allUpToDate')}</p>
                            </div>
                        ) : (
                            <PackageTable
                                ref={view === "updatable" ? packageTableRef : null}
                                packages={filteredPackages}
                                selectedPackage={selectedPackage}
                                loading={loading}
                                onSelect={multiSelectMode ? (pkg) => togglePackageSelection(pkg.name) : handleSelect}
                                columns={columnsUpdatable}
                                onUninstall={!multiSelectMode ? handleUninstallPackage : undefined}
                                onShowInfo={!multiSelectMode ? handleShowInfoLogs : undefined}
                                onUpdate={!multiSelectMode ? handleUpdate : undefined}
                                multiSelectMode={multiSelectMode}
                                selectedPackages={selectedPackages}
                            />
                        )}
                        {updatablePackages.length > 0 && (
                            <div className="info-footer-container">
                                <div className="package-info">
                                    <PackageInfo
                                        packageEntry={selectedPackage}
                                        loadingDetailsFor={loadingDetailsFor}
                                        view={view}
                                        onSelectDependency={handleSelectDependency}
                                    />
                                </div>
                                <div className="package-footer">
                                    {t('footers.outdatedFormulas')}
                                </div>
                            </div>
                        )}
                    </>
                )}
                {view === "all" && (
                    <>
                        <HeaderRow
                            title={t('headers.allFormulas', { count: allPackages.length })}
                            actions={
                                <button
                                    className="refresh-button"
                                    onClick={loadAllPackages}
                                    disabled={loadingAllPackages}
                                    title={t('buttons.refresh')}
                                >
                                    <RefreshCw size={18} className={loadingAllPackages ? "spinning" : ""} />
                                </button>
                            }
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            ref={view === "all" ? packageTableRef : null}
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading || loadingAllPackages}
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
                                    onSelectDependency={handleSelectDependency}
                                />
                            </div>
                            <div className="package-footer">
                                {t('footers.allFormulas')}
                            </div>
                        </div>
                    </>
                )}
                {view === "allCasks" && (
                    <>
                        <HeaderRow
                            title={t('headers.allCasks', { count: allCasksAll.length })}
                            actions={
                                <button
                                    className="refresh-button"
                                    onClick={loadAllCasks}
                                    disabled={loadingAllCasks}
                                    title={t('buttons.refresh')}
                                >
                                    <RefreshCw size={18} className={loadingAllCasks ? "spinning" : ""} />
                                </button>
                            }
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            ref={view === "allCasks" ? packageTableRef : null}
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading || loadingAllCasks}
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
                                    onSelectDependency={handleSelectDependency}
                                />
                            </div>
                            <div className="package-footer">
                                {t('footers.allCasks')}
                            </div>
                        </div>
                    </>
                )}
                {view === "leaves" && (
                    <>
                        <HeaderRow
                            title={t('headers.leaves', { count: leavesPackages.length })}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onClearSearch={() => setSearchQuery("")}
                        />
                        {error && <div className="result error">{error}</div>}
                        <PackageTable
                            ref={view === "leaves" ? packageTableRef : null}
                            packages={filteredPackages}
                            selectedPackage={selectedPackage}
                            loading={loading}
                            onSelect={handleSelect}
                            columns={columnsLeaves}
                            onUninstall={handleUninstallPackage}
                            onShowInfo={handleShowInfoLogs}
                        />
                        <div className="info-footer-container">
                            <div className="package-info">
                                <PackageInfo
                                    packageEntry={selectedPackage}
                                    loadingDetailsFor={loadingDetailsFor}
                                    view={view}
                                    onSelectDependency={handleSelectDependency}
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
                            actions={
                                <button className="doctor-button" onClick={handleTapRepository}>
                                    {t('buttons.tap')}
                                </button>
                            }
                        />
                        {error && <div className="result error">{error}</div>}
                        <RepositoryTable
                            repositories={filteredRepositories}
                            selectedRepository={selectedRepository}
                            loading={loading}
                            onSelect={handleRepositorySelect}
                            onUntap={handleUntapRepository}
                            onShowInfo={handleShowRepositoryInfo}
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
                {view === "homebrew" && (
                    <HomebrewView
                        homebrewLog={homebrewLog}
                        homebrewVersion={homebrewVersion}
                        isUpToDate={homebrewUpdateStatus.isUpToDate}
                        latestVersion={homebrewUpdateStatus.latestVersion}
                        onClearLog={() => setHomebrewLog("")}
                        onUpdateHomebrew={async () => {
                            setHomebrewLog(t('dialogs.runningHomebrewUpdate'));

                            // Set up event listeners for live progress
                            const progressListener = EventsOn("homebrewUpdateProgress", (progress: string) => {
                                setHomebrewLog(prevLogs => {
                                    if (!prevLogs) {
                                        return `${t('dialogs.homebrewUpdateLogs')}\n${progress}`;
                                    }
                                    return prevLogs + '\n' + progress;
                                });
                            });

                            const completeListener = EventsOn("homebrewUpdateComplete", async (finalMessage: string) => {
                                setHomebrewLog(prevLogs => prevLogs + '\n' + finalMessage);

                                // Refresh version after update
                                try {
                                    const newVersion = await GetHomebrewVersion();
                                    setHomebrewVersion(newVersion);
                                    const updateInfo = await CheckHomebrewUpdate();
                                    if (updateInfo) {
                                        setHomebrewUpdateStatus({
                                            isUpToDate: updateInfo.isUpToDate as boolean,
                                            latestVersion: updateInfo.latestVersion as string,
                                        });
                                    }
                                } catch (error) {
                                    console.error("Failed to refresh Homebrew version:", error);
                                }

                                // Clean up event listeners
                                progressListener();
                                completeListener();
                            });

                            // Start the update process
                            await UpdateHomebrew();
                        }}
                    />
                )}
                {view === "doctor" && (
                    <DoctorView
                        doctorLog={doctorLog}
                        deprecatedFormulae={deprecatedFormulae}
                        onClearLog={() => {
                            setDoctorLog("");
                            setDeprecatedFormulae([]);
                        }}
                        onRunDoctor={async () => {
                            setDoctorLog(t('dialogs.runningDoctor'));
                            setDeprecatedFormulae([]);
                            const result = await RunBrewDoctor();
                            setDoctorLog(result);
                            // Parse deprecated formulae from the output
                            const deprecated = await GetDeprecatedFormulae(result);
                            setDeprecatedFormulae(deprecated || []);
                        }}
                        onUninstallDeprecated={async (formula: string) => {
                            setSelectedPackage({ name: formula, installedVersion: "", isInstalled: true });
                            setShowConfirm(true);
                        }}
                    />
                )}
                {view === "cleanup" && (
                    <CleanupView
                        cleanupLog={cleanupLog}
                        cleanupEstimate={cleanupEstimate}
                        onClearLog={() => setCleanupLog("")}
                        onRunDryRun={async () => {
                            setCleanupLog(t('dialogs.runningDryRun'));
                            const result = await RunBrewCleanupDryRun();
                            setCleanupLog(result);
                            // Refresh estimate after dry run
                            try {
                                const estimate = await GetBrewCleanupDryRun();
                                setCleanupEstimate(estimate);
                            } catch (error) {
                                console.error("Failed to get cleanup estimate:", error);
                            }
                        }}
                        onRunCleanup={async () => {
                            setCleanupLog(t('dialogs.runningCleanup'));
                            const result = await RunBrewCleanup();
                            setCleanupLog(result);
                            // Clear estimate while recalculating
                            setCleanupEstimate("");
                            // Wait briefly for Homebrew to finish updating its state
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            try {
                                const estimate = await GetBrewCleanupDryRun();
                                setCleanupEstimate(estimate);
                            } catch (error) {
                                console.error("Failed to get cleanup estimate:", error);
                            }
                        }}
                        onCheckEstimate={async () => {
                            try {
                                const estimate = await GetBrewCleanupDryRun();
                                setCleanupEstimate(estimate);
                            } catch (error) {
                                console.error("Failed to get cleanup estimate:", error);
                                setCleanupEstimate("");
                            }
                        }}
                    />
                )}
                {view === "settings" && (
                    <SettingsView
                        onRefreshPackages={handleRefreshPackages}
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
                <ConfirmDialog
                    open={showUpdateSelectedConfirm}
                    message={t('dialogs.confirmUpdateSelected', { count: selectedPackages.size })}
                    onConfirm={handleUpdateSelectedConfirmed}
                    onCancel={() => setShowUpdateSelectedConfirm(false)}
                    confirmLabel={t('buttons.yesUpdateSelected', { count: selectedPackages.size })}
                />
                <ConfirmDialog
                    open={showUntapConfirm}
                    message={t('dialogs.confirmUntap', { name: selectedRepository?.name })}
                    onConfirm={handleUntapConfirmed}
                    onCancel={() => setShowUntapConfirm(false)}
                    confirmLabel={t('buttons.yesUntap')}
                    destructive={true}
                />
                <LogDialog
                    open={updateLogs !== null}
                    title={getUpdateLogTitle()}
                    log={updateLogs}
                    isRunning={isUpdateRunning}
                    onClose={async () => {
                        // Clean up any pending event listeners (prevents duplicate listeners bug)
                        if (updateListenersRef.current.progress) updateListenersRef.current.progress();
                        if (updateListenersRef.current.complete) updateListenersRef.current.complete();
                        updateListenersRef.current = { progress: null, complete: null };
                        
                        setUpdateLogs(null);
                        setIsUpdateRunning(false);
                        setCurrentlyUpdatingPackage(null);
                        // Refresh packages if this was an update all operation
                        if (isUpdateAllOperation) {
                            setIsUpdateAllOperation(false);
                            await handleRefreshPackages();
                        }
                    }}
                />
                <LogDialog
                    open={installLogs !== null}
                    title={selectedPackage ? t('dialogs.installLogs', { name: selectedPackage.name }) : t('dialogs.installLogs')}
                    log={installLogs}
                    isRunning={isInstallRunning}
                    onClose={() => {
                        setInstallLogs(null);
                        setIsInstallRunning(false);
                    }}
                />
                <LogDialog
                    open={uninstallLogs !== null}
                    title={selectedPackage ? t('dialogs.uninstallLogs', { name: selectedPackage.name }) : t('dialogs.uninstallLogs')}
                    log={uninstallLogs}
                    isRunning={isUninstallRunning}
                    onClose={() => {
                        setUninstallLogs(null);
                        setIsUninstallRunning(false);
                    }}
                />
                <LogDialog
                    open={untapLogs !== null}
                    title={selectedRepository ? t('dialogs.untapLogs', { name: selectedRepository.name }) : t('dialogs.untapLogs')}
                    log={untapLogs}
                    isRunning={false}
                    clickablePackages={untapLogPackages}
                    onPackageClick={handleUntapPackageClick}
                    onClose={() => {
                        setUntapLogs(null);
                        setUntapLogPackages([]);
                    }}
                />
                <LogDialog
                    open={tapLogs !== null}
                    title={tappingRepository ? t('dialogs.tapLogs', { name: tappingRepository }) : t('dialogs.tapLogs')}
                    log={tapLogs}
                    isRunning={false}
                    onClose={() => {
                        setTapLogs(null);
                        setTappingRepository(null);
                    }}
                />
                <TapInputDialog
                    open={showTapInput}
                    onConfirm={handleTapConfirmed}
                    onCancel={() => setShowTapInput(false)}
                />
                <LogDialog
                    open={!!infoLogs}
                    title={t('dialogs.packageInfo', { name: infoPackage?.name })}
                    log={infoLogs}
                    onClose={() => {
                        // Invalidate any pending info request (prevents dialog from reopening)
                        infoRequestIdRef.current++;
                        setInfoLogs(null);
                        setInfoPackage(null);
                    }}
                />
                <LogDialog
                    open={showRepositoryInfo}
                    title={t('dialogs.repositoryInfo', { name: selectedRepository?.name || '' })}
                    log={repositoryInfoLogs}
                    onClose={() => {
                        setRepositoryInfoLogs(null);
                        setShowRepositoryInfo(false);
                    }}
                    isRunning={false}
                />
                <LogDialog
                    open={showSessionLogs}
                    title={t('dialogs.sessionLogs')}
                    log={sessionLogs}
                    onClose={() => {
                        setShowSessionLogs(false);
                        setSessionLogs("");
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
                <RestartDialog
                    isOpen={showRestart}
                    onClose={() => setShowRestart(false)}
                />
                <ShortcutsDialog
                    open={showShortcuts}
                    onClose={() => setShowShortcuts(false)}
                />
                <CommandPalette
                    open={showCommandPalette}
                    onClose={() => setShowCommandPalette(false)}
                    packages={allPackages}
                    casks={casks}
                    repositories={repositories}
                    onSelectPackage={async (pkg) => {
                        const fullPkg: PackageEntry = {
                            name: pkg.name,
                            installedVersion: pkg.installedVersion || '',
                            latestVersion: pkg.latestVersion,
                            size: pkg.size,
                            desc: pkg.desc,
                            homepage: pkg.homepage,
                            dependencies: pkg.dependencies,
                            conflicts: pkg.conflicts,
                            isInstalled: pkg.isInstalled,
                            warning: pkg.warning,
                        };
                        await handleSelect(fullPkg);
                    }}
                    onSelectRepository={(repo) => {
                        const repoEntry = repositories.find(r => r.name === repo.name);
                        if (repoEntry) {
                            setSelectedRepository(repoEntry);
                            setSelectedPackage(null);
                        }
                    }}
                    onNavigateToView={(view) => {
                        setView(view as "installed" | "casks" | "updatable" | "all" | "allCasks" | "leaves" | "repositories" | "homebrew" | "doctor" | "cleanup" | "settings");
                    }}
                />
                <Toaster
                    position="bottom-center"
                    reverseOrder={false}
                    gutter={8}
                    containerStyle={{
                        bottom: 16,
                        left: 16,
                        right: 16,
                    }}
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: 'var(--toast-bg)',
                            color: 'var(--toast-text)',
                            border: '1px solid var(--glass-border-strong)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            boxShadow: 'var(--glass-shadow-strong)',
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
