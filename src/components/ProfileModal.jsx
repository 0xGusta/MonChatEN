import React from 'react';
import { getIPFSUrl } from '../utils/ipfs';
import { showLinkConfirmation } from '../utils/helpers';

export default function ProfileModal({ isOpen, onClose, userAddress, userProfile, onSendMON, onEditProfile, isConnected, isOwnProfile, isOwner, isModerator, onBanUser, onUnbanUser, onAddModerator, isOnline, onChallengeUser }) {
    if (!isOpen || !userAddress) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <div className="text-center">
                    <div className="mb-4">
                        {userProfile?.profilePicHash ? (
                            <img src={getIPFSUrl(userProfile.profilePicHash)} alt="Profile Picture" className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-monad cursor-pointer" onClick={() => showLinkConfirmation(getIPFSUrl(userProfile.profilePicHash))} />
                        ) : (
                            <img src="/images/nopfp.png" alt="Profile Picture" className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-monad" />
                        )}
                    </div>
                    <h2 className="text-xl font-bold mb-2">{userProfile?.username || 'User'}</h2>
                    <div className={`status-indicator mb-4 ${isOnline ? 'status-connected' : 'status-disconnected'}`}>
                        <i className="fas fa-circle text-xs"></i>
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                    <div className="flex flex-col gap-2 justify-center">
                        <div className="flex flex-col md:flex-row gap-2 justify-center">
                            {isOwnProfile && (<button onClick={onEditProfile} className="btn btn-secondary flex-1"><i className="fas fa-edit"></i>Edit Profile</button>)}
                            {isConnected && !isOwnProfile && (<button onClick={() => onSendMON(userAddress)} className="btn btn-primary flex-1"><i className="fas fa-coins"></i> Send MON</button>)}
                        </div>
                        {isConnected && !isOwnProfile && (
                             <div className="flex flex-col md:flex-row gap-2 justify-center mt-2">
                                <button
                                  onClick={() => {
                                    onChallengeUser(userAddress, userProfile?.username, 'tictactoe');
                                    onClose();
                                  }}
                                  className="btn btn-primary flex-1"
                                  disabled={!isOnline}
                                  title="Challenge to a game of Tic-Tac-Toe"
                                >
                                  <i className="fas fa-times"></i> Challenge (Tic-Tac-Toe)
                                  {!isOnline && ' (offline)'}
                                </button>
                                <button
                                  onClick={() => {
                                    onChallengeUser(userAddress, userProfile?.username, 'tetris');
                                    onClose();
                                  }}
                                  className="btn btn-primary flex-1"
                                  disabled={!isOnline}
                                  title="Challenge to a game of Tetris"
                                >
                                  <i className="fas fa-cubes"></i> Challenge (Tetris)
                                  {!isOnline && ' (offline)'}
                                </button>
                             </div>
                        )}

                        {(isOwner || isModerator) && !isOwnProfile && (
                            <div className="flex flex-row gap-2 justify-center mt-2">
                                <button onClick={() => onBanUser(userProfile?.username)} className="btn btn-danger flex-1"><i className="fas fa-ban"></i> Ban</button>
                                <button onClick={() => onUnbanUser(userProfile?.username)} className="btn btn-secondary flex-1"><i className="fas fa-check"></i> Unban</button>
                            </div>
                        )}
                        {isOwner && !isOwnProfile && (<button onClick={() => onAddModerator(userProfile?.username)} className="btn btn-primary w-full mt-2"><i className="fas fa-shield-alt"></i> Add Moderator</button>)}
                        <button onClick={onClose} className="btn btn-secondary w-full mt-2">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
