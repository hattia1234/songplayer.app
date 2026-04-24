// src/artists/selector.js

import AddictiveCurves from './AddictiveCurves.js';
import Alice from './Alice.js';
// Import other artists here when you create them
// import TheWeeknd from './TheWeeknd.js';

const artistSelector = {
  'AddictiveCurves': AddictiveCurves,
  'Alice': Alice
  
  // Add new artists here:
  // 'TheWeeknd': TheWeeknd,
};

export default function getArtistData(artistKey) {
  if (!artistKey) {
    throw new Error("Artist key is required");
  }

  const data = artistSelector[artistKey];

  if (!data) {
    throw new Error(`Artist "${artistKey}" not found. Add it to selector.js`);
  }

  return data;
}