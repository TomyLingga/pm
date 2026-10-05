import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { PublicShell } from "@/components/common/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <PublicShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center sm:py-10">
          <FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">Halaman tidak ditemukan</h1>
            <p className="mt-1 text-sm text-muted-foreground">Alamat yang Anda buka tidak tersedia.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/work-orders">Ke daftar Work Order</Link>
          </Button>
        </CardContent>
      </Card>
    </PublicShell>
  );
}
