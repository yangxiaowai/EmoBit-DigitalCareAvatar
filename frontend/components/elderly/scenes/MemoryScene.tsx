import React from 'react';
import { ChevronLeft, ChevronRight, X, Volume2 } from 'lucide-react';
import { MemoryPhoto } from '../../../types';

interface MemorySceneProps {
    photo: MemoryPhoto | null;
    isSpeaking: boolean;
    onPrev: () => void;
    onNext: () => void;
    onClose: () => void;
    onPlayVoice: () => void;
}

export const MemoryScene: React.FC<MemorySceneProps> = ({
    photo,
    isSpeaking,
    onPrev,
    onNext,
    onClose,
    onPlayVoice
}) => {
    if (!photo) return null;

    return (
        <div className="absolute inset-0 z-50 bg-black animate-fade-in font-sans">
            {/* Image Area */}
            <div className="absolute top-14 left-0 right-0 bottom-[260px] flex items-center justify-center">
                <div className="scale-110 max-w-full max-h-full flex items-center justify-center">
                    <img
                        key={photo.id}
                        src={photo.url}
                        className="max-w-full max-h-full object-contain"
                        alt="Memory"
                    />
                </div>
            </div>

            {/* Close Button */}
            <div className="absolute top-4 right-4 z-[80] pointer-events-auto">
                <button
                    onClick={onClose}
                    className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 transition-colors shadow-lg"
                    aria-label="关闭相册"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Nav Buttons */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-between px-4 pointer-events-none">
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    className="pointer-events-auto w-14 h-14 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-black/60 transition-colors"
                >
                    <ChevronLeft size={32} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    className="pointer-events-auto w-14 h-14 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-black/60 transition-colors"
                >
                    <ChevronRight size={32} />
                </button>
            </div>

            {/* Content Area (Unified Bottom Section) */}
            <div className="absolute bottom-0 left-0 right-0 z-10 h-[320px] bg-gradient-to-t from-black via-black/80 to-transparent overflow-hidden px-8 pb-12 pt-8 flex flex-col justify-end">
                <div className="mb-2 flex flex-wrap gap-2 items-center">
                    {photo.tags.map(tag => (
                        <span key={tag} className="bg-indigo-500/80 backdrop-blur px-3 py-1 rounded-full text-white text-xs font-bold">
                            #{tag}
                        </span>
                    ))}
                    <span className="text-white/60 text-sm font-mono ml-auto">{photo.date}</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-4 drop-shadow-lg">{photo.location}</h2>

                {/* Voice & Story Card */}
                <div 
                    onClick={onPlayVoice}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-[2rem] mt-2 cursor-pointer transition-all hover:bg-white/20 active:scale-[0.98]"
                >
                    <p className="text-white/90 text-[1.1rem] font-medium leading-relaxed drop-shadow-md mb-4 line-clamp-3">
                        "{photo.story}"
                    </p>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSpeaking ? 'bg-indigo-500' : 'bg-white/20'}`}>
                            <Volume2 size={20} className={`text-white ${isSpeaking ? 'animate-pulse' : ''}`} />
                        </div>
                        <div className="flex-1 h-6 flex items-center gap-1">
                            {[...Array(15)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1 rounded-full ${isSpeaking ? 'bg-white/70 animate-pulse' : 'bg-white/30'}`}
                                    style={{
                                        height: isSpeaking ? Math.random() * 16 + 8 + 'px' : '4px',
                                        animationDelay: i * 0.1 + 's'
                                    }}
                                />
                            ))}
                        </div>
                        <span className="text-white/50 text-sm font-bold">{isSpeaking ? '讲述中...' : '听讲解'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
