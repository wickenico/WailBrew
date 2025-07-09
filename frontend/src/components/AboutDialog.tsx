import React from "react";
import appIcon from "../assets/images/appicon_256.png";

interface AboutDialogProps {
    open: boolean;
    onClose: () => void;
    appVersion: string;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ open, onClose, appVersion }) => {
    if (!open) return null;

    return (
        <div className="about-overlay" onClick={onClose}>
            <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="about-header">
                    <h2>Über</h2>
                </div>
                
                <div className="about-content">
                    <div className="about-app-section">
                        <h1>WailBrew</h1>
                        <p className="about-version">v{appVersion}</p>
                        
                        <div className="about-icon">
                            <img src={appIcon} alt="WailBrew" />
                        </div>
                        
                        <div className="about-description">
                            <h3>WailBrew – Minimalistische Homebrew GUI für macOS</h3>
                            <p>Erstellt von Nico Wickersheim</p>
                            <p>Entwickelt mit <a href="https://wails.io" target="_blank" rel="noopener noreferrer">Wails</a> und React</p>
                        </div>
                        
                        <div className="about-info">
                            <p>WailBrew ist eine moderne grafische Benutzeroberfläche für Homebrew, die es einfach macht, Pakete zu verwalten, zu installieren und zu aktualisieren.</p>
                        </div>
                        
                        <div className="about-links">
                            <h4>Links:</h4>
                            <ul>
                                <li>
                                    <a href="https://github.com/wickenico/WailBrew" target="_blank" rel="noopener noreferrer">
                                        GitHub Repository
                                    </a>
                                </li>
                                <li>
                                    <a href="https://brew.sh" target="_blank" rel="noopener noreferrer">
                                        Homebrew Website
                                    </a>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="about-acknowledgments">
                            <h4>Danksagungen:</h4>
                            <p>
                                Inspiriert von <a href="https://github.com/brunophilipe/Cakebrew" target="_blank" rel="noopener noreferrer">Cakebrew</a> von Bruno Philipe.
                                <br />
                                Vielen Dank für die großartige Arbeit an der ursprünglichen Homebrew GUI!
                            </p>
                        </div>
                        
                        <div className="about-copyright">
                            <p>Copyright © 2025 Nico Wickersheim. Alle Rechte vorbehalten.</p>
                        </div>
                    </div>
                </div>
                
                <div className="about-footer">
                    <button onClick={onClose} className="about-close-button">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AboutDialog; 