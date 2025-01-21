import React, { useState } from "react";
import "./style.css";
import "./app.css";
import { GetBrewPackages } from "../wailsjs/go/main/App";
import packageJson from "../package.json";
import logo from "./assets/images/WailBrew_Logo.png"

// Define the type for a package entry
interface PackageEntry {
  name: string;
  version: string;
}

const WailBrewApp = () => {
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Fetch Homebrew packages from the backend
  const fetchPackages = () => {
    setLoading(true);
    setError("");
    console.log("Fetching Homebrew packages from the Go backend...");

    GetBrewPackages()
      .then((result: string[][]) => {
        console.log("✅ Packages loaded:", result);

        // Convert raw result to typed PackageEntry[]
        const formattedPackages: PackageEntry[] = result.map(([name, version]) => ({
          name,
          version
        }));

        setPackages(formattedPackages);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error("❌ Error fetching packages:", err);
        setError("❌ Error fetching packages!");
        setLoading(false);
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
          {/* <li><a href="#">🏠 Home</a></li> */}
          <li><a href="#" onClick={fetchPackages}>📦 Installed Packages</a></li>
          {/* <li><a href="#">⚙️ Settings</a></li> */}
          <li><a href="#">❓ About</a></li>
        </ul>
      </nav>

      {/* Content */}
      <div className="content">
        <h2>Installed Homebrew Packages</h2>
        {loading && <div className="result">Fetching packages...</div>}
        {error && <div className="result error">{error}</div>}
        {!loading && !error && packages.length === 0 && (
          <div className="result">Click "Installed Packages" to load data.</div>
        )}

        {/* Package Table */}
        {packages.length > 0 && (
          <table className="package-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Version</th>
                <th>Options</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.name}>
                  <td>{pkg.name}</td>
                  <td>{pkg.version}</td>
                  <td>
                    <button className="btn">Remove</button>
                    <button className="btn">Update</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        &copy; 2025 WailBrew | Built with ❤️ using Wails
      </footer>
    </div>
  );
};

export default WailBrewApp;
