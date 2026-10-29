import type { WhiteboardBroadcaster } from "./service";
import { encodeBoardOp, WHITEBOARD_TOPIC } from "./wire";

// Server-side broadcast over LiveKit's RoomService.SendData (reliable, on the
// whiteboard topic). `sendData` is the Study Group gateway's room service, so
// credentials, project routing and the DEV fake stay in one place.
export function createLiveKitWhiteboardBroadcaster(deps: {
  roomFor: (sessionId: string) => Promise<string>;
  sendData: (room: string, data: Uint8Array, options: { topic: string }) => Promise<void>;
}): WhiteboardBroadcaster {
  return async ({ sessionId, op }) => {
    await deps.sendData(await deps.roomFor(sessionId), encodeBoardOp(op), { topic: WHITEBOARD_TOPIC });
  };
}
