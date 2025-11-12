
/**
 * Extracts frames from a video file.
 * @param videoFile The video file to process.
 * @param maxFrames The maximum number of frames to extract.
 * @param interval The interval in seconds between frame extractions.
 * @returns A promise that resolves to an array of base64 encoded frame strings.
 */
export const extractFramesFromVideo = (videoFile: File, maxFrames: number, interval: number): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target && typeof e.target.result === 'string') {
                video.src = e.target.result;
            }
        };
        reader.onerror = (e) => reject(new Error('Error reading video file'));
        reader.readAsDataURL(videoFile);

        const frames: string[] = [];
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            return reject(new Error('Could not get canvas context.'));
        }

        const captureFrame = () => {
            if (frames.length >= maxFrames) {
                video.pause();
                video.src = '';
                resolve(frames);
                return;
            }

            try {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
                frames.push(base64Data);

                const nextTime = video.currentTime + interval;
                if (nextTime < video.duration) {
                    video.currentTime = nextTime;
                } else {
                    video.pause();
                    video.src = '';
                    resolve(frames);
                }
            } catch (err) {
                 reject(err);
            }
        };

        video.onloadeddata = () => {
            video.currentTime = 0;
        };

        video.onseeked = () => {
            // Give it a moment to render the frame
            setTimeout(captureFrame, 100);
        };

        video.onerror = () => {
            reject(new Error('Error loading video data. The file might be corrupt or in an unsupported format.'));
        };

        video.onended = () => {
            if (frames.length < maxFrames) {
                resolve(frames);
            }
        };
    });
};
