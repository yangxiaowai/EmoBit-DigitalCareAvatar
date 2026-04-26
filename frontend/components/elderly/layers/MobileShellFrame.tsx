import React from 'react';
import { Battery, Wifi, Signal } from 'lucide-react';

interface MobileShellFrameProps {
    time: string;
    children: React.ReactNode;
}

export const MobileShellFrame: React.FC<MobileShellFrameProps> = ({ time, children }) => {
    return (
        <div className="relative w-[360px] h-[720px] bg-black rounded-[3rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border-[8px] border-slate-800 overflow-hidden ring-1 ring-slate-900/5 select-none font-sans">
            <div className="absolute top-0 left-0 right-0 h-10 z-[60] flex items-center justify-between px-6 pt-2 text-white text-xs font-medium pointer-events-none mix-blend-difference">
                <span>{time}</span>
                <div className="flex items-center gap-1.5">
                    <Signal size={12} />
                    <Wifi size={12} />
                    <Battery size={14} />
                </div>
            </div>
            {children}
        </div>
    );
};
