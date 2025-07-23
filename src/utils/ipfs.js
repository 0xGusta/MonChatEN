const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY;
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export const getIPFSUrl = (hash) => hash ? `${PINATA_GATEWAY}${hash}` : '';

export const uploadToIPFS = async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const metadata = JSON.stringify({
        name: file.name,
        keyvalues: {
            uploadedBy: 'ChatOnChain',
            timestamp: new Date().toISOString()
        }
    });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({
        cidVersion: 0
    });
    formData.append('pinataOptions', options);

    try {
        const xhr = new XMLHttpRequest();
        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const result = JSON.parse(xhr.responseText);
                    resolve(result.IpfsHash);
                } else {
                    reject(new Error('Failed to upload to IPFS'));
                }
            });
            xhr.addEventListener('error', () => {
                reject(new Error('Network error uploading to IPFS'));
            });

            xhr.open('POST', 'https://api.pinata.cloud/pinning/pinFileToIPFS');
            xhr.setRequestHeader('pinata_api_key', PINATA_API_KEY);
            xhr.setRequestHeader('pinata_secret_api_key', PINATA_SECRET_KEY);
            xhr.send(formData);
        });
    } catch (error) {
        console.error('Error uploading to IPFS:', error);
        throw error;
    }
};