import type { WhiteboardBroadcaster } from "./service";
import { encodeWhiteboardMessage, WHITEBOARD_TOPIC } from "./wire";

// Server-side broadcast over LiveKit's RoomService.SendData (reliable, on the
// whiteboard topic, optionally to some identities only). `sendData` is the
// Study Group gateway's room service, so credentials, project routing and the
// DEV fake stay in one place.
export function createLiveKitWhiteboardBroadcaster(deps: {
  roomFor: (sessionId: string) => Promise<string>;
  sendData: (room: string, data: Uint8Array, options: { topic: string; destinationIdentities?: string[] }) => Promise<void>;
}): WhiteboardBroadcaster {
  return async ({ sessionId, message, destinationIdentities }) => {
    await deps.sendData(await deps.roomFor(sessionId), encodeWhiteboardMessage(message), { topic: WHITEBOARD_TOPIC, ...(destinationIdentities ? { destinationIdentities } : {}) });
  };
}
