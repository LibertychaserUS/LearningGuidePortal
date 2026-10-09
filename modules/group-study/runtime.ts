import path from "node:path";
import { systemRoot } from "@/services/fileStore";
import { sendStudyGroupReminderEmail } from "@/services/emailService";
import { checkEntitlement, getProductCourse, getUserById, listPublishedCourses, recordUserNotification } from "@/services/productStore";
import { createStudyGroupRepository } from "./repository";
import { createStudyGroupService, type StudyGroupService } from "./service";

const services = new Map<string, StudyGroupService>();

function tokenLogKey() {
  const encoded = process.env.STUDY_GROUP_TOKEN_LOG_KEY?.trim();
  if (!encoded) return Buffer.alloc(32, 0);
  const key = Buffer.from(encoded, "base64");
  return key.length === 32 ? key : Buffer.alloc(32, 0);
}

export function studyGroupService() {
  const directory = path.join(systemRoot(), "learning_guide", "study-group");
  const existing = services.get(directory);
  if (existing) return existing;
  const service = createStudyGroupService({
    repository: createStudyGroupRepository(directory),
    now: () => new Date(),
    hasCourseAccess: async (userId, courseId) => (await checkEntitlement(userId, courseId)).allowed,
    courseSummary: async (courseId) => {
      const course = await getProductCourse(courseId);
      return course && course.status === "published" ? { id: course.id, title: course.title, slug: course.slug } : null;
    },
    accessibleCourses: async (userId) => {
      const courses = await listPublishedCourses();
      const allowed = [];
      for (const course of courses) {
        if ((await checkEntitlement(userId, course.id)).allowed) allowed.push({ id: course.id, title: course.title, slug: course.slug });
      }
      return allowed;
    },
    userProfile: async (userId) => {
      const user = await getUserById(userId);
      if (!user) return null;
      return { id: user.id, displayName: user.nickname || user.id, email: user.email, locale: user.locale === "zh-CN" ? "zh-CN" : "en-GB" };
    },
    notify: async (input) => {
      await recordUserNotification(input.userId, input.title, input.body);
    },
    sendMail: async (input) => {
      try {
        await sendStudyGroupReminderEmail({ to: input.to, subject: input.subject, text: input.text });
      } catch {
        return;
      }
    },
    liveKit: {
      apiKey: process.env.LIVEKIT_API_KEY?.trim() || "",
      apiSecret: process.env.LIVEKIT_API_SECRET?.trim() || "",
      url: process.env.LIVEKIT_URL?.trim() || process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || ""
    },
    tokenLogKey: tokenLogKey()
  });
  services.set(directory, service);
  return service;
}
