import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast, { Toaster } from 'react-hot-toast';
import { RefreshCw, Sparkles, Copy } from 'lucide-react';
import "./style.css";
import "./App.css";
import {
    GetBrewPackages,
    GetBrewCasks,
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
import SettingsView from "./components/SettingsView";
import ConfirmDialog from "./components/ConfirmDialog";
import LogDialog from "./components/LogDialog";
import AboutDialog from "./components/AboutDialog";
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
    const [leavesPackages, setLeavesPackages] = useState<PackageEntry[]>([]);
    const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "casks" | "updatable" | "all" | "leaves" | "repositories" | "doctor" | "cleanup" | "settings">("installed");
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
    const [isUpdateAllOperation, setIsUpdateAllOperation] = useState<boolean>(false);
    const [currentlyUpdatingPackage, setCurrentlyUpdatingPackage] = useState<string | null>(null);
    const [installLogs, setInstallLogs] = useState<string | null>(null);
    const [uninstallLogs, setUninstallLogs] = useState<string | null>(null);
    const [infoLogs, setInfoLogs] = useState<string | null>(null);
    const [infoPackage, setInfoPackage] = useState<PackageEntry | null>(null);
    const [doctorLog, setDoctorLog] = useState<string>("");
    const [isUpdateRunning, setIsUpdateRunning] = useState<boolean>(false);
    const [isInstallRunning, setIsInstallRunning] = useState<boolean>(false);
    const [isUninstallRunning, setIsUninstallRunning] = useState<boolean>(false);
    const [cleanupLog, setCleanupLog] = useState<string>("");
    const [showAbout, setShowAbout] = useState<boolean>(false);
    const [showUpdate, setShowUpdate] = useState<boolean>(false);
    const [appVersion, setAppVersion] = useState<string>("0.5.0");
    const updateCheckDone = useRef<boolean>(false);
    const lastSyncedLanguage = useRef<string>("en");
    
    // Sidebar resize state
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 220;
    });
    const [isResizing, setIsResizing] = useState<boolean>(false);
    const sidebarRef = useRef<HTMLElement>(null);

    useEffect(() => {
        // Get app version from backend
        GetAppVersion().then(version => {
            setAppVersion(version);
        }).catch(err => {
            console.error("Failed to get app version:", err);
        });

        setLoading(true);
        Promise.all([GetBrewPackages(), GetBrewCasks(), GetBrewUpdatablePackages(), GetAllBrewPackages(), GetBrewLeaves(), GetBrewTaps()])
            .then(([installed, installedCasks, updatable, all, leaves, repos]) => {
                // Ensure all responses are arrays, default to empty arrays if null/undefined
                const safeInstalled = installed || [];
                const safeInstalledCasks = installedCasks || [];
                const safeUpdatable = updatable || [];
                const safeAll = all || [];
                const safeLeaves = leaves || [];
                const safeRepos = repos || [];

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
                if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                    throw new Error(`${t('errors.failedAllPackages')}: ${safeAll[0][1]}`);
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
                const updatableFormatted = safeUpdatable.map(([name, installedVersion, latestVersion, size]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    size,
                    isInstalled: true,
                }));
                const installedNames = new Set(installedFormatted.map(pkg => pkg.name));
                const allFormatted = safeAll.map(([name, desc, size]) => ({
                    name,
                    installedVersion: "",
                    size,
                    isInstalled: installedNames.has(name),
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
                setLoading(false);
            });
        
        // Check for app updates on startup
        checkAppUpdatesOnStartup();
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

    const checkAppUpdatesOnStartup = async () => {
        // Prevent duplicate calls
        if (updateCheckDone.current) return;
        updateCheckDone.current = true;
        
        try {
            // Wait a bit to let the app fully load first
            setTimeout(async () => {
                const updateInfo = await CheckForUpdates();
                
                if (updateInfo.available) {
                    const upgradeCommand = 'brew update\nbrew upgrade --cask wailbrew';
                    
                    toast(
                        () => (
                            <div>
                                <div style={{ fontWeight: 600 }}>{t('toast.updateAvailable')}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                                    {t('toast.versionReady', { version: updateInfo.latestVersion })}
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
                            </div>
                        ),
                        {
                            icon: <Sparkles size={20} color="#FFD700" />,
                            duration: 6000,
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
            setView(data as "installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor" | "cleanup" | "settings");
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

    // Clear search query when view changes
    useEffect(() => {
        setSearchQuery("");
    }, [view]);

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
        
        // Try to find the dependency in all packages
        let pkg = allPackages.find(p => p.name === dependencyName);
        
        // If not found in all packages, check installed packages
        if (!pkg) {
            pkg = packages.find(p => p.name === dependencyName);
        }
        
        if (!pkg) {
            // Create a minimal package entry if not found
            pkg = {
                name: dependencyName,
                installedVersion: "",
                isInstalled: false,
            };
        }
        
        // Switch to "all" view to show all packages
        setView("all");
        
        // Use setTimeout to ensure view renders and then select & scroll to package
        setTimeout(async () => {
            await handleSelect(pkg!);
        }, 200);
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

            setIsUninstallRunning(false);
            
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
            // Update the package list after successful update
            const updated = await GetBrewUpdatablePackages();
            const formatted = updated.map(([name, installedVersion, latestVersion]) => ({
                name,
                installedVersion,
                latestVersion,
                isInstalled: true,
            }));
            setUpdatablePackages(formatted);
            setIsUpdateRunning(false);
            
            // Clean up event listeners
            progressListener();
            completeListener();
        });

        // Start the update process
        await UpdateBrewPackage(selectedPackage.name);
    };

    const handleUpdateAllConfirmed = async () => {
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

    const handleRefreshPackages = async () => {
        setLoading(true);
        setError("");
        
        // Clear existing data to show clean loading state
        setPackages([]);
        setCasks([]);
        setUpdatablePackages([]);
        setAllPackages([]);
        setLeavesPackages([]);
        setRepositories([]);
        
        try {
            const [installed, caskList, updatable, all, leaves, repos] = await Promise.all([
                GetBrewPackages(),
                GetBrewCasks(),
                GetBrewUpdatablePackages(), 
                GetAllBrewPackages(), 
                GetBrewLeaves(), 
                GetBrewTaps()
            ]);
            
            // Process the data same as in useEffect
            const safeInstalled = installed || [];
            const safeInstalledCasks = caskList || [];
            const safeUpdatable = updatable || [];
            const safeAll = all || [];
            const safeLeaves = leaves || [];
            const safeRepos = repos || [];

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
            }

            if (safeInstalledCasks.length === 1 && safeInstalledCasks[0][0] === "Error") {
                setCasks([]);
            } else {
                const casksFormatted = safeInstalledCasks.map(([name, installedVersion, size]) => ({
                    name,
                    installedVersion,
                    size,
                    isInstalled: true,
                }));
                setCasks(casksFormatted);
            }

            if (safeUpdatable.length === 1 && safeUpdatable[0][0] === "Error") {
                setUpdatablePackages([]);
            } else {
                const formatted = safeUpdatable.map(([name, installedVersion, latestVersion, size]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                    size,
                    isInstalled: true,
                }));
                setUpdatablePackages(formatted);
            }

            if (safeAll.length === 1 && safeAll[0][0] === "Error") {
                setAllPackages([]);
            } else {
                const installedMap = new Map(safeInstalled.map(([name]) => [name, true]));
                const formatted = safeAll.map(([name, desc, size]) => ({
                    name,
                    installedVersion: t('common.notAvailable'),
                    desc,
                    size,
                    isInstalled: installedMap.has(name),
                }));
                setAllPackages(formatted);
            }

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
                allCount={allPackages.length}
                leavesCount={leavesPackages.length}
                repositoriesCount={repositories.length}
                onClearSelection={clearSelection}
                sidebarWidth={sidebarWidth}
                sidebarRef={sidebarRef}
            />
            <div 
                className="sidebar-resize-handle"
                onMouseDown={handleResizeStart}
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
                                    <RefreshCw size={18} />
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
                                        <button
                                            className="update-all-button"
                                            onClick={() => setShowUpdateAllConfirm(true)}
                                            title={t('buttons.updateAll')}
                                        >
                                            {t('buttons.updateAll')}
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
                                    onSelectDependency={handleSelectDependency}
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
                                    onSelectDependency={handleSelectDependency}
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
                <LogDialog
                    open={updateLogs !== null}
                    title={getUpdateLogTitle()}
                    log={updateLogs}
                    isRunning={isUpdateRunning}
                    onClose={async () => {
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
