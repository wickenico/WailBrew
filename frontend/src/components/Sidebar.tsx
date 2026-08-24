/// <reference types="react" />
import {
    AppWindow,
    Beer,
    ChevronDown,
    Clock,
    FolderGit2,
    Heart,
    Layers,
    Leaf,
    Library,
    Loader2,
    Package,
    PanelLeftClose,
    PanelLeftOpen,
    RefreshCw,
    Rocket,
    Sparkles,
    Stethoscope,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import appIcon from "../assets/images/appicon_256.png";
import { mapToSupportedLanguage } from "../i18n/languageUtils";
import type { View } from "../types";
import ThemeToggle from "./ThemeToggle";

interface SidebarProps {
    view: View;
    setView: (view: View) => void;
    packagesCount: number;
    casksCount: number;
    updatableCount: number;
    allCount: number;
    allCasksCount: number;
    leavesCount: number;
    repositoriesCount: number;
    servicesCount: number;
    onClearSelection: () => void;
    sidebarWidth?: number;
    sidebarRef?: React.RefObject<HTMLElement | null>;
    isBackgroundCheckRunning?: boolean;
    getSecondsUntilNextCheck?: () => number;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    view,
    setView,
    packagesCount,
    casksCount,
    updatableCount,
    allCount,
    allCasksCount,
    leavesCount,
    repositoriesCount,
    servicesCount,
    onClearSelection,
    sidebarWidth,
    sidebarRef,
    isBackgroundCheckRunning = false,
    getSecondsUntilNextCheck,
    isCollapsed = false,
    onToggleCollapse,
}) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = mapToSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [tooltipText, setTooltipText] = useState("");
    const iconRef = useRef<HTMLDivElement>(null);

    // Format seconds into a readable countdown string
    const formatCountdown = (seconds: number): string => {
        if (seconds <= 0) return t("backgroundCheck.checkingNow");
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes > 0) {
            return t("backgroundCheck.nextCheckIn", { minutes, seconds: remainingSeconds });
        }
        return t("backgroundCheck.nextCheckInSeconds", { seconds: remainingSeconds });
    };

    // Update tooltip position and start countdown only while tooltip is visible
    useEffect(() => {
        if (showTooltip && iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2,
            });

            // Compute initial value immediately
            if (getSecondsUntilNextCheck) {
                setTooltipText(formatCountdown(getSecondsUntilNextCheck()));
            }

            // Update every second only while tooltip is visible
            const interval = setInterval(() => {
                if (getSecondsUntilNextCheck) {
                    setTooltipText(formatCountdown(getSecondsUntilNextCheck()));
                }
            }, 1000);

            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showTooltip]);

    // Detect if user is on Mac
    const isMac =
        typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Mac") || navigator.userAgent.includes("macOS"));
    const cmdKey = isMac ? "⌘" : "Ctrl+";

    const changeLanguage = async (lng: string) => {
        const normalized = mapToSupportedLanguage(lng);
        try {
            await i18n.changeLanguage(normalized);
        } catch (error) {
            console.error("Failed to change frontend language:", error);
        }
    };

    const navigate = (v: View) => {
        setView(v);
        onClearSelection();
    };

    const handleNavKeyDown = (e: React.KeyboardEvent, v: View) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(v);
        }
    };

    // Language options with flags
    const languageOptions = {
        en: { flag: "🇬🇧", name: t("language.english") },
        de: { flag: "🇩🇪", name: t("language.german") },
        fr: { flag: "🇫🇷", name: t("language.french") },
        tr: { flag: "🇹🇷", name: t("language.turkish") },
        zhCN: { flag: "🇨🇳", name: t("language.simplified_chinese") },
        zhTW: { flag: "🇹🇼", name: t("language.traditional_chinese") },
        pt_BR: { flag: "🇧🇷", name: t("language.brazilian_portuguese") },
        ru: { flag: "🇷🇺", name: t("language.russian") },
        ko: { flag: "🇰🇷", name: t("language.korean") },
        he: { flag: "🇮🇱", name: t("language.hebrew") },
        es: { flag: "🇪🇸", name: t("language.spanish") },
    };

    return (
        <nav
            className={`sidebar${isCollapsed ? " collapsed" : ""}`}
            ref={sidebarRef}
            style={!isCollapsed && sidebarWidth ? { width: `${sidebarWidth}px` } : undefined}
        >
            <div className="sidebar-title" style={{ "--wails-draggable": "drag" } as React.CSSProperties}>
                {onToggleCollapse && (
                    <button
                        type="button"
                        className="sidebar-collapse-toggle"
                        onClick={onToggleCollapse}
                        title={isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
                        style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
                    >
                        {isCollapsed ? (
                            <PanelLeftOpen size={16} strokeWidth={2} />
                        ) : (
                            <PanelLeftClose size={16} strokeWidth={2} />
                        )}
                    </button>
                )}
                <img
                    src={appIcon}
                    alt="Logo"
                    style={{
                        width: "28px",
                        height: "28px",
                        marginRight: isCollapsed ? "0" : "8px",
                        verticalAlign: "middle",
                    }}
                />
                {!isCollapsed && (
                    <>
                        WailBrew
                        {isBackgroundCheckRunning !== undefined && (
                            <div
                                ref={iconRef}
                                className="background-check-icon"
                                style={{
                                    position: "relative",
                                    display: "inline-block",
                                    marginLeft: "8px",
                                    verticalAlign: "middle",
                                }}
                                onMouseEnter={() => setShowTooltip(true)}
                                onMouseLeave={() => setShowTooltip(false)}
                            >
                                {isBackgroundCheckRunning ? (
                                    <Loader2
                                        size={16}
                                        style={{
                                            color: "#3B82F6",
                                            animation: "spin 1s linear infinite",
                                        }}
                                    />
                                ) : (
                                    <Clock
                                        size={16}
                                        style={{
                                            color: "#3B82F6",
                                            opacity: 0.7,
                                        }}
                                    />
                                )}
                                {showTooltip &&
                                    getSecondsUntilNextCheck &&
                                    ReactDOM.createPortal(
                                        <div
                                            className="background-check-tooltip"
                                            style={{
                                                position: "fixed",
                                                top: tooltipPosition.top,
                                                left: tooltipPosition.left,
                                                transform: "translateX(-50%)",
                                                zIndex: 99999,
                                            }}
                                        >
                                            {tooltipText}
                                        </div>,
                                        document.body,
                                    )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <div
                className="sidebar-sponsor"
                onClick={() => BrowserOpenURL("https://github.com/sponsors/wickenico")}
                tabIndex={0}
                title={isCollapsed ? t("sidebar.sponsor") : undefined}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        BrowserOpenURL("https://github.com/sponsors/wickenico");
                    }
                }}
            >
                <Heart size={12} />
                {!isCollapsed && <span>{t("sidebar.sponsor")}</span>}
            </div>
            <div className="sidebar-section">
                <h4>{t("sidebar.packages")}</h4>
                <ul>
                    <li
                        className={view === "installed" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("installed")}
                        onKeyDown={(e) => handleNavKeyDown(e, "installed")}
                        title={isCollapsed ? t("sidebar.installed") : undefined}
                    >
                        <Package className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.installed")}</span>
                        <span className="badge">{packagesCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}1</span>
                    </li>
                    <li
                        className={view === "casks" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("casks")}
                        onKeyDown={(e) => handleNavKeyDown(e, "casks")}
                        title={isCollapsed ? t("sidebar.casks") : undefined}
                    >
                        <AppWindow className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.casks")}</span>
                        <span className="badge">{casksCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}2</span>
                    </li>
                    <li
                        className={view === "updatable" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("updatable")}
                        onKeyDown={(e) => handleNavKeyDown(e, "updatable")}
                        title={isCollapsed ? t("sidebar.outdated") : undefined}
                    >
                        <RefreshCw className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.outdated")}</span>
                        <span className={`badge${updatableCount > 0 ? " badge-attention" : ""}`}>{updatableCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}3</span>
                    </li>
                    <li
                        className={view === "leaves" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("leaves")}
                        onKeyDown={(e) => handleNavKeyDown(e, "leaves")}
                        title={isCollapsed ? t("sidebar.leaves") : undefined}
                    >
                        <Leaf className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.leaves")}</span>
                        <span className="badge">{leavesCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}4</span>
                    </li>
                    <li
                        className={view === "repositories" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("repositories")}
                        onKeyDown={(e) => handleNavKeyDown(e, "repositories")}
                        title={isCollapsed ? t("sidebar.repositories") : undefined}
                    >
                        <FolderGit2 className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.repositories")}</span>
                        <span className="badge">{repositoriesCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}5</span>
                    </li>
                </ul>
            </div>
            <div className="sidebar-section">
                <h4>{t("sidebar.browseInstall")}</h4>
                <ul>
                    <li
                        className={view === "all" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("all")}
                        onKeyDown={(e) => handleNavKeyDown(e, "all")}
                        title={isCollapsed ? t("sidebar.allFormulae") : undefined}
                    >
                        <Library className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.allFormulae")}</span>
                        <span className="badge">{allCount === -1 ? "—" : allCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}6</span>
                    </li>
                    <li
                        className={view === "allCasks" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("allCasks")}
                        onKeyDown={(e) => handleNavKeyDown(e, "allCasks")}
                        title={isCollapsed ? t("sidebar.allCasks") : undefined}
                    >
                        <Layers className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.allCasks")}</span>
                        <span className="badge">{allCasksCount === -1 ? "—" : allCasksCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}7</span>
                    </li>
                </ul>
            </div>
            <div className="sidebar-section">
                <h4>{t("sidebar.tools")}</h4>
                <ul>
                    <li
                        className={view === "homebrew" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("homebrew")}
                        onKeyDown={(e) => handleNavKeyDown(e, "homebrew")}
                        title={isCollapsed ? t("sidebar.homebrew") : undefined}
                    >
                        <Beer className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.homebrew")}</span>
                        <span className="sidebar-shortcut">{cmdKey}8</span>
                    </li>
                    <li
                        className={view === "services" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("services")}
                        onKeyDown={(e) => handleNavKeyDown(e, "services")}
                        title={isCollapsed ? t("sidebar.services") : undefined}
                    >
                        <Rocket className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.services")}</span>
                        <span className="badge">{servicesCount}</span>
                        <span className="sidebar-shortcut">{cmdKey}P</span>
                    </li>
                    <li
                        className={view === "doctor" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("doctor")}
                        onKeyDown={(e) => handleNavKeyDown(e, "doctor")}
                        title={isCollapsed ? t("sidebar.doctor") : undefined}
                    >
                        <Stethoscope className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.doctor")}</span>
                        <span className="sidebar-shortcut">{cmdKey}9</span>
                    </li>
                    <li
                        className={view === "cleanup" ? "active" : ""}
                        tabIndex={0}
                        onClick={() => navigate("cleanup")}
                        onKeyDown={(e) => handleNavKeyDown(e, "cleanup")}
                        title={isCollapsed ? t("sidebar.cleanup") : undefined}
                    >
                        <Sparkles className="sidebar-icon" size={16} strokeWidth={2} />
                        <span className="sidebar-label">{t("sidebar.cleanup")}</span>
                        <span className="sidebar-shortcut">{cmdKey}0</span>
                    </li>
                </ul>
            </div>
            {!isCollapsed && (
                <div className="sidebar-section keyboard-hints">
                    <div className="keyboard-hint">
                        <span className="keyboard-hint-label">{t("sidebar.refresh")}</span>
                        <span className="keyboard-hint-shortcut">{cmdKey}⇧R</span>
                    </div>
                </div>
            )}
            <div className="sidebar-section language-switcher">
                <div className="language-dropdown-wrapper">
                    <div style={{ display: "flex", alignItems: "center" }}>
                        {!isCollapsed && (
                            <div style={{ position: "relative", flex: 1 }}>
                                <select
                                    className="language-dropdown"
                                    value={currentLanguage}
                                    onChange={(e) => changeLanguage(e.target.value)}
                                    aria-label={t("language.switchLanguage")}
                                >
                                    {Object.entries(languageOptions).map(([code, { flag, name }]) => (
                                        <option key={code} value={code}>
                                            {flag} {name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="language-dropdown-arrow" size={16} strokeWidth={2} />
                            </div>
                        )}
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Sidebar;
