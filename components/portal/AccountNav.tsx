"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, HelpCircle, LayoutDashboard, Settings } from "lucide-react";
import { getMessages } from "@/lib/i18n/messages";

export function AccountNav({ locale, copy }: { locale: "en-GB" | "zh-CN"; copy: { overview: string; subscription: string; notifications: string; settings: string; help: string } }) {
  const pathname = usePathname();
  const labels = getMessages(locale).account;
  const root = `/${locale}/account/my-learning`;
  const links = [
    [root, copy.overview, LayoutDashboard],
    [`${root}/subscription`, copy.subscription, CreditCard],
    [`${root}/notifications`, copy.notifications, Bell],
    [`${root}/settings`, copy.settings, Settings],
    [`/${locale}/help`, copy.help, HelpCircle]
  ] as const;
  return (
    <nav className="account-nav" aria-label={labels.menu}>
      <p className="account-nav-title">MY LEARNING</p>
      {links.map(([href, label, Icon]) => (
        <Link prefetch={false} key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          <Icon className="account-nav-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <div className="account-nav-support">
        <strong>{labels.contact}</strong>
        <p>{labels.supportDescription}</p>
        <Link prefetch={false} href={`/${locale}/contact`}>{labels.contactAction}</Link>
      </div>
    </nav>
  );
}
