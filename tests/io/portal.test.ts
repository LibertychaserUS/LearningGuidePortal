import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  COURSE_ID,
  callRoute,
  clearCookies,
  isolate,
  jsonRequest
} from "./harness";

let restore: () => Promise<void>;
let portalCourses: typeof import("../../app/api/portal/courses/route");
let portalCourse: typeof import("../../app/api/portal/courses/[slug]/route");
let entitlements: typeof import("../../app/api/entitlements/check/route");

before(async () => {
  restore = (await isolate("lg-io-portal-")).restore;
  portalCourses = await import("../../app/api/portal/courses/route");
  portalCourse = await import("../../app/api/portal/courses/[slug]/route");
  entitlements = await import("../../app/api/entitlements/check/route");
});

after(async () => {
  await restore();
});

async function getCoursePage(slug: string) {
  const request = jsonRequest("GET", `http://localhost/api/portal/courses/${slug}`);
  return portalCourse.GET(request, { params: Promise.resolve({ slug }) });
}

test("UC-PORTAL-1 functional: GET /api/portal/courses is 200 and lists only published courses", async () => {
  clearCookies();
  const response = await callRoute(portalCourses.GET, jsonRequest("GET", "http://localhost/api/portal/courses"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.courses));
  assert.ok(body.courses.length > 0);
  assert.ok(body.courses.every((course: { status?: string }) => course.status === "published"));
  assert.ok(body.courses.some((course: { slug?: string; id?: string }) => course.slug === COURSE_ID || course.id === COURSE_ID));
  assert.ok(!body.courses.some((course: { slug?: string; id?: string; status?: string }) => (
    course.status === "draft" || course.slug === "unpublished-fabricated" || course.id === "unpublished-fabricated"
  )));
});

test("UC-PORTAL-1 tourist: portal courses are public; GET /api/entitlements/check is still 401", async () => {
  clearCookies();
  const courses = await callRoute(portalCourses.GET, jsonRequest("GET", "http://localhost/api/portal/courses"));
  assert.equal(courses.status, 200);
  const check = await callRoute(
    entitlements.GET,
    jsonRequest("GET", `http://localhost/api/entitlements/check?courseId=${COURSE_ID}`)
  );
  assert.equal(check.status, 401);
});

test("UC-PORTAL-1 negative: an unpublished slug is not presented as a published page", async () => {
  clearCookies();
  const response = await getCoursePage("unpublished-fabricated");
  assert.ok([200, 404].includes(response.status));
  const body = await response.json();
  const page = body.page ?? body;
  assert.notEqual(page.pageState, "available");
  assert.notEqual(page.identity?.title, "unpublished-fabricated");
  if (page.pageState === "failed") {
    assert.equal(page.identity, null);
  }
});
