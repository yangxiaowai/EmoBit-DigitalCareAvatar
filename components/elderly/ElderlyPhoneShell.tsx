import React from 'react';
import { useElderlyScenarioState } from '../../hooks/useElderlyScenarioState';
import { CompanionHome } from './CompanionHome';
import { WanderingScene } from './scenes/WanderingScene';
import { MedicationScene } from './scenes/MedicationScene';
import { SundowningScene } from './scenes/SundowningScene';
import { MemoryScene } from './scenes/MemoryScene';
import { MemoryPhoto } from '../../types';

interface ElderlyPhoneShellProps {
    // Current time states passed from parent for synchronization
    time: string;
    dateStr: string;
    // Shared speech/interaction props
    interimText: string;
    onToggleMic: () => void;
    // States from useElderlyScenarioState or parent
    scenarioState: ReturnType<typeof useElderlyScenarioState>;
    // Necessary handlers
    onContactFamily: () => void;
    onPrevPhoto: () => void;
    onNextPhoto: () => void;
    onPlayPhotoVoice: () => void;
}

export const ElderlyPhoneShell: React.FC<ElderlyPhoneShellProps> = ({
    time,
    dateStr,
    interimText,
    onToggleMic,
    scenarioState,
    onContactFamily,
    onPrevPhoto,
    onNextPhoto,
    onPlayPhotoVoice
}) => {
    const { 
        activeScene, 
        scenePayload, 
        isTalking, 
        isListening, 
        isThinking, 
        aiMessage,
        closeScene 
    } = scenarioState;

    return (
        <div className="relative w-full h-full max-w-[480px] mx-auto bg-slate-200 rounded-[3.5rem] p-3 shadow-2xl overflow-hidden shadow-indigo-900/20 border-[12px] border-slate-800">
            {/* Inner Content Area */}
            <div className="relative w-full h-full bg-slate-50 rounded-[2.5rem] overflow-hidden flex flex-col shadow-inner">
                
                {/* Always visible base layer */}
                <CompanionHome 
                    isTalking={isTalking}
                    isListening={isListening}
                    isThinking={isThinking}
                    aiMessage={aiMessage}
                    interimText={interimText}
                    onToggleMic={onToggleMic}
                    time={time}
                    dateStr={dateStr}
                />

                {/* Scenario Overlays */}
                {activeScene === 'wandering' && (
                    <WanderingScene 
                        onGoHome={closeScene}
                        onContactFamily={onContactFamily}
                        onDismiss={closeScene}
                    />
                )}

                {activeScene === 'meds' && (
                    <MedicationScene 
                        medicationName={scenePayload.medicationName}
                        onTaken={closeScene}
                        onRemindLater={closeScene}
                        onContactFamily={onContactFamily}
                    />
                )}

                {activeScene === 'sundowning' && (
                    <SundowningScene 
                        riskLevel={scenePayload.riskLevel || 'medium'}
                        interventionText={scenePayload.interventionText}
                        onContactFamily={onContactFamily}
                        onDismiss={closeScene}
                    />
                )}

                {activeScene === 'memory' && (
                    <MemoryScene 
                        photo={scenePayload.photo as MemoryPhoto}
                        isSpeaking={isTalking}
                        onPrev={onPrevPhoto}
                        onNext={onNextPhoto}
                        onClose={closeScene}
                        onPlayVoice={onPlayPhotoVoice}
                    />
                )}
            </div>
        </div>
    );
};
