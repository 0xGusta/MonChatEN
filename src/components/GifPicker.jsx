import React, { useState, useEffect, useRef } from 'react';

const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY;

export default function GifPicker({ isOpen, onClose, onSelectGif }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [gifs, setGifs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const pickerRef = useRef(null);

    const fetchGifs = async () => {
        setIsLoading(true);
        const url = searchTerm
            ? `https://tenor.googleapis.com/v2/search?q=${searchTerm}&key=${TENOR_API_KEY}&limit=20`
            : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            setGifs(data.results || []);
        } catch (error) {
            console.error("Error fetching GIFs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchGifs();
        }
    }, [isOpen]);

    
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm) {
                fetchGifs();
            }
        }, 1000); 

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);


    if (!isOpen) return null;

    return (
        <div className="emoji-picker overflow-y-auto pr-2 styled-scrollbar" ref={pickerRef}>
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search GIFs..."
                className="input-field mb-2"
            />
            {isLoading ? (
                <div className="flex justify-center items-center h-full">
                    <div className="loading-spinner"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[200px]">
                    {gifs.map((gif) => (
                        <div key={gif.id} className="cursor-pointer" onClick={() => onSelectGif(gif.media_formats.gif.url)}>
                            <img src={gif.media_formats.tinygif.url} alt={gif.content_description} className="w-full h-full object-cover rounded-md" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
