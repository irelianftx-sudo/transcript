import React, { useState, useEffect, useCallback, useRef } from 'react';
import { submitForTranscription, getTranscriptionResult, uploadFile } from './services/assemblyai';
import type { Transcript } from './types';
import { CopyIcon, CheckIcon, AudioWaveIcon, UploadIcon, KeyIcon } from './components/icons';

type Status = 'idle' | 'uploading' | 'submitting' | 'polling' | 'completed' | 'error';

const statusMessages: Record<Status, string> = {
  idle: 'Forneça uma URL ou carregue um arquivo de áudio para iniciar.',
  uploading: 'Enviando arquivo...',
  submitting: 'Enviando áudio para processamento...',
  polling: 'Transcrição em andamento. Aguarde...',
  completed: 'Transcrição concluída com sucesso!',
  error: 'Ocorreu um erro.',
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('assemblyai_api_key') || '');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  const pollingIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('assemblyai_api_key', apiKey);
    } else {
      localStorage.removeItem('assemblyai_api_key');
    }
  }, [apiKey]);

  const resetState = () => {
    setAudioUrl('');
    setSelectedFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setTranscript(null);
    setStatus('idle');
    setError(null);
    setIsCopied(false);
    if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
    }
  }

  const pollTranscript = useCallback(async (id: string) => {
    if (!apiKey) return;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const result = await getTranscriptionResult(id, apiKey);
        if (result.status === 'completed' || result.status === 'error') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setTranscript(result);
          if (result.status === 'completed') {
            setStatus('completed');
          } else {
            setStatus('error');
            setError(result.error || 'Falha ao processar a transcrição.');
          }
        }
      } catch (err) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setStatus('error');
        setError('Não foi possível obter o resultado da transcrição.');
        console.error(err);
      }
    }, 5000);
  }, [apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
        setStatus('error');
        setError('Por favor, insira sua chave da API AssemblyAI para continuar.');
        return;
    }
    if ((!audioUrl && !selectedFile) || ['uploading', 'submitting', 'polling'].includes(status)) return;
    
    setError(null);
    setTranscript(null);
    setIsCopied(false);
    
    try {
      let transcriptionUrl = audioUrl;

      if (selectedFile) {
        setStatus('uploading');
        transcriptionUrl = await uploadFile(selectedFile, apiKey);
      }

      setStatus('submitting');
      const initialResponse = await submitForTranscription(transcriptionUrl, apiKey);
      setTranscript(initialResponse);

      if (initialResponse.status === 'error') {
        setStatus('error');
        setError(initialResponse.error || 'Erro ao submeter o áudio.');
      } else if (initialResponse.status === 'queued' || initialResponse.status === 'processing') {
        setStatus('polling');
        pollTranscript(initialResponse.id);
      } else {
        setTranscript(initialResponse);
        setStatus(initialResponse.status);
      }
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
      setError(`Falha ao enviar a solicitação: ${errorMessage}`);
      console.error(err);
    }
  };

  const handleCopy = () => {
    if (transcript?.text) {
      navigator.clipboard.writeText(transcript.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAudioUrl(e.target.value);
    if (e.target.value) {
        setSelectedFile(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setSelectedFile(file);
      if (file) {
          setAudioUrl('');
      }
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);
  
  const isProcessing = ['uploading', 'submitting', 'polling'].includes(status);
  const isFormDisabled = !apiKey || isProcessing;
  const isReadyToSubmit = (!!audioUrl || !!selectedFile) && !!apiKey;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 border border-slate-700">
        <div className="text-center">
            <div className="flex justify-center items-center gap-3">
                <AudioWaveIcon className="w-10 h-10 text-indigo-400"/>
                <h1 className="text-4xl font-bold text-white tracking-tight">Transcrição de Áudio</h1>
            </div>
            <p className="text-slate-400 mt-2">Transcreva áudios em Português (BR) de forma rápida e precisa.</p>
        </div>

        <div className="space-y-2">
            <label htmlFor="api-key" className="block text-sm font-medium text-slate-300">
                Chave da API AssemblyAI
            </label>
            <div className="relative">
                <KeyIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Cole sua chave da API aqui"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
            </div>
        </div>
        
        <div className="flex-grow border-t border-slate-700"></div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`${!apiKey ? 'opacity-50' : ''}`}>
            <label htmlFor="audio-url" className="block text-sm font-medium text-slate-300 mb-2">
              URL do Arquivo de Áudio
            </label>
            <input
              id="audio-url"
              type="url"
              value={audioUrl}
              onChange={handleUrlChange}
              placeholder="https://exemplo.com/meu-audio.mp3"
              required={!selectedFile}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:opacity-50 disabled:bg-slate-800 disabled:cursor-not-allowed"
              disabled={isFormDisabled || !!selectedFile}
            />
          </div>

          <div className="flex items-center">
              <div className="flex-grow border-t border-slate-600"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-sm font-semibold">OU</span>
              <div className="flex-grow border-t border-slate-600"></div>
          </div>

          <div className={`${!apiKey ? 'opacity-50' : ''}`}>
            <label
              htmlFor="audio-file"
              className={`w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700 border-2 border-dashed border-slate-600 rounded-lg transition-colors ${
                  isFormDisabled || !!audioUrl
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer hover:border-indigo-500 hover:bg-slate-600'
              }`}
            >
                <UploadIcon className="w-6 h-6 text-slate-400" />
                <span className="text-slate-300 font-medium">
                    {selectedFile ? selectedFile.name : 'Carregue um arquivo de áudio'}
                </span>
            </label>
            <input
                id="audio-file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*,video/*"
                className="hidden"
                disabled={isFormDisabled || !!audioUrl}
            />
          </div>

          <button
            type="submit"
            disabled={!isReadyToSubmit || isProcessing}
            className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {statusMessages[status]}
              </>
            ) : "Transcrever Áudio"}
          </button>
        </form>

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-white">Resultado</h2>
          <div className="mt-2 p-4 bg-slate-900/50 rounded-lg min-h-[200px] border border-slate-700 flex flex-col justify-between">
              {status !== 'completed' && status !=='error' && <div className="text-center text-slate-400 self-center">{statusMessages[status]}</div>}
              {status === 'error' && <div className="text-center text-red-400 self-center">{error || statusMessages[status]}</div>}
              {status === 'completed' && transcript?.text && (
                  <>
                  <p className="text-slate-300 whitespace-pre-wrap">{transcript.text}</p>
                  <div className="flex justify-end mt-4">
                      <button onClick={handleCopy} className="flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2 px-3 rounded-md transition-colors">
                          {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                          {isCopied ? 'Copiado!' : 'Copiar Texto'}
                      </button>
                  </div>
                  </>
              )}
          </div>
          {(status === 'completed' || status === 'error') && (
              <div className="text-center mt-4">
                  <button onClick={resetState} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                      Iniciar Nova Transcrição
                  </button>
              </div>
          )}
        </div>
      </div>
       <footer className="text-center mt-8 text-slate-500 text-sm">
        <p>Powered by AssemblyAI & React</p>
      </footer>
    </div>
  );
};

export default App;
