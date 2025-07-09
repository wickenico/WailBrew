import React from "react";

interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
}

interface RepositoryInfoProps {
    repository: RepositoryEntry | null;
}

const RepositoryInfo: React.FC<RepositoryInfoProps> = ({ repository }) => {
    if (!repository) {
        return <p><strong>Kein Repository ausgewählt</strong></p>;
    }
    return (
        <>
            <p><strong>{repository.name}</strong></p>
            <p>Status: {repository.status || "--"}</p>
            <p>Beschreibung: {repository.desc || "Homebrew Tap Repository"}</p>
        </>
    );
};

export default RepositoryInfo; 