import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import messages from "../../messages/es.json";
import { APP_TIME_ZONE } from "@/lib/format/date";

function IntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="es" messages={messages} timeZone={APP_TIME_ZONE}>
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: IntlProvider, ...options });
}
