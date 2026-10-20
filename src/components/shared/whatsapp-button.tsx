import { WhatsappLogoIcon } from "@phosphor-icons/react/ssr";

import { buttonVariants } from "@/components/ui/button";
import { toWhatsappUrl } from "@/lib/format/whatsapp";
import { cn } from "@/lib/utils";

type WhatsappButtonProps = {
  phone: string;
  // Accessible name: the button shows only the icon.
  label: string;
  className?: string;
};

// Icon-only link that opens a WhatsApp chat with the phone. It always renders,
// whatever the phone is.
export function WhatsappButton({ phone, label, className }: WhatsappButtonProps) {
  return (
    <a
      href={toWhatsappUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-whatsapp hover:text-whatsapp", className)}
    >
      <WhatsappLogoIcon aria-hidden="true" weight="fill" className="size-5" />
    </a>
  );
}
