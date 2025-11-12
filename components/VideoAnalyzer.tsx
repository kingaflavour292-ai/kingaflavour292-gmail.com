
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { extractFramesFromVideo } from '../utils/video';
import { Spinner } from './shared/Spinner';
import { Icon } from './shared/Icon';

const MAX_FRAMES = 16;
const FRAME_EXTRACT_INTERVAL = 1; // in seconds

export const VideoAnalyzer: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('Summarize this video.');
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setVideoFile(file);
            const url = URL.createObjectURL(file);
            setVideoPreviewUrl(url);
            setAnalysisResult('');
            setError(null);
        }
    };

    const handleAnalyzeClick = useCallback(async () => {
        if (!videoFile || !prompt) {
            setError('Please select a video file and enter a prompt.');
            return;
        }

        if (!process.env.API_KEY) {
            setError("API_KEY environment variable not set.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const frames = await extractFramesFromVideo(videoFile, MAX_FRAMES, FRAME_EXTRACT_INTERVAL);

            const imageParts = frames.map(frame => ({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: frame,
                },
            }));

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: [{ parts: [{ text: prompt }, ...imageParts] }],
            });

            setAnalysisResult(response.text);

        } catch (err) {
            console.error('Error analyzing video:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to analyze video: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [videoFile, prompt]);

    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 transition-all duration-300">
            <h2 className="text-2xl font-bold text-purple-400 mb-2 text-center">Video Analyzer</h2>
            <p className="text-gray-400 mb-6 text-center">Upload a video and ask Gemini to analyze it for you.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Input */}
                <div className="flex flex-col space-y-4">
                     <div 
                        className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-gray-700 transition-colors"
                        onClick={triggerFileSelect}
                     >
                        <input
                            type="file"
                            accept="video/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {videoPreviewUrl ? (
                            <video src={videoPreviewUrl} controls className="w-full h-auto rounded-md max-h-64" />
                        ) : (
                           <div className="flex flex-col items-center text-gray-400">
                                <Icon name="upload" className="w-12 h-12 mb-2"/>
                                <p className="font-semibold text-gray-300">Click to upload a video</p>
                                <p className="text-sm">MP4, WebM, etc.</p>
                           </div>
                        )}
                    </div>
                     {videoFile && <p className="text-sm text-center text-gray-400 truncate">Selected: {videoFile.name}</p>}


                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Summarize this video, what are the key objects..."
                        className="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors"
                        rows={3}
                    />
                    <button
                        onClick={handleAnalyzeClick}
                        disabled={isLoading || !videoFile}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Spinner /> : <Icon name="analyze" className="w-5 h-5 mr-2" />}
                        {isLoading ? 'Analyzing...' : 'Analyze Video'}
                    </button>
                </div>

                {/* Right Column: Output */}
                <div className="bg-gray-900 rounded-lg p-4 h-full min-h-[300px] flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-300 mb-3">Analysis Result</h3>
                    <div className="prose prose-invert prose-sm max-w-none flex-grow overflow-y-auto">
                        {isLoading && (
                            <div className="flex items-center justify-center h-full text-gray-400">
                               <Spinner />
                                <span className="ml-3">Extracting frames and analyzing...</span>
                            </div>
                        )}
                        {error && <p className="text-red-400">{error}</p>}
                        {analysisResult ? (
                            <div dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br />') }} />
                        ) : (
                           !isLoading && !error && <p className="text-gray-500">Analysis will appear here.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
