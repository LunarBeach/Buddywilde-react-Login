import React, { useState, useEffect, useRef } from 'react';
import './buddyVideoBackground.css';
import { api } from '../../services/api';

const BuddyVideoBackground = () => {
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [previousVideoIndex, setPreviousVideoIndex] = useState(null);
  const videoRef = useRef(null);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('!!! BuddyVideoBackground MOUNTED - This should ONLY happen on front page !!!');
    return () => {
      console.log('!!! BuddyVideoBackground UNMOUNTED !!!');
    };
  }, []);

  // Fetch list of loop videos from API
  useEffect(() => {
    const fetchVideos = async () => {
      console.log('Fetching loop videos from API...');
      try {
        const response = await api.get('/assets/loop-videos');

        if (response.success && response.videos.length > 0) {
          const availableVideos = response.videos;
          console.log('Videos loaded:', availableVideos);
          setVideos(availableVideos);

          // Pick a random first video
          const randomIndex = Math.floor(Math.random() * availableVideos.length);
          console.log('Starting with video index:', randomIndex, 'filename:', availableVideos[randomIndex]);
          setCurrentVideoIndex(randomIndex);
        } else {
          console.error('No videos available from API');
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
        // Fallback to hardcoded list if API fails
        const fallbackVideos = ['loop_video_1.mp4', 'loop_video_2.mp4', 'loop_video_3.mp4'];
        setVideos(fallbackVideos);
        const randomIndex = Math.floor(Math.random() * fallbackVideos.length);
        setCurrentVideoIndex(randomIndex);
      }
    };

    fetchVideos();
  }, []);

  // Handle video end - select next random video
  const handleVideoEnd = () => {
    console.log('=== VIDEO ENDED ===');
    console.log('Current video index:', currentVideoIndex);
    console.log('Previous video index:', previousVideoIndex);
    console.log('Total videos:', videos.length);

    if (videos.length === 0) {
      console.error('No videos available!');
      return;
    }

    let nextIndex;

    if (videos.length === 1) {
      // Only one video, replay it
      nextIndex = 0;
      console.log('Only one video - replaying index 0');
    } else {
      // Pick a random video excluding the current one (not previous, but current!)
      const availableIndices = videos
        .map((_, index) => index)
        .filter(index => index !== currentVideoIndex);

      console.log('Available indices (excluding current):', availableIndices);

      const randomSelection = Math.floor(Math.random() * availableIndices.length);
      nextIndex = availableIndices[randomSelection];
      console.log('Selected next video index:', nextIndex, 'filename:', videos[nextIndex]);
    }

    setPreviousVideoIndex(currentVideoIndex);
    setCurrentVideoIndex(nextIndex);
    console.log('Updated: previousVideoIndex will be', currentVideoIndex, ', currentVideoIndex will be', nextIndex);
  };

  // Ensure video plays when changed
  useEffect(() => {
    if (videoRef.current && videos.length > 0) {
      console.log('Loading video:', videos[currentVideoIndex]);
      videoRef.current.load();
      videoRef.current.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }, [currentVideoIndex, videos]);

  if (videos.length === 0) {
    return null; // Don't render anything until videos are loaded
  }

  const currentVideo = videos[currentVideoIndex];

  return (
    <div className="video-background">
      <video
        ref={videoRef}
        className="video-background__video"
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
      >
        <source
          src={`/assets/videos/loop_videos/${currentVideo}`}
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
      <div className="video-background__overlay"></div>
    </div>
  );
};

export default BuddyVideoBackground;
