import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePresence } from './hooks/usePresence';
import { CONTRACT_ADDRESS, ABI, MONAD_TESTNET, EMOJIS, userProfilesCache } from './utils/constants';
import { uploadToIPFS, getIPFSUrl } from './utils/ipfs';
import { truncateAddress, linkifyText, getFriendlyErrorMessage, showLinkConfirmation, isMobile } from './utils/helpers';
import { useStateTogether } from 'react-together';
import TypingIndicator from './components/TypingIndicator';
import Popup from './components/Popup';
import AboutModal from './components/AboutModal';
import ProfileModal from './components/ProfileModal';
import EditProfileModal from './components/EditProfileModal';
import SendMONModal from './components/SendMONModal';
import ModerationModal from './components/ModerationModal';
import GifPicker from './components/GifPicker';
import OnlineCounter from './components/OnlineCounter';
import LinkConfirmationModal from './components/LinkConfirmationModal';
import ConsoleModal from './components/ConsoleModal';
import GameModal from './components/GameModal'; // New import
import GameSelectionModal from './components/GameSelectionModal'; // New import
import { useAccount, useDisconnect, useBalance, useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';
import { monadTestnet } from 'viem/chains';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/dist/photoswipe.css';

async function walletClientToSigner(walletClient) {
    const { account, chain, transport } = walletClient;
    const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
    };
    const provider = new BrowserProvider(transport, network);
    const signer = await provider.getSigner(account.address);
    return signer;
}

export default function ChatApp() {
    const { address, isConnected, chain } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { disconnect } = useDisconnect();
    const { data: balanceData, refetch: refetchBalance } = useBalance({ address });
    const [contract, setContract] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [userProfile, setUserProfile] = useState(null);
    const [balance, setBalance] = useState('0');
    const [popup, setPopup] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const [selectedUserAddress, setSelectedUserAddress] = useState('');
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [showSendMONModal, setShowSendMONModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [showModerationModal, setShowModerationModal] = useState(false);
    const [showLinkConfirmationModal, setShowLinkConfirmationModal] = useState(false);
    const [linkToConfirm, setLinkToConfirm] = useState('');
    const [moderationAction, setModerationAction] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [isModerator, setIsModerator] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unseenMessages, setUnseenMessages] = useState(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [nextPage, setNextPage] = useState(1);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isForcedAboutModal, setIsForcedAboutModal] = useState(false);
    const [availableWallets, setAvailableWallets] = useState([]); // This state is not directly used but was in the original ChatApp
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedGifUrl, setSelectedGifUrl] = useState(null);
    const [isWrongNetwork, setIsWrongNetwork] = useState(false);
    const [rawProvider, setRawProvider] = useState(null);

    // Game states and functions
    const [showGameSelectionModal, setShowGameSelectionModal] = useState(false);
    const [selectedOpponentForChallenge, setSelectedOpponentForChallenge] = useState(null);
    const [gamePlayers, setGamePlayers] = useState([]);
    const [gameSessionId, setGameSessionId] = useState(null);
    const [activeGame, setActiveGame] = useState(null);
    const [challenges, setChallenges] = useStateTogether('challenges', {});


    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const emojiButtonRef = useRef(null);
    const scrollAnchorRef = useRef(null);
    const textareaRef = useRef(null);
    const isFetchingNewerMessages = useRef(false);
    const hasAttemptedAutoConnect = useRef(false);
    const lastMessageCountRef = useRef(0);
    const typingTimeoutRef = useRef(null);
    const lastTypingValue = useRef(false);
    const dropdownRef = useRef(null);
    const lightboxRef = useRef(null);
    const { onlineUsers, updateMyPresence, onlineCount } = usePresence(address, userProfile?.username);
    const [showConsoleModal, setShowConsoleModal] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState([]);

    const MESSAGES_PER_PAGE = 25;

    useEffect(() => {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        const formatMessage = (args) => {
            return args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return 'Unserializable object';
                    }
                }
                return arg;
            }).join(' ');
        };

        const addToLogs = (type, message) => {
            setConsoleLogs(prevLogs => [
                ...prevLogs,
                {
                    type,
                    message,
                    timestamp: new Date().toLocaleTimeString()
                }
            ]);
        };

        console.log = (...args) => {
            originalLog.apply(console, args);
            addToLogs('log', formatMessage(args));
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            addToLogs('error', formatMessage(args));
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            addToLogs('warn', formatMessage(args));
        };

        return () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);

    useEffect(() => {
        const setupApp = async () => {

            if (isConnected && walletClient && address) {
                console.log("Setting up app with connected wallet:", address);
                const isOnCorrectNetwork = chain?.id === monadTestnet.id;
                setIsWrongNetwork(!isOnCorrectNetwork);
    
                if (!isOnCorrectNetwork) {
                    setContract(null);
                    return;
                }
                const signer = await walletClientToSigner(walletClient);
                const newContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
                setContract(newContract);
    
                const [profileData, ownerAddress, isModeratorResult] = await Promise.all([
                    newContract.obterPerfilUsuario(address),
                    newContract.dono(),
                    newContract.moderadores(address)
                ]);
    
                if (profileData.exists) {
                    const userRole = await newContract.obterRoleUsuario(address);
                    const profile = { username: profileData.username, profilePicHash: profileData.profilePicHash, exists: true, role: Number(userRole) };
                    setUserProfile(profile);
                    userProfilesCache.set(address.toLowerCase(), profile);
                    const isOwnerCheck = ownerAddress.toLowerCase() === address.toLowerCase();
                    setIsOwner(isOwnerCheck);
                    setIsModerator(isModeratorResult || isOwnerCheck);
                } else {
                    setUserProfile({ exists: false, username: '', profilePicHash: '', role: 0 });
                    setIsForcedAboutModal(true);
                    setShowAboutModal(true);
                }
                
                if (messages.length === 0) {
                    await loadMessages(newContract);
                }
    
            } else {
                console.log("Setting up app in read-only mode.");
                setIsWrongNetwork(false);
                setUserProfile(null);
                
                const rpcUrls = MONAD_TESTNET.rpcUrls.default.http;
                let connectedContract = null;

                for (const url of rpcUrls) {
                    try {
                        console.log(`Attempting to connect to RPC: ${url}`);
                        const publicProvider = new ethers.JsonRpcProvider(url);
                        const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
                        await readOnlyContract.contadorMensagens();
                        console.log(`Successfully connected to RPC: ${url}`);
                        connectedContract = readOnlyContract;
                        break; 
                    } catch (e) {
                        console.warn(`Failed to connect to RPC ${url}. Trying next...`);
                    }
                }

                if (connectedContract) {
                    setContract(connectedContract);
                    if (messages.length === 0) {
                       await loadMessages(connectedContract);
                    }
                } else {
                    console.error("Could not connect to any Monad Testnet RPCs.");
                    showPopup('Could not connect to the Monad network. The service may be temporarily unavailable.', 'error');
                }
            }
        };
    
        setupApp();

    }, [isConnected, address, walletClient, chain]);

    useEffect(() => {
        if (!isConnected || isAppLoading) {
            console.log("[Polling] Stopping polling: wallet not connected or app is loading.");
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            return;
        }
    
        let readOnlyPollingContract = null;
        const publicRpcUrls = MONAD_TESTNET.rpcUrls.default.http;
    
        const setupPollingProvider = () => {
            if (!publicRpcUrls || publicRpcUrls.length === 0) {
                console.error("[Polling Setup] RPC URL list is empty. Polling cannot function.");
                return;
            }
            for (const url of publicRpcUrls) {
                try {
                    console.log(`[Polling Setup] Attempting public RPC for polling: ${url}`);
                    const publicProvider = new ethers.JsonRpcProvider(url);
                    readOnlyPollingContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
                    console.log(`[Polling Setup] Public RPC ${url} selected for polling.`);
                    return;
                } catch (e) {
                    console.warn(`[Polling Setup] Failed to connect to public RPC ${url}.`);
                }
            }
            console.error("[Polling Setup] Could not connect to any public RPCs for polling. Polling may not function.");
        };
    
        setupPollingProvider();
    
        const startPolling = () => {
            if (!readOnlyPollingContract) {
                console.error("[Polling] No read-only contract is available. Polling cannot start.");
                return;
            }
            console.log("[Polling] Starting message polling with a dedicated read-only provider.");
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    console.log("[Polling] Checking for new messages using public provider...");
                    const blockNumber = await readOnlyPollingContract.runner.provider.getBlockNumber();
                    console.log(`[Polling] Current block (via public RPC): ${blockNumber}`);
                    const totalMessagesBigInt = await readOnlyPollingContract.contadorMensagens();
                    const total = Number(totalMessagesBigInt);
                    const previous = lastMessageCountRef.current;
                    console.log(`[Polling] Current total on contract (via public RPC): ${total}`);
                    console.log(`[Polling] Previous local total: ${previous}`);
    
                    if (total > previous) {
                        const newMessagesCount = total - previous;
                        console.log(`[Polling] New messages detected: ${newMessagesCount}`);
                        
                        await loadLatestMessages(total); 
    
                        const container = messagesContainerRef.current;
                        const isAtBottom = container
                            ? (container.scrollHeight - container.scrollTop - container.clientHeight) < container.clientHeight
                            : true;
                        if (isAtBottom) {
                            console.log("[Polling] User is at bottom — auto-scrolling.");
                            setTimeout(() => scrollToBottom(), 300);
                        } else {
                            console.log("[Polling] User is not at bottom — incrementing unseen messages.");
                            setUnseenMessages(prev => prev + newMessagesCount);
                        }
                        console.log(`[Polling] UPDATING local count from ${previous} to ${total}.`);
                        lastMessageCountRef.current = total;
                    } else {
                        console.log("[Polling] No new messages.");
                    }
                } catch (error) {
                    console.error("[Polling] Error fetching messages with public provider:", error);
                    console.log("[Polling] Attempting to re-setup the polling provider...");
                    setupPollingProvider();
                }
            }, 5000);
        };
    
        startPolling();
    
        return () => {
            if (pollingIntervalRef.current) {
                console.log("[Polling] Clearing polling interval.");
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [isConnected, contract, isAppLoading]);
    
    useEffect(() => {
        if (balanceData) {
            setBalance(Number(balanceData.formatted).toFixed(2));
        }
    }, [balanceData]);

    useEffect(() => {
        const handleShowLinkConfirmation = (event) => {
            setLinkToConfirm(event.detail);
            setShowLinkConfirmationModal(true);
        };

        window.addEventListener('showLinkConfirmation', handleShowLinkConfirmation);

        return () => {
            window.removeEventListener('showLinkConfirmation', handleShowLinkConfirmation);
        };
    }, []);

    useEffect(() => {

        return () => {
            if (lightboxRef.current) {
                lightboxRef.current.destroy();
                lightboxRef.current = null;
            }
        };
    }, []);

    const handleTyping = () => {
        
        if (!lastTypingValue.current) {
            updateMyPresence({ isTyping: true });
            lastTypingValue.current = true;
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            updateMyPresence({ isTyping: false });
            lastTypingValue.current = false;
        },2000);
    };

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    const openLightbox = async (clickedMessageId) => {
        
        const imageMessages = filteredMessages.filter(msg => msg.imageHash);

        if (imageMessages.length === 0) return;

        const startIndex = imageMessages.findIndex(msg => msg.id === clickedMessageId);
        if (startIndex === -1) return;

        const getDimensions = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    resolve({ w: img.naturalWidth, h: img.naturalHeight });
                };
                img.onerror = () => {
                    resolve({ w: 800, h: 600 });
                };
                img.src = url;
            });
        };

        showPopup('Loading gallery...', 'info', true);

        const dataSource = await Promise.all(imageMessages.map(async (msg) => {
            const imageUrl = msg.imageHash.startsWith('http') ? msg.imageHash : getIPFSUrl(msg.imageHash);
            const { w, h } = await getDimensions(imageUrl);
            return {
                src: imageUrl,
                w: w,
                h: h,
                alt: msg.conteudo || 'Image from chat'
            };
        }));
        
        hidePopup();

        if (lightboxRef.current) {
            lightboxRef.current.destroy();
        }

        const options = {
            dataSource: dataSource,
            index: startIndex,
            bgOpacity: 0.85,

        };

        lightboxRef.current = new PhotoSwipe(options);
        lightboxRef.current.init();
    };


    const showPopup = (message, type = 'info', isLoading = false) => {
        setPopup({ message, type, isLoading, isExiting: false });
    };

    const handlePaste = useCallback((event) => {
        const items = event.clipboardData.items;
        if (!items) {
            return;
        }

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                event.preventDefault();
                const file = items[i].getAsFile();
                setSelectedImage(file);
                setSelectedGifUrl(null);
                showPopup('Image pasted from clipboard!', 'success');
                break;
            }
        }
    }, [setSelectedImage, setSelectedGifUrl, showPopup]);

    // New Game Challenge useEffect
    useEffect(() => {
        // Handle incoming challenges (where current user is the opponent)
        const pendingChallengeForMe = Object.entries(challenges).find(([, challenge]) =>
            challenge?.opponent?.address?.toLowerCase() === address?.toLowerCase() &&
            challenge.status === 'pending'
        );

        if (pendingChallengeForMe && !activeGame) {
            const [challengeId, challengeData] = pendingChallengeForMe;
            const confirmChallenge = window.confirm(
                `Incoming ${challengeData.game} challenge from ${challengeData.challenger.username}! Do you accept?`
            );
            if (confirmChallenge) {
                acceptChallenge(challengeId, challengeData);
            } else {
                rejectChallenge(challengeId, challengeData);
            }
        }

        // Handle when my own sent challenge is accepted by the opponent
        const acceptedChallengeByMe = Object.entries(challenges).find(([, challenge]) =>
            challenge?.challenger?.address?.toLowerCase() === address?.toLowerCase() &&
            challenge.status === 'accepted'
        );

        if (acceptedChallengeByMe && !activeGame) {
            const [challengeId, challengeData] = acceptedChallengeByMe;
            setGamePlayers([challengeData.challenger, challengeData.opponent]);
            setGameSessionId(challengeData.gameSessionId);
            setActiveGame(challengeData.game);
            showPopup(`Your challenge to ${challengeData.opponent.username} for ${challengeData.game} was accepted!`, 'success');
            setChallenges(prev => ({
                ...prev,
                [challengeId]: { ...challengeData, status: 'started' }
            }));
        }
    }, [challenges, address, activeGame, setChallenges, showPopup]);

    useLayoutEffect(() => {
        const container = messagesContainerRef.current;
        if (container && scrollAnchorRef.current?.scrollHeight) {
            const newHeight = container.scrollHeight;
            const oldHeight = scrollAnchorRef.current.scrollHeight;
            container.scrollTop = newHeight - oldHeight;
            scrollAnchorRef.current = null;
        }
    }, [messages]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.addEventListener('paste', handlePaste);
        }

        return () => {
            if (textarea) {
                textarea.removeEventListener('paste', handlePaste);
            }
        };
    }, [handlePaste]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setUnseenMessages(0);
    };

    const hidePopup = () => {
        setPopup(p => p ? { ...p, isExiting: true } : null);
    };

    const processAndSetMessages = async (newRawMessages, contractInstance) => {
        const addressesToFetch = new Set();
        newRawMessages.forEach(msg => {
            const remetente = msg[0];
            if (remetente && remetente !== ethers.ZeroAddress && !userProfilesCache.has(remetente.toLowerCase())) {
                addressesToFetch.add(remetente);
            }
        });

        for (const addressToFetch of addressesToFetch) {
            try {
                const profile = await contractInstance.obterPerfilUsuario(addressToFetch);
                if (profile.exists) {
                    const role = await contractInstance.obterRoleUsuario(addressToFetch);
                    const senderProfile = {
                        username: profile.username,
                        profilePicHash: profile.profilePicHash,
                        exists: profile.exists,
                        role: Number(role)
                    };
                    userProfilesCache.set(addressToFetch.toLowerCase(), senderProfile);
                }
               await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e) {
                console.error(`Error fetching profile for ${addressToFetch}:`, e);
            }
        }

        const processedMessages = newRawMessages.map(msg => {
            if (!msg || typeof msg !== 'object' || !msg[0]) {
                console.warn("Skipping invalid message object from contract:", msg);
                return null;
            }
            const remetente = msg[0];
            const senderProfile = userProfilesCache.get(remetente.toLowerCase());
    
            return {
                id: Number(msg.id),
                remetente: msg[0],
                usuario: msg[1],
                conteudo: msg[2],
                imageHash: msg[3],
                timestamp: Number(msg[4]),
                excluida: msg[5],
                respondeA: Number(msg[6]),
                senderProfile
            };
        }).filter(Boolean);
    
        setMessages(prevMessages => {
            const messageMap = new Map(prevMessages.map(m => [m.id, m]));
            processedMessages.forEach(m => messageMap.set(m.id, m));
            
            const allMessages = Array.from(messageMap.values());
            allMessages.sort((a, b) => a.timestamp - b.timestamp);
            
            return allMessages;
        });
    };

    const loadMessages = async (contractInstance) => {
        try {
            const totalMessages = Number(await contractInstance.contadorMensagens());
            const [paginatedMessages, proximaPagina] = await contractInstance.obterMensagensPaginadas(0, MESSAGES_PER_PAGE);
    
            const messagesWithIds = paginatedMessages.map((msg, index) => ({
                ...msg,
                id: totalMessages - index
            }));
    
            await processAndSetMessages([...messagesWithIds].reverse(), contractInstance);
    
            if (Number(proximaPagina) > 0) {
                setNextPage(Number(proximaPagina));
                setHasMoreMessages(true);
            } else {
                setHasMoreMessages(false);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };
    
    const loadMoreMessages = async () => {
        if (isLoadingMore || !hasMoreMessages) return;
    
        if (messagesContainerRef.current) {
            scrollAnchorRef.current = { scrollHeight: messagesContainerRef.current.scrollHeight };
        }
        setIsLoadingMore(true);
    
        try {
            let contractToUse = contract;
            if (!contractToUse) {
                const publicProvider = new ethers.JsonRpcProvider(MONAD_TESTNET.rpcUrls.default.http[0]); // Using default RPC from MONAD_TESTNET
                contractToUse = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
            }
    
            const totalMessages = Number(await contractToUse.contadorMensagens());
            const [paginatedMessages, proximaPagina] = await contractToUse.obterMensagensPaginadas(nextPage, MESSAGES_PER_PAGE);
    
            if (paginatedMessages.length > 0) {
                const idOfFirstMessageInPage = totalMessages - (nextPage * MESSAGES_PER_PAGE);
                const messagesWithIds = paginatedMessages.map((msg, index) => ({
                    ...msg,
                    id: idOfFirstMessageInPage - index
                }));
                await processAndSetMessages([...messagesWithIds].reverse(), contractToUse, true);
            }
            
            if (Number(proximaPagina) > 0) {
                setNextPage(Number(proximaPagina));
                setHasMoreMessages(true);
            } else {
                setHasMoreMessages(false);
            }
        } catch (error) {
            console.error("Error loading more messages:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };
    
    const loadLatestMessages = async (totalMessagesOnChain) => {
        if (isFetchingNewerMessages.current) return;
        console.log(`[Loader] Starting to load latest messages. Expecting total of ${totalMessagesOnChain}.`);
    
        try {
            isFetchingNewerMessages.current = true;
            const lastIdInState = lastMessageCountRef.current;
    
            if (totalMessagesOnChain > lastIdInState) {
                const newMessages = [];
                
                const publicProvider = new ethers.JsonRpcProvider(MONAD_TESTNET.rpcUrls.default.http[0]); // Using default RPC
                const readerContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
                console.log("[Loader] Created a temporary public provider to fetch message details.");
    
                for (let i = lastIdInState + 1; i <= totalMessagesOnChain; i++) {
                    console.log(`[Loader] Fetching message ID: ${i}`);
                    const msg = await readerContract.obterMensagem(i);
                    newMessages.push({ ...msg, id: i });
                }
    
                if (newMessages.length > 0) {
                    console.log(`[Loader] Fetched ${newMessages.length} new messages. Processing them now...`);
                    await processAndSetMessages(newMessages, readerContract);
                }
            } else {
                 console.log(`[Loader] No new messages to load. Chain total (${totalMessagesOnChain}) is not greater than local total (${lastIdInState}).`);
            }
        } catch (error) {
            console.error('[Loader] Error loading latest messages:', error);
        } finally {
            isFetchingNewerMessages.current = false;
            console.log("[Loader] Finished loading latest messages.");
        }
    };
     
    const handleSelectGif = (gifUrl) => {
        setSelectedGifUrl(gifUrl); 
        setSelectedImage(null);
        setShowGifPicker(false);   
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < clientHeight;
        setShowScrollButton(!isAtBottom);

        if (isAtBottom) {
            const scrollButton = document.querySelector('.scroll-to-bottom');
            if (scrollButton) scrollButton.classList.remove('new-message');
            setUnseenMessages(0);
        }
    };

    useEffect(() => {
        if (!popup) return;

        if (popup.isExiting) {
            const removeTimer = setTimeout(() => {
                setPopup(null);
            }, 300);
            return () => clearTimeout(removeTimer);
        } else if (!popup.isLoading) {
            const exitTimer = setTimeout(() => {
                hidePopup();
            }, 3000);
            return () => clearTimeout(exitTimer);
        }
    }, [popup]);

    useEffect(() => {
        // This effect block appears to be for auto-connecting specific wallets,
        // which might be part of an AppKit or similar wallet connector.
        // If 'availableWallets' is not being populated or used elsewhere,
        // this block might be non-functional or intended for future use.
        // Assuming 'availableWallets' would be populated by a wallet connector library.
        if (availableWallets.length > 0 && !isConnected && !hasAttemptedAutoConnect.current) {
            const lastRdns = localStorage.getItem('lastConnectedWalletRdns');
            if (lastRdns) {
                
                const walletToReconnect = availableWallets.find(w => w.info.rdns === lastRdns);

                if (walletToReconnect) {
                    console.log(`Attempting automatic reconnection with ${walletToReconnect.info.name}...`);

                    hasAttemptedAutoConnect.current = true;
                    // This initiateConnection might need to be adapted based on the actual
                    // wallet connection library used (e.g., Wagmi's connect function).
                    // For now, keeping the original structure from the provided code.
                    // initiateConnection(walletToReconnect.provider, walletToReconnect.info);
                }
            }
        }
    }, [availableWallets, isConnected]); 

    // This function is commented out in the original context, leaving it as is.
    // If wallet auto-connection is desired, this function might need to be re-evaluated
    // in conjunction with the wagmi hooks.
    // const initiateConnection = async (walletProvider, walletName) => {
    //     showPopup(`Connecting with ${walletName}...`, 'info', true);
    //     try {
            
    //         const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });
    //         if (accounts.length === 0) {
    //             hidePopup();
    //             showPopup('No account selected', 'error');
    //             return;
    //         }

            
    //         try {
    //             await walletProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: MONAD_TESTNET.chainId }] });
    //         } catch (switchError) {
                
    //             if (switchError.code === 4902) {
    //                 await walletProvider.request({ method: 'wallet_addEthereumChain', params: [MONAD_TESTNET] });
    //             } else {
                    
    //                 hidePopup();
    //                 showPopup('Please switch to the Monad Testnet network in your wallet.', 'warning');
    //                 return;
    //             }
    //         }

    //         const provider = new ethers.BrowserProvider(walletProvider);
    //         const signer = await provider.getSigner();
    //         const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    //         const userAddress = accounts[0];

    //         setIsWrongNetwork(false); 
    //         setProvider(provider);
    //         setRawProvider(walletProvider);
    //         setSigner(signer);
    //         setContract(contract);
    
    //         const [profileData, balanceData, ownerAddress, isModeratorResult] = await Promise.all([
    //             contract.obterPerfilUsuario(userAddress),
    //             provider.getBalance(userAddress),
    //             contract.dono(),
    //             contract.moderadores(userAddress)
    //         ]);

    //         const profileExists = profileData.exists;

    //         if (!profileExists) {
    //             hidePopup();
    //             setUserProfile({ exists: false, username: '', profilePicHash: '', role: 0 });
    //             setIsOwner(false);
    //             setIsModerator(false);
    //             setBalance('0'); 
    //             setIsForcedAboutModal(true);
    //             setShowAboutModal(true);
    //         } else {
    //             const isOwnerResult = ownerAddress.toLowerCase() === userAddress.toLowerCase();
    //             const finalIsModerator = isOwnerResult || isModeratorResult; 
    //             const userRole = await contract.obterRoleUsuario(userAddress);
    //             const userProfile = { username: profileData.username, profilePicHash: profileData.profilePicHash, exists: true, role: Number(userRole) };
    //             setUserProfile(userProfile);
    //             userProfilesCache.set(userAddress.toLowerCase(), userProfile);
    //             setIsOwner(isOwnerResult);
    //             setIsModerator(finalIsModerator);
    //             setBalance(ethers.formatEther(balanceData));
    //             hidePopup();
    //             showPopup('Wallet connected!', 'success');
    //         }

    //         if (messages.length === 0) {
    //             await loadMessages(contract);
    //         }

    //     } catch (error) {
    //         console.error(`Error connecting with ${walletName}:`, error);
    //         hidePopup();
    //         const friendlyMessage = getFriendlyErrorMessage(error);
    //         showPopup(`Error: ${friendlyMessage}`, 'error');
    //         disconnectWallet();
    //     }
    // };

    const disconnectWallet = () => {
        hidePopup();
        localStorage.removeItem('lastConnectedWalletRdns'); // Ensure this is cleared
        disconnect(); // Use wagmi's disconnect
        setSigner(null);
        setProvider(null);
        setContract(null);
        setRawProvider(null);
        setUserProfile(null);
        setBalance('0');
        setShowDropdown(false);
        setIsOwner(false);
        setIsModerator(false);
        setIsWrongNetwork(false);
        setIsInitialLoad(true);
        setMessages([]);
        setTimeout(async () => {
            try {
                const publicProvider = new ethers.JsonRpcProvider(MONAD_TESTNET.rpcUrls.default.http[0]);
                const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
                await loadMessages(readOnlyContract);
            } catch (error) {
                console.error("Error reloading messages after disconnecting:", error);
            } finally {
                setIsInitialLoad(false);
            }
        }, 50); 
    };

    // New: Handle challenge initiation from ProfileModal
    const handleChallenge = (opponentAddress, opponentUsername) => {
        setSelectedOpponentForChallenge({ address: opponentAddress, username: opponentUsername });
        setShowGameSelectionModal(true);
    };

    // New: Handle selected game from GameSelectionModal
    const onChallengeConfirmed = async (gameType) => {
        if (!address || !userProfile || !selectedOpponentForChallenge) return;

        showPopup('Sending game challenge...', 'info', true);
        const newGameSessionId = Date.now().toString();

        const challengeData = {
            challenger: { address: address, username: userProfile.username },
            opponent: selectedOpponentForChallenge,
            game: gameType,
            gameSessionId: newGameSessionId,
            status: 'pending'
        };

        setChallenges(prev => ({
            ...prev,
            [newGameSessionId]: challengeData
        }));

        setShowGameSelectionModal(false);
        showPopup(`Challenge sent to ${selectedOpponentForChallenge.username} for ${gameType}!`, 'success');
    };

    // New: Handle game modal close
    const onGameModalClose = () => {
        setActiveGame(null);
        setGameSessionId(null);
        setGamePlayers([]);
        // Optionally, update the challenge status to 'completed' or remove it from 'challenges'
        // For simplicity, we can remove completed/rejected challenges after a delay or on next app load.
    };
              
    const handleAgreeAndProceedToProfile = () => {
        setShowAboutModal(false);     
        setIsForcedAboutModal(false);   
        setShowEditProfileModal(true);  
    };
              
    const handleScrollToReply = (messageId) => {
        const targetElement = document.getElementById(`message-${messageId}`);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const bubbleElement = targetElement.closest('.message-bubble');
            if (bubbleElement) {
                bubbleElement.classList.add('highlight-message');
                setTimeout(() => {
                    bubbleElement.classList.remove('highlight-message');
                }, 3000);
            }
        } else {
            showPopup("The replied message is not loaded in the chat.", 'info');
        }
    };

    const loadUserProfile = async (contractInstance, userAddress) => {
        try {
            const profileData = await contractInstance.obterPerfilUsuario(userAddress);
            if (profileData.exists) {
                const userRole = await contractInstance.obterRoleUsuario(userAddress);
                const profile = {
                    username: profileData.username,
                    profilePicHash: profileData.profilePicHash,
                    exists: true,
                    role: Number(userRole)
                };
                userProfilesCache.set(userAddress.toLowerCase(), profile);
                // Only update current user profile if it's their own
                if (address && userAddress.toLowerCase() === address.toLowerCase()) {
                    setUserProfile(profile);
                }
            } else {
                if (address && userAddress.toLowerCase() === address.toLowerCase()) {
                    setUserProfile({ exists: false, username: '', profilePicHash: '', role: 0 });
                }
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
            showPopup('Could not refresh user profile.', 'error');
        }
    };
    
    const sendMessage = async () => {
        
        if (!newMessage.trim() && !selectedImage && !selectedGifUrl) return;

        showPopup('Sending message...', 'info', true);

        try {
            const textContent = newMessage.trim();
            let imageHashContent = ''; 
            const replyId = replyingTo ? replyingTo.id : 0;

            if (selectedImage) {
                setUploading(true);
                imageHashContent = await uploadToIPFS(selectedImage, setUploadProgress);
            } else if (selectedGifUrl) {
                
                imageHashContent = selectedGifUrl;
            }

            const tx = await contract.enviarMensagem(textContent, imageHashContent, replyId);
            await tx.wait();
            

            setNewMessage('');
            setSelectedImage(null);
            setSelectedGifUrl(null);
            setReplyingTo(null);
            setEditingMessage(null);

            hidePopup();
            showPopup('Message sent!', 'success');
            
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const editMessage = async (messageId, newContent) => {
        try {
            showPopup('Editing message...', 'info', true);
            const tx = await contract.editarMensagem(messageId, newContent);
            await tx.wait();
            hidePopup();
            showPopup('Message edited!', 'success');
            setEditingMessage(null);
            setNewMessage('');
            
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };

    const deleteMessage = async (messageId) => {
        try {
            showPopup('Deleting message...', 'info', true);
            const tx = await contract.excluirMensagem(messageId);
            await tx.wait();
            hidePopup();
            showPopup('Message deleted!', 'success');
            
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };

    const registerUser = async (username, profilePicHash = '') => { 
        try { 
            showPopup('Registering user...', 'info', true); 
            const tx = await contract.registrarUsuario(username, profilePicHash); 
            await tx.wait(); 
            hidePopup(); 
            showPopup('User registered successfully!', 'success'); 
            await loadUserProfile(contract, address); 

            if (provider && address) {
                const newBalance = await provider.getBalance(address);
                setBalance(ethers.formatEther(newBalance));
            }

        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error); 
            showPopup(friendlyMessage, 'error'); 
        } 
    };
    
    const updateProfile = async (username, profilePicHash) => {
        try {
            showPopup('Updating profile...', 'info', true);
            const tx = await contract.atualizarPerfil(username, profilePicHash);
            await tx.wait();
            hidePopup();
            showPopup('Profile updated!', 'success');
            await loadUserProfile(contract, address);
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };


    const sendMON = async (recipientAddress, amount) => {
        try {
            if (!walletClient) {
                showPopup('Wallet not connected', 'error');
                return;
            }

            showPopup('Sending MON...', 'info', true);

            const currentSigner = await walletClientToSigner(walletClient);

            const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, ABI, currentSigner);

            const tx = await contractWithSigner.enviarMon(recipientAddress, amount, { value: amount });
            await tx.wait();

            hidePopup();
            showPopup('MON sent successfully!', 'success');

            refetchBalance();

        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };


    const banUser = async (username) => {
        try {
            const userAddress = await contract.usernameToAddress(username);
            if (userAddress === ethers.ZeroAddress) {
                showPopup('User not found', 'error');
                return;
            }
            showPopup('Banning user...', 'info', true);
            const tx = await contract.banirUsuario(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('User banned!', 'success');
            
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };


    const unbanUser = async (username) => {
        try {
            const userAddress = await contract.usernameToAddress(username);
            if (userAddress === ethers.ZeroAddress) {
                showPopup('User not found', 'error');
                return;
            }
            showPopup('Unbanning user...', 'info', true);
            const tx = await contract.desbanirUsuario(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('User unbanned!', 'success');
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };


    const addModerator = async (username) => {
        try {
            const userAddress = await contract.usernameToAddress(username);
            if (userAddress === ethers.ZeroAddress) {
                showPopup('User not found', 'error');
                return;
            }
            showPopup('Adding moderator...', 'info', true);
            const tx = await contract.adicionarModerador(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('Moderator added!', 'success');
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };

    const removeModerator = async (username) => {
        try {
            const userAddress = await contract.usernameToAddress(username);
            if (userAddress === ethers.ZeroAddress) {
                showPopup('User not found', 'error');
                return;
            }
            showPopup('Removing moderator...', 'info', true);
            const tx = await contract.removerModerador(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('Moderator removed!', 'success');
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };

    const handleProfileClick = async (userAddress) => {
        try {
            const presenceInfo = onlineUsers.find(u => u.userId?.toLowerCase() === userAddress.toLowerCase());
            const isOnline = presenceInfo?.isOnline || false;

            let profile = userProfilesCache.get(userAddress.toLowerCase());

            if (!profile && userAddress !== CONTRACT_ADDRESS) {
                const profileData = await contract.obterPerfilUsuario(userAddress);
                if (profileData.exists) {
                    profile = {
                        username: profileData.username,
                        profilePicHash: profileData.profilePicHash,
                        exists: profileData.exists,
                    };
                    userProfilesCache.set(userAddress.toLowerCase(), profile);
                }
            }

            setSelectedUserAddress(userAddress);
            setSelectedUserProfile(profile);
            setShowProfileModal(true);
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleReply = (message) => {
        setEditingMessage(null);
        setReplyingTo(message);
        document.querySelector('textarea')?.focus();
    };

    const handleEdit = (message) => {
        setReplyingTo(null);
        setEditingMessage(message);
        setNewMessage(message.conteudo);
        document.querySelector('textarea')?.focus();
    };

    const handleImageSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                showPopup('File too large. Maximum 10MB.', 'error');
                return;
            }
            setSelectedImage(file);
            setSelectedGifUrl(null);
        }
    };

    const handleEmojiSelect = (emoji) => {
        setNewMessage(prev => prev + emoji);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (editingMessage) {
                editMessage(editingMessage.id, newMessage);
            } else {
                sendMessage();
            }
        }
    };

    const openModerationModal = (action) => {
        setModerationAction(action);
        setShowModerationModal(true);
        setShowDropdown(false);
    };

    const handleModerationAction = async (username) => {
        switch (moderationAction) {
            case 'ban':
                await banUser(username);
                break;
            case 'unban':
                await unbanUser(username);
                break;
            case 'addModerator':
                await addModerator(username);
                break;
            case 'removeModerator':
                await removeModerator(username);
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        if (messages.length > 0) {
            const latestId = messages[messages.length - 1].id;
  
            if (latestId > lastMessageCountRef.current) {
                lastMessageCountRef.current = latestId;
            }
        }
    }, [messages]); 

    useEffect(() => {

        const initApp = async () => {

            try {
                const publicProvider = new ethers.JsonRpcProvider(MONAD_TESTNET.rpcUrls.default.http[0]); // Using default RPC
                const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);

                await loadMessages(readOnlyContract);
            } catch (error) {
                console.error("Error initializing:", error);
                if (error.code === -32007 || (error.error && error.error.code === -32007)) {
                    showPopup('The network is congested. Please reload the page in a few moments.', 'error', true);
                }
            } finally {

                setIsInitialLoad(false)
                setIsAppLoading(false); 
            }
        };
        initApp();
    }, []);

    useEffect(() => {
        if (!isInitialLoad) {
            setTimeout(() => scrollToBottom(), 300);
        }
    }, [isInitialLoad]);
    
    useLayoutEffect(() => {
        const container = messagesContainerRef.current;
        if (container && scrollAnchorRef.current?.scrollHeight) {
            const newHeight = container.scrollHeight;
            const oldHeight = scrollAnchorRef.current.scrollHeight;
            container.scrollTop = newHeight - oldHeight;
            scrollAnchorRef.current = null;
        }
    }, [messages]);
    
    
    useEffect(() => {

    if (!isConnected || !chain) { // Removed provider and rawProvider check directly, relying on wagmi's `chain`
        return;
    }

    const checkNetwork = async () => {
        try {
            const onCorrectNetwork = chain?.id === monadTestnet.id;
            setIsWrongNetwork(!onCorrectNetwork);
        } catch (error) {
            console.error("Error checking network:", error);
            setIsWrongNetwork(true);
        }
    };

    checkNetwork(); 

    const networkInterval = setInterval(checkNetwork, 3000);

    return () => {
        clearInterval(networkInterval);

        // if (rawProvider && rawProvider.removeListener) { // This part depends on rawProvider handling, keep it if it's external to wagmi
        //     rawProvider.removeListener('accountsChanged', handleAccountsChanged);
        // }
    };

    }, [isConnected, chain]); // Dependency on `chain` from wagmi

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showEmojiPicker &&
                emojiPickerRef.current && 
                !emojiPickerRef.current.contains(event.target) &&
                emojiButtonRef.current &&
                !emojiButtonRef.current.contains(event.target)
            ) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showDropdown &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);



    const filteredMessages = messages.filter(message => !message.excluida);
    const messageGroups = [];
    let currentGroup = null;

    filteredMessages.forEach(message => {
        const isSystem = message.remetente === CONTRACT_ADDRESS;

        const presenceInfo = onlineUsers.find(u => u.userId?.toLowerCase() === message.remetente.toLowerCase());

        if (!currentGroup || currentGroup.remetente !== message.remetente || currentGroup.isSystem || isSystem) {
            currentGroup = {
                remetente: message.remetente,
                usuario: message.usuario,
                senderProfile: message.senderProfile,
                isOwn: message.remetente?.toLowerCase() === address?.toLowerCase(),
                isSystem: isSystem,
                key: `group-${message.id}-${message.timestamp}-${message.remetente}`,
                messages: [message],
            };
            messageGroups.push(currentGroup);
        } else {
            currentGroup.messages.push(message);
        }
    });

    return (
        <div className="app-container">
            <header className="header-fixed flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="logo">
                        <img src="/images/logo.png" title="Thank you for using!" alt="Logo"></img>
                    </div>
                    <div className="hidden sm:block">
                        <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
                            <i className="fas fa-circle text-xs"></i>
                            {isConnected ? 'Connected' : 'Read-Only'}
                        </div>
                        {isConnected && <OnlineCounter count={onlineCount} />}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isConnected ? (
                        <>
                            <div className="balance-display">
                                <div className="balance-amount" title="Your MONs balance">
                                    <img src="/images/monad.png" alt="Monad token">
                                    </img> {parseFloat(balance).toFixed(2)}
                                </div>
                            </div>
                            <div className="dropdown-container relative" ref={dropdownRef}>
                                <button onClick={() => setShowDropdown(!showDropdown)}>
                                    {userProfile?.profilePicHash ? (<img src={getIPFSUrl(userProfile.profilePicHash)} alt="Profile" className="profile-pic pfpheader" />) : (<img src="/images/nopfp.png" alt="No photo" className="profile-pic pfpheader" />)}
                                </button>
                                {showDropdown && (
                                    <div className="dropdown-menu">
                                        
                                        <div className="dropdown-info-item" title={address}>
                                                <appkit-account-button/>
                                            </div>

                                        

                                        <hr className="my-1 border-gray-600" />
                                        

                                        <div
                                            className="dropdown-item"
                                            onClick={() => {
                                                handleProfileClick(address);
                                                setShowDropdown(false);
                                            }}
                                            >
                                            <i className="fas fa-user"></i> My profile
                                        </div>

                                        <div
                                            className="dropdown-item"
                                            onClick={() => {
                                                setShowEditProfileModal(true);
                                                setShowDropdown(false);
                                            }}
                                            >
                                            <i className="fas fa-edit"></i> Edit Profile
                                        </div>

                                        <div
                                            className="dropdown-item"
                                            onClick={() => {
                                                setShowAboutModal(true);
                                                setShowDropdown(false);
                                            }}
                                            >
                                            <i className="fas fa-info-circle"></i> About
                                        </div>

                                        {isMobile() && (
                                            <div
                                                className="dropdown-item"
                                                onClick={() => {
                                                    setShowConsoleModal(true);
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <i className="fas fa-terminal"></i> Console
                                            </div>
                                        )}


                                        {(isOwner || isModerator) && (
                                        <>
                                            <hr className="my-1 border-gray-600" />

                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('ban')}
                                            >
                                            <i className="fas fa-ban"></i> Ban User
                                            </div>

                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('unban')}
                                            >
                                            <i className="fas fa-check"></i> Unban User
                                            </div>
                                        </>
                                        )}

                                        {isOwner && (
                                        <>
                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('addModerator')}
                                            >
                                            <i className="fas fa-shield-alt"></i> Add Moderator
                                            </div>

                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('removeModerator')}
                                            >
                                            <i className="fas fa-shield-alt"></i> Remove Moderator
                                            </div>
                                        </>
                                        )}


                                        <hr className="my-1 border-gray-600" />

                                            <div
                                            className="dropdown-item text-red-400 hover:text-red-500"
                                            onClick={() => {
                                                disconnectWallet(); // Changed to use local disconnectWallet
                                                setShowDropdown(false);
                                            }}
                                        >
                                            <i className="fas fa-sign-out-alt"></i> Disconnect
                                            </div>

                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowAboutModal(true)}
                                className="btn btn-secondary btn-sm sobrebtn"
                            >
                                <i className="fas fa-info-circle"></i> About
                            </button>

                            <appkit-button />

                        </>
                    )}
                </div>
            </header>
            <div className="chat-container" ref={messagesContainerRef} onScroll={handleScroll}>
                {isInitialLoad ? (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="text-center">
                            <div 
                                className="loading-spinner" 
                                style={{ 
                                    width: '48px', 
                                    height: '48px', 
                                    margin: '0 auto 20px', 
                                    borderTopColor: '#8B5CF6' 
                                }}
                            ></div>
                            <p className="text-lg text-gray-300 animate-pulse">
                                Loading messages...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="messages" >
                        {hasMoreMessages && (
                            <div className="text-center my-4">
                                <button onClick={loadMoreMessages} className="btn btn-secondary" disabled={isLoadingMore}>
                                    {isLoadingMore ? (
                                        <>
                                            <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                                            <span>Loading...</span>
                                        </>
                                    ) : (
                                        <span><i className="fas fa-arrow-up mr-2"></i>Load more</span>
                                    )}
                                </button>
                            </div>
                        )}
                        {messageGroups.map((group) => {

                            const presenceInfo = onlineUsers.find(u => u.userId?.toLowerCase() === group.remetente.toLowerCase());
                            const isOnline = !!presenceInfo;
                            const isTyping = presenceInfo?.isTyping || false;
                        
                            if (group.isSystem) {
                                const systemMessage = group.messages[0];
                                return (
                                    <div key={systemMessage.id} id={`message-${systemMessage.id}`} className="message system">
                                        <div className="message-bubble system">
                                            <div dangerouslySetInnerHTML={{ __html: linkifyText(systemMessage.conteudo) }} />
                                            <div className="flex items-center gap-2 mt-2 text-xs justify-center">
                                                <span 
                                                    className="text-gray-400" 
                                                    title={`${new Date(systemMessage.timestamp * 1000).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit'
                                                    })} ${new Date(systemMessage.timestamp * 1000).toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}`}
                                                    >
                                                    {new Date(systemMessage.timestamp * 1000).toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}
                                                    </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={group.key} id={`message-group-${group.key}`} className={`message-container ${group.isOwn ? 'own' : 'other'} mt-3`}>
                                    {!group.isOwn && (
                                        <div className="profile-pic-container relative">
                                            {isTyping && <TypingIndicator gifUrl="/images/typing.gif" />}

                                            <button 
                                                onClick={() => isConnected ? handleProfileClick(group.remetente) : null} 
                                                className={!isConnected ? 'cursor-default' : ''}
                                            >
                                                {group.senderProfile?.profilePicHash ? (
                                                    <img src={getIPFSUrl(group.senderProfile.profilePicHash)} alt="Profile" className="profile-pic" />
                                                ) : (
                                                    <img src="/images/nopfp.png" alt="No photo" className="profile-pic" />
                                                )}
                                            </button>
                                                {isOnline && <div className="online-status-dot"></div>}
                                            
                                        </div>
                                    )}

                                    <div className={`message ${group.isOwn ? 'own' : 'other'}`}>
                                        

                                        <div className={`message-bubble ${group.isOwn ? 'own' : 'other'}`}>
                                            {group.messages.map((message, msgIndex) => {
                                                // const replyMessage = message.respondeA > 0 ? messages.find(m => m.id === message.respondeA) : null; // Original line - can be slow.
                                                // Improved reply message lookup:
                                                const replyMessage = message.respondeA > 0 ? filteredMessages.find(m => m.id === message.respondeA) : null;

                                                return (
                                                    <div
                                                        key={message.id}
                                                        id={`message-${message.id}`}
                                                        className={msgIndex > 0 ? 'mt-2 pt-2 border-t border-gray-700/50' : ''}
                                                    >
                                                        {message.respondeA > 0 && (() => {
                                                            const replyMessage = filteredMessages.find(m => m.id === message.respondeA); // Use filteredMessages
                                                            if (replyMessage && !replyMessage.excluida) {
                                                                return (
                                                                    <div className="reply-preview" onClick={() => handleScrollToReply(message.respondeA)} title="Click to view the original message">
                                                                        <i className="fas fa-reply mr-1"></i>
                                                                        Replying to {replyMessage.usuario}: {(replyMessage.imageHash ? 'IMG: ' : '') + (replyMessage.conteudo ? `${replyMessage.conteudo.substring(0, 50)}...` : '')}
                                                                    </div>
                                                                );
                                                            } else if (replyMessage && replyMessage.excluida) {
                                                                return (
                                                                    <div className="reply-preview-deleted">
                                                                        <i className="fas fa-ban mr-2 text-gray-500"></i>
                                                                        Replying to a message that was deleted.
                                                                    </div>
                                                                );
                                                            } else {
                                                                return (
                                                                    <div className="reply-preview-deleted" title="the message is old, go to the top and click on 'load more'">
                                                                        <i className="fas fa-question-circle mr-2 text-gray-500"></i>
                                                                        Replying to a message that is not loaded.
                                                                    </div>
                                                                );
                                                            }
                                                        })()}

                                                        {message.conteudo && (
                                                            <div dangerouslySetInnerHTML={{ __html: linkifyText(message.conteudo) }} />
                                                        )}

                                                        {message.imageHash && (
                                                            <img
                                                                src={message.imageHash.startsWith('http') ? message.imageHash : getIPFSUrl(message.imageHash)}
                                                                alt="Attachment"
                                                                className="image-preview mt-2 cursor-pointer"
                                                                onClick={() => openLightbox(message.id)}
                                                            />
                                                        )}

                                                        <div className="msg-btnact flex items-center gap-2 mt-2 text-xs">
                                                            <span 
                                                                className="text-gray-400" 
                                                                title={`${new Date(message.timestamp * 1000).toLocaleDateString('en-US', {
                                                                    year: 'numeric',
                                                                    month: '2-digit',
                                                                    day: '2-digit'
                                                                })} ${new Date(message.timestamp * 1000).toLocaleTimeString('en-US', {
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                    hour12: true
                                                                })}`}
                                                                >
                                                                {new Date(message.timestamp * 1000).toLocaleTimeString('en-US', {
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                    hour12: true
                                                                })}
                                                                </span>

                                                            {isConnected && (
                                                                <>
                                                                    <button onClick={() => handleReply(message)} className="text-gray-400 hover:text-white">
                                                                        <i className="fas fa-reply" title="Reply"></i>
                                                                    </button>
                                                                    {group.isOwn && (
                                                                        <button onClick={() => handleEdit(message)} className="text-gray-400 hover:text-white">
                                                                            <i className="fas fa-edit" title="Edit"></i>
                                                                        </button>
                                                                    )}
                                                                    {(group.isOwn || isOwner || isModerator) && (
                                                                        <button onClick={() => deleteMessage(message.id)} className="text-gray-400 hover:text-red-400">
                                                                            <i className="fas fa-trash" title={group.isOwn ? 'Delete' : 'Delete via moderator'}></i>
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {!group.isOwn && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <span onClick={() => isConnected ? handleProfileClick(group.remetente) : null} className="username text-sm font-medium">
                                                    {group.usuario}
                                                </span>
                                                {group.senderProfile?.role === 2 && <span title="0xGus" className="role-tag dev">Dev</span>}
                                                {group.senderProfile?.role === 1 && <span title="MonChat moderator" className="role-tag mod">Mod</span>}
                                            </div>
                                        )}
                                    </div>

                                    {group.isOwn && (
                                        <div className="profile-pic-container">
                                            <button onClick={() => handleProfileClick(address)} className="cursor-pointer">
                                                {userProfile?.profilePicHash ? (
                                                    <img src={getIPFSUrl(userProfile.profilePicHash)} alt="Profile" className="profile-pic" />
                                                ) : (
                                                    <img src="/images/nopfp.png" alt="No photo" className="profile-pic" />
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <footer className="footer-fixed p-4">
                {isWrongNetwork && isConnected ? (
                    <div className="text-center p-4 bg-red-900/50 border-t-2 border-red-500 rounded-t-lg animate-pulse">
                        <h3 className="font-bold text-lg text-red-300">
                            <i className="fas fa-exclamation-triangle mr-2"></i>INCORRECT NETWORK
                        </h3>
                        <p className="text-red-200 mt-1">
                            Please switch to <strong>MONAD TESTNET</strong> to continue. DO NOT ATTEMPT INTERACTIONS UNTIL THE NETWORK IS CHANGED.
                        </p>
                    </div>
                ) : isConnected ? (
                    <>
                        {replyingTo && (
                            <div className="reply-indicator">
                                <i className="fas fa-reply mr-2"></i>
                                Replying to {replyingTo.usuario}: {replyingTo.conteudo.substring(0, 50)}...
                                <button onClick={() => setReplyingTo(null)} className="ml-2 text-red-400 hover:text-red-300">
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        )}

                        {editingMessage && (
                            <div className="reply-indicator">
                                <i className="fas fa-edit mr-2"></i>
                                Editing message
                                <button
                                    onClick={() => {
                                        setEditingMessage(null);
                                        setNewMessage('');
                                    }}
                                    className="ml-2 text-red-400 hover:text-red-300"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        )}

                        <div className="dashboard flex items-end gap-2 mb-2">
                            {selectedImage && (
                                <div className="relative">
                                    <img
                                        src={URL.createObjectURL(selectedImage)}
                                        alt="Preview"
                                        className="max-h-24 rounded-md border border-gray-600"
                                    />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs focus:outline-none hover:bg-red-700"
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}

                            {selectedGifUrl && (
                                <div className="relative">
                                    <img
                                        src={selectedGifUrl}
                                        alt="Gif preview"
                                        className="max-h-24 rounded-md border border-gray-600"
                                    />
                                    <button
                                        onClick={() => setSelectedGifUrl(null)}
                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs focus:outline-none hover:bg-red-700"
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                        </div>

                        {uploading && (
                            <div className="upload-progress">
                                <p className="text-sm mb-2">Uploading image...</p>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            </div>
                        )}

                        {userProfile?.exists ? (
                            <div className="dashboard flex items-center gap-2">
                                <div className="dbbtn flex items-center gap-2">
                                    <div className="emoji-picker-container relative" ref={emojiPickerRef}>
                                        <button
                                            ref={emojiButtonRef}
                                            className="btn btn-icon btn-secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.nativeEvent.stopImmediatePropagation?.();
                                                setShowEmojiPicker(!showEmojiPicker);
                                                }}
                                        >
                                            <i className="fas fa-smile"></i>
                                        </button>

                                        {showEmojiPicker && (
                                            <div className="emoji-picker overflow-y-auto pr-2 styled-scrollbar">
                                                <div className="emoji-grid">
                                                    {EMOJIS.map((emoji, index) => (
                                                        <div
                                                            key={index}
                                                            className="emoji-item"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.nativeEvent.stopImmediatePropagation?.();
                                                                handleEmojiSelect(emoji);
                                                            }}
                                                        >
                                                            {emoji}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="gif-picker-container relative">
                                        <button
                                            onClick={() => setShowGifPicker(!showGifPicker)}
                                            className="btn btn-icon btn-secondary"
                                        >
                                            GIF
                                        </button>
                                        <GifPicker
                                            isOpen={showGifPicker}
                                            onClose={() => setShowGifPicker(false)}
                                            onSelectGif={handleSelectGif}
                                        />
                                    </div>

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="btn btn-icon btn-secondary"
                                    >
                                        <i className="fas fa-image"></i>
                                    </button>
                                </div>

                                <div className="flex-1">
                                    <textarea
                                        id="mensagem"
                                        name="mensagem"
                                        ref={textareaRef}
                                        value={newMessage}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            if (newValue !== newMessage) {
                                                setNewMessage(newValue);
                                                handleTyping();
                                            }
                                        }}

                                        onKeyDown={handleKeyPress}
                                        placeholder={editingMessage ? "Edit message..." : "Type your message..."}
                                        className="input-field resize-none"
                                        rows="2"
                                        maxLength={280}
                                        disabled={uploading}
                                    />
                                </div>

                                <button
                                    onClick={
                                        editingMessage
                                            ? () => editMessage(editingMessage.id, newMessage)
                                            : sendMessage
                                    }
                                    className="btn btn-primary"
                                    disabled={
                                        (!newMessage.trim() && !selectedImage && !selectedGifUrl) || uploading
                                    }
                                >
                                    {uploading ? (
                                        <div className="loading-spinner"></div>
                                    ) : editingMessage ? (
                                        <i className="fas fa-save"></i>
                                    ) : (
                                        <i className="fas fa-paper-plane"></i>
                                    )}
                                </button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="file-input hidden"
                                />
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-gray-300 mb-4">
                                    <i className="fas fa-user-plus mr-2"></i>
                                    You need to create a profile to send messages
                                </p>
                                <button onClick={() => setShowEditProfileModal(true)} className="btn btn-primary">
                                    <i className="fas fa-user-plus"></i> Create Profile
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center">
                        <p className="text-gray-300 mb-4">
                            <i className="fas fa-eye mr-2"></i>
                            You are in read-only mode.
                        </p>
                        <appkit-button class="inline-block" />
                        
                    </div>
                )}
            </footer>

                <button 
                    onClick={scrollToBottom} 
                    className={`scroll-to-bottom fixed right-10 bottom-36 z-49 ${showScrollButton ? 'visible' : ''} ${unseenMessages > 0 ? 'new-message animate-pulse' : ''}`}
                >
                    <i className="fas fa-arrow-down"></i>
                    {unseenMessages > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                            {unseenMessages}
                        </span>
                    )}
                </button>

            {popup && <Popup {...popup} />}

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                userAddress={selectedUserAddress}
                userProfile={selectedUserProfile}
                isOnline={
                    selectedUserAddress &&
                    onlineUsers.find(u => u.userId?.toLowerCase() === selectedUserAddress.toLowerCase())?.isOnline
                }
                onSendMON={(address) => {
                    setShowProfileModal(false);
                    setShowSendMONModal(true);
                }}
                onEditProfile={() => {
                    setShowProfileModal(false);
                    setShowEditProfileModal(true);
                }}
                isConnected={isConnected}
                isOwnProfile={
                    selectedUserAddress && address
                        ? selectedUserAddress.toLowerCase() === address.toLowerCase()
                        : false
                }
                isOwner={isOwner}
                isModerator={isModerator}
                onBanUser={banUser}
                onUnbanUser={unbanUser}
                onAddModerator={addModerator}
                onChallenge={handleChallenge}
            />

            <EditProfileModal
                isOpen={showEditProfileModal}
                onClose={() => setShowEditProfileModal(false)}
                currentProfile={userProfile}
                onSave={userProfile?.exists ? updateProfile : registerUser}
            />

            <SendMONModal
                isOpen={showSendMONModal}
                onClose={() => setShowSendMONModal(false)}
                recipientAddress={selectedUserAddress}
                recipientUsername={selectedUserProfile?.username}
                onSend={sendMON}
                userBalance={parseFloat(balance).toFixed(2)}
            />

            <AboutModal
                isOpen={showAboutModal}
                onClose={() => setShowAboutModal(false)}
                onConfirm={isForcedAboutModal ? handleAgreeAndProceedToProfile : null}
                forceConfirm={isForcedAboutModal}
            />

            <LinkConfirmationModal
                isOpen={showLinkConfirmationModal}
                onClose={() => setShowLinkConfirmationModal(false)}
                url={linkToConfirm}
                onConfirm={() => {
                    window.open(linkToConfirm, '_blank', 'noopener,noreferrer');
                    setShowLinkConfirmationModal(false);
                }}
            />

            <ModerationModal
                isOpen={showModerationModal}
                onClose={() => setShowModerationModal(false)}
                action={moderationAction}
                onConfirm={handleModerationAction}
            />
             <ConsoleModal
                isOpen={showConsoleModal}
                onClose={() => setShowConsoleModal(false)}
                logs={consoleLogs}
            />

            <GameSelectionModal
                isOpen={showGameSelectionModal}
                onClose={() => setShowGameSelectionModal(false)}
                opponentUsername={selectedOpponentForChallenge?.username}
                onChallenge={onChallengeConfirmed}
            />

            {activeGame && (
                <GameModal
                    isOpen={!!activeGame}
                    onClose={onGameModalClose}
                    gameType={activeGame}
                    opponentAddress={gamePlayers.find(p => p.address !== address)?.address}
                    opponentUsername={gamePlayers.find(p => p.address !== address)?.username}
                    currentUserAddress={address}
                    currentUsername={userProfile?.username}
                    gameSessionId={gameSessionId}
                />
            )}
        </div>
    );
}
