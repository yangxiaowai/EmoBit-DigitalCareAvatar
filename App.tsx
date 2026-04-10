import React, { useEffect, useReducer, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ElderlyApp from './components/ElderlyApp';
import { SystemStatus } from './types';
import { Activity, Bell, LayoutDashboard, Smartphone } from 'lucide-react';
import { openclawSyncService } from './services/openclawSyncService';
import { syncAppShellState } from './services/dataBackendClient';
import { appReducer, createDefaultAppState, loadPersistedAppState, persistAppState, toHydratableAppState } from './src/core/appReducer';
import { createScenarioEventBus } from './src/core/eventBus';
import { mountBridgeAdapter } from './src/core/eventAdapters/bridgeAdapter';
import { createDemoAdapter } from './src/core/eventAdapters/demoAdapter';
import { mountServiceAdapter } from './src/core/eventAdapters/serviceAdapter';

const App: React.FC = () => {
  const initialStateRef = useRef<ReturnType<typeof createDefaultAppState> | null>(null);
  if (!initialStateRef.current) {
    initialStateRef.current = loadPersistedAppState() ?? createDefaultAppState();
  }

  const eventBusRef = useRef<ReturnType<typeof createScenarioEventBus> | null>(null);
  if (!eventBusRef.current) {
    eventBusRef.current = createScenarioEventBus();
  }

  const demoAdapterRef = useRef<ReturnType<typeof createDemoAdapter> | null>(null);
  if (!demoAdapterRef.current) {
    demoAdapterRef.current = createDemoAdapter(eventBusRef.current);
  }

  const [state, dispatch] = useReducer(appReducer, initialStateRef.current);

  useEffect(() => {
    return eventBusRef.current.subscribe((event) => {
      dispatch({ type: 'event.ingested', event });
    });
  }, []);

  useEffect(() => {
    return mountServiceAdapter(eventBusRef.current);
  }, []);

  useEffect(() => {
    return mountBridgeAdapter(eventBusRef.current);
  }, []);

  useEffect(() => {
    if (initialStateRef.current.logs.length > 0) return;
    return demoAdapterRef.current.emitBootSequence();
  }, []);

  useEffect(() => {
    persistAppState(state);

    const timer = window.setTimeout(() => {
      void syncAppShellState(openclawSyncService.getElderId(), toHydratableAppState(state));
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar
        currentSimulation={state.simulation}
        onScenarioRequest={(simulation) => demoAdapterRef.current.requestSimulation(simulation)}
        onReset={() => demoAdapterRef.current.resetSystem()}
        logs={state.logs}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300">
        
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Activity className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">MemoLink <span className="text-slate-400 font-light">忆联</span></h1>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => demoAdapterRef.current.requestViewSwitch('app')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${state.activeView === 'app' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Smartphone size={16} />
              老人端 (App)
            </button>
            <button 
              onClick={() => demoAdapterRef.current.requestViewSwitch('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${state.activeView === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutDashboard size={16} />
              家属端 (后台)
            </button>
          </div>
          
          <div className="flex items-center gap-4">
             <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
               state.systemStatus === SystemStatus.NORMAL ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
               state.systemStatus === SystemStatus.WARNING ? 'bg-amber-50 text-amber-600 border-amber-200' :
               'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
             }`}>
               <div className={`w-2 h-2 rounded-full ${
                  state.systemStatus === SystemStatus.NORMAL ? 'bg-emerald-500' :
                  state.systemStatus === SystemStatus.WARNING ? 'bg-amber-500' :
                  'bg-rose-500'
               }`}></div>
               {state.systemStatus === SystemStatus.NORMAL ? '系统运行正常' : state.systemStatus === SystemStatus.WARNING ? '检测到异常行为' : '严重警报触发'}
             </div>
             <button className="relative p-2 text-slate-400 hover:text-slate-600">
               <Bell size={20} />
               {state.systemStatus !== SystemStatus.NORMAL && (
                 <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
               )}
             </button>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-hidden bg-slate-50 relative">
          <div className="h-full w-full">
            {state.activeView === 'dashboard' ? (
              <Dashboard status={state.systemStatus} simulation={state.simulation} logs={state.logs} />
            ) : (
              <div className="h-full w-full overflow-y-auto p-6">
                 <ElderlyApp status={state.systemStatus} simulation={state.simulation} externalMessage={state.elderMessage} externalAction={state.elderAction} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
