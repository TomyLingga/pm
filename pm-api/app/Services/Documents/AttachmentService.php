<?php

namespace App\Services\Documents;

use App\Models\Attachment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AttachmentService
{
    public function store(Model $owner, UploadedFile $file, string $collection, User $uploader, ?int $max = null): Attachment
    {
        $max ??= (int) config('pm.attachments.max_files');
        $count = Attachment::query()
            ->where('attachable_type', $owner->getMorphClass())
            ->where('attachable_id', $owner->getKey())
            ->count();

        if ($count >= $max) {
            $scope = $owner instanceof \App\Models\PmTaskItem ? 'butir' : 'dokumen';
            throw ValidationException::withMessages(['file' => ["Maksimal {$max} lampiran per {$scope}."]]);
        }

        $disk = config('pm.attachments.disk');
        $path = $file->store("attachments/{$owner->getMorphClass()}/{$owner->getKey()}", $disk);

        $attachment = new Attachment([
            'collection' => $collection,
            'disk' => $disk,
            'path' => $path,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 250),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'size_bytes' => $file->getSize(),
            'uploaded_by_id' => $uploader->id,
        ]);
        $attachment->attachable()->associate($owner);
        $attachment->save();

        return $attachment;
    }

    public function delete(Attachment $attachment): void
    {
        Storage::disk($attachment->disk)->delete($attachment->path);
        $attachment->delete();
    }
}
