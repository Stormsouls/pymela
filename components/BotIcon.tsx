import { ShoppingBag, Star, Mail, FileText, Scale, TrendingUp, MessageCircleQuestion, ClipboardList, Languages, BookImage, type LucideProps } from "lucide-react";

const MAP = { ShoppingBag, Star, Mail, FileText, Scale, TrendingUp, MessageCircleQuestion, ClipboardList, Languages, BookImage } as const;

export type BotIconName = keyof typeof MAP;

export function BotIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = MAP[name as BotIconName] ?? FileText;
  return <Cmp {...props} />;
}
