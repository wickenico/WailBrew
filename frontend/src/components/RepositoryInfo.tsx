import React from "react";
import { useTranslation } from "react-i18next";

interface RepositoryEntry {
    name: string;
    status: string;
    desc?: string;
    trusted?: boolean;
}

interface RepositoryInfoProps {
    repository: RepositoryEntry | null;
}

const RepositoryInfo: React.FC<RepositoryInfoProps> = ({ repository }) => {
    const { t } = useTranslation();
    
    if (!repository) {
        return <p><strong>{t('repository.noSelection')}</strong></p>;
    }

    const trustedLabel =
        repository.trusted === true
            ? t('repository.trustedYes')
            : repository.trusted === false
                ? t('repository.trustedNo')
                : t('repository.trustedUnknown');

    return (
        <>
            <p><strong>{repository.name}</strong></p>
            <p>{t('repository.status')}: {repository.status || t('common.notAvailable')}</p>
            <p>{t('repository.trusted')}: {trustedLabel}</p>
            <p>{t('repository.description')}: {repository.desc || t('repository.defaultDescription')}</p>
        </>
    );
};

export default RepositoryInfo; 