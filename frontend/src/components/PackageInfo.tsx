import React from "react";

interface PackageEntry {
    name: string;
    installedVersion: string;
    latestVersion?: string;
    desc?: string;
    homepage?: string;
    dependencies?: string[];
    conflicts?: string[];
    isInstalled?: boolean;
}

interface PackageInfoProps {
    packageEntry: PackageEntry | null;
    loadingDetailsFor: string | null;
    view: string;
}

const PackageInfo: React.FC<PackageInfoProps> = ({ packageEntry, loadingDetailsFor, view }) => {
    const name = packageEntry?.name || "--";
    const desc = packageEntry?.desc || "--";
    const homepage = packageEntry?.homepage || "--";
    const version = packageEntry?.installedVersion || "--";
    const status = packageEntry ? (packageEntry.isInstalled ? "Installiert" : "Nicht installiert") : "--";
    const dependencies = packageEntry?.dependencies?.length ? packageEntry.dependencies.join(", ") : "--";
    const conflicts = packageEntry?.conflicts?.length ? packageEntry.conflicts.join(", ") : "--";
    return (
        <>
            <p>
                <strong>{name}</strong>{" "}
                {packageEntry && loadingDetailsFor === packageEntry.name && (
                    <span style={{ fontSize: "12px", color: "#888" }}>(Lade…)</span>
                )}
            </p>
            <p>Beschreibung: {desc}</p>
            <p>Homepage: {homepage}</p>
            {view === "all" ? (
                <p>Status: {status}</p>
            ) : (
                <p>Version: {version}</p>
            )}
            <p>Abhängigkeiten: {dependencies}</p>
            <p>Konflikte: {conflicts}</p>
        </>
    );
};

export default PackageInfo; 