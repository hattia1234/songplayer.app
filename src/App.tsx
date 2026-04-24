import { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import getArtistData from '@/artists/selector';

function App() {
  const [artistData, setArtistData] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [streamUrl, setStreamUrl] = useState(null);
  const [coverArt, setCoverArt] = useState(null);
  const [artistImage, setArtistImage] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);        // ← NEW

  const audioRef = useRef<HTMLAudioElement>(null);
  const artistKeyRef = useRef(null);

  // Initialize
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const artistKey = urlParams.get('artist');
    if (!artistKey) {
      setError("Missing artist parameter.");
      return;
    }
    artistKeyRef.current = artistKey;

    try {
      const data = getArtistData(artistKey);
      setArtistData(data);
      if (!data?.albums?.length) {
        setError("No albums found");
        return;
      }
      const firstAlbum = data.albums[0];
      setCurrentAlbum(firstAlbum);
      loadTrack(0, firstAlbum);
      if (data.artistBitmap) loadArtistImage(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load artist data");
    }
  }, []);

  const loadArtistImage = async (data: any) => {
    try {
      const res = await fetch(`/.netlify/functions/image?track=${encodeURIComponent(data.artistBitmap)}`);
      const result = await res.json();
      setArtistImage(result.coverArt || result.url);
    } catch (err) {
      console.error(err);
    }
  };

  // Global Search
  useEffect(() => {
    if (!artistData || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const term = searchTerm.toLowerCase();
    const results: any[] = [];
    artistData.albums.forEach((album: any) => {
      album.tracks.forEach((track: any, trackIndex: number) => {
        if (track.title.toLowerCase().includes(term)) {
          results.push({ ...track, albumName: album.name, globalIndex: trackIndex });
        }
      });
    });
    setSearchResults(results);
  }, [searchTerm, artistData]);

  const loadTrack = async (trackIndex: number, album = currentAlbum) => {
    if (!album || !artistKeyRef.current) return;

    setIsLoadingTrack(true);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsSeeking(false);

    const track = album.tracks[trackIndex];

    try {
      const audioRes = await fetch(
        `/.netlify/functions/stream?artist=${artistKeyRef.current}&album=${album.folder}&track=${encodeURIComponent(track.filename)}`
      );
      const audioData = await audioRes.json();

      const coverRes = await fetch(
        `/.netlify/functions/image?track=${encodeURIComponent(album.cover)}`
      );
      const coverData = await coverRes.json();

      setStreamUrl(audioData.url);
      setCoverArt(coverData.coverArt || coverData.url);
      setCurrentTrackIndex(trackIndex);
      setCurrentAlbum(album);
    } catch (err) {
      console.error("Failed to load track:", err);
      setError("Failed to load audio");
    } finally {
      setIsLoadingTrack(false);
    }
  };

  // Update audio source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    audio.src = streamUrl;
    audio.load();
  }, [streamUrl]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleTimeUpdate = () => {
      if (isSeeking) return;                    // ← Important for fresh streams

      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      handleNext();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isSeeking]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (err) {
      console.error("Play failed:", err);
    }
  };

  const handleNext = () => {
    if (!currentAlbum) return;
    const next = (currentTrackIndex + 1) % currentAlbum.tracks.length;
    loadTrack(next, currentAlbum);
  };

  const handlePrev = () => {
    if (!currentAlbum) return;
    const prev = currentTrackIndex === 0 ? currentAlbum.tracks.length - 1 : currentTrackIndex - 1;
    loadTrack(prev, currentAlbum);
  };

  const seek = (e: React.InputEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
  
      const newProgress = Number(e.currentTarget.value);
      
      setProgress(newProgress);
      setIsSeeking(true);
  
      if (audio.duration && !isNaN(audio.duration)) {
          audio.currentTime = (newProgress / 100) * audio.duration;
      }
  };
  const switchAlbum = (album: any) => {
    setCurrentAlbum(album);
    setSearchTerm("");
    setCurrentTrackIndex(0);
    loadTrack(0, album);
    setSidebarOpen(false);
  };

  const playSearchResult = (result: any) => {
    const album = artistData.albums.find((a: any) => a.name === result.albumName);
    if (album) loadTrack(result.globalIndex, album);
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (error) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-400">Error: {error}</div>;
  if (!artistData || !currentAlbum) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center">Loading...</div>;

  const currentTrack = currentAlbum.tracks[currentTrackIndex];
  const isSearching = searchTerm.trim().length > 0;

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Sidebar - unchanged */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 w-72 bg-black h-full transition-transform duration-300 overflow-auto p-6 flex flex-col`}>
        {artistImage && (
          <div className="mb-6">
            <img src={artistImage} alt={artistData.artist} className="w-full aspect-square object-cover rounded-2xl" />
          </div>
        )}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center text-xl">♪</div>
          <span className="text-2xl font-bold">Songplayer</span>
        </div>
        <div className="mb-8">
          <div className="text-xs text-zinc-500 mb-1">ARTIST</div>
          <div className="text-2xl font-bold">{artistData.artist}</div>
        </div>
        <div className="mb-8">
          <div className="text-xs text-zinc-500 mb-2">ALBUMS</div>
          {artistData.albums.map((alb: any, i: number) => (
            <Button
              key={i}
              variant={currentAlbum.name === alb.name ? "default" : "ghost"}
              className="justify-start w-full text-left mb-1 py-2.5"
              onClick={() => switchAlbum(alb)}
            >
              {alb.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content - unchanged */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-zinc-800 bg-zinc-900">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search songs..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-3 pl-12 text-base focus:outline-none focus:border-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <h1 className="text-3xl lg:text-4xl font-bold mb-8">
            {isSearching ? (
              `Results for "${searchTerm}"`
            ) : (
              <>
                {currentAlbum.name}
                {currentAlbum.subtitle && (
                  <span className="block text-2xl lg:text-3xl text-zinc-400 font-medium mt-1">
                    {currentAlbum.subtitle}
                  </span>
                )}
              </>
            )}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {(isSearching ? searchResults : currentAlbum.tracks).map((item: any, idx: number) => {
              const isCurrent = !isSearching && idx === currentTrackIndex;
              return (
                <div
                  key={idx}
                  className={`group bg-zinc-900 rounded-xl overflow-hidden cursor-pointer transition-all hover:bg-zinc-800 ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`}
                  onClick={() => isSearching ? playSearchResult(item) : loadTrack(idx)}
                >
                  <div className="relative aspect-square">
                    <img src={coverArt} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all">
                      <Button size="icon" className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-full">
                        <Play className="w-6 h-6 text-black ml-0.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className={`font-semibold line-clamp-2 ${isCurrent ? 'text-emerald-400' : ''}`}>
                      {item.title}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      {isSearching ? item.albumName : artistData.artist}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== FIXED PLAYER BAR ==================== */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 p-3 lg:p-4 z-50">
        <div className="max-w-5xl mx-auto flex items-center gap-3 lg:gap-6">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {coverArt && <img src={coverArt} alt="cover" className="w-12 h-12 lg:w-14 lg:h-14 object-cover rounded-lg" />}
            <div className="min-w-0">
              <div className="font-medium truncate">{currentTrack?.title}</div>
              <div className="text-xs lg:text-sm text-zinc-400 truncate">{artistData.artist}</div>
            </div>
          </div>

          <div className="flex flex-col items-center flex-1 max-w-md">
            <div className="flex items-center gap-4 lg:gap-6">
              <Button variant="ghost" size="icon" onClick={handlePrev}>
                <SkipBack className="w-5 h-5" />
              </Button>

              <Button
                onClick={togglePlay}
                disabled={isLoadingTrack || !streamUrl}
                className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-50"
              >
                {isLoadingTrack ? "..." : isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>

              <Button variant="ghost" size="icon" onClick={handleNext}>
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            <div className="w-full flex items-center gap-2 mt-2 text-xs text-zinc-400">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                //onChange={seek}
                onInput={seek}
                onMouseUp={() => setIsSeeking(false)}
                onTouchEnd={() => setIsSeeking(false)}
                onPointerUp={() => setIsSeeking(false)}
                step="0.1"
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <audio ref={audioRef} />
      </div>
    </div>
  );
}

export default App;