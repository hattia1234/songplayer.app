import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Search, X, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import getArtistData from '@/artists/selector';
import SubscriptionGuard from '@/SubscriptionGuard'; // for subscriptions

function App() {
    const [artistData, setArtistData] = useState(null);
    const [currentAlbum, setCurrentAlbum] = useState(null);
    const [activeTab, setActiveTab] = useState<'albums' | 'songs'>('albums'); // ← NEW
    
    const [searchTerm, setSearchTerm] = useState("");
//    const [searchResults, setSearchResults] = useState([]);
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
    const [isSeeking, setIsSeeking] = useState(false);
    const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

    const [playbackMode, setPlaybackMode] = useState<'sequential' | 'shuffle' | 'repeat-one' | 'repeat-all'>('sequential');
    const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

    const audioRef = useRef<HTMLAudioElement>(null);
    const artistKeyRef = useRef(null);
    const shouldAutoPlayRef = useRef(true);

    // ==================== INDEXEDDB FULL MP3 CACHING (Minimal) ====================
    const DB_NAME = 'GrokifyAudioCache';
    const STORE_NAME = 'tracks';

    const openDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 2);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
                }
            };
        });
    };

    const getCachedAudio = async (cacheKey: string): Promise<string | null> => {
        try {
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(cacheKey);
                req.onsuccess = () => {
                    if (req.result && req.result.blob) {
                        const objectUrl = URL.createObjectURL(req.result.blob);
                        resolve(objectUrl);
                    } else {
                        resolve(null);
                    }
                    db.close();
                };
                req.onerror = () => { resolve(null); db.close(); };
            });
        } catch (e) {
            console.warn(`[IndexedDB] Read failed for ${cacheKey}`, e);
            return null;
        }
    };

    const cacheAudioFile = async (cacheKey: string, audioBlob: Blob): Promise<void> => {
        try {
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ 
                    cacheKey, 
                    blob: audioBlob, 
                    timestamp: Date.now() 
                });
                tx.oncomplete = () => { resolve(); db.close(); };
                tx.onerror = () => { 
                    console.warn(`[IndexedDB] Write failed for ${cacheKey}`); 
                    db.close(); 
                    resolve(); 
                };
            });
        } catch (e) {
            console.warn(`[IndexedDB] Cache failed for ${cacheKey}`, e);
        }
    };
    // ==================== END FULL MP3 CACHING ====================

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

	// Global Search (temporarily disabled to fix build)
	useEffect(() => {
		// Search functionality can be re-enabled later
	}, [searchTerm, artistData]);

    const generateShuffledOrder = useCallback(() => {
        if (!currentAlbum) return;
        const order = Array.from({ length: currentAlbum.tracks.length }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        setShuffledOrder(order);
    }, [currentAlbum]);

    useEffect(() => {
        if (playbackMode === 'shuffle' && currentAlbum) generateShuffledOrder();
    }, [playbackMode, currentAlbum, generateShuffledOrder]);

    const loadTrack = async (trackIndex: number, album = currentAlbum) => {
        if (!album || !artistKeyRef.current) return;

        setIsLoadingTrack(true);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setIsSeeking(false);

        const track = album.tracks[trackIndex];
        const cacheKey = `${artistKeyRef.current}/${album.folder}/${track.filename}`;

        try {
            let audioUrl = await getCachedAudio(cacheKey);

            if (!audioUrl) {
                console.log(`[CACHE MISS] Downloading full MP3: ${cacheKey}`);

                // Get signed URL (we still need this call)
                await fetch(
                    `/.netlify/functions/stream?artist=${artistKeyRef.current}&album=${album.folder}&track=${encodeURIComponent(track.filename)}`
                );

                // Proxy through Netlify to avoid CORS and get the blob
                const blobRes = await fetch(
                    `/.netlify/functions/stream?artist=${artistKeyRef.current}&album=${album.folder}&track=${encodeURIComponent(track.filename)}&proxy=true`
                );

                if (!blobRes.ok) throw new Error(`Proxy failed: ${blobRes.status}`);

                const audioBlob = await blobRes.blob();

                await cacheAudioFile(cacheKey, audioBlob);
                audioUrl = URL.createObjectURL(audioBlob);
            } else {
                console.log(`[CACHE HIT - Full MP3] ${cacheKey}`);
            }

            const coverRes = await fetch(`/.netlify/functions/image?track=${encodeURIComponent(album.cover)}`);
            const coverData = await coverRes.json();

            setStreamUrl(audioUrl);
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
    // Auto play after new track loads
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !streamUrl) return;

        audio.src = streamUrl;
        audio.load();

        const timer = setTimeout(() => {
            if (shouldAutoPlayRef.current) {
                audio.play().catch(console.error);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [streamUrl]);

    const handleNext = useCallback(() => {
        if (!currentAlbum) return;

        let nextIndex = currentTrackIndex;

        if (playbackMode === 'shuffle' && shuffledOrder.length > 0) {
            const currentPos = shuffledOrder.indexOf(currentTrackIndex);
            nextIndex = currentPos < shuffledOrder.length - 1 
                ? shuffledOrder[currentPos + 1] 
                : shuffledOrder[0];
        } else {
            nextIndex = (currentTrackIndex + 1) % currentAlbum.tracks.length;
        }

        loadTrack(nextIndex, currentAlbum);
    }, [currentAlbum, currentTrackIndex, playbackMode, shuffledOrder]);

    const handlePrev = () => {
        if (!currentAlbum) return;
        const prev = currentTrackIndex === 0 ? currentAlbum.tracks.length - 1 : currentTrackIndex - 1;
        loadTrack(prev, currentAlbum);
    };

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

    // Audio listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => {
            if (isSeeking) return;
            setCurrentTime(audio.currentTime);
            if (audio.duration && !isNaN(audio.duration)) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        const handleLoadedMetadata = () => setDuration(audio.duration);

        const handleEnded = () => {
            setIsPlaying(false);

            if (playbackMode === 'repeat-one') {
                audio.currentTime = 0;
                audio.play().catch(console.error);
                return;
            }

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
    }, [isSeeking, handleNext, playbackMode]);

    const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const newProgress = Number(e.target.value);
        setProgress(newProgress);
        setIsSeeking(true);
        if (audio.duration && !isNaN(audio.duration)) {
            const newTime = (newProgress / 100) * audio.duration;
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleSeekEnd = () => setIsSeeking(false);

    const switchAlbum = (album: any) => {
        setCurrentAlbum(album);
        setActiveTab('albums');           // ← NEW: Return to Albums tab when switching
        setSearchTerm("");
        setCurrentTrackIndex(0);
        loadTrack(0, album);
        setSidebarOpen(false);
    };

//    const playSearchResult = (result: any) => {
//        const album = artistData.albums.find((a: any) => a.name === result.albumName);
//        if (album) loadTrack(result.globalIndex, album);
//    };

    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const togglePlayerExpand = () => setIsPlayerExpanded(prev => !prev);
    const closeSidebar = () => setSidebarOpen(false);

    const toggleMode = (mode: 'sequential' | 'shuffle' | 'repeat-one' | 'repeat-all') => {
        setPlaybackMode(prev => (prev === mode ? 'sequential' : mode));
    };

    if (error) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-400">Error: {error}</div>;
    if (!artistData || !currentAlbum) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center">Loading...</div>;

    const currentTrack = currentAlbum.tracks[currentTrackIndex];
//    const isSearching = searchTerm.trim().length > 0;
    const urlParams = new URLSearchParams(window.location.search);
    const artistKey = urlParams.get('artist');

    return (
	<SubscriptionGuard artistKey={artistKey}>
        <div className="flex h-screen bg-zinc-950 text-white overflow-hidden relative">
            {/* SIDEBAR - unchanged */}
            <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-50 w-80 sm:w-72 lg:w-80 bg-zinc-950 h-full transition-transform duration-300 overflow-auto p-4 lg:p-6 flex flex-col border-r border-zinc-800`}>
                <div className="flex items-center justify-between lg:hidden mb-6 sticky top-0 bg-zinc-950 pb-4 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-xl">♪</div>
                        <span className="text-xl font-bold">Songplayer</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={closeSidebar}>✕</Button>
                </div>

                {artistImage && (
                    <div className="mb-6">
                        <img src={artistImage} alt={artistData.artist} className="w-full max-h-[260px] sm:max-h-[220px] lg:max-h-none aspect-square object-cover rounded-2xl" />
                    </div>
                )}

                <div className="mb-8">
                    <div className="text-xs text-zinc-500 mb-1">ARTIST</div>
                    <div className="text-2xl font-bold">{artistData.artist}</div>
                </div>

                <div className="flex-1 overflow-auto pb-32">
                    <div className="text-xs text-zinc-500 mb-3 sticky top-0 bg-zinc-950 py-2 z-10">ALBUMS</div>
                    {artistData.albums.map((alb: any, i: number) => (
                        <Button
                            key={i}
                            variant={currentAlbum.name === alb.name ? "default" : "ghost"}
                            className="justify-start w-full text-left mb-1.5 py-3 text-base"
                            onClick={() => switchAlbum(alb)}
                        >
                            {alb.name}
                        </Button>
                    ))}
                </div>
            </div>

            {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={closeSidebar} />}

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-zinc-800 bg-zinc-900 flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </Button>

                    <div className="relative flex-1 max-w-2xl">
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

                <div className="flex-1 overflow-auto p-4 lg:p-8 pb-36">
                    <h1 className="text-3xl lg:text-4xl font-bold mb-6">
                        {artistData.artist}
                    </h1>

                    {/* TABS - NEW */}
                    <div className="flex border-b border-zinc-800 mb-8">
                        <button
                            onClick={() => setActiveTab('albums')}
                            className={`px-8 py-4 font-medium text-lg transition-all ${activeTab === 'albums' 
                                ? 'border-b-2 border-emerald-500 text-white' 
                                : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Albums
                        </button>
                        <button
                            onClick={() => setActiveTab('songs')}
                            className={`px-8 py-4 font-medium text-lg transition-all ${activeTab === 'songs' 
                                ? 'border-b-2 border-emerald-500 text-white' 
                                : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Songs
                        </button>
                    </div>

					{/* ALBUMS TAB */}
					{activeTab === 'albums' && (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
							{artistData.albums.map((alb: any, i: number) => (
								<div
									key={i}
									className={`group bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer transition-all hover:bg-zinc-800 ${currentAlbum?.name === alb.name ? 'ring-2 ring-emerald-500' : ''}`}
									onClick={() => switchAlbum(alb)}
								>
									<div className="relative aspect-square">
										<img 
											src={alb.cover} 
											alt={alb.name} 
											className="w-full h-full object-cover transition-transform group-hover:scale-105" 
										/>
										<div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
											<Button size="icon" className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-full">
												<Play className="w-6 h-6 text-black" />
											</Button>
										</div>
									</div>
									<div className="p-4">
										<div className="font-semibold line-clamp-2">{alb.name}</div>
										{alb.subtitle && <div className="text-sm text-zinc-400 mt-1">{alb.subtitle}</div>}
									</div>
								</div>
							))}
						</div>
					)}
					{/* SONGS TAB - Card Grid Format */}
					{activeTab === 'songs' && (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
							{currentAlbum?.tracks?.map((track: any, idx: number) => {
								const isCurrent = idx === currentTrackIndex;
								
								return (
									<div
										key={idx}
										className={`group bg-zinc-900 rounded-xl overflow-hidden cursor-pointer transition-all hover:bg-zinc-800 ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`}
										onClick={() => loadTrack(idx, currentAlbum)}
									>
										<div className="relative aspect-square">
											<img 
												src={currentAlbum.cover} 
												alt={track.title} 
												className="w-full h-full object-cover transition-transform group-hover:scale-105" 
											/>
											<div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all">
												<Button size="icon" className="w-11 h-11 bg-emerald-500 hover:bg-emerald-600 rounded-full">
													<Play className="w-5 h-5 text-black ml-0.5" />
												</Button>
											</div>
										</div>
										<div className="p-3.5">
											<div className={`font-semibold line-clamp-2 text-sm ${isCurrent ? 'text-emerald-400' : ''}`}>
												{track.title}
											</div>
											<div className="text-xs text-zinc-400 mt-1 line-clamp-1">
												{currentAlbum.name}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
                </div>
            </div>

            {/* MINI PLAYER */}
            <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 p-3 lg:p-4 z-50 cursor-pointer active:bg-zinc-800 transition-colors" onClick={togglePlayerExpand}>
                <div className="max-w-5xl mx-auto flex items-center gap-3 lg:gap-6">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {coverArt && <img src={coverArt} alt="cover" className="w-12 h-12 lg:w-14 lg:h-14 object-cover rounded-lg flex-shrink-0" />}
                        <div className="min-w-0">
                            <div className="font-medium truncate text-sm lg:text-base">{currentTrack?.title}</div>
                            <div className="text-xs text-zinc-400 truncate">{artistData.artist}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 lg:gap-6">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePrev(); }}>
                            <SkipBack className="w-5 h-5" />
                        </Button>
                        <Button onClick={(e) => { e.stopPropagation(); togglePlay(); }} disabled={isLoadingTrack || !streamUrl}
                            className="w-11 h-11 lg:w-14 lg:h-14 rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-50">
                            {isLoadingTrack ? (
                                <div className="w-5 h-5 border-2 border-zinc-400 border-t-white animate-spin rounded-full" />
                            ) : isPlaying ? (
                                <Pause className="w-5 h-5 lg:w-6 lg:h-6" />
                            ) : (
                                <Play className="w-5 h-5 lg:w-6 lg:h-6" />
                            )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                            <SkipForward className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* EXPANDED PLAYER */}
            {isPlayerExpanded && (
                <div className="fixed inset-0 bg-zinc-950 z-[70] flex flex-col overflow-hidden">
                    <div className="p-4 flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setIsPlayerExpanded(false)}>
                            <X className="w-7 h-7" />
                        </Button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8 overflow-auto">
                        {coverArt && (
                            <div className="w-full max-w-[380px] aspect-square">
                                <img src={coverArt} alt="cover" className="w-full h-full object-cover rounded-3xl shadow-2xl" />
                            </div>
                        )}

                        <div className="text-center w-full max-w-md">
                            <div className="text-2xl sm:text-3xl font-bold mb-2">{currentTrack?.title}</div>
                            <div className="text-lg text-zinc-400">{artistData.artist}</div>
                        </div>

                        <div className="w-full max-w-md">
                            <div className="flex justify-between text-sm text-zinc-400 mb-2 px-1">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={progress}
                                onChange={seek}
                                onMouseUp={handleSeekEnd}
                                onTouchEnd={handleSeekEnd}
                                onPointerUp={handleSeekEnd}
                                step="0.1"
                                className="w-full accent-emerald-500 cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-8">
                            <Button variant="ghost" size="icon" onClick={handlePrev} className="w-14 h-14">
                                <SkipBack className="w-8 h-8" />
                            </Button>
                            <Button onClick={togglePlay} disabled={isLoadingTrack || !streamUrl}
                                className="w-20 h-20 rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-50">
                                {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleNext} className="w-14 h-14">
                                <SkipForward className="w-8 h-8" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-6 text-zinc-400 pt-4">
                            <Button variant="ghost" size="icon" onClick={() => toggleMode('shuffle')} className={playbackMode === 'shuffle' ? 'text-emerald-400' : ''}>
                                <Shuffle className="w-6 h-6" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleMode('repeat-all')} className={playbackMode === 'repeat-all' ? 'text-emerald-400' : ''}>
                                <Repeat className="w-6 h-6" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleMode('repeat-one')} className={playbackMode === 'repeat-one' ? 'text-emerald-400' : ''}>
                                <Repeat1 className="w-6 h-6" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleMode('sequential')} className={playbackMode === 'sequential' ? 'text-emerald-400' : ''}>
                                <span className="text-xl font-bold">→</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <audio ref={audioRef} />
        </div>
	</SubscriptionGuard>
    );
}

export default App;