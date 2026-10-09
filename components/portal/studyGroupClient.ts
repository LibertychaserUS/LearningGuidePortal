export type StudyGroupMember = { userId: string; displayName: string; role: "host" | "member" };
export type StudySession = {
  id: string;
  groupId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  maxParticipants: number;
  focus: string | null;
  aiTutorEnabled: boolean;
  state: "scheduled" | "starting_soon" | "live" | "completed";
  occupancy: number;
  plannedCount: number;
  viewerPlanned: boolean;
  attendees: Array<{ userId: string; displayName: string }>;
};
export type StudyGroupDetail = {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  about: string;
  role: "host" | "member" | null;
  memberCount: number;
  live: boolean;
  canJoin?: boolean;
  members?: StudyGroupMember[];
  sessions?: StudySession[] | null;
};

export type StudyGroupResponse<T> = { ok: boolean; code: string; message: string; data: T };

export async function studyGroupRequest<T>(url: string, init?: RequestInit): Promise<StudyGroupResponse<T>> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  return response.json() as Promise<StudyGroupResponse<T>>;
}

export const SESSION_TITLE_MAX = 20;

export function sessionTitleCount(value: string) {
  const length = Math.min(value.length, SESSION_TITLE_MAX);
  return `${length}/${SESSION_TITLE_MAX}`;
}

export function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}
