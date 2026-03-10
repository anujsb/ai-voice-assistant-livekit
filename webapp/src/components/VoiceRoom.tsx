"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useTrackTranscription,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface VoiceRoomProps {
  roomName: string;
  username: string;
}

export default function VoiceRoom({ roomName, username }: VoiceRoomProps) {
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  console.log("LiveKit URL:", serverUrl); 

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`
      );
      const data = await res.json();
      setToken(data.token);
      setConnected(true);
    } catch (err) {
      console.error("Failed to fetch token", err);
    } finally {
      setLoading(false);
    }
  }, [roomName, username]);

  const [error, setError] = useState("");

  const handleDisconnect = useCallback(() => {
    console.log("disconnected");
    // setToken("");
    // setConnected(false);
  }, []);

  if (!connected || !token) {
    return (
      <LandingScreen onConnect={fetchToken} loading={loading} />
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={true}
      video={false}
    //   onDisconnected={handleDisconnect}
      onError={(error) => console.error("LiveKit error:", error)}
      onDisconnected={(reason) => console.log("Disconnected reason:", reason)}
      className="w-full max-w-2xl"
    >
      <RoomAudioRenderer />
      <AgentInterface onDisconnect={handleDisconnect} />
    </LiveKitRoom>
  );
}

function LandingScreen({
  onConnect,
  loading,
}: {
  onConnect: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-10 max-w-md text-center">
      {/* Animated orb */}
      <div className="relative">
        <div className="absolute inset-0 bg-linear-to-br from-violet-500 via-fuchsia-500 to-cyan-400 opacity-20 blur-2xl rounded-full w-32 h-32 animate-pulse" />
        <div className="relative flex justify-center items-center border border-white/10 rounded-full w-32 h-32">
          <div className="bg-linear-to-br from-violet-600 to-cyan-500 opacity-80 rounded-full w-20 h-20 animate-pulse" />
        </div>
      </div>

      <div>
        <h1
          className="mb-2 font-light text-4xl tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Voice Assistant
        </h1>
        <p className="text-white/40 text-sm uppercase tracking-widest">
          Powered by LiveKit · OpenAI
        </p>
      </div>

      <p className="text-white/60 text-sm leading-relaxed">
        Click below to connect. Your microphone will be used for live voice
        interaction with the AI assistant. Transcripts appear in real-time.
      </p>

      <button
        onClick={onConnect}
        disabled={loading}
        className="bg-linear-to-r from-violet-600 to-cyan-500 hover:opacity-90 disabled:opacity-50 shadow-lg shadow-violet-500/20 px-8 py-3 rounded-full font-medium text-white text-sm tracking-wide active:scale-95 transition-all disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="border border-white/40 border-t-white rounded-full w-3 h-3 animate-spin" />
            Connecting...
          </span>
        ) : (
          "Start Conversation"
        )}
      </button>
    </div>
  );
}

function AgentInterface({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<Message[]>([]);

  // Get user transcription from their mic track
  const localMicTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
  const { segments: userSegments } = useTrackTranscription(
    localMicTrack ? { participant: localParticipant, publication: localMicTrack, source: Track.Source.Microphone } : undefined
  );

  // Handle agent transcriptions
useEffect(() => {
  if (!agentTranscriptions?.length) return;
  setMessages((prev) => {
    const updated = [...prev];
    for (const seg of agentTranscriptions) {
      const existingIdx = updated.findIndex((m) => m.id === seg.id);
      const newMsg: Message = {
        id: seg.id,
        role: "assistant",
        text: seg.text,
        timestamp: new Date(),
        isFinal: seg.final,
      };
      if (existingIdx !== -1) {
        updated[existingIdx] = newMsg;
      } else {
        updated.push(newMsg);
      }
    }
    return updated;
  });
}, [agentTranscriptions]);


  // Handle user transcriptions
  useEffect(() => {
    if (!userSegments?.length) return;
    setMessages((prev) => {
      const updated = [...prev];
      for (const seg of userSegments) {
        if (!seg.text.trim()) continue;
        const existingIdx = updated.findIndex((m) => m.id === seg.id);
        const newMsg: Message = {
          id: seg.id,
          role: "user",
          text: seg.text,
          timestamp: new Date(),
          isFinal: seg.final ?? false,
        };
        if (existingIdx !== -1) {
          updated[existingIdx] = newMsg;
        } else {
          updated.push(newMsg);
        }
      }
      return updated;
    });
  }, [userSegments]);
  

  const statusLabel: Record<string, string> = {
    connecting: "Connecting...",
    initializing: "Initializing agent...",
    listening: "Listening",
    thinking: "Thinking...",
    speaking: "Speaking",
    idle: "Ready",
  };

  const statusColor: Record<string, string> = {
    listening: "bg-emerald-400",
    speaking: "bg-violet-400",
    thinking: "bg-amber-400",
    connecting: "bg-white/30",
    initializing: "bg-white/30",
    idle: "bg-white/20",
  };

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-2xl"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${statusColor[state] ?? "bg-white/20"} animate-pulse`}
          />
          <span className="text-white/50 text-xs uppercase tracking-widest">
            {statusLabel[state] ?? state}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          className="text-white/30 hover:text-white/60 text-xs uppercase tracking-wide transition-colors"
        >
          End session
        </button>
      </div>

      {/* Visualizer */}
      <div className="relative flex flex-col items-center gap-4 bg-white/5 py-8 border border-white/5 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-violet-500/5 to-transparent pointer-events-none" />
        <div className="px-8 w-full h-24">
          <BarVisualizer
            state={state}
            trackRef={audioTrack}
            barCount={32}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <p className="text-white/30 text-xs uppercase tracking-widest">
          {state === "listening"
            ? "Listening to you"
            : state === "speaking"
            ? "Agent speaking"
            : "Voice activity"}
        </p>
      </div>

      {/* Transcript */}
      <div className="flex flex-col gap-1">
        <p className="mb-2 text-white/30 text-xs uppercase tracking-widest">
          Transcript
        </p>
        <div className="flex flex-col gap-3 pr-1 h-72 overflow-y-auto scrollbar-thin">
          {messages.length === 0 && (
            <p className="mt-8 text-white/20 text-sm text-center">
              Conversation will appear here...
            </p>
          )}
          {messages.map((msg, i) => (
            <TranscriptBubble key={i} message={msg} />
          ))}
        </div>
      </div>

      {/* Control bar */}
      <div className="flex justify-center">
        <VoiceAssistantControlBar />
      </div>
    </div>
  );
}

function TranscriptBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed transition-opacity ${
          message.isFinal ? "opacity-100" : "opacity-60"
        } ${
          isUser
            ? "bg-violet-600/30 text-violet-100 rounded-tr-sm"
            : "bg-white/5 text-white/80 rounded-tl-sm"
        }`}
      >
        <p>{message.text}</p>
        {!message.isFinal && (
          <span className="inline-flex gap-0.5 ml-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="bg-current opacity-60 rounded-full w-1 h-1 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}