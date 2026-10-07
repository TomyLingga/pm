<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

/** Admin-editable settings stored as JSON per key (see AppDownloadController for `app_downloads`). */
class AppSetting extends Model
{
    public const KEY_APP_DOWNLOADS = 'app_downloads';

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value', 'updated_by_id'];

    protected $casts = ['value' => 'array'];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_id');
    }

    /** Cached read; returns `$default` merged under the stored value. */
    public static function value(string $key, array $default = []): array
    {
        $stored = Cache::remember(self::cacheKey($key), 300, fn () => self::query()->find($key)?->value ?? []);

        return array_merge($default, is_array($stored) ? $stored : []);
    }

    public static function put(string $key, array $value, ?User $by = null): self
    {
        $setting = self::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_by_id' => $by?->id]);
        Cache::forget(self::cacheKey($key));

        return $setting;
    }

    private static function cacheKey(string $key): string
    {
        return "app_setting:{$key}";
    }
}
