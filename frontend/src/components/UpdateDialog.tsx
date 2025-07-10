import React, { useState } from 'react';
import { CheckForUpdates, DownloadAndInstallUpdate } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose }) => {
  const [updateInfo, setUpdateInfo] = useState<main.UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const info = await CheckForUpdates();
      setUpdateInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

  const downloadUpdate = async () => {
    if (!updateInfo?.downloadUrl) return;
    
    setIsDownloading(true);
    try {
      await DownloadAndInstallUpdate(updateInfo.downloadUrl);
      // App will restart automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download update');
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  React.useEffect(() => {
    if (isOpen && !updateInfo) {
      checkForUpdates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog update-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <h2>Nach Updates suchen</h2>
        </div>
        
        <div className="about-content">
          {isChecking && (
            <div className="update-checking">
              <div className="loading-spinner"></div>
              <p>Suche nach Updates...</p>
            </div>
          )}

                     {error && (
             <div className="update-error">
               <div className="error-icon">⚠️</div>
               <div>
                 <h3>Fehler beim Überprüfen</h3>
                 <p>{error}</p>
               </div>
             </div>
           )}

          {updateInfo && !isChecking && !error && (
            <div className="update-info">
              {updateInfo.available ? (
                <div className="update-available">
                  <div className="update-icon">🎉</div>
                  <div className="update-details">
                    <h3>Update verfügbar!</h3>
                    <div className="version-comparison">
                      <div className="version-box current">
                        <span className="version-label">Aktuelle Version</span>
                        <span className="version-number">{updateInfo.currentVersion}</span>
                      </div>
                      <div className="version-arrow">→</div>
                      <div className="version-box latest">
                        <span className="version-label">Neue Version</span>
                        <span className="version-number">{updateInfo.latestVersion}</span>
                      </div>
                    </div>
                    
                    <div className="release-info">
                      <p><strong>Veröffentlicht:</strong> {formatDate(updateInfo.publishedAt)}</p>
                      <p><strong>Größe:</strong> {formatFileSize(updateInfo.fileSize)}</p>
                    </div>

                    {updateInfo.releaseNotes && (
                      <div className="release-notes">
                        <h4>Änderungen:</h4>
                        <div className="release-notes-content">
                          {updateInfo.releaseNotes.split('\n').map((line: string, index: number) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {isDownloading && (
                      <div className="download-progress">
                        <div className="loading-spinner"></div>
                        <p>Update wird heruntergeladen und installiert...</p>
                        <p className="download-note">Die App wird automatisch neu gestartet.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                                 <div className="update-current">
                   <div className="update-icon">✅</div>
                   <div>
                     <h3>Du bist auf dem neuesten Stand!</h3>
                     <p>Version {updateInfo.currentVersion} ist die aktuelle Version.</p>
                   </div>
                 </div>
              )}
                         </div>
           )}
         </div>
         
         <div className="about-footer">
           {error ? (
             <div className="action-buttons">
               <button className="btn btn-secondary" onClick={onClose}>
                 Schließen
               </button>
               <button className="btn btn-primary" onClick={checkForUpdates}>
                 Erneut versuchen
               </button>
             </div>
           ) : updateInfo?.available && !isDownloading ? (
             <div className="action-buttons">
               <button className="btn btn-secondary" onClick={onClose}>
                 Später
               </button>
               <button className="btn btn-primary" onClick={downloadUpdate}>
                 Jetzt aktualisieren
               </button>
             </div>
           ) : (
             <button onClick={onClose} className="about-close-button">
               Schließen
             </button>
           )}
         </div>
       </div>
     </div>
   );
};

export default UpdateDialog; 