import React, { useState } from "react";
import "./style.css";
import "./app.css";
import { GetBrewPackages, GetBrewUpdatablePackages, RemoveBrewPackage, UpdateBrewPackage } from "../wailsjs/go/main/App";
import packageJson from "../package.json";
import logo from "./assets/images/WailBrew_Logo.png";
import {FaArrowsRotate, FaTrash} from "react-icons/fa6"; // Import trash icon

// Define the type for a package entry
interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
}

const WailBrewApp = () => {
    const [packages, setPackages] = useState<PackageEntry[]>([]);
    const [updatablePackages, setUpdatablePackages] = useState<PackageEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [view, setView] = useState<"installed" | "updatable">("installed");
    const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; packageName: string | null }>({ show: false, packageName: null });

    // Fetch installed packages
    const fetchPackages = () => {
        setLoading(true);
        setError("");

        GetBrewPackages()
            .then((result: string[][]) => {
                const formattedPackages: PackageEntry[] = result.map(([name, installedVersion]) => ({
                    name,
                    installedVersion,
                }));

                setPackages(formattedPackages);
                setLoading(false);
            })
            .catch((err) => {
                console.error("❌ Error fetching packages:", err);
                setError("❌ Error fetching packages!");
                setLoading(false);
            });
    };

    // Fetch updatable packages
    const fetchUpdatablePackages = () => {
        setLoading(true);
        setError("");

        GetBrewUpdatablePackages()
            .then((result: string[][]) => {
                const formattedPackages: PackageEntry[] = result.map(([name, installedVersion, latestVersion]) => ({
                    name,
                    installedVersion,
                    latestVersion,
                }));

                setUpdatablePackages(formattedPackages);
                setLoading(false);
            })
            .catch((err) => {
                console.error("❌ Error fetching updatable packages:", err);
                setError("❌ Error fetching updatable packages!");
                setLoading(false);
            });
    };

    // Confirm Delete Function
    const confirmRemovePackage = (packageName: string) => {
        setConfirmDelete({ show: true, packageName });
    };

    // Delete Package Function
    const removePackage = () => {
        if (!confirmDelete.packageName) return;
        setLoading(true);

        RemoveBrewPackage(confirmDelete.packageName)
            .then(() => {
                console.log(`✅ ${confirmDelete.packageName} removed successfully`);
                fetchPackages(); // Refresh package list
            })
            .catch((err) => {
                console.error(`❌ Error removing ${confirmDelete.packageName}:`, err);
            })
            .finally(() => {
                setLoading(false);
                setConfirmDelete({ show: false, packageName: null });
            });
    };

    // Update Package Function
    const updatePackage = (packageName: string) => {
        setLoading(true);

        UpdateBrewPackage(packageName)
            .then(() => {
                console.log(`✅ ${packageName} removed successfully`);
                fetchUpdatablePackages(); // Refresh updatable package list
            })
            .catch((err) => {
                console.error(`❌ Error removing ${packageName}:`, err);
            })
            .finally(() => {
                setLoading(false);
                setConfirmDelete({ show: false, packageName: null });
            });
    };

    return (
        <div className="container">
            {/* Sidebar */}
            <nav className="sidebar">
                <div className="sidebar-header">
                    <img src={logo} alt="WailBrew Logo" className="sidebar-logo" />
                    <h3>WailBrew</h3>
                </div>
                <p className="app-version">v{packageJson.version}</p>
                <ul>
                    <li><a href="#" onClick={() => { fetchPackages(); setView("installed"); }}>📦 Installed Packages</a></li>
                    <li><a href="#" onClick={() => { fetchUpdatablePackages(); setView("updatable"); }}>
                        📥 Updates
                    </a></li>
                    <li><a href="#">❓ About</a></li>
                </ul>
            </nav>

            {/* Content */}
            <div className="content">
                <h2>{view === "installed" ? `Installed Packages (${packages.length})` : `Updates (${updatablePackages.length})`}</h2>
                {loading && <div className="result">Fetching packages...</div>}
                {error && <div className="result error">{error}</div>}

                {/* Installed Packages Table */}
                {view === "installed" && packages.length > 0 && (
                    <table className="package-table">
                        <thead>
                        <tr>
                            <th>Package</th>
                            <th>Installed Version</th>
                            <th>Options</th>
                        </tr>
                        </thead>
                        <tbody>
                        {packages.map((pkg) => (
                            <tr key={pkg.name}>
                                <td>{pkg.name}</td>
                                <td>{pkg.installedVersion}</td>
                                <td>
                                    <button className="btn delete-btn" onClick={() => confirmRemovePackage(pkg.name)}>
                                        <FaTrash />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}

                {/* Updatable Packages Table */}
                {view === "updatable" && updatablePackages.length > 0 && (
                    <table className="package-table">
                        <thead>
                        <tr>
                            <th>Package</th>
                            <th>Installed Version</th>
                            <th>Latest Version</th>
                            <th>Options</th>
                        </tr>
                        </thead>
                        <tbody>
                        {updatablePackages.map((pkg) => (
                            <tr key={pkg.name}>
                                <td>{pkg.name}</td>
                                <td>{pkg.installedVersion}</td>
                                <td>{pkg.latestVersion}</td>
                                <td><button className="btn" onClick={() => updatePackage(pkg.name)}><FaArrowsRotate /></button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Delete Modal */}
            {confirmDelete.show && (
                <div className="modal">
                    <div className="modal-content">
                        <p>Are you sure you want to delete <strong>{confirmDelete.packageName}</strong>?</p>
                        <button className="btn cancel-btn" onClick={() => setConfirmDelete({ show: false, packageName: null })}>Cancel</button>
                        <button className="btn delete-btn" onClick={removePackage}>Yes, Delete</button>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="footer">
                &copy; 2025 WailBrew | Built with ❤️ using Wails
            </footer>
        </div>
    );
};

export default WailBrewApp;
