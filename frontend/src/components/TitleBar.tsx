import {
    CircleArrowDown,
    CircleArrowUp,
    CircleMinus,
    Minus,
    PanelLeftClose,
    PanelLeftOpen,
    Sparkles,
    Square,
    X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Environment, Quit, WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime";
import type { View } from "../types";
import BackgroundCheckIndicator from "./BackgroundCheckIndicator";
import TitleBarActions from "./TitleBarActions";
import "./TitleBar.css";
import "./TitleBarActions.css";

// Wails reads this CSS custom property to decide which regions can drag the window
const DRAG = { "--wails-draggable": "drag" } as React.CSSProperties;
const NO_DRAG = { "--wails-draggable": "no-drag" } as React.CSSProperties;

interface TitleBarProps {
    setView: (view: View) => void;
    isSidebarCollapsed: boolean;
    onToggleSidebarCollapsed: () => void;
    isBackgroundCheckRunning?: boolean;
    getSecondsUntilNextCheck?: () => number;
    /** Latest WailBrew version when an update of WailBrew itself is available. */
    appUpdateVersion?: string;
    /** Opens the Update dialog. */
    onShowAppUpdate?: () => void;
    /** Operations running with their log dialog hidden; each gets a button that reopens it. */
    hiddenOperations?: HiddenOperation[];
}

export interface HiddenOperation {
    kind: "update" | "install" | "uninstall";
    onShow: () => void;
}

const hiddenOperationIcons = {
    update: CircleArrowUp,
    install: CircleArrowDown,
    uninstall: CircleMinus,
} as const;

const hiddenOperationLabelKeys = {
    update: "dialogs.showRunningUpdate",
    install: "dialogs.showRunningInstall",
    uninstall: "dialogs.showRunningUninstall",
} as const;

const TitleBar: React.FC<TitleBarProps> = ({
    setView,
    isSidebarCollapsed,
    onToggleSidebarCollapsed,
    isBackgroundCheckRunning = false,
    getSecondsUntilNextCheck,
    appUpdateVersion,
    onShowAppUpdate,
    hiddenOperations = [],
}) => {
    const { t } = useTranslation();
    const [platform, setPlatform] = useState<"linux" | "darwin" | "other" | null>(null);

    useEffect(() => {
        Environment()
            .then((env) => {
                if (env.platform === "linux") setPlatform("linux");
                else if (env.platform === "darwin") setPlatform("darwin");
                else setPlatform("other");
            })
            .catch((err) => {
                console.error("Could not get environment", err);
                setPlatform("other");
            });
    }, []);

    const sidebarToggleButton = (
        <button
            type="button"
            className="titlebar-action-btn"
            onClick={onToggleSidebarCollapsed}
            title={isSidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            aria-label={isSidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
            {isSidebarCollapsed ? (
                <PanelLeftOpen size={16} strokeWidth={2} />
            ) : (
                <PanelLeftClose size={16} strokeWidth={2} />
            )}
        </button>
    );

    const leadingGroup = (
        <>
            {sidebarToggleButton}
            <BackgroundCheckIndicator
                isRunning={isBackgroundCheckRunning}
                getSecondsUntilNextCheck={getSecondsUntilNextCheck}
            />
            {appUpdateVersion && onShowAppUpdate && (
                <button
                    type="button"
                    className="titlebar-action-btn titlebar-app-update-btn"
                    onClick={onShowAppUpdate}
                    title={t("updateDialog.titleBarAvailable", { version: appUpdateVersion })}
                    aria-label={t("updateDialog.titleBarAvailable", { version: appUpdateVersion })}
                >
                    <Sparkles size={16} strokeWidth={2} />
                    <span className="titlebar-app-update-dot" aria-hidden="true" />
                </button>
            )}
            {hiddenOperations.map(({ kind, onShow }) => {
                const Icon = hiddenOperationIcons[kind];
                const label = t(hiddenOperationLabelKeys[kind]);
                return (
                    <button
                        key={kind}
                        type="button"
                        className="titlebar-action-btn titlebar-running-operation-btn"
                        onClick={onShow}
                        title={label}
                        aria-label={label}
                    >
                        <Icon size={16} strokeWidth={2} />
                    </button>
                );
            })}
        </>
    );

    if (platform === "darwin") {
        return (
            <>
                <div className="titlebar-mac-leading" style={NO_DRAG}>
                    {leadingGroup}
                </div>
                <div className="titlebar-mac-actions" style={DRAG}>
                    <TitleBarActions setView={setView} />
                </div>
            </>
        );
    }

    if (platform !== "linux") return null;

    return (
        <div className="titlebar" style={DRAG}>
            <div className="titlebar-leading-slot" style={NO_DRAG}>
                {leadingGroup}
            </div>
            <div className="titlebar-content">
                <span className="titlebar-title">WailBrew</span>
            </div>
            <div className="titlebar-actions-slot">
                <TitleBarActions setView={setView} />
            </div>
            <div className="titlebar-controls" style={NO_DRAG}>
                <button
                    type="button"
                    className="titlebar-btn minimize"
                    onClick={WindowMinimise}
                    title="Minimize"
                    aria-label="Minimize"
                >
                    <Minus size={16} />
                </button>
                <button
                    type="button"
                    className="titlebar-btn maximize"
                    onClick={WindowToggleMaximise}
                    title="Maximize"
                    aria-label="Maximize"
                >
                    <Square size={13} />
                </button>
                <button type="button" className="titlebar-btn close" onClick={Quit} title="Close" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
