import { PortalFooter } from "@/components/portal/PortalFooter";
import { StudyGroupHeader } from "@/components/portal/StudyGroupHeader";
import { StudyGroupsApp } from "@/components/portal/StudyGroupsApp";
import { currentProductUser } from "@/services/productAuth";
import { localeFrom } from "@/lib/i18n/config";
import styles from "@/components/portal/study-groups.module.css";

export default async function StudyGroupsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeFrom((await params).locale);
  const user = await currentProductUser();
  return (
    <main className={styles.page}>
      <StudyGroupHeader locale={locale} signedIn={Boolean(user)} displayName={user?.nickname} />
      <StudyGroupsApp locale={locale} signedIn={Boolean(user)} />
      <PortalFooter locale={locale} />
    </main>
  );
}
