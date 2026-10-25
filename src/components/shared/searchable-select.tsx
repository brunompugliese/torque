"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { normalizeSearch } from "@/lib/search/normalize";

export type SelectOption = {
  value: string;
  label: string;
  // Grey text that tells similar options apart (a phone, a plate).
  secondary?: string;
  // What the box shows once the option is chosen, when that is more than the
  // name ("Fiat Cronos (AD 915 TB)"). Defaults to the label.
  inputLabel?: string;
};

// The last option of a quick-create dropdown ("+ Crear cliente nuevo"). Choosing
// it doesn't select anything: it only calls onSelect.
export type SelectAction = { label: string; onSelect: () => void };

type SearchableSelectProps = {
  id?: string;
  options: readonly SelectOption[];
  // The chosen option's value, "" when none.
  value: string;
  // The chosen option when `options` may not hold it (remote search: the
  // matches of what is typed now).
  selectedOption?: SelectOption;
  onValueChange: (value: string) => void;
  // The text in the box, owned by the caller so a form can reject text that
  // matches no option (docs/design.md#searchable-dropdowns).
  inputValue: string;
  onInputValueChange: (text: string) => void;
  // "local" filters `options` as the user types; "remote" shows them as they come
  // (the caller searches and passes `loading` meanwhile).
  filter?: "local" | "remote";
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyText: string;
  action?: SelectAction;
  // For an optional field: shows an X, named by this text ("Quitar cliente"), while an option is
  // chosen; it empties the choice and the box.
  clearLabel?: string;
  invalid?: boolean;
  describedBy?: string;
};

type Item = SelectOption & { isAction?: boolean };

const boxText = (option: SelectOption) => option.inputLabel ?? option.label;

const ACTION_VALUE = "__action__";

export function SearchableSelect({
  id,
  options,
  value,
  selectedOption,
  onValueChange,
  inputValue,
  onInputValueChange,
  filter = "local",
  loading = false,
  disabled = false,
  placeholder,
  emptyText,
  action,
  clearLabel,
  invalid,
  describedBy,
}: SearchableSelectProps) {
  const tCommon = useTranslations("common");

  const items = useMemo<Item[]>(
    () => (action ? [...options, { value: ACTION_VALUE, label: action.label, isAction: true }] : [...options]),
    [options, action],
  );
  const selected =
    options.find((option) => option.value === value) ?? (selectedOption?.value === value ? selectedOption : null);

  // With an option chosen the box shows its name: opening the list then shows
  // everything, not just that option.
  const matches = useMemo(
    () => (item: Item, query: string) => {
      if (item.isAction || !query || (selected && query === boxText(selected))) return true;
      return normalizeSearch(`${item.label} ${item.secondary ?? ""}`).includes(normalizeSearch(query));
    },
    [selected],
  );

  const noOptions = options.length === 0;

  return (
    <Combobox<Item>
      items={items}
      value={selected}
      inputValue={inputValue}
      filter={filter === "remote" ? null : matches}
      disabled={disabled}
      autoHighlight
      itemToStringLabel={(item) => boxText(item)}
      isItemEqualToValue={(item, other) => item.value === other.value}
      onValueChange={(item) => {
        if (item?.isAction) {
          action?.onSelect();
          return;
        }
        onValueChange(item?.value ?? "");
      }}
      onInputValueChange={(text, details) => {
        // Only what the user does changes the text; closing or leaving the box
        // must not erase text that matched nothing.
        if (details.reason === "input-change") {
          onInputValueChange(text);
          if (selected && text !== boxText(selected)) onValueChange("");
        } else if (details.reason === "item-press" && text !== action?.label) {
          onInputValueChange(text);
        } else if (details.reason === "clear-press") {
          onInputValueChange("");
        }
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        showClear={Boolean(clearLabel)}
        clearLabel={clearLabel}
      />
      <ComboboxContent>
        {loading || noOptions ? (
          <p role="status" className="px-3 py-2 text-center text-sm text-muted-foreground">
            {loading ? tCommon("loading") : emptyText}
          </p>
        ) : null}
        <ComboboxList>
          {(item: Item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.isAction ? (
                <span className="flex items-center gap-1.5 font-medium">
                  <PlusIcon aria-hidden="true" />
                  {item.label}
                </span>
              ) : (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.secondary ? <span className="truncate text-xs text-muted-foreground">{item.secondary}</span> : null}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
