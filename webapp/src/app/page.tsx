"use client";

import { useState } from "react";
import VoiceRoom from "@/components/VoiceRoom";

export default function Home() {
  const [roomName] = useState("voice-room");
  const [username] = useState(`user-${Math.random().toString(36).slice(2, 7)}`);

  return (
    <main className="flex justify-center items-center bg-[#0a0a0f] p-4 min-h-screen text-white">
      <VoiceRoom roomName={roomName} username={username} />
    </main>
  );
}