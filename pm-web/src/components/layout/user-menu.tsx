"use client";

import * as React from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { logout, orgUnitLabel } from "@/lib/auth";
import { useCurrentUser } from "./current-user";

export function UserMenu() {
  const me = useCurrentUser();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const unit = orgUnitLabel(me);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2">
        <UserAvatar name={me.name} photoUrl={me.photo_url} />
        <span className="hidden max-w-[12rem] leading-tight sm:block">
          <span className="block truncate text-sm font-medium">{me.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{unit || me.position}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
        <span className="sr-only">Menu pengguna</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="font-semibold">{me.name}</p>
          <p className="text-xs text-muted-foreground">NRK {me.nrk || "-"}</p>
          {me.position ? <p className="text-xs text-muted-foreground">{me.position}</p> : null}
          {unit ? <p className="text-xs text-muted-foreground">Unit: {unit}</p> : null}
        </DropdownMenuLabel>
        {me.executor_units.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="space-y-1 font-normal">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit pelaksana</p>
              {me.executor_units.map((unitItem) => (
                <p key={unitItem.id} className="text-xs">
                  {unitItem.display_name}
                  {unitItem.is_lead ? <span className="text-muted-foreground"> (Pimpinan)</span> : null}
                </p>
              ))}
            </DropdownMenuLabel>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void onLogout();
          }}
          disabled={loggingOut}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          {loggingOut ? <Spinner className="h-4 w-4" /> : <LogOut />}
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
