import { notFound } from "next/navigation";
import WhiteboardDemo from "@/components/portal/WhiteboardDemo";

// Prototype playground, local `next dev` only: never served by a build.
export default function WhiteboardDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WhiteboardDemo />;
}
