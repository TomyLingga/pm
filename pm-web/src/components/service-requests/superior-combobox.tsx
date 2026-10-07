"use client";

import { AsyncCombobox } from "@/components/common/async-combobox";
import { UserAvatar } from "@/components/common/user-avatar";
import { searchSuperiorCandidates } from "@/lib/lookups";
import { queryKeys } from "@/lib/query-keys";
import type { SuperiorCandidate } from "@/types/lookups";

interface SuperiorComboboxProps {
  id?: string;
  selected: SuperiorCandidate | null;
  onChange: (superior: SuperiorCandidate | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}

function Person({ person }: { person: SuperiorCandidate }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <UserAvatar name={person.name} photoUrl={person.photo_url} className="h-7 w-7" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{person.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[person.grade_code, person.position].filter(Boolean).join(" - ")}
        </span>
      </span>
    </span>
  );
}

/** Searchable picker over `/users/superior-candidates` (users with a higher grade). */
export function SuperiorCombobox({ id, selected, onChange, disabled, invalid }: SuperiorComboboxProps) {
  return (
    <AsyncCombobox<SuperiorCandidate>
      id={id}
      selected={selected}
      onChange={onChange}
      queryKey={(q) => queryKeys.superiorCandidates(q)}
      fetcher={(q, signal) => searchSuperiorCandidates(q, signal)}
      getKey={(item) => item.id}
      minChars={0}
      placeholder="Cari nama atasan…"
      emptyText="Tidak ada kandidat atasan yang cocok."
      disabled={disabled}
      invalid={invalid}
      renderOption={(item) => <Person person={item} />}
      renderSelected={(item) => <Person person={item} />}
    />
  );
}
