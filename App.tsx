
import React, { useState } from 'react';
import { VoiceConversation } from './components/VoiceConversation';
import { VideoAnalyzer } from './components/VideoAnalyzer';
import { Header } from './components/shared/Header';
import { Tabs, Tab } from './components/shared/Tabs';
import { Icon } from './components/shared/Icon';

type Feature = 'voice' | 'video';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>('voice');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <Header />
        <Tabs>
          <Tab
            isActive={activeFeature === 'voice'}
            onClick={() => setActiveFeature('voice')}
          >
            <Icon name="voice" />
            Voice Conversation
          </Tab>
          <Tab
            isActive={activeFeature === 'video'}
            onClick={() => setActiveFeature('video')}
          >
            <Icon name="video" />
            Video Analyzer
          </Tab>
        </Tabs>

        <main className="mt-6">
          {activeFeature === 'voice' && <VoiceConversation />}
          {activeFeature === 'video' && <VideoAnalyzer />}
        </main>
      </div>
    </div>
  );
};

export default App;
