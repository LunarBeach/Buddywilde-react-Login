import React, { useState, useEffect, useRef } from 'react';
import './buddyVideoBackground.css';

const BuddyVideoBackground = () => {
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [previousVideoIndex, setPreviousVideoIndex] = useState(null);
  const videoRef = useRef(null);

  // Fetch list of videos from the server
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        console.log('Fetching loop videos...');
        const response = await fetch('https://buddywilde.com/wp-content/themes/buddy_wilde_theme/bw-db-credentials.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get_loop_videos'
          })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Videos response data:', data);

        if (data.success && data.videos && data.videos.length > 0) {
          console.log('Videos loaded:', data.videos);
          setVideos(data.videos);
          // Pick a random first video
          const randomIndex = Math.floor(Math.random() * data.videos.length);
          console.log('Starting with video index:', randomIndex, 'filename:', data.videos[randomIndex]);
          setCurrentVideoIndex(randomIndex);
          setPreviousVideoIndex(randomIndex);
        } else {
          console.error('No videos found or invalid response:', data);
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
      }
    };

    fetchVideos();
  }, []);

  // Handle video end - select next random video
  const handleVideoEnd = () => {
    if (videos.length === 0) return;

    let nextIndex;

    if (videos.length === 1) {
      // Only one video, replay it
      nextIndex = 0;
    } else {
      // Pick a random video excluding the previous one
      const availableIndices = videos
        .map((_, index) => index)
        .filter(index => index !== previousVideoIndex);

      const randomSelection = Math.floor(Math.random() * availableIndices.length);
      nextIndex = availableIndices[randomSelection];
    }

    setPreviousVideoIndex(currentVideoIndex);
    setCurrentVideoIndex(nextIndex);
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
          src={`https://buddywilde.com/wp-content/themes/buddy_wilde_theme/assets/loop_videos/${currentVideo}`}
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
      <div className="video-background__overlay"></div>
    </div>
  );
};

export default BuddyVideoBackground;
