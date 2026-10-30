import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Home,
  Images,
  MessageSquareQuote,
  HelpCircle,
  Users2,
  Building,
  BookOpen,
  Phone,
  Search as SearchIcon,
  ListOrdered,
  UserCircle2,
  CreditCard,
  Mail,
  ScrollText,
  Settings,
  LogOut,
  FileText,
  Megaphone,
  Wallet,
  Receipt,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth/context";
import type { Action } from "@/lib/auth/context";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; require?: Action };

const CONTENT: Item[] = [
  { title: "Projects", url: "/admin/projects", icon: Building2, require: "content.edit" },
  { title: "Properties", url: "/admin/properties", icon: Home, require: "content.edit" },
  { title: "Land", url: "/admin/land", icon: Building, require: "content.edit" },
  { title: "Services", url: "/admin/services", icon: Settings, require: "content.edit" },
  { title: "Journal", url: "/admin/journal", icon: BookOpen, require: "content.edit" },
  { title: "Gallery", url: "/admin/gallery", icon: Images, require: "content.edit" },
  { title: "Testimonials", url: "/admin/testimonials", icon: MessageSquareQuote, require: "content.edit" },
  { title: "FAQs", url: "/admin/faqs", icon: HelpCircle, require: "content.edit" },
  { title: "Team & Milestones", url: "/admin/team", icon: Users2, require: "content.edit" },
];


const CRM: Item[] = [
  { title: "Clients", url: "/admin/clients", icon: UserCircle2, require: "clients.manage" },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard, require: "subscriptions.manage" },
  { title: "Payments", url: "/admin/payments", icon: Wallet, require: "subscriptions.manage" },
  { title: "Receipts", url: "/admin/receipts", icon: Receipt, require: "subscriptions.manage" },
  { title: "Documents", url: "/admin/documents", icon: FileText, require: "subscriptions.manage" },
  { title: "Project updates", url: "/admin/updates", icon: Megaphone, require: "content.edit" },
  { title: "Enquiries", url: "/admin/enquiries", icon: Mail, require: "enquiries.assign" },
];

const SITE: Item[] = [
  { title: "Company", url: "/admin/company", icon: Building, require: "content.edit" },
  { title: "Contact", url: "/admin/contact", icon: Phone, require: "contact.manage" },
  { title: "SEO", url: "/admin/seo", icon: SearchIcon, require: "seo.manage" },
  { title: "Homepage", url: "/admin/homepage", icon: ListOrdered, require: "homepage.manage" },
];

const SYS: Item[] = [
  { title: "Users & Roles", url: "/admin/users", icon: Users2, require: "users.manage" },
  { title: "Audit Log", url: "/admin/audit", icon: ScrollText, require: "audit.view" },
  { title: "Settings", url: "/admin/settings", icon: Settings, require: "settings.manage" },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, logout, can } = useAuth();

  const renderGroup = (label: string, items: Item[]) => {
    const visible = items.filter((i) => !i.require || can(i.require));
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => {
              const active =
                pathname === item.url || pathname.startsWith(item.url + "/");
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={active}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-display font-semibold">
            <img src="/apple-touch-icon.png" alt="Motiva Estate logo" className="rounded-md" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base">Motiva</span>
              <span className="text-xs text-muted-foreground">Admin</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                  <Link to="/admin" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {renderGroup("Content", CONTENT)}
        {renderGroup("Clients & Sales", CRM)}
        {renderGroup("Site", SITE)}
        {renderGroup("System", SYS)}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-3">
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.fullName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {user?.email}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="cursor-pointer grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
