import { Badge } from "@/components/ui/badge";
import type {
  ClientStatus,
  ContentStatus,
  EnquiryStatus,
  Role,
  SubscriptionStatus,
} from "@/lib/api/types";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/api/types";

type Tone = "default" | "secondary" | "outline" | "destructive";
type ReceiptStatus = "DRAFT" | "ISSUED" | "VOIDED";

const CONTENT_TONE: Record<ContentStatus, Tone> = {
  DRAFT: "outline",
  REVIEW: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "destructive",
};
const CLIENT_TONE: Record<ClientStatus, Tone> = {
  LEAD: "outline",
  ACTIVE: "default",
  LAPSED: "destructive",
  CONVERTED: "secondary",
};
const SUB_TONE: Record<SubscriptionStatus, Tone> = {
  ACTIVE: "default",
  PENDING: "outline",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
};
const ENQUIRY_TONE: Record<EnquiryStatus, Tone> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "secondary",
  CONVERTED: "default",
  LOST: "destructive",
};
const RECEIPT_TONE: Record<ReceiptStatus, Tone> = {
  DRAFT: "secondary",
  ISSUED: "default",
  VOIDED: "destructive",
};

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <Badge variant={CONTENT_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}
export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={CLIENT_TONE[status]}>{status}</Badge>;
}
export function SubStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge variant={SUB_TONE[status]}>{status}</Badge>;
}
export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return <Badge variant={ENQUIRY_TONE[status]}>{status}</Badge>;
}
export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant="outline">{ROLE_LABELS[role]}</Badge>;
}
export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  return <Badge variant={RECEIPT_TONE[status]}>{status}</Badge>;
}
