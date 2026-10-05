<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Attachment */
class AttachmentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'collection' => $this->collection,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'url' => '/api/v1/attachments/'.$this->id,
            'uploaded_by' => new UserBriefResource($this->whenLoaded('uploadedBy')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
