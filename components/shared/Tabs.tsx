
import React from 'react';

interface TabsProps {
    children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ children }) => {
    return (
        <div className="flex justify-center bg-gray-800/50 rounded-lg p-1 space-x-1 backdrop-blur-sm">
            {children}
        </div>
    );
};

interface TabProps {
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

export const Tab: React.FC<TabProps> = ({ isActive, onClick, children }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full text-center px-6 py-2.5 text-sm font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus-visible:ring-cyan-400 flex items-center justify-center space-x-2
                ${isActive
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
        >
            {children}
        </button>
    );
};
