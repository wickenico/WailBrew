/// <reference types="react" />
import {
    AppWindow,
    Beer,
    FolderGit2,
    Layers,
    Leaf,
    Library,
    Package,
    RefreshCw,
    Rocket,
    Sparkles,
    Stethoscope,
} from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import appIcon from "../assets/images/appicon_256.png";
import type { View } from "../types";

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
    appVersion: string;
    onOpenAbout: () => void;
    sidebarWidth?: number;
    sidebarRef?: React.RefObject<HTMLElement | null>;
    isCollapsed?: boolean;
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
    appVersion,
    onOpenAbout,
    sidebarWidth,
    sidebarRef,
    isCollapsed = false,
}) => {
    const { t } = useTranslation();

    // Detect if user is on Mac
    const isMac =
        typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Mac") || navigator.userAgent.includes("macOS"));
    const cmdKey = isMac ? "⌘" : "Ctrl+";

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

    return (
        <nav
            className={`sidebar${isCollapsed ? " collapsed" : ""}`}
            ref={sidebarRef}
            style={!isCollapsed && sidebarWidth ? { width: `${sidebarWidth}px` } : undefined}
        >
            {/* Invisible drag handle: the visible header was removed (redundant with the
                title bar), but this keeps the window draggable from the sidebar's top edge. */}
            <div className="sidebar-drag-region" style={{ "--wails-draggable": "drag" } as React.CSSProperties} />
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
            <div className="sidebar-footer">
                <span className="sidebar-footer-version">
                    <img src={appIcon} alt="" />
                    WailBrew v{appVersion}
                </span>
                <button type="button" onClick={onOpenAbout}>
                    {t("about.title")}
                </button>
            </div>
        </nav>
    );
};

export default Sidebar;
