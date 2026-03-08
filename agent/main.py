# # FILE: agent/main.py
# import asyncio
# import json
# import logging
# from dotenv import load_dotenv

# load_dotenv('../.env.local')
# load_dotenv('../.env')
# load_dotenv('.env')

# from livekit.agents import (
#     AutoSubscribe,
#     JobContext,
#     JobProcess,
#     WorkerOptions,
#     cli,
# )
# from livekit.agents import Agent, AgentSession, RoomInputOptions
# from livekit.plugins import groq, silero

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger("vocalhq")


# def prewarm(proc: JobProcess):
#     proc.userdata["vad"] = silero.VAD.load()


# async def entrypoint(ctx: JobContext):
#     agent_name    = "AI Receptionist"
#     greeting      = "Hi! Thanks for calling. How can I help you today?"
#     system_prompt = "You are a helpful AI receptionist. Keep responses to 1-3 sentences. No markdown. Natural speech only."
#     voice_id      = "Celeste-PlayAI"

#     try:
#         if ctx.room.metadata:
#             cfg = json.loads(ctx.room.metadata)
#             ac  = cfg.get("agentConfig", cfg)
#             agent_name    = ac.get("agentName",    agent_name)
#             greeting      = ac.get("greeting",     greeting)
#             system_prompt = ac.get("systemPrompt", system_prompt)
#             voice_id      = ac.get("voiceConfig", {}).get("voiceId", voice_id)
#             kb = ac.get("knowledgeBase", [])
#             if kb:
#                 system_prompt += "\n\nKNOWLEDGE BASE:\n" + "\n\n".join(
#                     f"Q: {e['question']}\nA: {e['answer']}" for e in kb
#                 )
#     except Exception as e:
#         logger.warning(f"Metadata parse error: {e}")

#     logger.info(f"Agent '{agent_name}' joining room: {ctx.room.name}")

#     await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

#     async def send_data(payload: dict):
#         try:
#             await ctx.room.local_participant.publish_data(
#                 json.dumps(payload).encode(), reliable=True
#             )
#         except Exception:
#             pass

#     session = AgentSession(
#         vad=ctx.proc.userdata["vad"],
#         stt=groq.STT(model="whisper-large-v3-turbo", language="en"),
#         llm=groq.LLM(model="llama-3.3-70b-versatile"),
#         tts=groq.TTS(model="playai-tts", voice=voice_id),
#     )

#     @session.on("agent_speech_committed")
#     def on_agent_speech(ev):
#         text = str(ev.user_transcript or "")
#         if text:
#             asyncio.create_task(send_data({"type": "transcript", "role": "agent", "content": text}))

#     @session.on("user_speech_committed")
#     def on_user_speech(ev):
#         text = str(ev.user_transcript or "")
#         if text:
#             asyncio.create_task(send_data({"type": "transcript", "role": "user", "content": text}))

#     agent = Agent(instructions=f"{system_prompt}\n\nThis is a phone call. Keep responses to 1-3 sentences max.")

#     await session.start(
#         room=ctx.room,
#         agent=agent,
#         room_input_options=RoomInputOptions(),
#     )

#     await session.generate_reply(instructions=greeting)
#     await asyncio.sleep(3600)


# if __name__ == "__main__":
#     cli.run_app(WorkerOptions(
#         entrypoint_fnc=entrypoint,
#         prewarm_fnc=prewarm,
#     ))


# FILE: agent/main.py
import asyncio
import json
import logging
from dotenv import load_dotenv

load_dotenv('../.env.local')
load_dotenv('../.env')
load_dotenv('.env')

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    Agent,
    AgentSession,
    RoomInputOptions,
)
from livekit.plugins import groq, silero

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vocalhq")


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    agent_name    = "AI Receptionist"
    greeting      = "Hi! Thanks for calling. How can I help you today?"
    system_prompt = "You are a helpful AI receptionist. Keep responses to 1-3 sentences. No markdown. Speak naturally."
    voice_id      = "Celeste-PlayAI"

    # Read config from room metadata (set by /api/livekit/token)
    try:
        meta = ctx.room.metadata or ""
        if meta:
            cfg = json.loads(meta)
            ac  = cfg.get("agentConfig", cfg)
            agent_name    = ac.get("agentName",    agent_name)
            greeting      = ac.get("greeting",     greeting)
            system_prompt = ac.get("systemPrompt", system_prompt)
            voice_id      = ac.get("voiceConfig", {}).get("voiceId", voice_id)
            kb = ac.get("knowledgeBase", [])
            if kb:
                system_prompt += "\n\nKNOWLEDGE BASE:\n" + "\n\n".join(
                    f"Q: {e['question']}\nA: {e['answer']}" for e in kb
                )
    except Exception as e:
        logger.warning(f"Metadata parse error: {e}")

    logger.info(f"Starting '{agent_name}' in room: {ctx.room.name}")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=groq.STT(model="whisper-large-v3-turbo", language="en"),
        llm=groq.LLM(model="llama-3.3-70b-versatile"),
        tts=groq.TTS(model="playai-tts", voice=voice_id),
    )

    agent = Agent(
        instructions=f"{system_prompt}\n\nIMPORTANT: This is a voice call. Keep every response to 1-3 short sentences."
    )

    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(),
    )

    # Greet the caller
    await session.generate_reply(instructions=f"Greet the caller with: {greeting}")

    # Keep alive for up to 1 hour
    await asyncio.sleep(3600)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm,
    ))