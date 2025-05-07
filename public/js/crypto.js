// Basic encryption functions (in production, use more secure methods)
const ENCRYPTION_KEY = 'default-encryption-key-123';

function encryptMessage(text) {
    try {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(result);
    } catch (err) {
        console.error('Encryption error:', err);
        return text;
    }
}

function decryptMessage(encodedText) {
    try {
        const text = atob(encodedText);
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch (err) {
        console.error('Decryption error:', err);
        return encodedText;
    }
}
