import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { DataTable, DataTableSkeleton, type DataTableColumn } from "./data-table";

type Row = { id: string; name: string; km: number; archived: boolean };

const ROWS: Row[] = [
  { id: "1", name: "Alineación", km: 1200, archived: false },
  { id: "2", name: "Lavado", km: 50, archived: true },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { id: "name", header: "Servicio", sortable: true, cell: (row) => row.name },
  { id: "km", header: "Km", align: "right", cell: (row) => row.km },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return renderWithIntl(
    <DataTable
      label="Servicios"
      columns={COLUMNS}
      rows={ROWS}
      getRowId={(row) => row.id}
      sort={{ columnId: "name", direction: "asc" }}
      {...props}
    />,
  );
}

describe("DataTable", () => {
  it("renders a named table with headers and cells", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Servicios" });
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Servicio",
      "Km",
    ]);
    expect(within(table).getByText("Alineación")).toBeInTheDocument();
  });

  it("announces the sort direction and lets sortable headers change it", () => {
    const onSortChange = vi.fn();
    const { rerender } = renderTable({ onSortChange });
    const header = screen.getAllByRole("columnheader")[0];
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getAllByRole("columnheader")[1]).not.toHaveAttribute("aria-sort");

    fireEvent.click(within(header).getByRole("button"));
    expect(onSortChange).toHaveBeenCalledWith("name");

    rerender(
      <DataTable
        label="Servicios"
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row) => row.id}
        sort={{ columnId: "name", direction: "desc" }}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("ordenado de la Z a la A")).toBeInTheDocument();
  });

  it("styles headers apart from rows, highlighting the sorted one", () => {
    renderTable({ columns: [...COLUMNS, { ...COLUMNS[1], id: "km2", header: "Km 2", sortable: true }], onSortChange: () => {} });
    const [sorted, plain, unsorted] = screen.getAllByRole("columnheader");
    for (const header of [sorted, plain, unsorted]) {
      expect(header).toHaveClass("text-xs", "font-medium");
    }
    expect(sorted).toHaveClass("text-foreground");
    expect(unsorted).toHaveClass("text-muted-foreground");
    expect(unsorted).not.toHaveClass("text-foreground");
  });

  it("always shows a sort icon on sortable headers: up/down until sorted, then the direction", () => {
    const { container } = renderTable({
      columns: [...COLUMNS, { ...COLUMNS[1], id: "km2", header: "Km 2", sortable: true }],
      onSortChange: () => {},
    });
    const headers = container.querySelectorAll("th");
    expect(headers[0].querySelectorAll("svg")).toHaveLength(1);
    expect(headers[1].querySelector("svg")).toBeNull();
    expect(headers[2].querySelectorAll("svg")).toHaveLength(1);
    expect(headers[0].innerHTML).not.toBe(headers[2].innerHTML.replace("Km 2", "Servicio"));
  });

  it("doesn't render sort buttons without onSortChange", () => {
    renderTable();
    expect(within(screen.getAllByRole("columnheader")[0]).queryByRole("button")).toBeNull();
  });

  it("aligns numbers right", () => {
    renderTable();
    expect(screen.getByText("1200").closest("td")).toHaveClass("text-right");
  });

  it("opens rows by click, Enter and Space, and makes them focusable", () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    const row = screen.getByText("Alineación").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveAttribute("data-clickable");

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(row, { key: "a" });
    expect(onRowClick).toHaveBeenCalledTimes(3);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("greys muted rows", () => {
    renderTable({ isRowMuted: (row) => row.archived });
    expect(screen.getByText("Lavado").closest("tr")).toHaveAttribute("data-muted", "true");
    expect(screen.getByText("Alineación").closest("tr")).not.toHaveAttribute("data-muted");
  });
});

describe("DataTableSkeleton", () => {
  it("shows the real headers and placeholder rows inside a busy region", () => {
    const { container } = renderWithIntl(
      <DataTableSkeleton columns={[{ header: "Servicio", lines: 2 }]} rows={3} />,
    );
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.getByText("Servicio")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton-block")).toHaveLength(6);
  });
});
