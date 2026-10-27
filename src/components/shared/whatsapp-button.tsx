import { WhatsappLogoIcon } from "@phosphor-icons/react/ssr";

import { toWhatsappUrl } from "@/lib/format/whatsapp";
import { cn } from "@/lib/utils";

type WhatsappButtonProps = {
  phone: string;
  // Accessible name; it must contain the visible text.
  label: string;
  // The visible word next to the icon.
  text: string;
  className?: string;
};

// The look shared by the WhatsApp buttons: green icon and text at rest, a light
// green fill and border on hover and keyboard focus.
export const WHATSAPP_BUTTON_CLASS =
  "inline-flex h-7 items-center gap-1.5 rounded-lg border border-transparent px-2 text-sm font-medium text-whatsapp transition-colors outline-none hover:border-whatsapp/40 hover:bg-whatsapp/10 focus-visible:border-whatsapp/40 focus-visible:bg-whatsapp/10 focus-visible:ring-3 focus-visible:ring-ring/50";

// Opens a WhatsApp chat with the phone. It always renders, whatever the phone is.
export function WhatsappButton({ phone, label, text, className }: WhatsappButtonProps) {
  return (
    <a
      href={toWhatsappUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(WHATSAPP_BUTTON_CLASS, className)}
    >
      <WhatsappLogoIcon aria-hidden="true" weight="fill" className="size-4" />
      {text}
    </a>
  );
}
