import { useEffect, useState } from 'react';
import { Environment, Quit, WindowToggleMaximise, WindowMinimise } from '../../wailsjs/runtime';
import { X, Square, Minus } from 'lucide-react';
import './TitleBar.css';

const TitleBar = () => {
    const [isLinux, setIsLinux] = useState(false);

    useEffect(() => {
        Environment().then((env: any) => {
            if (env.platform === 'linux') {
                setIsLinux(true);
            }
        }).catch((err: any) => console.error("Could not get environment", err));
    }, []);

    if (!isLinux) return null;

    return (
        <div className="titlebar" style={{ '--wails-draggable': 'drag' } as any}>
            <div className="titlebar-content">
                <span className="titlebar-title">WailBrew</span>
            </div>
            <div className="titlebar-controls" style={{ '--wails-draggable': 'no-drag' } as any}>
                <button className="titlebar-btn minimize" onClick={WindowMinimise} title="Minimize">
                    <Minus size={16} />
                </button>
                <button className="titlebar-btn maximize" onClick={WindowToggleMaximise} title="Maximize">
                    <Square size={13} />
                </button>
                <button className="titlebar-btn close" onClick={Quit} title="Close">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
