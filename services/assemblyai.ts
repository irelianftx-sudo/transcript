import type { Transcript, TranscriptParams } from '../types';

const API_BASE_URL = 'https://api.assemblyai.com/v2';

export const uploadFile = async (file: File, apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("A chave da API é necessária para o upload.");
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: file,
        headers: {
            'authorization': apiKey,
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error while uploading: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown upload error'}`);
    }

    const data = await response.json();
    return data.upload_url;
}

export const submitForTranscription = async (audioUrl: string, apiKey: string): Promise<Transcript> => {
    if (!apiKey) throw new Error("A chave da API é necessária para a transcrição.");

    const body: TranscriptParams = {
        audio_url: audioUrl,
        language_code: 'pt', // Hardcoded for Brazilian Portuguese
    };

    const response = await fetch(`${API_BASE_URL}/transcript`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'authorization': apiKey,
            'content-type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error}`);
    }

    return await response.json();
};

export const getTranscriptionResult = async (id: string, apiKey: string): Promise<Transcript> => {
    if (!apiKey) throw new Error("A chave da API é necessária para obter o resultado.");

    const response = await fetch(`${API_BASE_URL}/transcript/${id}`, {
        headers: {
            'authorization': apiKey,
            'content-type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error}`);
    }

    return await response.json();
};
