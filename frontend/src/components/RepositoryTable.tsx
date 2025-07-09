import React from "react";

interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
}

interface RepositoryTableProps {
    repositories: RepositoryEntry[];
    selectedRepository: RepositoryEntry | null;
    loading: boolean;
    onSelect: (repo: RepositoryEntry) => void;
}

const RepositoryTable: React.FC<RepositoryTableProps> = ({
    repositories,
    selectedRepository,
    loading,
    onSelect,
}) => (
    <div className="table-container">
        {loading && (
            <div className="table-loading-overlay">
                <div className="spinner"></div>
                <div className="loading-text">Repositories werden geladen…</div>
            </div>
        )}
        {repositories.length > 0 && (
            <table className="package-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {repositories.map(repo => (
                        <tr
                            key={repo.name}
                            className={selectedRepository?.name === repo.name ? "selected" : ""}
                            onClick={() => onSelect(repo)}
                        >
                            <td>{repo.name}</td>
                            <td><span style={{ color: "green" }}>✓ {repo.status}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
        {!loading && repositories.length === 0 && (
            <div className="result">Keine passenden Ergebnisse.</div>
        )}
    </div>
);

export default RepositoryTable; 