
export type TranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface Transcript {
  id: string;
  audio_url: string;
  status: TranscriptStatus;
  text: string | null;
  error?: string;
}

export interface TranscriptParams {
  audio_url: string;
  language_code?: string;
}
