<?php

namespace App\Exceptions;

use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Failure while talking to Portal INTES. `portalStatus` is the HTTP status returned by Portal (0 = unreachable).
 */
class PortalException extends RuntimeException
{
    public function __construct(string $message, public readonly int $portalStatus = 0)
    {
        parent::__construct($message);
    }

    public static function fromResponse(Response $response): self
    {
        $message = $response->json('error') ?: $response->json('message') ?: 'Portal menolak permintaan.';

        return new self((string) $message, $response->status());
    }

    public static function unreachable(): self
    {
        return new self('Portal INTES tidak dapat dihubungi. Coba lagi beberapa saat.', 0);
    }

    /** Portal rejected the request itself (bad credentials, expired token, no access). */
    public function isClientError(): bool
    {
        return $this->portalStatus >= 400 && $this->portalStatus < 500;
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->isClientError() ? 401 : 503);
    }
}
