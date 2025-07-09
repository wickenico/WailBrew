import React from "react";
import appIcon from "../assets/images/appicon_256.png";

interface SidebarProps {
    view: "installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor";
    setView: (view: "installed" | "updatable" | "all" | "leaves" | "repositories" | "doctor") => void;
    packagesCount: number;
    updatableCount: number;
    allCount: number;
    leavesCount: number;
    repositoriesCount: number;
    appVersion: string;
    onClearSelection: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    view,
    setView,
    packagesCount,
    updatableCount,
    allCount,
    leavesCount,
    repositoriesCount,
    appVersion,
    onClearSelection,
}) => (
    <nav className="sidebar">
        <div className="sidebar-title">
            <img
                src={appIcon}
                alt="Logo"
                style={{ width: "28px", height: "28px", marginRight: "8px", verticalAlign: "middle" }}
            />
            WailBrew
        </div>
        <div className="sidebar-section">
            <h4>Formeln</h4>
            <ul>
                <li className={view === "installed" ? "active" : ""} onClick={() => { setView("installed"); onClearSelection(); }}>
                    <span>📦 Installiert</span>
                    <span className="badge">{packagesCount}</span>
                </li>
                <li className={view === "updatable" ? "active" : ""} onClick={() => { setView("updatable"); onClearSelection(); }}>
                    <span>🔄 Veraltet</span>
                    <span className="badge">{updatableCount}</span>
                </li>
                <li className={view === "all" ? "active" : ""} onClick={() => { setView("all"); onClearSelection(); }}>
                    <span>📚 Formeln</span>
                    <span className="badge">{allCount}</span>
                </li>
                <li className={view === "leaves" ? "active" : ""} onClick={() => { setView("leaves"); onClearSelection(); }}>
                    <span>🍃 Blätter</span>
                    <span className="badge">{leavesCount}</span>
                </li>
                <li className={view === "repositories" ? "active" : ""} onClick={() => { setView("repositories"); onClearSelection(); }}>
                    <span>📂 Repositories</span>
                    <span className="badge">{repositoriesCount}</span>
                </li>
            </ul>
        </div>
        <div className="sidebar-section">
            <h4>Werkzeuge</h4>
            <ul>
                <li className={view === "doctor" ? "active" : ""} onClick={() => { setView("doctor"); onClearSelection(); }}>
                    <span>🩺 Doctor</span>
                </li>
            </ul>
        </div>
        <div style={{ marginTop: "20px", marginBottom: "10px", fontSize: "10px", color: "#777", paddingTop: "1px" }}>
            v{appVersion}
        </div>
    </nav>
);

export default Sidebar; 