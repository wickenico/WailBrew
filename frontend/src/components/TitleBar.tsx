import { Minus, PanelLeftClose, PanelLeftOpen, Square, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Environment, Quit, WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime";
import type { View } from "../types";
import BackgroundCheckIndicator from "./BackgroundCheckIndicator";
import TitleBarActions from "./TitleBarActions";
import "./TitleBar.css";
import "./TitleBarActions.css";

interface TitleBarProps {
    setView: (view: View) => void;
    isSidebarCollapsed: boolean;
    onToggleSidebarCollapsed: () => void;
    isBackgroundCheckRunning?: boolean;
    getSecondsUntilNextCheck?: () => number;
}

const TitleBar: React.FC<TitleBarProps> = ({
    setView,
    isSidebarCollapsed,
    onToggleSidebarCollapsed,
    isBackgroundCheckRunning = false,
    getSecondsUntilNextCheck,
}) => {
    const { t } = useTranslation();
    const [platform, setPlatform] = useState<"linux" | "darwin" | "other" | null>(null);

    useEffect(() => {
        Environment()
            .then((env: any) => {
                if (env.platform === "linux") setPlatform("linux");
                else if (env.platform === "darwin") setPlatform("darwin");
                else setPlatform("other");
            })
            .catch((err: any) => {
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
        </>
    );

    if (platform === "darwin") {
        return (
            <>
                <div className="titlebar-mac-leading" style={{ "--wails-draggable": "no-drag" } as any}>
                    {leadingGroup}
                </div>
                <div className="titlebar-mac-actions" style={{ "--wails-draggable": "drag" } as any}>
                    <TitleBarActions setView={setView} />
                </div>
            </>
        );
    }

    if (platform !== "linux") return null;

    return (
        <div className="titlebar" style={{ "--wails-draggable": "drag" } as any}>
            <div className="titlebar-leading-slot" style={{ "--wails-draggable": "no-drag" } as any}>
                {leadingGroup}
            </div>
            <div className="titlebar-content">
                <span className="titlebar-title">WailBrew</span>
            </div>
            <div className="titlebar-actions-slot">
                <TitleBarActions setView={setView} />
            </div>
            <div className="titlebar-controls" style={{ "--wails-draggable": "no-drag" } as any}>
                <button
                    className="titlebar-btn minimize"
                    onClick={WindowMinimise}
                    title="Minimize"
                    aria-label="Minimize"
                >
                    <Minus size={16} />
                </button>
                <button
                    className="titlebar-btn maximize"
                    onClick={WindowToggleMaximise}
                    title="Maximize"
                    aria-label="Maximize"
                >
                    <Square size={13} />
                </button>
                <button className="titlebar-btn close" onClick={Quit} title="Close" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
