<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Audit trail of every status change (who, when, old → new, notes).
        Schema::create('status_logs', function (Blueprint $table) {
            $table->id();
            $table->morphs('loggable');
            $table->string('action', 50);
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30)->nullable();
            $table->text('notes')->nullable();
            $table->json('meta')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        // Electronic approval marks printed as QR codes on PDFs.
        Schema::create('document_signatures', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->morphs('signable');
            $table->string('document_number', 60);
            $table->string('role_key', 30);
            $table->string('role_label', 60);
            $table->foreignId('signer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('signer_name', 150);
            $table->string('signer_nrk', 50)->nullable();
            $table->string('signer_position', 150)->nullable();
            $table->timestamp('signed_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->morphs('attachable');
            $table->string('collection', 30);
            $table->string('disk', 30);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedInteger('size_bytes');
            $table->foreignId('uploaded_by_id')->constrained('users');
            $table->timestamps();
        });

        // Device push tokens (Expo for the Android app).
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 20);
            $table->string('token', 500);
            $table->string('device_name', 150)->nullable();
            $table->unsignedBigInteger('personal_access_token_id')->nullable()->index();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->unique(['channel', 'token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('document_signatures');
        Schema::dropIfExists('status_logs');
    }
};
