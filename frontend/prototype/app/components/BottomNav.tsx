import { LayoutGrid, Heart, MapPin, Users } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "home", label: "首页", icon: LayoutGrid },
  { id: "health", label: "健康", icon: Heart },
  { id: "location", label: "定位", icon: MapPin },
  { id: "family", label: "家人", icon: Users },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="bg-white/95 backdrop-blur-lg border-t border-gray-100/50 flex items-center justify-around py-1.5 pb-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center gap-0.5 px-5 py-1 transition-all"
          >
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isActive
                  ? "bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-md shadow-[#667eea]/25 scale-105"
                  : "bg-transparent"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] transition-colors ${
                  isActive ? "text-white" : "text-gray-400"
                }`}
              />
            </div>
            <span
              className={`text-[10px] transition-colors ${
                isActive ? "text-[#667eea]" : "text-gray-400"
              }`}
              style={isActive ? { fontWeight: 600 } : {}}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
