import React from 'react';

export default function AboutModal({ isOpen, onClose, onConfirm, forceConfirm = false }) {
    if (!isOpen) return null;

    const handleClose = forceConfirm ? () => {} : onClose;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-4">About MonChat</h2>
                    <div className="about-modal text-left space-y-3 text-sm max-h-[300px] overflow-y-auto pr-2 styled-scrollbar">
                        <p>
                            Thanks for using MonChat! This website is an independent project and has no official connection with the Monad team.
                        </p>
                        <p>
                            Please do not send sensitive personal information or inappropriate content in the chat. All activity here is public on the blockchain. We are not responsible for any leaks, data exposure, or any damage caused by improper use of the platform.
                        </p>
                        <p>
                            The site is experimental and may contain bugs or instabilities. If you are significantly affected by a problem, feel free to contact the developer.
                        </p>
                        <p>
                            You may be banned or have messages deleted from the chat if you violate the terms of use, such as sending spam, illegal, or offensive content. The MonChat team reserves the right to ban users who do not respect the community guidelines.
                        </p>
                        <p>
                            MonChat is an open-source project. You can view the source code on <a href="https://github.com/0xGusta/MonChatReact" target="_blank" rel="noopener noreferrer">GitHub</a>. The contract code can be viewed on <a href="https://testnet.monadexplorer.com/address/0xB08111985e1a891605fa095AB9d52A93aDdC95a0?tab=Contract" target="_blank" rel="noopener noreferrer">MonVision</a>.
                        </p>
                        <p className="text-gray-400">
                            Remember: By interacting here, you are aware that everything you send will be recorded on the Blockchain.
                        </p>
                        <p style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem', 
                                flexWrap: 'wrap',
                                textAlign: 'center'
                            }}>
                            Powered by 
                                <img style={{ maxWidth: '150px' }} src="/images/MonadLogo.svg" alt="Monad Logo" />
                                <img style={{ maxWidth: '150px' }} src="/images/multisynq.svg" alt="Multisynq Logo" />
                            </p>
                    </div>
                    <p>Developed by: <br />
                    <a
                        href="https://x.com/0xGustavo"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img style={{ width: '20px', height: '20px', marginTop: '2px'}} src="/images/x.svg" alt="X logo" />0xGus
                    </a></p>
                    <button onClick={onConfirm || onClose} className="btn btn-primary mt-4">
                        Agree and Close
                    </button>
                </div>
            </div>
        </div>
    );
}
