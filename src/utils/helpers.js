export const getFriendlyErrorMessage = (error) => {
    console.error("Original error received:", error);
    if (error.code === 'ACTION_REJECTED') {
        return 'Transaction rejected by the user.';
    }
    if (error.reason) {
        return error.reason.charAt(0).toUpperCase() + error.reason.slice(1);
    }
    if (error.code === 'INSUFFICIENT_FUNDS') {
        return 'You do not have enough funds to complete this transaction.';
    }
    return 'An unexpected error occurred while processing the transaction. Please try again later.';
};

export const truncateAddress = (address) => {
    if (!address || address.length < 10) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const linkifyText = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<span class="link-preview" onclick="window.showLinkConfirmation('${url.replace(/'/g, "\\'")}')">${url}</span>`);
};

export const showLinkConfirmation = (url) => {
    const event = new CustomEvent('showLinkConfirmation', { detail: url });
    window.dispatchEvent(event);
};

window.showLinkConfirmation = showLinkConfirmation;

export const sanitizeInput = (input) => {
    if (!input) return '';
    return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\//g, '&#x2F;');
};

export const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);