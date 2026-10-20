import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  replace: vi.fn(),
  search: "motivo=salida&next=%2Fturnos",
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

import { FlashToast } from "./flash-toast";

describe("FlashToast", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.replace.mockReset();
  });

  it("shows the toast once with its id and removes only its parameter from the URL", () => {
    render(<FlashToast id="signed-out" message="Cerraste sesión." param="motivo" />);
    expect(mocks.toast).toHaveBeenCalledWith("Cerraste sesión.", { id: "signed-out" });
    expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Fturnos", { scroll: false });
  });

  it("drops the query string when nothing else is left", () => {
    mocks.search = "motivo=salida";
    render(<FlashToast id="signed-out" message="Cerraste sesión." param="motivo" />);
    expect(mocks.replace).toHaveBeenCalledWith("/login", { scroll: false });
  });
});
