import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Send, Mic, Square, X, Play, Pause, 
  Image as ImageIcon, Volume2, User as UserIcon, RefreshCw, Radio, MessageSquare, Trash2, ChevronLeft
} from 'lucide-react';
import { chatService, ChatConversation, ChatMessage } from '../../services/chatService';

interface ChatPageProps {
  user?: any;
  onOpenAuth?: () => void;
  initialRecipientId?: string | null;
}

export const ChatPage: React.FC<ChatPageProps> = ({ user, onOpenAuth, initialRecipientId }) => {
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-md">
          <MessageSquare className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">Чат защищен</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto font-medium leading-relaxed">
            Чтобы обмениваться сообщениями в реальном времени, войдите или зарегистрируйтесь.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            <span>Войти или Создать Аккаунт</span>
          </button>
        </div>
      </div>
    );
  }

  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  const [isLoading, setIsLoading] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Photo upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Audio Playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const token = localStorage.getItem('ergon_access_token') || localStorage.getItem('ergon_token') || '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    if (activeChatId) {
      localStorage.setItem('ergon_active_chat_id', activeChatId);
      const savedDraft = localStorage.getItem(`draft_${activeChatId}`);
      setInputText(savedDraft || '');
    }
  }, [activeChatId]);

  // Load Real User Conversations from DB
  const loadConversations = async (targetChatId?: string | null, preventAutoSelect = false) => {
    try {
      const realChats = await chatService.getChats();
      setChats(realChats);
      
      const savedChatId = localStorage.getItem('ergon_active_chat_id');
      if (targetChatId) {
        setActiveChatId(targetChatId);
        localStorage.setItem('ergon_active_chat_id', targetChatId);
      } else if (savedChatId && realChats.some((c) => c.id === savedChatId) && !preventAutoSelect) {
        setActiveChatId(savedChatId);
      } else if (realChats.length > 0 && !activeChatIdRef.current && !preventAutoSelect) {
        setActiveChatId(realChats[0].id);
        localStorage.setItem('ergon_active_chat_id', realChats[0].id);
      }
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  };

  // Handle Initial Recipient Redirect & Initial Conversations Load
  useEffect(() => {
    let isSubscribed = true;
    if (initialRecipientId) {
      setIsLoading(true);
      chatService.getOrCreateChat(initialRecipientId).then((chatRoom) => {
        if (!isSubscribed) return;
        setIsLoading(false);
        if (chatRoom && chatRoom.id) {
          setActiveChatId(chatRoom.id);
          localStorage.setItem('ergon_active_chat_id', chatRoom.id);
          loadConversations(chatRoom.id);
        } else {
          loadConversations();
        }
      }).catch((err) => {
        console.error("Error opening chat with initial recipient:", err);
        if (isSubscribed) {
          setIsLoading(false);
          loadConversations();
        }
      });
    } else {
      loadConversations();
    }
    return () => { isSubscribed = false; };
  }, [initialRecipientId, user?.id]);

  const handleDeleteChat = async (chatIdToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Вы действительно хотите удалить этот диалог со всеми сообщениями?')) return;

    const ok = await chatService.deleteChat(chatIdToDelete);
    if (ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatIdToDelete));
      if (activeChatId === chatIdToDelete) {
        localStorage.removeItem('ergon_active_chat_id');
        setChats((remaining) => {
          if (remaining.length > 0) {
            setActiveChatId(remaining[0].id);
            localStorage.setItem('ergon_active_chat_id', remaining[0].id);
          } else {
            setActiveChatId(null);
          }
          return remaining;
        });
      }
    }
  };

  useEffect(() => {
    if (!activeChatId) return;

    let isSubscribed = true;
    chatService.getMessages(activeChatId).then((data) => {
      if (isSubscribed) {
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      }
    });

    const wsConn = chatService.connectWebSocket(token, (newMsg: ChatMessage) => {
      if (newMsg.chat_id === activeChatIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(scrollToBottom, 100);
      }
      loadConversations(activeChatIdRef.current, true);
    });

    return () => {
      isSubscribed = false;
      wsConn.close();
    };
  }, [activeChatId, token]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;

    const contentToSend = inputText.trim();
    setInputText('');
    localStorage.removeItem(`draft_${activeChatId}`);

    const sent = await chatService.sendMessageHttp(activeChatId, 'text', contentToSend);
    if (sent) {
      setMessages((prev) => [...prev, sent]);
      setTimeout(scrollToBottom, 100);
      loadConversations();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('Размер файла не должен превышать 10MB');
        return;
      }
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Send Photo
  const handleSendImage = async () => {
    if (!selectedImage || !activeChatId) return;
    setIsUploadingImage(true);

    try {
      const uploadedUrl = await chatService.uploadFile(selectedImage, 'chat');
      if (uploadedUrl) {
        const sent = await chatService.sendMessageHttp(activeChatId, 'image', uploadedUrl);
        if (sent) {
          setMessages((prev) => [...prev, sent]);
          loadConversations();
        }
      }
    } catch (e) {
      console.error('Failed to send image:', e);
    } finally {
      setIsUploadingImage(false);
      setSelectedImage(null);
      setImagePreviewUrl(null);
    }
  };

  // Voice Recording Start
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Доступ к микрофону отклонен.');
    }
  };

  // Voice Recording Stop & Send
  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !activeChatId) return;

    clearInterval(timerIntervalRef.current);
    const mediaRecorder = mediaRecorderRef.current;

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setIsRecording(false);
      setRecordingTime(0);

      mediaRecorder.stream.getTracks().forEach((track) => track.stop());

      const audioUrl = await chatService.uploadFile(audioBlob, 'chat');
      if (audioUrl) {
        const sent = await chatService.sendMessageHttp(activeChatId, 'voice', audioUrl);
        if (sent) {
          setMessages((prev) => [...prev, sent]);
          loadConversations();
        }
      }
    };

    mediaRecorder.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      clearInterval(timerIntervalRef.current);
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleAudioPlay = (msgId: string, audioUrl: string) => {
    if (playingAudioId === msgId) {
      const audio = audioElementsRef.current[msgId];
      if (audio) audio.pause();
      setPlayingAudioId(null);
      return;
    }

    if (playingAudioId && audioElementsRef.current[playingAudioId]) {
      audioElementsRef.current[playingAudioId].pause();
    }

    if (!audioElementsRef.current[msgId]) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAudioId(null);
      audioElementsRef.current[msgId] = audio;
    }

    audioElementsRef.current[msgId].play();
    setPlayingAudioId(msgId);
  };

  // Deduplicate Chats by Partner User ID
  const uniqueChatsMap = new Map<string, ChatConversation>();
  chats.forEach((chat) => {
    const partner = chat.participants.find((p) => p.user_id !== user?.id)?.user;
    const key = partner?.id || partner?.email || chat.id;
    if (!uniqueChatsMap.has(key)) {
      uniqueChatsMap.set(key, chat);
    }
  });
  const uniqueChats = Array.from(uniqueChatsMap.values());

  const filteredChats = uniqueChats.filter((c) => {
    const participantNames = c.participants.map((p) => p.user?.full_name || p.user?.email || '').join(' ');
    return participantNames.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeChatObj = chats.find((c) => c.id === activeChatId);
  const otherParticipant = activeChatObj?.participants.find((p) => p.user_id !== user?.id)?.user;
  const activeChatTitle = otherParticipant?.full_name || otherParticipant?.email || 'Собеседник';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-10rem)] md:h-[calc(100vh-8.5rem)] relative">
      
      {/* ── LEFT PANEL: REAL HUMAN CONVERSATION LIST ONLY ── */}
      <div className={`lg:col-span-4 ref-card p-4 flex flex-col gap-4 overflow-y-auto ${activeChatId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Сообщения (Чат)</h2>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span className="text-emerald-600 dark:text-emerald-400">
              WebSocket & Live 🟢
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Поиск собеседников..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs font-semibold outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400"
          />
        </div>

        {/* List of Conversations */}
        <div className="space-y-1.5 pt-1 flex-1 overflow-y-auto">
          {isLoading && uniqueChats.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> Загрузка диалогов...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-3">
              <MessageSquare className="w-8 h-8 text-indigo-300 dark:text-indigo-500 mx-auto" />
              <p>У вас пока нет активных диалогов.</p>
              <p className="text-[11px] text-slate-400">Нажмите "Написать соискателю" в откликах, чтобы начать переписку!</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const partner = chat.participants.find((p) => p.user_id !== user?.id)?.user;
              const title = partner?.full_name || partner?.email || 'Собеседник';
              const isSelected = activeChatId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`p-3.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-all group ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    }`}>
                      {partner?.full_name ? partner.full_name.substring(0, 2).toUpperCase() : <UserIcon className="w-5 h-5" />}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{title}</h4>
                        <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {chat.last_message ? new Date(chat.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 font-medium ${isSelected ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                        {chat.last_message ? (
                          chat.last_message.type === 'image' ? '📷 Фото' :
                          chat.last_message.type === 'voice' ? '🎙 Голосовое сообщение' :
                          chat.last_message.content
                        ) : 'Начало переписки'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    title="Удалить чат"
                    className={`p-1.5 rounded-lg transition-all ${
                      isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500 hover:text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: ACTIVE REAL CHAT THREAD ── */}
      <div className={`lg:col-span-8 ref-card p-4 sm:p-5 flex flex-col justify-between h-full relative overflow-hidden ${!activeChatId ? 'hidden lg:flex' : 'flex'}`}>
        
        {activeChatId ? (
          <>
            {/* Header */}
            <div className="pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setActiveChatId(null)}
                  className="lg:hidden p-2 -ml-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Назад к списку чатов"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs">
                  {otherParticipant?.full_name ? otherParticipant.full_name.substring(0, 2).toUpperCase() : <UserIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">{activeChatTitle}</h3>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> В сети
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteChat(activeChatId)}
                className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 dark:hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-extrabold flex items-center gap-1.5 transition-all border border-rose-200 dark:border-rose-900/60 active:scale-95 shadow-2xs"
                title="Удалить чат со всеми сообщениями"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Удалить чат</span>
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id || msg.sender_id === 'current-user';

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mb-1">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[78%] p-3.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs space-y-1.5 ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-bl-none'
                      }`}
                    >
                      {msg.type === 'text' && (
                        <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                      )}

                      {msg.type === 'image' && (
                        <div className="space-y-1">
                          <img
                            src={msg.content}
                            alt="Shared media"
                            onClick={() => setLightboxImage(msg.content)}
                            className="max-h-60 rounded-xl object-cover cursor-pointer border border-white/20 hover:opacity-95 transition-opacity"
                          />
                        </div>
                      )}

                      {msg.type === 'voice' && (
                        <div className="flex items-center gap-3 py-1 px-2 rounded-xl bg-black/10">
                          <button
                            type="button"
                            onClick={() => toggleAudioPlay(msg.id, msg.content)}
                            className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center shrink-0 shadow-xs hover:scale-105 transition-transform"
                          >
                            {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between text-[10px] font-bold opacity-80">
                              <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Голосовое сообщение</span>
                            </div>
                            <div className="h-1.5 w-32 bg-white/30 rounded-full overflow-hidden">
                              <div className={`h-full bg-white transition-all ${playingAudioId === msg.id ? 'w-full animate-pulse' : 'w-1/3'}`}></div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] text-right font-medium opacity-70">
                        {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected Image Preview Modal Bar before send */}
            {selectedImage && imagePreviewUrl && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border-t border-indigo-100 dark:border-indigo-800/60 flex items-center justify-between gap-4 rounded-xl mb-2">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img src={imagePreviewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-indigo-200 dark:border-indigo-800" />
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{selectedImage.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{(selectedImage.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelectedImage(null); setImagePreviewUrl(null); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSendImage}
                    disabled={isUploadingImage}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isUploadingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Отправить</span>
                  </button>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
              {isRecording ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
                    <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono">
                      Запись аудио: {formatTime(recordingTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSendRecording}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-red-700"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Отправить</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendText} className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Прикрепить изображение"
                    className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shrink-0"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={startRecording}
                    title="Запись голосового сообщения"
                    className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 transition-all shrink-0"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    placeholder="Напишите сообщение..."
                    value={inputText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputText(val);
                      if (activeChatId) {
                        localStorage.setItem(`draft_${activeChatId}`, val);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-xs font-semibold outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 shrink-0 transition-all shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Выберите диалог</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm font-medium">
                Выберите диалог из списка слева для начала переписки.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxImage} alt="Full view" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain" />
        </div>
      )}

    </div>
  );
};
