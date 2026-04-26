import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SystemStatus } from '../../../types';
import { healthStateService, AvatarState } from '../../../services/healthStateService';
import SafeImage from '../../common/SafeImage';

interface AvatarHeroCardProps {
  status: SystemStatus;
}

const AvatarHeroCard: React.FC<AvatarHeroCardProps> = ({ status }) => {
  const [avatarState, setAvatarState] = useState<AvatarState>(healthStateService.getAvatarState());
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAvatarState(healthStateService.getAvatarState());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 根据状态确定视觉样式
  const avatarVisualStatus = status;

  // 状态标签和颜色
  const guardLabel = avatarVisualStatus === SystemStatus.CRITICAL ? 'CRITICAL' :
                     avatarVisualStatus === SystemStatus.WARNING ? 'WARNING' : 'NORMAL';

  const guardDotColorClass = avatarVisualStatus === SystemStatus.CRITICAL ? 'bg-rose-500' :
                             avatarVisualStatus === SystemStatus.WARNING ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className={`relative overflow-hidden rounded-[2.5rem] p-4 shadow-xl transition-all duration-700 group flex flex-col items-center ${
      avatarVisualStatus === SystemStatus.CRITICAL ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-200' :
      avatarVisualStatus === SystemStatus.WARNING ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-200' :
      'bg-white border border-slate-100 shadow-lg shadow-slate-100'
    }`}>
      {/* 状态角标 - 左上角 */}
      <div className={`absolute top-4 left-4 z-20 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full shadow-sm ${
        avatarVisualStatus === SystemStatus.NORMAL ? 'bg-slate-50 border border-slate-100' : 'bg-white/20 backdrop-blur-md border border-white/30'
      }`}>
        <div className="relative flex items-center justify-center w-5 h-5">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${guardDotColorClass}`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${guardDotColorClass}`}></span>
        </div>
        <span className={`text-xs font-bold tracking-widest ${avatarVisualStatus === SystemStatus.NORMAL ? 'text-slate-600' : 'text-white text-shadow-sm'}`}>
          {guardLabel}
        </span>
      </div>

      <div className={`absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 opacity-5 rounded-full blur-3xl ${avatarVisualStatus === SystemStatus.NORMAL ? 'bg-indigo-500' : 'bg-white'}`}></div>

      {/* 3D 数字人容器 */}
      <div className="relative z-10 w-full min-h-[260px] flex items-center justify-center overflow-hidden py-2">
        <div className="relative w-full max-w-[300px] aspect-square flex items-center justify-center mx-auto">
          <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${avatarVisualStatus === SystemStatus.NORMAL ? 'bg-slate-100' : 'bg-white/5'}`}></div>
          <div className={`absolute inset-0 rounded-full backdrop-blur-sm border ${avatarVisualStatus === SystemStatus.NORMAL ? 'bg-white/50 border-slate-100' : 'bg-gradient-to-tr from-white/10 to-transparent border-white/10'}`}></div>
          <div className={`absolute inset-1 border-2 border-dashed rounded-full animate-spin-slow opacity-60 ${
            avatarVisualStatus === SystemStatus.CRITICAL
              ? 'border-rose-200/70'
              : avatarVisualStatus === SystemStatus.WARNING
                ? 'border-amber-200/70'
                : 'border-indigo-200/50'
          }`}></div>
          <div className={`absolute inset-2 rounded-full border overflow-hidden flex items-center justify-center ${
            avatarVisualStatus === SystemStatus.NORMAL ? 'bg-slate-50 border-white shadow-[inset_0_4px_20px_rgba(0,0,0,0.05)]' : 'bg-gradient-to-b from-white/20 to-white/5 border-white/30'
          }`}>
            {videoLoadFailed ? (
              <SafeImage
                src="/avatar_grandchild.png"
                alt="数字人头像"
                className="w-full h-full object-cover"
                fallback={<div className="w-full h-full bg-white/20" />}
              />
            ) : (
              <video
                src="/elder_avator.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={() => setVideoLoadFailed(true)}
              />
            )}
          </div>

          {avatarVisualStatus !== SystemStatus.NORMAL && (
            <div className="absolute top-1 right-1 bg-white rounded-full p-1.5 shadow-lg border-2 border-red-500 z-30">
              <AlertTriangle size={18} className="text-red-600 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarHeroCard;
