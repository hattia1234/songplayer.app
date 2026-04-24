// src/artists/Template.js
// ================================================================
// ARTIST TEMPLATE
// Copy this file and rename it to the artist's name (e.g. TheWeeknd.js)
// ================================================================

const artistData = {
  artist: "Artist Full Name",           // Display name (e.g. "The Weeknd")
  genre: "Genre / Style",               // e.g. "R&B / Pop"

  albums: [
    {
      name: "Album Name",               // Display name
      folder: "AlbumFolderName",        // Exact folder name in B2 (no artist prefix)
      cover: "AlbumFolderName/AlbumFolderName.jpg",   // Cover art path

      tracks: [
        {
          title: "Song Title",          // Clean display title
          filename: "SongTitle.mp3"     // Exact filename in B2
        }
        // Add more tracks from this album here
      ]
    }
    // Add more albums here
  ]
};

export default artistData;