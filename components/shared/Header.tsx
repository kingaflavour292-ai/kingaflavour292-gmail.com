
import React from 'react';
import { Icon } from './Icon';

export const Header: React.FC = () => {
    return (
        <header className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3">
                <Icon name="spark" className="w-10 h-10 text-cyan-400" />
                <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    Gemini Multimedia Assistant
                </h1>
            </div>
            <p className="mt-3 text-lg text-gray-400">
                Explore the frontiers of AI with voice and video.
            </p>
        </header>
    );
};
