<?php

namespace App\Services\Documents;

use Dompdf\Dompdf;
use Dompdf\Options;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;

/**
 * Thin wrapper around dompdf 3 (barryvdh/laravel-dompdf v3 needs Laravel 9+).
 */
class PdfRenderer
{
    public function render(string $view, array $data, string $paper = 'A4', string $orientation = 'portrait'): string
    {
        $options = new Options();
        $options->setIsRemoteEnabled(false);
        $options->setDefaultFont('Helvetica');
        $options->setChroot([resource_path(), public_path()]);
        $options->setTempDir(storage_path('framework/cache'));

        $dompdf = new Dompdf($options);
        $dompdf->setPaper($paper, $orientation);
        $dompdf->loadHtml(view($view, $data)->render(), 'UTF-8');
        $dompdf->render();

        return (string) $dompdf->output();
    }

    /** PNG data URI of a QR code, embeddable in the PDF without remote access. */
    public function qrDataUri(string $content, int $size = 160): string
    {
        $qr = QrCode::create($content)->setSize($size)->setMargin(4);

        return (new PngWriter())->write($qr)->getDataUri();
    }

    public function imageDataUri(string $path): ?string
    {
        if (! is_file($path)) {
            return null;
        }

        return 'data:'.mime_content_type($path).';base64,'.base64_encode((string) file_get_contents($path));
    }
}
