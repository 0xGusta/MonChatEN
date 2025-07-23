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
import GameSelectionModal from './components/GameSelectionModal';
import GameModal from './components/GameModal';
import { useAccount, useDisconnect, useBalance, useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';
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
    const [availableWallets, setAvailableWallets] = useState([]);
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedGifUrl, setSelectedGifUrl] = useState(null);
    const [isWrongNetwork, setIsWrongNetwork] = useState(false);
    const [rawProvider, setRawProvider] = useState(null);
    const [challenges, setChallenges] = useStateTogether('challenges', {});
    const [activeGame, setActiveGame] = useState(null);
    const [showGameSelectionModal, setShowGameSelectionModal] = useState(false);
    const [showGameModal, setShowGameModal] = useState(false);
    const [gameOpponent, setGameOpponent] = useState(null);
    const [gameType, setGameType] = useState(null);
    const [gameSessionId, setGameSessionId] = useState(null);
    const gameChallengeTimeoutRef = useRef(null);
    const gameNotificationTimeoutRef = useRef(null);

    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
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
                        return 'Objeto não serializável';
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
                console.log("Configurando o aplicativo com carteira conectada:", address);
                const isOnCorrectNetwork = chain?.id === MONAD_TESTNET.chainId;
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
                console.log("Configurando o aplicativo em modo somente leitura.");
                setIsWrongNetwork(false);
                setUserProfile(null);
                
                const rpcUrls = MONAD_TESTNET.rpcUrls.default.http;
                let connectedContract = null;

                for (const url of rpcUrls) {
                    try {
                        console.log(`Tentando conectar ao RPC: ${url}`);
                        const publicProvider = new ethers.JsonRpcProvider(url);
                        const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
                        await readOnlyContract.contadorMensagens();
                        console.log(`Conectado com sucesso ao RPC: ${url}`);
                        connectedContract = readOnlyContract;
                        break; 
                    } catch (e) {
                        console.warn(`Falha ao conectar ao RPC ${url}. Tentando o próximo...`);
                    }
                }

                if (connectedContract) {
                    setContract(connectedContract);
                    if (messages.length === 0) {
                       await loadMessages(connectedContract);
                    }
                } else {
                    console.error("Não foi possível conectar a nenhum RPC da Monad Testnet.");
                    showPopup('Não foi possível conectar à rede Monad. O serviço pode estar temporariamente indisponível.', 'error');
                }
            }
        };
    
        setupApp();

    }, [isConnected, address, walletClient, chain]);

    useEffect(() => {
        if (!isConnected || isAppLoading) {
            console.log("[Polling] Parando o polling: carteira não conectada ou aplicativo carregando.");
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
                console.error("[Configuração do Polling] A lista de URLs RPC está vazia. O polling não pode funcionar.");
                return;
            }
            for (const url of publicRpcUrls) {
                try {
                    console.log(`[Configuração do Polling] Tentando RPC público para polling: ${url}`);
                    const publicProvider = new ethers.JsonRpcProvider(url);
                    readOnlyPollingContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);
                    console.log(`[Configuração do Polling] RPC público ${url} selecionado para polling.`);
                    return;
                } catch (e) {
                    console.warn(`[Configuração do Polling] Falha ao conectar ao RPC público ${url}.`);
                }
            }
            console.error("[Configuração do Polling] Não foi possível conectar a nenhum RPC público para polling. O polling pode não funcionar.");
        };
    
        setupPollingProvider();
    
        const startPolling = () => {
            if (!readOnlyPollingContract) {
                console.error("[Polling] Nenhum contrato somente leitura disponível. O polling não pode ser iniciado.");
                return;
            }
            console.log("[Polling] Iniciando o polling de mensagens com um provedor somente leitura dedicado.");
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    console.log("[Polling] Verificando novas mensagens usando o provedor público...");
                    const blockNumber = await readOnlyPollingContract.runner.provider.getBlockNumber();
                    console.log(`[Polling] Bloco atual (via RPC público): ${blockNumber}`);
                    const totalMessagesBigInt = await readOnlyPollingContract.contadorMensagens();
                    const total = Number(totalMessagesBigInt);
                    const previous = lastMessageCountRef.current;
                    console.log(`[Polling] Total atual no contrato (via RPC público): ${total}`);
                    console.log(`[Polling] Total local anterior: ${previous}`);
    
                    if (total > previous) {
                        const newMessagesCount = total - previous;
                        console.log(`[Polling] Novas mensagens detectadas: ${newMessagesCount}`);
                        
                        await loadLatestMessages(total); 
    
                        const container = messagesContainerRef.current;
                        const isAtBottom = container
                            ? (container.scrollHeight - container.scrollTop - container.clientHeight) < container.clientHeight
                            : true;
                        if (isAtBottom) {
                            console.log("[Polling] O usuário está no final - rolagem automática.");
                            setTimeout(() => scrollToBottom(), 300);
                        } else {
                            console.log("[Polling] O usuário não está no final - incrementando mensagens não vistas.");
                            setUnseenMessages(prev => prev + newMessagesCount);
                        }
                        console.log(`[Polling] ATUALIZANDO a contagem local de ${previous} para ${total}.`);
                        lastMessageCountRef.current = total;
                    } else {
                        console.log("[Polling] Nenhuma nova mensagem.");
                    }
                } catch (error) {
                    console.error("[Polling] Erro ao buscar mensagens com o provedor público:", error);
                    console.log("[Polling] Tentando reconfigurar o provedor de polling...");
                    setupPollingProvider();
                }
            }, 5000);
        };
    
        startPolling();
    
        return () => {
            if (pollingIntervalRef.current) {
                console.log("[Polling] Limpando o intervalo de polling.");
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

        showPopup('Carregando galeria...', 'info', true);

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
                showPopup('Imagem colada da área de transferência!', 'success');
                break;
            }
        }
    }, [setSelectedImage, setSelectedGifUrl, showPopup]);

    useEffect(() => {
        const myChallenges = Object.entries(challenges).filter(([, challenge]) =>
            challenge.opponentAddress?.toLowerCase() === address?.toLowerCase() && challenge.status === 'pending'
        );

        myChallenges.forEach(([challengeId, challenge]) => {
            if (!gameChallengeTimeoutRef.current) {
                showPopup(
                    `Você foi desafiado por ${challenge.challengerUsername} para ${challenge.gameType}! Aceitando em 10s...`,
                    'info',
                    false,
                    <div className="flex justify-around mt-2">
                        <button onClick={() => handleAcceptChallenge(challengeId)} className="btn btn-primary mr-2">Aceitar</button>
                        <button onClick={() => handleDeclineChallenge(challengeId)} className="btn btn-secondary">Recusar</button>
                    </div>
                );
                if (gameChallengeTimeoutRef.current) {
                    clearTimeout(gameChallengeTimeoutRef.current);
                }
                gameChallengeTimeoutRef.current = setTimeout(() => {
                    handleDeclineChallenge(challengeId, true);
                }, 10000);
            }
        });

        const mySentChallenges = Object.entries(challenges).filter(([, challenge]) =>
            challenge.challengerAddress?.toLowerCase() === address?.toLowerCase() &&
            (challenge.status === 'accepted' || challenge.status === 'declined' || challenge.status === 'expired') &&
            !challenge.notified
        );

        mySentChallenges.forEach(([challengeId, challenge]) => {
            if (challenge.status === 'accepted') {
                showPopup(`${challenge.opponentUsername} aceitou seu desafio de ${challenge.gameType}!`, 'success');
                setGameOpponent({ address: challenge.opponentAddress, username: challenge.opponentUsername });
                setGameType(challenge.gameType);
                setGameSessionId(challengeId);
                setShowGameModal(true);
                setChallenges(prev => ({ ...prev, [challengeId]: { ...prev[challengeId], notified: true } }));
                
            } else if (challenge.status === 'declined') {
                showPopup(`${challenge.opponentUsername} recusou seu desafio de ${challenge.gameType}.`, 'warning');
                setChallenges(prev => ({ ...prev, [challengeId]: { ...prev[challengeId], notified: true } }));
            } else if (challenge.status === 'expired') {
                showPopup(`${challenge.opponentUsername} não respondeu ao seu desafio de ${challenge.gameType}.`, 'warning');
                setChallenges(prev => ({ ...prev, [challengeId]: { ...prev[challengeId], notified: true } }));
            }
            if (gameNotificationTimeoutRef.current) {
                clearTimeout(gameNotificationTimeoutRef.current);
            }
            gameNotificationTimeoutRef.current = setTimeout(() => {
                setChallenges(prev => {
                    const newChallenges = { ...prev };
                    delete newChallenges[challengeId];
                    return newChallenges;
                });
            }, 5000);
        });

        const activeGameChallenge = Object.entries(challenges).find(([, challenge]) =>
            (challenge.challengerAddress?.toLowerCase() === address?.toLowerCase() ||
             challenge.opponentAddress?.toLowerCase() === address?.toLowerCase()) &&
            challenge.status === 'accepted' &&
            !activeGame
        );

        if (activeGameChallenge) {
            const [challengeId, challengeData] = activeGameChallenge;
            if (challengeData.challengerAddress?.toLowerCase() === address?.toLowerCase()) {
                setGameOpponent({ address: challengeData.opponentAddress, username: challengeData.opponentUsername });
            } else {
                setGameOpponent({ address: challengeData.challengerAddress, username: challengeData.challengerUsername });
            }
            setGameType(challengeData.gameType);
            setGameSessionId(challengeId);
            setShowGameModal(true);
            setActiveGame(true);
            setChallenges(prev => ({ ...prev, [challengeId]: { ...prev[challengeId], status: 'started' } }));
        }


    }, [challenges, address, setChallenges, activeGame]);


    const handleChallenge = (opponentAddress, opponentUsername) => {
        setSelectedUserAddress(opponentAddress);
        setSelectedUserProfile({ username: opponentUsername });
        setShowProfileModal(false);
        setShowGameSelectionModal(true);
    };

    const initiateGameChallenge = (gameType) => {
        const challengeId = `${Date.now()}-${address.substring(2, 6)}-${selectedUserAddress.substring(2, 6)}`;
        setChallenges(prev => ({
            ...prev,
            [challengeId]: {
                challengerAddress: address,
                challengerUsername: userProfile.username,
                opponentAddress: selectedUserAddress,
                opponentUsername: selectedUserProfile.username,
                gameType: gameType,
                status: 'pending',
                timestamp: Date.now(),
                notified: false
            }
        }));
        showPopup(`Desafio enviado para ${selectedUserProfile.username} para ${gameType}! Aguardando resposta...`, 'info', true);
        setShowGameSelectionModal(false);
        setTimeout(() => {
            setChallenges(prev => {
                const currentChallenge = prev[challengeId];
                if (currentChallenge && currentChallenge.status === 'pending') {
                    showPopup(`Desafio para ${currentChallenge.opponentUsername} para ${currentChallenge.gameType} expirou.`, 'warning');
                    return { ...prev, [challengeId]: { ...currentChallenge, status: 'expired' } };
                }
                return prev;
            });
        }, 10000);
    };

    const handleAcceptChallenge = (challengeId) => {
        if (gameChallengeTimeoutRef.current) {
            clearTimeout(gameChallengeTimeoutRef.current);
            gameChallengeTimeoutRef.current = null;
        }
        setChallenges(prev => ({ ...prev, [challengeId]: { ...prev[challengeId], status: 'accepted' } }));
        showPopup('Desafio aceito! Iniciando o jogo...', 'success');
    };

    const handleDeclineChallenge = (challengeId, expired = false) => {
        if (gameChallengeTimeoutRef.current) {
            clearTimeout(gameChallengeTimeoutRef.current);
            gameChallengeTimeoutRef.current = null;
        }
        setChallenges(prev => ({ ...prev, [challengeId]: { ...prev[challengeId], status: expired ? 'expired' : 'declined' } }));
        showPopup(expired ? 'Desafio expirado.' : 'Desafio recusado.', 'warning');
    };

    const handleEndGame = () => {
        setShowGameModal(false);
        setActiveGame(null);
        setGameOpponent(null);
        setGameType(null);
        setGameSessionId(null);
        setChallenges(prev => {
            const newChallenges = { ...prev };
            const currentSessionId = Object.keys(newChallenges).find(id => newChallenges[id].challengerAddress?.toLowerCase() === address?.toLowerCase() || newChallenges[id].opponentAddress?.toLowerCase() === address?.toLowerCase());
            if (currentSessionId) {
                delete newChallenges[currentSessionId];
            }
            return newChallenges;
        });
    };

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

    useEffect(() => {
        
        if (availableWallets.length > 0 && !isConnected && !hasAttemptedAutoConnect.current) {
            const lastRdns = localStorage.getItem('lastConnectedWalletRdns');
            if (lastRdns) {
                
                const walletToReconnect = availableWallets.find(w => w.info.rdns === lastRdns);

                if (walletToReconnect) {
                    console.log(`Tentando reconexão automática com ${walletToReconnect.info.name}...`);
                    hasAttemptedAutoConnect.current = true;
                }
            }
        }
    }, [availableWallets, isConnected]); 

    
    const initiateConnection = async (walletProvider, walletName) => {
        showPopup(`Conectando com ${walletName}...`, 'info', true);
        try {
            
            const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });
            if (accounts.length === 0) {
                hidePopup();
                showPopup('Nenhuma conta selecionada', 'error');
                return;
            }

            
            try {
                await walletProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${MONAD_TESTNET.chainId.toString(16)}` }] });
            } catch (switchError) {
                
                if (switchError.code === 4902) {
                    await walletProvider.request({ method: 'wallet_addEthereumChain', params: [{ 
                        chainId: `0x${MONAD_TESTNET.chainId.toString(16)}`,
                        chainName: MONAD_TESTNET.chainName,
                        rpcUrls: MONAD_TESTNET.rpcUrls.default.http,
                        nativeCurrency: MONAD_TESTNET.nativeCurrency,
                        blockExplorerUrls: MONAD_TESTNET.blockExplorerUrls
                    }] });
                } else {
                    
                    hidePopup();
                    showPopup('Por favor, mude para a rede Monad Testnet em sua carteira.', 'warning');
                    return;
                }
            }

            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
            const userAddress = accounts[0];

            setIsWrongNetwork(false); 
            setProvider(provider);
            setRawProvider(walletProvider);
            setSigner(signer);
            setContract(contract);
    
            const [profileData, balanceData, ownerAddress, isModeratorResult] = await Promise.all([
                contract.obterPerfilUsuario(userAddress),
                provider.getBalance(userAddress),
                contract.dono(),
                contract.moderadores(userAddress)
            ]);

            const profileExists = profileData.exists;

            if (!profileExists) {
                hidePopup();
                setUserProfile({ exists: false, username: '', profilePicHash: '', role: 0 });
                setIsOwner(false);
                setIsModerator(false);
                setBalance('0'); 
                setIsForcedAboutModal(true);
                setShowAboutModal(true);
            } else {
                const isOwnerResult = ownerAddress.toLowerCase() === userAddress.toLowerCase();
                const finalIsModerator = isOwnerResult || isModeratorResult; 
                const userRole = await contract.obterRoleUsuario(userAddress);
                const profile = { username: profileData.username, profilePicHash: profileData.profilePicHash, exists: true, role: Number(userRole) };
                setUserProfile(profile);
                userProfilesCache.set(userAddress.toLowerCase(), profile);
                setIsOwner(isOwnerResult);
                setIsModerator(finalIsModerator);
                setBalance(ethers.formatEther(balanceData));
                hidePopup();
                showPopup('Carteira conectada!', 'success');
            }

            if (messages.length === 0) {
                await loadMessages(contract);
            }

        } catch (error) {
            console.error(`Erro ao conectar com a Carteira:`, error);
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(`Erro: ${friendlyMessage}`, 'error');
            disconnect();
        }
    };

    const disconnectWallet = () => {
        hidePopup();
        localStorage.removeItem('lastConnectedWalletRdns');
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
                console.error("Erro ao recarregar mensagens após desconectar:", error);
            } finally {
                setIsInitialLoad(false);
            }
        }, 50); 
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
            showPopup("A mensagem respondida não está carregada no chat.", 'info');
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
                    exists: profileData.exists,
                    role: Number(userRole)
                };
                userProfilesCache.set(userAddress.toLowerCase(), profile);
                setUserProfile(profile);
            } else {
                setUserProfile({ exists: false, username: '', profilePicHash: '', role: 0 });
            }
        } catch (error) {
            console.error("Erro ao carregar perfil do usuário:", error);
            showPopup('Não foi possível atualizar o perfil do usuário.', 'error');
        }
    };
    
    const sendMessage = async () => {
        
        if (!newMessage.trim() && !selectedImage && !selectedGifUrl) return;

        showPopup('Enviando mensagem...', 'info', true);

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
            showPopup('Mensagem enviada!', 'success');
            
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
            showPopup('Editando mensagem...', 'info', true);
            const tx = await contract.editarMensagem(messageId, newContent);
            await tx.wait();
            hidePopup();
            showPopup('Mensagem editada!', 'success');
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
            showPopup('Excluindo mensagem...', 'info', true);
            const tx = await contract.excluirMensagem(messageId);
            await tx.wait();
            hidePopup();
            showPopup('Mensagem excluída!', 'success');
            
        } catch (error) {
            hidePopup();
            const friendlyMessage = getFriendlyErrorMessage(error);
            showPopup(friendlyMessage, 'error');
        }
    };

    const registerUser = async (username, profilePicHash = '') => { 
        try { 
            showPopup('Registrando usuário...', 'info', true); 
            const tx = await contract.registrarUsuario(username, profilePicHash); 
            await tx.wait(); 
            hidePopup(); 
            showPopup('Usuário registrado com sucesso!', 'success'); 
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
            showPopup('Atualizando perfil...', 'info', true);
            const tx = await contract.atualizarPerfil(username, profilePicHash);
            await tx.wait();
            hidePopup();
            showPopup('Perfil atualizado!', 'success');
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
                showPopup('Carteira não conectada', 'error');
                return;
            }

            showPopup('Enviando MON...', 'info', true);

            const currentSigner = await walletClientToSigner(walletClient);

            const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, ABI, currentSigner);

            const tx = await contractWithSigner.enviarMon(recipientAddress, amount, { value: amount });
            await tx.wait();

            hidePopup();
            showPopup('MON enviado com sucesso!', 'success');

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
                showPopup('Usuário não encontrado', 'error');
                return;
            }
            showPopup('Banindo usuário...', 'info', true);
            const tx = await contract.banirUsuario(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('Usuário banido!', 'success');
            
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
                showPopup('Usuário não encontrado', 'error');
                return;
            }
            showPopup('Desbanindo usuário...', 'info', true);
            const tx = await contract.desbanirUsuario(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('Usuário desbanido!', 'success');
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
                showPopup('Usuário não encontrado', 'error');
                return;
            }
            showPopup('Adicionando moderador...', 'info', true);
            const tx = await contract.adicionarModerador(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('Moderador adicionado!', 'success');
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
                showPopup('Usuário não encontrado', 'error');
                return;
            }
            showPopup('Removendo moderador...', 'info', true);
            const tx = await contract.removerModerador(userAddress);
            await tx.wait();
            hidePopup();
            showPopup('Moderador removido!', 'success');
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
            console.error('Erro ao carregar perfil:', error);
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
                showPopup('Arquivo muito grande. Máximo 10MB.', 'error');
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
                const publicProvider = new ethers.JsonRpcProvider(MONAD_TESTNET.rpcUrls.default.http[0]);
                const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);

                await loadMessages(readOnlyContract);
            } catch (error) {
                console.error("Erro ao inicializar:", error);
                if (error.code === -32007 || (error.error && error.error.code === -32007)) {
                    showPopup('A rede está congestionada. Por favor, recarregue a página em alguns instantes.', 'error', true);
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

    if (!isConnected || !provider || !rawProvider) {
        return;
    }

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            showPopup("Carteira desconectada.", "warning");
            disconnectWallet();
        } else {

            initiateConnection(rawProvider, 'Carteira');
        }
    };

    rawProvider.on('accountsChanged', handleAccountsChanged);

    const checkNetwork = async () => {
        try {
            const network = await provider.getNetwork();
            const onCorrectNetwork = network.chainId === BigInt(MONAD_TESTNET.chainId);
            
            setIsWrongNetwork(!onCorrectNetwork);
        } catch (error) {
            console.error("Erro ao verificar a rede:", error);
            setIsWrongNetwork(true);
        }
    };

    checkNetwork(); 

    const networkInterval = setInterval(checkNetwork, 3000);

    return () => {
        clearInterval(networkInterval);

        if (rawProvider && rawProvider.removeListener) {
            rawProvider.removeListener('accountsChanged', handleAccountsChanged);
        }
    };

    }, [isConnected, provider, rawProvider]);

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
                        <img src="/images/logo.png" title="Obrigado por usar!" alt="Logo"></img>
                    </div>
                    <div className="hidden sm:block">
                        <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
                            <i className="fas fa-circle text-xs"></i>
                            {isConnected ? 'Conectado' : 'Somente Leitura'}
                        </div>
                        {isConnected && <OnlineCounter count={onlineCount} />}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isConnected ? (
                        <>
                            <div className="balance-display">
                                <div className="balance-amount" title="Seu saldo de MONs">
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
                                            <i className="fas fa-user"></i> Meu perfil
                                        </div>

                                        <div
                                            className="dropdown-item"
                                            onClick={() => {
                                                setShowEditProfileModal(true);
                                                setShowDropdown(false);
                                            }}
                                            >
                                            <i className="fas fa-edit"></i> Editar Perfil
                                        </div>

                                        <div
                                            className="dropdown-item"
                                            onClick={() => {
                                                setShowAboutModal(true);
                                                setShowDropdown(false);
                                            }}
                                            >
                                            <i className="fas fa-info-circle"></i> Sobre
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
                                            <i className="fas fa-ban"></i> Banir Usuário
                                            </div>

                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('unban')}
                                            >
                                            <i className="fas fa-check"></i> Desbanir Usuário
                                            </div>
                                        </>
                                        )}

                                        {isOwner && (
                                        <>
                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('addModerator')}
                                            >
                                            <i className="fas fa-shield-alt"></i> Adicionar Moderador
                                            </div>

                                            <div
                                            className="dropdown-item"
                                            onClick={() => openModerationModal('removeModerator')}
                                            >
                                            <i className="fas fa-shield-alt"></i> Remover Moderador
                                            </div>
                                        </>
                                        )}


                                        <hr className="my-1 border-gray-600" />

                                            <div
                                            className="dropdown-item text-red-400 hover:text-red-500"
                                            onClick={() => {
                                                disconnect();
                                                setShowDropdown(false);
                                            }}
                                        >
                                            <i className="fas fa-sign-out-alt"></i> Desconectar
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
                                <i className="fas fa-info-circle"></i> Sobre
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
                                Carregando mensagens...
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
                                            <span>Carregando...</span>
                                        </>
                                    ) : (
                                        <span><i className="fas fa-arrow-up mr-2"></i>Carregar mais</span>
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
                                                const replyMessage = message.respondeA > 0 ? messages.find(m => m.id === message.respondeA) : null;
                                                return (
                                                    <div
                                                        key={message.id}
                                                        id={`message-${message.id}`}
                                                        className={msgIndex > 0 ? 'mt-2 pt-2 border-t border-gray-700/50' : ''}
                                                    >
                                                        {message.respondeA > 0 && (() => {
                                                            const replyMessage = messages.find(m => m.id === message.respondeA);
                                                            if (replyMessage && !replyMessage.excluida) {
                                                                return (
                                                                    <div className="reply-preview" onClick={() => handleScrollToReply(message.respondeA)} title="Clique para ver a mensagem original">
                                                                        <i className="fas fa-reply mr-1"></i>
                                                                        Respondendo a {replyMessage.usuario}: {(replyMessage.imageHash ? 'IMG: ' : '') + (replyMessage.conteudo ? `${replyMessage.conteudo.substring(0, 50)}...` : '')}
                                                                    </div>
                                                                );
                                                            } else if (replyMessage && replyMessage.excluida) {
                                                                return (
                                                                    <div className="reply-preview-deleted">
                                                                        <i className="fas fa-ban mr-2 text-gray-500"></i>
                                                                        Respondendo a uma mensagem que foi excluída.
                                                                    </div>
                                                                );
                                                            } else {
                                                                return (
                                                                    <div className="reply-preview-deleted" title="a mensagem é antiga, vá para o topo e clique em 'carregar mais'">
                                                                        <i className="fas fa-question-circle mr-2 text-gray-500"></i>
                                                                        Respondendo a uma mensagem que não está carregada.
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
                                                                alt="Anexo"
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
                                                                        <i className="fas fa-reply" title="Responder"></i>
                                                                    </button>
                                                                    {group.isOwn && (
                                                                        <button onClick={() => handleEdit(message)} className="text-gray-400 hover:text-white">
                                                                            <i className="fas fa-edit" title="Editar"></i>
                                                                        </button>
                                                                    )}
                                                                    {(group.isOwn || isOwner || isModerator) && (
                                                                        <button onClick={() => deleteMessage(message.id)} className="text-gray-400 hover:text-red-400">
                                                                            <i className="fas fa-trash" title={group.isOwn ? 'Excluir' : 'Excluir via moderador'}></i>
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
                                                {group.senderProfile?.role === 1 && <span title="Moderador MonChat" className="role-tag mod">Mod</span>}
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
                            <i className="fas fa-exclamation-triangle mr-2"></i>REDE INCORRETA
                        </h3>
                        <p className="text-red-200 mt-1">
                            Por favor, mude para **MONAD TESTNET** para continuar. NÃO TENTE INTERAÇÕES ATÉ QUE A REDE SEJA ALTERADA.
                        </p>
                    </div>
                ) : isConnected ? (
                    <>
                        {replyingTo && (
                            <div className="reply-indicator">
                                <i className="fas fa-reply mr-2"></i>
                                Respondendo a {replyingTo.usuario}: {replyingTo.conteudo.substring(0, 50)}...
                                <button onClick={() => setReplyingTo(null)} className="ml-2 text-red-400 hover:text-red-300">
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        )}

                        {editingMessage && (
                            <div className="reply-indicator">
                                <i className="fas fa-edit mr-2"></i>
                                Editando mensagem
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
                                        alt="Pré-visualização"
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
                                        alt="Pré-visualização de GIF"
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
                                <p className="text-sm mb-2">Enviando imagem...</p>
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
                                        placeholder={editingMessage ? "Editar mensagem..." : "Digite sua mensagem..."}
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
                                    Você precisa criar um perfil para enviar mensagens
                                </p>
                                <button onClick={() => setShowEditProfileModal(true)} className="btn btn-primary">
                                    <i className="fas fa-user-plus"></i> Criar Perfil
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center">
                        <p className="text-gray-300 mb-4">
                            <i className="fas fa-eye mr-2"></i>
                            Você está em modo somente leitura.
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
                onChallenge={initiateGameChallenge}
                opponentUsername={selectedUserProfile?.username}
            />

            {showGameModal && activeGame && (
                <GameModal
                    isOpen={showGameModal}
                    onClose={handleEndGame}
                    gameType={gameType}
                    opponentAddress={gameOpponent.address}
                    opponentUsername={gameOpponent.username}
                    currentUserAddress={address}
                    currentUsername={userProfile?.username}
                    gameSessionId={gameSessionId}
                />
            )}
        </div>
    );
}
