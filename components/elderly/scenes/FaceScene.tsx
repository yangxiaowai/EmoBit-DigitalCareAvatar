import React from 'react';
import { Camera, ScanFace, CheckCircle, X, Phone } from 'lucide-react';

interface FaceSceneProps {
    status: 'scanning' | 'matched' | 'unknown';
    recognizedFace?: {
        name: string;
        relation: string;
        description: string;
        imageUrl: string;
    } | null;
    onClose: () => void;
    onContactFamily: () => void;
}

export const FaceScene: React.FC<FaceSceneProps> = ({
    status,
    recognizedFace,
    onClose,
    onContactFamily
}) => {
    return (
        <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-xl flex flex-col justify-end animate-fade-in font-sans p-4">
            <div className="bg-white rounded-[3rem] p-8 pb-12 shadow-[0_-10px_60px_rgba(0,0,0,0.3)] animate-slide-up flex flex-col h-[75vh]">
                
                {/* Header Area */}
                <div className="flex flex-col items-center mt-2 mb-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        {status === 'scanning' ? (
                            <ScanFace size={32} className="text-indigo-600 animate-pulse" />
                        ) : status === 'matched' ? (
                            <CheckCircle size={32} className="text-emerald-500" />
                        ) : (
                            <Camera size={32} className="text-slate-400" />
                        )}
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 text-center mb-2">
                        {status === 'scanning' ? '正在识别人脸...' : status === 'matched' ? '识别成功' : '人脸识别'}
                    </h2>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center">
                    {status === 'scanning' ? (
                        <div className="w-48 h-48 rounded-[2.5rem] bg-indigo-50 border-4 border-indigo-200 border-dashed animate-pulse flex items-center justify-center overflow-hidden">
                             <div className="w-full h-1 bg-indigo-400/30 animate-scan" style={{ position: 'absolute' }} />
                             <Camera size={48} className="text-indigo-300" />
                        </div>
                    ) : status === 'matched' && recognizedFace ? (
                        <div className="flex flex-col items-center">
                            <div className="w-48 h-48 rounded-[2.5rem] border-4 border-emerald-400 overflow-hidden shadow-xl mb-6">
                                <img src={recognizedFace.imageUrl} className="w-full h-full object-cover" alt="Recognized face" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-1">
                                {recognizedFace.relation} {recognizedFace.name}
                            </h3>
                            <p className="text-slate-500 text-center font-medium px-4">
                                {recognizedFace.description}
                            </p>
                        </div>
                    ) : (
                        <p className="text-slate-400 font-bold">未能识别，请重试</p>
                    )}
                </div>

                {/* Main Operations */}
                <div className="flex flex-col gap-4 mt-8">
                    {status === 'matched' ? (
                        <button 
                            onClick={onClose}
                            className="w-full py-5 rounded-[2rem] bg-emerald-500 text-white font-black text-xl hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            我记起来了
                        </button>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="w-full py-5 rounded-[2rem] bg-slate-100 text-slate-600 font-black text-xl hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            返回
                        </button>
                    )}

                    <button 
                        onClick={onContactFamily}
                        className="w-full py-4 rounded-[2rem] bg-slate-50 text-slate-400 font-bold text-lg hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Phone size={24} />
                        联系家人确认
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 0%; }
                    100% { top: 100%; }
                }
                .animate-scan {
                    animation: scan 2s linear infinite;
                }
            `}</style>
        </div>
    );
};
