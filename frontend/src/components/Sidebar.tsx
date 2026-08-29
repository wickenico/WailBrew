/// <reference types="react" />
import {
    AppWindow,
    Beer,
    FolderGit2,
    Layers,
    Leaf,
    Library,
    type LucideIcon,
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
import "./Sidebar.css";

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

interface NavigationItem {
    view: View;
    icon: LucideIcon;
    label: string;
    shortcut: string;
    badge?: number | string;
    needsAttention?: boolean;
}

interface NavigationSection {
    title: string;
    items: NavigationItem[];
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
    const isMac =
        typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Mac") || navigator.userAgent.includes("macOS"));
    const cmdKey = isMac ? "⌘" : "Ctrl+";

    const sections: NavigationSection[] = [
        {
            title: t("sidebar.packages"),
            items: [
                {
                    view: "installed",
                    icon: Package,
                    label: t("sidebar.installed"),
                    badge: packagesCount,
                    shortcut: "1",
                },
                { view: "casks", icon: AppWindow, label: t("sidebar.casks"), badge: casksCount, shortcut: "2" },
                {
                    view: "updatable",
                    icon: RefreshCw,
                    label: t("sidebar.outdated"),
                    badge: updatableCount,
                    needsAttention: updatableCount > 0,
                    shortcut: "3",
                },
                { view: "leaves", icon: Leaf, label: t("sidebar.leaves"), badge: leavesCount, shortcut: "4" },
                {
                    view: "repositories",
                    icon: FolderGit2,
                    label: t("sidebar.repositories"),
                    badge: repositoriesCount,
                    shortcut: "5",
                },
            ],
        },
        {
            title: t("sidebar.browseInstall"),
            items: [
                {
                    view: "all",
                    icon: Library,
                    label: t("sidebar.allFormulae"),
                    badge: allCount === -1 ? "—" : allCount,
                    shortcut: "6",
                },
                {
                    view: "allCasks",
                    icon: Layers,
                    label: t("sidebar.allCasks"),
                    badge: allCasksCount === -1 ? "—" : allCasksCount,
                    shortcut: "7",
                },
            ],
        },
        {
            title: t("sidebar.tools"),
            items: [
                { view: "homebrew", icon: Beer, label: t("sidebar.homebrew"), shortcut: "8" },
                { view: "services", icon: Rocket, label: t("sidebar.services"), badge: servicesCount, shortcut: "P" },
                { view: "doctor", icon: Stethoscope, label: t("sidebar.doctor"), shortcut: "9" },
                { view: "cleanup", icon: Sparkles, label: t("sidebar.cleanup"), shortcut: "0" },
            ],
        },
    ];

    const navigate = (nextView: View) => {
        setView(nextView);
        onClearSelection();
    };

    return (
        <nav
            className={`sidebar${isCollapsed ? " collapsed" : ""}`}
            ref={sidebarRef}
            style={!isCollapsed && sidebarWidth ? { width: `${sidebarWidth}px` } : undefined}
            aria-label={t("sidebar.packages")}
        >
            <div className="sidebar-drag-region" style={{ "--wails-draggable": "drag" } as React.CSSProperties} />
            {sections.map((section) => (
                <section className="sidebar-section" key={section.title}>
                    <h4>{section.title}</h4>
                    <ul>
                        {section.items.map(({ view: itemView, icon: Icon, label, shortcut, badge, needsAttention }) => {
                            const isActive = view === itemView;
                            return (
                                <li className="sidebar-nav-item" key={itemView}>
                                    <button
                                        type="button"
                                        className={`sidebar-nav-button${isActive ? " active" : ""}`}
                                        onClick={() => navigate(itemView)}
                                        title={isCollapsed ? label : undefined}
                                        aria-current={isActive ? "page" : undefined}
                                    >
                                        <Icon className="sidebar-icon" size={16} strokeWidth={2} />
                                        <span className="sidebar-label">{label}</span>
                                        {badge !== undefined && (
                                            <span className={`badge${needsAttention ? " badge-attention" : ""}`}>
                                                {badge}
                                            </span>
                                        )}
                                        <span className="sidebar-shortcut">
                                            {cmdKey}
                                            {shortcut}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
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
