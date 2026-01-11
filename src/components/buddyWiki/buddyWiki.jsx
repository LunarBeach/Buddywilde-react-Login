import React, { useState, useEffect } from 'react';
import './buddyWiki.css';

const BuddyWiki = () => {
  // Sample character data - you'll want to expand this with all your characters
  const [characters] = useState([
    {
      id: 1,
      name: 'Character 1',
      title: 'Main Character',
      subtitle: 'Leader of the group',
      backgroundImage: 'https://via.placeholder.com/800x400/4a90e2/ffffff?text=Character+1',
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      gallery: [
        {
          id: 1,
          imageUrl: 'https://via.placeholder.com/300x200/4a90e2/ffffff?text=Gallery+1',
          caption: 'Character photo 1',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        },
        {
          id: 2,
          imageUrl: 'https://via.placeholder.com/300x200/50c878/ffffff?text=Gallery+2',
          caption: 'Character photo 2',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        }
      ]
    },
    {
      id: 2,
      name: 'Character 2',
      title: 'Supporting Character',
      subtitle: 'Sidekick',
      backgroundImage: 'https://via.placeholder.com/800x400/50c878/ffffff?text=Character+2',
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      gallery: [
        {
          id: 1,
          imageUrl: 'https://via.placeholder.com/300x200/50c878/ffffff?text=Gallery+1',
          caption: 'Character photo 1',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        }
      ]
    },
    // Add more characters as needed
    {
      id: 3,
      name: 'Character 3',
      title: 'Antagonist',
      subtitle: 'Main villain',
      backgroundImage: 'https://via.placeholder.com/800x400/e74c3c/ffffff?text=Character+3',
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      gallery: [
        {
          id: 1,
          imageUrl: 'https://via.placeholder.com/300x200/e74c3c/ffffff?text=Gallery+1',
          caption: 'Character photo 1',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        },
        {
          id: 2,
          imageUrl: 'https://via.placeholder.com/300x200/9b59b6/ffffff?text=Gallery+2',
          caption: 'Character photo 2',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        },
        {
          id: 3,
          imageUrl: 'https://via.placeholder.com/300x200/f39c12/ffffff?text=Gallery+3',
          caption: 'Character photo 3',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        }
      ]
    }
  ]);

  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);

  const selectedCharacter = characters[selectedCharacterIndex];

  const handleCharacterClick = (index) => {
    setSelectedCharacterIndex(index);
  };

  const handlePrevClick = () => {
    setSelectedCharacterIndex(prev => 
      prev > 0 ? prev - 1 : characters.length - 1
    );
  };

  const handleNextClick = () => {
    setSelectedCharacterIndex(prev => 
      prev < characters.length - 1 ? prev + 1 : 0
    );
  };

  const openLightbox = (image) => {
    setSelectedGalleryImage(image);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedGalleryImage(null);
  };

  return (
    <div className="wiki-container">
      {/* Upper div with character cells */}
      <div className="upper-div">
        <div className="character-cells-container">
          {characters.map((character, index) => (
            <div
              key={character.id}
              className={`character-cell ${index === selectedCharacterIndex ? 'selected' : ''}`}
              onClick={() => handleCharacterClick(index)}
            >
              <span className="character-name">{character.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lower div with character details */}
      <div className="lower-div">
        <div className="character-details-container">
          {/* Background image */}
          <div className="background-image-container">
            <img 
              src={selectedCharacter.backgroundImage} 
              alt={selectedCharacter.name} 
              className="background-image"
            />
          </div>

          {/* Character title and subtitle */}
          <div className="character-info">
            <h2 className="character-title">{selectedCharacter.title}</h2>
            <h3 className="character-subtitle">{selectedCharacter.subtitle}</h3>
          </div>

          {/* YouTube embed */}
          <div className="youtube-container">
            <iframe
              src={selectedCharacter.youtubeUrl}
              title={`${selectedCharacter.name} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="youtube-iframe"
            />
          </div>

          {/* Gallery */}
          <div className="gallery-container">
            <div className="gallery-header">
              <h3>Gallery</h3>
            </div>
            <div className="gallery-grid">
              {selectedCharacter.gallery.map((image) => (
                <div 
                  key={image.id} 
                  className="gallery-item"
                  onClick={() => openLightbox(image)}
                >
                  <img 
                    src={image.imageUrl} 
                    alt={image.caption} 
                    className="gallery-image"
                  />
                  <div className="gallery-caption">{image.caption}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <div className="navigation-arrows">
            <button className="nav-arrow prev-arrow" onClick={handlePrevClick}>
              &lt; Prev
            </button>
            <button className="nav-arrow next-arrow" onClick={handleNextClick}>
              Next &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && selectedGalleryImage && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>×</button>
            <img 
              src={selectedGalleryImage.imageUrl} 
              alt={selectedGalleryImage.caption} 
              className="lightbox-image"
            />
            <div className="lightbox-caption">{selectedGalleryImage.caption}</div>
            {selectedGalleryImage.videoUrl && (
              <div className="lightbox-video-container">
                <iframe
                  src={selectedGalleryImage.videoUrl}
                  title={`${selectedGalleryImage.caption} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="lightbox-video"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuddyWiki;
